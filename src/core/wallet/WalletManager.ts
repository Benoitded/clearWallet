// Core wallet management service
import { Wallet } from "../../shared/types/wallet";
import { StorageService } from "../storage/StorageService";

export interface CreateWalletOptions {
  name?: string;
  type: "imported" | "generated";
  mnemonic?: string;
  privateKey?: string;
  derivationPath?: string;
}

export interface WalletEvent {
  type: "walletAdded" | "walletRemoved" | "walletSelected" | "walletRenamed";
  wallet: Wallet;
  oldWallet?: Wallet;
}

export class WalletManager {
  private static instance: WalletManager;
  private storageService: StorageService;
  private listeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.storageService = StorageService.getInstance();
  }

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager();
    }
    return WalletManager.instance;
  }

  /**
   * Get all wallets
   */
  async getAllWallets(): Promise<Wallet[]> {
    return (await this.storageService.get("wallets")) || [];
  }

  /**
   * Get currently selected wallet
   */
  async getSelectedWallet(): Promise<Wallet | null> {
    return await this.storageService.get("selectedWallet");
  }

  /**
   * Get wallet by ID
   */
  async getWalletById(id: string): Promise<Wallet | null> {
    const wallets = await this.getAllWallets();
    return wallets.find((wallet) => wallet.id === id) || null;
  }

  /**
   * Get wallet by address
   */
  async getWalletByAddress(address: string): Promise<Wallet | null> {
    const wallets = await this.getAllWallets();
    return (
      wallets.find(
        (wallet) => wallet.address.toLowerCase() === address.toLowerCase()
      ) || null
    );
  }

  /**
   * Create a new wallet
   */
  async createWallet(options: CreateWalletOptions): Promise<Wallet> {
    try {
      // Generate wallet data based on type
      const walletData = await this.generateWalletData(options);

      // Check if wallet already exists
      const existingWallet = await this.getWalletByAddress(walletData.address);
      if (existingWallet) {
        throw new Error("Wallet with this address already exists");
      }

      // Create wallet object
      const wallet: Wallet = {
        id: this.generateWalletId(),
        name: options.name || this.generateWalletName(options.type),
        address: walletData.address,
        type: options.type,
        derivationPath: options.derivationPath,
        publicKey: walletData.publicKey,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };

      // Save to storage
      const wallets = await this.getAllWallets();
      wallets.push(wallet);
      await this.storageService.set("wallets", wallets);

      // Select as current wallet if it's the first one
      const selectedWallet = await this.getSelectedWallet();
      if (!selectedWallet) {
        await this.selectWallet(wallet.id);
      }

      // Store encrypted private key separately (not implemented here)
      await this.storeWalletSecret(wallet.id, walletData.privateKey);

      // Emit event
      this.emit("walletAdded", { type: "walletAdded", wallet });

      console.log(
        `WalletManager: Created ${options.type} wallet ${wallet.name}`
      );
      return wallet;
    } catch (error) {
      console.error("WalletManager: Error creating wallet:", error);
      throw error;
    }
  }

  /**
   * Import wallet from private key
   */
  async importFromPrivateKey(
    privateKey: string,
    name?: string
  ): Promise<Wallet> {
    return this.createWallet({
      type: "imported",
      privateKey,
      name,
    });
  }

  /**
   * Import wallet from mnemonic
   */
  async importFromMnemonic(
    mnemonic: string,
    name?: string,
    derivationPath?: string
  ): Promise<Wallet> {
    return this.createWallet({
      type: "imported",
      mnemonic,
      name,
      derivationPath: derivationPath || "m/44'/60'/0'/0/0",
    });
  }

  /**
   * Generate new wallet
   */
  async generateWallet(name?: string): Promise<Wallet> {
    return this.createWallet({
      type: "generated",
      name,
    });
  }

  /**
   * Select a wallet as current
   */
  async selectWallet(walletId: string): Promise<void> {
    try {
      const wallet = await this.getWalletById(walletId);
      if (!wallet) {
        throw new Error(`Wallet with ID ${walletId} not found`);
      }

      const oldWallet = await this.getSelectedWallet();

      // Update last used timestamp
      wallet.lastUsed = Date.now();
      await this.updateWallet(wallet);

      // Set as selected
      await this.storageService.set("selectedWallet", wallet);

      // Emit event
      this.emit("walletSelected", {
        type: "walletSelected",
        wallet,
        oldWallet: oldWallet || undefined,
      });

      console.log(`WalletManager: Selected wallet ${wallet.name}`);
    } catch (error) {
      console.error("WalletManager: Error selecting wallet:", error);
      throw error;
    }
  }

  /**
   * Update wallet information
   */
  async updateWallet(updatedWallet: Wallet): Promise<void> {
    try {
      const wallets = await this.getAllWallets();
      const index = wallets.findIndex((w) => w.id === updatedWallet.id);

      if (index === -1) {
        throw new Error(`Wallet with ID ${updatedWallet.id} not found`);
      }

      wallets[index] = updatedWallet;
      await this.storageService.set("wallets", wallets);

      // Update selected wallet if it's the same
      const selectedWallet = await this.getSelectedWallet();
      if (selectedWallet && selectedWallet.id === updatedWallet.id) {
        await this.storageService.set("selectedWallet", updatedWallet);
      }

      console.log(`WalletManager: Updated wallet ${updatedWallet.name}`);
    } catch (error) {
      console.error("WalletManager: Error updating wallet:", error);
      throw error;
    }
  }

  /**
   * Rename a wallet
   */
  async renameWallet(walletId: string, newName: string): Promise<void> {
    try {
      const wallet = await this.getWalletById(walletId);
      if (!wallet) {
        throw new Error(`Wallet with ID ${walletId} not found`);
      }

      const oldWallet = { ...wallet };
      wallet.name = newName;

      await this.updateWallet(wallet);

      // Emit event
      this.emit("walletRenamed", {
        type: "walletRenamed",
        wallet,
        oldWallet,
      });

      console.log(`WalletManager: Renamed wallet to ${newName}`);
    } catch (error) {
      console.error("WalletManager: Error renaming wallet:", error);
      throw error;
    }
  }

  /**
   * Remove a wallet
   */
  async removeWallet(walletId: string): Promise<void> {
    try {
      const wallet = await this.getWalletById(walletId);
      if (!wallet) {
        throw new Error(`Wallet with ID ${walletId} not found`);
      }

      // Remove from wallets list
      const wallets = await this.getAllWallets();
      const updatedWallets = wallets.filter((w) => w.id !== walletId);
      await this.storageService.set("wallets", updatedWallets);

      // If this was the selected wallet, select another one
      const selectedWallet = await this.getSelectedWallet();
      if (selectedWallet && selectedWallet.id === walletId) {
        if (updatedWallets.length > 0) {
          await this.selectWallet(updatedWallets[0].id);
        } else {
          await this.storageService.set("selectedWallet", null);
        }
      }

      // Remove encrypted private key
      await this.removeWalletSecret(walletId);

      // Emit event
      this.emit("walletRemoved", { type: "walletRemoved", wallet });

      console.log(`WalletManager: Removed wallet ${wallet.name}`);
    } catch (error) {
      console.error("WalletManager: Error removing wallet:", error);
      throw error;
    }
  }

  /**
   * Get private key for a wallet (for signing operations)
   */
  async getWalletPrivateKey(walletId: string): Promise<string> {
    try {
      // TODO: Implement secure private key storage/retrieval
      // This should involve password verification and decryption
      throw new Error("Private key retrieval not yet implemented");
    } catch (error) {
      console.error("WalletManager: Error getting private key:", error);
      throw error;
    }
  }

  /**
   * Check if wallet is locked (needs password)
   */
  async isWalletLocked(): Promise<boolean> {
    // TODO: Implement wallet locking mechanism
    return false;
  }

  /**
   * Lock all wallets
   */
  async lockWallets(): Promise<void> {
    // TODO: Implement wallet locking
    console.log("WalletManager: Wallets locked");
  }

  /**
   * Unlock wallets with password
   */
  async unlockWallets(password: string): Promise<boolean> {
    // TODO: Implement wallet unlocking
    console.log("WalletManager: Wallets unlocked");
    return true;
  }

  // =================== Private Methods ===================

  /**
   * Generate wallet data from options
   */
  private async generateWalletData(options: CreateWalletOptions): Promise<{
    address: string;
    privateKey: string;
    publicKey?: string;
  }> {
    // TODO: Implement actual cryptographic wallet generation
    // This would use libraries like ethers.js or similar

    if (options.privateKey) {
      // Import from private key
      return {
        address: "0x" + "1".repeat(40), // Placeholder
        privateKey: options.privateKey,
      };
    } else if (options.mnemonic) {
      // Import from mnemonic
      return {
        address: "0x" + "2".repeat(40), // Placeholder
        privateKey: "0x" + "a".repeat(64), // Placeholder
      };
    } else {
      // Generate new wallet
      return {
        address: "0x" + "3".repeat(40), // Placeholder
        privateKey: "0x" + "b".repeat(64), // Placeholder
      };
    }
  }

  /**
   * Generate unique wallet ID
   */
  private generateWalletId(): string {
    return (
      "wallet-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9)
    );
  }

  /**
   * Generate default wallet name
   */
  private generateWalletName(type: "imported" | "generated"): string {
    const prefix = type === "imported" ? "Imported" : "Wallet";
    const timestamp = new Date().toLocaleString();
    return `${prefix} ${timestamp}`;
  }

  /**
   * Store wallet secret securely
   */
  private async storeWalletSecret(
    walletId: string,
    privateKey: string
  ): Promise<void> {
    // TODO: Implement secure storage of private keys
    // This should involve encryption with user password
    console.log(`WalletManager: Storing secret for wallet ${walletId}`);
  }

  /**
   * Remove wallet secret
   */
  private async removeWalletSecret(walletId: string): Promise<void> {
    // TODO: Implement secure removal of private keys
    console.log(`WalletManager: Removing secret for wallet ${walletId}`);
  }

  // =================== Event System ===================

  /**
   * Subscribe to wallet events
   */
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Unsubscribe from wallet events
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
   * Emit wallet event
   */
  private emit(event: string, data: WalletEvent): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(
            `WalletManager: Error in event listener for ${event}:`,
            error
          );
        }
      });
    }
  }
}
