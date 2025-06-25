# clearWallet - Advanced Ethereum Chrome Extension

clearWallet is a modern, secure Chrome extension for managing Ethereum wallets with institutional-grade features. It provides an elegant interface with comprehensive Web3 functionality and advanced network management capabilities.

## 🚀 Features

### Core Wallet Features

- ✨ **Modern institutional interface** with professional design
- 🔐 **Secure wallet management** with mnemonic-based HD derivation
- 💰 **Real-time ETH balance** display with USD conversion estimates
- 📤 **Advanced transaction system** with dynamic status tracking
- 🔄 **Multi-wallet support** with intelligent HD derivation
- 🎨 **Responsive design** built with SCSS modules

### Advanced Network Management

- 🌐 **Multi-network support** (Mainnet, Testnets, Custom networks)
- ⚡ **Multiple RPC endpoints** per network with health monitoring
- 🔧 **Custom RPC addition** to existing networks
- 📊 **Real-time RPC status** indicators (online/slow/offline)
- 🧪 **Parallel RPC testing** with Promise.all optimization
- 📍 **Live block number** display with explorer links

### Transaction & Interaction Features

- 🔗 **dApp compatibility** (MetaMask-compatible provider)
- 📱 **Dynamic transaction status** with real-time updates
- ⛽ **Gas estimation** and fee optimization
- 🔍 **Transaction tracking** with explorer integration
- ⚠️ **Error handling** with detailed feedback
- 🎯 **Network validation** and balance checking

### User Experience

- 🎛️ **Advanced settings panel** with organized network management
- 🍞 **Toast notifications** for all user actions
- 📋 **One-click address copying** throughout the interface
- 🗂️ **Wallet organization** with renaming and deletion
- 🎨 **Visual network indicators** with custom icons
- ⚙️ **Comprehensive RPC management** interface

## 🛠️ Technical Stack

- **React 18** with TypeScript for type safety
- **SCSS Modules** for component-scoped styling
- **Webpack 5** with optimized build configuration
- **ethers.js v6** for Ethereum interactions
- **Chrome Extension Manifest V3** for modern browser integration
- **Context API** for global state management

## 📦 Installation & Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Chrome Browser

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/clearWallet.git
cd clearWallet

# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build
npm run build
```

### Chrome Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked extension"
4. Select the generated `build/` folder
5. clearWallet will appear in your Chrome toolbar

## 🏗️ Project Architecture

```
clearWallet/
├── src/
│   ├── popup/                    # React application
│   │   ├── components/           # UI components
│   │   │   ├── WalletDashboard/  # Main wallet interface
│   │   │   ├── SendEthScreen/    # Transaction interface
│   │   │   ├── SettingsScreen/   # Network & settings management
│   │   │   ├── NetworkSelector/  # Network switching component
│   │   │   └── Toast/            # Notification system
│   │   ├── context/              # Global state management
│   │   │   ├── NetworkContext.tsx # Network & RPC management
│   │   │   └── WalletContext.tsx  # Wallet state management
│   │   ├── hooks/                # Custom React hooks
│   │   │   └── useToast.tsx      # Toast notification hook
│   │   ├── data/                 # Configuration & constants
│   │   │   └── networks.ts       # Network definitions & RPC endpoints
│   │   └── styles/               # Global styles
│   ├── background/               # Chrome extension background script
│   │   └── background.ts         # Service worker & dApp communication
│   ├── content/                  # Web3 injection scripts
│   │   ├── content.ts            # Content script
│   │   └── inpage.ts             # Web3 provider injection
│   └── assets/                   # Icons & static assets
├── manifest.json                 # Chrome extension manifest
├── webpack.config.js             # Build configuration
└── package.json                  # Dependencies & scripts
```

## 🚀 Usage Guide

### Initial Setup

1. **Launch clearWallet** from your Chrome toolbar
2. **Choose setup method:**
   - "Create New Wallet" - Generates a new mnemonic
   - "Import Wallet" - Use existing mnemonic phrase
3. **Select network** during wallet creation
4. **Secure your mnemonic** - Write it down safely

### Wallet Management

- **Multiple wallets:** Use the "+" button to add more wallets from the same mnemonic
- **Wallet switching:** Click the wallet dropdown to switch between wallets
- **Rename wallets:** Use the 3-dot menu next to each wallet
- **Copy addresses:** One-click copying from dashboard or wallet menu

### Network & RPC Management

- **Network switching:** Use the network dropdown in the dashboard
- **Custom networks:** Add new networks in Settings → Custom Networks
- **RPC management:** Add custom RPC endpoints to any network
- **RPC testing:** Test connection speed and reliability for all endpoints
- **Status monitoring:** Real-time health indicators for all RPC endpoints

### Sending Transactions

1. **Click "Send ETH"** from the dashboard
2. **Enter recipient** address and amount
3. **Review gas estimates** (automatically calculated)
4. **Track status** through all transaction phases:
   - Preparing → Estimating → Signing → Sending → Pending → Confirmed
5. **Monitor on explorer** via the transaction hash link

### dApp Integration

clearWallet automatically provides Web3 connectivity to decentralized applications:

- **Automatic detection** of Web3 requests
- **MetaMask compatibility** for seamless dApp usage
- **Network switching** synchronized with dApps
- **Account management** with permission handling

## 🔧 Network Configuration

### Built-in Networks

- **Ethereum Mainnet** - Production network with multiple RPC providers
- **Holesky Testnet** - Latest Ethereum testnet
- **Sepolia Testnet** - Development testnet

### RPC Providers

Each network includes multiple RPC endpoints for redundancy:

- Primary providers (Llamarpc, PublicNode, DRPC)
- Fallback options with automatic health monitoring
- Custom RPC addition capability

### Adding Custom Networks

```typescript
// Example custom network configuration
{
  name: "My Custom Network",
  chainId: 1337,
  rpcUrl: "https://my-rpc.com",
  blockExplorer: "https://my-explorer.com",
  image: "🌐" // Emoji or URL
}
```

## 🔒 Security Features

### Current Implementation

- **Local storage** for demonstration purposes
- **HD wallet derivation** using BIP44 standard paths
- **Mnemonic-based** wallet generation and recovery
- **Network validation** to prevent incorrect transactions
- **Balance verification** before transaction execution

### Production Recommendations

- **Encrypt private keys** with user password
- **Use Chrome's secure storage** API
- **Implement transaction confirmation** modals
- **Add biometric authentication** where available
- **Conduct security audits** before mainnet usage

## 🧪 JSON-RPC Best Practices

clearWallet implements optimized JSON-RPC usage:

- **Parallel RPC testing** using Promise.all for faster network evaluation
- **Automatic failover** to backup RPC endpoints
- **Connection pooling** for efficient provider management
- **Timeout handling** with graceful degradation
- **Batch requests** where applicable for better performance

## 📊 Performance Optimizations

- **Lazy loading** of wallet balances
- **Debounced gas estimation** during transaction preparation
- **Parallel network testing** for faster RPC evaluation
- **Optimized re-renders** with React.memo and useCallback
- **Efficient state management** with Context API

## 🤝 dApp Compatibility

clearWallet provides full MetaMask compatibility:

```javascript
// Standard Web3 detection
if (typeof window.ethereum !== "undefined") {
  // clearWallet detected
  await window.ethereum.request({ method: "eth_requestAccounts" });
}

// Supported methods
window.ethereum.request({ method: "eth_accounts" });
window.ethereum.request({ method: "eth_chainId" });
window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });
window.ethereum.request({
  method: "wallet_switchEthereumChain",
  params: [{ chainId: "0x1" }],
});
```

## 🔄 Development Scripts

```bash
# Clean build directory
npm run clean

# Development build with hot reload
npm run dev

# Production build with optimization
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

## 🚨 Known Limitations

- **Testnet usage recommended** for development and testing
- **Private key storage** uses local storage (development only)
- **Limited token support** (ETH only in current version)
- **Gas optimization** could be enhanced with EIP-1559 support

## 🔮 Upcoming Features

- **ERC-20 token support** with automatic detection
- **Hardware wallet integration** (Ledger, Trezor)
- **Advanced transaction batching** for gas optimization
- **NFT management** with metadata display
- **DeFi protocol integration** with yield farming
- **Multi-signature wallet support**

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- **English only** for code, comments, and commit messages
- **Type safety** with TypeScript throughout
- **Component modularity** with SCSS modules
- **Testing** for critical wallet functions
- **Security review** for any crypto-related changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

clearWallet is provided for educational and development purposes. Always verify transactions on testnets before using real funds. The developers are not responsible for any loss of funds due to misuse or bugs in the software.
