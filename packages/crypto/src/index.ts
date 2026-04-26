/**
 * @ancore/crypto
 * Cryptographic utilities for Ancore wallet — single public entry point.
 */

export const CRYPTO_VERSION = '0.1.0';

export { validatePasswordStrength } from './password';
export { encryptSecretKey, decryptSecretKey } from './encryption';
export type { EncryptedSecretKeyPayload } from './encryption';
export { generateMnemonic, validateMnemonic } from './mnemonic';
export { deriveKeypairFromMnemonic } from './key-derivation';
