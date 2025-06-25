import React from "react";
import { Screen } from "../../App";
import styles from "./WelcomeScreen.module.scss";

interface WelcomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate }) => {
  return (
    <div className={styles.welcomeScreen}>
      <div className={styles.welcomeHeader}>
        <h1 className={styles.logo}>clearWallet</h1>
        <p className={styles.subtitle}>Welcome to clearWallet</p>
        <p className={styles.description}>Secure and modern Ethereum wallet</p>
      </div>

      <div className={styles.welcomeActions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => onNavigate("create")}
        >
          Create new wallet
        </button>

        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={() => onNavigate("import")}
        >
          Import wallet
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
