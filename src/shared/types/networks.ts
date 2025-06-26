// Shared network types

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
