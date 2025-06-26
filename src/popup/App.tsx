import React, { useEffect } from "react";
import WelcomeScreen from "./components/WelcomeScreen";
import CreateWalletScreen from "./components/CreateWalletScreen";
import ImportWalletScreen from "./components/ImportWalletScreen";
import WalletDashboard from "./components/WalletDashboard";
import SendEthScreen from "./components/SendEthScreen";
import SettingsScreen from "./components/SettingsScreen";
import AddWalletScreen from "./components/AddWalletScreen";
import ConnectDAppScreen from "./components/ConnectDAppScreen";
import { ToastProvider } from "./hooks/useToast";
import { WalletProvider } from "./context/WalletContext";
import { NetworkProvider } from "./context/NetworkContext";
import { DAppConnectionProvider } from "./context/DAppConnectionContext";
import { usePopupService } from "./hooks/usePopupService";
import { useUIState } from "./hooks/useUIState";
import "./styles/App.scss";

export type Screen =
  | "loading"
  | "welcome"
  | "create-wallet"
  | "import-wallet"
  | "dashboard"
  | "send"
  | "settings"
  | "add-wallet"
  | "connect-dapp";

const AppContent: React.FC = () => {
  const { currentView, isReady, isLoading, wallets, selectedWallet, error } =
    usePopupService();

  const { theme } = useUIState();

  // Apply theme to document
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--primary-color",
      theme.primary
    );
    document.documentElement.style.setProperty(
      "--background-color",
      theme.background
    );
    document.documentElement.style.setProperty("--text-color", theme.text);
    document.documentElement.style.setProperty(
      "--surface-color",
      theme.surface
    );
    document.documentElement.style.setProperty("--border-color", theme.border);
    document.documentElement.style.setProperty(
      "--success-color",
      theme.success
    );
    document.documentElement.style.setProperty(
      "--warning-color",
      theme.warning
    );
    document.documentElement.style.setProperty("--error-color", theme.error);
  }, [theme]);

  // Show loading screen if not ready
  if (!isReady || isLoading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading ClearWallet...</p>
        </div>
      </div>
    );
  }

  // Show error if initialization failed
  if (error) {
    return (
      <div className="app">
        <div className="error-screen">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (currentView) {
      case "welcome":
        return <WelcomeScreen />;
      case "create-wallet":
        return <CreateWalletScreen />;
      case "import-wallet":
        return <ImportWalletScreen />;
      case "dashboard":
        return <WalletDashboard />;
      case "send":
        return <SendEthScreen />;
      case "settings":
        return <SettingsScreen />;
      case "add-wallet":
        return <AddWalletScreen />;
      case "connect-dapp":
        return <ConnectDAppScreen />;
      default:
        return <WelcomeScreen />;
    }
  };

  return <div className="app">{renderScreen()}</div>;
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <NetworkProvider>
        <DAppConnectionProvider>
          <WalletProvider>
            <AppContent />
          </WalletProvider>
        </DAppConnectionProvider>
      </NetworkProvider>
    </ToastProvider>
  );
};

export default App;
