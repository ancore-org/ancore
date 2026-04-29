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

export { validatePasswordStrength } from './password';
export { encryptSecretKey, decryptSecretKey } from './encryption';
export type { EncryptedSecretKeyPayload } from './encryption';
export { generateMnemonic, validateMnemonic } from './mnemonic';
export { deriveKeypairFromMnemonic } from './key-derivation';
export { randomBytes } from './random';
