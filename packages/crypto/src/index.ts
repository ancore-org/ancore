/**
 * @ancore/crypto
 * Cryptographic utilities for Ancore wallet
 */

// Placeholder export - implement as package develops
export const CRYPTO_VERSION = '0.1.0';

export { verifySignature, signTransaction } from './signing';
export { validatePasswordStrength } from './password';
export { encryptSecretKey, decryptSecretKey } from './encryption';
export type { EncryptedSecretKeyPayload } from './encryption';
export { generateMnemonic, validateMnemonic } from './mnemonic';
export {
  deriveKeypairFromMnemonic,
  validateMnemonicForStellar,
  deriveMultipleKeypairsFromMnemonic,
} from './key-derivation';
