import React from "react";
import { usePopupService } from "../../hooks/usePopupService";
import styles from "./WelcomeScreen.module.scss";

const WelcomeScreen: React.FC = () => {
  const { navigateToView } = usePopupService();

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
          onClick={() => navigateToView("create-wallet")}
        >
          Create new wallet
        </button>

        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={() => navigateToView("import-wallet")}
        >
          Import wallet
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
