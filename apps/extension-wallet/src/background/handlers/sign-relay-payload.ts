import { buildRelayCanonicalPayload } from '@ancore/core-sdk';
import { registerHandler } from '@/messaging';
import { isBackgroundSessionUnlocked } from '../session-state';
import { getSigningKeypair } from '../signing-key';

export interface SignRelayPayloadParams {
  operation: string;
  nonce: number;
}

export interface SignRelayPayloadResult {
  /** Hex-encoded 32-byte Ed25519 public key — the real relay `sessionKey`. */
  sessionKey: string;
  /** Hex-encoded 64-byte Ed25519 signature over the canonical payload. */
  signature: string;
}

function bytesToHex(bytes: Uint8Array | Buffer): string {
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Sign a relay envelope for the platform relayer's `/relay/execute` endpoint
 * (issue #1213). The wallet computes its own `sessionKey` (its real public
 * key) and the canonical payload internally — using the exact same
 * `buildRelayCanonicalPayload` the relayer verifies against — then signs it,
 * returning both fields atomically. Callers never need a separate "what's
 * your public key" round trip.
 *
 * Uses the account owner's key: true delegated session-key signing isn't
 * available end-to-end yet (requestSessionKey is still an MVP stub that
 * never persists the generated secret), so the owner key is the real signing
 * surface that actually exists today.
 */
export async function signRelayPayload(
  params: SignRelayPayloadParams
): Promise<SignRelayPayloadResult> {
  const { operation, nonce } = params;

  if (!operation || typeof operation !== 'string') {
    throw new Error('Invalid operation');
  }
  if (typeof nonce !== 'number' || !Number.isFinite(nonce)) {
    throw new Error('Invalid nonce');
  }

  if (!isBackgroundSessionUnlocked()) {
    throw new Error('Wallet is locked');
  }

  const kp = await getSigningKeypair();
  const sessionKey = bytesToHex(kp.rawPublicKey());
  const payloadHex = buildRelayCanonicalPayload({ sessionKey, operation, nonce });
  const signature = bytesToHex(kp.sign(new TextEncoder().encode(payloadHex)));

  return { sessionKey, signature };
}

/**
 * Register the internal SIGN_RELAY_PAYLOAD handler for popup ↔ background messages.
 */
export function registerSignRelayPayloadHandlers(): void {
  registerHandler('SIGN_RELAY_PAYLOAD', async (params: SignRelayPayloadParams) =>
    signRelayPayload(params)
  );
}
