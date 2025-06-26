// React hook for PopupService integration
import { useState, useEffect, useCallback } from "react";
import {
  PopupService,
  PopupState,
  MessageResponse,
} from "../services/PopupService";
import type { Screen } from "../App";

export function usePopupService() {
  const [state, setState] = useState<PopupState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const popupService = PopupService.getInstance();

  // Initialize service and subscribe to state changes
  useEffect(() => {
    let mounted = true;

    const initializeService = async () => {
      try {
        if (!popupService.isReady()) {
          await popupService.initialize();
        }

        if (mounted) {
          setState(popupService.getState());
          setIsReady(true);
        }
      } catch (error) {
        console.error("usePopupService: Initialization failed:", error);
        if (mounted) {
          setState(popupService.getState());
          setIsReady(true);
        }
      }
    };

    // Subscribe to state changes
    const handleStateChange = (newState: PopupState) => {
      if (mounted) {
        setState(newState);
      }
    };

    popupService.on("stateChanged", handleStateChange);
    popupService.on("initialized", handleStateChange);

    initializeService();

    return () => {
      mounted = false;
      popupService.off("stateChanged", handleStateChange);
      popupService.off("initialized", handleStateChange);
    };
  }, []);

  // Wallet operations
  const createWallet = useCallback(
    async (name: string, password: string): Promise<MessageResponse> => {
      return popupService.createWallet(name, password);
    },
    []
  );

  const importWalletFromPrivateKey = useCallback(
    async (
      name: string,
      privateKey: string,
      password: string
    ): Promise<MessageResponse> => {
      return popupService.importWalletFromPrivateKey(
        name,
        privateKey,
        password
      );
    },
    []
  );

  const importWalletFromMnemonic = useCallback(
    async (
      name: string,
      mnemonic: string,
      password: string
    ): Promise<MessageResponse> => {
      return popupService.importWalletFromMnemonic(name, mnemonic, password);
    },
    []
  );

  const selectWallet = useCallback(
    async (walletId: string): Promise<MessageResponse> => {
      return popupService.selectWallet(walletId);
    },
    []
  );

  const removeWallet = useCallback(
    async (walletId: string): Promise<MessageResponse> => {
      return popupService.removeWallet(walletId);
    },
    []
  );

  // Network operations
  const switchNetwork = useCallback(
    async (networkId: string): Promise<MessageResponse> => {
      return popupService.switchNetwork(networkId);
    },
    []
  );

  const addNetwork = useCallback(
    async (networkConfig: any): Promise<MessageResponse> => {
      return popupService.addNetwork(networkConfig);
    },
    []
  );

  // DApp operations
  const disconnectDApp = useCallback(
    async (origin: string): Promise<MessageResponse> => {
      return popupService.disconnectDApp(origin);
    },
    []
  );

  // Navigation
  const navigateToView = useCallback((view: Screen): void => {
    popupService.navigateToView(view);
  }, []);

  const goBack = useCallback((): void => {
    popupService.goBack();
  }, []);

  // State management
  const clearError = useCallback((): void => {
    popupService.clearError();
  }, []);

  const setLoading = useCallback((isLoading: boolean): void => {
    popupService.setLoading(isLoading);
  }, []);

  return {
    // State
    state,
    isReady,
    isLoading: state?.isLoading || false,
    currentView: state?.currentView || "loading",
    wallets: state?.wallets || [],
    selectedWallet: state?.selectedWallet,
    networks: state?.networks || [],
    selectedNetwork: state?.selectedNetwork,
    connectedSites: state?.connectedSites || [],
    error: state?.error,

    // Wallet operations
    createWallet,
    importWalletFromPrivateKey,
    importWalletFromMnemonic,
    selectWallet,
    removeWallet,

    // Network operations
    switchNetwork,
    addNetwork,

    // DApp operations
    disconnectDApp,

    // Navigation
    navigateToView,
    goBack,

    // State management
    clearError,
    setLoading,

    // Service instance (for advanced usage)
    service: popupService,
  };
}
