// Core network management service
import { Network, RpcEndpoint } from "../../shared/types/networks";
import { StorageService } from "../storage/StorageService";

export interface NetworkChangeEvent {
  oldNetwork: Network | null;
  newNetwork: Network;
  chainId: number;
  chainIdHex: string;
}

export class NetworkManager {
  private static instance: NetworkManager;
  private storageService: StorageService;
  private listeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.storageService = StorageService.getInstance();
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  /**
   * Get all networks (built-in + custom)
   */
  async getAllNetworks(): Promise<Network[]> {
    const [networks, customNetworks] = await Promise.all([
      this.storageService.get("networks"),
      this.storageService.get("customNetworks"),
    ]);

    return [...(networks || []), ...(customNetworks || [])];
  }

  /**
   * Get built-in networks
   */
  async getBuiltInNetworks(): Promise<Network[]> {
    return (await this.storageService.get("networks")) || [];
  }

  /**
   * Get custom networks
   */
  async getCustomNetworks(): Promise<Network[]> {
    return (await this.storageService.get("customNetworks")) || [];
  }

  /**
   * Get currently selected network
   */
  async getSelectedNetwork(): Promise<Network | null> {
    return await this.storageService.get("selectedNetwork");
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(
    chainIdOrNetwork: number | string | Network
  ): Promise<NetworkChangeEvent> {
    try {
      const oldNetwork = await this.getSelectedNetwork();
      let targetNetwork: Network | null = null;

      // Handle different input types
      if (typeof chainIdOrNetwork === "object") {
        // Already a Network object
        targetNetwork = chainIdOrNetwork;
      } else {
        // Find by chainId
        const chainId =
          typeof chainIdOrNetwork === "string"
            ? this.parseChainId(chainIdOrNetwork)
            : chainIdOrNetwork;

        targetNetwork = await this.findNetworkByChainId(chainId);
      }

      if (!targetNetwork) {
        throw new Error(`Network not found`);
      }

      // Save the new network
      await this.storageService.set("selectedNetwork", targetNetwork);

      const event: NetworkChangeEvent = {
        oldNetwork,
        newNetwork: targetNetwork,
        chainId: targetNetwork.chainId,
        chainIdHex: this.chainIdToHex(targetNetwork.chainId),
      };

      // Emit network change event
      this.emit("networkChanged", event);

      console.log(
        `NetworkManager: Switched to ${targetNetwork.name} (${targetNetwork.chainId})`
      );
      return event;
    } catch (error) {
      console.error("NetworkManager: Error switching network:", error);
      throw error;
    }
  }

  /**
   * Add a custom network
   */
  async addCustomNetwork(networkParams: {
    chainId: string;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency?: {
      name: string;
      symbol: string;
      decimals: number;
    };
    blockExplorerUrls?: string[];
  }): Promise<Network> {
    try {
      const chainId = this.parseChainId(networkParams.chainId);

      // Check if network already exists
      const existingNetwork = await this.findNetworkByChainId(chainId);
      if (existingNetwork) {
        throw new Error(`Network with chainId ${chainId} already exists`);
      }

      // Create new network
      const newNetwork: Network = {
        id: `custom-${chainId}`,
        name: networkParams.chainName,
        chainId: chainId,
        blockExplorer: networkParams.blockExplorerUrls?.[0] || "",
        rpc: networkParams.rpcUrls.map((url, index) => ({
          name: index === 0 ? "Default" : `RPC ${index + 1}`,
          url,
        })),
        isTestnet: chainId !== 1 && chainId !== 8453, // Assume mainnet chains
        isCustom: true,
      };

      // Save to storage
      const customNetworks = await this.getCustomNetworks();
      await this.storageService.set("customNetworks", [
        ...customNetworks,
        newNetwork,
      ]);

      console.log(`NetworkManager: Added custom network ${newNetwork.name}`);
      return newNetwork;
    } catch (error) {
      console.error("NetworkManager: Error adding custom network:", error);
      throw error;
    }
  }

  /**
   * Remove a custom network
   */
  async removeCustomNetwork(chainId: number): Promise<void> {
    try {
      const customNetworks = await this.getCustomNetworks();
      const updatedNetworks = customNetworks.filter(
        (network) => network.chainId !== chainId
      );

      await this.storageService.set("customNetworks", updatedNetworks);

      // If the removed network was selected, switch to a default
      const selectedNetwork = await this.getSelectedNetwork();
      if (selectedNetwork && selectedNetwork.chainId === chainId) {
        const builtInNetworks = await this.getBuiltInNetworks();
        if (builtInNetworks.length > 0) {
          await this.switchNetwork(builtInNetworks[0]);
        }
      }

      console.log(
        `NetworkManager: Removed custom network with chainId ${chainId}`
      );
    } catch (error) {
      console.error("NetworkManager: Error removing custom network:", error);
      throw error;
    }
  }

  /**
   * Find network by chainId
   */
  async findNetworkByChainId(chainId: number): Promise<Network | null> {
    const allNetworks = await this.getAllNetworks();
    return allNetworks.find((network) => network.chainId === chainId) || null;
  }

  /**
   * Get or set selected RPC for a network
   */
  async getSelectedRpc(networkId: string): Promise<RpcEndpoint | null> {
    const selectedRpcs = (await this.storageService.get("selectedRpcs")) || {};
    const network = await this.findNetworkById(networkId);

    return selectedRpcs[networkId] || network?.rpc[0] || null;
  }

  async setSelectedRpc(networkId: string, rpc: RpcEndpoint): Promise<void> {
    const selectedRpcs = (await this.storageService.get("selectedRpcs")) || {};
    selectedRpcs[networkId] = rpc;
    await this.storageService.set("selectedRpcs", selectedRpcs);
  }

  /**
   * Utility: Parse chainId from string
   */
  parseChainId(chainId: string): number {
    const parsed = chainId.startsWith("0x")
      ? parseInt(chainId, 16)
      : parseInt(chainId, 10);

    if (isNaN(parsed)) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }

    return parsed;
  }

  /**
   * Utility: Format chainId to hex
   */
  chainIdToHex(chainId: number): string {
    return `0x${chainId.toString(16)}`;
  }

  /**
   * Check if chainId is a built-in network
   */
  async isBuiltInNetwork(chainId: number): Promise<boolean> {
    const builtInNetworks = await this.getBuiltInNetworks();
    return builtInNetworks.some((network) => network.chainId === chainId);
  }

  /**
   * Find network by ID
   */
  private async findNetworkById(id: string): Promise<Network | null> {
    const allNetworks = await this.getAllNetworks();
    return allNetworks.find((network) => network.id === id) || null;
  }

  /**
   * Event system
   */
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(
            `NetworkManager: Error in event listener for ${event}:`,
            error
          );
        }
      });
    }
  }
}
