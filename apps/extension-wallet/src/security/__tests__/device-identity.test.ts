import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  DEVICE_ID_STORAGE_KEY,
  buildCurrentDeviceSession,
  describeUserAgent,
  getOrCreateDeviceId,
  resetDeviceIdCache,
} from '../device-identity';
import { extensionStorage } from '../../stores/_storage';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/131.0.0.0`;
const FIREFOX_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';

beforeEach(async () => {
  resetDeviceIdCache();
  await extensionStorage.removeItem(DEVICE_ID_STORAGE_KEY);
});

describe('describeUserAgent', () => {
  it('labels Chrome on Windows', () => {
    expect(describeUserAgent(CHROME_WINDOWS)).toEqual({
      deviceName: 'Chrome on Windows',
      browser: 'Chrome',
      os: 'Windows',
    });
  });

  it('prefers Edge over the Chrome token it also carries', () => {
    expect(describeUserAgent(EDGE_WINDOWS).browser).toBe('Edge');
  });

  it('prefers Chrome over the Safari token it also carries', () => {
    expect(describeUserAgent(CHROME_WINDOWS).browser).toBe('Chrome');
  });

  it('labels real Safari as Safari', () => {
    expect(describeUserAgent(SAFARI_MAC)).toEqual({
      deviceName: 'Safari on macOS',
      browser: 'Safari',
      os: 'macOS',
    });
  });

  it('labels Firefox on macOS', () => {
    expect(describeUserAgent(FIREFOX_MAC)).toEqual({
      deviceName: 'Firefox on macOS',
      browser: 'Firefox',
      os: 'macOS',
    });
  });

  it('labels Linux and ChromeOS distinctly', () => {
    expect(describeUserAgent('Mozilla/5.0 (X11; Linux x86_64) Firefox/133.0').os).toBe('Linux');
    expect(describeUserAgent('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/131.0.0.0').os).toBe(
      'ChromeOS'
    );
  });

  it('falls back to an unknown descriptor for an empty user agent', () => {
    expect(describeUserAgent('')).toEqual({
      deviceName: 'Unknown device',
      browser: 'Unknown browser',
      os: 'Unknown OS',
    });
    expect(describeUserAgent('   ').deviceName).toBe('Unknown device');
  });

  it('falls back per-field for a partially recognisable user agent', () => {
    const descriptor = describeUserAgent('SomeRobot/1.0 (Windows NT 10.0)');
    expect(descriptor.browser).toBe('Unknown browser');
    expect(descriptor.os).toBe('Windows');
    expect(descriptor.deviceName).toBe('Unknown browser on Windows');
  });
});

describe('getOrCreateDeviceId', () => {
  it('mints and persists a UUID on first call', async () => {
    const id = await getOrCreateDeviceId();

    expect(id).toMatch(UUID_PATTERN);
    await expect(extensionStorage.getItem(DEVICE_ID_STORAGE_KEY)).resolves.toBe(id);
  });

  it('returns the same id across calls in one context', async () => {
    await expect(getOrCreateDeviceId()).resolves.toBe(await getOrCreateDeviceId());
  });

  it('reuses the persisted id after the in-memory cache is dropped', async () => {
    const first = await getOrCreateDeviceId();
    resetDeviceIdCache();

    await expect(getOrCreateDeviceId()).resolves.toBe(first);
  });

  it('mints exactly one id for concurrent callers', async () => {
    const setItem = vi.spyOn(extensionStorage, 'setItem');

    const ids = await Promise.all([
      getOrCreateDeviceId(),
      getOrCreateDeviceId(),
      getOrCreateDeviceId(),
    ]);

    expect(new Set(ids).size).toBe(1);
    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it('does not cache a rejection, so a later call can still succeed', async () => {
    const getItem = vi
      .spyOn(extensionStorage, 'getItem')
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(getOrCreateDeviceId()).rejects.toThrow('storage unavailable');
    getItem.mockRestore();

    await expect(getOrCreateDeviceId()).resolves.toMatch(UUID_PATTERN);
  });
});

describe('buildCurrentDeviceSession', () => {
  it('describes this device as the current, trusted session', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(CHROME_WINDOWS);

    const session = await buildCurrentDeviceSession(() => Date.parse('2026-04-24T10:00:00.000Z'));

    expect(session).toEqual({
      id: expect.stringMatching(UUID_PATTERN),
      deviceName: 'Chrome on Windows',
      browser: 'Chrome',
      os: 'Windows',
      lastSeenAt: '2026-04-24T10:00:00.000Z',
      isCurrent: true,
      trusted: true,
    });

    vi.restoreAllMocks();
  });

  it('keeps the same id but refreshes lastSeenAt across sessions', async () => {
    const first = await buildCurrentDeviceSession(() => 1_000);
    const second = await buildCurrentDeviceSession(() => 2_000);

    expect(second.id).toBe(first.id);
    expect(second.lastSeenAt).not.toBe(first.lastSeenAt);
  });
});
