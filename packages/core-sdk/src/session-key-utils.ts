import type { SessionPermission } from '@ancore/types';
import { SessionPermission as SessionPermissionEnum } from '@ancore/types';

// ---------------------------------------------------------------------------
// isSessionKeyActive
// ---------------------------------------------------------------------------

/**
 * Options for isSessionKeyActive.
 */
export interface IsSessionKeyActiveOptions {
  /**
   * Override the current time (Unix timestamp in milliseconds).
   * Defaults to Date.now(). Useful for deterministic testing.
   */
  nowMs?: number;
}

/**
 * Typed error codes returned when a session key is not active.
 */
export type SessionKeyInactiveReason = 'EXPIRED' | 'REVOKED' | 'UNKNOWN_KEY';

/**
 * Checks whether a session key is currently active.
 *
 * A key is considered active when:
 *  - Its `expiresAt` timestamp (Unix seconds) is in the future relative to `nowMs`.
 *  - It has not been explicitly revoked (indicated by `expiresAt === 0`).
 *
 * @param key - The session key object (must have `expiresAt: number` in Unix seconds).
 * @param options - Optional overrides (e.g. `nowMs` for testing).
 * @returns `true` when the key is active, `false` otherwise.
 *
 * @example
 * const active = isSessionKeyActive({ expiresAt: Date.now() / 1000 + 3600, publicKey: '...' });
 * // true — expires in 1 hour
 *
 * @example
 * const active = isSessionKeyActive({ expiresAt: 0, publicKey: '...' });
 * // false — revoked (expiresAt sentinel value)
 */
export function isSessionKeyActive(
  key: { expiresAt: number; publicKey?: string },
  options?: IsSessionKeyActiveOptions
): boolean {
  const nowMs = options?.nowMs ?? Date.now();
  const nowSeconds = nowMs / 1000;

  // expiresAt === 0 is the sentinel for a revoked key
  if (key.expiresAt === 0) {
    return false;
  }

  return key.expiresAt > nowSeconds;
}

/**
 * Returns the reason a session key is inactive, or `null` if it is active.
 *
 * Useful for mapping contract errors to typed SDK errors in UI layers.
 *
 * @example
 * const reason = getSessionKeyInactiveReason(key);
 * if (reason === 'EXPIRED') { ... }
 */
export function getSessionKeyInactiveReason(
  key: { expiresAt: number; publicKey?: string },
  options?: IsSessionKeyActiveOptions
): SessionKeyInactiveReason | null {
  const nowMs = options?.nowMs ?? Date.now();
  const nowSeconds = nowMs / 1000;

  if (key.expiresAt === 0) {
    return 'REVOKED';
  }

  if (key.expiresAt <= nowSeconds) {
    return 'EXPIRED';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Permission label helpers (existing)
// ---------------------------------------------------------------------------

/**
 * Maps a session permission enum value to a human-readable label.
 * Useful for logs, error messages, and UI display.
 *
 * @param permission - The permission enum value (0, 1, 2) or SessionPermission enum member
 * @returns A human-readable string label for the permission
 *
 * @example
 * permissionToLabel(SessionPermission.SEND_PAYMENT) // "Send Payment"
 * permissionToLabel(0) // "Send Payment"
 * permissionToLabel(999) // "Unknown Permission (999)"
 */
export function permissionToLabel(permission: SessionPermission | number): string {
  switch (permission) {
    case SessionPermissionEnum.SEND_PAYMENT:
      return 'Send Payment';
    case SessionPermissionEnum.MANAGE_DATA:
      return 'Manage Data';
    case SessionPermissionEnum.INVOKE_CONTRACT:
      return 'Invoke Contract';
    default:
      return `Unknown Permission (${permission})`;
  }
}

/**
 * Maps multiple session permissions to human-readable labels.
 *
 * @param permissions - Array of permission enum values
 * @returns Array of human-readable labels corresponding to the input permissions
 *
 * @example
 * permissionsToLabels([SessionPermission.SEND_PAYMENT, SessionPermission.MANAGE_DATA])
 * // ["Send Payment", "Manage Data"]
 */
export function permissionsToLabels(permissions: (SessionPermission | number)[]): string[] {
  return permissions.map(permissionToLabel);
}

/**
 * Creates a formatted string representation of session permissions for logging.
 *
 * @param permissions - Array of permission enum values
 * @returns Comma-separated string of permission labels
 *
 * @example
 * formatPermissions([SessionPermission.SEND_PAYMENT, SessionPermission.INVOKE_CONTRACT])
 * // "Send Payment, Invoke Contract"
 */
export function formatPermissions(permissions: (SessionPermission | number)[]): string {
  return permissionsToLabels(permissions).join(', ');
}
