/**
 * Jailbreak / root detection service.
 *
 * Wraps the jail-monkey library to detect compromised devices.
 * Freighter Mobile equivalent: uses jail-monkey for both iOS and Android.
 *
 * We block compromised devices because:
 * - Jailbroken iOS devices can extract Keychain secrets
 * - Rooted Android devices can access app sandbox storage
 * - Both undermine the security guarantees of biometric auth and the keychain adapter
 */

/**
 * Returns true if the device is jailbroken (iOS) or rooted (Android).
 * On non-mobile platforms or in test environments, returns false.
 */
export function isDeviceCompromised(): boolean {
  try {
    // jail-monkey is a native module — only available on actual devices.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JailMonkey = require('jail-monkey');
    return Boolean(JailMonkey.isJailBroken?.() || JailMonkey.isRooted?.());
  } catch {
    // jail-monkey is a native module and will throw on non-mobile platforms
    // (e.g. during unit tests running in jsdom). Treat as safe.
    return false;
  }
}
