import { SessionPermission } from '@ancore/types';

/**
 * Bit flags for each {@link SessionPermission} used in UI/SDK bitmask state.
 * Bit position matches the contract permission index (0, 1, 2).
 */
export const PERM_BITS: Readonly<Record<SessionPermission, number>> = {
  [SessionPermission.SEND_PAYMENT]: 1 << SessionPermission.SEND_PAYMENT,
  [SessionPermission.MANAGE_DATA]: 1 << SessionPermission.MANAGE_DATA,
  [SessionPermission.INVOKE_CONTRACT]: 1 << SessionPermission.INVOKE_CONTRACT,
};

/**
 * Contract-internal constant required in `Vec<u32>` for session keys that call `execute()`.
 * Distinct from the SDK bitmask representation above.
 */
export const PERMISSION_EXECUTE = 1;

/** All session permissions in contract index order. */
export const ALL_SESSION_PERMISSIONS: readonly SessionPermission[] = [
  SessionPermission.SEND_PAYMENT,
  SessionPermission.MANAGE_DATA,
  SessionPermission.INVOKE_CONTRACT,
];

const SESSION_PERMISSION_VALUES = new Set<number>(
  ALL_SESSION_PERMISSIONS.map((permission) => permission as number)
);

/**
 * Combine session permissions into a single bitmask for UI state.
 */
export function permissionsToBitmask(perms: SessionPermission[]): number {
  return perms.reduce((mask, permission) => mask | PERM_BITS[permission], 0);
}

/**
 * Expand a permission bitmask back into session permission enum values.
 */
export function bitmaskToPermissions(bitmask: number): SessionPermission[] {
  return ALL_SESSION_PERMISSIONS.filter((permission) => (bitmask & PERM_BITS[permission]) !== 0);
}

/**
 * Convert session permissions to the contract `Vec<u32>` representation.
 * Values are the permission indices (0, 1, 2), sorted and deduplicated.
 */
export function permissionsToContractVec(perms: SessionPermission[]): number[] {
  return [...new Set(perms.map((permission) => permission as number))].sort(
    (left, right) => left - right
  );
}

/**
 * Parse contract `Vec<u32>` permission values into session permissions.
 * Unknown values are omitted.
 */
export function contractVecToPermissions(vec: number[]): SessionPermission[] {
  return vec.filter((value): value is SessionPermission => SESSION_PERMISSION_VALUES.has(value));
}

/**
 * Convert a UI bitmask to the contract `Vec<u32>` representation.
 */
export function bitmaskToContractVec(bitmask: number): number[] {
  return permissionsToContractVec(bitmaskToPermissions(bitmask));
}

/** Returns true when the bitmask includes the given permission. */
export function hasPermission(bitmask: number, permission: SessionPermission): boolean {
  return (bitmask & PERM_BITS[permission]) !== 0;
}

/** Toggle a permission bit in the bitmask. */
export function togglePermission(bitmask: number, permission: SessionPermission): number {
  return hasPermission(bitmask, permission)
    ? bitmask & ~PERM_BITS[permission]
    : bitmask | PERM_BITS[permission];
}
