/**
 * Real relay-payload signing for the platform relayer's `/relay/execute`
 * endpoint (issue #1213 — previously every caller submitted a hardcoded fake
 * signature via `buildDefaultRelayPayload`).
 *
 * `buildRelayCanonicalPayload` is a browser-safe port of the relayer's own
 * `buildCanonicalPayload` (services/relayer/src/payload/builder.ts): the same
 * field order and JSON serialization, hex-encoded, using `TextEncoder`
 * instead of Node's `Buffer` since this ships in browser bundles (dashboard).
 * Field ordering and serialization must stay byte-identical to the server's
 * version — any change here must be mirrored there and versioned.
 */

export interface CanonicalPayloadInput {
  sessionKey: string;
  operation: string;
  nonce: number;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Build the canonical hex-encoded payload that the relayer signs/verifies
 * against. Must match `services/relayer/src/payload/builder.ts::buildCanonicalPayload`
 * byte-for-byte.
 */
export function buildRelayCanonicalPayload(input: CanonicalPayloadInput): string {
  const ordered = {
    sessionKey: input.sessionKey,
    operation: input.operation,
    nonce: input.nonce,
  };

  const json = JSON.stringify(ordered);
  return bytesToHex(new TextEncoder().encode(json));
}

/**
 * A real signer capable of producing the relay envelope's `sessionKey` and
 * `signature` fields atomically for a given operation+nonce. Kept
 * environment-agnostic so core-sdk has no hard dependency on the
 * browser-extension bridge — the caller (e.g. the web dashboard) supplies
 * the concrete implementation. Atomic (rather than a separate
 * "get my public key" + "sign this" pair) because the signer's own key
 * material never needs to leave its trust boundary as a bare value — it
 * computes the canonical payload internally and signs it in one step.
 */
export interface RelaySigner {
  signRelayEnvelope(input: {
    operation: string;
    nonce: number;
  }): Promise<{ sessionKey: string; signature: string }>;
}

export interface RelayExecuteParameters {
  to: string;
  amount: string;
  asset: string;
  /** Smart account C-address; lets the relayer's on-chain session-key check actually run. */
  accountAddress?: string;
  [key: string]: unknown;
}

export interface SignedRelayPayload {
  sessionKey: string;
  operation: 'relay_execute';
  parameters: RelayExecuteParameters;
  signature: string;
  nonce: number;
}

/**
 * Build a fully, genuinely signed relay-execute payload — replaces the
 * removed `buildDefaultRelayPayload`, which hardcoded a fake sessionKey/signature.
 */
export async function buildSignedRelayPayload(
  to: string,
  amount: string,
  signer: RelaySigner,
  opts: { asset?: string; accountAddress?: string } = {}
): Promise<SignedRelayPayload> {
  const nonce = Date.now() % 1_000_000;
  const asset = opts.asset ?? 'XLM';

  const { sessionKey, signature } = await signer.signRelayEnvelope({
    operation: 'relay_execute',
    nonce,
  });

  return {
    sessionKey,
    operation: 'relay_execute',
    parameters: {
      to,
      amount,
      asset,
      ...(opts.accountAddress ? { accountAddress: opts.accountAddress } : {}),
    },
    signature,
    nonce,
  };
}
