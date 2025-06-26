// Migration service to handle data migration from old to new architecture
import { ClearWalletCore } from "../core";
import { NetworkUtils } from "../shared/utils/NetworkUtils";

interface LegacyStorageData {
  wallets?: any[];
  selectedWallet?: any;
  networks?: any[];
  selectedNetwork?: any;
  connectedSites?: any[];
  customNetworks?: any[];
  selectedRpcs?: Record<string, any>;
}

export class MigrationService {
  private static instance: MigrationService;

  private constructor() {}

  static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  /**
   * Check if migration is needed
   */
  async isMigrationNeeded(): Promise<boolean> {
    try {
      // Check if we have data in the old format
      const legacyData = await chrome.storage.local.get([
        "wallets",
        "networks",
        "connectedSites",
        "customNetworks",
      ]);

      // Check if we already have new format data
      const version = await ClearWalletCore.storage.get("version");

      // Migration needed if we have legacy data but no version
      return Object.keys(legacyData).length > 0 && !version;
    } catch (error) {
      console.error("MigrationService: Error checking migration need:", error);
      return false;
    }
  }

  /**
   * Perform full migration
   */
  async performMigration(): Promise<void> {
    try {
      console.log("MigrationService: Starting migration...");

      // Get all legacy data
      const legacyData = await this.getLegacyData();

      // Migrate data in order
      await this.migrateNetworks(legacyData);
      await this.migrateWallets(legacyData);
      await this.migrateConnectedSites(legacyData);
      await this.migrateSettings(legacyData);

      // Clean up legacy data
      await this.cleanupLegacyData();

      console.log("MigrationService: Migration completed successfully");
    } catch (error) {
      console.error("MigrationService: Migration failed:", error);
      throw error;
    }
  }

  /**
   * Get all legacy data
   */
  private async getLegacyData(): Promise<LegacyStorageData> {
    return await chrome.storage.local.get([
      "wallets",
      "selectedWallet",
      "networks",
      "selectedNetwork",
      "connectedSites",
      "customNetworks",
      "selectedRpcs",
    ]);
  }

  /**
   * Migrate networks data
   */
  private async migrateNetworks(legacyData: LegacyStorageData): Promise<void> {
    try {
      console.log("MigrationService: Migrating networks...");

      const builtInNetworks = legacyData.networks || [];
      const customNetworks = legacyData.customNetworks || [];

      // Merge and deduplicate networks
      const allNetworks = [...builtInNetworks, ...customNetworks];
      const uniqueNetworks = this.deduplicateNetworks(allNetworks);

      // Separate built-in and custom networks
      const migratedBuiltIn = uniqueNetworks.filter((n) => !n.isCustom);
      const migratedCustom = uniqueNetworks.filter((n) => n.isCustom);

      // Save to new storage format
      await ClearWalletCore.storage.setMultiple({
        networks: migratedBuiltIn,
        customNetworks: migratedCustom,
        selectedNetwork:
          legacyData.selectedNetwork || migratedBuiltIn[0] || null,
        selectedRpcs: legacyData.selectedRpcs || {},
      });

      console.log(
        `MigrationService: Migrated ${uniqueNetworks.length} networks`
      );
    } catch (error) {
      console.error("MigrationService: Error migrating networks:", error);
      throw error;
    }
  }

  /**
   * Migrate wallets data
   */
  private async migrateWallets(legacyData: LegacyStorageData): Promise<void> {
    try {
      console.log("MigrationService: Migrating wallets...");

      const wallets = legacyData.wallets || [];
      const selectedWallet = legacyData.selectedWallet || null;

      // Migrate wallet format if needed
      const migratedWallets = wallets.map((wallet) => ({
        ...wallet,
        id: wallet.id || this.generateWalletId(),
        type: wallet.type || "imported",
        createdAt: wallet.createdAt || Date.now(),
        lastUsed: wallet.lastUsed || Date.now(),
      }));

      // Ensure selected wallet exists in wallets array
      let migratedSelectedWallet = selectedWallet;
      if (
        selectedWallet &&
        !migratedWallets.find((w) => w.address === selectedWallet.address)
      ) {
        migratedSelectedWallet = migratedWallets[0] || null;
      }

      // Save to new storage format
      await ClearWalletCore.storage.setMultiple({
        wallets: migratedWallets,
        selectedWallet: migratedSelectedWallet,
      });

      console.log(
        `MigrationService: Migrated ${migratedWallets.length} wallets`
      );
    } catch (error) {
      console.error("MigrationService: Error migrating wallets:", error);
      throw error;
    }
  }

  /**
   * Migrate connected sites data
   */
  private async migrateConnectedSites(
    legacyData: LegacyStorageData
  ): Promise<void> {
    try {
      console.log("MigrationService: Migrating connected sites...");

      const connectedSites = legacyData.connectedSites || [];

      // Migrate site format if needed
      const migratedSites = connectedSites.map((site) => ({
        url: site.url,
        account: site.account,
        chainId: site.chainId || 1,
        lastUsed: site.lastUsed || Date.now(),
        permissions: site.permissions || ["connected"],
      }));

      // Save to new storage format
      await ClearWalletCore.storage.set("connectedSites", migratedSites);

      console.log(
        `MigrationService: Migrated ${migratedSites.length} connected sites`
      );
    } catch (error) {
      console.error(
        "MigrationService: Error migrating connected sites:",
        error
      );
      throw error;
    }
  }

  /**
   * Migrate settings data
   */
  private async migrateSettings(legacyData: LegacyStorageData): Promise<void> {
    try {
      console.log("MigrationService: Migrating settings...");

      // Create default settings (legacy data might not have settings)
      const defaultSettings = {
        autoLock: true,
        lockTimeout: 15 * 60 * 1000, // 15 minutes
        showTestnets: false,
        defaultGasLimit: 21000,
        currency: "USD" as const,
      };

      // Save to new storage format
      await ClearWalletCore.storage.set("settings", defaultSettings);

      console.log("MigrationService: Migrated settings");
    } catch (error) {
      console.error("MigrationService: Error migrating settings:", error);
      throw error;
    }
  }

  /**
   * Clean up legacy data after successful migration
   */
  private async cleanupLegacyData(): Promise<void> {
    try {
      console.log("MigrationService: Cleaning up legacy data...");

      const keysToRemove = [
        "customNetworks", // This was merged into networks
        // Keep other keys for now in case of rollback needs
      ];

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }

      console.log("MigrationService: Legacy data cleanup completed");
    } catch (error) {
      console.error("MigrationService: Error cleaning up legacy data:", error);
      // Don't throw here, migration is still successful
    }
  }

  /**
   * Deduplicate networks by chainId
   */
  private deduplicateNetworks(networks: any[]): any[] {
    const networkMap = new Map();

    networks.forEach((network) => {
      const existing = networkMap.get(network.chainId);

      // Prefer custom networks over built-in ones
      if (!existing || (network.isCustom && !existing.isCustom)) {
        // Ensure network has proper structure
        networkMap.set(network.chainId, {
          id:
            network.id ||
            NetworkUtils.generateNetworkId(network.chainId, network.isCustom),
          name: network.name,
          chainId: network.chainId,
          blockExplorer: network.blockExplorer || "",
          rpc: network.rpc || [],
          isTestnet: network.isTestnet || false,
          isCustom: network.isCustom || false,
          image: network.image,
        });
      }
    });

    return Array.from(networkMap.values());
  }

  /**
   * Generate wallet ID for legacy wallets
   */
  private generateWalletId(): string {
    return (
      "migrated-wallet-" +
      Date.now() +
      "-" +
      Math.random().toString(36).substr(2, 9)
    );
  }

  /**
   * Create backup of current data before migration
   */
  async createBackup(): Promise<void> {
    try {
      console.log("MigrationService: Creating backup...");

      const allData = await chrome.storage.local.get(null);
      const backup = {
        timestamp: Date.now(),
        data: allData,
      };

      await chrome.storage.local.set({
        migration_backup: backup,
      });

      console.log("MigrationService: Backup created");
    } catch (error) {
      console.error("MigrationService: Error creating backup:", error);
      throw error;
    }
  }

  /**
   * Restore from backup (in case of migration failure)
   */
  async restoreFromBackup(): Promise<void> {
    try {
      console.log("MigrationService: Restoring from backup...");

      const result = await chrome.storage.local.get(["migration_backup"]);
      const backup = result.migration_backup;

      if (!backup) {
        throw new Error("No backup found");
      }

      // Clear current data
      await chrome.storage.local.clear();

      // Restore backup data
      await chrome.storage.local.set(backup.data);

      console.log("MigrationService: Restored from backup");
    } catch (error) {
      console.error("MigrationService: Error restoring from backup:", error);
      throw error;
    }
  }
}
