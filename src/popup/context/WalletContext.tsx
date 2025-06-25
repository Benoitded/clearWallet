import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { ethers } from "ethers";

export interface Wallet {
  address: string;
  name: string;
  balance: string;
}

interface WalletContextType {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  setSelectedWallet: (wallet: Wallet) => void;
  addWallet: (wallet: Wallet) => Promise<void>;
  addMultipleWalletsFromMnemonic: (
    mnemonic: string,
    baseName: string
  ) => Promise<void>;
  deleteAllWallets: () => Promise<void>;
  deleteWallet: (address: string) => Promise<void>;
  renameWallet: (address: string, newName: string) => Promise<void>;
  loadWallets: () => Promise<void>;
  switchWalletForConnectedDApps: (newWallet: Wallet) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    try {
      // Check for stored wallets array first
      const walletsResult = await chrome.storage.local.get([
        "wallets",
        "selectedWallet",
      ]);
      if (walletsResult.wallets && walletsResult.wallets.length > 0) {
        setWallets(walletsResult.wallets);

        // Load saved selected wallet or default to first
        const savedSelectedWallet = walletsResult.selectedWallet;
        const walletExists =
          savedSelectedWallet &&
          walletsResult.wallets.find(
            (w: Wallet) => w.address === savedSelectedWallet.address
          );

        setSelectedWallet(
          walletExists ? savedSelectedWallet : walletsResult.wallets[0]
        );
        return;
      }

      // If no wallets array, check for individual wallet entries
      const allStorage = await chrome.storage.local.get();
      const walletKeys = Object.keys(allStorage).filter((key) =>
        key.startsWith("wallet_")
      );

      if (walletKeys.length > 0) {
        const foundWallets: Wallet[] = [];

        for (const key of walletKeys) {
          const address = key.replace("wallet_", "");
          foundWallets.push({
            address: address,
            name: `Wallet ${foundWallets.length + 1}`,
            balance: "0",
          });
        }

        if (foundWallets.length > 0) {
          setWallets(foundWallets);
          setSelectedWallet(foundWallets[0]);
          // Save wallets array for future use
          await chrome.storage.local.set({ wallets: foundWallets });
        }
      }
    } catch (error) {
      console.error("Error loading wallets:", error);
    }
  };

  const addWallet = async (wallet: Wallet) => {
    const updatedWallets = [...wallets, wallet];
    setWallets(updatedWallets);
    if (!selectedWallet) {
      setSelectedWallet(wallet);
      await chrome.storage.local.set({ selectedWallet: wallet });
    }
    await chrome.storage.local.set({ wallets: updatedWallets });
  };

  const addMultipleWalletsFromMnemonic = async (
    mnemonic: string,
    baseName: string
  ) => {
    try {
      const newWallets: Wallet[] = [];

      // Get the next available index by checking existing wallets derived from the same mnemonic
      const allStorage = await chrome.storage.local.get();
      const existingMnemonicWallets = Object.values(allStorage).filter(
        (data: any) => data.mnemonic === mnemonic
      );
      const nextIndex = existingMnemonicWallets.length;

      // Create one new wallet with the next derivation index
      const derivedWallet = ethers.HDNodeWallet.fromPhrase(
        mnemonic,
        "",
        `m/44'/60'/0'/0/${nextIndex}`
      );

      const walletObj: Wallet = {
        address: derivedWallet.address,
        name: `${baseName} ${nextIndex + 1}`,
        balance: "0",
      };

      newWallets.push(walletObj);

      // Store wallet data
      await chrome.storage.local.set({
        [`wallet_${derivedWallet.address}`]: {
          encryptedPrivateKey: derivedWallet.privateKey,
          mnemonic: mnemonic,
          derivationIndex: nextIndex,
        },
      });

      const updatedWallets = [...wallets, ...newWallets];
      setWallets(updatedWallets);
      setSelectedWallet(newWallets[0]);
      await chrome.storage.local.set({
        wallets: updatedWallets,
        selectedWallet: newWallets[0],
      });
    } catch (error) {
      console.error("Error adding wallets from mnemonic:", error);
      throw error;
    }
  };

  const deleteAllWallets = async () => {
    try {
      // Clear all wallet data from storage
      const allStorage = await chrome.storage.local.get();
      const keysToRemove = Object.keys(allStorage).filter(
        (key) =>
          key.startsWith("wallet_") ||
          key === "wallets" ||
          key === "selectedWallet"
      );

      await chrome.storage.local.remove(keysToRemove);

      // Reset state
      setWallets([]);
      setSelectedWallet(null);
    } catch (error) {
      console.error("Error deleting wallets:", error);
      throw error;
    }
  };

  const deleteWallet = async (address: string) => {
    try {
      // Remove from storage
      await chrome.storage.local.remove([`wallet_${address}`]);

      // Update state
      const updatedWallets = wallets.filter((w) => w.address !== address);
      setWallets(updatedWallets);

      // Update chrome storage
      await chrome.storage.local.set({ wallets: updatedWallets });

      // If deleted wallet was selected, select first remaining wallet
      if (selectedWallet?.address === address) {
        const newSelectedWallet =
          updatedWallets.length > 0 ? updatedWallets[0] : null;
        setSelectedWallet(newSelectedWallet);
        await chrome.storage.local.set({ selectedWallet: newSelectedWallet });
      }
    } catch (error) {
      console.error("Error deleting wallet:", error);
      throw error;
    }
  };

  const renameWallet = async (address: string, newName: string) => {
    try {
      // Update wallets array
      const updatedWallets = wallets.map((w) =>
        w.address === address ? { ...w, name: newName } : w
      );
      setWallets(updatedWallets);

      // Update chrome storage
      await chrome.storage.local.set({ wallets: updatedWallets });

      // Update selected wallet if it's the one being renamed
      if (selectedWallet?.address === address) {
        const updatedSelectedWallet = { ...selectedWallet, name: newName };
        setSelectedWallet(updatedSelectedWallet);
        await chrome.storage.local.set({
          selectedWallet: updatedSelectedWallet,
        });
      }
    } catch (error) {
      console.error("Error renaming wallet:", error);
      throw error;
    }
  };

  // Enhanced setSelectedWallet that saves to storage and handles dApp switching
  const setSelectedWalletAndSave = async (wallet: Wallet) => {
    setSelectedWallet(wallet);
    await chrome.storage.local.set({ selectedWallet: wallet });

    // Check for connected dApps and handle wallet switching
    await switchWalletForConnectedDApps(wallet);
  };

  const switchWalletForConnectedDApps = async (newWallet: Wallet) => {
    try {
      // Get current active tab to check if it's a connected dApp
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]) return;

      const currentTabUrl = new URL(tabs[0].url || "");
      const origin = currentTabUrl.origin;

      // Check if this origin is connected
      const connections = await chrome.storage.local.get([`dapp_${origin}`]);
      const connectionData = connections[`dapp_${origin}`];

      if (connectionData && connectionData.connected) {
        // Check if the new wallet is already connected to this dApp
        const isNewWalletConnected =
          connectionData.connectedAddresses?.includes(newWallet.address);

        if (isNewWalletConnected) {
          // Auto-switch: notify the dApp of the account change
          await chrome.tabs.sendMessage(tabs[0].id!, {
            type: "CLEARWALLET_ACCOUNTS_CHANGED",
            data: { accounts: [newWallet.address] },
          });
        } else {
          // Show toast suggesting to connect the new wallet
          // We'll send a message to the popup to show the toast
          chrome.runtime.sendMessage({
            type: "SHOW_RECONNECT_TOAST",
            data: {
              walletName: newWallet.name,
              origin: origin,
            },
          });
        }
      }
    } catch (error) {
      console.error("Error switching wallet for connected dApps:", error);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        wallets,
        selectedWallet,
        setSelectedWallet: setSelectedWalletAndSave,
        addWallet,
        addMultipleWalletsFromMnemonic,
        deleteAllWallets,
        deleteWallet,
        renameWallet,
        loadWallets,
        switchWalletForConnectedDApps,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
