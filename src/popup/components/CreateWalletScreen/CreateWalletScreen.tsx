import React, { useState } from "react";
import { ethers } from "ethers";
import Header from "../Header";
import { useWallet } from "../../context/WalletContext";
import { useToast } from "../../hooks/useToast";
import styles from "./CreateWalletScreen.module.scss";

interface CreateWalletScreenProps {
  onWalletCreated: () => void;
  onBack: () => void;
}

const CreateWalletScreen: React.FC<CreateWalletScreenProps> = ({
  onWalletCreated,
  onBack,
}) => {
  const [walletName, setWalletName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [showMnemonic, setShowMnemonic] = useState(false);
  const { showToast } = useToast();
  const { addWallet } = useWallet();

  const generateWallet = async () => {
    if (!walletName.trim()) {
      showToast("Please enter a wallet name", "warning");
      return;
    }

    setIsCreating(true);
    try {
      // Generate new wallet
      const wallet = ethers.Wallet.createRandom();
      setMnemonic(wallet.mnemonic?.phrase || "");
      setShowMnemonic(true);
      showToast("Wallet generated successfully", "success");
    } catch (error) {
      console.error("Error creating wallet:", error);
      showToast("Error creating wallet", "error");
    }
    setIsCreating(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isCreating) {
      generateWallet();
    }
  };

  const confirmWallet = async () => {
    try {
      // Create initial wallet
      const wallet = ethers.HDNodeWallet.fromPhrase(
        mnemonic,
        "",
        `m/44'/60'/0'/0/0`
      );

      const newWallet = {
        address: wallet.address,
        name: walletName,
        balance: "0",
      };

      // Store encrypted private key
      await chrome.storage.local.set({
        [`wallet_${wallet.address}`]: {
          encryptedPrivateKey: wallet.privateKey,
          mnemonic: mnemonic,
          derivationIndex: 0,
        },
      });

      await addWallet(newWallet);
      onWalletCreated();
      showToast("Wallet saved successfully", "success");
    } catch (error) {
      console.error("Error saving wallet:", error);
      showToast("Error saving wallet", "error");
    }
  };

  if (showMnemonic) {
    return (
      <div className={styles.createWalletScreen}>
        <Header
          title="Your Secret Recovery Phrase"
          showBack={true}
          onBack={onBack}
        />

        <div className={styles.mnemonicContainer}>
          <p className={styles.warning}>
            Write down these words in the exact order shown. Keep them safe and
            secret.
          </p>

          <div className={styles.mnemonicGrid}>
            {mnemonic.split(" ").map((word, index) => (
              <div key={index} className={styles.mnemonicWord}>
                <span className={styles.wordNumber}>{index + 1}</span>
                <span className={styles.word}>{word}</span>
              </div>
            ))}
          </div>

          <div className={styles.mnemonicActions}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={confirmWallet}
            >
              I've saved my recovery phrase
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.createWalletScreen}>
      <Header title="Create New Wallet" showBack={true} onBack={onBack} />

      <div className={styles.formContainer}>
        <div className={styles.formGroup}>
          <label htmlFor="walletName">Wallet Name</label>
          <input
            type="text"
            id="walletName"
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter wallet name"
            className={styles.formInput}
          />
        </div>

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={generateWallet}
          disabled={isCreating}
        >
          {isCreating ? "Creating..." : "Generate Wallet"}
        </button>
      </div>
    </div>
  );
};

export default CreateWalletScreen;
