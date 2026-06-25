/**
 * Canonical payload builder for signature verification.
 *
 * This module provides a deterministic serialization of relay request fields
 * into a canonical byte representation. The hash stability of this representation
 * is critical for signature verification across client and server.
 *
 * Field ordering and JSON serialization must remain stable across versions.
 * Any changes to the canonical format must be versioned and documented.
 */

export interface CanonicalPayloadInput {
  sessionKey: string;
  operation: string;
  nonce: number;
}

/**
 * Build a canonical hex-encoded payload from relay request fields.
 *
 * The payload is constructed as follows:
 * 1. Create a JSON object with fields in deterministic order: sessionKey, operation, nonce
 * 2. Serialize to compact JSON (no whitespace)
 * 3. Encode as UTF-8 bytes
 * 4. Convert to hex string
 *
 * This function guarantees:
 * - Same logical input produces identical byte sequence
 * - Field order is consistent (sessionKey, operation, nonce)
 * - No extraneous whitespace or formatting
 * - Deterministic JSON.stringify behavior
 *
 * @param input - The relay request fields to serialize
 * @returns Hex-encoded canonical payload
 */
export function buildCanonicalPayload(input: CanonicalPayloadInput): string {
  const ordered = {
    sessionKey: input.sessionKey,
    operation: input.operation,
    nonce: input.nonce,
  };

  const json = JSON.stringify(ordered);
  return Buffer.from(json, 'utf8').toString('hex');
}

/**
 * Hash a canonical payload for versioning and snapshot testing.
 *
 * @param payload - Hex-encoded canonical payload
 * @returns SHA-256 hash of the payload as hex string
 */
export function hashPayload(payload: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(payload, 'hex').digest('hex');
}
