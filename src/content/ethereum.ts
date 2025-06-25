// Ethereum provider injection for dApps

// EIP-1193 compliant error interface
interface ProviderRpcError extends Error {
  code: number;
  data?: unknown;
}

// EIP-1193 error codes
const EIP1193_ERROR_CODES = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
} as const;

interface EthereumProvider {
  isConnected(): boolean;
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(event: string, callback: Function): void;
  removeListener(event: string, callback: Function): void;
  selectedAddress: string | null;
  chainId: string | null;
  networkVersion: string | null;
  isMetaMask: boolean;
  isClearWallet: boolean;
}

class ClearWalletProvider implements EthereumProvider {
  private _selectedAddress: string | null = null;
  private _chainId: string | null = null;
  private _networkVersion: string | null = null;
  private _isConnected: boolean = false;
  private _eventListeners: Map<string, Function[]> = new Map();
  private _isAuthorized: boolean = false; // EIP-1193: read-only by default

  constructor() {
    // Set default mainnet values
    this._chainId = "0x1";
    this._networkVersion = "1";
    this.initialize();
  }

  get selectedAddress() {
    return this._selectedAddress;
  }

  get chainId() {
    return this._chainId;
  }

  get networkVersion() {
    return this._networkVersion;
  }

  get isMetaMask() {
    return true; // For compatibility
  }

  get isClearWallet() {
    return true;
  }

  // Additional MetaMask compatibility properties
  get _metamask() {
    return {
      isUnlocked: () => Promise.resolve(this._isConnected),
      requestBatch: () =>
        Promise.reject(new Error("Batch requests not supported")),
    };
  }

  // Version mimicking MetaMask
  get _version() {
    return "11.0.0";
  }

  // MetaMask methods for better compatibility
  enable() {
    console.warn(
      'ethereum.enable() is deprecated. Use ethereum.request({method: "eth_requestAccounts"}) instead.'
    );
    return this.request({ method: "eth_requestAccounts" });
  }

  send(method: string, params?: any[]) {
    console.warn(
      "ethereum.send() is deprecated. Use ethereum.request() instead."
    );
    return this.request({ method, params });
  }

  sendAsync(payload: any, callback: Function) {
    console.warn(
      "ethereum.sendAsync() is deprecated. Use ethereum.request() instead."
    );
    this.request(payload)
      .then((result) =>
        callback(null, { id: payload.id, jsonrpc: "2.0", result })
      )
      .catch((error) => callback(error, null));
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    const { method, params = [] } = args;

    // Validate method parameter
    if (!method || typeof method !== "string") {
      throw this.createError(
        EIP1193_ERROR_CODES.UNSUPPORTED_METHOD,
        "Method is not a valid string"
      );
    }

    // Check if disconnected
    if (!this.isConnected() && method !== "eth_requestAccounts") {
      throw this.createError(
        EIP1193_ERROR_CODES.DISCONNECTED,
        "Provider is disconnected from all chains"
      );
    }

    switch (method) {
      case "eth_requestAccounts":
        return this.requestAccounts();

      case "eth_accounts":
        return this.getAccounts();

      case "eth_chainId":
        return this._chainId;

      case "net_version":
        return this._networkVersion;

      case "eth_sendTransaction":
        if (!this._isAuthorized) {
          throw this.createError(
            EIP1193_ERROR_CODES.UNAUTHORIZED,
            "The requested method and/or account has not been authorized by the user"
          );
        }
        return this.sendTransaction(params[0]);

      case "personal_sign":
        if (!this._isAuthorized) {
          throw this.createError(
            EIP1193_ERROR_CODES.UNAUTHORIZED,
            "The requested method and/or account has not been authorized by the user"
          );
        }
        return this.personalSign(params[0], params[1]);

      case "eth_signTypedData_v4":
        if (!this._isAuthorized) {
          throw this.createError(
            EIP1193_ERROR_CODES.UNAUTHORIZED,
            "The requested method and/or account has not been authorized by the user"
          );
        }
        return this.signTypedData(params[0], params[1]);

      case "wallet_switchEthereumChain":
        return this.switchChain(params[0]);

      case "wallet_addEthereumChain":
        return this.addChain(params[0]);

      case "eth_getBalance":
        return this.getBalance(params[0], params[1]);

      case "eth_getTransactionCount":
        return this.getTransactionCount(params[0], params[1]);

      case "eth_estimateGas":
        return this.estimateGas(params[0]);

      case "eth_gasPrice":
        return this.getGasPrice();

      case "eth_getBlockByNumber":
        return this.getBlockByNumber(params[0], params[1]);

      case "eth_call":
        return this.call(params[0], params[1]);

      default:
        // For unsupported methods, throw proper EIP-1193 error
        throw this.createError(
          EIP1193_ERROR_CODES.UNSUPPORTED_METHOD,
          `The Provider does not support the requested method: ${method}`
        );
    }
  }

  on(event: string, callback: Function): void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, []);
    }
    this._eventListeners.get(event)!.push(callback);
  }

  removeListener(event: string, callback: Function): void {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private createError(
    code: number,
    message: string,
    data?: unknown
  ): ProviderRpcError {
    const error = new Error(message) as ProviderRpcError;
    error.code = code;
    if (data !== undefined) {
      error.data = data;
    }
    return error;
  }

  private async initialize() {
    // Listen for messages from background script (Chrome extension messages)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { type, data } = message;

      switch (type) {
        case "CONNECTION_SUCCESS":
          this.handleConnectionSuccess(data);
          break;

        case "ACCOUNT_CHANGED":
          this.handleAccountChanged(data);
          break;

        case "CHAIN_CHANGED":
          this.handleChainChanged(data);
          break;

        case "WALLET_DISCONNECTED":
          this.handleDisconnected();
          break;
      }
    });

    // Also listen for window messages (for inpage script communication)
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;

      const { type, data } = event.data;

      switch (type) {
        case "CONNECTION_SUCCESS":
          this.handleConnectionSuccess(data);
          break;

        case "ACCOUNT_CHANGED":
          this.handleAccountChanged(data);
          break;

        case "CHAIN_CHANGED":
          this.handleChainChanged(data);
          break;

        case "WALLET_DISCONNECTED":
          this.handleDisconnected();
          break;
      }
    });

    // Check for existing connection
    await this.checkConnection();
  }

  private async checkConnection() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "CHECK_CONNECTION",
        data: { origin: window.location.origin },
      });

      if (response && response.connected) {
        this._selectedAddress = response.account;
        this._chainId = response.chainId;
        // Convert hex chainId to decimal string for networkVersion
        this._networkVersion = response.chainId
          ? parseInt(response.chainId, 16).toString()
          : "1";
        this._isConnected = true;
        this._isAuthorized = true;
      }
    } catch (error) {
      console.log("ClearWallet: No existing connection");
    }
  }

  private async requestAccounts(): Promise<string[]> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_REQUEST_ACCOUNTS",
        data: {
          siteName: document.title,
          siteIcon: this.getSiteIcon(),
          origin: window.location.origin,
        },
      });

      if (response.error) {
        if (response.error.includes("rejected")) {
          throw this.createError(
            EIP1193_ERROR_CODES.USER_REJECTED,
            "User rejected the request"
          );
        }
        throw this.createError(
          EIP1193_ERROR_CODES.UNAUTHORIZED,
          response.error
        );
      }

      if (response.accounts && response.accounts.length > 0) {
        this._selectedAddress = response.accounts[0];
        this._chainId = response.chainId || this._chainId;
        // Convert hex chainId to decimal string for networkVersion
        this._networkVersion = this._chainId
          ? parseInt(this._chainId, 16).toString()
          : "1";
        this._isConnected = true;
        this._isAuthorized = true;

        console.log("ClearWallet: Request accounts success!", {
          accounts: response.accounts,
          chainId: this._chainId,
        });

        this.emit("connect", { chainId: this._chainId });
        this.emit("accountsChanged", response.accounts);
        return response.accounts;
      }

      throw this.createError(
        EIP1193_ERROR_CODES.USER_REJECTED,
        "User rejected the request"
      );
    } catch (error) {
      console.error("ClearWallet: Failed to request accounts", error);
      if (error instanceof Error && (error as ProviderRpcError).code) {
        throw error; // Re-throw EIP-1193 errors as-is
      }
      throw this.createError(
        EIP1193_ERROR_CODES.UNAUTHORIZED,
        "Failed to request accounts"
      );
    }
  }

  private async getAccounts(): Promise<string[]> {
    // EIP-1193: Return empty array if not authorized
    if (this._isAuthorized && this._isConnected && this._selectedAddress) {
      return [this._selectedAddress];
    }
    return [];
  }

  private async sendTransaction(txParams: any): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_SEND_TRANSACTION",
        data: txParams,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.hash;
    } catch (error) {
      console.error("ClearWallet: Failed to send transaction", error);
      throw error;
    }
  }

  private async personalSign(
    message: string,
    address: string
  ): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_SIGN_MESSAGE",
        data: { message, address, method: "personal_sign" },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.signature;
    } catch (error) {
      console.error("ClearWallet: Failed to sign message", error);
      throw error;
    }
  }

  private async signTypedData(
    address: string,
    typedData: any
  ): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_SIGN_MESSAGE",
        data: { typedData, address, method: "eth_signTypedData_v4" },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.signature;
    } catch (error) {
      console.error("ClearWallet: Failed to sign typed data", error);
      throw error;
    }
  }

  private async switchChain(chainParams: { chainId: string }): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "WALLET_SWITCH_CHAIN",
        data: chainParams,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      this._chainId = chainParams.chainId;
      // Convert hex chainId to decimal string for networkVersion
      this._networkVersion = chainParams.chainId
        ? parseInt(chainParams.chainId, 16).toString()
        : "1";
      this.emit("chainChanged", chainParams.chainId);
    } catch (error) {
      console.error("ClearWallet: Failed to switch chain", error);
      throw error;
    }
  }

  private async addChain(chainParams: any): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "WALLET_ADD_CHAIN",
        data: chainParams,
      });

      if (response.error) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("ClearWallet: Failed to add chain", error);
      throw error;
    }
  }

  private async getBalance(
    address: string,
    blockTag: string = "latest"
  ): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_GET_BALANCE",
        data: { address, blockTag },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.result;
    } catch (error) {
      console.error("ClearWallet: Failed to get balance", error);
      throw error;
    }
  }

  private async getTransactionCount(
    address: string,
    blockTag: string = "latest"
  ): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_GET_TRANSACTION_COUNT",
        data: { address, blockTag },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.result;
    } catch (error) {
      console.error("ClearWallet: Failed to get transaction count", error);
      throw error;
    }
  }

  private async estimateGas(txParams: any): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_ESTIMATE_GAS",
        data: txParams,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.result;
    } catch (error) {
      console.error("ClearWallet: Failed to estimate gas", error);
      throw error;
    }
  }

  private async getGasPrice(): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_GAS_PRICE",
        data: {},
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.result;
    } catch (error) {
      console.error("ClearWallet: Failed to get gas price", error);
      throw error;
    }
  }

  private async getBlockByNumber(
    blockNumber: string,
    includeTransactions: boolean = false
  ): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_GET_BLOCK_BY_NUMBER",
        data: { blockNumber, includeTransactions },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.result;
    } catch (error) {
      console.error("ClearWallet: Failed to get block", error);
      throw error;
    }
  }

  private async call(
    txParams: any,
    blockTag: string = "latest"
  ): Promise<string> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ETH_CALL",
        data: { txParams, blockTag },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.result;
    } catch (error) {
      console.error("ClearWallet: Failed to call", error);
      throw error;
    }
  }

  private handleConnectionSuccess(data: { account: string; chainId: string }) {
    console.log("ClearWallet: Connection success!", data);
    this._selectedAddress = data.account;
    this._chainId = data.chainId;
    // Convert hex chainId to decimal string for networkVersion
    this._networkVersion = data.chainId
      ? parseInt(data.chainId, 16).toString()
      : "1";
    this._isConnected = true;

    this.emit("connect", { chainId: data.chainId });
    this.emit("accountsChanged", [data.account]);

    // Force trigger events on the page
    window.dispatchEvent(
      new CustomEvent("ethereum#accountsChanged", {
        detail: [data.account],
      })
    );

    window.dispatchEvent(
      new CustomEvent("ethereum#chainChanged", {
        detail: data.chainId,
      })
    );
  }

  private handleAccountChanged(data: { accounts: string[] }) {
    this._selectedAddress = data.accounts[0] || null;
    this.emit("accountsChanged", data.accounts);
  }

  private handleChainChanged(data: { chainId: string }) {
    this._chainId = data.chainId;
    // Convert hex chainId to decimal string for networkVersion
    this._networkVersion = data.chainId
      ? parseInt(data.chainId, 16).toString()
      : "1";
    this.emit("chainChanged", data.chainId);
  }

  private handleDisconnected() {
    this._selectedAddress = null;
    this._isConnected = false;
    this.emit("disconnect");
    this.emit("accountsChanged", []);
  }

  private emit(event: string, data?: any) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  private getSiteIcon(): string | undefined {
    const linkElements = document.querySelectorAll('link[rel*="icon"]');
    for (const link of linkElements) {
      const href = (link as HTMLLinkElement).href;
      if (href) {
        return href;
      }
    }
    return undefined;
  }
}

// Inject the provider
function injectProvider() {
  if (typeof window !== "undefined") {
    const provider = new ClearWalletProvider();

    // Store any existing provider
    const existingProvider = window.ethereum;

    // Force override the ethereum provider
    Object.defineProperty(window, "ethereum", {
      value: provider,
      writable: true,
      configurable: true,
    });

    // Also expose as clearwallet for direct access
    Object.defineProperty(window, "clearwallet", {
      value: provider,
      writable: false,
      configurable: false,
    });

    // Backup other providers under different names for debugging
    if (existingProvider && existingProvider !== provider) {
      (window as any).ethereum_backup = existingProvider;
    }

    // Dispatch ethereum provider events
    window.dispatchEvent(new Event("ethereum#initialized"));

    // For compatibility with older dApps
    window.dispatchEvent(
      new CustomEvent("ethereum#initialized", {
        detail: provider,
      })
    );

    // Also dispatch the standard EIP-1193 events
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: {
          info: {
            uuid: "clearwallet-" + crypto.randomUUID(),
            name: "ClearWallet",
            icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMzYjgyZjYiLz48L3N2Zz4=",
            rdns: "io.clearwallet",
          },
          provider,
        },
      })
    );

    console.log("ClearWallet: Provider injected and prioritized");
  }
}

// Inject immediately and set highest priority
injectProvider();

export default ClearWalletProvider;
