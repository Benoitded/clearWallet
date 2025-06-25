import React from "react";
import {
  useDAppConnection,
  ConnectedSite,
} from "../../context/DAppConnectionContext";
import Dropdown from "../common/Dropdown";
import styles from "./ConnectionIndicator.module.scss";

interface ConnectionIndicatorProps {
  onDisconnect?: (siteUrl: string) => void;
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  onDisconnect,
}) => {
  const { connectedSites, disconnectFromSite } = useDAppConnection();

  const handleDisconnect = async (siteUrl: string) => {
    await disconnectFromSite(siteUrl);
    onDisconnect?.(siteUrl);
  };

  const formatLastUsed = (timestamp: number): string => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (connectedSites.length === 0) {
    return null;
  }

  const connectionOptions = connectedSites.map((site: ConnectedSite) => ({
    id: site.url,
    label: site.name,
    description: `${site.url} • ${formatLastUsed(site.lastUsed)}`,
    icon: site.icon || "🌐",
    onClick: () => handleDisconnect(site.url),
  }));

  return (
    <div className={styles.connectionIndicator}>
      <Dropdown
        trigger={
          <div className={styles.connectionTrigger}>
            <div className={styles.connectionDot} />
            <span className={styles.connectionCount}>
              {connectedSites.length}
            </span>
          </div>
        }
        options={connectionOptions}
        position="right"
        maxHeight="250px"
        className={styles.connectionDropdown}
      />
    </div>
  );
};

export default ConnectionIndicator;
