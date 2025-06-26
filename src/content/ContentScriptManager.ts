// Centralized content script management
export interface InjectionScript {
  name: string;
  src: string;
  type: "module" | "text/javascript";
  priority: number;
  cleanup?: boolean;
}

export interface ContentMessage {
  type: string;
  data?: any;
  id?: string;
}

export class ContentScriptManager {
  private static instance: ContentScriptManager;
  private injectedScripts = new Set<string>();
  private messageQueue: ContentMessage[] = [];
  private isReady = false;
  private listeners = new Map<string, Function[]>();

  private constructor() {
    this.setupMessageHandling();
  }

  static getInstance(): ContentScriptManager {
    if (!ContentScriptManager.instance) {
      ContentScriptManager.instance = new ContentScriptManager();
    }
    return ContentScriptManager.instance;
  }

  /**
   * Initialize the content script manager
   */
  async initialize(): Promise<void> {
    try {
      console.log("ContentScriptManager: Initializing...");

      // Inject scripts in the correct order
      await this.injectScriptSequence();

      // Set up background communication
      this.setupBackgroundCommunication();

      // Mark as ready and process queued messages
      this.isReady = true;
      this.processMessageQueue();

      console.log("ContentScriptManager: Initialization complete");
    } catch (error) {
      console.error("ContentScriptManager: Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Inject scripts in the correct sequence
   */
  private async injectScriptSequence(): Promise<void> {
    const scripts: InjectionScript[] = [
      {
        name: "priority",
        src: "priority.js",
        type: "text/javascript",
        priority: 1,
        cleanup: true,
      },
      {
        name: "inpage",
        src: "inpage.js",
        type: "text/javascript",
        priority: 2,
        cleanup: true,
      },
      {
        name: "aggressive",
        src: "inject-aggressive.js",
        type: "text/javascript",
        priority: 3,
        cleanup: true,
      },
    ];

    // Sort by priority
    scripts.sort((a, b) => a.priority - b.priority);

    // Inject each script
    for (const script of scripts) {
      await this.injectScript(script);

      // Add delay between injections for proper order
      if (script.priority < 3) {
        await this.delay(50);
      }
    }
  }

  /**
   * Inject a single script
   */
  private async injectScript(scriptConfig: InjectionScript): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.injectedScripts.has(scriptConfig.name)) {
          console.log(
            `ContentScriptManager: ${scriptConfig.name} already injected`
          );
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(scriptConfig.src);
        script.type = scriptConfig.type;

        script.onload = () => {
          if (scriptConfig.cleanup) {
            script.remove();
          }
          this.injectedScripts.add(scriptConfig.name);
          console.log(
            `ContentScriptManager: ${scriptConfig.name} injected successfully`
          );
          resolve();
        };

        script.onerror = () => {
          console.error(
            `ContentScriptManager: Failed to inject ${scriptConfig.name}`
          );
          reject(new Error(`Failed to inject ${scriptConfig.name}`));
        };

        // Inject at the appropriate location
        const target =
          scriptConfig.priority === 1
            ? document.head || document.documentElement
            : document.head || document.documentElement;

        if (scriptConfig.priority === 1) {
          target.prepend(script);
        } else {
          target.appendChild(script);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set up message handling between page and content script
   */
  private setupMessageHandling(): void {
    window.addEventListener("message", (event) => {
      // Only accept messages from the page
      if (event.source !== window) return;

      const { type, data, id } = event.data;

      // Handle different message types
      this.handlePageMessage({ type, data, id });
    });
  }

  /**
   * Handle messages from the page (injected scripts)
   */
  private handlePageMessage(message: ContentMessage): void {
    const { type, data, id } = message;

    // Filter out notification messages that shouldn't be forwarded
    const notificationTypes = [
      "CLEARWALLET_CHAIN_CHANGED",
      "CLEARWALLET_ACCOUNT_CHANGED",
      "CLEARWALLET_CONNECTION_SUCCESS",
      "CLEARWALLET_WALLET_DISCONNECTED",
      "CLEARWALLET_CONTENT_SCRIPT_READY",
    ];

    // Only forward requests to background, not responses or notifications
    if (
      type &&
      type.startsWith("CLEARWALLET_") &&
      !type.includes("_RESPONSE") &&
      !notificationTypes.includes(type)
    ) {
      this.forwardToBackground(message);
    }

    // Emit to local listeners
    this.emit(type, { type, data, id });
  }

  /**
   * Forward message to background script
   */
  private async forwardToBackground(message: ContentMessage): Promise<void> {
    try {
      console.log(
        "ContentScriptManager: Forwarding to background:",
        message.type
      );

      // Convert CLEARWALLET_ prefix to background format
      const backgroundType = message.type.replace("CLEARWALLET_", "");

      const response = await chrome.runtime.sendMessage({
        type: backgroundType,
        data: message.data,
      });

      // Send response back to page
      this.sendToPage({
        type: `${message.type}_RESPONSE`,
        data: response,
        id: message.id,
      });
    } catch (error) {
      console.error("ContentScriptManager: Error forwarding message:", error);

      // Send error response back to page
      this.sendToPage({
        type: `${message.type}_RESPONSE`,
        data: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        id: message.id,
      });
    }
  }

  /**
   * Send message to page
   */
  private sendToPage(message: ContentMessage): void {
    window.postMessage(message, "*");
  }

  /**
   * Set up communication with background script
   */
  private setupBackgroundCommunication(): void {
    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("ContentScriptManager: Message from background:", message);

      // Format message for page
      const forwardedMessage = {
        ...message,
        type: message.type.startsWith("CLEARWALLET_")
          ? message.type
          : `CLEARWALLET_${message.type}`,
      };

      // Forward to page
      this.sendToPage(forwardedMessage);

      return true; // Keep message channel open
    });
  }

  /**
   * Queue message for processing when ready
   */
  private queueMessage(message: ContentMessage): void {
    this.messageQueue.push(message);
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.handlePageMessage(message);
      }
    }
  }

  /**
   * Check if provider is properly injected
   */
  async checkProviderInjection(): Promise<boolean> {
    return new Promise((resolve) => {
      // Check if window.ethereum exists and is ClearWallet
      const checkProvider = () => {
        const ethereum = (window as any).ethereum;
        return ethereum && ethereum.isClearWallet === true;
      };

      if (checkProvider()) {
        resolve(true);
        return;
      }

      // Wait a bit and check again
      setTimeout(() => {
        resolve(checkProvider());
      }, 100);
    });
  }

  /**
   * Perform backup injection if needed
   */
  async performBackupInjection(): Promise<void> {
    console.log("ContentScriptManager: Performing backup injection...");

    // Re-inject main provider
    await this.injectScript({
      name: "inpage-backup",
      src: "inpage.js",
      type: "text/javascript",
      priority: 2,
      cleanup: true,
    });

    // Re-inject aggressive takeover
    await this.delay(100);
    await this.injectScript({
      name: "aggressive-backup",
      src: "inject-aggressive.js",
      type: "text/javascript",
      priority: 3,
      cleanup: true,
    });
  }

  /**
   * Get injection status
   */
  getStatus(): {
    ready: boolean;
    injectedScripts: string[];
    queueLength: number;
    providerDetected: boolean;
  } {
    return {
      ready: this.isReady,
      injectedScripts: Array.from(this.injectedScripts),
      queueLength: this.messageQueue.length,
      providerDetected: !!(window as any).ethereum?.isClearWallet,
    };
  }

  // =================== Event System ===================

  /**
   * Subscribe to events
   */
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(
            `ContentScriptManager: Error in event listener for ${event}:`,
            error
          );
        }
      });
    }
  }

  // =================== Utility Methods ===================

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.listeners.clear();
    this.messageQueue = [];
    this.isReady = false;
    console.log("ContentScriptManager: Cleanup complete");
  }
}
