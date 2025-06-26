// Background service worker for clearWallet Chrome extension
import {
  handleSwitchChain as chainHandleSwitchChain,
  handleAddChain as chainHandleAddChain,
} from "./chainHandlers";
import { NetworkUtils } from "../popup/data/networks";

// Wrapper functions that include dApp notification
export async function handleSwitchChain(
  chainParams: { chainId: string },
  sendResponse: (response: any) => void
) {
  // Call the actual handler
  await chainHandleSwitchChain(chainParams, async (response) => {
    // If successful (response is null), notify dApps
    if (response === null) {
      try {
        const chainIdNumber = NetworkUtils.parseChainId(chainParams.chainId);

        // Notify all connected dApps directly
        await notifyAllDAppsChainChanged(chainIdNumber);
      } catch (error) {
        console.error("ClearWallet Background: Error notifying DApps:", error);
      }
    }

    // Send response to caller
    sendResponse(response);
  });
}

export async function handleAddChain(
  chainParams: any,
  sendResponse: (response: any) => void
) {
  await chainHandleAddChain(chainParams, sendResponse);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("clearWallet extension installed");
});

// Track connected dApps
const connectedSites = new Set<string>();

async function initializeConnectedSites() {
  const result = await chrome.storage.local.get(["connectedSites"]);
  if (result.connectedSites) {
    result.connectedSites.forEach((site: any) => {
      connectedSites.add(site.url);
    });
  }
}

// Initialize on startup
initializeConnectedSites();

// Function to notify all connected dApps of chain change
async function notifyAllDAppsChainChanged(chainId: number) {
  try {
    console.log(
      "ClearWallet Background: Notifying all dApps of chain change",
      chainId
    );

    // Get all connected sites
    const result = await chrome.storage.local.get(["connectedSites"]);
    const connectedSitesList = result.connectedSites || [];

    // Get all open tabs
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      if (tab.id && tab.url) {
        try {
          const origin = new URL(tab.url).origin;

          // Check if this origin is connected
          const isConnected = connectedSitesList.some(
            (site: any) => site.url === origin
          );

          if (isConnected) {
            console.log(
              `ClearWallet Background: Notifying tab ${tab.id} (${origin}) of chain change`
            );

            // Send chain changed message to content script
            await chrome.tabs.sendMessage(tab.id, {
              type: "CHAIN_CHANGED",
              data: {
                chainId: NetworkUtils.chainIdToHex(chainId),
                chainIdNumber: chainId,
              },
            });
          }
        } catch (error) {
          // Tab might be closed or not responding, that's okay
          console.log(
            `ClearWallet Background: Could not notify tab ${tab.id}:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }
    }
  } catch (error) {
    console.error("ClearWallet Background: Error notifying dApps:", error);
  }
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(
    "ClearWallet Background: Received message",
    message.type,
    message
  );

  switch (message.type) {
    case "GET_WALLET_STATE":
      handleGetWalletState(sendResponse);
      return true;

    case "SIGN_TRANSACTION":
      handleSignTransaction(message.data, sendResponse);
      return true;

    case "GET_ACCOUNTS":
      handleGetAccounts(sendResponse);
      return true;

    case "REQUEST_ACCOUNTS":
      handleRequestAccounts(sendResponse);
      return true;

    case "WALLET_SWITCH_CHAIN":
      handleSwitchChain(message.data, sendResponse);
      return true;

    case "WALLET_ADD_CHAIN":
      handleAddChain(message.data, sendResponse);
      return true;

    // Handle dApp ETH requests
    case "ETH_REQUEST":
    case "ETH_REQUEST_ACCOUNTS":
      handleEthRequest(message.data, sender, sendResponse);
      return true;

    case "CHECK_CONNECTION":
      handleCheckConnection(sender, sendResponse);
      return true;

    default:
      console.log(
        "ClearWallet Background: Unknown message type:",
        message.type
      );
      sendResponse({ error: "Unknown request type" });
  }
});

async function handleGetWalletState(sendResponse: (response: any) => void) {
  try {
    const accounts = await getAccounts();
    const isConnected = accounts.length > 0;

    sendResponse({
      success: true,
      data: {
        isConnected,
        accounts,
        chainId: "0x1", // Ethereum mainnet
      },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: "Failed to get wallet state",
    });
  }
}

async function handleGetAccounts(sendResponse: (response: any) => void) {
  try {
    const accounts = await getAccounts();

    sendResponse({
      success: true,
      data: accounts,
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: "Failed to get accounts",
    });
  }
}

async function handleRequestAccounts(sendResponse: (response: any) => void) {
  try {
    const accounts = await getAccounts();

    if (accounts.length === 0) {
      // Open popup for user to create/import wallet
      chrome.action.openPopup();
      sendResponse({
        success: false,
        error: "User rejected the request",
      });
      return;
    }

    sendResponse({
      success: true,
      data: accounts,
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: "Failed to request accounts",
    });
  }
}

async function handleSignTransaction(
  transactionData: any,
  sendResponse: (response: any) => void
) {
  try {
    // In a real implementation, this would show a confirmation popup
    // For now, we'll just return success
    sendResponse({
      success: true,
      data: {
        signature: "0x" + "0".repeat(130), // Dummy signature
      },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: "Failed to sign transaction",
    });
  }
}

// Handle web3 provider requests from injected script
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "clearwallet-provider") {
    port.onMessage.addListener(async (message) => {
      const { id, method, params } = message;

      try {
        let result;

        switch (method) {
          case "eth_requestAccounts":
            const accountsResult = await getAccounts();
            result =
              accountsResult.length > 0
                ? accountsResult
                : await requestAccounts();
            break;

          case "eth_accounts":
            result = await getAccounts();
            break;

          case "eth_chainId":
            result = "0x1"; // Ethereum mainnet
            break;

          case "net_version":
            result = "1"; // Ethereum mainnet
            break;

          case "personal_sign":
          case "eth_sign":
            result = await signMessage(params);
            break;

          case "eth_sendTransaction":
            result = await sendTransaction(params[0]);
            break;

          default:
            throw new Error(`Unsupported method: ${method}`);
        }

        port.postMessage({
          id,
          result,
          error: null,
        });
      } catch (error) {
        port.postMessage({
          id,
          result: null,
          error: {
            code: -32000,
            message: (error as Error).message,
          },
        });
      }
    });
  }
});

async function getAccounts(): Promise<string[]> {
  const result = await chrome.storage.local.get(["wallets", "selectedWallet"]);
  const wallets = result.wallets || [];
  const selectedWallet = result.selectedWallet;

  if (wallets.length === 0) return [];

  // Use selected wallet if it exists and is valid, otherwise use first wallet
  if (
    selectedWallet &&
    wallets.find((w: any) => w.address === selectedWallet.address)
  ) {
    return [selectedWallet.address];
  }

  return [wallets[0].address];
}

async function requestAccounts(): Promise<string[]> {
  // In a real implementation, this would show the popup and wait for user action
  // For now, return empty array if no wallets exist
  return await getAccounts();
}

async function signMessage(params: any[]): Promise<string> {
  // In a real implementation, this would show a confirmation popup
  // For now, return a dummy signature
  return "0x" + "0".repeat(130);
}

async function sendTransaction(transactionParams: any): Promise<string> {
  // In a real implementation, this would handle the transaction
  // For now, return a dummy transaction hash
  return "0x" + "0".repeat(64);
}

async function handleEthRequest(
  data: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  const { method, params } = data;
  console.log("ClearWallet Background: handleEthRequest", method, params);

  try {
    switch (method) {
      case "eth_requestAccounts":
        const accounts = await getAccounts();
        if (accounts.length === 0) {
          sendResponse({ error: "No accounts found" });
        } else {
          // Add the origin to connected sites
          const origin =
            sender.origin || sender.url?.split("/").slice(0, 3).join("/");
          if (origin) {
            connectedSites.add(origin);

            // Save to storage
            const result = await chrome.storage.local.get(["connectedSites"]);
            const connectedSitesList = result.connectedSites || [];

            // Check if already exists
            const existingSite = connectedSitesList.find(
              (site: any) => site.url === origin
            );
            if (!existingSite) {
              const newSite = {
                url: origin,
                account: accounts[0],
                chainId: 1, // Default to mainnet
                lastUsed: Date.now(),
              };
              connectedSitesList.push(newSite);
              await chrome.storage.local.set({
                connectedSites: connectedSitesList,
              });
              console.log(
                "ClearWallet Background: Connected new dApp:",
                origin
              );
            }
          }

          sendResponse({ result: accounts });
        }
        break;

      case "eth_accounts":
        const currentAccounts = await getAccounts();
        sendResponse({ result: currentAccounts });
        break;

      case "eth_chainId":
        const result = await chrome.storage.local.get(["selectedNetwork"]);
        const selectedNetwork = result.selectedNetwork;
        const chainId = selectedNetwork
          ? NetworkUtils.chainIdToHex(selectedNetwork.chainId)
          : "0x1";
        sendResponse({ result: chainId });
        break;

      case "wallet_switchEthereumChain":
        if (!params || !params[0] || !params[0].chainId) {
          sendResponse({
            error: { code: 4001, message: "Invalid parameters" },
          });
          return;
        }

        console.log(
          "ClearWallet Background: Calling handleSwitchChain",
          params[0]
        );
        await handleSwitchChain(params[0], (response) => {
          console.log(
            "ClearWallet Background: Switch chain response",
            response
          );
          if (response === null) {
            sendResponse({ result: null });
          } else {
            sendResponse({ error: response.error || response });
          }
        });
        break;

      case "wallet_addEthereumChain":
        if (!params || !params[0]) {
          sendResponse({
            error: { code: 4001, message: "Invalid parameters" },
          });
          return;
        }

        await handleAddChain(params[0], (response) => {
          if (response === null) {
            sendResponse({ result: null });
          } else {
            sendResponse({ error: response.error || response });
          }
        });
        break;

      default:
        sendResponse({
          error: { code: 4200, message: `Method ${method} not supported` },
        });
    }
  } catch (error) {
    console.error("ClearWallet Background: Error in handleEthRequest", error);
    sendResponse({ error: { code: 4001, message: "Internal error" } });
  }
}

async function handleCheckConnection(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  try {
    const origin =
      sender.origin || sender.url?.split("/").slice(0, 3).join("/");
    if (!origin) {
      sendResponse({ connected: false });
      return;
    }

    // Check if origin is in connected sites
    const result = await chrome.storage.local.get(["connectedSites"]);
    const connectedSites = result.connectedSites || [];

    const connectedSite = connectedSites.find(
      (site: any) => site.url === origin
    );

    if (connectedSite) {
      const accounts = await getAccounts();
      const currentAccount = accounts.length > 0 ? accounts[0] : null;

      if (currentAccount) {
        const networkResult = await chrome.storage.local.get([
          "selectedNetwork",
        ]);
        const selectedNetwork = networkResult.selectedNetwork;
        const chainId = selectedNetwork
          ? NetworkUtils.chainIdToHex(selectedNetwork.chainId)
          : "0x1";

        sendResponse({
          connected: true,
          account: currentAccount,
          chainId: chainId,
        });
        return;
      }
    }

    sendResponse({ connected: false });
  } catch (error) {
    console.error("ClearWallet Background: Error checking connection", error);
    sendResponse({ connected: false });
  }
}
