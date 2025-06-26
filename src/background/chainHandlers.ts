// Chain handling functions shared between background and dappConnection
import { NETWORKS, NetworkUtils } from "../popup/data/networks";

export async function handleSwitchChain(
  chainParams: { chainId: string },
  sendResponse: (response: any) => void
) {
  try {
    console.log(
      "ClearWallet Background: handleSwitchChain called",
      chainParams
    );

    // Parse chainId using utility function
    const chainIdNumber = NetworkUtils.parseChainId(chainParams.chainId);

    if (isNaN(chainIdNumber)) {
      console.log(
        "ClearWallet Background: Invalid chain ID",
        chainParams.chainId
      );
      sendResponse({ error: { code: 4001, message: "Invalid chain ID" } });
      return;
    }

    console.log("ClearWallet Background: Parsed chainId", chainIdNumber);

    // Get current network and custom networks
    const result = await chrome.storage.local.get([
      "selectedNetwork",
      "customNetworks",
    ]);
    const currentNetwork = result.selectedNetwork;
    const customNetworks = result.customNetworks || [];

    // Find target network using utility function
    const targetNetwork = NetworkUtils.findByChainId(
      chainIdNumber,
      customNetworks
    );

    if (!targetNetwork) {
      console.log(
        "ClearWallet Background: Chain not found",
        chainIdNumber,
        "Available:",
        [...NETWORKS, ...customNetworks].map((n: any) => n.chainId)
      );
      sendResponse({
        error: {
          code: 4902,
          message: `Unrecognized chain ID "${chainParams.chainId}". Try adding the chain using wallet_addEthereumChain first.`,
        },
      });
      return;
    }

    // Check if already on target network
    if (currentNetwork && currentNetwork.chainId === chainIdNumber) {
      console.log("ClearWallet Background: Already on target network");
      sendResponse(null); // EIP-3326: Return null for success
      return;
    }

    // Switch to the target network
    await chrome.storage.local.set({ selectedNetwork: targetNetwork });

    console.log(
      `ClearWallet Background: Successfully switched to ${targetNetwork.name} (${chainParams.chainId})`
    );

    // Return null for success as per EIP-3326
    sendResponse(null);
  } catch (error) {
    console.error("ClearWallet Background: Error in handleSwitchChain:", error);
    sendResponse({
      error: {
        code: 4001,
        message: "Failed to switch chain",
      },
    });
  }
}

export async function handleAddChain(
  chainParams: any,
  sendResponse: (response: any) => void
) {
  try {
    // Validate required parameters
    if (
      !chainParams.chainId ||
      !chainParams.chainName ||
      !chainParams.rpcUrls
    ) {
      sendResponse({
        error: {
          code: 4001,
          message:
            "Missing required chain parameters (chainId, chainName, rpcUrls)",
        },
      });
      return;
    }

    // Parse chainId using utility function
    const chainIdNumber = NetworkUtils.parseChainId(chainParams.chainId);

    if (isNaN(chainIdNumber)) {
      sendResponse({
        error: {
          code: 4001,
          message: "Invalid chain ID",
        },
      });
      return;
    }

    // Check if it's a built-in network
    if (NetworkUtils.isBuiltInNetwork(chainIdNumber)) {
      console.log(
        "ClearWallet Background: Chain already exists as built-in network"
      );
      sendResponse(null); // EIP-3085: Return null if chain already exists
      return;
    }

    // Get existing custom networks
    const result = await chrome.storage.local.get(["customNetworks"]);
    const customNetworks = result.customNetworks || [];

    // Check if custom network already exists
    const existingNetwork = NetworkUtils.findByChainId(
      chainIdNumber,
      customNetworks
    );

    if (existingNetwork) {
      console.log("ClearWallet Background: Custom chain already exists");
      sendResponse(null); // EIP-3085: Return null if chain already exists
      return;
    }

    // Create new network object
    const newNetwork = {
      id: `custom-${chainIdNumber}`,
      name: chainParams.chainName,
      chainId: chainIdNumber,
      blockExplorer: chainParams.blockExplorerUrls?.[0] || "",
      rpc: [
        {
          name: "Default",
          url: chainParams.rpcUrls[0],
        },
      ],
      isTestnet: chainIdNumber !== 1 && chainIdNumber !== 8453, // Assume non-mainnet chains are testnets
      isCustom: true,
    };

    // Add to custom networks
    const updatedCustomNetworks = [...customNetworks, newNetwork];
    await chrome.storage.local.set({ customNetworks: updatedCustomNetworks });

    console.log(
      `ClearWallet Background: Successfully added ${chainParams.chainName} (${chainParams.chainId})`
    );

    // EIP-3085: Return null for success
    sendResponse(null);
  } catch (error) {
    console.error("ClearWallet Background: Error in handleAddChain:", error);
    sendResponse({
      error: {
        code: 4001,
        message: "Failed to add chain",
      },
    });
  }
}
