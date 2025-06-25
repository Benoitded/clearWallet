import React from "react";
import styles from "./Header.module.scss";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showLogo?: boolean;
  onLogoClick?: () => void;
  rightElement?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  showLogo = false,
  onLogoClick,
  rightElement,
}) => {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        {showBack && (
          <button className={styles.backBtn} onClick={onBack}>
            ←
          </button>
        )}
        {showLogo && (
          <h1
            className={`${styles.logo} ${onLogoClick ? styles.clickable : ""}`}
            onClick={onLogoClick}
          >
            clearWallet
          </h1>
        )}
      </div>

      <div className={styles.headerCenter}>
        {title && <h2 className={styles.headerTitle}>{title}</h2>}
      </div>

      <div className={styles.headerRight}>{rightElement}</div>
    </div>
  );
};

export default Header;
