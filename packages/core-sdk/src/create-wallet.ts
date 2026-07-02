/**
 * create-wallet.ts
 *
 * Orchestration layer for the "create wallet" flow in @ancore/core-sdk.
 *
 * Wires together:
 *  1. BIP39 mnemonic generation          (@ancore/crypto → generateMnemonic)
 *  2. HD keypair derivation              (@ancore/crypto → deriveKeypairFromMnemonic)
 *  3. Optional secret-material encryption (@ancore/crypto → encryptSecretKey)
 *
 * Security contract:
 * - When `password` is provided the mnemonic is encrypted before being
 *   returned in `encryptedMnemonic`. Persist ONLY the encrypted form.
 * - When `password` is omitted, `encryptedMnemonic` is `undefined`. The
 *   caller is responsible for securing `secretKey` and `mnemonic`.
 *
 * @example
 * ```typescript
 * import { createWallet } from '@ancore/core-sdk';
 *
 * const wallet = await createWallet({ password: 'hunter2' });
 * console.log(wallet.publicKey);   // G…
 * console.log(wallet.contractId);  // C…
 * // Persist wallet.encryptedMnemonic only; do NOT persist wallet.secretKey
 * ```
 */

import {
  deriveKeypairFromMnemonic,
  encryptSecretKey,
  generateMnemonic,
  type EncryptedSecretKeyPayload,
} from '@ancore/crypto';

import { deriveContractId } from './wallet';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Options for {@link createWallet}.
 */
export interface CreateWalletParams {
  /**
   * Password used to encrypt the mnemonic. When omitted the wallet is created
   * without encryption — `encryptedMnemonic` will be `undefined` in the result.
   */
  password?: string;
  /**
   * BIP-44 account index used for HD derivation (default: 0).
   * Must be a non-negative integer.
   */
  accountIndex?: number;
}

/**
 * Typed result returned by {@link createWallet}.
 *
 * - `publicKey` and `contractId` are safe to persist and share.
 * - `mnemonic` and `secretKey` are **sensitive** — handle in-memory only.
 * - `encryptedMnemonic` is the encrypted form of `mnemonic` (only present
 *   when a password was supplied). Persist this instead of the raw mnemonic.
 */
export interface CreateWalletResult {
  /** BIP39 mnemonic phrase. Treat as a secret. */
  mnemonic: string;
  /** Stellar Ed25519 public key (G…). Safe to share. */
  publicKey: string;
  /** Stellar Ed25519 secret key (S…). Treat as a secret. */
  secretKey: string;
  /** HD account index used during derivation. */
  accountIndex: number;
  /** Deterministic contract ID derived from the public key (C…). Safe to share. */
  contractId: string;
  /**
   * PBKDF2-encrypted mnemonic. Present only when a `password` was provided.
   * Persist this value to durable storage instead of the raw mnemonic.
   */
  encryptedMnemonic?: EncryptedSecretKeyPayload;
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Creates a new Ancore wallet by:
 * 1. Generating a fresh BIP39 mnemonic
 * 2. Deriving an Ed25519 keypair via BIP-44 HD derivation
 * 3. Optionally encrypting the mnemonic with PBKDF2 + AES-GCM
 *
 * @throws {Error} If `accountIndex` is not a non-negative integer.
 */
export async function createWallet(params: CreateWalletParams = {}): Promise<CreateWalletResult> {
  const { password, accountIndex: rawIndex = 0 } = params;

  if (!Number.isInteger(rawIndex) || rawIndex < 0) {
    throw new Error('accountIndex must be a non-negative integer.');
  }

  // Step 1: Generate fresh BIP39 mnemonic
  const mnemonic = generateMnemonic();

  // Step 2: Derive keypair at the requested HD account index
  const keypair = deriveKeypairFromMnemonic(mnemonic, rawIndex);

  // Step 3: Encrypt the mnemonic if a password was supplied
  const encryptedMnemonic =
    password !== undefined ? await encryptSecretKey(mnemonic, password) : undefined;

  return {
    mnemonic,
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
    accountIndex: rawIndex,
    contractId: deriveContractId(keypair.publicKey()),
    encryptedMnemonic,
  };
}
