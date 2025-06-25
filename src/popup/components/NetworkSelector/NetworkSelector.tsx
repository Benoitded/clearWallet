import React, { useState, useEffect, useRef } from "react";
import { useNetwork } from "../../context/NetworkContext";
import { RpcEndpoint } from "../../data/networks";
import styles from "./NetworkSelector.module.scss";

interface NetworkSelectorProps {
  className?: string;
}

interface RpcStatus {
  [url: string]: "online" | "offline" | "slow" | "checking";
}

const NetworkSelector: React.FC<NetworkSelectorProps> = ({ className }) => {
  const {
    selectedNetwork,
    selectedRpc,
    setSelectedNetwork,
    setSelectedRpc,
    networks,
    testRpcConnection,
  } = useNetwork();
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [showRpcDropdown, setShowRpcDropdown] = useState(false);
  const [rpcStatuses, setRpcStatuses] = useState<RpcStatus>({});

  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const rpcDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Test all RPC endpoints when component mounts or selectedNetwork changes
    if (selectedNetwork.rpc) {
      testAllRpcs();
    }
  }, [selectedNetwork]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        networkDropdownRef.current &&
        !networkDropdownRef.current.contains(event.target as Node)
      ) {
        setShowNetworkDropdown(false);
      }
      if (
        rpcDropdownRef.current &&
        !rpcDropdownRef.current.contains(event.target as Node)
      ) {
        setShowRpcDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const testAllRpcs = async () => {
    const newStatuses: RpcStatus = {};

    // Set all to checking first
    selectedNetwork.rpc.forEach((rpc) => {
      newStatuses[rpc.url] = "checking";
    });
    setRpcStatuses(newStatuses);

    // Test each RPC
    for (const rpc of selectedNetwork.rpc) {
      try {
        const result = await testRpcConnection(rpc.url);
        newStatuses[rpc.url] = result.status;
      } catch (error) {
        newStatuses[rpc.url] = "offline";
      }
      setRpcStatuses({ ...newStatuses });
    }
  };

  const getRpcStatusIndicator = (status: string) => {
    switch (status) {
      case "online":
        return "🟢";
      case "slow":
        return "🟡";
      case "offline":
        return "🔴";
      case "checking":
        return "⚫";
      default:
        return "⚫";
    }
  };

  return (
    <div className={`${styles.networkSelector} ${className || ""}`}>
      <label className={styles.label}>Network</label>
      <div className={styles.networkDropdownContainer} ref={networkDropdownRef}>
        <button
          className={styles.networkButton}
          onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
        >
          <span className={styles.networkIcon}>
            {selectedNetwork.image || "🌐"}
          </span>
          <span className={styles.networkName}>
            {selectedNetwork.name}
            {selectedNetwork.isTestnet && " (Testnet)"}
          </span>
          <span
            className={`${styles.dropdownArrow} ${
              showNetworkDropdown ? styles.open : ""
            }`}
          >
            ▼
          </span>
        </button>

        {showNetworkDropdown && (
          <div className={styles.networkDropdown}>
            {networks.map((network) => (
              <button
                key={network.id}
                className={`${styles.networkOption} ${
                  network.id === selectedNetwork.id ? styles.active : ""
                }`}
                onClick={() => {
                  setSelectedNetwork(network);
                  setShowNetworkDropdown(false);
                }}
              >
                <span className={styles.networkIcon}>
                  {network.image || "🌐"}
                </span>
                <span className={styles.networkName}>
                  {network.name}
                  {network.isTestnet && " (Testnet)"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedNetwork.rpc && selectedNetwork.rpc.length > 1 && (
        <div className={styles.rpcSelector}>
          <label className={styles.label}>RPC Endpoint</label>
          <div className={styles.rpcDropdownContainer} ref={rpcDropdownRef}>
            <button
              className={styles.rpcButton}
              onClick={() => setShowRpcDropdown(!showRpcDropdown)}
            >
              <span className={styles.rpcStatusIndicator}>
                {getRpcStatusIndicator(
                  rpcStatuses[selectedRpc.url] || "checking"
                )}
              </span>
              <span className={styles.rpcName}>{selectedRpc.name}</span>
              <span
                className={`${styles.dropdownArrow} ${
                  showRpcDropdown ? styles.open : ""
                }`}
              >
                ▼
              </span>
            </button>

            {showRpcDropdown && (
              <div className={styles.rpcDropdown}>
                {selectedNetwork.rpc.map((rpc) => (
                  <button
                    key={rpc.url}
                    className={`${styles.rpcOption} ${
                      rpc.url === selectedRpc.url ? styles.active : ""
                    }`}
                    onClick={() => {
                      setSelectedRpc(selectedNetwork.id, rpc);
                      setShowRpcDropdown(false);
                    }}
                  >
                    <span className={styles.rpcStatusIndicator}>
                      {getRpcStatusIndicator(
                        rpcStatuses[rpc.url] || "checking"
                      )}
                    </span>
                    <span className={styles.rpcName}>{rpc.name}</span>
                    <span className={styles.rpcStatus}>
                      {rpcStatuses[rpc.url] || "checking"}
                    </span>
                  </button>
                ))}
                <div className={styles.rpcRefresh}>
                  <button
                    className={styles.refreshButton}
                    onClick={testAllRpcs}
                  >
                    🔄 Test All RPCs
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkSelector;
