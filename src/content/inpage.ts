// ClearWallet inpage script - Ethereum provider injection
// Based on Frame and MetaMask patterns for proper EIP-1193 compliance

(function () {
  "use strict";

  // Prevent double injection
  if (window.ethereum && window.ethereum.isClearWallet) {
    console.log("ClearWallet: Already injected");
    return;
  }

  console.log("ClearWallet: Injecting provider...");

  let requestIdCounter = 0;
  const pendingRequests = new Map();
  let isContentScriptReady = false;

  // EIP-1193 error codes
  const EIP1193_ERROR_CODES = {
    USER_REJECTED: 4001,
    UNAUTHORIZED: 4100,
    UNSUPPORTED_METHOD: 4200,
    DISCONNECTED: 4900,
    CHAIN_DISCONNECTED: 4901,
  } as const;

  // EIP-1193 compliant provider
  class ClearWalletProvider {
    // Core properties
    public readonly isClearWallet = true;
    public readonly isMetaMask = true; // For compatibility
    public selectedAddress: string | null = null;
    public chainId: string | null = "0x1";
    public networkVersion: string | null = "1";

    private _isConnected = false;
    private _isAuthorized = false;
    private _eventListeners = new Map<string, Function[]>();

    constructor() {
      this.initialize();
    }

    // MetaMask compatibility properties
    get _metamask() {
      return {
        isUnlocked: () => Promise.resolve(this._isConnected),
        requestBatch: () =>
          Promise.reject(new Error("Batch requests not supported")),
      };
    }

    get _version() {
      return "11.0.0";
    }

    // EIP-1193 methods
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

      console.log(`ClearWallet: Request ${method}`, params);

      // Handle read-only methods that don't require authorization
      switch (method) {
        case "eth_chainId":
          return this.chainId;
        case "net_version":
          return this.networkVersion;
        case "eth_accounts":
          return this._isAuthorized && this.selectedAddress
            ? [this.selectedAddress]
            : [];
      }

      // Check if disconnected for methods that require connection
      if (!this.isConnected() && method !== "eth_requestAccounts") {
        throw this.createError(
          EIP1193_ERROR_CODES.DISCONNECTED,
          "Provider is disconnected from all chains"
        );
      }

      // Handle authorization-required methods
      const authRequiredMethods = [
        "eth_sendTransaction",
        "personal_sign",
        "eth_signTypedData_v4",
        "wallet_switchEthereumChain",
        "wallet_addEthereumChain",
      ];

      if (authRequiredMethods.includes(method) && !this._isAuthorized) {
        throw this.createError(
          EIP1193_ERROR_CODES.UNAUTHORIZED,
          "The requested method and/or account has not been authorized by the user"
        );
      }

      // Send request to content script
      return this.sendRequestToBackground(method, params);
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

    // Legacy methods for compatibility
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

    private async sendRequestToBackground(
      method: string,
      params: any[]
    ): Promise<any> {
      return new Promise((resolve, reject) => {
        const requestId = ++requestIdCounter;

        // Store the promise resolvers
        pendingRequests.set(requestId, { resolve, reject });

        // Send to content script
        const message = {
          type: "CLEARWALLET_ETH_REQUEST",
          data: { method, params },
          id: requestId,
        };

        console.log("ClearWallet: Sending request:", message);
        window.postMessage(message, "*");

        // Timeout after 30 seconds
        setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.delete(requestId);
            reject(
              this.createError(
                EIP1193_ERROR_CODES.DISCONNECTED,
                "Request timeout"
              )
            );
          }
        }, 30000);
      });
    }

    private createError(code: number, message: string, data?: unknown): Error {
      const error = new Error(message) as any;
      error.code = code;
      if (data !== undefined) {
        error.data = data;
      }
      return error;
    }

    private emit(event: string, data?: any) {
      const listeners = this._eventListeners.get(event);
      if (listeners) {
        listeners.forEach((callback) => {
          try {
            callback(data);
          } catch (error) {
            console.error("ClearWallet: Error in event listener:", error);
          }
        });
      }
    }

    private initialize() {
      // Listen for messages from content script
      window.addEventListener("message", (event) => {
        if (event.source !== window) return;

        const { type, data, id } = event.data;

        // Handle content script ready signal
        if (type === "CLEARWALLET_CONTENT_SCRIPT_READY") {
          isContentScriptReady = true;
          console.log("ClearWallet: Content script ready");
          this.checkExistingConnection();
          return;
        }

        // Handle request responses
        if (
          type === "CLEARWALLET_ETH_REQUEST_RESPONSE" &&
          pendingRequests.has(id)
        ) {
          const { resolve, reject } = pendingRequests.get(id);
          pendingRequests.delete(id);

          if (data.error) {
            if (data.error.includes && data.error.includes("rejected")) {
              reject(
                this.createError(
                  EIP1193_ERROR_CODES.USER_REJECTED,
                  "User rejected the request"
                )
              );
            } else {
              reject(
                this.createError(EIP1193_ERROR_CODES.UNAUTHORIZED, data.error)
              );
            }
          } else {
            // Handle successful connection
            if (data.accounts && data.accounts.length > 0) {
              this.selectedAddress = data.accounts[0];
              this.chainId = data.chainId || this.chainId;
              // Convert hex chainId to decimal string for networkVersion
              this.networkVersion = this.chainId
                ? parseInt(this.chainId, 16).toString()
                : "1";
              this._isConnected = true;
              this._isAuthorized = true;

              this.emit("connect", { chainId: this.chainId });
              this.emit("accountsChanged", data.accounts);
            }

            resolve(data.accounts || data.result || data);
          }
          return;
        }

        // Handle background script events
        switch (type) {
          case "CLEARWALLET_CONNECTION_SUCCESS":
          case "CONNECTION_SUCCESS":
            this.handleConnectionSuccess(data);
            break;
          case "CLEARWALLET_ACCOUNT_CHANGED":
          case "ACCOUNT_CHANGED":
            this.handleAccountChanged(data);
            break;
          case "CLEARWALLET_CHAIN_CHANGED":
          case "CHAIN_CHANGED":
            this.handleChainChanged(data);
            break;
          case "CLEARWALLET_WALLET_DISCONNECTED":
          case "WALLET_DISCONNECTED":
            this.handleDisconnected();
            break;
        }
      });
    }

    private async checkExistingConnection() {
      try {
        const message = {
          type: "CLEARWALLET_CHECK_CONNECTION",
          data: { origin: window.location.origin },
          id: ++requestIdCounter,
        };

        window.postMessage(message, "*");
      } catch (error) {
        console.log("ClearWallet: No existing connection");
      }
    }

    private handleConnectionSuccess(data: {
      account: string;
      chainId: string;
    }) {
      console.log("ClearWallet: Connection success!", data);
      this.selectedAddress = data.account;
      this.chainId = data.chainId;
      // Convert hex chainId to decimal string for networkVersion
      this.networkVersion = data.chainId
        ? parseInt(data.chainId, 16).toString()
        : "1";
      this._isConnected = true;
      this._isAuthorized = true;

      this.emit("connect", { chainId: data.chainId });
      this.emit("accountsChanged", [data.account]);
    }

    private handleAccountChanged(data: { accounts: string[] }) {
      this.selectedAddress = data.accounts[0] || null;
      this.emit("accountsChanged", data.accounts);
    }

    private handleChainChanged(data: { chainId: string }) {
      this.chainId = data.chainId;
      // Convert hex chainId to decimal string for networkVersion
      this.networkVersion = data.chainId
        ? parseInt(data.chainId, 16).toString()
        : "1";
      this.emit("chainChanged", data.chainId);
    }

    private handleDisconnected() {
      this.selectedAddress = null;
      this._isConnected = false;
      this._isAuthorized = false;
      this.emit("disconnect");
      this.emit("accountsChanged", []);
    }
  }

  // Create and inject the provider
  const provider = new ClearWalletProvider();

  // Store any existing provider for debugging
  if (
    window.ethereum &&
    window.ethereum !== provider &&
    !window.ethereum.isClearWallet
  ) {
    (window as any).ethereum_backup = window.ethereum;
  }

  // First expose as clearwallet for priority script to find
  Object.defineProperty(window, "clearwallet", {
    value: provider,
    writable: false,
    configurable: false,
  });

  // Check if we have priority and install accordingly
  if ((window as any).clearwallet_priority) {
    console.log("ClearWallet: Have priority, installing provider");
  } else {
    console.log("ClearWallet: No priority flag, installing anyway");
  }

  // Force override the ethereum provider
  Object.defineProperty(window, "ethereum", {
    value: provider,
    writable: false,
    configurable: true,
  });

  console.log(
    "ClearWallet: Provider installed as window.ethereum and window.clearwallet"
  );
  console.log("ClearWallet: window.ethereum =", window.ethereum);
  console.log(
    "ClearWallet: window.ethereum.isClearWallet =",
    window.ethereum?.isClearWallet
  );

  // Dispatch ethereum initialization events
  window.dispatchEvent(new Event("ethereum#initialized"));

  // EIP-6963 announcement for provider discovery
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

  console.log("ClearWallet: Provider injected successfully");
})();
