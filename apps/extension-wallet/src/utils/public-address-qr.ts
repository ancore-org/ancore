/**
 * Guarded QR export for public receive addresses.
 *
 * A downloadable QR is a file that leaves the extension and gets shared with
 * support agents, printed, or dropped into a chat. Encoding a secret in one
 * would be catastrophic and invisible — the PNG looks identical either way.
 * So this module never accepts arbitrary input: it whitelists the Stellar
 * public-address formats and rejects everything else, including the specific
 * secret shapes the wallet handles, which get a clearer error.
 *
 * Every QR download surface in the wallet must call through here rather than
 * {@link downloadQrPng} directly.
 */

import downloadQrPng, { type DownloadQrOptions } from './export-qr';

/**
 * Stellar public formats, all base32 (RFC 4648 alphabet, no padding):
 *   G… ed25519 account, C… contract, M… muxed account (69 chars).
 * `S…` is deliberately absent — that is the secret seed prefix.
 */
const PUBLIC_ADDRESS_PATTERN = /^[GC][A-Z2-7]{55}$|^M[A-Z2-7]{68}$/;

/** Stellar secret seed: 56 chars, `S` prefix. */
const SECRET_SEED_PATTERN = /^S[A-Z2-7]{55}$/;

/** Raw ed25519 private key as hex. */
const RAW_HEX_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

/** Thrown when a QR export is asked to encode something that is not a public address. */
export class SecretExportBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretExportBlockedError';
  }
}

/** Whether `value` is a well-formed Stellar public address (G, C, or M). */
export function isPublicAddress(value: string): boolean {
  return PUBLIC_ADDRESS_PATTERN.test(value.trim());
}

/**
 * Classify input that is *not* a public address, so the caller can explain why
 * rather than showing a generic failure.
 */
function describeRejection(value: string): string {
  if (SECRET_SEED_PATTERN.test(value)) {
    return 'Refusing to encode a secret key in a QR code.';
  }

  if (RAW_HEX_KEY_PATTERN.test(value)) {
    return 'Refusing to encode a raw private key in a QR code.';
  }

  if (value.split(/\s+/).filter(Boolean).length >= 12) {
    return 'Refusing to encode a recovery phrase in a QR code.';
  }

  return 'QR export only accepts a Stellar public address.';
}

/**
 * Throw unless `value` is a Stellar public address.
 *
 * This is a whitelist, not a blocklist: anything that is not recognisably a
 * public address is rejected, so a secret format nobody anticipated still
 * cannot slip through.
 *
 * @throws {SecretExportBlockedError}
 */
export function assertPublicAddressOnly(value: string): string {
  const trimmed = value.trim();

  if (!isPublicAddress(trimmed)) {
    throw new SecretExportBlockedError(describeRejection(trimmed));
  }

  return trimmed;
}

/** Filename for a downloaded address QR, e.g. `ancore-address-GABCDEFG.png`. */
export function qrFilename(address: string): string {
  return `ancore-address-${address.slice(0, 8)}.png`;
}

/**
 * Download a PNG QR code of a public receive address.
 *
 * @param address - Stellar public address (G, C, or M).
 * @throws {SecretExportBlockedError} if `address` is not a public address.
 */
export async function downloadPublicAddressQrPng(
  address: string,
  opts: DownloadQrOptions = {}
): Promise<void> {
  const safe = assertPublicAddressOnly(address);

  await downloadQrPng(safe, {
    filename: qrFilename(safe),
    scale: 3,
    ...opts,
  });
}

export default downloadPublicAddressQrPng;
