import React, { useState, useEffect } from "react";
import { useWallet } from "../../context/WalletContext";
import { useNetwork } from "../../context/NetworkContext";
import { useDAppConnection } from "../../context/DAppConnectionContext";
import { useToast } from "../../hooks/useToast";
import { usePopupService } from "../../hooks/usePopupService";
import Header from "../Header";
import Dropdown from "../common/Dropdown";
import EthereumIcon from "../common/EthereumIcon";
import styles from "./ConnectDAppScreen.module.scss";

interface ConnectDAppScreenProps {
  siteUrl?: string;
  siteName?: string;
  siteIcon?: string;
}

const ConnectDAppScreen: React.FC<ConnectDAppScreenProps> = (props) => {
  const { wallets, selectedWallet } = useWallet();
  const { selectedNetwork } = useNetwork();
  const { connectToSite } = useDAppConnection();
  const { showToast } = useToast();
  const { navigateToView } = usePopupService();

  // Connection request data from appState
  const [connectionRequest, setConnectionRequest] = useState<{
    requestId: string;
    origin: string;
    siteName: string;
    siteIcon: string;
    tabId: number;
  } | null>(null);

  const [selectedAccount, setSelectedAccount] = useState(
    selectedWallet?.address || ""
  );
  const [isConnecting, setIsConnecting] = useState(false);

  // Load connection request from storage
  useEffect(() => {
    const loadConnectionRequest = async () => {
      try {
        const result = await chrome.storage.local.get(["appState"]);
        const connectDAppRequest = result.appState?.connectDAppRequest;

        if (connectDAppRequest) {
          setConnectionRequest(connectDAppRequest);
        } else if (props.siteUrl) {
          // Fallback to props if no request in storage
          setConnectionRequest({
            requestId: "",
            origin: props.siteUrl,
            siteName: props.siteName || new URL(props.siteUrl).hostname,
            siteIcon: props.siteIcon || "",
            tabId: 0,
          });
        }
      } catch (error) {
        console.error("Error loading connection request:", error);
        // Fallback to props
        if (props.siteUrl) {
          setConnectionRequest({
            requestId: "",
            origin: props.siteUrl,
            siteName: props.siteName || "Unknown Site",
            siteIcon: props.siteIcon || "",
            tabId: 0,
          });
        }
      }
    };

    loadConnectionRequest();
  }, [props.siteUrl, props.siteName, props.siteIcon]);

  useEffect(() => {
    if (selectedWallet) {
      setSelectedAccount(selectedWallet.address);
    }
  }, [selectedWallet]);

  if (!connectionRequest) {
    return (
      <div className={styles.connectDAppScreen}>
        <Header
          title="Connect to Dapp"
          showBack={true}
          onBack={() => navigateToView("dashboard")}
        />
        <div className={styles.content}>
          <div style={{ textAlign: "center", padding: "20px" }}>
            <p>No connection request found</p>
            <button onClick={() => navigateToView("dashboard")}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { requestId, origin, siteName, siteIcon } = connectionRequest;

  const handleReject = async () => {
    if (requestId) {
      // Notify background script of rejection
      chrome.runtime.sendMessage({
        type: "CONNECTION_REJECTED",
        data: { requestId },
      });
    }

    navigateToView("dashboard");
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
        url: origin,
        name: siteName,
        icon: siteIcon,
        permissions: ["eth_accounts"],
        chainId: selectedNetwork.chainId,
        account: selectedAccount,
      });

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

      // Navigate back to dashboard
      navigateToView("dashboard");

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
      <Header title="Connect to Dapp" showBack={true} onBack={handleReject} />

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
            <p className={styles.siteUrl}>{origin}</p>
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
