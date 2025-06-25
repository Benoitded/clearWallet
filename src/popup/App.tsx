import React, { useState, useEffect } from "react";
import WelcomeScreen from "./components/WelcomeScreen";
import CreateWalletScreen from "./components/CreateWalletScreen";
import ImportWalletScreen from "./components/ImportWalletScreen";
import WalletDashboard from "./components/WalletDashboard";
import SendEthScreen from "./components/SendEthScreen";
import SettingsScreen from "./components/SettingsScreen";
import AddWalletScreen from "./components/AddWalletScreen";
import { ToastProvider } from "./hooks/useToast";
import { NetworkProvider } from "./context/NetworkContext";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { DAppConnectionProvider } from "./context/DAppConnectionContext";
import { AppStateProvider, useAppState } from "./context/AppStateContext";
import ConnectDAppScreen from "./components/ConnectDAppScreen";
import "./styles/App.scss";

export type Screen =
  | "welcome"
  | "create"
  | "import"
  | "dashboard"
  | "send"
  | "settings"
  | "addWallet"
  | "connect-dapp";

const AppContent: React.FC = () => {
  const { wallets, selectedWallet } = useWallet();
  const { appState, setCurrentScreen: setAppStateScreen } = useAppState();
  const currentScreen = appState.currentScreen as Screen;

  // Navigate to the correct screen based on wallet existence
  useEffect(() => {
    // Special case: dApp connection should remain
    if (currentScreen === "connect-dapp" && appState.connectDAppRequest) {
      return;
    }

    // If no wallets exist, go to welcome screen
    if (wallets.length === 0) {
      setAppStateScreen("welcome");
    } else {
      // If wallets exist and we're on welcome screen, go to dashboard
      if (currentScreen === "welcome") {
        setAppStateScreen("dashboard");
      }
    }
  }, [wallets.length, currentScreen, appState.connectDAppRequest]);

  // Save screen changes to storage
  const handleScreenChange = async (screen: Screen) => {
    setAppStateScreen(screen as any);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "welcome":
        return <WelcomeScreen onNavigate={handleScreenChange} />;
      case "create":
        return (
          <CreateWalletScreen
            onWalletCreated={() => handleScreenChange("dashboard")}
            onBack={() => handleScreenChange("welcome")}
          />
        );
      case "import":
        return (
          <ImportWalletScreen
            onWalletImported={() => handleScreenChange("dashboard")}
            onBack={() => handleScreenChange("welcome")}
          />
        );
      case "dashboard":
        return (
          <WalletDashboard
            onSendEth={() => handleScreenChange("send")}
            onSettings={() => handleScreenChange("settings")}
            onAddWallet={() => handleScreenChange("addWallet")}
            onLogoClick={() => handleScreenChange("dashboard")}
          />
        );
      case "send":
        return <SendEthScreen onBack={() => handleScreenChange("dashboard")} />;
      case "settings":
        return (
          <SettingsScreen
            onBack={() => handleScreenChange("dashboard")}
            onWalletDeleted={() => handleScreenChange("welcome")}
          />
        );
      case "addWallet":
        return (
          <AddWalletScreen
            onWalletAdded={() => handleScreenChange("dashboard")}
            onBack={() => handleScreenChange("dashboard")}
          />
        );
      case "connect-dapp":
        return appState.connectDAppRequest ? (
          <ConnectDAppScreen
            onBack={() => handleScreenChange("dashboard")}
            siteUrl={appState.connectDAppRequest.siteUrl}
            siteName={appState.connectDAppRequest.siteName}
            siteIcon={appState.connectDAppRequest.siteIcon}
            onConnect={() => handleScreenChange("dashboard")}
            onReject={() => handleScreenChange("dashboard")}
          />
        ) : (
          <WelcomeScreen onNavigate={handleScreenChange} />
        );
      default:
        return <WelcomeScreen onNavigate={handleScreenChange} />;
    }
  };

  return <div className="app">{renderScreen()}</div>;
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <NetworkProvider>
        <WalletProvider>
          <DAppConnectionProvider>
            <AppStateProvider>
              <AppContent />
            </AppStateProvider>
          </DAppConnectionProvider>
        </WalletProvider>
      </NetworkProvider>
    </ToastProvider>
  );
};

export default App;
