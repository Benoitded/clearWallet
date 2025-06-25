import React, { useState, useRef, useEffect } from "react";
import styles from "./Dropdown.module.scss";

interface DropdownOption {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  status?: string;
  latency?: number;
  disabled?: boolean;
  onClick?: () => void;
}

interface DropdownProps {
  trigger: React.ReactNode;
  options: DropdownOption[];
  selectedValue?: string;
  onSelect?: (option: DropdownOption) => void;
  placeholder?: string;
  className?: string;
  maxHeight?: string;
  position?: "left" | "right" | "center";
  onOpen?: () => void;
  onClose?: () => void;
}

const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  options,
  selectedValue,
  onSelect,
  placeholder = "Select an option",
  className = "",
  maxHeight = "300px",
  position = "left",
  onOpen,
  onClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        if (isOpen) {
          setIsOpen(false);
          onClose?.();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);

    if (newState) {
      onOpen?.();
    } else {
      onClose?.();
    }
  };

  const handleOptionClick = (option: DropdownOption) => {
    if (option.disabled) return;

    if (option.onClick) {
      option.onClick();
    } else if (onSelect) {
      onSelect(option);
    }

    setIsOpen(false);
    onClose?.();
  };

  const selectedOption = options.find((opt) => opt.id === selectedValue);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "online":
        return "#10b981";
      case "slow":
        return "#f59e0b";
      case "offline":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className={`${styles.dropdown} ${className}`} ref={dropdownRef}>
      <div className={styles.trigger} onClick={handleToggle}>
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`${styles.menu} ${styles[position]}`}
          style={{ maxHeight }}
        >
          {options.length === 0 ? (
            <div className={styles.emptyState}>No options available</div>
          ) : (
            options.map((option) => (
              <div
                key={option.id}
                className={`${styles.option} ${
                  option.disabled ? styles.disabled : ""
                } ${selectedValue === option.id ? styles.selected : ""}`}
                onClick={() => handleOptionClick(option)}
              >
                <div className={styles.optionContent}>
                  <div className={styles.optionMain}>
                    {option.icon && (
                      <span className={styles.icon}>{option.icon}</span>
                    )}
                    <span className={styles.label}>{option.label}</span>
                    {option.status && (
                      <span
                        className={styles.statusIndicator}
                        style={{ color: getStatusColor(option.status) }}
                        title={`${option.status}${
                          option.latency ? ` (${option.latency}ms)` : ""
                        }`}
                      >
                        ●
                      </span>
                    )}
                    {option.latency && (
                      <span className={styles.latency}>{option.latency}ms</span>
                    )}
                  </div>
                  {option.description && (
                    <div className={styles.description}>
                      {option.description}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
