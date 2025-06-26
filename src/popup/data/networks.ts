export interface RpcEndpoint {
  name: string;
  url: string;
}

export interface Network {
  id: string;
  name: string;
  chainId: number;
  blockExplorer: string;
  rpc: RpcEndpoint[];
  isTestnet: boolean;
  isCustom?: boolean;
  image?: string; // URL or emoji for network icon
}

export const NETWORKS: Network[] = [
  {
    id: "mainnet",
    name: "Ethereum Mainnet",
    chainId: 1,
    blockExplorer: "https://etherscan.io",
    rpc: [
      { name: "Llamarpc", url: "https://eth.llamarpc.com" },
      { name: "PublicNode", url: "https://ethereum-rpc.publicnode.com" },
      { name: "DRPC", url: "https://eth.drpc.org" },
      { name: "Flashbots", url: "https://rpc.flashbots.net/fast" },
    ],
    isTestnet: false,
    image:
      "https://corzzzxuybbykevxkokz.supabase.co/storage/v1/object/public/tokens/ETH.png",
  },
  {
    id: "base",
    name: "Base",
    chainId: 8453,
    blockExplorer: "https://basescan.org",
    rpc: [
      { name: "Llamarpc", url: "https://base.llamarpc.com" },
      { name: "PublicNode", url: "wss://base-rpc.publicnode.com" },
      { name: "Nodies", url: "https://base-pokt.nodies.app" },
    ],
    isTestnet: false,
    image:
      "https://corzzzxuybbykevxkokz.supabase.co/storage/v1/object/public/tokens/ETH.png",
  },
  {
    id: "holesky",
    name: "Holesky Testnet",
    chainId: 17000,
    blockExplorer: "https://holesky.etherscan.io",
    rpc: [
      {
        name: "PublicNode",
        url: "https://ethereum-holesky-rpc.publicnode.com",
      },
      {
        name: "Omniatech",
        url: "https://endpoints.omniatech.io/v1/eth/holesky/public",
      },
      { name: "DRPC", url: "https://holesky.drpc.org" },
    ],
    isTestnet: true,
    image:
      "https://corzzzxuybbykevxkokz.supabase.co/storage/v1/object/public/tokens/ETH.png",
  },
  {
    id: "sepolia",
    name: "Sepolia Testnet",
    chainId: 11155111,
    blockExplorer: "https://sepolia.etherscan.io",
    rpc: [
      { name: "DRPC", url: "https://sepolia.drpc.org" },
      {
        name: "PublicNode",
        url: "https://ethereum-sepolia-rpc.publicnode.com",
      },
    ],
    isTestnet: true,
    image:
      "https://corzzzxuybbykevxkokz.supabase.co/storage/v1/object/public/tokens/ETH.png",
  },
];

// Utility functions for network management
export const NetworkUtils = {
  /**
   * Find a network by chainId
   */
  findByChainId: (
    chainId: number,
    customNetworks: Network[] = []
  ): Network | undefined => {
    const allNetworks = [...NETWORKS, ...customNetworks];
    return allNetworks.find((network) => network.chainId === chainId);
  },

  /**
   * Get all built-in chain IDs
   */
  getBuiltInChainIds: (): number[] => {
    return NETWORKS.map((network) => network.chainId);
  },

  /**
   * Check if a chainId is a built-in network
   */
  isBuiltInNetwork: (chainId: number): boolean => {
    return NETWORKS.some((network) => network.chainId === chainId);
  },

  /**
   * Get default RPC for a network
   */
  getDefaultRpc: (network: Network): RpcEndpoint => {
    return network.rpc[0];
  },

  /**
   * Format chainId to hex string
   */
  chainIdToHex: (chainId: number): string => {
    return `0x${chainId.toString(16)}`;
  },

  /**
   * Parse chainId from hex or decimal string
   */
  parseChainId: (chainId: string): number => {
    return chainId.startsWith("0x")
      ? parseInt(chainId, 16)
      : parseInt(chainId, 10);
  },
};
