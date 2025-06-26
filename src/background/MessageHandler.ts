// Message handling service for background script communication
import { ClearWalletCore, RPCContext } from "../core";

export interface BackgroundMessage {
  type: string;
  data?: any;
  id?: string;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    data?: any;
  };
}

export class MessageHandler {
  private isInitialized = false;

  /**
   * Initialize the message handler
   */
  initialize(): void {
    if (this.isInitialized) return;

    try {
      console.log("MessageHandler: Initializing...");
      this.isInitialized = true;
      console.log("MessageHandler: Initialized");
    } catch (error) {
      console.error("MessageHandler: Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Handle runtime messages
   */
  async handleMessage(
    message: BackgroundMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): Promise<void> {
    try {
      console.log(
        "MessageHandler: Received message:",
        message.type,
        message.data
      );

      // Create RPC context
      const context: RPCContext = {
        origin: sender.origin || sender.url,
        sender,
        tabId: sender.tab?.id,
      };

      let response: MessageResponse;

      // Route message based on type
      switch (message.type) {
        // RPC method calls
        case "ETH_REQUEST":
        case "CLEARWALLET_ETH_REQUEST":
          response = await this.handleEthRequest(message.data, context);
          break;

        // Wallet management
        case "GET_WALLETS":
          response = await this.handleGetWallets();
          break;

        case "CREATE_WALLET":
          response = await this.handleCreateWallet(message.data);
          break;

        case "IMPORT_WALLET":
          response = await this.handleImportWallet(message.data);
          break;

        case "SELECT_WALLET":
          response = await this.handleSelectWallet(message.data);
          break;

        // Network management
        case "GET_NETWORKS":
          response = await this.handleGetNetworks();
          break;

        case "SWITCH_NETWORK":
          response = await this.handleSwitchNetwork(message.data);
          break;

        case "ADD_NETWORK":
          response = await this.handleAddNetwork(message.data);
          break;

        // Connection management
        case "GET_CONNECTED_SITES":
          response = await this.handleGetConnectedSites();
          break;

        case "DISCONNECT_SITE":
          response = await this.handleDisconnectSite(message.data);
          break;

        // Settings
        case "GET_SETTINGS":
          response = await this.handleGetSettings();
          break;

        case "UPDATE_SETTINGS":
          response = await this.handleUpdateSettings(message.data);
          break;

        // Status
        case "GET_STATUS":
          response = await this.handleGetStatus();
          break;

        // DApp connection checks
        case "CLEARWALLET_CHECK_CONNECTION":
          response = await this.handleCheckConnection(message.data, context);
          break;

        default:
          response = {
            success: false,
            error: {
              code: "UNKNOWN_MESSAGE_TYPE",
              message: `Unknown message type: ${message.type}`,
            },
          };
      }

      sendResponse(response);
    } catch (error) {
      console.error("MessageHandler: Error handling message:", error);

      const errorResponse: MessageResponse = {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };

      sendResponse(errorResponse);
    }
  }

  // =================== RPC Handlers ===================

  /**
   * Handle Ethereum RPC requests
   */
  private async handleEthRequest(
    data: { method: string; params?: any[] },
    context: RPCContext
  ): Promise<MessageResponse> {
    try {
      const result = await ClearWalletCore.rpc.execute(
        data.method,
        data.params || [],
        context
      );

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.code || "RPC_ERROR",
          message: error.message || "RPC request failed",
          data: error.data,
        },
      };
    }
  }

  // =================== Wallet Handlers ===================

  private async handleGetWallets(): Promise<MessageResponse> {
    try {
      const [wallets, selectedWallet] = await Promise.all([
        ClearWalletCore.wallets.getAllWallets(),
        ClearWalletCore.wallets.getSelectedWallet(),
      ]);

      return {
        success: true,
        data: {
          wallets,
          selectedWallet,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "WALLET_ERROR",
          message: error.message,
        },
      };
    }
  }

  private async handleCreateWallet(data: {
    name?: string;
    type: "generated";
  }): Promise<MessageResponse> {
    try {
      const wallet = await ClearWalletCore.wallets.createWallet(data);

      return {
        success: true,
        data: wallet,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "WALLET_CREATION_ERROR",
          message: error.message,
        },
      };
    }
  }

  private async handleImportWallet(data: {
    privateKey?: string;
    mnemonic?: string;
    name?: string;
  }): Promise<MessageResponse> {
    try {
      let wallet;

      if (data.privateKey) {
        wallet = await ClearWalletCore.wallets.importFromPrivateKey(
          data.privateKey,
          data.name
        );
      } else if (data.mnemonic) {
        wallet = await ClearWalletCore.wallets.importFromMnemonic(
          data.mnemonic,
          data.name
        );
      } else {
        throw new Error("Either privateKey or mnemonic is required");
      }

      return {
        success: true,
        data: wallet,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "WALLET_IMPORT_ERROR",
          message: error.message,
        },
      };
    }
  }

  private async handleSelectWallet(data: {
    walletId: string;
  }): Promise<MessageResponse> {
    try {
      await ClearWalletCore.wallets.selectWallet(data.walletId);

      return {
        success: true,
        data: { success: true },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "WALLET_SELECTION_ERROR",
          message: error.message,
        },
      };
    }
  }

  // =================== Network Handlers ===================

  private async handleGetNetworks(): Promise<MessageResponse> {
    try {
      const [allNetworks, selectedNetwork] = await Promise.all([
        ClearWalletCore.networks.getAllNetworks(),
        ClearWalletCore.networks.getSelectedNetwork(),
      ]);

      return {
        success: true,
        data: {
          networks: allNetworks,
          selectedNetwork,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error.message,
        },
      };
    }
  }

  private async handleSwitchNetwork(data: {
    chainId: number | string;
  }): Promise<MessageResponse> {
    try {
      await ClearWalletCore.networks.switchNetwork(data.chainId);

      return {
        success: true,
        data: { success: true },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "NETWORK_SWITCH_ERROR",
          message: error.message,
        },
      };
    }
  }

  private async handleAddNetwork(data: any): Promise<MessageResponse> {
    try {
      const network = await ClearWalletCore.networks.addCustomNetwork(data);

      return {
        success: true,
        data: network,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "NETWORK_ADD_ERROR",
          message: error.message,
        },
      };
    }
  }

  // =================== Connection Handlers ===================

  private async handleCheckConnection(
    data: { origin: string },
    context: RPCContext
  ): Promise<MessageResponse> {
    try {
      if (!data.origin) {
        return {
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "Origin is required",
          },
        };
      }

      // Check if site is connected
      const connectedSites =
        (await ClearWalletCore.storage.get("connectedSites")) || [];
      const connection = connectedSites.find(
        (site) => site.url === data.origin
      );

      if (connection) {
        // Site is connected, return connection info
        const selectedNetwork =
          await ClearWalletCore.networks.getSelectedNetwork();
        return {
          success: true,
          data: {
            connected: true,
            account: connection.account,
            chainId: selectedNetwork
              ? ClearWalletCore.networks.chainIdToHex(selectedNetwork.chainId)
              : "0x1",
          },
        };
      } else {
        // Site is not connected
        return {
          success: true,
          data: {
            connected: false,
          },
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "CONNECTION_CHECK_ERROR",
          message: error.message,
        },
      };
    }
  }

  private async handleGetConnectedSites(): Promise<MessageResponse> {
    try {
      const connectedSites =
        (await ClearWalletCore.storage.get("connectedSites")) || [];

      return {
        success: true,
        data: connectedSites,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "CONNECTION_ERROR",
          message: error.message,
        },
      };
    }
  }

  private async handleDisconnectSite(data: {
    origin: string;
  }): Promise<MessageResponse> {
    try {
      const connectedSites =
        (await ClearWalletCore.storage.get("connectedSites")) || [];
      const updatedSites = connectedSites.filter(
        (site) => site.url !== data.origin
      );
      await ClearWalletCore.storage.set("connectedSites", updatedSites);

      return {
        success: true,
        data: { success: true },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "DISCONNECT_ERROR",
          message: error.message,
        },
      };
    }
  }

  // =================== Settings Handlers ===================

  private async handleGetSettings(): Promise<MessageResponse> {
    try {
      const settings = await ClearWalletCore.storage.get("settings");

      return {
        success: true,
        data: settings,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "SETTINGS_ERROR",
          message: error.message,
        },
      };
    }
  }

  private async handleUpdateSettings(data: any): Promise<MessageResponse> {
    try {
      await ClearWalletCore.storage.set("settings", data);

      return {
        success: true,
        data: { success: true },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "SETTINGS_UPDATE_ERROR",
          message: error.message,
        },
      };
    }
  }

  // =================== Status Handlers ===================

  private async handleGetStatus(): Promise<MessageResponse> {
    try {
      const status = ClearWalletCore.getStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: "STATUS_ERROR",
          message: error.message,
        },
      };
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
  } {
    return {
      initialized: this.isInitialized,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    console.log("MessageHandler: Cleanup complete");
  }
}
