// Background script entry point - simplified and working approach
console.log("ClearWallet: Background script starting...");

// Import the refactored services for advanced features
import { BackgroundService } from "./BackgroundService";

// Set up basic message listeners immediately (like the working version)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("ClearWallet: Received message:", message.type, message.data);

  // Handle the message and forward to the new architecture
  handleLegacyMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async responses
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("ClearWallet: Extension installed");
});

// Initialize the background service after setting up basic listeners
const backgroundService = BackgroundService.getInstance();
backgroundService
  .initialize()
  .then(() => {
    console.log("ClearWallet: Background service initialized successfully");
  })
  .catch((error) => {
    console.error(
      "ClearWallet: Background service initialization failed:",
      error
    );
  });

// Legacy message handler that works with the old content script format
async function handleLegacyMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  try {
    switch (message.type) {
      case "ETH_REQUEST":
        await handleEthRequest(message.data, sender, sendResponse);
        break;
      case "GET_ACCOUNTS":
        await handleGetAccounts(sendResponse);
        break;
      case "REQUEST_ACCOUNTS":
        await handleRequestAccounts(sendResponse);
        break;
      default:
        console.log("ClearWallet: Unknown message type:", message.type);
        sendResponse({ success: false, error: "Unknown message type" });
    }
  } catch (error) {
    console.error("ClearWallet: Error handling message:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function handleEthRequest(
  data: { method: string; params?: any[] },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  try {
    const { method, params = [] } = data;
    console.log(`ClearWallet: Handling ${method}`, params);

    switch (method) {
      case "eth_requestAccounts":
        const accounts = await getAccounts();
        if (accounts.length === 0) {
          // Open popup for user to create/import wallet
          chrome.action.openPopup();
          sendResponse({
            success: false,
            error: "User needs to set up wallet",
          });
          return;
        }
        sendResponse({ success: true, data: accounts });
        break;

      case "eth_accounts":
        const currentAccounts = await getAccounts();
        sendResponse({ success: true, data: currentAccounts });
        break;

      case "eth_chainId":
        sendResponse({ success: true, data: "0x1" }); // Ethereum mainnet
        break;

      case "net_version":
        sendResponse({ success: true, data: "1" }); // Ethereum mainnet
        break;

      default:
        sendResponse({
          success: false,
          error: `Unsupported method: ${method}`,
        });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function handleGetAccounts(sendResponse: (response: any) => void) {
  try {
    const accounts = await getAccounts();
    sendResponse({ success: true, data: accounts });
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
      chrome.action.openPopup();
      sendResponse({
        success: false,
        error: "User needs to set up wallet",
      });
      return;
    }

    sendResponse({ success: true, data: accounts });
  } catch (error) {
    sendResponse({
      success: false,
      error: "Failed to request accounts",
    });
  }
}

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

console.log("ClearWallet: Background script loaded");
