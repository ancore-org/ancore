/**
 * XDR encoding/decoding helpers for account contract arguments and return values.
 * Maps between TypeScript types and Soroban ScVal for contracts/account.
 */

import type { SessionKey } from '@ancore/types';
import { Address, nativeToScVal, scValToNative, StrKey, xdr } from '@stellar/stellar-sdk';

const BYTES_N_32_LENGTH = 32;

export interface InitializeParams {
  owner: string;
}

export interface ExecuteParams {
  to: string;
  functionName: string;
  args: xdr.ScVal[];
  expectedNonce: number | bigint;
}

export interface SessionKeyParams {
  publicKey: string | Uint8Array;
}

export interface AddSessionKeyParams extends SessionKeyParams {
  expiresAt: number | bigint;
  permissions: number[];
}

function assertArgumentCount(args: xdr.ScVal[], expected: number, method: string): void {
  if (args.length !== expected) {
    throw new TypeError(
      `${method} expects ${expected} argument${expected === 1 ? '' : 's'}, got ${args.length}`
    );
  }
}

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
 * Encode initialize(owner) invocation args.
 */
export function encodeInitializeArgs({ owner }: InitializeParams): xdr.ScVal[] {
  return [addressToScVal(owner)];
}

/**
 * Decode initialize(owner) invocation args.
 */
export function decodeInitializeArgs(args: xdr.ScVal[]): InitializeParams {
  assertArgumentCount(args, 1, 'initialize');
  return { owner: scValToAddress(args[0]) };
}

/**
 * Encode execute(to, function, args, expected_nonce) invocation args.
 */
export function encodeExecuteArgs({
  to,
  functionName,
  args,
  expectedNonce,
}: ExecuteParams): xdr.ScVal[] {
  return [
    addressToScVal(to),
    symbolToScVal(functionName),
    xdr.ScVal.scvVec(args),
    u64ToScVal(expectedNonce),
  ];
}

/**
 * Decode execute(to, function, args, expected_nonce) invocation args.
 */
export function decodeExecuteArgs(args: xdr.ScVal[]): ExecuteParams {
  assertArgumentCount(args, 4, 'execute');

  const fn = scValToNative(args[1]);
  if (typeof fn !== 'string') {
    throw new TypeError('execute function name must decode to a string');
  }

  const nativeArgs = scValToNative(args[2]);
  if (!Array.isArray(nativeArgs)) {
    throw new TypeError('execute args must decode to an array');
  }

  return {
    to: scValToAddress(args[0]),
    functionName: fn,
    args: args[2].vec() ?? [],
    expectedNonce: scValToU64(args[3]),
  };
}

/**
 * Encode add_session_key(public_key, expires_at, permissions) invocation args.
 */
export function encodeAddSessionKeyArgs({
  publicKey,
  expiresAt,
  permissions,
}: AddSessionKeyParams): xdr.ScVal[] {
  return [
    publicKeyToBytes32ScVal(publicKey),
    u64ToScVal(expiresAt),
    permissionsToScVal(permissions),
  ];
}

/**
 * Decode add_session_key(public_key, expires_at, permissions) invocation args.
 */
export function decodeAddSessionKeyArgs(args: xdr.ScVal[]): {
  publicKey: string;
  expiresAt: number;
  permissions: number[];
} {
  assertArgumentCount(args, 3, 'add_session_key');

  const nativePermissions = scValToNative(args[2]);
  if (!Array.isArray(nativePermissions)) {
    throw new TypeError('permissions must decode to an array');
  }

  return {
    publicKey: bytes32ScValToPublicKey(args[0]),
    expiresAt: scValToU64(args[1]),
    permissions: nativePermissions.map((permission) =>
      typeof permission === 'bigint' ? Number(permission) : Number(permission)
    ),
  };
}

/**
 * Encode revoke_session_key(public_key) invocation args.
 */
export function encodeRevokeSessionKeyArgs({ publicKey }: SessionKeyParams): xdr.ScVal[] {
  return [publicKeyToBytes32ScVal(publicKey)];
}

/**
 * Decode revoke_session_key(public_key) invocation args.
 */
export function decodeRevokeSessionKeyArgs(args: xdr.ScVal[]): {
  publicKey: string;
} {
  assertArgumentCount(args, 1, 'revoke_session_key');
  return { publicKey: bytes32ScValToPublicKey(args[0]) };
}

/**
 * Encode get_session_key(public_key) invocation args.
 */
export function encodeGetSessionKeyArgs({ publicKey }: SessionKeyParams): xdr.ScVal[] {
  return [publicKeyToBytes32ScVal(publicKey)];
}

/**
 * Decode get_session_key(public_key) invocation args.
 */
export function decodeGetSessionKeyArgs(args: xdr.ScVal[]): {
  publicKey: string;
} {
  assertArgumentCount(args, 1, 'get_session_key');
  return { publicKey: bytes32ScValToPublicKey(args[0]) };
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

/**
 * Encode a SessionKey struct to ScVal using deterministic field order.
 */
export function sessionKeyToScVal(sessionKey: SessionKey): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: symbolToScVal('expires_at'),
      val: u64ToScVal(sessionKey.expiresAt),
    }),
    new xdr.ScMapEntry({
      key: symbolToScVal('permissions'),
      val: permissionsToScVal(sessionKey.permissions),
    }),
    new xdr.ScMapEntry({
      key: symbolToScVal('public_key'),
      val: publicKeyToBytes32ScVal(sessionKey.publicKey),
    }),
  ]);
}

/**
 * Decode get_owner result.
 */
export function decodeOwnerResult(scVal: xdr.ScVal): string {
  return scValToAddress(scVal);
}

/**
 * Decode get_nonce result.
 */
export function decodeNonceResult(scVal: xdr.ScVal): number {
  return scValToU64(scVal);
}

/**
 * Decode execute result.
 */
export function decodeExecuteResult(scVal: xdr.ScVal): boolean {
  const native = scValToNative(scVal);
  if (typeof native !== 'boolean') {
    throw new TypeError('Expected boolean execute result from ScVal');
  }
  return native;
}

/**
 * Decode get_session_key result.
 */
export function decodeSessionKeyResult(scVal: xdr.ScVal): SessionKey | null {
  return scValToOptionalSessionKey(scVal);
}

/**
 * Decode unit/void result for mutation calls.
 */
export function decodeVoidResult(scVal: xdr.ScVal): void {
  const native = scValToNative(scVal);
  if (native !== undefined && native !== null) {
    throw new TypeError('Expected void result from ScVal');
  }
}
