import { useState, useCallback } from 'react';
import { validatePasswordStrength, type EncryptedSecretKeyPayload } from '@ancore/crypto';
import { createWallet, importWallet, type WalletMaterial } from '@ancore/core-sdk';
import { StellarClient } from '@ancore/stellar';
import type { Network } from '@ancore/types';

/**
 * Onboarding step enum
 */
export type OnboardingStep = 'welcome' | 'generate' | 'verify' | 'password' | 'deploy' | 'success';

/**
 * Wallet account data after onboarding
 */
export interface OnboardedAccount {
  publicKey: string;
  contractId: string;
  encryptedMnemonic: EncryptedSecretKeyPayload;
}

/**
 * Onboarding state
 */
export interface OnboardingState {
  step: OnboardingStep;
  mnemonic: string | null;
  verified: boolean;
  password: string | null;
  account: OnboardedAccount | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Password strength result
 */
export type PasswordStrength = {
  isValid: boolean;
  score: number;
  feedback: string[];
};

/**
 * Convert crypto package result to our format
 */
function toPasswordStrength(result: ReturnType<typeof validatePasswordStrength>): PasswordStrength {
  const score = result.strength === 'strong' ? 4 : result.strength === 'medium' ? 2 : 0;
  return {
    isValid: result.valid,
    score,
    feedback: result.reasons,
  };
}

/**
 * Default onboarding state
 */
const DEFAULT_STATE: OnboardingState = {
  step: 'welcome',
  mnemonic: null,
  verified: false,
  password: null,
  account: null,
  error: null,
  isLoading: false,
};

/**
 * Storage keys for persistence
 */
const WALLET_STATE_KEY = 'walletState';
const ACCOUNTS_KEY = 'accounts';

/**
 * Onboarding hook for managing the complete onboarding flow
 */
export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);

  /**
   * Move to the next step
   */
  const goToNextStep = useCallback(() => {
    const steps: OnboardingStep[] = [
      'welcome',
      'generate',
      'verify',
      'password',
      'deploy',
      'success',
    ];
    const currentIndex = steps.indexOf(state.step);
    if (currentIndex < steps.length - 1) {
      setState((prev: OnboardingState) => ({ ...prev, step: steps[currentIndex + 1] }));
    }
  }, [state.step]);

  /**
   * Move to the previous step
   */
  const goToPreviousStep = useCallback(() => {
    const steps: OnboardingStep[] = [
      'welcome',
      'generate',
      'verify',
      'password',
      'deploy',
      'success',
    ];
    setState((prev: OnboardingState) => {
      const currentIndex = steps.indexOf(prev.step);
      if (currentIndex > 0) {
        return { ...prev, step: steps[currentIndex - 1], error: null };
      }
      return prev;
    });
  }, []);

  /**
   * Go to a specific step
   */
  const goToStep = useCallback((step: OnboardingStep) => {
    setState((prev: OnboardingState) => ({ ...prev, step, error: null }));
  }, []);

  /**
   * Start the onboarding process
   */
  const startOnboarding = useCallback(() => {
    setState((prev: OnboardingState) => ({ ...prev, step: 'welcome' }));
  }, []);

  /**
   * Generate a new mnemonic
   */
  const generateMnemonicHandler = useCallback(async () => {
    try {
      const wallet = await createWallet();
      setState((prev: OnboardingState) => ({
        ...prev,
        mnemonic: wallet.mnemonic,
        step: 'generate',
      }));
    } catch (error) {
      setState((prev: OnboardingState) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to generate mnemonic',
      }));
    }
  }, []);

  /**
   * Verify the mnemonic (mark as verified)
   */
  const verifyMnemonicHandler = useCallback(() => {
    setState((prev: OnboardingState) => ({ ...prev, verified: true }));
  }, []);

  /**
   * Set the password
   */
  const setPasswordHandler = useCallback((password: string) => {
    setState((prev: OnboardingState) => ({ ...prev, password }));
  }, []);

  /**
   * Check password strength
   */
  const checkPasswordStrength = useCallback((password: string): PasswordStrength => {
    const result = validatePasswordStrength(password);
    return toPasswordStrength(result);
  }, []);

  /**
   * Encrypt and store the mnemonic
   */
  const encryptMnemonic = useCallback(
    async (password: string): Promise<EncryptedSecretKeyPayload | null> => {
      if (!state.mnemonic) return null;

      try {
        const wallet = await importWallet({
          mnemonic: state.mnemonic,
          password,
        });
        return wallet.encryptedMnemonic;
      } catch (error) {
        setState((prev: OnboardingState) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to encrypt mnemonic',
        }));
        return null;
      }
    },
    [state.mnemonic]
  );

  /**
   * Deploy the account contract to the network
   */
  const deployAccount = useCallback(
    async (
      network: Network = 'testnet'
    ): Promise<{ publicKey: string; contractId: string } | null> => {
      if (!state.mnemonic) {
        setState((prev: OnboardingState) => ({ ...prev, error: 'No mnemonic generated' }));
        return null;
      }

      if (!state.password) {
        setState((prev: OnboardingState) => ({ ...prev, error: 'No password set' }));
        return null;
      }

      setState((prev: OnboardingState) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Import wallet to get keys
        const wallet = await importWallet({
          mnemonic: state.mnemonic,
          password: state.password,
        });

        const publicKey = wallet.publicKey;

        // Initialize Stellar client
        const client = new StellarClient({ network });

        // Fund account with Friendbot on testnet
        if (network === 'testnet') {
          await client.fundWithFriendbot(publicKey);
        }

        // Wait for account to be created
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Use the derived contract ID from wallet
        const contractId = wallet.contractId;

        const account: OnboardedAccount = {
          publicKey,
          contractId,
          encryptedMnemonic: wallet.encryptedMnemonic,
        };

        // Save to storage
        setState((prev: OnboardingState) => ({
          ...prev,
          account,
          isLoading: false,
          step: 'success',
        }));

        return { publicKey, contractId };
      } catch (error) {
        setState((prev: OnboardingState) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to deploy account',
        }));
        return null;
      }
    },
    [state.mnemonic, state.password]
  );

  /**
   * Reset the onboarding state
   */
  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  /**
   * Clear any error
   */
  const clearError = useCallback(() => {
    setState((prev: OnboardingState) => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    step: state.step,
    mnemonic: state.mnemonic,
    verified: state.verified,
    password: state.password,
    account: state.account,
    error: state.error,
    isLoading: state.isLoading,

    // Actions
    startOnboarding,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    generateMnemonic: generateMnemonicHandler,
    verifyMnemonic: verifyMnemonicHandler,
    setPassword: setPasswordHandler,
    checkPasswordStrength,
    encryptMnemonic,
    deployAccount,
    reset,
    clearError,
  };
}
