import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type AppScreen =
  | "welcome"
  | "create-wallet"
  | "import-wallet"
  | "add-wallet"
  | "dashboard"
  | "send-eth"
  | "settings"
  | "connect-dapp";

interface SendEthState {
  recipientAddress: string;
  amount: string;
  recipientName: string;
}

interface AppState {
  currentScreen: AppScreen;
  sendEthState: SendEthState;
  connectDAppRequest?: {
    siteUrl: string;
    siteName: string;
    siteIcon?: string;
  };
}

interface AppStateContextType {
  appState: AppState;
  setCurrentScreen: (screen: AppScreen) => void;
  setSendEthState: (state: Partial<SendEthState>) => void;
  setConnectDAppRequest: (request: AppState["connectDAppRequest"]) => void;
  resetAppState: () => void;
}

const defaultAppState: AppState = {
  currentScreen: "dashboard",
  sendEthState: {
    recipientAddress: "",
    amount: "",
    recipientName: "",
  },
};

const AppStateContext = createContext<AppStateContextType | undefined>(
  undefined
);

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
};

interface AppStateProviderProps {
  children: ReactNode;
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({
  children,
}) => {
  const [appState, setAppState] = useState<AppState>(defaultAppState);

  // Load app state from storage on mount
  useEffect(() => {
    const loadAppState = async () => {
      try {
        // Load from both Chrome storage and localStorage
        const [chromeResult, localStorageScreen] = await Promise.all([
          chrome.storage.local.get(["appState"]),
          Promise.resolve(localStorage.getItem("clearwallet_current_screen")),
        ]);

        if (chromeResult.appState) {
          const savedState = chromeResult.appState;
          const shouldRestoreScreen =
            savedState.currentScreen === "connect-dapp" ||
            savedState.connectDAppRequest;

          // Use localStorage for current screen if available, otherwise use Chrome storage logic
          const currentScreen =
            localStorageScreen && !shouldRestoreScreen
              ? (localStorageScreen as AppScreen)
              : shouldRestoreScreen
              ? savedState.currentScreen
              : "dashboard";

          setAppState((prev) => ({
            ...defaultAppState,
            currentScreen,
            // Always restore form data
            sendEthState: {
              ...defaultAppState.sendEthState,
              ...savedState.sendEthState,
            },
            // Restore dApp connection requests
            connectDAppRequest: savedState.connectDAppRequest,
          }));
        } else if (localStorageScreen) {
          // If no Chrome storage but localStorage exists
          setAppState((prev) => ({
            ...prev,
            currentScreen: localStorageScreen as AppScreen,
          }));
        }
      } catch (error) {
        console.error("Error loading app state:", error);
      }
    };

    loadAppState();
  }, []);

  // Save app state to storage whenever it changes
  useEffect(() => {
    const saveAppState = async () => {
      try {
        await chrome.storage.local.set({ appState });
      } catch (error) {
        console.error("Error saving app state:", error);
      }
    };

    // Don't save default state immediately
    if (appState !== defaultAppState) {
      saveAppState();
    }
  }, [appState]);

  const setCurrentScreen = (screen: AppScreen) => {
    setAppState((prev) => ({
      ...prev,
      currentScreen: screen,
    }));

    // Also save to localStorage for persistence
    localStorage.setItem("clearwallet_current_screen", screen);
  };

  const setSendEthState = (state: Partial<SendEthState>) => {
    setAppState((prev) => ({
      ...prev,
      sendEthState: {
        ...prev.sendEthState,
        ...state,
      },
    }));
  };

  const setConnectDAppRequest = (request: AppState["connectDAppRequest"]) => {
    setAppState((prev) => ({
      ...prev,
      connectDAppRequest: request,
    }));
  };

  const resetAppState = () => {
    setAppState(defaultAppState);
  };

  const value: AppStateContextType = {
    appState,
    setCurrentScreen,
    setSendEthState,
    setConnectDAppRequest,
    resetAppState,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};
