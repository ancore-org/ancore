import {
  formatPermissionLabel,
  formatPermissionLabels,
  formatPermissions,
} from '../permission-formatter';

describe('permission formatter', () => {
  describe('formatPermissionLabel', () => {
    it('returns "Send Payment" for permission 0', () => {
      expect(formatPermissionLabel(0)).toBe('Send Payment');
    });

    it('returns "Manage Data" for permission 1', () => {
      expect(formatPermissionLabel(1)).toBe('Manage Data');
    });

    it('returns "Invoke Contract" for permission 2', () => {
      expect(formatPermissionLabel(2)).toBe('Invoke Contract');
    });

    it('handles unknown permission values gracefully', () => {
      expect(formatPermissionLabel(999)).toBe('Unknown Permission (999)');
      expect(formatPermissionLabel(100)).toBe('Unknown Permission (100)');
      expect(formatPermissionLabel(-1)).toBe('Unknown Permission (-1)');
    });

    it('handles all known permission values', () => {
      const knownPermissions = [0, 1, 2];
      knownPermissions.forEach((permission) => {
        const label = formatPermissionLabel(permission);
        expect(label).not.toContain('Unknown');
        expect(label).toBeTruthy();
      });
    });
  });

  describe('formatPermissionLabels', () => {
    it('maps single permission to label array', () => {
      expect(formatPermissionLabels([0])).toEqual(['Send Payment']);
    });

    it('maps multiple permissions to label array', () => {
      expect(formatPermissionLabels([0, 1, 2])).toEqual([
        'Send Payment',
        'Manage Data',
        'Invoke Contract',
      ]);
    });

    it('handles duplicate permissions', () => {
      expect(formatPermissionLabels([0, 0, 1])).toEqual([
        'Send Payment',
        'Send Payment',
        'Manage Data',
      ]);
    });

    it('handles unknown permissions in array', () => {
      expect(formatPermissionLabels([0, 999, 2])).toEqual([
        'Send Payment',
        'Unknown Permission (999)',
        'Invoke Contract',
      ]);
    });

    it('returns empty array for empty input', () => {
      expect(formatPermissionLabels([])).toEqual([]);
    });
  });

  describe('formatPermissions', () => {
    it('formats single permission as string', () => {
      expect(formatPermissions([0])).toBe('Send Payment');
    });

    it('formats multiple permissions as comma-separated string', () => {
      expect(formatPermissions([0, 2])).toBe('Send Payment, Invoke Contract');
    });

    it('formats all known permissions', () => {
      expect(formatPermissions([0, 1, 2])).toBe(
        'Send Payment, Manage Data, Invoke Contract'
      );
    });

    it('handles unknown permissions in formatted string', () => {
      expect(formatPermissions([0, 999, 2])).toBe(
        'Send Payment, Unknown Permission (999), Invoke Contract'
      );
    });

    it('returns empty string for empty input', () => {
      expect(formatPermissions([])).toBe('');
    });
  });
});
