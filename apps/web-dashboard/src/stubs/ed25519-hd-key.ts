/**
 * Browser-safe SLIP-0010 Ed25519 HD derivation for Vite browser-dev.
 * Same implementation as the extension stub.
 */
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function parsePathSegment(seg: string): number {
  const hardened = seg.endsWith("'") || seg.endsWith('h') || seg.endsWith('H');
  const n = parseInt(seg.replace(/['hH]$/, ''), 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid HD path segment: ${seg}`);
  }
  return hardened ? (n | 0x80000000) >>> 0 : n >>> 0;
}

export function derivePath(
  path: string,
  seedHex: string
): { key: Uint8Array; chainCode: Uint8Array } {
  const seed = hexToBytes(seedHex);
  let I = hmac(sha512, new TextEncoder().encode('ed25519 seed'), seed);
  let key = I.slice(0, 32);
  let chainCode = I.slice(32);

  const segments = path.replace(/^m\/?/, '').split('/').filter(Boolean);

  for (const seg of segments) {
    const index = parsePathSegment(seg);
    const data = new Uint8Array(1 + 32 + 4);
    data[0] = 0;
    data.set(key, 1);
    data[33] = (index >>> 24) & 0xff;
    data[34] = (index >>> 16) & 0xff;
    data[35] = (index >>> 8) & 0xff;
    data[36] = index & 0xff;
    I = hmac(sha512, chainCode, data);
    key = I.slice(0, 32);
    chainCode = I.slice(32);
  }

  return { key, chainCode };
}

export default { derivePath };
