import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Network, RpcEndpoint, NETWORKS } from "../data/networks";

interface NetworkContextType {
  networks: Network[];
  selectedNetwork: Network;
  selectedRpc: RpcEndpoint;
  setSelectedNetwork: (network: Network, showNotification?: boolean) => void;
  setSelectedRpc: (
    networkId: string,
    rpc: RpcEndpoint,
    showNotification?: boolean
  ) => void;
  addCustomNetwork: (network: Network) => Promise<void>;
  addCustomRpc: (networkId: string, rpc: RpcEndpoint) => Promise<void>;
  updateCustomNetwork: (id: string, network: Network) => Promise<void>;
  deleteCustomNetwork: (id: string) => Promise<void>;
  testRpcConnection: (
    rpcUrl: string
  ) => Promise<{ status: "online" | "offline" | "slow"; latency?: number }>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [networks, setNetworks] = useState<Network[]>(NETWORKS);
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(NETWORKS[0]);
  const [selectedRpcs, setSelectedRpcs] = useState<{
    [networkId: string]: RpcEndpoint;
  }>({});
  const [selectedRpc, setSelectedRpc] = useState<RpcEndpoint>(
    NETWORKS[0].rpc[0]
  );

  useEffect(() => {
    const loadNetworks = async () => {
      try {
        const result = await chrome.storage.local.get([
          "customNetworks",
          "selectedNetwork",
          "selectedRpcs",
        ]);

        // Load custom networks
        if (result.customNetworks) {
          setNetworks([...NETWORKS, ...result.customNetworks]);
        }

        // Load selected RPCs
        if (result.selectedRpcs) {
          setSelectedRpcs(result.selectedRpcs);
        }

        // Load selected network
        if (result.selectedNetwork) {
          const allNetworks = [...NETWORKS, ...(result.customNetworks || [])];
          const found = allNetworks.find(
            (n) => n.id === result.selectedNetwork.id
          );
          if (found) {
            setSelectedNetwork(found);
            // Set selected RPC for this network
            const networkRpc = result.selectedRpcs?.[found.id] || found.rpc[0];
            setSelectedRpc(networkRpc);
          }
        } else {
          // Initialize with first network's first RPC
          const firstNetwork = NETWORKS[0];
          setSelectedNetwork(firstNetwork);
          setSelectedRpc(firstNetwork.rpc[0]);
        }
      } catch (error) {
        console.error("Error loading networks:", error);
      }
    };

    loadNetworks();
  }, []);

  const setSelectedNetworkAndSave = async (
    network: Network,
    showNotification = false
  ) => {
    const oldChainId = selectedNetwork.chainId;
    const newChainId = network.chainId;

    setSelectedNetwork(network);
    // Set the selected RPC for this network (use saved one or first available)
    const networkRpc = selectedRpcs[network.id] || network.rpc[0];
    setSelectedRpc(networkRpc);

    try {
      await chrome.storage.local.set({ selectedNetwork: network });

      // Notify background script about chain change if it actually changed
      if (oldChainId !== newChainId) {
        try {
          await chrome.runtime.sendMessage({
            type: "CHAIN_CHANGED",
            data: { chainId: newChainId },
          });
        } catch (error) {
          console.error("Error notifying chain change:", error);
        }
      }

      if (showNotification) {
        // Trigger a custom event for toast notification
        const event = new CustomEvent("networkChanged", {
          detail: { networkName: network.name },
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error("Error saving selected network:", error);
    }
  };

  const setSelectedRpcAndSave = async (
    networkId: string,
    rpc: RpcEndpoint,
    showNotification = false
  ) => {
    const updatedRpcs = { ...selectedRpcs, [networkId]: rpc };
    setSelectedRpcs(updatedRpcs);

    // If this is the current network, update selectedRpc
    if (selectedNetwork.id === networkId) {
      setSelectedRpc(rpc);
    }

    try {
      await chrome.storage.local.set({ selectedRpcs: updatedRpcs });

      if (showNotification) {
        // Trigger a custom event for toast notification
        const event = new CustomEvent("rpcChanged", {
          detail: { rpcName: rpc.name, networkName: selectedNetwork.name },
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error("Error saving selected RPC:", error);
    }
  };

  const addCustomNetwork = async (network: Network) => {
    try {
      const result = await chrome.storage.local.get(["customNetworks"]);
      const customNetworks = result.customNetworks || [];
      const newNetwork = { ...network, isCustom: true };
      const updatedCustomNetworks = [...customNetworks, newNetwork];

      await chrome.storage.local.set({ customNetworks: updatedCustomNetworks });
      setNetworks([...NETWORKS, ...updatedCustomNetworks]);
    } catch (error) {
      console.error("Error adding custom network:", error);
      throw error;
    }
  };

  const addCustomRpc = async (networkId: string, rpc: RpcEndpoint) => {
    try {
      const result = await chrome.storage.local.get(["customNetworks"]);
      const customNetworks = result.customNetworks || [];

      // Check if it's a built-in network
      const builtInNetwork = NETWORKS.find((n) => n.id === networkId);
      if (builtInNetwork) {
        // For built-in networks, we need to create a custom version with the new RPC
        const existingCustom = customNetworks.find(
          (n: Network) => n.id === networkId
        );
        if (existingCustom) {
          // Update existing custom network
          const updatedCustomNetworks = customNetworks.map((n: Network) =>
            n.id === networkId ? { ...n, rpc: [...n.rpc, rpc] } : n
          );
          await chrome.storage.local.set({
            customNetworks: updatedCustomNetworks,
          });
          setNetworks([...NETWORKS, ...updatedCustomNetworks]);
        } else {
          // Create new custom network based on built-in
          const newCustomNetwork = {
            ...builtInNetwork,
            rpc: [...builtInNetwork.rpc, rpc],
            isCustom: true,
          };
          const updatedCustomNetworks = [...customNetworks, newCustomNetwork];
          await chrome.storage.local.set({
            customNetworks: updatedCustomNetworks,
          });
          setNetworks([...NETWORKS, ...updatedCustomNetworks]);
        }
      } else {
        // It's already a custom network
        const updatedCustomNetworks = customNetworks.map((n: Network) =>
          n.id === networkId ? { ...n, rpc: [...n.rpc, rpc] } : n
        );
        await chrome.storage.local.set({
          customNetworks: updatedCustomNetworks,
        });
        setNetworks([...NETWORKS, ...updatedCustomNetworks]);
      }
    } catch (error) {
      console.error("Error adding custom RPC:", error);
      throw error;
    }
  };

  const updateCustomNetwork = async (id: string, network: Network) => {
    try {
      const result = await chrome.storage.local.get(["customNetworks"]);
      const customNetworks = result.customNetworks || [];
      const updatedCustomNetworks = customNetworks.map((n: Network) =>
        n.id === id ? { ...network, isCustom: true } : n
      );

      await chrome.storage.local.set({ customNetworks: updatedCustomNetworks });
      setNetworks([...NETWORKS, ...updatedCustomNetworks]);

      // Update selected network if it was the one being updated
      if (selectedNetwork.id === id) {
        const updatedNetwork = { ...network, isCustom: true };
        setSelectedNetwork(updatedNetwork);
        await chrome.storage.local.set({ selectedNetwork: updatedNetwork });
      }
    } catch (error) {
      console.error("Error updating custom network:", error);
      throw error;
    }
  };

  const deleteCustomNetwork = async (id: string) => {
    try {
      const result = await chrome.storage.local.get(["customNetworks"]);
      const customNetworks = result.customNetworks || [];
      const updatedCustomNetworks = customNetworks.filter(
        (n: Network) => n.id !== id
      );

      await chrome.storage.local.set({ customNetworks: updatedCustomNetworks });
      setNetworks([...NETWORKS, ...updatedCustomNetworks]);

      // If deleted network was selected, select mainnet
      if (selectedNetwork.id === id) {
        setSelectedNetwork(NETWORKS[0]);
        await chrome.storage.local.set({ selectedNetwork: NETWORKS[0] });
      }
    } catch (error) {
      console.error("Error deleting custom network:", error);
      throw error;
    }
  };

  const testRpcConnection = async (rpcUrl: string) => {
    const startTime = Date.now();
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          return {
            status: (latency > 2000 ? "slow" : "online") as "online" | "slow",
            latency,
          };
        }
      }

      return { status: "offline" as const };
    } catch (error) {
      return { status: "offline" as const };
    }
  };

  const testAllRpcsForNetwork = async (network: Network): Promise<void> => {
    // Test all RPCs in parallel using Promise.all for better performance
    const testPromises = network.rpc.map(async (rpc) => {
      const result = await testRpcConnection(rpc.url);
      return { rpc, result };
    });

    try {
      const results = await Promise.all(testPromises);

      // Process results and update status
      results.forEach(({ rpc, result }) => {
        const statusKey = `${network.id}_${rpc.name}`;
        const statusEmoji =
          result.status === "online"
            ? "🟢"
            : result.status === "slow"
            ? "🟡"
            : "🔴";

        // Store status in a way that components can access
        // For now, we'll use a simple notification
        console.log(
          `${rpc.name}: ${result.status}${
            result.latency ? ` (${result.latency}ms)` : ""
          }`
        );
      });
    } catch (error) {
      console.error("Error testing RPCs:", error);
    }
  };

  return (
    <NetworkContext.Provider
      value={{
        networks,
        selectedNetwork,
        selectedRpc,
        setSelectedNetwork: setSelectedNetworkAndSave,
        setSelectedRpc: setSelectedRpcAndSave,
        addCustomNetwork,
        addCustomRpc,
        updateCustomNetwork,
        deleteCustomNetwork,
        testRpcConnection,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};
