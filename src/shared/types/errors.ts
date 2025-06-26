// Standardized error types for ClearWallet

export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  INVALID_PARAMS = "INVALID_PARAMS",
  PERMISSION_DENIED = "PERMISSION_DENIED",

  // Wallet errors
  WALLET_NOT_FOUND = "WALLET_NOT_FOUND",
  WALLET_LOCKED = "WALLET_LOCKED",
  INVALID_PRIVATE_KEY = "INVALID_PRIVATE_KEY",
  INVALID_MNEMONIC = "INVALID_MNEMONIC",
  WALLET_ALREADY_EXISTS = "WALLET_ALREADY_EXISTS",

  // Network errors
  NETWORK_NOT_FOUND = "NETWORK_NOT_FOUND",
  INVALID_CHAIN_ID = "INVALID_CHAIN_ID",
  NETWORK_ALREADY_EXISTS = "NETWORK_ALREADY_EXISTS",
  RPC_ERROR = "RPC_ERROR",

  // Transaction errors
  TRANSACTION_FAILED = "TRANSACTION_FAILED",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  GAS_LIMIT_EXCEEDED = "GAS_LIMIT_EXCEEDED",
  NONCE_TOO_LOW = "NONCE_TOO_LOW",

  // Storage errors
  STORAGE_ERROR = "STORAGE_ERROR",
  STORAGE_QUOTA_EXCEEDED = "STORAGE_QUOTA_EXCEEDED",

  // User interaction errors
  USER_REJECTED = "USER_REJECTED",
  USER_CANCELLED = "USER_CANCELLED",

  // Connection errors
  NOT_CONNECTED = "NOT_CONNECTED",
  CONNECTION_FAILED = "CONNECTION_FAILED",
  DAPP_NOT_AUTHORIZED = "DAPP_NOT_AUTHORIZED",
}

export interface ClearWalletError {
  code: ErrorCode;
  message: string;
  data?: any;
  timestamp: number;
  stack?: string;
}

export class WalletError extends Error {
  public readonly code: ErrorCode;
  public readonly data?: any;
  public readonly timestamp: number;

  constructor(code: ErrorCode, message: string, data?: any) {
    super(message);
    this.name = "WalletError";
    this.code = code;
    this.data = data;
    this.timestamp = Date.now();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WalletError);
    }
  }

  toJSON(): ClearWalletError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  static fromJSON(errorData: ClearWalletError): WalletError {
    const error = new WalletError(
      errorData.code,
      errorData.message,
      errorData.data
    );
    error.stack = errorData.stack;
    return error;
  }

  // Factory methods for common errors
  static userRejected(
    message: string = "User rejected the request"
  ): WalletError {
    return new WalletError(ErrorCode.USER_REJECTED, message);
  }

  static walletLocked(message: string = "Wallet is locked"): WalletError {
    return new WalletError(ErrorCode.WALLET_LOCKED, message);
  }

  static networkNotFound(chainId: number): WalletError {
    return new WalletError(
      ErrorCode.NETWORK_NOT_FOUND,
      `Network with chainId ${chainId} not found`,
      { chainId }
    );
  }

  static invalidParams(message: string, params?: any): WalletError {
    return new WalletError(ErrorCode.INVALID_PARAMS, message, params);
  }

  static permissionDenied(message: string = "Permission denied"): WalletError {
    return new WalletError(ErrorCode.PERMISSION_DENIED, message);
  }

  static rpcError(message: string, data?: any): WalletError {
    return new WalletError(ErrorCode.RPC_ERROR, message, data);
  }

  static storageError(message: string, data?: any): WalletError {
    return new WalletError(ErrorCode.STORAGE_ERROR, message, data);
  }
}
