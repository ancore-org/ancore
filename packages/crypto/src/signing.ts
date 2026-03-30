import { Buffer } from 'node:buffer';
import { TextEncoder } from 'node:util';
import { Keypair, Transaction, FeeBumpTransaction } from '@stellar/stellar-sdk';

type SignableValue = string | Uint8Array;
type SignableKeypair = Keypair | string;

function toMessageBytes(message: SignableValue): Uint8Array {
  return typeof message === 'string' ? new TextEncoder().encode(message) : message;
}

function isHex(value: string): boolean {
  return value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value);
}

function decodeSignature(signature: SignableValue): Uint8Array {
  if (signature instanceof Uint8Array) {
    return signature;
  }

  if (isHex(signature)) {
    return Uint8Array.from(Buffer.from(signature, 'hex'));
  }

  return Uint8Array.from(Buffer.from(signature, 'base64'));
}

/**
 * Signs a Stellar transaction with the provided keypair locally.
 *
 * @param tx - The transaction to sign (standard or fee-bump).
 * @param keypair - The Ed25519 keypair or secret key string to sign with.
 * @returns The produced signature as a Uint8Array.
 */
export async function signTransaction(
  tx: Transaction | FeeBumpTransaction,
  keypair: SignableKeypair
): Promise<Uint8Array> {
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

    return keypair.verify(Buffer.from(messageBytes), Buffer.from(signatureBytes));
  } catch {
    return false;
  }
}
