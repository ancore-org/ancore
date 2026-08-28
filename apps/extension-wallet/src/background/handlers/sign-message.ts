import { registerHandler } from '@/messaging';
import { isBackgroundSessionUnlocked } from '../session-state';
import { getSigningKeypair } from '../signing-key';

// Buffer is provided by the extension polyfill (see polyfills.ts).
// In tests, vitest runs in a Node environment where Buffer is native.
declare const Buffer: typeof import('buffer').Buffer;

export interface SignMessageParams {
  message: string;
  networkPassphrase?: string;
}

export interface SignMessageResult {
  /** Hex-encoded 64-byte Ed25519 signature over the raw UTF-8 bytes of `message`. */
  signature: string;
}

/**
 * Sign an arbitrary message (SEP-53 style) with the account owner's real keypair.
 *
 * Used by both the internal popup ↔ background message path and the
 * service-worker approval resolution path (mirrors `signAuthEntry`'s shape).
 *
 * The message is signed as-is — raw UTF-8 bytes, no SEP-53 preamble wrapping —
 * to match the relayer's `Ed25519SignatureService`, which verifies
 * `Buffer.from(payload, 'utf8')` directly against the canonical relay payload.
 */
export async function signMessage(params: SignMessageParams): Promise<SignMessageResult> {
  const { message } = params;

  if (!message || typeof message !== 'string' || message.length === 0) {
    throw new Error('Invalid message');
  }

  if (!isBackgroundSessionUnlocked()) {
    throw new Error('Wallet is locked');
  }

  const kp = await getSigningKeypair();
  const signature = kp.sign(Buffer.from(message, 'utf8'));

  return { signature: Buffer.from(signature).toString('hex') };
}

/**
 * Register the internal SIGN_MESSAGE handler for popup ↔ background messages.
 */
export function registerSignMessageHandlers(): void {
  registerHandler('SIGN_MESSAGE', async (params: SignMessageParams) => signMessage(params));
}
