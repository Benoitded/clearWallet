// ClearWallet priority script - Takes precedence over other wallets
// Based on Frame and MetaMask injection patterns

(function () {
  "use strict";

  console.log("ClearWallet: Priority script executing...");

  // Store any existing provider
  if ((window as any).ethereum && !(window as any).ethereum.isClearWallet) {
    (window as any).ethereum_backup = (window as any).ethereum;
    console.log("ClearWallet: Stored existing provider");
  }

  // Set a flag to indicate ClearWallet is taking priority
  (window as any).clearwallet_priority = true;

  console.log("ClearWallet: Priority claimed successfully");
})();
