import type { SessionPermission } from '@ancore/types';
import { SessionPermission as SessionPermissionEnum } from '@ancore/types';

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
