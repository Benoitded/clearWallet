import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import Header from "../Header";
import { useWallet } from "../../context/WalletContext";
import { useToast } from "../../hooks/useToast";
import styles from "./AddWalletScreen.module.scss";

interface AddWalletScreenProps {
  onWalletAdded: () => void;
  onBack: () => void;
}

interface WalletOption {
  address: string;
  derivationIndex: number;
  name: string;
  selected: boolean;
}

const AddWalletScreen: React.FC<AddWalletScreenProps> = ({
  onWalletAdded,
  onBack,
}) => {
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [mnemonic, setMnemonic] = useState("");

  const { addWallet, wallets } = useWallet();
  const { showToast } = useToast();

  useEffect(() => {
    loadWalletOptions();
  }, []);

  const loadWalletOptions = async () => {
    setIsLoading(true);
    try {
      // Get the first wallet's mnemonic to derive new addresses
      if (wallets.length === 0) {
        showToast("No existing wallets found", "error");
        onBack();
        return;
      }

      const firstWallet = wallets[0];
      const storage = await chrome.storage.local.get([
        `wallet_${firstWallet.address}`,
      ]);
      const walletData = storage[`wallet_${firstWallet.address}`];

      if (!walletData?.mnemonic) {
        showToast("Cannot derive new addresses without mnemonic", "error");
        onBack();
        return;
      }

      setMnemonic(walletData.mnemonic);

      // Find existing wallet indices
      const allStorage = await chrome.storage.local.get();
      const existingIndices = Object.values(allStorage)
        .filter((data: any) => data.mnemonic === walletData.mnemonic)
        .map((data: any) => data.derivationIndex)
        .sort((a, b) => a - b);

      const nextIndex =
        existingIndices.length > 0
          ? Math.max(...existingIndices) + 1
          : wallets.length;

      // Generate next 10 addresses
      const options: WalletOption[] = [];
      for (let i = 0; i < 10; i++) {
        const derivationIndex = nextIndex + i;
        const derivedWallet = ethers.HDNodeWallet.fromPhrase(
          walletData.mnemonic,
          "",
          `m/44'/60'/0'/0/${derivationIndex}`
        );

        options.push({
          address: derivedWallet.address,
          derivationIndex,
          name: `Wallet ${derivationIndex + 1}`,
          selected: false,
        });
      }

      setWalletOptions(options);
    } catch (error) {
      console.error("Error loading wallet options:", error);
      showToast("Error loading wallet options", "error");
      onBack();
    }
    setIsLoading(false);
  };

  const handleNameChange = (index: number, newName: string) => {
    setWalletOptions((prev) =>
      prev.map((option, i) =>
        i === index ? { ...option, name: newName } : option
      )
    );
  };

  const handleSelectionChange = (index: number, selected: boolean) => {
    setWalletOptions((prev) =>
      prev.map((option, i) => (i === index ? { ...option, selected } : option))
    );
  };

  const handleAddWallets = async () => {
    const selectedWallets = walletOptions.filter((option) => option.selected);

    if (selectedWallets.length === 0) {
      showToast("Please select at least one wallet", "warning");
      return;
    }

    setIsAdding(true);
    try {
      for (const walletOption of selectedWallets) {
        // Store wallet data
        await chrome.storage.local.set({
          [`wallet_${walletOption.address}`]: {
            encryptedPrivateKey: ethers.HDNodeWallet.fromPhrase(
              mnemonic,
              "",
              `m/44'/60'/0'/0/${walletOption.derivationIndex}`
            ).privateKey,
            mnemonic: mnemonic,
            derivationIndex: walletOption.derivationIndex,
          },
        });

        // Add to wallet context
        await addWallet({
          address: walletOption.address,
          name: walletOption.name,
          balance: "0",
        });
      }

      showToast(
        `Added ${selectedWallets.length} wallet(s) successfully`,
        "success"
      );
      onWalletAdded();
    } catch (error) {
      console.error("Error adding wallets:", error);
      showToast("Error adding wallets", "error");
    }
    setIsAdding(false);
  };

  const formatAddress = (address: string) => {
    // Display full address for selection screen
    return address;
  };

  const hasSelectedWallets = walletOptions.some((option) => option.selected);

  if (isLoading) {
    return (
      <div className={styles.addWalletScreen}>
        <Header title="Add Wallet" showBack={true} onBack={onBack} />
        <div className={styles.loading}>Loading available addresses...</div>
      </div>
    );
  }

  return (
    <div className={styles.addWalletScreen}>
      <Header title="Add Wallet" showBack={true} onBack={onBack} />

      <div className={styles.description}>
        <h3>Here are your addresses available,</h3>
        <p>take the ones you want:</p>
      </div>

      <div className={styles.walletList}>
        {walletOptions.map((option, index) => (
          <div key={option.address} className={styles.walletOption}>
            <div className={styles.walletInfo}>
              <span className={styles.address}>
                {formatAddress(option.address)}
              </span>
              <input
                type="text"
                value={option.name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                placeholder="Wallet name"
                className={styles.nameInput}
              />
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={option.selected}
                  onChange={(e) =>
                    handleSelectionChange(index, e.target.checked)
                  }
                  className={styles.checkbox}
                />
                <span className={styles.checkboxLabel}>Select</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleAddWallets}
          disabled={isAdding || !hasSelectedWallets}
        >
          {isAdding
            ? "Adding..."
            : hasSelectedWallets
            ? "NEXT"
            : "Select at least 1"}
        </button>
        {hasSelectedWallets && (
          <p className={styles.actionNote}>
            (when you have selected at least 1, otherwise write "select")
          </p>
        )}
      </div>
    </div>
  );
};

export default AddWalletScreen;
