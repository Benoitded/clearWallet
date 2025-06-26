// Main background service using the core architecture
import { ClearWalletCore, NetworkChangeEvent, WalletEvent } from "../core";
import { DAppConnectionManager } from "./DAppConnectionManager";
import { NotificationManager } from "./NotificationManager";
import { MessageHandler } from "./MessageHandler";
import { MigrationService } from "./MigrationService";

export class BackgroundService {
  private static instance: BackgroundService;
  private dappManager: DAppConnectionManager;
  private notificationManager: NotificationManager;
  private messageHandler: MessageHandler;
  private migrationService: MigrationService;
  private isInitialized = false;

  private constructor() {
    this.dappManager = new DAppConnectionManager();
    this.notificationManager = new NotificationManager();
    this.messageHandler = new MessageHandler();
    this.migrationService = MigrationService.getInstance();
  }

  static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  /**
   * Initialize the background service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("BackgroundService: Already initialized");
      return;
    }

    try {
      console.log("BackgroundService: Initializing...");

      // Check if migration is needed before initializing core
      const needsMigration = await this.migrationService.isMigrationNeeded();
      if (needsMigration) {
        console.log(
          "BackgroundService: Legacy data detected, performing migration..."
        );
        await this.migrationService.createBackup();
        await this.migrationService.performMigration();
      }

      // Initialize core services
      await ClearWalletCore.initialize();

      // Initialize background-specific services
      await this.dappManager.initialize();
      await this.notificationManager.initialize();
      this.messageHandler.initialize();

      // Set up event listeners
      this.setupEventListeners();

      // Set up Chrome extension event listeners
      this.setupChromeListeners();

      this.isInitialized = true;
      console.log("BackgroundService: Initialization complete");
    } catch (error) {
      console.error("BackgroundService: Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Set up event listeners between core services
   */
  private setupEventListeners(): void {
    // Listen for network changes
    ClearWalletCore.networks.on(
      "networkChanged",
      (event: NetworkChangeEvent) => {
        this.handleNetworkChanged(event);
      }
    );

    // Listen for wallet changes
    ClearWalletCore.wallets.on("walletSelected", (event: WalletEvent) => {
      this.handleWalletChanged(event);
    });

    console.log("BackgroundService: Event listeners set up");
  }

  /**
   * Set up Chrome extension event listeners (public method for immediate setup)
   */
  setupListeners(): void {
    // Initialize message handler synchronously if not already done
    if (!this.messageHandler.getStatus().initialized) {
      this.messageHandler.initialize();
    }
    this.setupChromeListeners();
  }

  /**
   * Set up Chrome extension event listeners
   */
  private setupChromeListeners(): void {
    // Handle runtime messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle async message processing
      (async () => {
        try {
          await this.messageHandler.handleMessage(
            message,
            sender,
            sendResponse
          );
        } catch (error) {
          console.error("BackgroundService: Error in message handler:", error);
          sendResponse({
            success: false,
            error: {
              code: "BACKGROUND_ERROR",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      })();

      return true; // Keep message channel open for async responses
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log("BackgroundService: Extension startup detected");
    });

    // Handle extension install/update
    chrome.runtime.onInstalled.addListener((details) => {
      console.log(
        "BackgroundService: Extension installed/updated:",
        details.reason
      );
      this.handleExtensionInstalled(details);
    });

    // Handle tab updates (for dApp connections)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        this.dappManager.handleTabUpdated(tabId, tab.url);
      }
    });

    // Handle tab removal (cleanup connections)
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.dappManager.handleTabRemoved(tabId);
    });

    console.log("BackgroundService: Chrome listeners set up");
  }

  /**
   * Handle network change events
   */
  private async handleNetworkChanged(event: NetworkChangeEvent): Promise<void> {
    try {
      console.log("BackgroundService: Network changed:", event);

      // Notify all connected dApps
      await this.notificationManager.notifyAllDAppsChainChanged(event);

      // Update dApp connections with new chainId
      await this.dappManager.updateConnectionsForNetworkChange(event);
    } catch (error) {
      console.error("BackgroundService: Error handling network change:", error);
    }
  }

  /**
   * Handle wallet change events
   */
  private async handleWalletChanged(event: WalletEvent): Promise<void> {
    try {
      console.log("BackgroundService: Wallet changed:", event);

      // Notify connected dApps about account change
      await this.notificationManager.notifyAllDAppsAccountChanged(event);

      // Update dApp connections with new account
      await this.dappManager.updateConnectionsForWalletChange(event);
    } catch (error) {
      console.error("BackgroundService: Error handling wallet change:", error);
    }
  }

  /**
   * Handle extension installation/update
   */
  private async handleExtensionInstalled(
    details: chrome.runtime.InstalledDetails
  ): Promise<void> {
    try {
      if (details.reason === "install") {
        // First time installation
        console.log("BackgroundService: First time installation");
        await this.performFirstTimeSetup();
      } else if (details.reason === "update") {
        // Extension update
        console.log(
          "BackgroundService: Extension updated from",
          details.previousVersion
        );
        await this.performUpdateMigration(details.previousVersion);
      }
    } catch (error) {
      console.error(
        "BackgroundService: Error handling extension install/update:",
        error
      );
    }
  }

  /**
   * Perform first-time setup
   */
  private async performFirstTimeSetup(): Promise<void> {
    // Load default networks
    const defaultNetworks = await this.loadDefaultNetworks();
    await ClearWalletCore.storage.set("networks", defaultNetworks);

    console.log("BackgroundService: First-time setup complete");
  }

  /**
   * Perform update migration
   */
  private async performUpdateMigration(
    previousVersion?: string
  ): Promise<void> {
    // Handle version-specific migrations
    console.log("BackgroundService: Update migration complete");
  }

  /**
   * Load default networks configuration
   */
  private async loadDefaultNetworks() {
    // Import and return default networks
    // This would load from a configuration file
    return [
      {
        id: "ethereum-mainnet",
        name: "Ethereum",
        chainId: 1,
        blockExplorer: "https://etherscan.io",
        rpc: [{ name: "Ethereum RPC", url: "https://eth.llamarpc.com" }],
        isTestnet: false,
        image: "⟠",
      },
      {
        id: "base-mainnet",
        name: "Base",
        chainId: 8453,
        blockExplorer: "https://basescan.org",
        rpc: [{ name: "Base RPC", url: "https://mainnet.base.org" }],
        isTestnet: false,
        image: "🔵",
      },
    ];
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    core: object;
    dapps: object;
    notifications: object;
  } {
    return {
      initialized: this.isInitialized,
      core: ClearWalletCore.getStatus(),
      dapps: this.dappManager.getStatus(),
      notifications: this.notificationManager.getStatus(),
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log("BackgroundService: Shutting down...");

    // Clean up resources
    await this.dappManager.cleanup();
    await this.notificationManager.cleanup();

    this.isInitialized = false;
    console.log("BackgroundService: Shutdown complete");
  }
}
