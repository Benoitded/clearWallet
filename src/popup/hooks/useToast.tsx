import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import Toast from "../components/Toast";
import type { ToastProps } from "../components/Toast/Toast";

interface ToastContextType {
  showToast: (message: string, type: ToastProps["type"]) => void;
  showReconnectToast: (walletName: string, origin: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  const showToast = (message: string, type: ToastProps["type"]) => {
    const id = Date.now().toString();
    const newToast = {
      id,
      message,
      type,
      onClose: () => removeToast(id),
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showReconnectToast = (walletName: string, origin: string) => {
    showToast(
      `${walletName} is not connected to ${origin}. Click to connect.`,
      "warning"
    );
  };

  useEffect(() => {
    const handleNetworkChanged = (event: CustomEvent) => {
      showToast(`Switched to ${event.detail.networkName}`, "success");
    };

    const handleRpcChanged = (event: CustomEvent) => {
      showToast(
        `Switched to ${event.detail.networkName} - ${event.detail.rpcName}`,
        "success"
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
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showReconnectToast }}>
      {children}
      <div style={{ position: "relative", zIndex: 1000 }}>
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            style={{
              position: "fixed",
              top: `${20 + index * 60}px`,
              right: "20px",
              zIndex: 1000,
            }}
          >
            <Toast {...toast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
