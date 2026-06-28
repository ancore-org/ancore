import { describe, it, expect, beforeEach } from 'vitest';
import { useDeviceSessionsStore, type DeviceSession } from '../deviceSessions';

function makeDevice(overrides: Partial<DeviceSession> = {}): DeviceSession {
  return {
    id: 'device-1',
    deviceName: 'Chrome on MacBook',
    browser: 'Chrome 124',
    os: 'macOS 14',
    lastSeenAt: new Date().toISOString(),
    isCurrent: false,
    trusted: true,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  useDeviceSessionsStore.setState({ devices: [], alertDeviceId: null });
});

describe('useDeviceSessionsStore', () => {
  describe('initial state', () => {
    it('starts with no devices', () => {
      expect(useDeviceSessionsStore.getState().devices).toHaveLength(0);
    });

    it('starts with no alert', () => {
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBeNull();
    });
  });

  describe('addDevice', () => {
    it('adds a new device to the list', () => {
      const device = makeDevice();
      useDeviceSessionsStore.getState().addDevice(device);
      expect(useDeviceSessionsStore.getState().devices).toHaveLength(1);
      expect(useDeviceSessionsStore.getState().devices[0].id).toBe('device-1');
    });

    it('upserts an existing device without duplicating it', () => {
      const device = makeDevice();
      useDeviceSessionsStore.getState().addDevice(device);
      useDeviceSessionsStore.getState().addDevice({ ...device, deviceName: 'Updated Name' });

      const { devices } = useDeviceSessionsStore.getState();
      expect(devices).toHaveLength(1);
      expect(devices[0].deviceName).toBe('Updated Name');
    });

    it('sets alertDeviceId when a new non-current device is added', () => {
      const device = makeDevice({ isCurrent: false });
      useDeviceSessionsStore.getState().addDevice(device);
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBe('device-1');
    });

    it('does NOT set alertDeviceId when the current device is added', () => {
      const device = makeDevice({ isCurrent: true });
      useDeviceSessionsStore.getState().addDevice(device);
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBeNull();
    });

    it('does NOT set alertDeviceId when an existing device is updated', () => {
      const device = makeDevice({ isCurrent: false });
      useDeviceSessionsStore.getState().addDevice(device);
      // dismiss the first alert
      useDeviceSessionsStore.getState().dismissAlert();

      // Update the same device — must not re-trigger alert
      useDeviceSessionsStore.getState().addDevice({ ...device, lastSeenAt: 'newer' });
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBeNull();
    });

    it('preserves existing alertDeviceId when a second new device is not added', () => {
      const first = makeDevice({ id: 'dev-a', isCurrent: false });
      useDeviceSessionsStore.getState().addDevice(first);
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBe('dev-a');

      const second = makeDevice({ id: 'dev-b', isCurrent: false });
      useDeviceSessionsStore.getState().addDevice(second);
      // Second non-current device — alertDeviceId updates to latest
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBe('dev-b');
    });

    it('stores multiple devices independently', () => {
      useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'a' }));
      useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'b' }));
      useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'c', isCurrent: true }));
      expect(useDeviceSessionsStore.getState().devices).toHaveLength(3);
    });
  });

  describe('revokeDevice', () => {
    it('removes the target device', () => {
      useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'target' }));
      useDeviceSessionsStore.getState().dismissAlert();
      useDeviceSessionsStore.getState().revokeDevice('target');
      expect(useDeviceSessionsStore.getState().devices).toHaveLength(0);
    });

    it('is a no-op for a non-existent id', () => {
      useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'real' }));
      useDeviceSessionsStore.getState().dismissAlert();
      expect(() => {
        useDeviceSessionsStore.getState().revokeDevice('does-not-exist');
      }).not.toThrow();
      expect(useDeviceSessionsStore.getState().devices).toHaveLength(1);
    });

    it('silently ignores revoke of the current device', () => {
      const current = makeDevice({ id: 'current-device', isCurrent: true });
      useDeviceSessionsStore.getState().addDevice(current);
      useDeviceSessionsStore.getState().revokeDevice('current-device');
      expect(useDeviceSessionsStore.getState().devices).toHaveLength(1);
    });

    it('clears alertDeviceId when the alerted device is revoked', () => {
      const device = makeDevice({ id: 'new-device', isCurrent: false });
      useDeviceSessionsStore.getState().addDevice(device);
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBe('new-device');

      useDeviceSessionsStore.getState().revokeDevice('new-device');
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBeNull();
    });

    it('does not affect other devices', () => {
      useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'keep', isCurrent: true }));
      useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'remove' }));
      useDeviceSessionsStore.getState().dismissAlert();
      useDeviceSessionsStore.getState().revokeDevice('remove');

      const { devices } = useDeviceSessionsStore.getState();
      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe('keep');
    });
  });

  describe('dismissAlert', () => {
    it('clears alertDeviceId', () => {
      useDeviceSessionsStore.getState().addDevice(makeDevice({ isCurrent: false }));
      expect(useDeviceSessionsStore.getState().alertDeviceId).not.toBeNull();

      useDeviceSessionsStore.getState().dismissAlert();
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBeNull();
    });

    it('is a no-op when there is no alert', () => {
      expect(() => {
        useDeviceSessionsStore.getState().dismissAlert();
      }).not.toThrow();
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears all devices and the alert', () => {
      useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'a', isCurrent: true }));
      useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'b' }));
      expect(useDeviceSessionsStore.getState().devices).toHaveLength(2);
      expect(useDeviceSessionsStore.getState().alertDeviceId).not.toBeNull();

      useDeviceSessionsStore.getState().reset();

      expect(useDeviceSessionsStore.getState().devices).toHaveLength(0);
      expect(useDeviceSessionsStore.getState().alertDeviceId).toBeNull();
    });
  });
});
