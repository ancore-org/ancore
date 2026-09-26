import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { recordCurrentDevice } from '../device-session-recorder';
import { DEVICE_ID_STORAGE_KEY, resetDeviceIdCache } from '../device-identity';
import { extensionStorage } from '../../stores/_storage';
import { useDeviceSessionsStore, type DeviceSession } from '../../stores/deviceSessions';

function makeDevice(overrides: Partial<DeviceSession> = {}): DeviceSession {
  return {
    id: 'other-device',
    deviceName: 'Firefox on macOS',
    browser: 'Firefox',
    os: 'macOS',
    lastSeenAt: '2026-01-01T00:00:00.000Z',
    isCurrent: false,
    trusted: true,
    ...overrides,
  };
}

beforeEach(async () => {
  resetDeviceIdCache();
  await extensionStorage.removeItem(DEVICE_ID_STORAGE_KEY);
  useDeviceSessionsStore.setState({ devices: [], alertDeviceId: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recordCurrentDevice', () => {
  it('populates a previously empty store with the current device', async () => {
    expect(useDeviceSessionsStore.getState().devices).toHaveLength(0);

    await recordCurrentDevice();

    const { devices } = useDeviceSessionsStore.getState();
    expect(devices).toHaveLength(1);
    expect(devices[0].isCurrent).toBe(true);
    expect(devices[0].trusted).toBe(true);
    expect(devices[0].id).toBeTruthy();
  });

  it('does not raise a new-device alert for the current device', async () => {
    await recordCurrentDevice();

    expect(useDeviceSessionsStore.getState().alertDeviceId).toBeNull();
  });

  it('upserts rather than duplicating on a second unlock', async () => {
    await recordCurrentDevice();
    const firstSeenAt = useDeviceSessionsStore.getState().devices[0].lastSeenAt;
    const id = useDeviceSessionsStore.getState().devices[0].id;

    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
    await recordCurrentDevice();
    vi.useRealTimers();

    const { devices } = useDeviceSessionsStore.getState();
    expect(devices).toHaveLength(1);
    expect(devices[0].id).toBe(id);
    expect(devices[0].lastSeenAt).not.toBe(firstSeenAt);
  });

  it('leaves other devices in place and keeps their alert pending', async () => {
    useDeviceSessionsStore.getState().addDevice(makeDevice({ id: 'device-b' }));
    expect(useDeviceSessionsStore.getState().alertDeviceId).toBe('device-b');

    await recordCurrentDevice();

    const { devices, alertDeviceId } = useDeviceSessionsStore.getState();
    expect(devices).toHaveLength(2);
    expect(devices.map((device) => device.id)).toContain('device-b');
    expect(alertDeviceId).toBe('device-b');
  });

  it('demotes a stale isCurrent record synced from another browser profile', async () => {
    useDeviceSessionsStore.setState({
      devices: [makeDevice({ id: 'foreign-profile', isCurrent: true })],
      alertDeviceId: null,
    });

    await recordCurrentDevice();

    const { devices } = useDeviceSessionsStore.getState();
    const foreign = devices.find((device) => device.id === 'foreign-profile');
    expect(foreign?.isCurrent).toBe(false);
    expect(devices.filter((device) => device.isCurrent)).toHaveLength(1);
  });

  it('makes a demoted foreign device revocable', async () => {
    useDeviceSessionsStore.setState({
      devices: [makeDevice({ id: 'foreign-profile', isCurrent: true })],
      alertDeviceId: null,
    });

    await recordCurrentDevice();
    useDeviceSessionsStore.getState().revokeDevice('foreign-profile');

    expect(
      useDeviceSessionsStore.getState().devices.find((device) => device.id === 'foreign-profile')
    ).toBeUndefined();
  });

  it('rehydrates persisted state before recording, so storage cannot clobber the record', async () => {
    const rehydrate = vi
      .spyOn(useDeviceSessionsStore.persist, 'rehydrate')
      .mockImplementation(async () => {
        useDeviceSessionsStore.setState({ devices: [makeDevice({ id: 'from-storage' })] });
      });
    vi.spyOn(useDeviceSessionsStore.persist, 'hasHydrated').mockReturnValue(false);

    await recordCurrentDevice();

    expect(rehydrate).toHaveBeenCalledTimes(1);
    const ids = useDeviceSessionsStore.getState().devices.map((device) => device.id);
    expect(ids).toContain('from-storage');
    expect(ids).toHaveLength(2);
  });

  it('skips rehydration when the store is already hydrated', async () => {
    vi.spyOn(useDeviceSessionsStore.persist, 'hasHydrated').mockReturnValue(true);
    const rehydrate = vi.spyOn(useDeviceSessionsStore.persist, 'rehydrate');

    await recordCurrentDevice();

    expect(rehydrate).not.toHaveBeenCalled();
  });

  it('swallows storage failures so an unlock is never broken by bookkeeping', async () => {
    vi.spyOn(extensionStorage, 'getItem').mockRejectedValue(new Error('storage unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(recordCurrentDevice()).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
    expect(useDeviceSessionsStore.getState().devices).toHaveLength(0);
  });
});
