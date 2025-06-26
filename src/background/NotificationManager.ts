// Notification management service for dApps
import { ClearWalletCore, NetworkChangeEvent, WalletEvent } from "../core";

export interface NotificationEvent {
  type: "chainChanged" | "accountsChanged" | "connect" | "disconnect";
  data: any;
  timestamp: number;
}

export class NotificationManager {
  private isInitialized = false;
  private notificationQueue: NotificationEvent[] = [];
  private processingQueue = false;

  /**
   * Initialize the notification manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log("NotificationManager: Initializing...");

      // Start processing notifications
      this.startNotificationProcessor();

      this.isInitialized = true;
      console.log("NotificationManager: Initialized");
    } catch (error) {
      console.error("NotificationManager: Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Notify all connected dApps about chain change
   */
  async notifyAllDAppsChainChanged(event: NetworkChangeEvent): Promise<void> {
    try {
      console.log(
        "NotificationManager: Notifying dApps of chain change:",
        event
      );

      const notification: NotificationEvent = {
        type: "chainChanged",
        data: {
          chainId: event.chainIdHex,
          networkVersion: event.chainId.toString(),
        },
        timestamp: Date.now(),
      };

      await this.broadcastToAllTabs(notification);
    } catch (error) {
      console.error(
        "NotificationManager: Error notifying chain change:",
        error
      );
    }
  }

  /**
   * Notify all connected dApps about account change
   */
  async notifyAllDAppsAccountChanged(event: WalletEvent): Promise<void> {
    try {
      console.log(
        "NotificationManager: Notifying dApps of account change:",
        event
      );

      const notification: NotificationEvent = {
        type: "accountsChanged",
        data: {
          accounts: event.wallet ? [event.wallet.address] : [],
        },
        timestamp: Date.now(),
      };

      await this.broadcastToAllTabs(notification);
    } catch (error) {
      console.error(
        "NotificationManager: Error notifying account change:",
        error
      );
    }
  }

  /**
   * Notify dApp about successful connection
   */
  async notifyDAppConnected(
    tabId: number,
    account: string,
    chainId: string
  ): Promise<void> {
    try {
      const notification: NotificationEvent = {
        type: "connect",
        data: {
          accounts: [account],
          chainId: chainId,
        },
        timestamp: Date.now(),
      };

      await this.sendToTab(tabId, notification);
    } catch (error) {
      console.error("NotificationManager: Error notifying connection:", error);
    }
  }

  /**
   * Notify dApp about disconnection
   */
  async notifyDAppDisconnected(tabId: number): Promise<void> {
    try {
      const notification: NotificationEvent = {
        type: "disconnect",
        data: {
          accounts: [],
        },
        timestamp: Date.now(),
      };

      await this.sendToTab(tabId, notification);
    } catch (error) {
      console.error(
        "NotificationManager: Error notifying disconnection:",
        error
      );
    }
  }

  /**
   * Queue a notification for processing
   */
  queueNotification(notification: NotificationEvent): void {
    this.notificationQueue.push(notification);
    this.processNotificationQueue();
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    queueLength: number;
    processing: boolean;
  } {
    return {
      initialized: this.isInitialized,
      queueLength: this.notificationQueue.length,
      processing: this.processingQueue,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.notificationQueue = [];
    this.processingQueue = false;
    this.isInitialized = false;
    console.log("NotificationManager: Cleanup complete");
  }

  // =================== Private Methods ===================

  /**
   * Broadcast notification to all connected tabs
   */
  private async broadcastToAllTabs(
    notification: NotificationEvent
  ): Promise<void> {
    try {
      // Get all connected sites
      const connectedSites =
        (await ClearWalletCore.storage.get("connectedSites")) || [];

      if (connectedSites.length === 0) {
        console.log("NotificationManager: No connected sites to notify");
        return;
      }

      // Get all tabs
      const tabs = await chrome.tabs.query({});
      const connectedOrigins = new Set(connectedSites.map((site) => site.url));

      // Send notification to relevant tabs
      const notificationPromises = tabs
        .filter((tab) => {
          if (!tab.id || !tab.url) return false;
          const origin = this.extractOrigin(tab.url);
          return origin && connectedOrigins.has(origin);
        })
        .map((tab) => this.sendToTab(tab.id!, notification));

      await Promise.allSettled(notificationPromises);

      console.log(
        `NotificationManager: Broadcasted ${notification.type} to ${notificationPromises.length} tabs`
      );
    } catch (error) {
      console.error("NotificationManager: Error broadcasting to tabs:", error);
    }
  }

  /**
   * Send notification to a specific tab
   */
  private async sendToTab(
    tabId: number,
    notification: NotificationEvent
  ): Promise<void> {
    try {
      const message = this.formatNotificationMessage(notification);

      await chrome.tabs.sendMessage(tabId, message);

      console.log(
        `NotificationManager: Sent ${notification.type} to tab ${tabId}`
      );
    } catch (error) {
      // Tab might not have content script or might be closed
      console.warn(
        `NotificationManager: Failed to send to tab ${tabId}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Format notification for content script
   */
  private formatNotificationMessage(notification: NotificationEvent): any {
    switch (notification.type) {
      case "chainChanged":
        return {
          type: "CLEARWALLET_CHAIN_CHANGED",
          data: notification.data,
        };

      case "accountsChanged":
        return {
          type: "CLEARWALLET_ACCOUNT_CHANGED",
          data: notification.data,
        };

      case "connect":
        return {
          type: "CLEARWALLET_CONNECTION_SUCCESS",
          data: notification.data,
        };

      case "disconnect":
        return {
          type: "CLEARWALLET_WALLET_DISCONNECTED",
          data: notification.data,
        };

      default:
        return {
          type: "CLEARWALLET_NOTIFICATION",
          data: notification.data,
        };
    }
  }

  /**
   * Start the notification processor
   */
  private startNotificationProcessor(): void {
    // Process notifications every 100ms
    setInterval(() => {
      this.processNotificationQueue();
    }, 100);
  }

  /**
   * Process the notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    if (this.processingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift();
        if (notification) {
          await this.processNotification(notification);
        }
      }
    } catch (error) {
      console.error("NotificationManager: Error processing queue:", error);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Process a single notification
   */
  private async processNotification(
    notification: NotificationEvent
  ): Promise<void> {
    try {
      switch (notification.type) {
        case "chainChanged":
        case "accountsChanged":
          await this.broadcastToAllTabs(notification);
          break;

        default:
          console.warn(
            "NotificationManager: Unknown notification type:",
            notification.type
          );
      }
    } catch (error) {
      console.error(
        "NotificationManager: Error processing notification:",
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
   * Debounce function to prevent spam
   */
  private debounce(func: Function, wait: number): Function {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}
