// Background service worker for clearWallet Chrome extension
import "./dappConnection";

chrome.runtime.onInstalled.addListener(() => {
  console.log("clearWallet extension installed");
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "GET_WALLET_STATE":
      handleGetWalletState(sendResponse);
      return true; // Keep the message channel open for async response

    case "SIGN_TRANSACTION":
      handleSignTransaction(message.data, sendResponse);
      return true;

    case "GET_ACCOUNTS":
      handleGetAccounts(sendResponse);
      return true;

    case "REQUEST_ACCOUNTS":
      handleRequestAccounts(sendResponse);
      return true;

    default:
      console.log("Unknown message type:", message.type);
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
  // In a real implementation, this would:
  // 1. Show transaction confirmation popup
  // 2. Sign and broadcast the transaction
  // 3. Return the transaction hash

  // For now, return a dummy transaction hash
  return "0x" + "0".repeat(64);
}
