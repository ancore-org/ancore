import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock is hoisted above imports, so the spy has to be created inside the
// factory and pulled back out afterwards.
vi.mock('../export-qr', () => {
  const spy = vi.fn(async () => undefined);
  return { default: spy, downloadQrPng: spy };
});

const { default: downloadQrPng } = await import('../export-qr');

import {
  assertPublicAddressOnly,
  downloadPublicAddressQrPng,
  isPublicAddress,
  qrFilename,
  SecretExportBlockedError,
} from '../public-address-qr';

const PUBLIC_KEY = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const CONTRACT_ID = 'CBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const MUXED = `M${'A'.repeat(68)}`;
const SECRET_SEED = 'SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const RAW_HEX_KEY = 'a'.repeat(64);
const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

describe('isPublicAddress', () => {
  it('accepts G, C, and M addresses', () => {
    expect(isPublicAddress(PUBLIC_KEY)).toBe(true);
    expect(isPublicAddress(CONTRACT_ID)).toBe(true);
    expect(isPublicAddress(MUXED)).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isPublicAddress(`  ${PUBLIC_KEY}  `)).toBe(true);
  });

  it('rejects secret seeds', () => {
    expect(isPublicAddress(SECRET_SEED)).toBe(false);
  });

  it('rejects addresses of the wrong length', () => {
    expect(isPublicAddress(PUBLIC_KEY.slice(0, -1))).toBe(false);
    expect(isPublicAddress(`${PUBLIC_KEY}A`)).toBe(false);
  });

  it('rejects characters outside the base32 alphabet', () => {
    // 0, 1, 8, and 9 are not in RFC 4648 base32.
    expect(isPublicAddress(`G0${PUBLIC_KEY.slice(2)}`)).toBe(false);
    expect(isPublicAddress(PUBLIC_KEY.toLowerCase())).toBe(false);
  });
});

describe('assertPublicAddressOnly', () => {
  it('returns the trimmed address when valid', () => {
    expect(assertPublicAddressOnly(`  ${PUBLIC_KEY} `)).toBe(PUBLIC_KEY);
  });

  it('blocks a Stellar secret seed with a specific message', () => {
    expect(() => assertPublicAddressOnly(SECRET_SEED)).toThrow(SecretExportBlockedError);
    expect(() => assertPublicAddressOnly(SECRET_SEED)).toThrow(/secret key/i);
  });

  it('blocks a raw hex private key', () => {
    expect(() => assertPublicAddressOnly(RAW_HEX_KEY)).toThrow(/raw private key/i);
  });

  it('blocks a recovery phrase', () => {
    expect(() => assertPublicAddressOnly(MNEMONIC)).toThrow(/recovery phrase/i);
  });

  it('blocks anything unrecognised — it is a whitelist, not a blocklist', () => {
    for (const value of ['', 'hello', 'https://example.com', '{"seed":"S..."}']) {
      expect(() => assertPublicAddressOnly(value)).toThrow(SecretExportBlockedError);
    }
  });
});

describe('qrFilename', () => {
  it('derives a stable, address-scoped filename', () => {
    expect(qrFilename(PUBLIC_KEY)).toBe('ancore-address-GBXXXXXX.png');
  });
});

describe('downloadPublicAddressQrPng', () => {
  beforeEach(() => {
    downloadQrPng.mockClear();
  });

  it('downloads a QR for a public address', async () => {
    await downloadPublicAddressQrPng(PUBLIC_KEY);

    expect(downloadQrPng).toHaveBeenCalledTimes(1);
    expect(downloadQrPng).toHaveBeenCalledWith(
      PUBLIC_KEY,
      expect.objectContaining({ filename: 'ancore-address-GBXXXXXX.png' })
    );
  });

  it('encodes the address itself, not a payment URI or any wrapper', async () => {
    await downloadPublicAddressQrPng(CONTRACT_ID);

    expect(downloadQrPng.mock.calls[0][0]).toBe(CONTRACT_ID);
  });

  it('never reaches the QR writer when given a secret', async () => {
    await expect(downloadPublicAddressQrPng(SECRET_SEED)).rejects.toThrow(SecretExportBlockedError);
    expect(downloadQrPng).not.toHaveBeenCalled();
  });

  it('never reaches the QR writer when given a recovery phrase', async () => {
    await expect(downloadPublicAddressQrPng(MNEMONIC)).rejects.toThrow(SecretExportBlockedError);
    expect(downloadQrPng).not.toHaveBeenCalled();
  });

  it('allows callers to override download options', async () => {
    await downloadPublicAddressQrPng(PUBLIC_KEY, { filename: 'custom.png', scale: 2 });

    expect(downloadQrPng).toHaveBeenCalledWith(
      PUBLIC_KEY,
      expect.objectContaining({ filename: 'custom.png', scale: 2 })
    );
  });
});
