import React, { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import Header from "../Header";
import ConnectionIndicator from "../ConnectionIndicator";
import ConnectedDApps from "../ConnectedDApps";
import { useWallet } from "../../context/WalletContext";
import { useNetwork } from "../../context/NetworkContext";
import { useDAppConnection } from "../../context/DAppConnectionContext";
import { useToast } from "../../hooks/useToast";
import { usePopupService } from "../../hooks/usePopupService";
import styles from "./WalletDashboard.module.scss";

const WalletDashboard: React.FC = () => {
  const [showWalletList, setShowWalletList] = useState(false);
  const [balance, setBalance] = useState("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [activeMenuWallet, setActiveMenuWallet] = useState<string | null>(null);
  const [isRenamingWallet, setIsRenamingWallet] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [walletBalances, setWalletBalances] = useState<{
    [address: string]: string;
  }>({});
  const [isLoadingWalletBalances, setIsLoadingWalletBalances] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [showConnectedDApps, setShowConnectedDApps] = useState(false);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [isLoadingBlock, setIsLoadingBlock] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<HTMLDivElement>(null);
  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const blockUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  const {
    wallets,
    selectedWallet,
    setSelectedWallet,
    addMultipleWalletsFromMnemonic,
    deleteWallet,
    renameWallet,
  } = useWallet();
  const { selectedNetwork, selectedRpc, setSelectedNetwork, networks } =
    useNetwork();
  const { connectedSites } = useDAppConnection();
  const { showToast } = useToast();
  const { navigateToView } = usePopupService();

  useEffect(() => {
    if (selectedWallet) {
      // Reset balance immediately when network/RPC changes to show loading state
      setBalance("0");
      setIsLoadingBalance(true);
      fetchBalance();
    }
  }, [selectedWallet, selectedNetwork, selectedRpc]);

  useEffect(() => {
    // Fetch block number immediately and then every 5 seconds
    fetchBlockNumber();
    blockUpdateInterval.current = setInterval(fetchBlockNumber, 5000);

    return () => {
      if (blockUpdateInterval.current) {
        clearInterval(blockUpdateInterval.current);
      }
    };
  }, [selectedNetwork, selectedRpc]);

  useEffect(() => {
    if (showWalletList && wallets.length > 0) {
      fetchAllWalletBalances();
    }
  }, [showWalletList, wallets, selectedNetwork]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Close wallet list dropdown
      if (
        walletDropdownRef.current &&
        !walletDropdownRef.current.contains(target)
      ) {
        setShowWalletList(false);
        setActiveMenuWallet(null);
        setIsRenamingWallet(null);
      }

      // Close network dropdown
      if (networkRef.current && !networkRef.current.contains(target)) {
        setShowNetworkDropdown(false);
      }

      // Close active menu wallet (when clicking outside any menu item)
      if (activeMenuWallet) {
        const menuDropdown = document.querySelector(`.${styles.menuDropdown}`);
        if (menuDropdown && !menuDropdown.contains(target)) {
          setActiveMenuWallet(null);
        }
      }

      // Close rename input when clicking outside
      if (isRenamingWallet) {
        const renameInput = document.querySelector(`.${styles.renameInput}`);
        if (renameInput && !renameInput.contains(target)) {
          setIsRenamingWallet(null);
          setRenameValue("");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMenuWallet, isRenamingWallet]);

  const fetchBalance = async () => {
    if (!selectedWallet) return;

    setIsLoadingBalance(true);
    try {
      // Use the selected RPC
      const provider = new ethers.JsonRpcProvider(selectedRpc.url);
      const balance = await provider.getBalance(selectedWallet.address);
      const formattedBalance = ethers.formatEther(balance);
      setBalance(parseFloat(formattedBalance).toFixed(4));
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance("0");
    }
    setIsLoadingBalance(false);
  };

  const fetchBlockNumber = async () => {
    setIsLoadingBlock(true);
    try {
      const provider = new ethers.JsonRpcProvider(selectedRpc.url);
      const blockNum = await provider.getBlockNumber();
      setBlockNumber(blockNum);
    } catch (error) {
      console.error("Error fetching block number:", error);
      setBlockNumber(null);
    }
    setIsLoadingBlock(false);
  };

  const copyAddress = (address?: string) => {
    const addressToCopy = address || selectedWallet?.address;
    if (addressToCopy) {
      navigator.clipboard.writeText(addressToCopy);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1000);
      setActiveMenuWallet(null);
      showToast("Address copied!", "success");
    }
  };

  const handleDeleteWallet = async (address: string) => {
    try {
      await deleteWallet(address);
      setActiveMenuWallet(null);
      showToast("Wallet deleted", "success");
    } catch (error) {
      showToast("Error deleting wallet", "error");
    }
  };

  const handleRename = (address: string, currentName: string) => {
    setIsRenamingWallet(address);
    setRenameValue(currentName);
    setActiveMenuWallet(null);
  };

  const handleRenameSubmit = async (address: string) => {
    try {
      await renameWallet(address, renameValue);
      setIsRenamingWallet(null);
      setRenameValue("");
      showToast("Wallet renamed", "success");
    } catch (error) {
      showToast("Error renaming wallet", "error");
    }
  };

  const handleRenameCancel = () => {
    setIsRenamingWallet(null);
    setRenameValue("");
  };

  const fetchAllWalletBalances = async () => {
    if (isLoadingWalletBalances) return;

    setIsLoadingWalletBalances(true);
    const balances: { [address: string]: string } = {};

    try {
      const provider = new ethers.JsonRpcProvider(selectedRpc.url);

      // Fetch balances sequentially to avoid DRPC batch limit issues
      // DRPC free tier doesn't allow more than 3 requests in batch
      for (const wallet of wallets) {
        try {
          const balance = await provider.getBalance(wallet.address);
          const formattedBalance = ethers.formatEther(balance);
          balances[wallet.address] = parseFloat(formattedBalance).toFixed(4);
        } catch (error) {
          console.error(`Error fetching balance for ${wallet.address}:`, error);
          balances[wallet.address] = "0";
        }
        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setWalletBalances(balances);
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
    }

    setIsLoadingWalletBalances(false);
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return "$0.00";

    // Simple conversion - in reality you'd want to fetch ETH price
    // For demo purposes, let's assume 1 ETH = $2000
    const usdValue = num * 2000;
    return `$${usdValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleAddWallet = async () => {
    if (selectedWallet) {
      // Check if this wallet has a mnemonic to derive more wallets
      try {
        const storage = await chrome.storage.local.get([
          `wallet_${selectedWallet.address}`,
        ]);
        const walletData = storage[`wallet_${selectedWallet.address}`];

        if (walletData?.mnemonic) {
          await addMultipleWalletsFromMnemonic(
            walletData.mnemonic,
            selectedWallet.name
          );
          showToast("New wallet added successfully", "success");
        } else {
          // No mnemonic, redirect to add wallet screen
          navigateToView("add-wallet");
        }
      } catch (error) {
        showToast("Error adding wallet", "error");
      }
    }
  };

  if (!selectedWallet) {
    return <div className={styles.loading}>Loading wallet...</div>;
  }

  return (
    <div className={styles.walletDashboard}>
      <Header
        showLogo={true}
        onLogoClick={() => navigateToView("dashboard")}
        rightElement={
          <div className={styles.headerActions}>
            <ConnectionIndicator />
            <button
              className={styles.settingsBtn}
              onClick={() => navigateToView("settings")}
              title="Settings"
            >
              ⚙️
            </button>
            <button
              className={styles.connectedDAppsButton}
              onClick={() => setShowConnectedDApps(true)}
              title={`Connected to ${connectedSites.length} dApp${
                connectedSites.length !== 1 ? "s" : ""
              }`}
            >
              <span className={styles.connectionIcon}>
                {connectedSites.length > 0 ? "🔗" : "🔗💔"}
              </span>
              <span className={styles.connectionCount}>
                {connectedSites.length}
              </span>
            </button>
            <button
              className={styles.walletSelector}
              onClick={() => setShowWalletList(!showWalletList)}
            >
              <span className={styles.walletName}>{selectedWallet.name}</span>
              <span className={styles.dropdownArrow}>▼</span>
            </button>
          </div>
        }
      />

      {showWalletList && (
        <div className={styles.walletListDropdown} ref={walletDropdownRef}>
          {wallets.map((w) => (
            <div
              key={w.address}
              className={`${styles.walletItem} ${
                w.address === selectedWallet.address ? styles.active : ""
              }`}
            >
              {isRenamingWallet === w.address ? (
                <div className={styles.renameInput}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRenameSubmit(w.address);
                      } else if (e.key === "Escape") {
                        handleRenameCancel();
                      }
                    }}
                    autoFocus
                    className={styles.renameField}
                  />
                  <div className={styles.renameActions}>
                    <button
                      onClick={() => handleRenameSubmit(w.address)}
                      className={styles.confirmBtn}
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleRenameCancel}
                      className={styles.cancelBtn}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className={styles.walletInfo}
                    onClick={() => {
                      setSelectedWallet(w);
                      setShowWalletList(false);
                    }}
                  >
                    <div className={styles.walletDetails}>
                      <span className={styles.walletItemName}>{w.name}</span>
                      <span className={styles.walletAddress}>
                        {formatAddress(w.address)}
                      </span>
                    </div>
                    <div className={styles.walletBalance}>
                      {isLoadingWalletBalances ? (
                        <span className={styles.loadingBalance}>...</span>
                      ) : (
                        <span className={styles.balanceValue}>
                          {formatBalance(walletBalances[w.address] || "0")}
                        </span>
                      )}
                    </div>
                  </button>

                  <div className={styles.walletMenu}>
                    <button
                      className={styles.menuToggle}
                      onClick={() =>
                        setActiveMenuWallet(
                          activeMenuWallet === w.address ? null : w.address
                        )
                      }
                    >
                      ⋮
                    </button>

                    {activeMenuWallet === w.address && (
                      <div className={styles.menuDropdown}>
                        <button
                          onClick={() => handleRename(w.address, w.name)}
                          className={styles.menuItem}
                        >
                          ✏️ Rename
                        </button>
                        <button
                          onClick={() => copyAddress(w.address)}
                          className={styles.menuItem}
                        >
                          📋 Copy Address
                        </button>
                        {wallets.length > 1 && (
                          <button
                            onClick={() => handleDeleteWallet(w.address)}
                            className={`${styles.menuItem} ${styles.danger}`}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          <div className={styles.dropdownFooter}>
            <button
              className={styles.addWalletButton}
              onClick={() => {
                setShowWalletList(false);
                handleAddWallet();
              }}
            >
              <span className={styles.addIcon}>+</span>
              Add Wallet
            </button>
          </div>
        </div>
      )}

      <div className={styles.balanceSection}>
        <div className={styles.balanceContainer}>
          <div className={styles.balanceLabel}>Your balancee</div>
          <div className={styles.balanceAmount}>
            {isLoadingBalance ? (
              <span className={styles.loadingText}>Loading...</span>
            ) : (
              <>
                <span className={styles.amount}>{balance}</span>
                <span className={styles.currency}>ETH</span>
              </>
            )}
          </div>
          {!isLoadingBalance && balance && (
            <div className={styles.balanceEur}>
              €
              {(parseFloat(balance) * 2300).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          )}
        </div>

        <div className={styles.addressContainer}>
          <div className={styles.addressLabel}>Wallet address</div>
          <button
            className={styles.addressButton}
            onClick={() => copyAddress()}
          >
            <span className={styles.address}>
              {formatAddress(selectedWallet.address)}
            </span>
            <span className={styles.copyIcon}>
              {copyFeedback ? "✅" : "📋"}
            </span>
          </button>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => navigateToView("send")}
        >
          Send ETH
        </button>
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={fetchBalance}
        >
          Refresh Balance
        </button>
      </div>

      <div className={styles.networkInfo} ref={networkRef}>
        <button
          className={styles.networkButton}
          onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
        >
          <div
            className={`${styles.networkIndicator} ${
              selectedNetwork.isTestnet ? styles.testnet : ""
            }`}
          ></div>
          <span className={styles.networkName}>
            {selectedNetwork?.name || "Ethereum Mainnet"}
          </span>
          <span className={styles.dropdownArrow}>▼</span>
        </button>

        <div className={styles.blockInfo}>
          {isLoadingBlock ? (
            <span className={styles.blockLoading}>⟲</span>
          ) : blockNumber ? (
            <a
              href={`${selectedNetwork.blockExplorer}/block/${blockNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.blockLink}
              title={`View block ${blockNumber} on explorer`}
            >
              #{blockNumber.toLocaleString()}
            </a>
          ) : (
            <span className={styles.blockError}>—</span>
          )}
        </div>

        {showNetworkDropdown && (
          <div className={styles.networkDropdown}>
            {networks.map((network) => (
              <button
                key={network.id}
                className={`${styles.networkItem} ${
                  network.id === selectedNetwork.id ? styles.active : ""
                }`}
                onClick={() => {
                  setSelectedNetwork(network, true);
                  setShowNetworkDropdown(false);
                }}
              >
                <div
                  className={`${styles.networkIndicator} ${
                    network.isTestnet ? styles.testnet : ""
                  }`}
                ></div>
                <span className={styles.networkItemName}>{network.name}</span>
                {network.isCustom && (
                  <span className={styles.customBadge}>Custom</span>
                )}
              </button>
            ))}
            <div className={styles.networkDropdownSeparator}></div>
            <button
              className={styles.settingsLink}
              onClick={() => {
                setShowNetworkDropdown(false);
                navigateToView("settings");
              }}
            >
              ⚙️ Manage Networks
            </button>
          </div>
        )}
      </div>

      {showConnectedDApps && (
        <ConnectedDApps onClose={() => setShowConnectedDApps(false)} />
      )}
    </div>
  );
};

export default WalletDashboard;
