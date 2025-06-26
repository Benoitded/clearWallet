import React, { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import Header from "../Header";
import { useWallet } from "../../context/WalletContext";
import { useNetwork } from "../../context/NetworkContext";
import { useToast } from "../../hooks/useToast";
import { usePopupService } from "../../hooks/usePopupService";
import styles from "./SendEthScreen.module.scss";

type TransactionStatus =
  | "idle"
  | "preparing"
  | "estimating"
  | "signing"
  | "sending"
  | "pending"
  | "confirmed"
  | "failed";

interface GasInfo {
  gasPrice: string; // in wei
  gasLimit: string;
  estimatedCost: string; // in ETH
  estimatedCostWei: string; // in wei
}

const SendEthScreen: React.FC = () => {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TransactionStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [currentBalance, setCurrentBalance] = useState("0");
  const [gasInfo, setGasInfo] = useState<GasInfo | null>(null);
  const [recipientName, setRecipientName] = useState("");

  const { selectedWallet, wallets } = useWallet();
  const { selectedNetwork, selectedRpc } = useNetwork();
  const { showToast } = useToast();
  const { navigateToView } = usePopupService();

  // State for real-time block time calculation
  const [averageBlockTime, setAverageBlockTime] = useState<number>(12); // Default to 12 seconds

  // Load current balance
  useEffect(() => {
    if (selectedWallet && selectedRpc) {
      loadBalance();
    }
  }, [selectedWallet, selectedRpc]);

  // Calculate average block time
  useEffect(() => {
    const calculateAverageBlockTime = async () => {
      if (!selectedRpc) return;

      try {
        const provider = new ethers.JsonRpcProvider(selectedRpc.url);

        // Get current block number
        const currentBlockNumber = await provider.getBlockNumber();

        // Get last 3 blocks to avoid DRPC batch limit
        const blocks = [];
        for (let i = 0; i < 3; i++) {
          try {
            const block = await provider.getBlock(currentBlockNumber - i);
            if (block) {
              blocks.push(block);
            }
          } catch (error) {
            console.warn(
              `Failed to get block ${currentBlockNumber - i}:`,
              error
            );
          }
        }

        // Calculate time differences between consecutive blocks
        const timeDifferences = [];
        for (let i = 0; i < blocks.length - 1; i++) {
          if (blocks[i] && blocks[i + 1]) {
            const timeDiff = blocks[i]!.timestamp - blocks[i + 1]!.timestamp;
            timeDifferences.push(timeDiff);
          }
        }

        // Calculate average block time
        if (timeDifferences.length > 0) {
          const averageTime =
            timeDifferences.reduce((sum, time) => sum + time, 0) /
            timeDifferences.length;
          setAverageBlockTime(Math.max(averageTime, 1)); // Minimum 1 second
        }
      } catch (error) {
        console.error("Error calculating block time:", error);
        // Keep default value on error
      }
    };

    calculateAverageBlockTime();
  }, [selectedRpc]);

  // Check if recipient address is in our wallet list
  useEffect(() => {
    if (recipientAddress && ethers.isAddress(recipientAddress)) {
      const foundWallet = wallets.find(
        (w) => w.address.toLowerCase() === recipientAddress.toLowerCase()
      );
      setRecipientName(foundWallet ? foundWallet.name : "");
    } else {
      setRecipientName("");
    }
  }, [recipientAddress, wallets]);

  const loadBalance = async () => {
    if (!selectedWallet || !selectedRpc) return;

    try {
      const provider = new ethers.JsonRpcProvider(selectedRpc.url);
      const balance = await provider.getBalance(selectedWallet.address);
      setCurrentBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error("Error loading balance:", error);
    }
  };

  const getButtonText = (status: TransactionStatus): string => {
    switch (status) {
      case "idle":
        return "Send ETH";
      case "preparing":
        return "Preparing...";
      case "estimating":
        return "Estimating gas...";
      case "signing":
        return "Signing...";
      case "sending":
        return "Broadcasting...";
      case "pending":
        return "Pending...";
      case "confirmed":
        return "Send Another Transaction";
      case "failed":
        return "Try Again";
      default:
        return "Send ETH";
    }
  };

  const estimateGas = useCallback(async () => {
    if (!selectedWallet || !recipientAddress || !amount) return;

    try {
      // Don't change status to "estimating" to avoid re-render that causes focus loss
      const provider = new ethers.JsonRpcProvider(selectedRpc.url);

      // Check if amount is too high before estimating gas
      const balance = await provider.getBalance(selectedWallet.address);
      const amountWei = ethers.parseEther(amount);

      if (balance < amountWei) {
        console.log("Insufficient balance for amount, skipping gas estimation");
        setGasInfo(null);
        return;
      }

      const gasEstimate = await provider.estimateGas({
        to: recipientAddress,
        value: amountWei,
        from: selectedWallet.address,
      });

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
      const estimatedCostWei = gasEstimate * gasPrice;

      setGasInfo({
        gasPrice: gasPrice.toString(),
        gasLimit: gasEstimate.toString(),
        estimatedCost: ethers.formatEther(estimatedCostWei),
        estimatedCostWei: estimatedCostWei.toString(),
      });
    } catch (error) {
      console.error("Gas estimation failed:", error);
      setGasInfo(null);
    }
  }, [selectedWallet, recipientAddress, amount, selectedRpc.url]);

  const setMaxAmount = () => {
    if (!currentBalance) return;

    if (gasInfo) {
      // If we have gas info, subtract gas cost
      const balanceWei = ethers.parseEther(currentBalance);
      const gasCostWei = BigInt(gasInfo.estimatedCostWei);

      if (balanceWei > gasCostWei) {
        const maxAmount = balanceWei - gasCostWei;
        setAmount(ethers.formatEther(maxAmount));
      } else {
        showToast("Insufficient balance for gas fees", "warning");
      }
    } else {
      // If no gas info yet, just use full balance
      setAmount(currentBalance);
    }
  };

  const checkSufficientFunds = (): boolean => {
    if (!currentBalance || !amount || !gasInfo) return false;

    const balanceWei = ethers.parseEther(currentBalance);
    const amountWei = ethers.parseEther(amount);
    const gasCostWei = BigInt(gasInfo.estimatedCostWei);
    const totalCost = amountWei + gasCostWei;

    return balanceWei >= totalCost;
  };

  const sendTransaction = async () => {
    if (!selectedWallet || !recipientAddress || !amount) {
      showToast("Please fill in all fields", "warning");
      return;
    }

    if (!ethers.isAddress(recipientAddress)) {
      showToast("Please enter a valid Ethereum address", "error");
      return;
    }

    if (!gasInfo) {
      showToast("Please wait for gas estimation", "warning");
      return;
    }

    if (!checkSufficientFunds()) {
      showToast("Insufficient balance for transaction + gas fees", "error");
      return;
    }

    try {
      setTxStatus("preparing");
      setErrorDetails("");

      // Get the wallet's private key from storage
      const result = await chrome.storage.local.get([
        `wallet_${selectedWallet.address}`,
      ]);
      const walletData = result[`wallet_${selectedWallet.address}`];

      if (
        !walletData ||
        (!walletData.privateKey && !walletData.encryptedPrivateKey)
      ) {
        throw new Error("Wallet private key not found");
      }

      // Use the correct private key field
      const privateKey =
        walletData.privateKey || walletData.encryptedPrivateKey;
      const wallet = new ethers.Wallet(privateKey);

      // Verify wallet address matches
      if (
        wallet.address.toLowerCase() !== selectedWallet.address.toLowerCase()
      ) {
        throw new Error("Private key doesn't match selected wallet");
      }

      setTxStatus("estimating");

      // Connect to provider using selected network
      const provider = new ethers.JsonRpcProvider(selectedRpc.url);
      const connectedWallet = wallet.connect(provider);

      // Get current network info and validate
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== selectedNetwork.chainId) {
        throw new Error(
          `Network mismatch. Expected chainId ${selectedNetwork.chainId}, got ${network.chainId}`
        );
      }

      // Final balance check
      const balance = await provider.getBalance(selectedWallet.address);
      const amountWei = ethers.parseEther(amount);
      const gasCostWei = BigInt(gasInfo.estimatedCostWei);
      const totalCost = amountWei + gasCostWei;

      if (balance < totalCost) {
        throw new Error("Insufficient balance for transaction + gas fees");
      }

      setTxStatus("signing");

      // Create and sign transaction
      const transaction = {
        to: recipientAddress,
        value: amountWei,
        gasLimit: BigInt(gasInfo.gasLimit),
        gasPrice: BigInt(gasInfo.gasPrice),
      };

      setTxStatus("sending");

      // Send transaction with proper error handling
      const tx = await connectedWallet.sendTransaction(transaction);
      setTxHash(tx.hash);
      setTxStatus("pending");

      showToast("Transaction broadcasted!", "success");

      // Wait for confirmation with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Transaction timeout")), 60000)
      );

      try {
        const receipt = (await Promise.race([
          provider.waitForTransaction(tx.hash, 1, 60000),
          timeoutPromise,
        ])) as ethers.TransactionReceipt;

        if (receipt && receipt.status === 1) {
          setTxStatus("confirmed");
          showToast("Transaction confirmed!", "success");
          // Refresh balance after successful transaction
          loadBalance();
        } else {
          setTxStatus("failed");
          setErrorDetails("Transaction was reverted");
          showToast("Transaction failed", "error");
        }
      } catch (waitError) {
        console.warn(
          "Confirmation timeout, but transaction may still succeed:",
          waitError
        );
        showToast("Transaction sent, but confirmation timed out", "warning");
        // Still refresh balance as transaction might have succeeded
        loadBalance();
      }
    } catch (error: any) {
      console.error("Transaction failed:", error);
      setTxStatus("failed");
      setErrorDetails(error.message || "Unknown error occurred");
      showToast(`Transaction failed: ${error.message}`, "error");
    }
  };

  const resetTransaction = () => {
    setTxStatus("idle");
    setTxHash("");
    setErrorDetails("");
    setGasInfo(null);
    setRecipientAddress("");
    setAmount("");
    setRecipientName("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && txStatus === "idle") {
      sendTransaction();
    }
  };

  // Auto-estimate gas when fields change
  useEffect(() => {
    if (recipientAddress && amount && ethers.isAddress(recipientAddress)) {
      const timeoutId = setTimeout(estimateGas, 1000); // Longer delay to avoid too many calls
      return () => clearTimeout(timeoutId);
    } else {
      setGasInfo(null); // Clear gas info if fields are invalid
    }
  }, [recipientAddress, amount, estimateGas]);

  if (!selectedWallet) {
    return (
      <div className={styles.sendEthScreen}>
        <Header
          title="Send ETH"
          showBack={true}
          onBack={() => navigateToView("dashboard")}
        />
        <div className={styles.errorMessage}>No wallet selected</div>
      </div>
    );
  }

  const isProcessing =
    txStatus !== "idle" && txStatus !== "confirmed" && txStatus !== "failed";

  const hasSufficientFunds = gasInfo ? checkSufficientFunds() : true;

  return (
    <div className={styles.sendEthScreen}>
      <Header
        title="Send ETH"
        showBack={true}
        onBack={() => navigateToView("dashboard")}
      />

      <div className={styles.walletInfo}>
        <div className={styles.fromWallet}>
          <span className={styles.label}>From:</span>
          <span className={styles.walletName}>{selectedWallet.name}</span>
          <span className={styles.walletAddress}>
            {`${selectedWallet.address.slice(
              0,
              6
            )}...${selectedWallet.address.slice(-4)}`}
          </span>
        </div>
        <div className={styles.networkInfo}>
          <div className={styles.networkDetails}>
            <span className={styles.networkName}>
              {selectedNetwork.image && (
                <img
                  src={selectedNetwork.image}
                  alt={selectedNetwork.name}
                  className={styles.networkIcon}
                />
              )}
              {selectedNetwork.name}
            </span>
            <span className={styles.chainId}>
              Chain ID: {selectedNetwork.chainId}
            </span>
          </div>
          <div className={styles.rpcInfo}>
            <span className={styles.rpcLabel}>RPC:</span>
            <span className={styles.rpcName}>{selectedRpc.name}</span>
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.formGroup}>
          <label htmlFor="recipientAddress">
            Recipient Address
            {recipientName && (
              <span className={styles.recipientName}> → {recipientName}</span>
            )}
          </label>
          <input
            type="text"
            id="recipientAddress"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="0x..."
            className={styles.formInput}
            disabled={isProcessing}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="amount" className={styles.amountLabel}>
            <span>Amount (ETH)</span>
            <div className={styles.balanceInfo}>
              <span className={styles.balance}>
                Balance: {parseFloat(currentBalance).toFixed(6)} ETH
              </span>
              <button
                type="button"
                className={styles.maxButton}
                onClick={setMaxAmount}
                disabled={
                  isProcessing ||
                  !currentBalance ||
                  parseFloat(currentBalance) === 0
                }
              >
                MAX
              </button>
            </div>
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="0.0"
            step="0.0001"
            min="0"
            className={`${styles.formInput} ${
              !hasSufficientFunds && amount ? styles.insufficient : ""
            }`}
            disabled={isProcessing}
          />
          {!hasSufficientFunds && amount && gasInfo && (
            <div className={styles.warningMessage}>
              Insufficient balance for transaction + gas fees
            </div>
          )}
        </div>

        {gasInfo && (
          <div className={styles.gasInfo}>
            <div className={styles.gasHeader}>
              <span className={styles.gasTitle}>Network fee</span>
              <div className={styles.gasAmount}>
                <span className={styles.editIcon}>✏️</span>
                <span className={styles.gasCost}>
                  {parseFloat(gasInfo.estimatedCost).toFixed(6)}
                </span>
                <span className={styles.gasToken}>ETH</span>
                <span className={styles.gasUsd}>
                  ${(parseFloat(gasInfo.estimatedCost) * 2300).toFixed(2)}
                </span>
              </div>
            </div>
            <div className={styles.speedSection}>
              <div className={styles.speedRow}>
                <span className={styles.speedLabel}>Speed</span>
                <div className={styles.speedValue}>
                  <span>Standard</span>
                  <span className={styles.speedTime}>
                    ~{Math.round(averageBlockTime)} sec
                  </span>
                </div>
              </div>
              <div className={styles.maxFeeRow}>
                <span className={styles.maxFeeLabel}>Max fee</span>
                <span className={styles.maxFeeValue}>
                  {parseFloat(gasInfo.estimatedCost).toFixed(6)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <button
            className={`${styles.btn} ${styles.btnPrimary} ${
              isProcessing ? styles.processing : ""
            }`}
            onClick={
              txStatus === "confirmed" ? resetTransaction : sendTransaction
            }
            disabled={
              (txStatus === "idle" || txStatus === "failed") &&
              (!recipientAddress ||
                !amount ||
                !ethers.isAddress(recipientAddress) ||
                !hasSufficientFunds)
            }
          >
            {isProcessing && <span className={styles.spinner}>⏳</span>}
            {getButtonText(txStatus)}
          </button>
        </div>

        {/* Transaction Hash */}
        {txHash && (
          <div className={styles.txHashContainer}>
            <div className={styles.txHashLabel}>Transaction Hash:</div>
            <a
              href={`${selectedNetwork.blockExplorer}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.txHashLink}
            >
              {`${txHash.slice(0, 10)}...${txHash.slice(-8)}`}
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(txHash)}
              className={styles.copyButton}
            >
              📋
            </button>
          </div>
        )}

        {/* Error Details */}
        {errorDetails && (
          <div className={styles.errorDetails}>
            <div className={styles.errorTitle}>Error Details:</div>
            <div className={styles.errorMessage}>{errorDetails}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SendEthScreen;
