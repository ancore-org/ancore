/**
 * @ancore/core-sdk - Contract Parameter Helpers
 *
 * Utility functions for encoding TypeScript values into Soroban ScVal types
 * used when invoking our account abstraction smart contract methods.
 *
 * These helpers keep the AccountTransactionBuilder code clean by centralizing
 * all ScVal conversion logic in one place.
 */

import { Address, nativeToScVal, xdr, StrKey } from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Stellar address string (G… account or C… contract) to an ScVal
 * address. Soroban's `Address` type covers both — callers like `execute()`'s
 * `to` parameter address a target *contract* (C…), not an account, so this
 * must not be restricted to G-only.
 *
 * @param address - Stellar account (G…) or contract (C…) address
 * @returns ScVal wrapping the address
 * @throws If the address is not a valid Stellar G… or C… address
 */
export function toScAddress(address: string): xdr.ScVal {
  if (!address || !(address.startsWith('G') || address.startsWith('C'))) {
    throw new Error(`Invalid Stellar public key: expected a G… address, received "${address}"`);
  }

  return xdr.ScVal.scvAddress(Address.fromString(address).toScAddress());
}

/**
 * Convert a Stellar public key (G…) to BytesN<32> for contract methods.
 * The contract expects raw 32-byte Ed25519 public keys, not Address types.
 *
 * @param publicKey - Stellar public key starting with 'G'
 * @returns ScVal BytesN<32> containing the raw public key bytes
 * @throws If the public key is not a valid Stellar Ed25519 public key
 */
export function toScBytesN32(publicKey: string): xdr.ScVal {
  if (!publicKey || !publicKey.startsWith('G')) {
    throw new Error(`Invalid Stellar public key: expected a G… address, received "${publicKey}"`);
  }

  // Decode the G… key to get raw 32 bytes
  const rawBytes = StrKey.decodeEd25519PublicKey(publicKey);
  return nativeToScVal(rawBytes, { type: 'bytes' });
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/**
 * Encode a JavaScript number as an ScVal u64.
 *
 * Values above `Number.MAX_SAFE_INTEGER` are rejected rather than encoded.
 * `Number.isInteger` returns true for them, but the JavaScript number has
 * already lost precision by the time it reaches this function, so encoding it
 * would silently write a different u64 than the caller asked for. No
 * legitimate caller hits this — the only u64 the contract takes is an
 * expiration timestamp — so refusing is strictly better than guessing.
 *
 * @param value - Non-negative integer, at most `Number.MAX_SAFE_INTEGER`
 * @returns ScVal u64
 * @throws If the value is negative, not an integer, or beyond safe precision
 */
export function toScU64(value: number): xdr.ScVal {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid u64 value: expected a non-negative integer, received ${value}`);
  }

  if (value > Number.MAX_SAFE_INTEGER) {
    throw new Error(
      `Invalid u64 value: ${value} exceeds Number.MAX_SAFE_INTEGER and cannot be ` +
        'represented exactly by a JavaScript number'
    );
  }

  return nativeToScVal(value, { type: 'u64' });
}

/**
 * Encode a JavaScript number as an ScVal u32.
 *
 * @param value - Non-negative integer ≤ 2^32 - 1
 * @returns ScVal u32
 * @throws If the value is out of u32 range
 */
export function toScU32(value: number): xdr.ScVal {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error(`Invalid u32 value: expected 0 ≤ n ≤ ${0xffff_ffff}, received ${value}`);
  }

  return nativeToScVal(value, { type: 'u32' });
}

// ---------------------------------------------------------------------------
// Collection helpers
// ---------------------------------------------------------------------------

/**
 * Encode an array of permission numbers as an ScVal Vec<u32>.
 *
 * @param permissions - Array of permission enum values (0, 1, 2, …)
 * @returns ScVal vec of u32 values
 */
export function toScPermissionsVec(permissions: number[]): xdr.ScVal {
  if (!Array.isArray(permissions)) {
    throw new Error('Permissions must be an array of numbers');
  }

  const items = permissions.map((p) => toScU32(p));
  return xdr.ScVal.scvVec(items);
}

/**
 * Encode an array of Stellar XDR operations into an ScVal Vec for the
 * `execute` contract method.
 *
 * Each operation is serialized to its XDR bytes and wrapped as ScVal bytes.
 *
 * @param operations - Array of Stellar XDR operations
 * @returns ScVal vec of bytes values
 */
export function toScOperationsVec(operations: xdr.Operation[]): xdr.ScVal {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('Operations must be a non-empty array of xdr.Operation values');
  }

  const items = operations.map((op) => {
    const bytes = op.toXDR();
    return xdr.ScVal.scvBytes(bytes);
  });

  return xdr.ScVal.scvVec(items);
}

/**
 * Encode an optional value as an ScVal Option type.
 *
 * @param value - The value to wrap, or null/undefined for None
 * @param converter - Function to convert the value to ScVal if present
 * @returns ScVal option (Some or None)
 */
export function toScOption<T>(
  value: T | null | undefined,
  converter: (v: T) => xdr.ScVal
): xdr.ScVal {
  if (value === null || value === undefined) {
    return nativeToScVal(null, { type: 'option' });
  }
  return nativeToScVal(converter(value), { type: 'option' });
}

/**
 * Encode an array of Stellar addresses as an ScVal Vec<Address>.
 *
 * @param addresses - Array of Stellar addresses (G… or C… format)
 * @returns ScVal vec of addresses
 */
export function toScAddressVec(addresses: string[]): xdr.ScVal {
  if (!Array.isArray(addresses)) {
    throw new Error('Addresses must be an array of strings');
  }

  const items = addresses.map((addr) => {
    const address = Address.fromString(addr);
    return xdr.ScVal.scvAddress(address.toScAddress());
  });

  return xdr.ScVal.scvVec(items);
}

/**
 * Encode a JavaScript number as an ScVal i128.
 *
 * @param value - Integer value
 * @returns ScVal i128
 */
export function toScI128(value: number | string | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: 'i128' });
}

/**
 * CallerIdentity enum for the execute method.
 * Maps to the contract's CallerIdentity enum.
 */
export enum CallerIdentity {
  Owner = 'Owner',
  SessionKey = 'SessionKey',
  Quorum = 'Quorum',
}

/**
 * Encode CallerIdentity enum for the execute method.
 *
 * @param identity - The caller identity type
 * @param data - Optional data (BytesN<32> for SessionKey, Vec<Address> for Quorum)
 * @returns ScVal enum representation
 */
export function toScCallerIdentity(identity: CallerIdentity, data?: xdr.ScVal): xdr.ScVal {
  if (identity === CallerIdentity.Owner) {
    return nativeToScVal({ tag: 'Owner', values: undefined }, { type: 'symbol' });
  }

  if (identity === CallerIdentity.SessionKey && data) {
    const enumVariant = xdr.ScVal.scvVec([nativeToScVal('SessionKey', { type: 'symbol' }), data]);
    return enumVariant;
  }

  if (identity === CallerIdentity.Quorum && data) {
    const enumVariant = xdr.ScVal.scvVec([nativeToScVal('Quorum', { type: 'symbol' }), data]);
    return enumVariant;
  }

  throw new Error(`Invalid CallerIdentity: ${identity} with data: ${data}`);
}

/**
 * Encode bytes as an ScVal Bytes type.
 *
 * @param bytes - Raw bytes or Uint8Array
 * @returns ScVal bytes
 */
export function toScBytes(bytes: Uint8Array | Buffer): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
}
