// React hook for UIStateManager integration
import { useState, useEffect, useCallback } from "react";
import {
  UIStateManager,
  UITheme,
  UISettings,
} from "../services/UIStateManager";

export function useUIState() {
  const uiManager = UIStateManager.getInstance();
  const [theme, setTheme] = useState<UITheme>(uiManager.getTheme());
  const [settings, setSettings] = useState<UISettings>(uiManager.getSettings());
  const [loadingStates, setLoadingStates] = useState<string[]>(
    uiManager.getLoadingStates()
  );
  const [notifications, setNotifications] = useState(
    uiManager.getNotifications()
  );

  // Initialize and subscribe to changes
  useEffect(() => {
    // Load saved settings
    uiManager.loadSettings();

    // Subscribe to theme changes
    const handleThemeChange = (newTheme: UITheme) => {
      setTheme(newTheme);
    };

    // Subscribe to settings changes
    const handleSettingsChange = (newSettings: UISettings) => {
      setSettings(newSettings);
    };

    // Subscribe to loading changes
    const handleLoadingChange = (data: any) => {
      setLoadingStates(data.activeLoading);
    };

    // Subscribe to notification changes
    const handleNotificationAdd = () => {
      setNotifications(uiManager.getNotifications());
    };

    const handleNotificationRemove = () => {
      setNotifications(uiManager.getNotifications());
    };

    const handleNotificationsClear = () => {
      setNotifications([]);
    };

    // Add event listeners
    uiManager.on("themeChanged", handleThemeChange);
    uiManager.on("settingsChanged", handleSettingsChange);
    uiManager.on("loadingChanged", handleLoadingChange);
    uiManager.on("notificationAdded", handleNotificationAdd);
    uiManager.on("notificationRemoved", handleNotificationRemove);
    uiManager.on("notificationsCleared", handleNotificationsClear);

    return () => {
      // Remove event listeners
      uiManager.off("themeChanged", handleThemeChange);
      uiManager.off("settingsChanged", handleSettingsChange);
      uiManager.off("loadingChanged", handleLoadingChange);
      uiManager.off("notificationAdded", handleNotificationAdd);
      uiManager.off("notificationRemoved", handleNotificationRemove);
      uiManager.off("notificationsCleared", handleNotificationsClear);
    };
  }, []);

  // Theme management
  const changeTheme = useCallback((newTheme: "light" | "dark" | "auto") => {
    uiManager.setTheme(newTheme);
  }, []);

  // Settings management
  const updateSettings = useCallback((updates: Partial<UISettings>) => {
    uiManager.updateSettings(updates);
  }, []);

  // Loading state management
  const setLoading = useCallback((key: string, isLoading: boolean) => {
    uiManager.setLoading(key, isLoading);
  }, []);

  const isLoading = useCallback((key?: string) => {
    return uiManager.isLoading(key);
  }, []);

  const clearAllLoading = useCallback(() => {
    uiManager.clearLoading();
  }, []);

  // Error management
  const setError = useCallback((key: string, error: string | null) => {
    uiManager.setError(key, error);
  }, []);

  const getError = useCallback((key: string) => {
    return uiManager.getError(key);
  }, []);

  const hasErrors = useCallback((key?: string) => {
    return uiManager.hasErrors(key);
  }, []);

  const clearError = useCallback((key: string) => {
    uiManager.clearError(key);
  }, []);

  const clearAllErrors = useCallback(() => {
    uiManager.clearAllErrors();
  }, []);

  // Notification management
  const showNotification = useCallback(
    (
      type: "success" | "warning" | "error" | "info",
      message: string,
      persistent: boolean = false
    ) => {
      return uiManager.showNotification(type, message, persistent);
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    uiManager.removeNotification(id);
  }, []);

  const clearNotifications = useCallback(() => {
    uiManager.clearNotifications();
  }, []);

  // Modal management
  const showModal = useCallback((modalId: string) => {
    uiManager.showModal(modalId);
  }, []);

  const hideModal = useCallback((modalId: string) => {
    uiManager.hideModal(modalId);
  }, []);

  const toggleModal = useCallback((modalId: string) => {
    uiManager.toggleModal(modalId);
  }, []);

  const isModalOpen = useCallback((modalId: string) => {
    return uiManager.isModalOpen(modalId);
  }, []);

  const closeAllModals = useCallback(() => {
    uiManager.closeAllModals();
  }, []);

  // Tooltip management
  const showTooltip = useCallback((tooltipId: string) => {
    uiManager.showTooltip(tooltipId);
  }, []);

  const hideTooltip = useCallback((tooltipId: string) => {
    uiManager.hideTooltip(tooltipId);
  }, []);

  const isTooltipVisible = useCallback((tooltipId: string) => {
    return uiManager.isTooltipVisible(tooltipId);
  }, []);

  // Animation management
  const triggerAnimation = useCallback(
    (animationId: string, duration?: number) => {
      uiManager.triggerAnimation(animationId, duration);
    },
    []
  );

  const isAnimationActive = useCallback((animationId: string) => {
    return uiManager.isAnimationActive(animationId);
  }, []);

  // Utility functions
  const getThemeCSS = useCallback(() => {
    return uiManager.getThemeCSS();
  }, []);

  const applyCompactMode = useCallback((isCompact: boolean) => {
    uiManager.applyCompactMode(isCompact);
  }, []);

  const getBreakpointInfo = useCallback(() => {
    return uiManager.getBreakpointInfo();
  }, []);

  return {
    // Current state
    theme,
    settings,
    loadingStates,
    notifications,

    // Theme management
    changeTheme,

    // Settings management
    updateSettings,

    // Loading state management
    setLoading,
    isLoading,
    clearAllLoading,

    // Error management
    setError,
    getError,
    hasErrors,
    clearError,
    clearAllErrors,

    // Notification management
    showNotification,
    removeNotification,
    clearNotifications,

    // Modal management
    showModal,
    hideModal,
    toggleModal,
    isModalOpen,
    closeAllModals,

    // Tooltip management
    showTooltip,
    hideTooltip,
    isTooltipVisible,

    // Animation management
    triggerAnimation,
    isAnimationActive,

    // Utility functions
    getThemeCSS,
    applyCompactMode,
    getBreakpointInfo,

    // Service instance
    manager: uiManager,
  };
}

// Specialized hooks for specific UI elements
export function useNotifications() {
  const {
    notifications,
    showNotification,
    removeNotification,
    clearNotifications,
  } = useUIState();

  const showSuccess = useCallback(
    (message: string, persistent?: boolean) => {
      return showNotification("success", message, persistent);
    },
    [showNotification]
  );

  const showError = useCallback(
    (message: string, persistent?: boolean) => {
      return showNotification("error", message, persistent);
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string, persistent?: boolean) => {
      return showNotification("warning", message, persistent);
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string, persistent?: boolean) => {
      return showNotification("info", message, persistent);
    },
    [showNotification]
  );

  return {
    notifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    clearNotifications,
  };
}

export function useLoading() {
  const { loadingStates, setLoading, isLoading, clearAllLoading } =
    useUIState();

  const startLoading = useCallback(
    (key: string) => {
      setLoading(key, true);
    },
    [setLoading]
  );

  const stopLoading = useCallback(
    (key: string) => {
      setLoading(key, false);
    },
    [setLoading]
  );

  const withLoading = useCallback(
    async <T,>(key: string, asyncFn: () => Promise<T>): Promise<T> => {
      startLoading(key);
      try {
        const result = await asyncFn();
        return result;
      } finally {
        stopLoading(key);
      }
    },
    [startLoading, stopLoading]
  );

  return {
    loadingStates,
    isLoading,
    startLoading,
    stopLoading,
    clearAllLoading,
    withLoading,
  };
}

export function useTheme() {
  const { theme, settings, changeTheme, getThemeCSS } = useUIState();

  const isDarkMode =
    settings.theme === "dark" ||
    (settings.theme === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = useCallback(() => {
    const newTheme = isDarkMode ? "light" : "dark";
    changeTheme(newTheme);
  }, [isDarkMode, changeTheme]);

  return {
    theme,
    themeMode: settings.theme,
    isDarkMode,
    changeTheme,
    toggleTheme,
    getThemeCSS,
  };
}

export function useModal(modalId: string) {
  const { showModal, hideModal, toggleModal, isModalOpen } = useUIState();

  const isOpen = isModalOpen(modalId);

  const open = useCallback(() => {
    showModal(modalId);
  }, [modalId, showModal]);

  const close = useCallback(() => {
    hideModal(modalId);
  }, [modalId, hideModal]);

  const toggle = useCallback(() => {
    toggleModal(modalId);
  }, [modalId, toggleModal]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
