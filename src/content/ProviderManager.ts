// Provider management for ClearWallet Ethereum integration
export interface EthereumProvider {
  isMetaMask?: boolean;
  isClearWallet?: boolean;
  chainId?: string;
  selectedAddress?: string | null;
  networkVersion?: string;

  // Core methods
  request(args: { method: string; params?: any[] }): Promise<any>;

  // Event methods
  on(event: string, handler: Function): void;
  removeListener(event: string, handler: Function): void;

  // Legacy methods
  enable?(): Promise<string[]>;
  send?(method: string, params?: any[]): Promise<any>;
  sendAsync?(payload: any, callback: Function): void;
}

export interface ProviderState {
  chainId: string;
  accounts: string[];
  networkId: string;
  isConnected: boolean;
  isUnlocked: boolean;
}

export class ProviderManager {
  private static instance: ProviderManager;
  private provider: EthereumProvider | null = null;
  private state: ProviderState | null = null;
  private listeners = new Map<string, Function[]>();
  private pendingRequests = new Map<string, Promise<any>>();

  private constructor() {
    this.setupProviderDetection();
  }

  static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  /**
   * Initialize provider management
   */
  async initialize(): Promise<void> {
    try {
      console.log("ProviderManager: Initializing...");

      // Detect existing provider
      await this.detectProvider();

      // Set up provider monitoring
      this.setupProviderMonitoring();

      // Initialize state if provider exists
      if (this.provider) {
        await this.initializeProviderState();
      }

      console.log("ProviderManager: Initialization complete");
    } catch (error) {
      console.error("ProviderManager: Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Detect ClearWallet provider
   */
  private async detectProvider(): Promise<void> {
    return new Promise((resolve) => {
      const checkProvider = () => {
        const ethereum = (window as any).ethereum;

        if (ethereum && ethereum.isClearWallet) {
          this.provider = ethereum;
          console.log("ProviderManager: ClearWallet provider detected");
          resolve();
          return true;
        }
        return false;
      };

      // Check immediately
      if (checkProvider()) return;

      // Set up detection loop
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds total

      const detectInterval = setInterval(() => {
        attempts++;

        if (checkProvider() || attempts >= maxAttempts) {
          clearInterval(detectInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Set up provider detection monitoring
   */
  private setupProviderDetection(): void {
    // Monitor for window.ethereum changes
    let lastEthereum = (window as any).ethereum;

    setInterval(() => {
      const currentEthereum = (window as any).ethereum;

      if (currentEthereum !== lastEthereum) {
        lastEthereum = currentEthereum;

        if (currentEthereum && currentEthereum.isClearWallet) {
          this.provider = currentEthereum;
          this.emit("providerDetected", currentEthereum);
        }
      }
    }, 1000);
  }

  /**
   * Set up provider event monitoring
   */
  private setupProviderMonitoring(): void {
    if (!this.provider) return;

    // Monitor standard events
    const events = ["chainChanged", "accountsChanged", "connect", "disconnect"];

    events.forEach((event) => {
      this.provider!.on(event, (data: any) => {
        console.log(`ProviderManager: ${event} event:`, data);
        this.handleProviderEvent(event, data);
      });
    });
  }

  /**
   * Handle provider events
   */
  private handleProviderEvent(event: string, data: any): void {
    switch (event) {
      case "chainChanged":
        if (this.state) {
          this.state.chainId = data;
          this.state.networkId = parseInt(data, 16).toString();
        }
        break;

      case "accountsChanged":
        if (this.state) {
          this.state.accounts = data;
          this.state.isConnected = data.length > 0;
        }
        break;

      case "connect":
        if (this.state) {
          this.state.isConnected = true;
          this.state.chainId = data.chainId;
          this.state.networkId = parseInt(data.chainId, 16).toString();
        }
        break;

      case "disconnect":
        if (this.state) {
          this.state.isConnected = false;
          this.state.accounts = [];
        }
        break;
    }

    // Emit to local listeners
    this.emit(event, data);
  }

  /**
   * Initialize provider state
   */
  private async initializeProviderState(): Promise<void> {
    if (!this.provider) return;

    try {
      // Get current chain ID
      const chainId = await this.provider.request({ method: "eth_chainId" });

      // Get accounts
      const accounts = await this.provider.request({ method: "eth_accounts" });

      // Create initial state
      this.state = {
        chainId: chainId,
        accounts: accounts || [],
        networkId: parseInt(chainId, 16).toString(),
        isConnected: accounts && accounts.length > 0,
        isUnlocked: accounts && accounts.length > 0,
      };

      console.log("ProviderManager: Initial state:", this.state);
    } catch (error) {
      console.error("ProviderManager: Failed to initialize state:", error);
    }
  }

  /**
   * Request connection to wallet
   */
  async requestConnection(): Promise<string[]> {
    if (!this.provider) {
      throw new Error("Provider not available");
    }

    try {
      // Use eth_requestAccounts for connection
      const accounts = await this.provider.request({
        method: "eth_requestAccounts",
      });

      // Update state
      if (this.state) {
        this.state.accounts = accounts;
        this.state.isConnected = true;
        this.state.isUnlocked = true;
      }

      return accounts;
    } catch (error) {
      console.error("ProviderManager: Connection request failed:", error);
      throw error;
    }
  }

  /**
   * Switch network
   */
  async switchNetwork(chainId: string): Promise<void> {
    if (!this.provider) {
      throw new Error("Provider not available");
    }

    try {
      await this.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    } catch (error) {
      console.error("ProviderManager: Network switch failed:", error);
      throw error;
    }
  }

  /**
   * Add network
   */
  async addNetwork(networkConfig: {
    chainId: string;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    blockExplorerUrls?: string[];
  }): Promise<void> {
    if (!this.provider) {
      throw new Error("Provider not available");
    }

    try {
      await this.provider.request({
        method: "wallet_addEthereumChain",
        params: [networkConfig],
      });
    } catch (error) {
      console.error("ProviderManager: Add network failed:", error);
      throw error;
    }
  }

  /**
   * Make provider request with deduplication
   */
  async request(method: string, params?: any[]): Promise<any> {
    if (!this.provider) {
      throw new Error("Provider not available");
    }

    // Create request key for deduplication
    const requestKey = `${method}:${JSON.stringify(params || [])}`;

    // Check if request is already pending
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey);
    }

    // Create new request
    const requestPromise = this.provider.request({ method, params });

    // Store pending request
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Get current provider state
   */
  getState(): ProviderState | null {
    return this.state ? { ...this.state } : null;
  }

  /**
   * Get provider instance
   */
  getProvider(): EthereumProvider | null {
    return this.provider;
  }

  /**
   * Check if provider is available
   */
  isProviderAvailable(): boolean {
    return this.provider !== null;
  }

  /**
   * Check if connected to wallet
   */
  isConnected(): boolean {
    return this.state?.isConnected || false;
  }

  /**
   * Get current accounts
   */
  getAccounts(): string[] {
    return this.state?.accounts || [];
  }

  /**
   * Get current chain ID
   */
  getChainId(): string | null {
    return this.state?.chainId || null;
  }

  /**
   * Validate provider integration
   */
  async validateIntegration(): Promise<{
    isValid: boolean;
    issues: string[];
    capabilities: string[];
  }> {
    const issues: string[] = [];
    const capabilities: string[] = [];

    // Check provider availability
    if (!this.provider) {
      issues.push("Provider not detected");
      return { isValid: false, issues, capabilities };
    }

    // Check ClearWallet identification
    if (!this.provider.isClearWallet) {
      issues.push("Provider is not identified as ClearWallet");
    } else {
      capabilities.push("ClearWallet identification");
    }

    // Test core methods
    const coreMethods = ["eth_chainId", "eth_accounts", "eth_requestAccounts"];

    for (const method of coreMethods) {
      try {
        await this.provider.request({ method });
        capabilities.push(`Method: ${method}`);
      } catch (error) {
        issues.push(`Method ${method} failed: ${error}`);
      }
    }

    // Test event system
    try {
      this.provider.on("test", () => {});
      this.provider.removeListener("test", () => {});
      capabilities.push("Event system");
    } catch (error) {
      issues.push(`Event system failed: ${error}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      capabilities,
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
            `ProviderManager: Error in event listener for ${event}:`,
            error
          );
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.listeners.clear();
    this.pendingRequests.clear();
    this.provider = null;
    this.state = null;
    console.log("ProviderManager: Cleanup complete");
  }
}
