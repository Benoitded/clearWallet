import React from "react";

interface EthereumIconProps {
  size?: number;
  className?: string;
}

const EthereumIcon: React.FC<EthereumIconProps> = ({
  size = 24,
  className = "",
}) => {
  const [hasError, setHasError] = React.useState(false);

  if (hasError) {
    // Fallback to emoji if image fails to load
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.7,
        }}
      >
        ⟠
      </div>
    );
  }

  return (
    <img
      src="https://corzzzxuybbykevxkokz.supabase.co/storage/v1/object/public/tokens/ETH.png"
      alt="Ethereum"
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: "contain",
        borderRadius: "50%",
      }}
      onError={() => setHasError(true)}
    />
  );
};

export default EthereumIcon;
