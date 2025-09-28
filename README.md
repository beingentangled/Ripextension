# RIP Browser Extension - Amazon Crypto Insurance

A Chrome browser extension that enables seamless crypto-based price protection insurance for Amazon purchases. The extension automatically detects Amazon orders and integrates with the RIP (Remorse Insurance Protocol) decentralized application for zero-knowledge proof-based insurance claims.

## 🚀 Features

### Core Functionality
- **Amazon Order Detection**: Automatically scans Amazon order history pages
- **Real-time Price Monitoring**: Tracks product prices after purchase
- **Insurance Integration**: Direct connection to RIP insurance protocol
- **Cross-Domain Communication**: Secure bridge between Amazon and RIP app
- **PDF Invoice Processing**: Extracts order data from Amazon invoices
- **Multi-Region Support**: Works across all major Amazon marketplaces

### Privacy & Security
- **Zero-Knowledge Integration**: Supports ZK-SNARK proof generation
- **Secure Storage**: Encrypted local storage for sensitive data
- **Permission Management**: Minimal required permissions
- **Content Security Policy**: Strict CSP for enhanced security

### User Experience
- **One-Click Insurance**: Inject "Insure This Order" buttons on Amazon
- **Seamless UI Integration**: Native-looking Amazon interface elements
- **Real-time Sync**: Automatic data synchronization with RIP app
- **Multi-Language Support**: Works with international Amazon sites

## 🛠️ Technology Stack

### Extension Framework
- **Manifest V3**: Latest Chrome extension format
- **Service Worker**: Background processing and message handling
- **Content Scripts**: DOM manipulation and data extraction
- **Web Accessible Resources**: Secure resource sharing

### Libraries & Dependencies
- **PDF.js**: PDF invoice parsing and data extraction
- **Chrome APIs**: Storage, cookies, active tab, scripting
- **Cross-Origin Communication**: Secure message passing

### Supported Platforms
- **Amazon Marketplaces**: .com, .co.uk, .ca, .de, .fr, .it, .es, .in, .co.jp
- **RIP Applications**: Local development and production deployments
- **Browser Support**: Chrome, Chromium-based browsers

## 📋 Prerequisites

Before installing the extension, ensure you have:

- **Chrome Browser** (version 88 or higher)
- **Developer Mode** enabled in Chrome extensions
- **RIP Application** running (localhost:3002 or deployed version)
- **Amazon Account** for order history access

## 🚀 Installation

### Development Installation

#### 1. Clone Repository
```bash
git clone <repository-url>
cd ETHDelhiCryptoInsurance/extension
```

#### 2. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `extension` folder
5. Extension will appear in your extensions list

#### 3. Pin Extension (Optional)
1. Click the extensions icon (puzzle piece) in Chrome toolbar
2. Pin "RipExtension" for easy access

### Production Installation
```bash
# Use the packaged extension file
# Install ripextension.crx from the repository root
```

## 📁 Project Structure

```
extension/
├── manifest.json           # Extension configuration and permissions
├── background.js          # Service worker for background tasks
├── shared-storage.js      # Cross-domain storage utilities
├── vercel-bridge.js       # Communication bridge with RIP app
├── amazon-injector.css    # Styling for Amazon page injections
├── amazon/                # Amazon-specific functionality
│   ├── config.js         # Amazon marketplace configuration
│   ├── main.js           # Entry point and initialization
│   ├── ui.js             # UI injection and DOM manipulation
│   ├── order-extraction.js # Order data extraction logic
│   └── invoice.js        # PDF invoice processing
└── libs/                  # External libraries
    └── pdfjs/            # PDF.js library for invoice parsing
```

## 🔧 Configuration

### Extension Permissions
The extension requires the following permissions:

```json
{
  "permissions": [
    "cookies",     // Access Amazon session cookies
    "activeTab",   // Read current tab information
    "storage",     // Store extension data locally
    "identity",    // User identity management
    "scripting"    // Inject scripts into web pages
  ]
}
```

### Host Permissions
Configured to work with:
- **Amazon Marketplaces**: All major international domains
- **RIP Applications**: Localhost and Vercel deployments
- **Supporting Services**: MetaMask, QR code generation

### Content Security Policy
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

## 🎯 How It Works

### 1. Amazon Integration
```javascript
// Detects Amazon order history pages
if (Amazon.isOrderHistoryPage()) {
    Amazon.injectInsureButtons();
}
```

### 2. Order Data Extraction
- Scans DOM for order information
- Extracts product details, prices, dates
- Processes PDF invoices when available
- Normalizes data across different Amazon layouts

### 3. Insurance Button Injection
- Injects "Insure This Order" buttons
- Maintains Amazon's native styling
- Handles click events and data transmission

### 4. Cross-Domain Communication
```javascript
// Secure message passing to RIP app
chrome.runtime.sendMessage({
    action: 'addInsurancePolicy',
    data: orderData
});
```

### 5. Background Processing
- Manages persistent data storage
- Handles cross-origin requests
- Coordinates between Amazon and RIP app

## 🔐 Security Features

### Content Script Isolation
- Scripts run in isolated environment
- No direct access to page JavaScript
- Secure DOM manipulation only

### Message Validation
```javascript
// All messages are validated before processing
if (message.source === 'cryptoinsure-website') {
    await handleWebsiteMessage(message);
}
```

### Data Encryption
- Sensitive data encrypted before storage
- Session tokens handled securely
- No plaintext storage of private information

## 🧪 Testing

### Manual Testing
1. Navigate to Amazon order history
2. Verify "Insure This Order" buttons appear
3. Click button and confirm data transfer to RIP app
4. Test across different Amazon marketplaces

### Extension Console
```javascript
// Debug extension functionality
chrome.runtime.sendMessage({action: 'test'}, response => {
    console.log('Extension response:', response);
});
```

### Network Monitoring
- Monitor background script network requests
- Verify secure communication channels
- Test cross-origin message passing

## 🚀 Deployment

### Development Build
```bash
# Extension is ready to use from source
# No build process required for development
```

### Production Package
```bash
# Create .crx package
chrome --pack-extension=./extension --pack-extension-key=extension.pem
```

### Store Submission
1. Package extension as .zip file
2. Create store listing with screenshots
3. Submit for Chrome Web Store review
4. Handle review feedback and updates

## 🔍 Troubleshooting

### Common Issues

**Extension Not Loading**
- Verify manifest.json syntax
- Check for permission errors in Chrome console
- Ensure all required files are present

**Amazon Buttons Not Appearing**
- Check if order history page is detected correctly
- Verify CSS injection is working
- Test with different Amazon layouts

**Communication Errors**
- Ensure RIP app is running on correct port
- Check CORS and CSP configurations
- Verify message passing format

**PDF Processing Issues**
- Confirm PDF.js library is loaded
- Check file permissions and access
- Test with different invoice formats

### Debug Mode
Enable debug logging:
```javascript
// Add to background.js for detailed logging
console.log('ripextension: Debug mode enabled');
```

### Extension Inspector
1. Right-click extension icon
2. Select "Inspect popup" or background page
3. Use Chrome DevTools for debugging

## 📚 API Reference

### Background Script Messages
```javascript
// Get wallet state
chrome.runtime.sendMessage({
    action: 'getWalletState'
}, response => {
    console.log('Wallet state:', response);
});

// Add insurance policy
chrome.runtime.sendMessage({
    action: 'addInsurancePolicy',
    data: {
        orderId: 'order-123',
        productName: 'Product Name',
        price: '99.99',
        // ... other order data
    }
});

// Sync product catalog
chrome.runtime.sendMessage({
    action: 'syncProductCatalog',
    data: catalogData
});
```

### Content Script API
```javascript
// Amazon order detection
Amazon.isOrderHistoryPage();

// Extract order data
Amazon.extractOrderData(orderElement);

// Inject insurance buttons
Amazon.injectInsureButtons();

// Process PDF invoices
Amazon.processPDFInvoice(pdfUrl);
```

### Storage API
```javascript
// Store data securely
ripextensionStorage.setItem('key', value);

// Retrieve stored data
const data = ripextensionStorage.getItem('key');

// Clear sensitive data
ripextensionStorage.clear();
```

## 🔄 Integration with RIP App

### Data Flow
1. **Detection**: Extension detects Amazon orders
2. **Extraction**: Order data extracted and processed
3. **Transmission**: Data sent to RIP app via bridge
4. **Insurance**: User can purchase insurance in RIP app
5. **Monitoring**: Extension monitors for price changes
6. **Claims**: ZK proofs generated for claims processing

### Message Format
```javascript
const orderData = {
    orderId: string,
    productName: string,
    price: number,
    currency: string,
    orderDate: string,
    productUrl: string,
    imageUrl: string,
    marketplace: string
};
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Clone your fork locally
3. Load extension in Chrome developer mode
4. Make changes and test thoroughly
5. Submit pull request with detailed description

### Code Style
- Use ES6+ JavaScript features
- Follow Chrome extension best practices
- Maintain consistent indentation (2 spaces)
- Add JSDoc comments for functions

### Testing Requirements
- Test across multiple Amazon marketplaces
- Verify functionality with different order types
- Ensure backward compatibility
- Test error handling and edge cases

## 📄 Permissions Explanation

### Required Permissions
- **cookies**: Access Amazon authentication cookies for order history
- **activeTab**: Read current tab URL to detect Amazon pages
- **storage**: Store extension settings and temporary data
- **identity**: Manage user authentication state
- **scripting**: Inject insurance buttons into Amazon pages

### Host Permissions
- **Amazon domains**: Access order history and product pages
- **Localhost/Vercel**: Communication with RIP application
- **Supporting services**: QR codes, external resources

## 🛡️ Privacy Policy

### Data Collection
- Extension only processes Amazon order data when explicitly triggered
- No personal data transmitted without user consent
- All communication encrypted and secure

### Data Storage
- Local storage only, no remote data collection
- Sensitive data encrypted before storage
- User can clear all data at any time

### Third-Party Integration
- Secure communication with RIP application only
- No data sharing with unauthorized third parties
- All integrations require explicit user consent

## 📋 Release Notes

### Version 0.0.1 (Current)
- ✅ Basic Amazon order detection
- ✅ Insurance button injection
- ✅ Cross-domain communication bridge
- ✅ PDF invoice processing
- ✅ Multi-marketplace support
- ✅ Secure data storage

### Upcoming Features
- 🔄 Real-time price monitoring
- 🔄 Push notifications for price drops
- 🔄 Advanced order filtering
- 🔄 Bulk insurance operations

## 🆘 Support

### Getting Help
- **Issues**: Create GitHub issue with detailed description
- **Documentation**: Check API reference and troubleshooting
- **Community**: Join Discord for community support

### Bug Reports
Include the following information:
- Chrome version and OS
- Extension version
- Steps to reproduce
- Console error messages
- Screenshots if relevant

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

**🔗 Related Projects:**
- [RIP Frontend Application](../ripapp/README.md)


Built with ❤️ for ETH Delhi 2025