/**
 * Session permission bitmap constants for session keys.
 * Each permission maps to a single bit position for efficient bitmap operations.
 */
export enum SessionPermission {
  /**
   * Permission to transfer assets (1 << 0 = 0x01).
   * Allows the session key to initiate asset transfers.
   */
  Transfer = 1 << 0,

  /**
   * Permission to invoke smart contracts (1 << 1 = 0x02).
   * Allows the session key to call contract functions.
   */
  Invoke = 1 << 1,

  /**
   * Permission to manage other session keys (1 << 2 = 0x04).
   * Allows the session key to add/remove session keys.
   */
  ManageSessions = 1 << 2,

  /**
   * Permission to approve spending (1 << 3 = 0x08).
   * Allows the session key to approve token allowances.
   */
  Approve = 1 << 3,
}

/**
 * Check if a permission bitmap contains a specific permission.
 */
export function hasPermission(permissions: number, permission: SessionPermission): boolean {
  return (permissions & permission) === permission;
}

/**
 * Add a permission to a bitmap.
 */
export function addPermission(permissions: number, permission: SessionPermission): number {
  return permissions | permission;
}

/**
 * Remove a permission from a bitmap.
 */
export function removePermission(permissions: number, permission: SessionPermission): number {
  return permissions & ~permission;
}

/**
 * Combine multiple permissions into a single bitmap.
 */
export function combinePermissions(...perms: SessionPermission[]): number {
  return perms.reduce((acc, perm) => acc | perm, 0);
}
