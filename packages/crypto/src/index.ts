/**
 * @ancore/crypto
 * Cryptographic utilities for Ancore wallet — single public entry point.
 */

export const CRYPTO_VERSION = '0.1.0';
export {
  estimateEntropy,
  scoreEntropy,
  estimateCrackTime,
  analyzeEntropy,
  meetsEntropyThreshold,
  meetsStrictEntropyThreshold,
  DEFAULT_ENTROPY_THRESHOLD,
  STRICT_ENTROPY_THRESHOLD,
  type EntropyEstimate,
  type EntropyScore,
} from './entropy';

// Signature Format Helpers
/**
 * Centralized signature format helpers for hex/base64/raw conversions
 * @example
 * ```typescript
 * // Convert bytes to hex
 * const hex = toHex(sigBytes);
 *
 * // Auto-detect and decode any format
 * const raw = decodeSignature('0xdeadbeef');
 * ```
 */
export {
  toHex,
  fromHex,
  toBase64,
  fromBase64,
  encodeSignature,
  decodeSignature,
} from './signature-format';

// Base58 encoding (hex/base64 come from signature-format above)
export { toBase58, fromBase58 } from './encoding';

// Key fingerprinting
export { keyFingerprint } from './fingerprint';

// Password Management
export { validatePasswordStrength } from './password';

// Encryption
export { encryptSecretKey, decryptSecretKey } from './encryption';
export type { EncryptedSecretKeyPayload } from './encryption';

// Mnemonics
export {
  generateMnemonic,
  validateMnemonic,
  validateMnemonicStrength,
  getEnglishWordlist,
  MnemonicValidationError,
  UnsupportedMnemonicLanguageError,
  SUPPORTED_MNEMONIC_LANGUAGE,
} from './mnemonic';

// Key Derivation
export { deriveKeypairFromMnemonic } from './key-derivation';

// Signing & Verification
export { signPayload, signTransaction, verifySignature } from './signing';

// Constant-time comparison
export { timingSafeEqual } from './timing-safe';
