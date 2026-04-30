/**
 * Permission formatting utilities for session keys.
 * Provides human-readable labels for permission values in logs and UI.
 */

/**
 * Maps a session permission value to a human-readable label.
 * Useful for logs, error messages, and UI display.
 *
 * @param permission - The permission number value (0, 1, 2, etc.)
 * @returns A human-readable string label for the permission
 *
 * @example
 * formatPermissionLabel(0) // "Send Payment"
 * formatPermissionLabel(1) // "Manage Data"
 * formatPermissionLabel(2) // "Invoke Contract"
 * formatPermissionLabel(999) // "Unknown Permission (999)"
 */
export function formatPermissionLabel(permission: number): string {
  switch (permission) {
    case 0:
      return 'Send Payment';
    case 1:
      return 'Manage Data';
    case 2:
      return 'Invoke Contract';
    default:
      return `Unknown Permission (${permission})`;
  }
}

/**
 * Maps multiple session permission values to human-readable labels.
 *
 * @param permissions - Array of permission number values
 * @returns Array of human-readable labels corresponding to the input permissions
 *
 * @example
 * formatPermissionLabels([0, 1]) // ["Send Payment", "Manage Data"]
 */
export function formatPermissionLabels(permissions: number[]): string[] {
  return permissions.map(formatPermissionLabel);
}

/**
 * Creates a formatted string representation of session permissions for logging.
 *
 * @param permissions - Array of permission number values
 * @returns Comma-separated string of permission labels
 *
 * @example
 * formatPermissions([0, 2]) // "Send Payment, Invoke Contract"
 */
export function formatPermissions(permissions: number[]): string {
  return formatPermissionLabels(permissions).join(', ');
}
