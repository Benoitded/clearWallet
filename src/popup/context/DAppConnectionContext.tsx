import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface ConnectedSite {
  url: string;
  name: string;
  icon?: string;
  connectedAt: number;
  lastUsed: number;
  permissions: string[];
  chainId: number;
  account: string;
  appearAsMetaMask?: boolean;
}

interface DAppConnectionContextType {
  connectedSites: ConnectedSite[];
  isConnectedTo: (url: string) => boolean;
  getConnectionForSite: (url: string) => ConnectedSite | undefined;
  connectToSite: (
    siteInfo: Omit<ConnectedSite, "connectedAt" | "lastUsed">
  ) => Promise<void>;
  disconnectFromSite: (url: string) => Promise<void>;
  disconnectFromAllSites: () => Promise<void>;
  updateLastUsed: (url: string) => Promise<void>;
}

const DAppConnectionContext = createContext<
  DAppConnectionContextType | undefined
>(undefined);

export const useDAppConnection = () => {
  const context = useContext(DAppConnectionContext);
  if (!context) {
    throw new Error(
      "useDAppConnection must be used within a DAppConnectionProvider"
    );
  }
  return context;
};

interface DAppConnectionProviderProps {
  children: ReactNode;
}

export const DAppConnectionProvider: React.FC<DAppConnectionProviderProps> = ({
  children,
}) => {
  const [connectedSites, setConnectedSites] = useState<ConnectedSite[]>([]);

  // Load connected sites from storage on mount
  useEffect(() => {
    const loadConnectedSites = async () => {
      try {
        const result = await chrome.storage.local.get(["connectedSites"]);
        if (result.connectedSites) {
          setConnectedSites(result.connectedSites);
        }
      } catch (error) {
        console.error("Error loading connected sites:", error);
      }
    };

    loadConnectedSites();
  }, []);

  // Save connected sites to storage whenever they change
  useEffect(() => {
    const saveConnectedSites = async () => {
      try {
        await chrome.storage.local.set({ connectedSites });
      } catch (error) {
        console.error("Error saving connected sites:", error);
      }
    };

    saveConnectedSites();
  }, [connectedSites]);

  const isConnectedTo = (url: string): boolean => {
    return connectedSites.some((site) => site.url === url);
  };

  const getConnectionForSite = (url: string): ConnectedSite | undefined => {
    return connectedSites.find((site) => site.url === url);
  };

  const connectToSite = async (
    siteInfo: Omit<ConnectedSite, "connectedAt" | "lastUsed">
  ): Promise<void> => {
    const now = Date.now();
    const newConnection: ConnectedSite = {
      ...siteInfo,
      connectedAt: now,
      lastUsed: now,
    };

    setConnectedSites((prev) => {
      // Remove existing connection if any
      const filtered = prev.filter((site) => site.url !== siteInfo.url);
      return [...filtered, newConnection];
    });
  };

  const disconnectFromSite = async (url: string): Promise<void> => {
    setConnectedSites((prev) => prev.filter((site) => site.url !== url));

    // Notify background script
    try {
      await chrome.runtime.sendMessage({
        type: "DISCONNECT_DAPP",
        data: { url },
      });
    } catch (error) {
      console.error("Error notifying background script:", error);
    }
  };

  const disconnectFromAllSites = async (): Promise<void> => {
    const allUrls = connectedSites.map((site) => site.url);
    setConnectedSites([]);

    // Notify all connected sites
    for (const url of allUrls) {
      try {
        const tabs = await chrome.tabs.query({ url: `${url}/*` });
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: "WALLET_DISCONNECTED",
                data: { url },
              })
              .catch(() => {
                // Ignore errors if content script is not available
              });
          }
        }
      } catch (error) {
        console.error("Error notifying disconnection:", error);
      }
    }
  };

  const updateLastUsed = async (url: string): Promise<void> => {
    setConnectedSites((prev) =>
      prev.map((site) =>
        site.url === url ? { ...site, lastUsed: Date.now() } : site
      )
    );
  };

  const value: DAppConnectionContextType = {
    connectedSites,
    isConnectedTo,
    getConnectionForSite,
    connectToSite,
    disconnectFromSite,
    disconnectFromAllSites,
    updateLastUsed,
  };

  return (
    <DAppConnectionContext.Provider value={value}>
      {children}
    </DAppConnectionContext.Provider>
  );
};
