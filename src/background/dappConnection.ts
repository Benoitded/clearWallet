// Background script for handling dApp connection requests

interface DAppConnectionRequest {
  id: string;
  origin: string;
  siteName: string;
  siteIcon?: string;
  method: string;
  params?: any[];
  timestamp: number;
}

class DAppConnectionManager {
  private pendingRequests = new Map<string, DAppConnectionRequest>();
  private connectedSites = new Set<string>();

  async initialize() {
    // Load connected sites from storage and clean duplicates
    const result = await chrome.storage.local.get(["connectedSites"]);
    if (result.connectedSites) {
      // Remove duplicates based on URL
      const uniqueSites = result.connectedSites.reduce(
        (acc: any[], site: any) => {
          const existing = acc.find((s) => s.url === site.url);
          if (!existing) {
            acc.push(site);
          } else {
            // Keep the one with most recent lastUsed
            if (site.lastUsed > existing.lastUsed) {
              const index = acc.indexOf(existing);
              acc[index] = site;
            }
          }
          return acc;
        },
        []
      );

      // Save cleaned list back to storage if duplicates were found
      if (uniqueSites.length !== result.connectedSites.length) {
        await chrome.storage.local.set({ connectedSites: uniqueSites });
      }

      uniqueSites.forEach((site: any) => {
        this.connectedSites.add(site.url);
      });
    }

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });

    // Listen for popup opening to handle pending requests
    chrome.action.onClicked.addListener(() => {
      this.openPopupForPendingRequest();
    });
  }

  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) {
    const { type, data } = message;
    const origin =
      sender.origin || sender.url?.split("/").slice(0, 3).join("/") || "";

    if (!origin) {
      sendResponse({ error: "Invalid origin" });
      return;
    }

    switch (type) {
      case "ETH_REQUEST_ACCOUNTS":
      case "ETH_REQUEST":
        await this.handleEthRequest(origin, data, sendResponse);
        break;

      case "ETH_SEND_TRANSACTION":
        await this.handleTransactionRequest(origin, data, sendResponse);
        break;

      case "ETH_SIGN_MESSAGE":
        // TODO: Implement sign message functionality
        sendResponse({ error: "Sign message not implemented yet" });
        break;

      case "CHECK_CONNECTION":
        await this.handleCheckConnection(origin, sendResponse);
        break;

      case "CONNECTION_APPROVED":
        await this.approveConnection(
          data.requestId,
          data.account,
          data.chainId
        );
        sendResponse({ success: true });
        break;

      case "CONNECTION_REJECTED":
        await this.rejectConnection(data.requestId);
        sendResponse({ success: true });
        break;

      case "WALLETCONNECT_PAIR":
        await this.handleWalletConnectPair(data.uri, sendResponse);
        break;

      case "DISCONNECT_DAPP":
        await this.handleDisconnectDApp(data.url, sendResponse);
        break;

      case "CHAIN_CHANGED":
        await this.handleChainChanged(data.chainId, sendResponse);
        break;

      default:
        sendResponse({ error: "Unknown request type" });
    }
  }

  private async handleEthRequest(
    origin: string,
    data: any,
    sendResponse: (response?: any) => void
  ) {
    const { method, params } = data;

    switch (method) {
      case "eth_requestAccounts":
        await this.handleAccountsRequest(origin, data, sendResponse);
        break;

      default:
        // Handle other ETH methods here
        sendResponse({ error: `Method ${method} not implemented yet` });
    }
  }

  private async handleCheckConnection(
    origin: string,
    sendResponse: (response?: any) => void
  ) {
    // Check if already connected
    if (this.connectedSites.has(origin)) {
      const connectedSites = await this.getConnectedSites();
      const site = connectedSites.find((s: any) => s.url === origin);
      if (site) {
        sendResponse({
          connected: true,
          account: site.account,
          chainId: `0x${site.chainId.toString(16)}`,
        });
        return;
      }
    }

    sendResponse({ connected: false });
  }

  private async handleAccountsRequest(
    origin: string,
    data: any,
    sendResponse: (response?: any) => void
  ) {
    // Check if already connected
    if (this.connectedSites.has(origin)) {
      const connectedSites = await this.getConnectedSites();
      const site = connectedSites.find((s: any) => s.url === origin);
      if (site) {
        // Check if the current selected wallet is connected to this dApp
        const currentAccounts = await this.getCurrentSelectedAccount();
        const currentAccount =
          currentAccounts.length > 0 ? currentAccounts[0] : null;

        if (currentAccount) {
          // Check if current wallet is in the connected addresses for this site
          const connectionData = await chrome.storage.local.get([
            `dapp_${origin}`,
          ]);
          const dappConnection = connectionData[`dapp_${origin}`];

          if (
            dappConnection &&
            dappConnection.connectedAddresses?.includes(currentAccount)
          ) {
            // Current wallet is connected to this dApp
            sendResponse({
              accounts: [currentAccount],
              chainId: `0x${site.chainId.toString(16)}`,
            });
            return;
          }
        }

        // Fallback to original saved account if current wallet is not connected
        sendResponse({
          accounts: [site.account],
          chainId: `0x${site.chainId.toString(16)}`,
        });
        return;
      }
    }

    // Create connection request
    const requestId = `req_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const request: DAppConnectionRequest = {
      id: requestId,
      origin,
      siteName: data.siteName || new URL(origin).hostname,
      siteIcon: data.siteIcon,
      method: "eth_requestAccounts",
      timestamp: Date.now(),
    };

    this.pendingRequests.set(requestId, request);

    // Show connection popup
    await this.showConnectionPopup(request);

    // Store the sendResponse callback to call it later
    this.storePendingResponse(requestId, sendResponse);

    // Don't send a response immediately - we'll send it after approval/rejection
    // The callback will be called by approveConnection or rejectConnection
  }

  private async handleTransactionRequest(
    origin: string,
    data: any,
    sendResponse: (response?: any) => void
  ) {
    // Check if connected
    if (!this.connectedSites.has(origin)) {
      sendResponse({ error: "Not connected to this site" });
      return;
    }

    // Create transaction request
    const requestId = `tx_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Show transaction confirmation popup
    await this.showTransactionPopup(origin, data, requestId);

    this.storePendingResponse(requestId, sendResponse);
  }

  private async showConnectionPopup(request: DAppConnectionRequest) {
    // Store the connection request in app state
    await chrome.storage.local.set({
      appState: {
        currentScreen: "connect-dapp",
        connectDAppRequest: {
          requestId: request.id,
          siteUrl: request.origin,
          siteName: request.siteName,
          siteIcon: request.siteIcon,
        },
      },
    });

    // Open popup
    await chrome.action.openPopup();
  }

  private async showTransactionPopup(
    origin: string,
    txData: any,
    requestId: string
  ) {
    // Store transaction request
    await chrome.storage.local.set({
      pendingTransaction: {
        requestId,
        origin,
        txData,
        timestamp: Date.now(),
      },
    });

    // Open popup to send screen
    await chrome.storage.local.set({
      appState: {
        currentScreen: "send-eth",
        sendEthState: {
          recipientAddress: txData.to || "",
          amount: txData.value
            ? (parseInt(txData.value, 16) / 1e18).toString()
            : "",
          recipientName: "",
        },
      },
    });

    await chrome.action.openPopup();
  }

  private async approveConnection(
    requestId: string,
    account: string,
    chainId: number
  ) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    // Add to connected sites
    this.connectedSites.add(request.origin);

    // Update storage
    const connectedSites = await this.getConnectedSites();

    // Check if site is already connected to avoid duplicates
    const existingIndex = connectedSites.findIndex(
      (site: any) => site.url === request.origin
    );

    const newConnection = {
      url: request.origin,
      name: request.siteName,
      icon: request.siteIcon,
      connectedAt:
        existingIndex >= 0
          ? connectedSites[existingIndex].connectedAt
          : Date.now(),
      lastUsed: Date.now(),
      permissions: ["eth_accounts"],
      chainId,
      account,
    };

    if (existingIndex >= 0) {
      // Update existing connection
      connectedSites[existingIndex] = newConnection;
    } else {
      // Add new connection
      connectedSites.push(newConnection);
    }

    await chrome.storage.local.set({ connectedSites });

    // Also store connection in new format for easier access
    const dappConnectionKey = `dapp_${request.origin}`;
    const existingDappConnection = await chrome.storage.local.get([
      dappConnectionKey,
    ]);
    const dappConnection = existingDappConnection[dappConnectionKey] || {};

    // Initialize or update the connected addresses array
    if (!dappConnection.connectedAddresses) {
      dappConnection.connectedAddresses = [];
    }

    // Add the account if not already present
    if (!dappConnection.connectedAddresses.includes(account)) {
      dappConnection.connectedAddresses.push(account);
    }

    // Update connection data
    dappConnection.connected = true;
    dappConnection.chainId = chainId;
    dappConnection.lastUsed = Date.now();

    await chrome.storage.local.set({
      [dappConnectionKey]: dappConnection,
    });

    // Send response to content script
    const sendResponse = this.getPendingResponse(requestId);
    if (sendResponse) {
      sendResponse({
        accounts: [account],
        chainId: `0x${chainId.toString(16)}`,
      });
    }

    // Notify content script
    await this.notifyContentScript(request.origin, {
      type: "CONNECTION_SUCCESS",
      data: {
        account,
        chainId: `0x${chainId.toString(16)}`,
      },
    });

    this.pendingRequests.delete(requestId);
  }

  private async rejectConnection(requestId: string) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    // Send error response
    const sendResponse = this.getPendingResponse(requestId);
    if (sendResponse) {
      sendResponse({ error: "User rejected the request" });
    }

    this.pendingRequests.delete(requestId);
  }

  private async getConnectedSites() {
    const result = await chrome.storage.local.get(["connectedSites"]);
    return result.connectedSites || [];
  }

  private async getCurrentSelectedAccount(): Promise<string[]> {
    const result = await chrome.storage.local.get([
      "wallets",
      "selectedWallet",
    ]);
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

  private storePendingResponse(
    requestId: string,
    sendResponse: (response?: any) => void
  ) {
    // Store in a way that can be retrieved later
    // This is a simplified approach - in production you'd want more robust handling
    (globalThis as any).pendingResponses =
      (globalThis as any).pendingResponses || new Map();
    (globalThis as any).pendingResponses.set(requestId, sendResponse);
  }

  private getPendingResponse(requestId: string) {
    const responses = (globalThis as any).pendingResponses;
    const callback = responses?.get(requestId);
    if (callback) {
      responses.delete(requestId); // Clean up after use
    }
    return callback;
  }

  private async notifyContentScript(origin: string, message: any) {
    try {
      const tabs = await chrome.tabs.query({ url: `${origin}/*` });
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors if content script is not available
          });
        }
      }
    } catch (error) {
      console.error("Error notifying content script:", error);
    }
  }

  private async openPopupForPendingRequest() {
    if (this.pendingRequests.size > 0) {
      const request = Array.from(this.pendingRequests.values())[0];
      await this.showConnectionPopup(request);
    }
  }

  private async handleWalletConnectPair(
    uri: string,
    sendResponse: (response?: any) => void
  ) {
    try {
      // Basic URI validation
      if (!uri.startsWith("wc:") || !uri.includes("@") || !uri.includes("?")) {
        sendResponse({
          success: false,
          error: "Invalid WalletConnect URI format",
        });
        return;
      }

      // For now, we'll store the WalletConnect session info
      // In a real implementation, you'd use the WalletConnect SDK
      const wcSessionId = `wc_${Date.now()}`;

      // Parse the URI to extract session info
      const [protocol, rest] = uri.split(":");
      const [sessionId, version] = rest.split("@");
      const [versionNumber, params] = version.split("?");

      // Store WalletConnect session
      await chrome.storage.local.set({
        [`walletconnect_${wcSessionId}`]: {
          uri,
          sessionId,
          version: versionNumber,
          params,
          connectedAt: Date.now(),
          active: true,
        },
      });

      // Add to connected sites as a WalletConnect connection
      const connectedSites = await this.getConnectedSites();
      const wcConnection = {
        url: `walletconnect://${sessionId}`,
        name: "WalletConnect Session",
        icon: undefined,
        permissions: ["eth_accounts"],
        chainId: 1, // Default to mainnet
        account: "", // Will be set when wallet is selected
        connectedAt: Date.now(),
        lastUsed: Date.now(),
        isWalletConnect: true,
        wcSessionId,
      };

      connectedSites.push(wcConnection);
      await chrome.storage.local.set({ connectedSites });

      sendResponse({
        success: true,
        message: "WalletConnect session established",
        sessionId: wcSessionId,
      });
    } catch (error) {
      console.error("WalletConnect pairing error:", error);
      sendResponse({
        success: false,
        error: "Failed to establish WalletConnect session",
      });
    }
  }

  private async handleDisconnectDApp(
    url: string,
    sendResponse: (response?: any) => void
  ) {
    try {
      // Remove from connected sites
      this.connectedSites.delete(url);

      // Update storage
      const connectedSites = await this.getConnectedSites();
      const updatedSites = connectedSites.filter(
        (site: any) => site.url !== url
      );
      await chrome.storage.local.set({ connectedSites: updatedSites });

      // Notify content script about disconnection
      await this.notifyContentScript(url, {
        type: "WALLET_DISCONNECTED",
        data: {},
      });

      sendResponse({ success: true });
    } catch (error) {
      console.error("Error disconnecting dApp:", error);
      sendResponse({ error: "Failed to disconnect dApp" });
    }
  }

  private async handleChainChanged(
    chainId: number | string,
    sendResponse: (response?: any) => void
  ) {
    try {
      // Ensure chainId is a number and convert properly to hex
      let chainIdNumber: number;
      if (typeof chainId === "string") {
        // If it's already a hex string, parse it back to number
        chainIdNumber = chainId.startsWith("0x")
          ? parseInt(chainId, 16)
          : parseInt(chainId, 10);
      } else {
        chainIdNumber = chainId;
      }

      const chainIdHex = `0x${chainIdNumber.toString(16)}`;

      // Update all connected sites with new chain ID
      const connectedSites = await this.getConnectedSites();
      const updatedSites = connectedSites.map((site: any) => ({
        ...site,
        chainId: chainIdNumber,
        lastUsed: Date.now(),
      }));

      await chrome.storage.local.set({ connectedSites: updatedSites });

      // Notify all connected sites about chain change
      for (const site of connectedSites) {
        if (!site.url.startsWith("walletconnect://")) {
          await this.notifyContentScript(site.url, {
            type: "CHAIN_CHANGED",
            data: { chainId: chainIdHex },
          });
        }
      }

      sendResponse({ success: true });
    } catch (error) {
      console.error("Error handling chain change:", error);
      sendResponse({ error: "Failed to handle chain change" });
    }
  }
}

// Initialize the dApp connection manager
const dappManager = new DAppConnectionManager();
dappManager.initialize();

export default dappManager;
