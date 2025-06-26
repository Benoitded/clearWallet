// Core storage service with typed schema and migrations
import { Network } from "../../shared/types/networks";
import { Wallet } from "../../shared/types/wallet";

export interface StorageSchema {
  // Networks
  networks: Network[];
  customNetworks: Network[];
  selectedNetwork: Network | null;
  selectedRpcs: Record<string, any>;

  // Wallets
  wallets: Wallet[];
  selectedWallet: Wallet | null;

  // dApp connections
  connectedSites: ConnectedSite[];

  // Settings
  settings: WalletSettings;

  // Metadata
  version: number;
  lastMigration: number;
}

export interface ConnectedSite {
  url: string;
  account: string;
  chainId: number;
  lastUsed: number;
  permissions: string[];
}

export interface WalletSettings {
  autoLock: boolean;
  lockTimeout: number;
  showTestnets: boolean;
  defaultGasLimit: number;
  currency: "USD" | "EUR" | "GBP";
}

const DEFAULT_SETTINGS: WalletSettings = {
  autoLock: true,
  lockTimeout: 15 * 60 * 1000, // 15 minutes
  showTestnets: false,
  defaultGasLimit: 21000,
  currency: "USD",
};

export class StorageService {
  private static instance: StorageService;
  private cache = new Map<keyof StorageSchema, any>();
  private readonly STORAGE_VERSION = 1;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Get value from storage with caching
   */
  async get<K extends keyof StorageSchema>(
    key: K
  ): Promise<StorageSchema[K] | null> {
    try {
      // Check cache first
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }

      // Get from chrome storage
      const result = await chrome.storage.local.get([key]);
      const value = result[key] || null;

      // Cache the result
      if (value !== null) {
        this.cache.set(key, value);
      }

      return value;
    } catch (error) {
      console.error(`StorageService: Error getting ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in storage with caching
   */
  async set<K extends keyof StorageSchema>(
    key: K,
    value: StorageSchema[K]
  ): Promise<void> {
    try {
      // Save to chrome storage
      await chrome.storage.local.set({ [key]: value });

      // Update cache
      this.cache.set(key, value);

      console.log(`StorageService: Set ${key}:`, value);
    } catch (error) {
      console.error(`StorageService: Error setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple values at once
   */
  async getMultiple<K extends keyof StorageSchema>(
    keys: K[]
  ): Promise<Partial<Pick<StorageSchema, K>>> {
    try {
      const result = await chrome.storage.local.get(keys);

      // Update cache and return typed result
      const typedResult: Partial<Pick<StorageSchema, K>> = {};

      keys.forEach((key) => {
        if (result[key] !== undefined) {
          this.cache.set(key, result[key]);
          (typedResult as any)[key] = result[key];
        }
      });

      return typedResult;
    } catch (error) {
      console.error("StorageService: Error getting multiple values:", error);
      return {};
    }
  }

  /**
   * Set multiple values at once
   */
  async setMultiple(data: Partial<StorageSchema>): Promise<void> {
    try {
      await chrome.storage.local.set(data);

      // Update cache
      Object.entries(data).forEach(([key, value]) => {
        this.cache.set(key as keyof StorageSchema, value);
      });

      console.log("StorageService: Set multiple values:", Object.keys(data));
    } catch (error) {
      console.error("StorageService: Error setting multiple values:", error);
      throw error;
    }
  }

  /**
   * Remove value from storage
   */
  async remove<K extends keyof StorageSchema>(key: K): Promise<void> {
    try {
      await chrome.storage.local.remove([key]);
      this.cache.delete(key);
      console.log(`StorageService: Removed ${key}`);
    } catch (error) {
      console.error(`StorageService: Error removing ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      this.cache.clear();
      console.log("StorageService: Cleared all storage");
    } catch (error) {
      console.error("StorageService: Error clearing storage:", error);
      throw error;
    }
  }

  /**
   * Initialize storage with defaults
   */
  async initialize(): Promise<void> {
    try {
      const existingVersion = await this.get("version");

      if (!existingVersion) {
        // First time setup
        await this.setMultiple({
          networks: [],
          customNetworks: [],
          selectedNetwork: null,
          selectedRpcs: {},
          wallets: [],
          selectedWallet: null,
          connectedSites: [],
          settings: DEFAULT_SETTINGS,
          version: this.STORAGE_VERSION,
          lastMigration: Date.now(),
        });

        console.log("StorageService: Initialized with defaults");
      } else if (existingVersion < this.STORAGE_VERSION) {
        // Run migrations
        await this.runMigrations(existingVersion, this.STORAGE_VERSION);
      }
    } catch (error) {
      console.error("StorageService: Error during initialization:", error);
      throw error;
    }
  }

  /**
   * Run storage migrations
   */
  private async runMigrations(
    fromVersion: number,
    toVersion: number
  ): Promise<void> {
    console.log(
      `StorageService: Running migrations from v${fromVersion} to v${toVersion}`
    );

    // Migration logic would go here
    // For now, just update the version
    await this.set("version", toVersion);
    await this.set("lastMigration", Date.now());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log("StorageService: Cache cleared");
  }

  /**
   * Get cache status
   */
  getCacheInfo(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()) as string[],
    };
  }
}
