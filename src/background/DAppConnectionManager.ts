// DApp connection management service
import {
  ClearWalletCore,
  NetworkChangeEvent,
  WalletEvent,
  ConnectedSite,
} from "../core";

export interface TabConnection {
  tabId: number;
  url: string;
  origin: string;
  connected: boolean;
  account?: string;
  chainId?: number;
  lastActivity: number;
}

export class DAppConnectionManager {
  private activeConnections = new Map<number, TabConnection>();
  private isInitialized = false;

  /**
   * Initialize the connection manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log("DAppConnectionManager: Initializing...");

      // Load existing connections from storage
      await this.loadConnections();

      // Clean up stale connections
      await this.cleanupStaleConnections();

      this.isInitialized = true;
      console.log("DAppConnectionManager: Initialized");
    } catch (error) {
      console.error("DAppConnectionManager: Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Handle tab updated event
   */
  async handleTabUpdated(tabId: number, url: string): Promise<void> {
    try {
      const origin = this.extractOrigin(url);
      if (!origin) return;

      // Check if this origin is connected
      const connectedSites =
        (await ClearWalletCore.storage.get("connectedSites")) || [];
      const connectedSite = connectedSites.find((site) => site.url === origin);

      if (connectedSite) {
        // Update or create active connection
        const connection: TabConnection = {
          tabId,
          url,
          origin,
          connected: true,
          account: connectedSite.account,
          chainId: connectedSite.chainId,
          lastActivity: Date.now(),
        };

        this.activeConnections.set(tabId, connection);
        console.log(
          `DAppConnectionManager: Tab ${tabId} connected to ${origin}`
        );

        // Notify the tab about current state
        await this.notifyTabState(tabId);
      }
    } catch (error) {
      console.error("DAppConnectionManager: Error handling tab update:", error);
    }
  }

  /**
   * Handle tab removed event
   */
  handleTabRemoved(tabId: number): void {
    if (this.activeConnections.has(tabId)) {
      const connection = this.activeConnections.get(tabId);
      console.log(
        `DAppConnectionManager: Tab ${tabId} removed (${connection?.origin})`
      );
      this.activeConnections.delete(tabId);
    }
  }

  /**
   * Update connections when network changes
   */
  async updateConnectionsForNetworkChange(
    event: NetworkChangeEvent
  ): Promise<void> {
    try {
      // Update all active connections with new chainId
      for (const [tabId, connection] of this.activeConnections) {
        if (connection.connected) {
          connection.chainId = event.chainId;
          connection.lastActivity = Date.now();
        }
      }

      // Update stored connections
      const connectedSites =
        (await ClearWalletCore.storage.get("connectedSites")) || [];
      const updatedSites = connectedSites.map((site) => ({
        ...site,
        chainId: event.chainId,
        lastUsed: Date.now(),
      }));
      await ClearWalletCore.storage.set("connectedSites", updatedSites);

      console.log(
        "DAppConnectionManager: Updated connections for network change"
      );
    } catch (error) {
      console.error(
        "DAppConnectionManager: Error updating connections for network change:",
        error
      );
    }
  }

  /**
   * Update connections when wallet changes
   */
  async updateConnectionsForWalletChange(event: WalletEvent): Promise<void> {
    try {
      if (event.type === "walletSelected" && event.wallet) {
        // Update all active connections with new account
        for (const [tabId, connection] of this.activeConnections) {
          if (connection.connected) {
            connection.account = event.wallet.address;
            connection.lastActivity = Date.now();
          }
        }

        // Update stored connections
        const connectedSites =
          (await ClearWalletCore.storage.get("connectedSites")) || [];
        const updatedSites = connectedSites.map((site) => ({
          ...site,
          account: event.wallet.address,
          lastUsed: Date.now(),
        }));
        await ClearWalletCore.storage.set("connectedSites", updatedSites);

        console.log(
          "DAppConnectionManager: Updated connections for wallet change"
        );
      }
    } catch (error) {
      console.error(
        "DAppConnectionManager: Error updating connections for wallet change:",
        error
      );
    }
  }

  /**
   * Get connection info for a tab
   */
  getConnectionInfo(tabId: number): TabConnection | null {
    return this.activeConnections.get(tabId) || null;
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): TabConnection[] {
    return Array.from(this.activeConnections.values());
  }

  /**
   * Disconnect a specific dApp
   */
  async disconnectDApp(origin: string): Promise<void> {
    try {
      // Remove from stored connections
      const connectedSites =
        (await ClearWalletCore.storage.get("connectedSites")) || [];
      const updatedSites = connectedSites.filter((site) => site.url !== origin);
      await ClearWalletCore.storage.set("connectedSites", updatedSites);

      // Remove from active connections
      for (const [tabId, connection] of this.activeConnections) {
        if (connection.origin === origin) {
          connection.connected = false;

          // Notify tab about disconnection
          this.notifyTabDisconnected(tabId);
        }
      }

      console.log(`DAppConnectionManager: Disconnected ${origin}`);
    } catch (error) {
      console.error("DAppConnectionManager: Error disconnecting dApp:", error);
      throw error;
    }
  }

  /**
   * Disconnect all dApps
   */
  async disconnectAllDApps(): Promise<void> {
    try {
      // Clear stored connections
      await ClearWalletCore.storage.set("connectedSites", []);

      // Notify all active tabs
      for (const [tabId, connection] of this.activeConnections) {
        if (connection.connected) {
          connection.connected = false;
          this.notifyTabDisconnected(tabId);
        }
      }

      console.log("DAppConnectionManager: Disconnected all dApps");
    } catch (error) {
      console.error(
        "DAppConnectionManager: Error disconnecting all dApps:",
        error
      );
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    activeConnections: number;
    connections: TabConnection[];
  } {
    return {
      initialized: this.isInitialized,
      activeConnections: this.activeConnections.size,
      connections: this.getActiveConnections(),
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.activeConnections.clear();
    this.isInitialized = false;
    console.log("DAppConnectionManager: Cleanup complete");
  }

  // =================== Private Methods ===================

  /**
   * Load existing connections from storage
   */
  private async loadConnections(): Promise<void> {
    try {
      // Get current tabs and check if any are connected
      const tabs = await chrome.tabs.query({});
      const connectedSites =
        (await ClearWalletCore.storage.get("connectedSites")) || [];

      for (const tab of tabs) {
        if (tab.id && tab.url) {
          const origin = this.extractOrigin(tab.url);
          if (origin) {
            const connectedSite = connectedSites.find(
              (site) => site.url === origin
            );
            if (connectedSite) {
              const connection: TabConnection = {
                tabId: tab.id,
                url: tab.url,
                origin,
                connected: true,
                account: connectedSite.account,
                chainId: connectedSite.chainId,
                lastActivity: connectedSite.lastUsed,
              };
              this.activeConnections.set(tab.id, connection);
            }
          }
        }
      }

      console.log(
        `DAppConnectionManager: Loaded ${this.activeConnections.size} connections`
      );
    } catch (error) {
      console.error("DAppConnectionManager: Error loading connections:", error);
    }
  }

  /**
   * Clean up stale connections
   */
  private async cleanupStaleConnections(): Promise<void> {
    try {
      const connectedSites =
        (await ClearWalletCore.storage.get("connectedSites")) || [];
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      // Remove connections older than a week
      const activeSites = connectedSites.filter(
        (site) => site.lastUsed > oneWeekAgo
      );

      if (activeSites.length !== connectedSites.length) {
        await ClearWalletCore.storage.set("connectedSites", activeSites);
        console.log(
          `DAppConnectionManager: Cleaned up ${
            connectedSites.length - activeSites.length
          } stale connections`
        );
      }
    } catch (error) {
      console.error(
        "DAppConnectionManager: Error cleaning up stale connections:",
        error
      );
    }
  }

  /**
   * Extract origin from URL
   */
  private extractOrigin(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.origin;
    } catch {
      return null;
    }
  }

  /**
   * Notify tab about current wallet state
   */
  private async notifyTabState(tabId: number): Promise<void> {
    try {
      const selectedWallet = await ClearWalletCore.wallets.getSelectedWallet();
      const selectedNetwork =
        await ClearWalletCore.networks.getSelectedNetwork();

      if (selectedWallet && selectedNetwork) {
        chrome.tabs
          .sendMessage(tabId, {
            type: "CLEARWALLET_CONNECTION_SUCCESS",
            data: {
              account: selectedWallet.address,
              chainId: ClearWalletCore.networks.chainIdToHex(
                selectedNetwork.chainId
              ),
            },
          })
          .catch(() => {
            // Tab might not have content script, ignore error
          });
      }
    } catch (error) {
      console.error("DAppConnectionManager: Error notifying tab state:", error);
    }
  }

  /**
   * Notify tab about disconnection
   */
  private notifyTabDisconnected(tabId: number): void {
    chrome.tabs
      .sendMessage(tabId, {
        type: "CLEARWALLET_WALLET_DISCONNECTED",
        data: { disconnected: true },
      })
      .catch(() => {
        // Tab might not have content script, ignore error
      });
  }
}
