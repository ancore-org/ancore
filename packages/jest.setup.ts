/**
 * Shared Jest setup for all Node-environment packages.
 *
 * Loaded via `setupFilesAfterFramework` in every Jest config.
 *
 * Globals provided:
 *   - TextEncoder / TextDecoder  (required by @stellar/stellar-sdk in Node < 18)
 *   - crypto.subtle               (required by @ancore/crypto)
 *   - console.warn/error silenced (tests that assert console must spy themselves)
 */

import { TextDecoder, TextEncoder } from 'util';
import { webcrypto } from 'crypto';

if (typeof globalThis.TextEncoder === 'undefined') {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}

if (typeof globalThis.crypto === 'undefined' || typeof (globalThis.crypto as Crypto).subtle === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
