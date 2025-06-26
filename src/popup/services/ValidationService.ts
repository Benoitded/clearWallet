// Validation service for popup forms and inputs
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface WalletValidation {
  name: ValidationResult;
  password: ValidationResult;
  privateKey?: ValidationResult;
  mnemonic?: ValidationResult;
  confirmPassword?: ValidationResult;
}

export interface NetworkValidation {
  name: ValidationResult;
  rpcUrl: ValidationResult;
  chainId: ValidationResult;
  symbol: ValidationResult;
  blockExplorer?: ValidationResult;
}

export class ValidationService {
  private static instance: ValidationService;

  private constructor() {}

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  // =================== Wallet Validations ===================

  /**
   * Validate wallet name
   */
  validateWalletName(name: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required check
    if (!name || name.trim().length === 0) {
      errors.push("Wallet name is required");
    }

    // Length check
    if (name && name.trim().length < 3) {
      errors.push("Wallet name must be at least 3 characters");
    }

    if (name && name.trim().length > 50) {
      errors.push("Wallet name must be less than 50 characters");
    }

    // Character check
    const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (name && !validNameRegex.test(name.trim())) {
      errors.push(
        "Wallet name can only contain letters, numbers, spaces, hyphens, and underscores"
      );
    }

    // Reserved names
    const reservedNames = [
      "main",
      "default",
      "wallet",
      "ethereum",
      "clearwallet",
    ];
    if (name && reservedNames.includes(name.trim().toLowerCase())) {
      warnings.push("This name is commonly used. Consider a more unique name.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate password
   */
  validatePassword(password: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required check
    if (!password) {
      errors.push("Password is required");
      return { isValid: false, errors, warnings };
    }

    // Length check
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (password.length > 128) {
      errors.push("Password must be less than 128 characters");
    }

    // Complexity checks
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password
    );

    if (!hasUppercase) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!hasLowercase) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (!hasNumbers) {
      errors.push("Password must contain at least one number");
    }

    if (!hasSpecialChars) {
      warnings.push("Consider adding special characters for stronger security");
    }

    // Common password patterns
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /letmein/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        warnings.push("Avoid using common password patterns");
        break;
      }
    }

    // Sequential characters
    if (/(.)\1{2,}/.test(password)) {
      warnings.push("Avoid repeating characters");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate password confirmation
   */
  validatePasswordConfirmation(
    password: string,
    confirmPassword: string
  ): ValidationResult {
    const errors: string[] = [];

    if (!confirmPassword) {
      errors.push("Please confirm your password");
    } else if (password !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate private key
   */
  validatePrivateKey(privateKey: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required check
    if (!privateKey || privateKey.trim().length === 0) {
      errors.push("Private key is required");
      return { isValid: false, errors, warnings };
    }

    // Clean the private key
    const cleanKey = privateKey.trim().replace(/^0x/i, "");

    // Length check (64 hex characters)
    if (cleanKey.length !== 64) {
      errors.push("Private key must be 64 hexadecimal characters (32 bytes)");
    }

    // Hex format check
    if (!/^[0-9a-fA-F]+$/.test(cleanKey)) {
      errors.push(
        "Private key must contain only hexadecimal characters (0-9, a-f, A-F)"
      );
    }

    // Zero key check
    if (cleanKey === "0".repeat(64)) {
      errors.push("Invalid private key: cannot be all zeros");
    }

    // Max value check (must be less than secp256k1 curve order)
    try {
      const keyBigInt = BigInt("0x" + cleanKey);
      const maxValue = BigInt(
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"
      );

      if (keyBigInt >= maxValue) {
        errors.push("Invalid private key: value too large for secp256k1 curve");
      }
    } catch (error) {
      errors.push("Invalid private key format");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate mnemonic phrase
   */
  validateMnemonic(mnemonic: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required check
    if (!mnemonic || mnemonic.trim().length === 0) {
      errors.push("Mnemonic phrase is required");
      return { isValid: false, errors, warnings };
    }

    // Clean and split words
    const words = mnemonic.trim().toLowerCase().split(/\s+/);

    // Word count check
    const validLengths = [12, 15, 18, 21, 24];
    if (!validLengths.includes(words.length)) {
      errors.push(
        `Mnemonic must be ${validLengths.join(", ")} words. Found ${
          words.length
        } words.`
      );
    }

    // Basic word validation (simplified - in production, use BIP39 wordlist)
    const invalidWords = words.filter((word) => {
      return word.length < 3 || word.length > 8 || !/^[a-z]+$/.test(word);
    });

    if (invalidWords.length > 0) {
      errors.push(`Invalid words found: ${invalidWords.join(", ")}`);
    }

    // Check for common errors
    if (words.some((word) => /\d/.test(word))) {
      warnings.push("Mnemonic words should not contain numbers");
    }

    if (words.some((word) => word.length < 3)) {
      warnings.push("Very short words may not be valid BIP39 words");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate complete wallet form
   */
  validateWalletForm(data: {
    name: string;
    password: string;
    confirmPassword?: string;
    privateKey?: string;
    mnemonic?: string;
  }): WalletValidation {
    const validation: WalletValidation = {
      name: this.validateWalletName(data.name),
      password: this.validatePassword(data.password),
    };

    if (data.confirmPassword !== undefined) {
      validation.confirmPassword = this.validatePasswordConfirmation(
        data.password,
        data.confirmPassword
      );
    }

    if (data.privateKey) {
      validation.privateKey = this.validatePrivateKey(data.privateKey);
    }

    if (data.mnemonic) {
      validation.mnemonic = this.validateMnemonic(data.mnemonic);
    }

    return validation;
  }

  // =================== Network Validations ===================

  /**
   * Validate network name
   */
  validateNetworkName(name: string): ValidationResult {
    const errors: string[] = [];

    if (!name || name.trim().length === 0) {
      errors.push("Network name is required");
    }

    if (name && (name.trim().length < 2 || name.trim().length > 50)) {
      errors.push("Network name must be between 2 and 50 characters");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate RPC URL
   */
  validateRpcUrl(url: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!url || url.trim().length === 0) {
      errors.push("RPC URL is required");
      return { isValid: false, errors, warnings };
    }

    // URL format validation
    try {
      const urlObj = new URL(url.trim());

      // Protocol check
      if (!["http:", "https:", "ws:", "wss:"].includes(urlObj.protocol)) {
        errors.push("RPC URL must use HTTP, HTTPS, WS, or WSS protocol");
      }

      // HTTPS recommendation
      if (
        urlObj.protocol === "http:" &&
        !urlObj.hostname.includes("localhost") &&
        !urlObj.hostname.startsWith("127.")
      ) {
        warnings.push("Consider using HTTPS for better security");
      }
    } catch (error) {
      errors.push("Invalid URL format");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate chain ID
   */
  validateChainId(chainId: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!chainId || chainId.trim().length === 0) {
      errors.push("Chain ID is required");
      return { isValid: false, errors, warnings };
    }

    // Parse chain ID
    let chainIdNum: number;
    try {
      // Handle hex format
      if (chainId.startsWith("0x")) {
        chainIdNum = parseInt(chainId, 16);
      } else {
        chainIdNum = parseInt(chainId, 10);
      }

      if (isNaN(chainIdNum) || chainIdNum <= 0) {
        errors.push("Chain ID must be a positive number");
      }

      // Check for common chain IDs
      const commonChains: { [key: number]: string } = {
        1: "Ethereum Mainnet",
        3: "Ropsten (deprecated)",
        4: "Rinkeby (deprecated)",
        5: "Goerli",
        42: "Kovan (deprecated)",
        56: "Binance Smart Chain",
        137: "Polygon",
        43114: "Avalanche",
      };

      if (commonChains[chainIdNum]) {
        warnings.push(`This is the chain ID for ${commonChains[chainIdNum]}`);
      }
    } catch (error) {
      errors.push("Invalid chain ID format");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate currency symbol
   */
  validateCurrencySymbol(symbol: string): ValidationResult {
    const errors: string[] = [];

    if (!symbol || symbol.trim().length === 0) {
      errors.push("Currency symbol is required");
      return { isValid: false, errors };
    }

    if (symbol.trim().length < 2 || symbol.trim().length > 10) {
      errors.push("Currency symbol must be between 2 and 10 characters");
    }

    if (!/^[A-Z]+$/.test(symbol.trim())) {
      errors.push("Currency symbol must contain only uppercase letters");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate block explorer URL
   */
  validateBlockExplorerUrl(url: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Optional field
    if (!url || url.trim().length === 0) {
      return { isValid: true, errors };
    }

    try {
      const urlObj = new URL(url.trim());

      if (!["http:", "https:"].includes(urlObj.protocol)) {
        errors.push("Block explorer URL must use HTTP or HTTPS");
      }

      if (urlObj.protocol === "http:") {
        warnings.push("Consider using HTTPS for better security");
      }
    } catch (error) {
      errors.push("Invalid block explorer URL format");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate complete network form
   */
  validateNetworkForm(data: {
    name: string;
    rpcUrl: string;
    chainId: string;
    symbol: string;
    blockExplorer?: string;
  }): NetworkValidation {
    return {
      name: this.validateNetworkName(data.name),
      rpcUrl: this.validateRpcUrl(data.rpcUrl),
      chainId: this.validateChainId(data.chainId),
      symbol: this.validateCurrencySymbol(data.symbol),
      blockExplorer: data.blockExplorer
        ? this.validateBlockExplorerUrl(data.blockExplorer)
        : { isValid: true, errors: [] },
    };
  }

  // =================== General Validations ===================

  /**
   * Validate Ethereum address
   */
  validateEthereumAddress(address: string): ValidationResult {
    const errors: string[] = [];

    if (!address || address.trim().length === 0) {
      errors.push("Address is required");
      return { isValid: false, errors };
    }

    const cleanAddress = address.trim();

    // Length and format check
    if (!/^0x[0-9a-fA-F]{40}$/.test(cleanAddress)) {
      errors.push("Invalid Ethereum address format");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate amount (ETH or token)
   */
  validateAmount(amount: string, maxDecimals: number = 18): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!amount || amount.trim().length === 0) {
      errors.push("Amount is required");
      return { isValid: false, errors, warnings };
    }

    // Number format check
    const amountRegex = /^\d+(\.\d+)?$/;
    if (!amountRegex.test(amount.trim())) {
      errors.push("Invalid number format");
      return { isValid: false, errors, warnings };
    }

    const numAmount = parseFloat(amount.trim());

    // Positive check
    if (numAmount <= 0) {
      errors.push("Amount must be greater than 0");
    }

    // Decimal places check
    const decimalParts = amount.trim().split(".");
    if (decimalParts.length > 1 && decimalParts[1].length > maxDecimals) {
      errors.push(`Amount cannot have more than ${maxDecimals} decimal places`);
    }

    // Very small amounts warning
    if (numAmount > 0 && numAmount < 0.000001) {
      warnings.push("Very small amounts may not be processed correctly");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // =================== Utility Methods ===================

  /**
   * Check if any validation has errors
   */
  hasErrors(
    validation: ValidationResult | WalletValidation | NetworkValidation
  ): boolean {
    if ("isValid" in validation) {
      return !validation.isValid;
    }

    // Check all fields in complex validation
    return Object.values(validation).some((field) => field && !field.isValid);
  }

  /**
   * Get all errors from validation
   */
  getAllErrors(
    validation: ValidationResult | WalletValidation | NetworkValidation
  ): string[] {
    if ("isValid" in validation) {
      return validation.errors;
    }

    // Collect all errors from complex validation
    const allErrors: string[] = [];
    Object.values(validation).forEach((field) => {
      if (field && field.errors) {
        allErrors.push(...field.errors);
      }
    });

    return allErrors;
  }

  /**
   * Get all warnings from validation
   */
  getAllWarnings(
    validation: ValidationResult | WalletValidation | NetworkValidation
  ): string[] {
    if ("isValid" in validation) {
      return validation.warnings || [];
    }

    // Collect all warnings from complex validation
    const allWarnings: string[] = [];
    Object.values(validation).forEach((field) => {
      if (field && field.warnings) {
        allWarnings.push(...field.warnings);
      }
    });

    return allWarnings;
  }
}
