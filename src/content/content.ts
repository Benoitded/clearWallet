// Content script for clearWallet Chrome extension
// Based on Frame and MetaMask patterns for proper injection

console.log("ClearWallet: Content script loading...");

// 1. First, inject our priority script as early as possible
function injectPriorityScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("priority.js");
  script.type = "text/javascript";

  // Inject before any other scripts
  (document.head || document.documentElement).prepend(script);

  // Remove after execution to clean up
  script.onload = () => script.remove();

  console.log("ClearWallet: Priority script injected");
}

// 2. Then inject our main provider
function injectMainProvider() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inpage.js");
  script.type = "text/javascript";

  (document.head || document.documentElement).appendChild(script);

  script.onload = () => {
    script.remove();
    console.log("ClearWallet: Main provider script injected");

    // Signal that content script is ready
    window.postMessage(
      {
        type: "CLEARWALLET_CONTENT_SCRIPT_READY",
        data: { ready: true },
      },
      "*"
    );
  };
}

// 3. Finally inject aggressive takeover if needed
function injectAggressiveScript() {
  setTimeout(() => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject-aggressive.js");
    script.type = "text/javascript";

    (document.head || document.documentElement).appendChild(script);

    script.onload = () => {
      script.remove();
      console.log("ClearWallet: Aggressive injection completed");
    };
  }, 100); // Small delay to ensure priority
}

// Message handling between page and background
window.addEventListener("message", async (event) => {
  // Only accept messages from the page
  if (event.source !== window) return;

  const { type, data, id } = event.data;

  // Handle requests that need to go to background script (but not responses)
  if (type && type.startsWith("CLEARWALLET_") && !type.includes("_RESPONSE")) {
    try {
      console.log("ClearWallet: Forwarding message to background:", type);

      // Send to background script
      const response = await chrome.runtime.sendMessage({
        type: type.replace("CLEARWALLET_", ""),
        data: data,
      });

      // Send response back to page
      window.postMessage(
        {
          type: `${type}_RESPONSE`,
          data: response,
          id: id,
        },
        "*"
      );
    } catch (error) {
      console.error("ClearWallet: Error forwarding message:", error);

      // Send error response back to page
      window.postMessage(
        {
          type: `${type}_RESPONSE`,
          data: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          id: id,
        },
        "*"
      );
    }
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("ClearWallet: Message from background:", message);

  // Forward background messages to page with proper format
  const forwardedMessage = {
    ...message,
    type: message.type.startsWith("CLEARWALLET_")
      ? message.type
      : `CLEARWALLET_${message.type}`,
  };

  window.postMessage(forwardedMessage, "*");

  return true; // Keep message channel open for async responses
});

// Execute injection sequence
function executeInjection() {
  console.log("ClearWallet: Starting injection sequence");

  // Inject in the correct order with proper timing
  injectPriorityScript();

  // Wait for DOM to be ready for main injection
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectMainProvider();
      injectAggressiveScript();
    });
  } else {
    injectMainProvider();
    injectAggressiveScript();
  }
}

// Start injection immediately
executeInjection();

// Additional injection attempts for stubborn pages
setTimeout(() => {
  if (!window.ethereum || !window.ethereum.isClearWallet) {
    console.log("ClearWallet: Backup injection attempt");
    injectMainProvider();
    injectAggressiveScript();
  }
}, 500);

setTimeout(() => {
  if (!window.ethereum || !window.ethereum.isClearWallet) {
    console.log("ClearWallet: Final injection attempt");
    injectAggressiveScript();
  }
}, 1000);
