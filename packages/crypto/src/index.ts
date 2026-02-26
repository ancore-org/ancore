/**
 * @ancore/crypto
 * Cryptographic utilities for Ancore wallet
 */

// Type exports
export type {
  Keypair,
  EncryptedData,
  PasswordStrength,
  MnemonicOptions,
  DerivationOptions,
} from './types';

export const CRYPTO_VERSION = '0.1.0';

// Password module exports
export { validatePassword, generateSalt, deriveEncryptionKey } from './password';
