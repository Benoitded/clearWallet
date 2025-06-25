// Ultra-aggressive ClearWallet injection script
// Designed to take maximum priority over other wallets including MetaMask

(function () {
  "use strict";

  const windowAny = window as any;

  console.log("ClearWallet: Ultra-aggressive injection starting...");

  // Phase 1: Immediate takeover of ethereum object
  function forceEthereumTakeover() {
    if (windowAny.ethereum && windowAny.ethereum.isClearWallet) {
      console.log("ClearWallet: Already prioritized");
      return;
    }

    // Store existing providers for reference
    const existingProviders = [];
    if (windowAny.ethereum) {
      existingProviders.push(windowAny.ethereum);
      windowAny.ethereum_metamask_backup = windowAny.ethereum;
    }
    if (windowAny.web3) {
      windowAny.web3_backup = windowAny.web3;
    }

    // Get our provider
    const clearWalletProvider = windowAny.clearwallet;
    if (!clearWalletProvider) {
      console.warn("ClearWallet: Provider not found in clearwallet property");
      return;
    }

    // FORCE override ethereum with maximum priority
    delete windowAny.ethereum;
    Object.defineProperty(windowAny, "ethereum", {
      value: clearWalletProvider,
      writable: false,
      configurable: false,
      enumerable: true,
    });

    // Additional MetaMask properties for maximum compatibility
    clearWalletProvider.isMetaMask = true;
    clearWalletProvider.isConnected = () => true;
    clearWalletProvider.networkVersion = "1";
    clearWalletProvider.chainId = "0x1";
    clearWalletProvider.selectedAddress = null;

    // Enhanced _metamask object
    clearWalletProvider._metamask = {
      isUnlocked: () => Promise.resolve(true),
      requestBatch: (requests: any[]) =>
        Promise.reject(new Error("Batch requests not supported")),
      version: "11.0.0",
    };

    // Legacy methods for compatibility
    clearWalletProvider.enable = function () {
      console.warn(
        'ethereum.enable() is deprecated. Use ethereum.request({method: "eth_requestAccounts"}) instead.'
      );
      return this.request({ method: "eth_requestAccounts" });
    };

    clearWalletProvider.send = function (method: string, params?: any[]) {
      console.warn(
        "ethereum.send() is deprecated. Use ethereum.request() instead."
      );
      return this.request({ method, params });
    };

    clearWalletProvider.sendAsync = function (
      payload: any,
      callback: Function
    ) {
      console.warn(
        "ethereum.sendAsync() is deprecated. Use ethereum.request() instead."
      );
      this.request(payload)
        .then((result: any) =>
          callback(null, { id: payload.id, jsonrpc: "2.0", result })
        )
        .catch((error: any) => callback(error, null));
    };

    console.log("ClearWallet: FORCED ethereum takeover complete");
  }

  // Phase 2: Block other wallet injections
  function blockOtherWallets() {
    const originalDefineProperty = Object.defineProperty;

    Object.defineProperty = function (
      obj: any,
      prop: string,
      descriptor: PropertyDescriptor
    ) {
      // Block other wallets from overriding ethereum
      if (
        obj === window &&
        prop === "ethereum" &&
        descriptor.value &&
        !descriptor.value.isClearWallet
      ) {
        console.log(
          "ClearWallet: Blocked attempt to override ethereum by another wallet"
        );
        return obj;
      }

      return originalDefineProperty.call(this, obj, prop, descriptor);
    };

    // Also block direct assignments
    const ethereumDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "ethereum"
    );
    if (ethereumDescriptor && !ethereumDescriptor.configurable) {
      // Already locked by us, good
      return;
    }
  }

  // Phase 3: EIP-6963 Provider Discovery
  function announceEIP6963Provider() {
    const provider = windowAny.ethereum;
    if (!provider) return;

    const providerDetail = {
      info: {
        uuid: "clearwallet-" + Date.now(),
        name: "ClearWallet",
        icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMzYjgyZjYiLz48L3N2Zz4=",
        rdns: "io.clearwallet.extension",
      },
      provider,
    };

    // Announce our provider
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: providerDetail,
      })
    );

    // Listen for discovery requests
    window.addEventListener("eip6963:requestProvider", () => {
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: providerDetail,
        })
      );
    });

    console.log("ClearWallet: EIP-6963 provider announced");
  }

  // Phase 4: Legacy web3 injection for older dApps
  function injectLegacyWeb3() {
    if (windowAny.web3) {
      console.log("ClearWallet: web3 already exists, backing up...");
      windowAny.web3_original = windowAny.web3;
    }

    // Inject a minimal web3 object pointing to our provider
    windowAny.web3 = {
      currentProvider: windowAny.ethereum,
      eth: {
        defaultAccount: null,
        accounts: [],
        coinbase: null,
      },
      version: {
        api: "0.20.0",
        ethereum: "0x3f",
        network: "1",
        whisper: undefined,
      },
      providers: {
        HttpProvider: function () {},
        IpcProvider: function () {},
      },
      isConnected: () => windowAny.ethereum?.isConnected?.() || false,
    };

    console.log("ClearWallet: Legacy web3 injected");
  }

  // Phase 5: Continuous monitoring and re-injection
  function setupContinuousMonitoring() {
    const checkInterval = setInterval(() => {
      if (!windowAny.ethereum?.isClearWallet) {
        console.log(
          "ClearWallet: Re-injecting due to ethereum override detected"
        );
        forceEthereumTakeover();
      }
    }, 100);

    // Stop monitoring after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log("ClearWallet: Monitoring stopped");
    }, 30000);
  }

  // Phase 6: Hook into dApp detection methods
  function hookDetectionMethods() {
    // Hook into common detection methods
    const originalHasProperty = Object.prototype.hasOwnProperty;
    Object.prototype.hasOwnProperty = function (prop: string) {
      if (this === window && prop === "ethereum") {
        return true; // Always report ethereum as available
      }
      return originalHasProperty.call(this, prop);
    };

    console.log("ClearWallet: Detection methods hooked");
  }

  // Execute all phases
  function executeInjection() {
    try {
      // Phase 1: Force takeover
      forceEthereumTakeover();

      // Phase 2: Block others
      blockOtherWallets();

      // Phase 3: EIP-6963
      announceEIP6963Provider();

      // Phase 4: Legacy web3
      injectLegacyWeb3();

      // Phase 5: Monitoring
      setupContinuousMonitoring();

      // Phase 6: Hook detection
      hookDetectionMethods();

      // Dispatch events for dApp notification
      window.dispatchEvent(new Event("ethereum#initialized"));
      window.dispatchEvent(
        new CustomEvent("ethereum#initialized", { detail: windowAny.ethereum })
      );

      console.log(
        "ClearWallet: Ultra-aggressive injection completed successfully"
      );
    } catch (error) {
      console.error("ClearWallet: Injection failed:", error);
    }
  }

  // Execute immediately if DOM is ready, otherwise wait
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", executeInjection);
  } else {
    executeInjection();
  }

  // Also execute on next tick to ensure we run after other injections
  setTimeout(executeInjection, 0);

  // And again after a short delay to override anything that loaded later
  setTimeout(executeInjection, 50);
  setTimeout(executeInjection, 100);
})();
