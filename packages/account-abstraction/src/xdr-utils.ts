/**
 * XDR encoding/decoding helpers for account contract arguments and return values.
 * Maps between TypeScript types and Soroban ScVal for contracts/account.
 */

import { Address, nativeToScVal, scValToNative, StrKey, xdr } from '@stellar/stellar-sdk';
import type { SessionKey } from './session-key';

const BYTES_N_32_LENGTH = 32;

/**
 * Encode a Stellar address (G... or C...) to ScVal for contract Address type.
 */
export function addressToScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

/**
 * Encode a 32-byte session public key to ScVal (BytesN<32>).
 * Accepts Stellar public key string (G...) or raw 32-byte Uint8Array.
 */
export function publicKeyToBytes32ScVal(publicKey: string | Uint8Array): xdr.ScVal {
  let bytes: Uint8Array;
  if (typeof publicKey === 'string') {
    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      throw new TypeError(
        `Invalid Ed25519 public key: expected G... format, got ${publicKey.slice(0, 8)}...`
      );
    }
    const buf = StrKey.decodeEd25519PublicKey(publicKey);
    bytes = new Uint8Array(buf);
  } else {
    bytes = publicKey;
  }
  if (bytes.length !== BYTES_N_32_LENGTH) {
    throw new TypeError(`Session key must be ${BYTES_N_32_LENGTH} bytes, got ${bytes.length}`);
  }
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

/**
 * Encode a number to u64 ScVal (for expires_at, nonce, etc.).
 */
export function u64ToScVal(value: number | bigint): xdr.ScVal {
  return nativeToScVal(typeof value === 'bigint' ? value : BigInt(value));
}

/**
 * Encode permissions array to ScVal Vec<u32>.
 */
export function permissionsToScVal(permissions: number[]): xdr.ScVal {
  const scVals = permissions.map((p) => xdr.ScVal.scvU32(p));
  return xdr.ScVal.scvVec(scVals);
}

/**
 * Encode contract symbol (function name) to ScVal.
 */
export function symbolToScVal(name: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(Buffer.from(name, 'utf8'));
}

/**
 * Decode ScVal to Stellar address string.
 */
export function scValToAddress(scVal: xdr.ScVal): string {
  const native = scValToNative(scVal);
  if (typeof native !== 'string') {
    throw new TypeError('Expected address string from ScVal');
  }
  return native;
}

/**
 * Decode ScVal to number (u64).
 */
export function scValToU64(scVal: xdr.ScVal): number {
  const native = scValToNative(scVal);
  if (typeof native === 'bigint') return Number(native);
  if (typeof native === 'number') return native;
  throw new TypeError('Expected u64 number from ScVal');
}

/**
 * Decode ScVal to 32-byte public key as G... string.
 */
export function bytes32ScValToPublicKey(scVal: xdr.ScVal): string {
  const native = scValToNative(scVal);
  if (native instanceof Uint8Array && native.length === BYTES_N_32_LENGTH) {
    return StrKey.encodeEd25519PublicKey(Buffer.from(native));
  }
  if (Buffer.isBuffer(native) && native.length === BYTES_N_32_LENGTH) {
    return StrKey.encodeEd25519PublicKey(native);
  }
  throw new TypeError('Expected 32-byte bytes from ScVal');
}

/**
 * Decode contract SessionKey struct (map) to @ancore/types SessionKey.
 * Contract struct: { public_key: BytesN<32>, expires_at: u64, permissions: Vec<u32> }
 */
export function scValToSessionKey(scVal: xdr.ScVal): SessionKey {
  const native = scValToNative(scVal);
  if (typeof native !== 'object' || native === null || Array.isArray(native)) {
    throw new TypeError('Expected map for SessionKey');
  }
  const map = native as Record<string, unknown>;
  const publicKey = map.public_key;
  const expiresAt = map.expires_at;
  const permissions = map.permissions;

  if (publicKey == null || expiresAt == null || permissions == null) {
    throw new TypeError('SessionKey map must have public_key, expires_at, permissions');
  }

  let publicKeyStr: string;
  if (publicKey instanceof Uint8Array || Buffer.isBuffer(publicKey)) {
    publicKeyStr = StrKey.encodeEd25519PublicKey(Buffer.from(publicKey as Uint8Array));
  } else {
    throw new TypeError('SessionKey.public_key must be 32 bytes');
  }

  const expiresAtNum =
    typeof expiresAt === 'bigint'
      ? Number(expiresAt)
      : typeof expiresAt === 'number'
        ? expiresAt
        : Number(expiresAt);

  const permsArray = Array.isArray(permissions)
    ? (permissions as number[]).map((p) => (typeof p === 'bigint' ? Number(p) : (p as number)))
    : [];

  return {
    publicKey: publicKeyStr,
    expiresAt: expiresAtNum,
    permissions: permsArray,
  };
}

/**
 * Decode optional SessionKey (Option<SessionKey>) from contract get_session_key.
 * Returns null if the option is None (void or missing).
 */
export function scValToOptionalSessionKey(scVal: xdr.ScVal): SessionKey | null {
  const native = scValToNative(scVal);
  if (native === null || native === undefined) return null;
  try {
    return scValToSessionKey(scVal);
  } catch {
    return null;
  }
}
