import React, { useState, useRef, useEffect } from "react";
import Header from "../Header";
import { useWallet } from "../../context/WalletContext";
import { useNetwork } from "../../context/NetworkContext";
import { useToast } from "../../hooks/useToast";
import { usePopupService } from "../../hooks/usePopupService";
import { Network, RpcEndpoint } from "../../data/networks";
import styles from "./SettingsScreen.module.scss";

const SettingsScreen: React.FC = () => {
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentView, setCurrentView] = useState<
    "main" | "addNetwork" | "editNetwork"
  >("main");
  const [editingNetwork, setEditingNetwork] = useState<Network | null>(null);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [rpcStatuses, setRpcStatuses] = useState<{
    [url: string]: { status: string; latency?: number };
  }>({});
  const [networkForm, setNetworkForm] = useState({
    name: "",
    rpcUrl: "",
    chainId: "",
    blockExplorer: "",
    image: "",
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { deleteAllWallets } = useWallet();
  const {
    selectedNetwork,
    selectedRpc,
    setSelectedNetwork,
    setSelectedRpc,
    networks,
    addCustomNetwork,
    updateCustomNetwork,
    deleteCustomNetwork,
    testRpcConnection,
  } = useNetwork();
  const { showToast } = useToast();
  const { navigateToView } = usePopupService();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowNetworkDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Test RPCs automatically when dropdown opens (only untested ones)
  useEffect(() => {
    if (showNetworkDropdown) {
      const testUntestedRpcs = async () => {
        const allRpcs: Array<{ url: string; name: string }> = [];

        networks.forEach((network) => {
          network.rpc.forEach((rpc) => {
            if (
              !rpcStatuses[rpc.url] &&
              !allRpcs.find((r) => r.url === rpc.url)
            ) {
              allRpcs.push(rpc);
            }
          });
        });

        // Test only untested RPCs in parallel
        if (allRpcs.length > 0) {
          const testPromises = allRpcs.map(async (rpc) => {
            try {
              const result = await testRpcConnection(rpc.url);
              return {
                url: rpc.url,
                status: result.status,
                latency: result.latency,
              };
            } catch (error) {
              return { url: rpc.url, status: "offline", latency: undefined };
            }
          });

          try {
            const results = await Promise.all(testPromises);
            const newStatuses: {
              [url: string]: { status: string; latency?: number };
            } = {};

            results.forEach((result) => {
              newStatuses[result.url] = {
                status: result.status,
                latency: result.latency,
              };
            });

            setRpcStatuses((prev) => ({ ...prev, ...newStatuses }));
          } catch (error) {
            console.error("Error testing untested RPCs:", error);
          }
        }
      };

      testUntestedRpcs();
    }
  }, [showNetworkDropdown, networks, testRpcConnection]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "#10b981"; // green
      case "slow":
        return "#f59e0b"; // orange
      case "offline":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  };

  const getStatusIndicator = (url: string) => {
    const rpcStatus = rpcStatuses[url];
    if (!rpcStatus) return <span style={{ color: "#6b7280" }}>⚫</span>;

    return (
      <span
        style={{
          color: getStatusColor(rpcStatus.status),
          fontSize: "8px",
          marginRight: "6px",
        }}
        title={`${rpcStatus.status}${
          rpcStatus.latency ? ` (${rpcStatus.latency}ms)` : ""
        }`}
      >
        ●
      </span>
    );
  };

  const handleShowMnemonic = async () => {
    if (!password) {
      showToast("Please enter your password", "warning");
      return;
    }

    setIsLoading(true);
    try {
      // Get stored wallet data
      const result = await chrome.storage.local.get();
      const walletKeys = Object.keys(result).filter((key) =>
        key.startsWith("wallet_")
      );

      if (walletKeys.length > 0) {
        const walletData = result[walletKeys[0]];
        if (walletData.mnemonic) {
          setMnemonic(walletData.mnemonic);
          setShowMnemonic(true);
        } else {
          showToast("No mnemonic found for this wallet", "warning");
        }
      } else {
        showToast("No wallets found", "warning");
      }
    } catch (error) {
      console.error("Error retrieving mnemonic:", error);
      showToast("Error retrieving mnemonic", "error");
    }
    setIsLoading(false);
  };

  const copyMnemonic = () => {
    navigator.clipboard.writeText(mnemonic);
    showToast("Mnemonic copied to clipboard!", "success");
  };

  const handleDeleteWallet = async () => {
    try {
      await deleteAllWallets();
      showToast("All wallets deleted successfully", "success");
      navigateToView("welcome");
    } catch (error) {
      showToast("Error deleting wallets", "error");
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    handleDeleteWallet();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleShowMnemonic();
    }
  };

  const handleDeleteCustomNetwork = async (networkId: string) => {
    try {
      await deleteCustomNetwork(networkId);
      showToast("Custom network deleted", "success");
    } catch (error) {
      showToast("Error deleting network", "error");
    }
  };

  const handleAddNetwork = async () => {
    try {
      const chainId = parseInt(networkForm.chainId);
      if (!networkForm.name || !networkForm.rpcUrl || isNaN(chainId)) {
        showToast("Please fill all required fields with valid data", "warning");
        return;
      }

      // Check for WebSocket URLs and reject them
      if (
        networkForm.rpcUrl.startsWith("wss://") ||
        networkForm.rpcUrl.startsWith("ws://")
      ) {
        showToast(
          "WebSocket URLs are not supported. Please use HTTP/HTTPS URLs only.",
          "error"
        );
        return;
      }

      const newNetwork: Network = {
        id: `custom_${Date.now()}`,
        name: networkForm.name,
        chainId: chainId,
        blockExplorer: networkForm.blockExplorer || "",
        image: networkForm.image || "🌐",
        rpc: [{ name: "Custom RPC", url: networkForm.rpcUrl }],
        isTestnet: chainId !== 1,
        isCustom: true,
      };

      await addCustomNetwork(newNetwork);
      showToast(`Added ${networkForm.name} network`, "success");
      setCurrentView("main");
      setNetworkForm({
        name: "",
        rpcUrl: "",
        chainId: "",
        blockExplorer: "",
        image: "",
      });
    } catch (error) {
      showToast("Error adding network", "error");
    }
  };

  const handleUpdateNetwork = async () => {
    if (!editingNetwork) return;

    try {
      const chainId = parseInt(networkForm.chainId);
      if (!networkForm.name || !networkForm.rpcUrl || isNaN(chainId)) {
        showToast("Please fill all required fields with valid data", "warning");
        return;
      }

      // Check for WebSocket URLs and reject them
      if (
        networkForm.rpcUrl.startsWith("wss://") ||
        networkForm.rpcUrl.startsWith("ws://")
      ) {
        showToast(
          "WebSocket URLs are not supported. Please use HTTP/HTTPS URLs only.",
          "error"
        );
        return;
      }

      const updatedNetwork: Network = {
        ...editingNetwork,
        name: networkForm.name,
        chainId: chainId,
        blockExplorer: networkForm.blockExplorer || "",
        image: networkForm.image || "🌐",
        rpc: [{ name: "Custom RPC", url: networkForm.rpcUrl }],
        isTestnet: chainId !== 1,
      };

      await updateCustomNetwork(editingNetwork.id, updatedNetwork);
      showToast(`Updated ${networkForm.name} network`, "success");
      setCurrentView("main");
      setEditingNetwork(null);
      setNetworkForm({
        name: "",
        rpcUrl: "",
        chainId: "",
        blockExplorer: "",
        image: "",
      });
    } catch (error) {
      showToast("Error updating network", "error");
    }
  };

  const mainnetNetworks = networks.filter((n) => !n.isTestnet);
  const testnetNetworks = networks.filter((n) => n.isTestnet);
  const customNetworks = networks.filter((n) => n.isCustom);

  if (currentView === "addNetwork") {
    return (
      <div className={styles.settingsScreen}>
        <Header
          title="Add Custom Network"
          showBack={true}
          onBack={() => setCurrentView("main")}
        />

        <div className={styles.content}>
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="networkName">Network Name *</label>
              <input
                type="text"
                id="networkName"
                value={networkForm.name}
                onChange={(e) =>
                  setNetworkForm({ ...networkForm, name: e.target.value })
                }
                placeholder="e.g. My Custom Network"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="chainId">Chain ID *</label>
              <input
                type="number"
                id="chainId"
                value={networkForm.chainId}
                onChange={(e) =>
                  setNetworkForm({ ...networkForm, chainId: e.target.value })
                }
                placeholder="1 for Ethereum Mainnet"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="rpcUrl">RPC URL *</label>
              <input
                type="url"
                id="rpcUrl"
                value={networkForm.rpcUrl}
                onChange={(e) =>
                  setNetworkForm({ ...networkForm, rpcUrl: e.target.value })
                }
                placeholder="https://your-rpc-url.com"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="blockExplorer">Block Explorer URL</label>
              <input
                type="url"
                id="blockExplorer"
                value={networkForm.blockExplorer}
                onChange={(e) =>
                  setNetworkForm({
                    ...networkForm,
                    blockExplorer: e.target.value,
                  })
                }
                placeholder="https://etherscan.io"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="image">Icon (emoji or URL)</label>
              <input
                type="text"
                id="image"
                value={networkForm.image}
                onChange={(e) =>
                  setNetworkForm({ ...networkForm, image: e.target.value })
                }
                placeholder="🌐"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formActions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleAddNetwork}
              >
                Add Network
              </button>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setCurrentView("main")}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "editNetwork") {
    return (
      <div className={styles.settingsScreen}>
        <Header
          title="Edit Custom Network"
          showBack={true}
          onBack={() => setCurrentView("main")}
        />

        <div className={styles.content}>
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="networkName">Network Name *</label>
              <input
                type="text"
                id="networkName"
                value={networkForm.name}
                onChange={(e) =>
                  setNetworkForm({ ...networkForm, name: e.target.value })
                }
                placeholder="e.g. My Custom Network"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="chainId">Chain ID *</label>
              <input
                type="number"
                id="chainId"
                value={networkForm.chainId}
                onChange={(e) =>
                  setNetworkForm({ ...networkForm, chainId: e.target.value })
                }
                placeholder="1 for Ethereum Mainnet"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="rpcUrl">RPC URL *</label>
              <input
                type="url"
                id="rpcUrl"
                value={networkForm.rpcUrl}
                onChange={(e) =>
                  setNetworkForm({ ...networkForm, rpcUrl: e.target.value })
                }
                placeholder="https://your-rpc-url.com"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="blockExplorer">Block Explorer URL</label>
              <input
                type="url"
                id="blockExplorer"
                value={networkForm.blockExplorer}
                onChange={(e) =>
                  setNetworkForm({
                    ...networkForm,
                    blockExplorer: e.target.value,
                  })
                }
                placeholder="https://etherscan.io"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="image">Icon (emoji or URL)</label>
              <input
                type="text"
                id="image"
                value={networkForm.image}
                onChange={(e) =>
                  setNetworkForm({ ...networkForm, image: e.target.value })
                }
                placeholder="🌐"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formActions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleUpdateNetwork}
              >
                Update Network
              </button>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setCurrentView("main")}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.settingsScreen}>
      <Header
        title="Settings"
        showBack={true}
        onBack={() => navigateToView("dashboard")}
      />

      <div className={styles.content}>
        {/* Network Selection Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Network & RPC Settings</h3>
            <button
              className={styles.testAllButton}
              onClick={async () => {
                // Test all RPCs in parallel with Promise.all
                const allRpcs: Array<{ url: string; name: string }> = [];

                networks.forEach((network) => {
                  network.rpc.forEach((rpc) => {
                    if (!allRpcs.find((r) => r.url === rpc.url)) {
                      allRpcs.push(rpc);
                    }
                  });
                });

                showToast("Testing all RPCs...", "info");

                // Test all RPCs in parallel for better performance
                const testPromises = allRpcs.map(async (rpc) => {
                  try {
                    const result = await testRpcConnection(rpc.url);
                    return {
                      url: rpc.url,
                      status: result.status,
                      latency: result.latency,
                    };
                  } catch (error) {
                    return {
                      url: rpc.url,
                      status: "offline",
                      latency: undefined,
                    };
                  }
                });

                try {
                  const results = await Promise.all(testPromises);
                  const newStatuses: {
                    [url: string]: { status: string; latency?: number };
                  } = {};

                  results.forEach((result) => {
                    newStatuses[result.url] = {
                      status: result.status,
                      latency: result.latency,
                    };
                  });

                  setRpcStatuses(newStatuses);
                  showToast("All RPCs tested!", "success");
                } catch (error) {
                  showToast("Error testing RPCs", "error");
                }
              }}
            >
              🔄 Test All RPCs
            </button>
          </div>
          <p className={styles.description}>
            Select the network and RPC endpoint you want to connect too
          </p>

          <div className={styles.currentNetwork}>
            <div className={styles.label}>Current Network:</div>
            <div ref={dropdownRef} className={styles.networkSelector}>
              <button
                className={styles.networkButton}
                onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
              >
                <div className={styles.networkDisplay}>
                  <span className={styles.networkIcon}>
                    {selectedNetwork.image || "🌐"}
                  </span>
                  <div className={styles.networkInfo}>
                    <span className={styles.networkName}>
                      {selectedNetwork.name}
                    </span>
                    <span className={styles.rpcName}>{selectedRpc.name}</span>
                  </div>
                </div>
                <span className={styles.dropdownArrow}>▼</span>
              </button>

              {showNetworkDropdown && (
                <div className={styles.networkDropdown}>
                  {/* Mainnet Networks */}
                  <div className={styles.networkGroup}>
                    <div className={styles.groupHeader}>Mainnet Networks</div>
                    {mainnetNetworks.map((network) => (
                      <div key={network.id} className={styles.networkItem}>
                        <div className={styles.networkHeader}>
                          <span className={styles.networkIcon}>
                            {network.image ? (
                              <img
                                src={network.image}
                                alt={network.name}
                                className={styles.networkIcon}
                              />
                            ) : (
                              "🌐"
                            )}
                          </span>
                          <span className={styles.networkName}>
                            {network.name}
                          </span>
                        </div>
                        <div className={styles.rpcList}>
                          {network.rpc.map((rpc) => (
                            <button
                              key={rpc.url}
                              className={`${styles.rpcOption} ${
                                selectedNetwork.id === network.id &&
                                selectedRpc.url === rpc.url
                                  ? styles.selected
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedNetwork(network, true);
                                setSelectedRpc(network.id, rpc, true);
                                setShowNetworkDropdown(false);
                              }}
                            >
                              <span className={styles.rpcName}>{rpc.name}</span>
                              <button
                                className={styles.testButton}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const result = await testRpcConnection(
                                    rpc.url
                                  );
                                  setRpcStatuses((prev) => ({
                                    ...prev,
                                    [rpc.url]: {
                                      status: result.status,
                                      latency: result.latency,
                                    },
                                  }));
                                  showToast(
                                    `${rpc.name}: ${result.status}${
                                      result.latency
                                        ? ` (${result.latency}ms)`
                                        : ""
                                    }`,
                                    result.status === "online"
                                      ? "success"
                                      : "error"
                                  );
                                }}
                              >
                                {getStatusIndicator(rpc.url)}
                                {rpcStatuses[rpc.url]?.latency
                                  ? `${rpcStatuses[rpc.url].latency}ms`
                                  : "Test"}
                              </button>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Testnet Networks */}
                  {testnetNetworks.length > 0 && (
                    <div className={styles.networkGroup}>
                      <div className={styles.groupHeader}>Testnet Networks</div>
                      {testnetNetworks.map((network) => (
                        <div key={network.id} className={styles.networkItem}>
                          <div className={styles.networkHeader}>
                            <span className={styles.networkIcon}>
                              {network.image ? (
                                <img
                                  src={network.image}
                                  alt={network.name}
                                  className={styles.networkIcon}
                                />
                              ) : (
                                "🧪"
                              )}
                            </span>
                            <span className={styles.networkName}>
                              {network.name}
                            </span>
                          </div>
                          <div className={styles.rpcList}>
                            {network.rpc.map((rpc) => (
                              <button
                                key={rpc.url}
                                className={`${styles.rpcOption} ${
                                  selectedNetwork.id === network.id &&
                                  selectedRpc.url === rpc.url
                                    ? styles.selected
                                    : ""
                                }`}
                                onClick={() => {
                                  setSelectedNetwork(network, true);
                                  setSelectedRpc(network.id, rpc, true);
                                  setShowNetworkDropdown(false);
                                }}
                              >
                                <span className={styles.rpcName}>
                                  {rpc.name}
                                </span>
                                <button
                                  className={styles.testButton}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const result = await testRpcConnection(
                                      rpc.url
                                    );
                                    setRpcStatuses((prev) => ({
                                      ...prev,
                                      [rpc.url]: {
                                        status: result.status,
                                        latency: result.latency,
                                      },
                                    }));
                                    showToast(
                                      `${rpc.name}: ${result.status}${
                                        result.latency
                                          ? ` (${result.latency}ms)`
                                          : ""
                                      }`,
                                      result.status === "online"
                                        ? "success"
                                        : "error"
                                    );
                                  }}
                                >
                                  {getStatusIndicator(rpc.url)}
                                  {rpcStatuses[rpc.url]?.latency
                                    ? `${rpcStatuses[rpc.url].latency}ms`
                                    : "Test"}
                                </button>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custom Networks Section */}
        <div className={styles.section}>
          <h3>Custom Networks</h3>
          <button
            className={styles.addNetworkButton}
            onClick={() => {
              setCurrentView("addNetwork");
              setNetworkForm({
                name: "",
                rpcUrl: "",
                chainId: "",
                blockExplorer: "",
                image: "",
              });
            }}
          >
            + Add Custom Network
          </button>

          {customNetworks.length > 0 && (
            <div className={styles.customNetworksList}>
              {customNetworks.map((network) => (
                <div key={network.id} className={styles.customNetworkItem}>
                  <div className={styles.networkInfo}>
                    <span className={styles.networkIcon}>
                      {network.image ? (
                        <img
                          src={network.image}
                          alt={network.name}
                          className={styles.networkIcon}
                        />
                      ) : (
                        "🌐"
                      )}
                    </span>
                    <div>
                      <div className={styles.networkName}>{network.name}</div>
                      <div className={styles.networkDetails}>
                        Chain ID: {network.chainId} • {network.rpc.length} RPC
                        {network.rpc.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div className={styles.networkActions}>
                    <button
                      onClick={() => {
                        setEditingNetwork(network);
                        setNetworkForm({
                          name: network.name,
                          rpcUrl: network.rpc[0]?.url || "",
                          chainId: network.chainId.toString(),
                          blockExplorer: network.blockExplorer,
                          image: network.image || "",
                        });
                        setCurrentView("editNetwork");
                      }}
                      className={styles.editBtn}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCustomNetwork(network.id)}
                      className={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connected DApps - TODO: Implement */}
        {/* <div className={styles.section}>
          <h3>Connected DApps</h3>
          <p className={styles.description}>
            DApp connection management coming soon...
          </p>
        </div> */}

        {/* MetaMask Compatibility */}
        <div className={styles.section}>
          <h3>Compatibility</h3>
          <div className={styles.metaMaskToggle}>
            <div className={styles.metaMaskInfo}>
              <span className={styles.metaMaskIcon}>🦊</span>
              <div className={styles.metaMaskDetails}>
                <span className={styles.metaMaskTitle}>Appear as MetaMask</span>
                <span className={styles.metaMaskDescription}>
                  Make ClearWallet appear as MetaMask to dApps for better
                  compatibility
                </span>
              </div>
            </div>
            <button
              className={`${styles.toggleButton} ${
                (function () {
                  const saved = localStorage.getItem(
                    "clearwallet_appear_as_metamask"
                  );
                  return saved !== null ? JSON.parse(saved) : true;
                })()
                  ? styles.toggleActive
                  : styles.toggleInactive
              }`}
              onClick={() => {
                const current = (function () {
                  const saved = localStorage.getItem(
                    "clearwallet_appear_as_metamask"
                  );
                  return saved !== null ? JSON.parse(saved) : true;
                })();
                const newValue = !current;
                localStorage.setItem(
                  "clearwallet_appear_as_metamask",
                  JSON.stringify(newValue)
                );
                // Force re-render
                setCurrentView(currentView);
                showToast(
                  `MetaMask compatibility ${newValue ? "enabled" : "disabled"}`,
                  "success"
                );
              }}
            >
              <span
                className={`${styles.toggleSlider} ${
                  (function () {
                    const saved = localStorage.getItem(
                      "clearwallet_appear_as_metamask"
                    );
                    return saved !== null ? JSON.parse(saved) : true;
                  })()
                    ? styles.sliderActive
                    : styles.sliderInactive
                }`}
              />
            </button>
          </div>
        </div>

        {/* Wallet Management */}
        <div className={styles.section}>
          <h3>Wallet Management</h3>

          <div className={styles.mnemonicSection}>
            <h4>Export Seed Phrase</h4>
            <p className={styles.description}>
              View your recovery phrase. Keep it safe and never share it.
            </p>

            {!showMnemonic ? (
              <div className={styles.passwordForm}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your password"
                  className={styles.formInput}
                />
                <button
                  onClick={handleShowMnemonic}
                  disabled={isLoading}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {isLoading ? "Loading..." : "Show Seed Phrase"}
                </button>
              </div>
            ) : (
              <div className={styles.mnemonicDisplay}>
                <div className={styles.mnemonicGrid}>
                  {mnemonic.split(" ").map((word, index) => (
                    <div key={index} className={styles.mnemonicWord}>
                      <span className={styles.wordIndex}>{index + 1}</span>
                      <span className={styles.word}>{word}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.mnemonicActions}>
                  <button
                    onClick={copyMnemonic}
                    className={`${styles.btn} ${styles.btnSecondary}`}
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setShowMnemonic(false)}
                    className={`${styles.btn} ${styles.btnSecondary}`}
                  >
                    Hide
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.dangerZone}>
            <h4>Danger Zone</h4>
            <p className={styles.description}>
              Permanently delete all wallets. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className={`${styles.btn} ${styles.btnDanger}`}
            >
              Delete All Wallets
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Delete All Wallets</h3>
            <p>
              Are you sure you want to delete all wallets? This action cannot be
              undone.
            </p>
            <div className={styles.modalActions}>
              <button
                onClick={confirmDelete}
                className={`${styles.btn} ${styles.btnDanger}`}
              >
                Yes, Delete All
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;
