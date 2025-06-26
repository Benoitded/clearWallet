// Shared wallet types

export interface Wallet {
  id: string;
  name: string;
  address: string;
  type: "imported" | "generated";
  isHardware?: boolean;
  derivationPath?: string;
  publicKey?: string;
  createdAt: number;
  lastUsed: number;
}

export interface WalletBalance {
  address: string;
  chainId: number;
  balance: string; // in wei
  symbol: string;
  decimals: number;
  lastUpdated: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce: number;
  data: string;
  chainId: number;
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
  blockNumber?: number;
}
