import React, { useState, useEffect } from "react";
import { useWallet } from "../../context/WalletContext";
import { useNetwork } from "../../context/NetworkContext";
import { useDAppConnection } from "../../context/DAppConnectionContext";
import { useToast } from "../../hooks/useToast";
import Header from "../Header";
import Dropdown from "../common/Dropdown";
import EthereumIcon from "../common/EthereumIcon";
import styles from "./ConnectDAppScreen.module.scss";

interface ConnectDAppScreenProps {
  onBack: () => void;
  siteUrl: string;
  siteName: string;
  siteIcon?: string;
  onConnect: (account: string, chainId: number) => void;
  onReject: () => void;
}

const ConnectDAppScreen: React.FC<ConnectDAppScreenProps> = ({
  onBack,
  siteUrl,
  siteName,
  siteIcon,
  onConnect,
  onReject,
}) => {
  const { wallets, selectedWallet } = useWallet();
  const { selectedNetwork } = useNetwork();
  const { connectToSite } = useDAppConnection();
  const { showToast } = useToast();

  const [selectedAccount, setSelectedAccount] = useState(
    selectedWallet?.address || ""
  );
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (selectedWallet) {
      setSelectedAccount(selectedWallet.address);
    }
  }, [selectedWallet]);

  const handleReject = async () => {
    // Get the connection request from app state to find the requestId
    const result = await chrome.storage.local.get(["appState"]);
    const requestId = result.appState?.connectDAppRequest?.requestId;

    if (requestId) {
      // Notify background script of rejection
      chrome.runtime.sendMessage({
        type: "CONNECTION_REJECTED",
        data: { requestId },
      });
    }

    onReject();
  };

  const handleConnect = async () => {
    if (!selectedAccount || !selectedNetwork) {
      showToast("Please select an account and network", "warning");
      return;
    }

    const wallet = wallets.find((w) => w.address === selectedAccount);
    if (!wallet) {
      showToast("Selected wallet not found", "error");
      return;
    }

    setIsConnecting(true);

    try {
      // Connect to the site
      await connectToSite({
        url: siteUrl,
        name: siteName,
        icon: siteIcon,
        permissions: ["eth_accounts"],
        chainId: selectedNetwork.chainId,
        account: selectedAccount,
      });

      // Get the connection request from app state to find the requestId
      const result = await chrome.storage.local.get(["appState"]);
      const requestId = result.appState?.connectDAppRequest?.requestId;

      if (requestId) {
        // Notify background script of approval
        chrome.runtime.sendMessage({
          type: "CONNECTION_APPROVED",
          data: {
            requestId,
            account: selectedAccount,
            chainId: selectedNetwork.chainId,
          },
        });
      }

      // Update selected wallet if different
      // TODO: Add selectWallet function to WalletContext
      // if (selectedWallet?.address !== selectedAccount) {
      //   selectWallet(wallet);
      // }

      // Notify parent component
      onConnect(selectedAccount, selectedNetwork.chainId);

      showToast(`Connected to ${siteName}`, "success");
    } catch (error) {
      console.error("Error connecting to dApp:", error);
      showToast("Failed to connect to dApp", "error");
    } finally {
      setIsConnecting(false);
    }
  };

  const walletOptions = wallets.map((wallet) => ({
    id: wallet.address,
    label: wallet.name,
    description: `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`,
    icon: "👛",
  }));

  const selectedWalletOption = walletOptions.find(
    (opt) => opt.id === selectedAccount
  );

  return (
    <div className={styles.connectDAppScreen}>
      <Header title="Connect to Dapp" showBack={true} onBack={onBack} />

      <div className={styles.content}>
        <div className={styles.siteInfo}>
          <div className={styles.siteIcon}>
            {siteIcon ? (
              <img src={siteIcon} alt={siteName} className={styles.iconImage} />
            ) : (
              <div className={styles.defaultIcon}>
                <EthereumIcon size={32} />
              </div>
            )}
          </div>
          <div className={styles.siteDetails}>
            <h2 className={styles.siteName}>{siteName}</h2>
            <p className={styles.siteUrl}>{siteUrl}</p>
          </div>
        </div>

        <div className={styles.requestInfo}>
          <div className={styles.requestIcon}>📡</div>
          <h3 className={styles.requestTitle}>Use your enabled networks</h3>
          <p className={styles.requestDescription}>Requested now for</p>
          <div className={styles.networkBadge}>
            <span className={styles.networkIcon}>⚪</span>
            <span className={styles.networkName}>{selectedNetwork?.name}</span>
          </div>
        </div>

        <div className={styles.accountSelection}>
          <div className={styles.accountHeader}>
            <span className={styles.accountLabel}>Connect Address</span>
          </div>

          <Dropdown
            trigger={
              <div className={styles.accountDropdownTrigger}>
                <div className={styles.accountInfo}>
                  <span className={styles.accountIcon}>👛</span>
                  <div className={styles.accountDetails}>
                    <span className={styles.accountName}>
                      {selectedWalletOption?.label || "Select Account"}
                    </span>
                    <span className={styles.accountAddress}>
                      {selectedAccount
                        ? `${selectedAccount.slice(
                            0,
                            6
                          )}...${selectedAccount.slice(-4)}`
                        : "No account selected"}
                    </span>
                  </div>
                </div>
                <span className={styles.dropdownArrow}>▼</span>
              </div>
            }
            options={walletOptions}
            selectedValue={selectedAccount}
            onSelect={(option) => setSelectedAccount(option.id)}
            position="center"
          />
        </div>

        <div className={styles.warningMessage}>
          Only connect with sites you trust.{" "}
          <a href="#" className={styles.learnMoreLink}>
            Learn more
          </a>
        </div>

        <div className={styles.actionButtons}>
          <button
            className={styles.cancelButton}
            onClick={handleReject}
            disabled={isConnecting}
          >
            Cancel
          </button>
          <button
            className={styles.connectButton}
            onClick={handleConnect}
            disabled={isConnecting || !selectedAccount}
          >
            {isConnecting ? (
              <>
                <span className={styles.spinner}>⏳</span>
                Connecting...
              </>
            ) : (
              "Connect"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectDAppScreen;
