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
