import { Buffer } from 'node:buffer';
import { TextEncoder } from 'node:util';
import { Keypair } from '@stellar/stellar-sdk';

type SignableValue = string | Uint8Array;

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
