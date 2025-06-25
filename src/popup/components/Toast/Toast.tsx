import React, { useEffect } from "react";
import styles from "./Toast.module.scss";

export interface ToastProps {
  message: string;
  type: "success" | "error" | "warning" | "info";
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "ℹ️";
    }
  };

  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <div className={styles.toastContent}>
        <span className={styles.toastIcon}>{getIcon()}</span>
        <span className={styles.toastMessage}>{message}</span>
      </div>
      <button className={styles.closeBtn} onClick={onClose}>
        ×
      </button>
    </div>
  );
};

export default Toast;
