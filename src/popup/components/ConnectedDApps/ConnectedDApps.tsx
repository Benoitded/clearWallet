import React, { useState } from "react";
import {
  useDAppConnection,
  ConnectedSite,
} from "../../context/DAppConnectionContext";
import { useToast } from "../../hooks/useToast";
import styles from "./ConnectedDApps.module.scss";

interface ConnectedDAppsProps {
  onClose: () => void;
}

const ConnectedDApps: React.FC<ConnectedDAppsProps> = ({ onClose }) => {
  const { connectedSites, disconnectFromSite, disconnectFromAllSites } =
    useDAppConnection();
  const { showToast } = useToast();
  const [isDisconnectingAll, setIsDisconnectingAll] = useState(false);
  const [wcUri, setWcUri] = useState("");
  const [isConnectingWC, setIsConnectingWC] = useState(false);

  const handleDisconnect = async (url: string, name: string) => {
    try {
      await disconnectFromSite(url);
      showToast(`Disconnected from ${name}`, "success");
    } catch (error) {
      showToast("Error disconnecting from dApp", "error");
    }
  };

  const handleDisconnectAll = async () => {
    setIsDisconnectingAll(true);
    try {
      await disconnectFromAllSites();
      showToast("Disconnected from all dApps", "success");
      onClose();
    } catch (error) {
      showToast("Error disconnecting from all dApps", "error");
    }
    setIsDisconnectingAll(false);
  };

  const handleWalletConnectPair = async () => {
    if (!wcUri.trim()) {
      showToast("Please enter a WalletConnect URI", "error");
      return;
    }

    setIsConnectingWC(true);
    try {
      // Send WalletConnect pairing request to background
      const response = await chrome.runtime.sendMessage({
        type: "WALLETCONNECT_PAIR",
        data: { uri: wcUri.trim() },
      });

      if (response.success) {
        showToast("WalletConnect session established", "success");
        setWcUri("");
      } else {
        showToast(
          response.error || "Failed to connect via WalletConnect",
          "error"
        );
      }
    } catch (error) {
      showToast("Error connecting via WalletConnect", "error");
    }
    setIsConnectingWC(false);
  };

  const parseWalletConnectUri = (uri: string): boolean => {
    // Basic WalletConnect URI validation
    return uri.startsWith("wc:") && uri.includes("@") && uri.includes("?");
  };

  const formatLastUsed = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getDomainFromUrl = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Connected dApps</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* WalletConnect Section */}
          <div className={styles.walletConnectSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>🔗</span>
              <h3 className={styles.sectionTitle}>WalletConnect</h3>
            </div>
            <div className={styles.wcInputContainer}>
              <input
                type="text"
                placeholder="wc:abc123...@2?relay-protocol=irn&symKey=xyz..."
                value={wcUri}
                onChange={(e) => setWcUri(e.target.value)}
                className={styles.wcInput}
              />
              <button
                onClick={handleWalletConnectPair}
                disabled={
                  isConnectingWC ||
                  !wcUri.trim() ||
                  !parseWalletConnectUri(wcUri)
                }
                className={styles.wcConnectButton}
              >
                {isConnectingWC ? "Connecting..." : "Connect"}
              </button>
            </div>
            <p className={styles.wcDescription}>
              Paste a WalletConnect URI to connect to a dApp
            </p>
          </div>

          {/* Existing Connected Sites */}
          {connectedSites.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔗</div>
              <h3 className={styles.emptyTitle}>No connected dApps</h3>
              <p className={styles.emptyDescription}>
                When you connect to decentralized apps, they'll appear here.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIcon}>🌐</span>
                <h3 className={styles.sectionTitle}>Browser dApps</h3>
              </div>
              <div className={styles.sitesList}>
                {connectedSites
                  .sort((a, b) => b.lastUsed - a.lastUsed)
                  .map((site) => (
                    <div key={site.url} className={styles.siteItem}>
                      <div className={styles.siteInfo}>
                        <div className={styles.siteIcon}>
                          {site.icon ? (
                            <img
                              src={site.icon}
                              alt={site.name}
                              className={styles.siteImage}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <div className={styles.defaultIcon}>🌐</div>
                          )}
                        </div>
                        <div className={styles.siteDetails}>
                          <h4 className={styles.siteName}>{site.name}</h4>
                          <p className={styles.siteUrl}>
                            {getDomainFromUrl(site.url)}
                          </p>
                          <p className={styles.lastUsed}>
                            Last used: {formatLastUsed(site.lastUsed)}
                          </p>
                        </div>
                      </div>
                      <button
                        className={styles.disconnectButton}
                        onClick={() => handleDisconnect(site.url, site.name)}
                        title="Disconnect"
                      >
                        🔗💔
                      </button>
                    </div>
                  ))}
              </div>

              <div className={styles.footer}>
                <button
                  className={styles.disconnectAllButton}
                  onClick={handleDisconnectAll}
                  disabled={isDisconnectingAll}
                >
                  {isDisconnectingAll ? "Disconnecting..." : "Disconnect All"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectedDApps;
