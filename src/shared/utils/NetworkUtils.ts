// Network utility functions
import { Network, RpcEndpoint } from "../types/networks";

export class NetworkUtils {
  /**
   * Parse chainId from various formats (hex, decimal string, number)
   */
  static parseChainId(chainId: string | number): number {
    if (typeof chainId === "number") {
      return chainId;
    }

    const parsed = chainId.toString().startsWith("0x")
      ? parseInt(chainId, 16)
      : parseInt(chainId, 10);

    if (isNaN(parsed) || parsed <= 0) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }

    return parsed;
  }

  /**
   * Format chainId to hex string
   */
  static chainIdToHex(chainId: number): string {
    return `0x${chainId.toString(16)}`;
  }

  /**
   * Check if chainId is a mainnet
   */
  static isMainnet(chainId: number): boolean {
    // Common mainnet chain IDs
    const mainnets = [1, 56, 137, 250, 43114, 8453, 42161, 10];
    return mainnets.includes(chainId);
  }

  /**
   * Check if chainId is a testnet
   */
  static isTestnet(chainId: number): boolean {
    // Common testnet chain IDs
    const testnets = [3, 4, 5, 42, 97, 80001, 4002, 43113, 421611, 69, 420];
    return testnets.includes(chainId);
  }

  /**
   * Get network type description
   */
  static getNetworkType(chainId: number): "mainnet" | "testnet" | "custom" {
    if (this.isMainnet(chainId)) return "mainnet";
    if (this.isTestnet(chainId)) return "testnet";
    return "custom";
  }

  /**
   * Validate RPC URL
   */
  static isValidRpcUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Validate Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate network configuration
   */
  static validateNetwork(network: Partial<Network>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!network.name || network.name.trim().length === 0) {
      errors.push("Network name is required");
    }

    if (typeof network.chainId !== "number" || network.chainId <= 0) {
      errors.push("Valid chainId is required");
    }

    if (!network.rpc || network.rpc.length === 0) {
      errors.push("At least one RPC endpoint is required");
    } else {
      network.rpc.forEach((rpc, index) => {
        if (!this.isValidRpcUrl(rpc.url)) {
          errors.push(`Invalid RPC URL at index ${index}: ${rpc.url}`);
        }
      });
    }

    if (network.blockExplorer && !this.isValidRpcUrl(network.blockExplorer)) {
      errors.push("Invalid block explorer URL");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a default RPC endpoint
   */
  static createRpcEndpoint(url: string, name?: string): RpcEndpoint {
    return {
      name: name || "Default",
      url,
    };
  }

  /**
   * Get a user-friendly network name
   */
  static getDisplayName(network: Network): string {
    if (network.isCustom) {
      return `${network.name} (Custom)`;
    }

    const type = this.getNetworkType(network.chainId);
    if (type === "testnet") {
      return `${network.name} (Testnet)`;
    }

    return network.name;
  }

  /**
   * Sort networks by importance (mainnet first, then testnet, then custom)
   */
  static sortNetworks(networks: Network[]): Network[] {
    return networks.sort((a, b) => {
      // Custom networks last
      if (a.isCustom && !b.isCustom) return 1;
      if (!a.isCustom && b.isCustom) return -1;

      // Mainnets before testnets
      const aType = this.getNetworkType(a.chainId);
      const bType = this.getNetworkType(b.chainId);

      if (aType === "mainnet" && bType !== "mainnet") return -1;
      if (aType !== "mainnet" && bType === "mainnet") return 1;

      if (aType === "testnet" && bType === "custom") return -1;
      if (aType === "custom" && bType === "testnet") return 1;

      // Within same type, sort by chainId
      return a.chainId - b.chainId;
    });
  }

  /**
   * Find network by various criteria
   */
  static findNetwork(
    networks: Network[],
    criteria: {
      chainId?: number;
      name?: string;
      id?: string;
    }
  ): Network | null {
    return (
      networks.find((network) => {
        if (
          criteria.chainId !== undefined &&
          network.chainId !== criteria.chainId
        ) {
          return false;
        }
        if (criteria.name !== undefined && network.name !== criteria.name) {
          return false;
        }
        if (criteria.id !== undefined && network.id !== criteria.id) {
          return false;
        }
        return true;
      }) || null
    );
  }

  /**
   * Generate a unique network ID
   */
  static generateNetworkId(chainId: number, isCustom: boolean = false): string {
    const prefix = isCustom ? "custom" : "builtin";
    return `${prefix}-${chainId}`;
  }
}
