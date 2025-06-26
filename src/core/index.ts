// Core module exports
// Single entry point for all core services

// Storage layer
export { StorageService } from "./storage/StorageService";
export type {
  StorageSchema,
  ConnectedSite,
  WalletSettings,
} from "./storage/StorageService";

// Network layer
export { NetworkManager } from "./networks/NetworkManager";
export type { NetworkChangeEvent } from "./networks/NetworkManager";

// Wallet layer
export { WalletManager } from "./wallet/WalletManager";
export type { CreateWalletOptions, WalletEvent } from "./wallet/WalletManager";

// RPC layer
export { RPCMethodRegistry, RPC_ERROR_CODES } from "./rpc/RPCMethodRegistry";
export type {
  RPCContext,
  RPCMethodHandler,
  RPCError,
} from "./rpc/RPCMethodRegistry";

// Import for internal use
import { StorageService } from "./storage/StorageService";
import { NetworkManager, NetworkChangeEvent } from "./networks/NetworkManager";
import { WalletManager, WalletEvent } from "./wallet/WalletManager";
import { RPCMethodRegistry } from "./rpc/RPCMethodRegistry";

// Core service facade for easy access
export class ClearWalletCore {
  static readonly storage = StorageService.getInstance();
  static readonly networks = NetworkManager.getInstance();
  static readonly wallets = WalletManager.getInstance();
  static readonly rpc = RPCMethodRegistry.getInstance();

  /**
   * Initialize all core services
   */
  static async initialize(): Promise<void> {
    console.log("ClearWalletCore: Initializing core services...");

    try {
      // Initialize storage first
      await this.storage.initialize();

      // Set up event listeners between services
      this.setupEventListeners();

      console.log("ClearWalletCore: Core services initialized successfully");
    } catch (error) {
      console.error(
        "ClearWalletCore: Failed to initialize core services:",
        error
      );
      throw error;
    }
  }

  /**
   * Set up cross-service event listeners
   */
  private static setupEventListeners(): void {
    // When network changes, notify all connected dApps
    this.networks.on("networkChanged", (event: NetworkChangeEvent) => {
      // This will be handled by the background script
      console.log("ClearWalletCore: Network changed event:", event);
    });

    // When wallet changes, update selected wallet
    this.wallets.on("walletSelected", (event: WalletEvent) => {
      console.log("ClearWalletCore: Wallet selected event:", event);
    });
  }

  /**
   * Get service status
   */
  static getStatus(): {
    storage: object;
    networks: boolean;
    wallets: boolean;
    rpc: string[];
  } {
    return {
      storage: this.storage.getCacheInfo(),
      networks: true,
      wallets: true,
      rpc: this.rpc.getRegisteredMethods(),
    };
  }
}
