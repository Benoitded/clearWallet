// Core RPC method registry for handling all Ethereum JSON-RPC methods
import { NetworkManager } from "../networks/NetworkManager";
import { StorageService } from "../storage/StorageService";

export interface RPCContext {
  origin?: string;
  sender?: chrome.runtime.MessageSender;
  tabId?: number;
}

export interface RPCMethodHandler {
  method: string;
  handler: (params: any[], context: RPCContext) => Promise<any>;
  permissions?: string[];
  description?: string;
}

export interface RPCError {
  code: number;
  message: string;
  data?: any;
}

// Standard JSON-RPC error codes
export const RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,

  // EIP-1193 error codes
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  USER_REJECTED: 4001,
  RESOURCE_NOT_FOUND: 5001,
  RESOURCE_UNAVAILABLE: 5002,
  TRANSACTION_REJECTED: 5003,
  METHOD_NOT_SUPPORTED: 5004,
  LIMIT_EXCEEDED: 5005,
} as const;

export class RPCMethodRegistry {
  private static instance: RPCMethodRegistry;
  private handlers = new Map<string, RPCMethodHandler>();
  private networkManager: NetworkManager;
  private storageService: StorageService;

  private constructor() {
    this.networkManager = NetworkManager.getInstance();
    this.storageService = StorageService.getInstance();
    this.registerBuiltInMethods();
  }

  static getInstance(): RPCMethodRegistry {
    if (!RPCMethodRegistry.instance) {
      RPCMethodRegistry.instance = new RPCMethodRegistry();
    }
    return RPCMethodRegistry.instance;
  }

  /**
   * Register a new RPC method handler
   */
  register(handler: RPCMethodHandler): void {
    this.handlers.set(handler.method, handler);
    console.log(`RPCMethodRegistry: Registered handler for ${handler.method}`);
  }

  /**
   * Execute an RPC method
   */
  async execute(
    method: string,
    params: any[] = [],
    context: RPCContext = {}
  ): Promise<any> {
    const handler = this.handlers.get(method);

    if (!handler) {
      throw this.createError(
        RPC_ERROR_CODES.METHOD_NOT_FOUND,
        `Method ${method} not found`
      );
    }

    try {
      // Check permissions if required
      if (handler.permissions && handler.permissions.length > 0) {
        await this.checkPermissions(handler.permissions, context);
      }

      console.log(
        `RPCMethodRegistry: Executing ${method} with params:`,
        params
      );
      const result = await handler.handler(params, context);
      console.log(`RPCMethodRegistry: ${method} result:`, result);

      return result;
    } catch (error) {
      console.error(`RPCMethodRegistry: Error executing ${method}:`, error);

      if (error instanceof Error && "code" in error) {
        throw error; // Already an RPC error
      }

      throw this.createError(
        RPC_ERROR_CODES.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Get all registered methods
   */
  getRegisteredMethods(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a method is supported
   */
  isMethodSupported(method: string): boolean {
    return this.handlers.has(method);
  }

  /**
   * Create standardized RPC error
   */
  createError(code: number, message: string, data?: any): RPCError {
    const error = new Error(message) as Error & RPCError;
    error.code = code;
    error.message = message;
    if (data !== undefined) {
      error.data = data;
    }
    return error;
  }

  /**
   * Register all built-in RPC methods
   */
  private registerBuiltInMethods(): void {
    // Account methods
    this.register({
      method: "eth_accounts",
      handler: this.handleEthAccounts.bind(this),
      permissions: [],
      description: "Get current accounts",
    });

    this.register({
      method: "eth_requestAccounts",
      handler: this.handleEthRequestAccounts.bind(this),
      permissions: [],
      description: "Request access to accounts",
    });

    // Network methods
    this.register({
      method: "eth_chainId",
      handler: this.handleEthChainId.bind(this),
      permissions: [],
      description: "Get current chain ID",
    });

    this.register({
      method: "net_version",
      handler: this.handleNetVersion.bind(this),
      permissions: [],
      description: "Get network version",
    });

    // Wallet methods
    this.register({
      method: "wallet_switchEthereumChain",
      handler: this.handleWalletSwitchChain.bind(this),
      permissions: ["connected"],
      description: "Switch to a different Ethereum chain",
    });

    this.register({
      method: "wallet_addEthereumChain",
      handler: this.handleWalletAddChain.bind(this),
      permissions: ["connected"],
      description: "Add a new Ethereum chain",
    });

    // Read methods
    this.register({
      method: "eth_getBalance",
      handler: this.handleEthGetBalance.bind(this),
      permissions: ["connected"],
      description: "Get account balance",
    });

    this.register({
      method: "eth_getTransactionCount",
      handler: this.handleEthGetTransactionCount.bind(this),
      permissions: ["connected"],
      description: "Get transaction count (nonce)",
    });

    // Transaction methods
    this.register({
      method: "eth_sendTransaction",
      handler: this.handleEthSendTransaction.bind(this),
      permissions: ["connected"],
      description: "Send a transaction",
    });

    this.register({
      method: "eth_signTransaction",
      handler: this.handleEthSignTransaction.bind(this),
      permissions: ["connected"],
      description: "Sign a transaction",
    });

    // Signing methods
    this.register({
      method: "personal_sign",
      handler: this.handlePersonalSign.bind(this),
      permissions: ["connected"],
      description: "Sign a message",
    });

    this.register({
      method: "eth_sign",
      handler: this.handleEthSign.bind(this),
      permissions: ["connected"],
      description: "Sign data",
    });
  }

  // =================== RPC Method Handlers ===================

  private async handleEthAccounts(
    params: any[],
    context: RPCContext
  ): Promise<string[]> {
    const wallets = await this.storageService.get("wallets");
    const selectedWallet = await this.storageService.get("selectedWallet");

    if (!wallets || wallets.length === 0 || !selectedWallet) {
      return [];
    }

    return [selectedWallet.address];
  }

  private async handleEthRequestAccounts(
    params: any[],
    context: RPCContext
  ): Promise<string[]> {
    // Check if site is already connected
    if (context.origin) {
      const connectedSites =
        (await this.storageService.get("connectedSites")) || [];
      const existingConnection = connectedSites.find(
        (site) => site.url === context.origin
      );

      if (existingConnection) {
        // Site already connected, return accounts
        return [existingConnection.account];
      }
    }

    // Check if we have wallets available
    const accounts = await this.handleEthAccounts(params, context);
    if (accounts.length === 0) {
      throw this.createError(
        RPC_ERROR_CODES.UNAUTHORIZED,
        "No accounts available. Please create or import a wallet first."
      );
    }

    // Site is not connected and we have wallets - request user approval
    if (context.origin && context.tabId) {
      return await this.requestConnectionApproval(
        context.origin,
        context.tabId
      );
    }

    // No origin or tabId provided - return empty for security
    throw this.createError(
      RPC_ERROR_CODES.UNAUTHORIZED,
      "Connection request requires valid origin"
    );
  }

  /**
   * Request user approval for connection
   */
  private async requestConnectionApproval(
    origin: string,
    tabId: number
  ): Promise<string[]> {
    try {
      // Extract site information
      const siteUrl = new URL(origin);
      const siteName = siteUrl.hostname;

      // Get site icon (favicon)
      let siteIcon = "";
      try {
        const tab = await chrome.tabs.get(tabId);
        siteIcon = tab.favIconUrl || "";
      } catch (error) {
        console.log("Could not get site icon:", error);
      }

      // Generate unique request ID
      const requestId = `conn_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Store connection request in app state (use chrome storage directly for temp state)
      const result = await chrome.storage.local.get(["appState"]);
      const currentAppState = result.appState || {};
      const updatedAppState = {
        ...currentAppState,
        currentView: "connect-dapp",
        connectDAppRequest: {
          requestId,
          origin,
          siteName,
          siteIcon,
          tabId,
          timestamp: Date.now(),
        },
      };

      await chrome.storage.local.set({ appState: updatedAppState });

      // Open popup
      await chrome.action.openPopup();

      // Wait for user response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            this.createError(
              RPC_ERROR_CODES.USER_REJECTED,
              "Connection request timed out"
            )
          );
        }, 120000); // 2 minutes timeout

        // Listen for connection approval/rejection
        const messageListener = (
          message: any,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: any) => void
        ) => {
          if (
            message.type === "CONNECTION_APPROVED" &&
            message.data?.requestId === requestId
          ) {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(messageListener);

            // Connection approved, add to storage and return accounts
            this.addConnection(origin, message.data.account)
              .then(() => {
                resolve([message.data.account]);
              })
              .catch(reject);
          } else if (
            message.type === "CONNECTION_REJECTED" &&
            message.data?.requestId === requestId
          ) {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(messageListener);

            reject(
              this.createError(
                RPC_ERROR_CODES.USER_REJECTED,
                "User rejected the connection request"
              )
            );
          }
        };

        chrome.runtime.onMessage.addListener(messageListener);
      });
    } catch (error) {
      console.error("Error requesting connection approval:", error);
      throw this.createError(
        RPC_ERROR_CODES.INTERNAL_ERROR,
        "Failed to request connection approval"
      );
    }
  }

  private async handleEthChainId(
    params: any[],
    context: RPCContext
  ): Promise<string> {
    const selectedNetwork = await this.networkManager.getSelectedNetwork();
    return selectedNetwork
      ? this.networkManager.chainIdToHex(selectedNetwork.chainId)
      : "0x1"; // Default to mainnet
  }

  private async handleNetVersion(
    params: any[],
    context: RPCContext
  ): Promise<string> {
    const selectedNetwork = await this.networkManager.getSelectedNetwork();
    return selectedNetwork ? selectedNetwork.chainId.toString() : "1"; // Default to mainnet
  }

  private async handleWalletSwitchChain(
    params: any[],
    context: RPCContext
  ): Promise<null> {
    if (!params[0] || !params[0].chainId) {
      throw this.createError(
        RPC_ERROR_CODES.INVALID_PARAMS,
        "Missing chainId parameter"
      );
    }

    try {
      const chainId = this.networkManager.parseChainId(params[0].chainId);
      const targetNetwork = await this.networkManager.findNetworkByChainId(
        chainId
      );

      if (!targetNetwork) {
        throw this.createError(
          RPC_ERROR_CODES.RESOURCE_NOT_FOUND,
          `Unrecognized chain ID "${params[0].chainId}". Try adding the chain using wallet_addEthereumChain first.`
        );
      }

      await this.networkManager.switchNetwork(targetNetwork);
      return null; // EIP-3326: Return null on success
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        throw error;
      }
      throw this.createError(
        RPC_ERROR_CODES.INTERNAL_ERROR,
        "Failed to switch chain"
      );
    }
  }

  private async handleWalletAddChain(
    params: any[],
    context: RPCContext
  ): Promise<null> {
    if (!params[0]) {
      throw this.createError(
        RPC_ERROR_CODES.INVALID_PARAMS,
        "Missing chain parameters"
      );
    }

    try {
      await this.networkManager.addCustomNetwork(params[0]);
      return null; // EIP-3085: Return null on success
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        return null; // EIP-3085: Return null if chain already exists
      }

      throw this.createError(
        RPC_ERROR_CODES.INTERNAL_ERROR,
        "Failed to add chain"
      );
    }
  }

  private async handleEthGetBalance(
    params: any[],
    context: RPCContext
  ): Promise<string> {
    // TODO: Implement actual balance fetching
    return "0x0";
  }

  private async handleEthGetTransactionCount(
    params: any[],
    context: RPCContext
  ): Promise<string> {
    // TODO: Implement actual nonce fetching
    return "0x0";
  }

  private async handleEthSendTransaction(
    params: any[],
    context: RPCContext
  ): Promise<string> {
    // TODO: Implement transaction sending
    throw this.createError(
      RPC_ERROR_CODES.METHOD_NOT_SUPPORTED,
      "Transaction sending not yet implemented"
    );
  }

  private async handleEthSignTransaction(
    params: any[],
    context: RPCContext
  ): Promise<string> {
    // TODO: Implement transaction signing
    throw this.createError(
      RPC_ERROR_CODES.METHOD_NOT_SUPPORTED,
      "Transaction signing not yet implemented"
    );
  }

  private async handlePersonalSign(
    params: any[],
    context: RPCContext
  ): Promise<string> {
    // TODO: Implement message signing
    throw this.createError(
      RPC_ERROR_CODES.METHOD_NOT_SUPPORTED,
      "Message signing not yet implemented"
    );
  }

  private async handleEthSign(
    params: any[],
    context: RPCContext
  ): Promise<string> {
    // TODO: Implement data signing
    throw this.createError(
      RPC_ERROR_CODES.METHOD_NOT_SUPPORTED,
      "Data signing not yet implemented"
    );
  }

  // =================== Helper Methods ===================

  private async checkPermissions(
    permissions: string[],
    context: RPCContext
  ): Promise<void> {
    if (permissions.includes("connected") && context.origin) {
      const connectedSites =
        (await this.storageService.get("connectedSites")) || [];
      const isConnected = connectedSites.some(
        (site) => site.url === context.origin
      );

      if (!isConnected) {
        throw this.createError(
          RPC_ERROR_CODES.UNAUTHORIZED,
          "The requested account and/or method has not been authorized by the user."
        );
      }
    }
  }

  private async addConnection(origin: string, account: string): Promise<void> {
    const connectedSites =
      (await this.storageService.get("connectedSites")) || [];
    const existingSite = connectedSites.find((site) => site.url === origin);

    if (!existingSite) {
      const selectedNetwork = await this.networkManager.getSelectedNetwork();
      const newSite = {
        url: origin,
        account,
        chainId: selectedNetwork?.chainId || 1,
        lastUsed: Date.now(),
        permissions: ["connected"],
      };

      connectedSites.push(newSite);
      await this.storageService.set("connectedSites", connectedSites);
      console.log(`RPCMethodRegistry: Added connection for ${origin}`);
    }
  }
}
