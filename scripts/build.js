#!/usr/bin/env node

// Build script for ClearWallet extension
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Building ClearWallet extension...\n");

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function step(message) {
  log(`📦 ${message}`, "cyan");
}

function success(message) {
  log(`✅ ${message}`, "green");
}

function error(message) {
  log(`❌ ${message}`, "red");
}

function warning(message) {
  log(`⚠️  ${message}`, "yellow");
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkDirectoryStructure() {
  step("Checking directory structure...");

  const requiredFiles = [
    "src/core/index.ts",
    "src/core/storage/StorageService.ts",
    "src/core/networks/NetworkManager.ts",
    "src/core/wallet/WalletManager.ts",
    "src/core/rpc/RPCMethodRegistry.ts",
    "src/background/index.ts",
    "src/background/BackgroundService.ts",
    "src/background/DAppConnectionManager.ts",
    "src/background/NotificationManager.ts",
    "src/background/MessageHandler.ts",
    "src/background/MigrationService.ts",
    "src/content/content.ts",
    "src/content/ContentScriptManager.ts",
    "src/content/ProviderManager.ts",
    "src/popup/App.tsx",
    "src/popup/services/PopupService.ts",
    "src/popup/services/ValidationService.ts",
    "src/popup/services/UIStateManager.ts",
    "src/popup/hooks/usePopupService.tsx",
    "src/popup/hooks/useValidation.tsx",
    "src/popup/hooks/useUIState.tsx",
    "src/shared/types/networks.ts",
    "src/shared/types/wallet.ts",
    "src/shared/types/errors.ts",
    "src/shared/utils/NetworkUtils.ts",
  ];

  const missingFiles = requiredFiles.filter((file) => !checkFileExists(file));

  if (missingFiles.length > 0) {
    error("Missing required files:");
    missingFiles.forEach((file) => log(`  - ${file}`, "red"));
    return false;
  }

  success("All required files present");
  return true;
}

function buildTypeScript() {
  step("Building TypeScript...");

  try {
    execSync("npx tsc --noEmit", { stdio: "inherit" });
    success("TypeScript compilation successful");
    return true;
  } catch (err) {
    error("TypeScript compilation failed");
    return false;
  }
}

function buildWebpack() {
  step("Building with Webpack...");

  try {
    execSync("npx webpack --mode production", { stdio: "inherit" });
    success("Webpack build successful");
    return true;
  } catch (err) {
    error("Webpack build failed");
    return false;
  }
}

function validateBuild() {
  step("Validating build output...");

  const buildFiles = [
    "build/popup.html",
    "build/popup.js",
    "build/background.js",
    "build/content.js",
    "build/inpage.js",
    "build/priority.js",
    "build/inject-aggressive.js",
    "build/manifest.json",
  ];

  const missingBuildFiles = buildFiles.filter((file) => !checkFileExists(file));

  if (missingBuildFiles.length > 0) {
    error("Missing build files:");
    missingBuildFiles.forEach((file) => log(`  - ${file}`, "red"));
    return false;
  }

  success("All build files present");
  return true;
}

function generateBuildReport() {
  step("Generating build report...");

  const buildDir = "build";
  if (!fs.existsSync(buildDir)) {
    error("Build directory not found");
    return;
  }

  const files = fs.readdirSync(buildDir);
  let totalSize = 0;

  log("\n📊 Build Report:", "bright");
  log("================", "bright");

  files.forEach((file) => {
    const filePath = path.join(buildDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    totalSize += stats.size;

    log(`  ${file.padEnd(25)} ${sizeKB.padStart(8)} KB`);
  });

  log("================", "bright");
  log(`  Total build size: ${(totalSize / 1024).toFixed(1)} KB`, "bright");
  log("");
}

function main() {
  const startTime = Date.now();

  // Check if we're in the right directory
  if (!checkFileExists("package.json")) {
    error("Please run this script from the project root directory");
    process.exit(1);
  }

  // Step 1: Check directory structure
  if (!checkDirectoryStructure()) {
    error("Build failed: Missing required files");
    process.exit(1);
  }

  // Step 2: TypeScript compilation check
  if (!buildTypeScript()) {
    error("Build failed: TypeScript errors");
    process.exit(1);
  }

  // Step 3: Webpack build
  if (!buildWebpack()) {
    error("Build failed: Webpack errors");
    process.exit(1);
  }

  // Step 4: Validate build output
  if (!validateBuild()) {
    error("Build failed: Missing output files");
    process.exit(1);
  }

  // Step 5: Generate report
  generateBuildReport();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  success(`🎉 Build completed successfully in ${duration}s`);
  log("");
  log("📁 Build output in ./build directory", "cyan");
  log("🔧 Load the extension in Chrome from ./build", "cyan");
  log("");
}

// Run the build
main();
