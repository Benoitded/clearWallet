// Legacy toast hook - now redirects to new notification system
import React, { ReactNode, useEffect } from "react";
import { useNotifications } from "./useUIState";
import Toast from "../components/Toast";
import type { ToastProps } from "../components/Toast/Toast";

interface ToastContextType {
  showToast: (message: string, type: ToastProps["type"]) => void;
  showReconnectToast: (walletName: string, origin: string) => void;
}

// Legacy compatibility wrapper using new notification system
export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const {
    notifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
  } = useNotifications();

  const showToast = (message: string, type: ToastProps["type"]) => {
    switch (type) {
      case "success":
        showSuccess(message);
        break;
      case "error":
        showError(message);
        break;
      case "warning":
        showWarning(message);
        break;
      case "info":
        showInfo(message);
        break;
    }
  };

  const showReconnectToast = (walletName: string, origin: string) => {
    showWarning(
      `${walletName} is not connected to ${origin}. Click to connect.`
    );
  };

  useEffect(() => {
    const handleNetworkChanged = (event: CustomEvent) => {
      showSuccess(`Switched to ${event.detail.networkName}`);
    };

    const handleRpcChanged = (event: CustomEvent) => {
      showSuccess(
        `Switched to ${event.detail.networkName} - ${event.detail.rpcName}`
      );
    };

    const handleRuntimeMessage = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.type === "SHOW_RECONNECT_TOAST") {
        showReconnectToast(message.data.walletName, message.data.origin);
      }
    };

    window.addEventListener(
      "networkChanged",
      handleNetworkChanged as EventListener
    );
    window.addEventListener("rpcChanged", handleRpcChanged as EventListener);

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      window.removeEventListener(
        "networkChanged",
        handleNetworkChanged as EventListener
      );
      window.removeEventListener(
        "rpcChanged",
        handleRpcChanged as EventListener
      );
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, [showSuccess, showWarning]);

  // Convert notifications to legacy toast format for rendering
  const toasts = notifications.map((notification, index) => ({
    id: notification.id,
    message: notification.message,
    type: notification.type as ToastProps["type"],
    onClose: () => removeNotification(notification.id),
    index,
  }));

  return (
    <>
      {children}
      <div style={{ position: "relative", zIndex: 1000 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              position: "fixed",
              top: `${20 + toast.index * 60}px`,
              right: "20px",
              zIndex: 1000,
            }}
          >
            <Toast {...toast} />
          </div>
        ))}
      </div>
    </>
  );
};

// Legacy hook that wraps the new notification system
export const useToast = (): ToastContextType => {
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();

  const showToast = (message: string, type: ToastProps["type"]) => {
    switch (type) {
      case "success":
        showSuccess(message);
        break;
      case "error":
        showError(message);
        break;
      case "warning":
        showWarning(message);
        break;
      case "info":
        showInfo(message);
        break;
    }
  };

  const showReconnectToast = (walletName: string, origin: string) => {
    showWarning(
      `${walletName} is not connected to ${origin}. Click to connect.`
    );
  };

  return {
    showToast,
    showReconnectToast,
  };
};
