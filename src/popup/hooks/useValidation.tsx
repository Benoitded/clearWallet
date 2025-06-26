// React hook for ValidationService integration
import { useState, useCallback, useMemo } from "react";
import {
  ValidationService,
  ValidationResult,
  WalletValidation,
  NetworkValidation,
} from "../services/ValidationService";

export function useValidation() {
  const validationService = ValidationService.getInstance();
  const [validationCache, setValidationCache] = useState<
    Map<string, ValidationResult>
  >(new Map());

  // Clear validation cache
  const clearCache = useCallback(() => {
    setValidationCache(new Map());
  }, []);

  // Generic validation with caching
  const validateWithCache = useCallback(
    (key: string, validator: () => ValidationResult): ValidationResult => {
      // Check cache first
      const cached = validationCache.get(key);
      if (cached) {
        return cached;
      }

      // Validate and cache result
      const result = validator();
      setValidationCache((prev) => new Map(prev).set(key, result));
      return result;
    },
    [validationCache]
  );

  // Wallet validations
  const validateWalletName = useCallback(
    (name: string): ValidationResult => {
      return validateWithCache(`wallet-name-${name}`, () =>
        validationService.validateWalletName(name)
      );
    },
    [validateWithCache]
  );

  const validatePassword = useCallback(
    (password: string): ValidationResult => {
      return validateWithCache(`password-${password}`, () =>
        validationService.validatePassword(password)
      );
    },
    [validateWithCache]
  );

  const validatePasswordConfirmation = useCallback(
    (password: string, confirmPassword: string): ValidationResult => {
      return validateWithCache(
        `password-confirm-${password}-${confirmPassword}`,
        () =>
          validationService.validatePasswordConfirmation(
            password,
            confirmPassword
          )
      );
    },
    [validateWithCache]
  );

  const validatePrivateKey = useCallback(
    (privateKey: string): ValidationResult => {
      return validateWithCache(`private-key-${privateKey}`, () =>
        validationService.validatePrivateKey(privateKey)
      );
    },
    [validateWithCache]
  );

  const validateMnemonic = useCallback(
    (mnemonic: string): ValidationResult => {
      return validateWithCache(`mnemonic-${mnemonic}`, () =>
        validationService.validateMnemonic(mnemonic)
      );
    },
    [validateWithCache]
  );

  const validateWalletForm = useCallback(
    (data: {
      name: string;
      password: string;
      confirmPassword?: string;
      privateKey?: string;
      mnemonic?: string;
    }): WalletValidation => {
      return validationService.validateWalletForm(data);
    },
    []
  );

  // Network validations
  const validateNetworkName = useCallback(
    (name: string): ValidationResult => {
      return validateWithCache(`network-name-${name}`, () =>
        validationService.validateNetworkName(name)
      );
    },
    [validateWithCache]
  );

  const validateRpcUrl = useCallback(
    (url: string): ValidationResult => {
      return validateWithCache(`rpc-url-${url}`, () =>
        validationService.validateRpcUrl(url)
      );
    },
    [validateWithCache]
  );

  const validateChainId = useCallback(
    (chainId: string): ValidationResult => {
      return validateWithCache(`chain-id-${chainId}`, () =>
        validationService.validateChainId(chainId)
      );
    },
    [validateWithCache]
  );

  const validateCurrencySymbol = useCallback(
    (symbol: string): ValidationResult => {
      return validateWithCache(`currency-symbol-${symbol}`, () =>
        validationService.validateCurrencySymbol(symbol)
      );
    },
    [validateWithCache]
  );

  const validateBlockExplorerUrl = useCallback(
    (url: string): ValidationResult => {
      return validateWithCache(`block-explorer-${url}`, () =>
        validationService.validateBlockExplorerUrl(url)
      );
    },
    [validateWithCache]
  );

  const validateNetworkForm = useCallback(
    (data: {
      name: string;
      rpcUrl: string;
      chainId: string;
      symbol: string;
      blockExplorer?: string;
    }): NetworkValidation => {
      return validationService.validateNetworkForm(data);
    },
    []
  );

  // General validations
  const validateEthereumAddress = useCallback(
    (address: string): ValidationResult => {
      return validateWithCache(`eth-address-${address}`, () =>
        validationService.validateEthereumAddress(address)
      );
    },
    [validateWithCache]
  );

  const validateAmount = useCallback(
    (amount: string, maxDecimals: number = 18): ValidationResult => {
      return validateWithCache(`amount-${amount}-${maxDecimals}`, () =>
        validationService.validateAmount(amount, maxDecimals)
      );
    },
    [validateWithCache]
  );

  // Utility functions
  const hasErrors = useCallback(
    (
      validation: ValidationResult | WalletValidation | NetworkValidation
    ): boolean => {
      return validationService.hasErrors(validation);
    },
    []
  );

  const getAllErrors = useCallback(
    (
      validation: ValidationResult | WalletValidation | NetworkValidation
    ): string[] => {
      return validationService.getAllErrors(validation);
    },
    []
  );

  const getAllWarnings = useCallback(
    (
      validation: ValidationResult | WalletValidation | NetworkValidation
    ): string[] => {
      return validationService.getAllWarnings(validation);
    },
    []
  );

  // Form validation hooks
  const useWalletFormValidation = (formData: {
    name: string;
    password: string;
    confirmPassword?: string;
    privateKey?: string;
    mnemonic?: string;
  }) => {
    return useMemo(() => {
      const validation = validateWalletForm(formData);
      return {
        validation,
        isValid: !hasErrors(validation),
        errors: getAllErrors(validation),
        warnings: getAllWarnings(validation),
      };
    }, [
      formData.name,
      formData.password,
      formData.confirmPassword,
      formData.privateKey,
      formData.mnemonic,
    ]);
  };

  const useNetworkFormValidation = (formData: {
    name: string;
    rpcUrl: string;
    chainId: string;
    symbol: string;
    blockExplorer?: string;
  }) => {
    return useMemo(() => {
      const validation = validateNetworkForm(formData);
      return {
        validation,
        isValid: !hasErrors(validation),
        errors: getAllErrors(validation),
        warnings: getAllWarnings(validation),
      };
    }, [
      formData.name,
      formData.rpcUrl,
      formData.chainId,
      formData.symbol,
      formData.blockExplorer,
    ]);
  };

  // Real-time field validation
  const useFieldValidation = (
    value: string,
    validator: (value: string) => ValidationResult,
    debounceMs: number = 300
  ) => {
    const [validation, setValidation] = useState<ValidationResult>({
      isValid: true,
      errors: [],
    });
    const [isValidating, setIsValidating] = useState(false);

    const debouncedValidate = useCallback(
      (() => {
        let timeout: NodeJS.Timeout;
        return (val: string) => {
          setIsValidating(true);
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            const result = validator(val);
            setValidation(result);
            setIsValidating(false);
          }, debounceMs);
        };
      })(),
      [validator, debounceMs]
    );

    // Validate immediately on value change
    useMemo(() => {
      if (value) {
        debouncedValidate(value);
      } else {
        setValidation({ isValid: true, errors: [] });
        setIsValidating(false);
      }
    }, [value, debouncedValidate]);

    return {
      validation,
      isValidating,
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings || [],
    };
  };

  return {
    // Individual field validations
    validateWalletName,
    validatePassword,
    validatePasswordConfirmation,
    validatePrivateKey,
    validateMnemonic,
    validateNetworkName,
    validateRpcUrl,
    validateChainId,
    validateCurrencySymbol,
    validateBlockExplorerUrl,
    validateEthereumAddress,
    validateAmount,

    // Form validations
    validateWalletForm,
    validateNetworkForm,

    // Utility functions
    hasErrors,
    getAllErrors,
    getAllWarnings,

    // Advanced hooks
    useWalletFormValidation,
    useNetworkFormValidation,
    useFieldValidation,

    // Cache management
    clearCache,

    // Service instance
    service: validationService,
  };
}
