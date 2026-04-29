import { SessionPermission } from '@ancore/types';
import { formatPermissions, permissionToLabel, permissionsToLabels } from '../session-key-utils';

describe('session-key-utils', () => {
  describe('permissionToLabel', () => {
    test('maps SEND_PAYMENT (0) to label', () => {
      expect(permissionToLabel(SessionPermission.SEND_PAYMENT)).toBe('Send Payment');
      expect(permissionToLabel(0)).toBe('Send Payment');
    });

    test('maps MANAGE_DATA (1) to label', () => {
      expect(permissionToLabel(SessionPermission.MANAGE_DATA)).toBe('Manage Data');
      expect(permissionToLabel(1)).toBe('Manage Data');
    });

    test('maps INVOKE_CONTRACT (2) to label', () => {
      expect(permissionToLabel(SessionPermission.INVOKE_CONTRACT)).toBe('Invoke Contract');
      expect(permissionToLabel(2)).toBe('Invoke Contract');
    });

    test('handles unknown permissions safely', () => {
      expect(permissionToLabel(999)).toBe('Unknown Permission (999)');
      expect(permissionToLabel(-1)).toBe('Unknown Permission (-1)');
      expect(permissionToLabel(3)).toBe('Unknown Permission (3)');
    });

    test('handles all enum values', () => {
      // Ensure all known SessionPermission enum values are handled
      const knownPermissions = Object.values(SessionPermission).filter(
        (v) => typeof v === 'number'
      );
      knownPermissions.forEach((permission) => {
        const label = permissionToLabel(permission as number);
        expect(label).not.toMatch(/Unknown Permission/);
      });
    });
  });

  describe('permissionsToLabels', () => {
    test('maps array of permissions to labels', () => {
      const permissions = [
        SessionPermission.SEND_PAYMENT,
        SessionPermission.MANAGE_DATA,
        SessionPermission.INVOKE_CONTRACT,
      ];
      const expected = ['Send Payment', 'Manage Data', 'Invoke Contract'];
      expect(permissionsToLabels(permissions)).toEqual(expected);
    });

    test('handles numeric permission values', () => {
      const permissions = [0, 1, 2];
      const expected = ['Send Payment', 'Manage Data', 'Invoke Contract'];
      expect(permissionsToLabels(permissions)).toEqual(expected);
    });

    test('handles mixed enum and numeric values', () => {
      const permissions = [SessionPermission.SEND_PAYMENT, 1, SessionPermission.INVOKE_CONTRACT];
      const expected = ['Send Payment', 'Manage Data', 'Invoke Contract'];
      expect(permissionsToLabels(permissions)).toEqual(expected);
    });

    test('handles unknown permissions in array', () => {
      const permissions = [0, 999, 1];
      const labels = permissionsToLabels(permissions);
      expect(labels).toContain('Send Payment');
      expect(labels).toContain('Manage Data');
      expect(labels).toContain('Unknown Permission (999)');
    });

    test('handles empty array', () => {
      expect(permissionsToLabels([])).toEqual([]);
    });

    test('handles single permission', () => {
      expect(permissionsToLabels([SessionPermission.SEND_PAYMENT])).toEqual(['Send Payment']);
    });

    test('handles duplicate permissions', () => {
      const permissions = [
        SessionPermission.SEND_PAYMENT,
        SessionPermission.SEND_PAYMENT,
        SessionPermission.MANAGE_DATA,
      ];
      const expected = ['Send Payment', 'Send Payment', 'Manage Data'];
      expect(permissionsToLabels(permissions)).toEqual(expected);
    });
  });

  describe('formatPermissions', () => {
    test('formats permissions as comma-separated string', () => {
      const permissions = [
        SessionPermission.SEND_PAYMENT,
        SessionPermission.MANAGE_DATA,
        SessionPermission.INVOKE_CONTRACT,
      ];
      expect(formatPermissions(permissions)).toBe('Send Payment, Manage Data, Invoke Contract');
    });

    test('handles single permission', () => {
      expect(formatPermissions([SessionPermission.SEND_PAYMENT])).toBe('Send Payment');
    });

    test('handles numeric values', () => {
      expect(formatPermissions([0, 1, 2])).toBe('Send Payment, Manage Data, Invoke Contract');
    });

    test('handles empty array', () => {
      expect(formatPermissions([])).toBe('');
    });

    test('handles unknown permissions in format', () => {
      const result = formatPermissions([0, 999]);
      expect(result).toBe('Send Payment, Unknown Permission (999)');
    });

    test('handles duplicate permissions', () => {
      expect(formatPermissions([0, 0, 1])).toBe('Send Payment, Send Payment, Manage Data');
    });
  });
});
