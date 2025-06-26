// Main popup service orchestrating all popup functionality
import { WalletManager } from "../../core/wallet/WalletManager";
import { NetworkManager } from "../../core/networks/NetworkManager";
import { StorageService } from "../../core/storage/StorageService";

export interface PopupState {
  isLoading: boolean;
  currentView: string;
  wallets: any[];
  selectedWallet: any | null;
  networks: any[];
  selectedNetwork: any | null;
  connectedSites: string[];
  error: string | null;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class PopupService {
  private static instance: PopupService;
  private state: PopupState;
  private listeners = new Map<string, Function[]>();
  private isInitialized = false;

  private constructor() {
    this.state = {
      isLoading: true,
      currentView: "loading",
      wallets: [],
      selectedWallet: null,
      networks: [],
      selectedNetwork: null,
      connectedSites: [],
      error: null,
    };
  }

  static getInstance(): PopupService {
    if (!PopupService.instance) {
      PopupService.instance = new PopupService();
    }
    return PopupService.instance;
  }

  /**
   * Initialize popup service
   */
  async initialize(): Promise<void> {
    try {
      console.log("PopupService: Initializing...");

      this.setState({ isLoading: true, error: null });

      // Load initial data
      await this.loadInitialData();

      // Determine initial view
      const initialView = await this.determineInitialView();
      this.setState({ currentView: initialView, isLoading: false });

      this.isInitialized = true;
      this.emit("initialized", this.state);

      console.log("PopupService: Initialization complete");
    } catch (error) {
      console.error("PopupService: Initialization failed:", error);
      this.setState({
        isLoading: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      });
      throw error;
    }
  }

  /**
   * Load initial data from background
   */
  private async loadInitialData(): Promise<void> {
    try {
      console.log("PopupService: Loading initial data...");

      // Load wallets
      const walletsResponse = await this.sendMessage("GET_WALLETS");
      console.log("PopupService: Wallets response:", walletsResponse);

      let wallets = [];
      let selectedWallet = null;

      if (walletsResponse.success && walletsResponse.data) {
        wallets = walletsResponse.data.wallets || [];
        selectedWallet = walletsResponse.data.selectedWallet || null;
      }

      // Load networks
      const networksResponse = await this.sendMessage("GET_NETWORKS");
      console.log("PopupService: Networks response:", networksResponse);

      let networks = [];
      let selectedNetwork = null;

      if (networksResponse.success && networksResponse.data) {
        networks = networksResponse.data.networks || [];
        selectedNetwork = networksResponse.data.selectedNetwork || null;
      }

      // Load connected sites
      const connectedSitesResponse = await this.sendMessage(
        "GET_CONNECTED_SITES"
      );
      console.log(
        "PopupService: Connected sites response:",
        connectedSitesResponse
      );

      const connectedSites = connectedSitesResponse.success
        ? connectedSitesResponse.data || []
        : [];

      // Update state
      this.setState({
        wallets,
        networks,
        selectedWallet,
        selectedNetwork,
        connectedSites,
      });

      console.log("PopupService: State updated:", this.state);
    } catch (error) {
      console.error("PopupService: Failed to load initial data:", error);
      // Don't throw error, set default values instead
      this.setState({
        wallets: [],
        networks: [],
        selectedWallet: null,
        selectedNetwork: null,
        connectedSites: [],
      });
    }
  }

  /**
   * Determine which view to show initially
   */
  private async determineInitialView(): Promise<string> {
    try {
      // Check if there are any wallets in storage
      const storage = await chrome.storage.local.get();
      const walletKeys = Object.keys(storage).filter((key) =>
        key.startsWith("wallet_")
      );

      console.log("PopupService: Found wallet keys:", walletKeys);

      // No wallets in storage = show welcome screen
      if (walletKeys.length === 0) {
        console.log("PopupService: No wallets found, showing welcome");
        return "welcome";
      }

      // If wallets exist, try to restore the last saved view
      const lastView = storage.currentView || storage.appState?.currentView;

      if (lastView && lastView !== "loading") {
        console.log("PopupService: Restoring last view:", lastView);
        return lastView;
      }

      // Check if we have a selected wallet in app state
      const appState = storage.appState;
      if (!appState?.selectedWallet) {
        console.log("PopupService: No selected wallet, but wallets exist");
        // If we have wallets but no selected one, we should auto-select the first one
        // and go to dashboard
        return "dashboard";
      }

      console.log(
        "PopupService: Wallets exist and one is selected, showing dashboard"
      );
      return "dashboard";
    } catch (error) {
      console.error("PopupService: Error determining initial view:", error);
      return "welcome";
    }
  }

  /**
   * Send message to background script
   */
  private async sendMessage(
    type: string,
    data?: any
  ): Promise<MessageResponse> {
    return new Promise((resolve) => {
      try {
        // Check if extension context is valid
        if (!chrome.runtime?.id) {
          console.error("PopupService: Extension context invalidated");
          resolve({
            success: false,
            error:
              "Extension context invalidated. Please reload the extension.",
          });
          return;
        }

        chrome.runtime.sendMessage({ type, data }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "PopupService: Message error:",
              chrome.runtime.lastError.message || chrome.runtime.lastError
            );
            resolve({
              success: false,
              error: chrome.runtime.lastError.message,
            });
          } else {
            resolve(response || { success: false, error: "No response" });
          }
        });
      } catch (error) {
        console.error("PopupService: Error sending message:", error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  // =================== Wallet Management ===================

  /**
   * Create new wallet
   */
  async createWallet(name: string, password: string): Promise<MessageResponse> {
    try {
      this.setState({ isLoading: true, error: null });

      const response = await this.sendMessage("CREATE_WALLET", {
        name,
        password,
      });

      if (response.success && response.data) {
        // Add to local state
        const newWallets = [...this.state.wallets, response.data];
        this.setState({
          wallets: newWallets,
          selectedWallet: response.data,
          currentView: "dashboard",
          isLoading: false,
        });

        this.emit("walletCreated", response.data);
      } else {
        this.setState({ isLoading: false, error: response.error });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create wallet";
      this.setState({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Import wallet from private key
   */
  async importWalletFromPrivateKey(
    name: string,
    privateKey: string,
    password: string
  ): Promise<MessageResponse> {
    try {
      this.setState({ isLoading: true, error: null });

      const response = await this.sendMessage("IMPORT_WALLET_PRIVATE_KEY", {
        name,
        privateKey,
        password,
      });

      if (response.success && response.data) {
        const newWallets = [...this.state.wallets, response.data];
        this.setState({
          wallets: newWallets,
          selectedWallet: response.data,
          currentView: "dashboard",
          isLoading: false,
        });

        this.emit("walletImported", response.data);
      } else {
        this.setState({ isLoading: false, error: response.error });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to import wallet";
      this.setState({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Import wallet from mnemonic
   */
  async importWalletFromMnemonic(
    name: string,
    mnemonic: string,
    password: string
  ): Promise<MessageResponse> {
    try {
      this.setState({ isLoading: true, error: null });

      const response = await this.sendMessage("IMPORT_WALLET_MNEMONIC", {
        name,
        mnemonic,
        password,
      });

      if (response.success && response.data) {
        const newWallets = [...this.state.wallets, response.data];
        this.setState({
          wallets: newWallets,
          selectedWallet: response.data,
          currentView: "dashboard",
          isLoading: false,
        });

        this.emit("walletImported", response.data);
      } else {
        this.setState({ isLoading: false, error: response.error });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to import wallet";
      this.setState({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Select wallet
   */
  async selectWallet(walletId: string): Promise<MessageResponse> {
    try {
      this.setState({ isLoading: true, error: null });

      const response = await this.sendMessage("SELECT_WALLET", { walletId });

      if (response.success) {
        const selectedWallet = this.state.wallets.find(
          (w) => w.id === walletId
        );
        this.setState({
          selectedWallet,
          currentView: "dashboard",
          isLoading: false,
        });

        this.emit("walletSelected", selectedWallet);
      } else {
        this.setState({ isLoading: false, error: response.error });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to select wallet";
      this.setState({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Remove wallet
   */
  async removeWallet(walletId: string): Promise<MessageResponse> {
    try {
      this.setState({ isLoading: true, error: null });

      const response = await this.sendMessage("REMOVE_WALLET", { walletId });

      if (response.success) {
        const newWallets = this.state.wallets.filter((w) => w.id !== walletId);
        const newSelectedWallet =
          this.state.selectedWallet?.id === walletId
            ? newWallets[0] || null
            : this.state.selectedWallet;

        this.setState({
          wallets: newWallets,
          selectedWallet: newSelectedWallet,
          currentView: newWallets.length === 0 ? "welcome" : "dashboard",
          isLoading: false,
        });

        this.emit("walletRemoved", walletId);
      } else {
        this.setState({ isLoading: false, error: response.error });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to remove wallet";
      this.setState({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  // =================== Network Management ===================

  /**
   * Switch network
   */
  async switchNetwork(networkId: string): Promise<MessageResponse> {
    try {
      this.setState({ isLoading: true, error: null });

      const response = await this.sendMessage("SWITCH_NETWORK", { networkId });

      if (response.success) {
        const selectedNetwork = this.state.networks.find(
          (n) => n.id === networkId
        );
        this.setState({
          selectedNetwork,
          isLoading: false,
        });

        this.emit("networkSwitched", selectedNetwork);
      } else {
        this.setState({ isLoading: false, error: response.error });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to switch network";
      this.setState({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Add custom network
   */
  async addNetwork(networkConfig: any): Promise<MessageResponse> {
    try {
      this.setState({ isLoading: true, error: null });

      const response = await this.sendMessage("ADD_NETWORK", networkConfig);

      if (response.success && response.data) {
        const newNetworks = [...this.state.networks, response.data];
        this.setState({
          networks: newNetworks,
          isLoading: false,
        });

        this.emit("networkAdded", response.data);
      } else {
        this.setState({ isLoading: false, error: response.error });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add network";
      this.setState({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  // =================== DApp Connection Management ===================

  /**
   * Disconnect from dApp
   */
  async disconnectDApp(origin: string): Promise<MessageResponse> {
    try {
      const response = await this.sendMessage("DISCONNECT_DAPP", { origin });

      if (response.success) {
        const newConnectedSites = this.state.connectedSites.filter(
          (site) => site !== origin
        );
        this.setState({ connectedSites: newConnectedSites });

        this.emit("dappDisconnected", origin);
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to disconnect dApp";
      return { success: false, error: errorMessage };
    }
  }

  // =================== View Management ===================

  /**
   * Navigate to view
   */
  navigateToView(view: string): void {
    console.log(`PopupService: Navigating to view: ${view}`);
    console.log(`PopupService: Current state before navigation:`, this.state);

    this.setState({ currentView: view });
    this.emit("viewChanged", view);

    // Save current view to storage for persistence
    chrome.storage.local
      .set({
        currentView: view,
        appState: {
          ...this.state,
          currentView: view,
        },
      })
      .catch((error) => {
        console.error("PopupService: Failed to save current view:", error);
      });

    console.log(`PopupService: State after navigation:`, this.state);
  }

  /**
   * Go back to previous view
   */
  goBack(): void {
    // Simple back logic - could be enhanced with history stack
    if (
      this.state.currentView === "create-wallet" ||
      this.state.currentView === "import-wallet"
    ) {
      this.navigateToView("welcome");
    } else if (
      this.state.currentView !== "dashboard" &&
      this.state.wallets.length > 0
    ) {
      this.navigateToView("dashboard");
    }
  }

  // =================== State Management ===================

  /**
   * Get current state
   */
  getState(): PopupState {
    return { ...this.state };
  }

  /**
   * Update state
   */
  private setState(updates: Partial<PopupState>): void {
    this.state = { ...this.state, ...updates };
    this.emit("stateChanged", this.state);
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.setState({ error: null });
  }

  /**
   * Set loading state
   */
  setLoading(isLoading: boolean): void {
    this.setState({ isLoading });
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized;
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
            `PopupService: Error in event listener for ${event}:`,
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
    this.isInitialized = false;
    console.log("PopupService: Cleanup complete");
  }
}
