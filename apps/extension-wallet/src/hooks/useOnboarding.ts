import { useState, useCallback } from 'react';
import {
  deriveKeypairFromMnemonic,
  validatePasswordStrength,
  type EncryptedSecretKeyPayload,
} from '@ancore/crypto';
import { createWallet, importWallet } from '@ancore/core-sdk';
import type { Network } from '@ancore/types';
import { useAccountStore } from '@/stores/account';
import { createDeployClient, type DeployClient } from '@/services/deploy-account';
import { getSharedStorageManager } from '@/security/storage-manager';

/** chrome.storage.local key for the deployed smart-account C-address. */
export const CONTRACT_ADDRESS_KEY = 'ancore_contract_address';

async function persistContractAddress(contractId: string): Promise<void> {
  const chromeRef = (globalThis as { chrome?: any }).chrome;
  if (chromeRef?.storage?.local) {
    await new Promise<void>((resolve) => {
      chromeRef.storage.local.set({ [CONTRACT_ADDRESS_KEY]: contractId }, resolve);
    });
  } else {
    localStorage.setItem(CONTRACT_ADDRESS_KEY, contractId);
  }
}

/**
 * Onboarding step enum
 */
export type OnboardingStep = 'welcome' | 'generate' | 'verify' | 'password' | 'deploy' | 'success';

/**
 * Wallet account data after onboarding
 */
export interface OnboardedAccount {
  publicKey: string;
  /** Deployed smart-account contract id (C-address) — the smartAccountId. */
  contractId: string;
  /** Deployment transaction hash, when the contract was freshly deployed. */
  txHash?: string;
  /** True when the contract already existed on-chain (reimport path). */
  alreadyDeployed: boolean;
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

export function deriveOnboardingKeypair(mnemonic: string) {
  return deriveKeypairFromMnemonic(mnemonic, 0);
}

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
 * Options for {@link useOnboarding}. The deploy client is injectable so unit
 * tests can supply a mocked client without standing up Stellar RPC.
 */
export interface UseOnboardingOptions {
  deployClient?: DeployClient;
  network?: Network;
}

/**
 * Onboarding hook for managing the complete onboarding flow
 */
export function useOnboarding(options: UseOnboardingOptions = {}) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const setAccountInStore = useAccountStore((s) => s.setAccount);

  // Lazily build a deploy client once per hook instance. Tests inject a mock.
  const [deployClient] = useState<DeployClient>(
    () => options.deployClient ?? createDeployClient({ network: options.network ?? 'testnet' })
  );

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
   * Deploy the Soroban smart account contract for the onboarding owner.
   *
   * Flow:
   *  1. Derive the owner G-key via BIP44 m/44'/148'/0' (`deriveKeypairFromMnemonic`).
   *  2. Encrypt the mnemonic for the vault.
   *  3. Call the deploy client → { contractId, txHash }. The client recovers an
   *     already-deployed contract id on reimport instead of redeploying.
   *  4. Persist contractId (C-address) alongside encryptedMnemonic in the
   *     account store, and clear both the plaintext mnemonic and the keypair.
   *
   * The keypair is created locally and never stored in React state; it is
   * passed to the deploy call and dropped when this function returns.
   */
  const deployAccount = useCallback(
    // Network is fixed at deploy-client construction (see useOnboarding options);
    // the positional arg is kept for call-site compatibility with the flow.
    async (
      _network: Network = 'testnet'
    ): Promise<{ publicKey: string; contractId: string; txHash?: string } | null> => {
      if (!state.mnemonic) {
        setState((prev: OnboardingState) => ({ ...prev, error: 'No mnemonic generated' }));
        return null;
      }

      if (!state.password) {
        setState((prev: OnboardingState) => ({ ...prev, error: 'No password set' }));
        return null;
      }

      setState((prev: OnboardingState) => ({ ...prev, isLoading: true, error: null }));

      // Encrypt the mnemonic for vault persistence (keeps secretKey out of the
      // returned material; we only need publicKey + encryptedMnemonic here).
      const wallet = await importWallet({
        mnemonic: state.mnemonic,
        password: state.password,
      });
      const publicKey = wallet.publicKey;

      // Derive the owner keypair (BIP44 m/44'/148'/0'). Kept in a local
      // variable only — never placed in React state — and cleared in finally.
      let signer: ReturnType<typeof deriveKeypairFromMnemonic> | null = deriveKeypairFromMnemonic(
        state.mnemonic,
        0
      );

      try {
        const { contractId, txHash } = await deployClient.deployAccount({
          ownerPublicKey: publicKey,
          signer,
        });

        const alreadyDeployed = !txHash;

        const account: OnboardedAccount = {
          publicKey,
          contractId,
          txHash,
          alreadyDeployed,
          encryptedMnemonic: wallet.encryptedMnemonic,
        };

        // #815 — Unlock the AES-GCM vault and persist the mnemonic so that
        // downstream features (send, sign, session keys) have real key material.
        // Best-effort: vault write failures (e.g. in test environments without
        // chrome.storage) must not abort the deploy flow.
        try {
          const vault = getSharedStorageManager();
          const vaultReady = await vault.unlock(state.password!);
          if (vaultReady) {
            await vault.saveAccount({
              privateKey: state.mnemonic!, // plaintext; vault re-encrypts with AES-GCM
              publicKey,
              contractId,
            });
          }
        } catch {
          // Non-fatal: chrome.storage unavailable or vault already locked.
        }

        // Persist contractId (smartAccountId) alongside the account in the
        // vault auth state store.
        setAccountInStore({
          id: publicKey,
          address: publicKey,
          label: 'Ancore Wallet',
          contractId,
        });

        // Save account and clear plaintext mnemonic from state.
        setState((prev: OnboardingState) => ({
          ...prev,
          account,
          mnemonic: null,
          isLoading: false,
          step: 'success',
        }));

        return { publicKey, contractId, txHash };
      } catch (error) {
        // Keep the mnemonic so the user can retry without re-entering it.
        setState((prev: OnboardingState) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to deploy account',
        }));
        return null;
      } finally {
        // Drop the keypair reference so it is not retained after deploy returns.
        signer = null;
      }
    },
    [state.mnemonic, state.password, deployClient, setAccountInStore]
  );

  /**
   * Set mnemonic from an external source (import wallet path).
   */
  const setMnemonicForImport = useCallback((importedMnemonic: string) => {
    setState((prev: OnboardingState) => ({ ...prev, mnemonic: importedMnemonic, step: 'deploy' }));
  }, []);

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
    setMnemonicForImport,
    reset,
    clearError,
  };
}
