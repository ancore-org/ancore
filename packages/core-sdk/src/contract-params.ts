/**
 * @ancore/core-sdk - Contract Parameter Helpers
 *
 * Utility functions for encoding TypeScript values into Soroban ScVal types
 * used when invoking our account abstraction smart contract methods.
 *
 * These helpers keep the AccountTransactionBuilder code clean by centralizing
 * all ScVal conversion logic in one place.
 */

import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Stellar public key string (G…) to an ScVal address.
 *
 * @param publicKey - Stellar public key starting with 'G'
 * @returns ScVal wrapping the address
 * @throws If the public key is not a valid Stellar address
 */
export function toScAddress(publicKey: string): xdr.ScVal {
  if (!publicKey || !publicKey.startsWith('G')) {
    throw new Error(`Invalid Stellar public key: expected a G… address, received "${publicKey}"`);
  }

  return xdr.ScVal.scvAddress(Address.fromString(publicKey).toScAddress());
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/**
 * Encode a JavaScript number as an ScVal u64.
 *
 * @param value - Non-negative integer
 * @returns ScVal u64
 * @throws If the value is negative or not an integer
 */
export function toScU64(value: number): xdr.ScVal {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid u64 value: expected a non-negative integer, received ${value}`);
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
