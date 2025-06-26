import React, { useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../../context/WalletContext";
import { useToast } from "../../hooks/useToast";
import { usePopupService } from "../../hooks/usePopupService";
import Header from "../Header";
import styles from "./ImportWalletScreen.module.scss";

const ImportWalletScreen: React.FC = () => {
  const [importMethod, setImportMethod] = useState<"mnemonic" | "privateKey">(
    "mnemonic"
  );
  const [walletName, setWalletName] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const { showToast } = useToast();
  const { addWallet } = useWallet();
  const { navigateToView } = usePopupService();

  const importWallet = async () => {
    if (!walletName.trim()) {
      showToast("Please enter a wallet name", "warning");
      return;
    }

    setIsImporting(true);
    try {
      if (importMethod === "mnemonic") {
        if (!mnemonic.trim()) {
          showToast("Please enter your recovery phrase", "warning");
          return;
        }

        // Create initial wallet from mnemonic
        const wallet = ethers.HDNodeWallet.fromPhrase(
          mnemonic.trim(),
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
            mnemonic: mnemonic.trim(),
            derivationIndex: 0,
          },
        });

        await addWallet(newWallet);
        showToast("Wallet imported successfully", "success");

        // Navigate directly to dashboard
        navigateToView("dashboard");
      } else {
        // Private key import - single wallet
        if (!privateKey.trim()) {
          showToast("Please enter your private key", "warning");
          return;
        }

        const wallet = new ethers.Wallet(privateKey.trim());
        const newWallet = {
          address: wallet.address,
          name: walletName,
          balance: "0",
        };

        // Store encrypted private key
        await chrome.storage.local.set({
          [`wallet_${wallet.address}`]: {
            encryptedPrivateKey: wallet.privateKey,
            mnemonic: null,
          },
        });

        await addWallet(newWallet);
        showToast("Wallet imported successfully", "success");

        // Navigate directly to dashboard
        navigateToView("dashboard");
      }
    } catch (error) {
      console.error("Error importing wallet:", error);
      showToast("Invalid recovery phrase or private key", "error");
    }
    setIsImporting(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isImporting) {
      importWallet();
    }
  };

  return (
    <div className={styles.importWalletScreen}>
      <Header
        title="Import Wallet"
        showBack={true}
        onBack={() => navigateToView("welcome")}
      />

      <div className={styles.formContainer}>
        <div className={styles.importMethodTabs}>
          <button
            className={`${styles.tab} ${
              importMethod === "mnemonic" ? styles.active : ""
            }`}
            onClick={() => setImportMethod("mnemonic")}
          >
            Recovery Phrase
          </button>
          <button
            className={`${styles.tab} ${
              importMethod === "privateKey" ? styles.active : ""
            }`}
            onClick={() => setImportMethod("privateKey")}
          >
            Private Key
          </button>
        </div>

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

        {importMethod === "mnemonic" ? (
          <div className={styles.formGroup}>
            <label htmlFor="mnemonic">Recovery Phrase</label>
            <textarea
              id="mnemonic"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your 12 or 24 word recovery phrase"
              className={styles.formTextarea}
              rows={4}
            />
          </div>
        ) : (
          <div className={styles.formGroup}>
            <label htmlFor="privateKey">Private Key</label>
            <input
              type="password"
              id="privateKey"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your private key"
              className={styles.formInput}
            />
          </div>
        )}

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={importWallet}
          disabled={isImporting}
        >
          {isImporting ? "Importing..." : "Import Wallet"}
        </button>
      </div>
    </div>
  );
};

export default ImportWalletScreen;
