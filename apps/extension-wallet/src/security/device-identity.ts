/**
 * Device Identity
 *
 * Derives a stable identity for the browser profile this extension instance
 * runs in, so the Device Sessions store has something real to record.
 *
 * The identifier is a random UUID minted once and kept in extension storage.
 * It is deliberately *not* a fingerprint of the user agent: two Chrome
 * profiles on the same machine are separate wallet installs and must show up
 * as separate devices, while a browser upgrade that changes the UA string must
 * not orphan the existing record.
 */

import { extensionStorage } from '../stores/_storage';
import type { DeviceSession } from '../stores/deviceSessions';

/** Storage key holding this install's device UUID. */
export const DEVICE_ID_STORAGE_KEY = 'ancore-device-id';

/** Shape of the browser/OS labels shown in the Active Sessions list. */
export interface DeviceDescriptor {
  deviceName: string;
  browser: string;
  os: string;
}

const UNKNOWN: DeviceDescriptor = {
  deviceName: 'Unknown device',
  browser: 'Unknown browser',
  os: 'Unknown OS',
};

/**
 * Browser matchers, most specific first. Edge and Opera both embed "Chrome"
 * in their user agent, and Chrome embeds "Safari", so order decides the label.
 */
const BROWSER_MATCHERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\b(?:OPR|Opera)\//, 'Opera'],
  [/\bBrave\//, 'Brave'],
  [/\bVivaldi\//, 'Vivaldi'],
  [/\bFirefox\//, 'Firefox'],
  [/\bChrome\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
];

const OS_MATCHERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bWindows NT 10\.0\b/, 'Windows'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bAndroid\b/, 'Android'],
  [/\b(?:iPhone|iPad|iPod)\b/, 'iOS'],
  [/\bLinux\b/, 'Linux'],
];

function matchFirst(
  userAgent: string,
  matchers: ReadonlyArray<readonly [RegExp, string]>
): string | null {
  for (const [pattern, label] of matchers) {
    if (pattern.test(userAgent)) {
      return label;
    }
  }
  return null;
}

/**
 * Describe the current browser from a user agent string.
 *
 * Exported for testing; production callers should use {@link describeDevice}.
 */
export function describeUserAgent(userAgent: string): DeviceDescriptor {
  if (!userAgent.trim()) {
    return { ...UNKNOWN };
  }

  const browser = matchFirst(userAgent, BROWSER_MATCHERS) ?? UNKNOWN.browser;
  const os = matchFirst(userAgent, OS_MATCHERS) ?? UNKNOWN.os;

  const deviceName =
    browser === UNKNOWN.browser && os === UNKNOWN.os ? UNKNOWN.deviceName : `${browser} on ${os}`;

  return { deviceName, browser, os };
}

/** Describe the browser this code is currently running in. */
export function describeDevice(): DeviceDescriptor {
  const userAgent = typeof navigator === 'undefined' ? '' : (navigator.userAgent ?? '');
  return describeUserAgent(userAgent);
}

function randomDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback for environments without randomUUID (older Firefox, jsdom).
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // RFC 4122 version 4 / variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Read this install's device id, minting and persisting one on first call.
 *
 * Concurrent callers within one context share a single in-flight mint so two
 * simultaneous unlocks cannot produce two ids for the same device.
 */
let pendingDeviceId: Promise<string> | null = null;

export function getOrCreateDeviceId(): Promise<string> {
  if (!pendingDeviceId) {
    pendingDeviceId = (async () => {
      const existing = await extensionStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (typeof existing === 'string' && existing.length > 0) {
        return existing;
      }

      const deviceId = randomDeviceId();
      await extensionStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
      return deviceId;
    })().catch((error) => {
      // Never cache a rejection — a transient storage failure must not
      // permanently break device recording for the rest of the session.
      pendingDeviceId = null;
      throw error;
    });
  }

  return pendingDeviceId;
}

/** Test seam: forget the memoised in-flight/resolved device id. */
export function resetDeviceIdCache(): void {
  pendingDeviceId = null;
}

/**
 * Build the {@link DeviceSession} record describing this device right now.
 */
export async function buildCurrentDeviceSession(
  now: () => number = Date.now
): Promise<DeviceSession> {
  const id = await getOrCreateDeviceId();
  const descriptor = describeDevice();

  return {
    id,
    ...descriptor,
    lastSeenAt: new Date(now()).toISOString(),
    isCurrent: true,
    trusted: true,
  };
}
