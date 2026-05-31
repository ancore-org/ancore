import { Keypair, Transaction, FeeBumpTransaction } from '@stellar/stellar-sdk';
import { decodeSignature } from './signature-format';

type SignableValue = string | Uint8Array;
type SignableKeypair = Keypair | string;

function toMessageBytes(message: SignableValue): Uint8Array {
  return typeof message === 'string' ? new TextEncoder().encode(message) : message;
}

/**
 * Signs a Stellar transaction with the provided keypair locally.
 *
 * Supported transaction envelope types:
 * - Transaction: Standard Stellar transaction envelopes.
 * - FeeBumpTransaction: Transaction envelopes that wrap another transaction to bump fees.
 *
 * Unsupported types (e.g., MuxedTransaction, TransactionEnvelope variants other than
 * Transaction/FeeBumpTransaction) will throw a descriptive error. See CRYPTO_ASSUMPTIONS.md
 * for the full envelope type assumptions.
 *
 * @param tx - The transaction to sign (must be Transaction or FeeBumpTransaction).
 * @param keypair - The Ed25519 keypair or secret key string to sign with.
 * @returns The produced signature as a Uint8Array.
 * @throws Error if tx is not a supported transaction type.
 */
export async function signTransaction(
  tx: Transaction | FeeBumpTransaction,
  keypair: SignableKeypair
): Promise<Uint8Array> {
  // Runtime guard: verify envelope type before signing
  if (!(tx instanceof Transaction) && !(tx instanceof FeeBumpTransaction)) {
    throw new Error(
      'Unsupported transaction type. Supported types: Transaction, FeeBumpTransaction. See CRYPTO_ASSUMPTIONS.md'
    );
  }
  let kp: Keypair;

  try {
    kp = typeof keypair === 'string' ? Keypair.fromSecret(keypair) : keypair;
  } catch {
    throw new Error('Invalid secret key or keypair provided for signing.');
  }

  // The SDK's sign() method internally calculates the transaction hash and adds the signature.
  // This is the most robust way to ensure the signature is attached to the envelope correctly.
  tx.sign(kp);

  // Extract the raw signature bytes from the last added signature
  const lastSignature = tx.signatures[tx.signatures.length - 1];
  if (!lastSignature) {
    throw new Error('Failed to produce a signature for the transaction.');
  }

  return Uint8Array.from(lastSignature.signature());
}

/**
 * Verify an Ed25519 signature against a message using a Stellar public key.
 */
export async function verifySignature(
  message: SignableValue,
  signature: SignableValue,
  publicKey: string
): Promise<boolean> {
  try {
    const messageBytes = toMessageBytes(message);
    const signatureBytes = decodeSignature(signature);
    const keypair = Keypair.fromPublicKey(publicKey);

    return keypair.verify(messageBytes as unknown as Buffer, signatureBytes as unknown as Buffer);
  } catch {
    return false;
  }
}
