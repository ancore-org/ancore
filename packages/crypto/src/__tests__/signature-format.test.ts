import {
  toHex,
  fromHex,
  toBase64,
  fromBase64,
  encodeSignature,
  decodeSignature,
  isValidHex,
  isValidBase64,
} from '../signature-format';

describe('Signature Format Helpers', () => {
  describe('toHex', () => {
    it('converts bytes to lowercase hex string', () => {
      const bytes = new Uint8Array([0x01, 0x23, 0x45, 0x67]);
      expect(toHex(bytes)).toBe('01234567');
    });

    it('includes 0x prefix when requested', () => {
      const bytes = new Uint8Array([0xab, 0xcd]);
      expect(toHex(bytes, true)).toBe('0xabcd');
    });

    it('handles empty bytes', () => {
      const bytes = new Uint8Array([]);
      expect(toHex(bytes)).toBe('');
      expect(toHex(bytes, true)).toBe('0x');
    });

    it('handles uppercase input correctly', () => {
      const bytes = new Uint8Array([255, 254, 253]);
      expect(toHex(bytes)).toBe('fffefd');
    });
  });

  describe('fromHex', () => {
    it('converts hex string to bytes', () => {
      const hex = 'deadbeef';
      const result = fromHex(hex);
      expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it('strips 0x prefix', () => {
      const hex = '0xcafebabe';
      const result = fromHex(hex);
      expect(result).toEqual(new Uint8Array([0xca, 0xfe, 0xba, 0xbe]));
    });

    it('handles uppercase hex', () => {
      const hex = 'DEADBEEF';
      const result = fromHex(hex);
      expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it('handles empty hex string', () => {
      expect(fromHex('').length).toBe(0);
      expect(fromHex('0x').length).toBe(0);
    });

    it('throws on odd length hex', () => {
      expect(() => fromHex('abc')).toThrow();
      expect(() => fromHex('0xabc')).toThrow();
    });

    it('throws on invalid hex characters', () => {
      expect(() => fromHex('zzzz')).toThrow();
      expect(() => fromHex('gg')).toThrow();
    });
  });

  describe('toBase64', () => {
    it('converts bytes to base64', () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      expect(toBase64(bytes)).toBe('AQIDBA==');
    });

    it('handles empty bytes', () => {
      const bytes = new Uint8Array([]);
      expect(toBase64(bytes)).toBe('');
    });

    it('encodes 64-byte signature (Ed25519)', () => {
      const sig = new Uint8Array(64).fill(0xff);
      const b64 = toBase64(sig);
      expect(b64.length).toBeGreaterThan(0);
      expect(b64.includes('=')).toBe(true); // Padded
    });
  });

  describe('fromBase64', () => {
    it('converts base64 to bytes', () => {
      const b64 = 'AQIDBA==';
      const result = fromBase64(b64);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it('normalizes missing padding', () => {
      const b64 = 'AQIDBA'; // Missing ==
      const result = fromBase64(b64);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it('handles single padding', () => {
      const b64 = 'AQ==';
      const result = fromBase64(b64);
      expect(result).toEqual(new Uint8Array([0x01]));
    });

    it('throws on invalid base64', () => {
      expect(() => fromBase64('!!!!')).toThrow();
      expect(() => fromBase64('    ')).toThrow();
    });

    it('decodes 64-byte signature (Ed25519)', () => {
      const original = new Uint8Array(64).fill(0xaa);
      const b64 = toBase64(original);
      const decoded = fromBase64(b64);
      expect(decoded).toEqual(original);
    });
  });

  describe('encodeSignature', () => {
    it('encodes to hex by default', () => {
      const sig = new Uint8Array([1, 2, 3]);
      const encoded = encodeSignature(sig);
      expect(encoded).toBe('010203');
    });

    it('encodes to base64', () => {
      const sig = new Uint8Array([1, 2, 3]);
      const encoded = encodeSignature(sig, 'base64');
      expect(encoded).toBe('AQID');
    });

    it('returns raw bytes when format is "raw"', () => {
      const sig = new Uint8Array([1, 2, 3]);
      const encoded = encodeSignature(sig, 'raw');
      expect(encoded).toEqual(sig);
    });

    it('throws on unsupported format', () => {
      const sig = new Uint8Array([1, 2, 3]);
      expect(() => encodeSignature(sig, 'invalid' as any)).toThrow();
    });
  });

  describe('decodeSignature', () => {
    it('decodes hex signature', () => {
      const decoded = decodeSignature('deadbeef');
      expect(decoded).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it('decodes hex with 0x prefix', () => {
      const decoded = decodeSignature('0xdeadbeef');
      expect(decoded).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it('decodes base64 signature', () => {
      const decoded = decodeSignature('AQIDBA==');
      expect(decoded).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it('decodes raw Uint8Array', () => {
      const raw = new Uint8Array([1, 2, 3]);
      const decoded = decodeSignature(raw);
      expect(decoded).toEqual(raw);
    });

    it('throws on invalid format', () => {
      expect(() => decodeSignature('!!!!')).toThrow();
    });

    it('prioritizes hex detection over base64', () => {
      // 'AA==' is valid hex but starts with A
      const decoded = decodeSignature('abcd');
      expect(decoded).toEqual(new Uint8Array([0xab, 0xcd]));
    });
  });

  describe('Format validation', () => {
    it('isValidHex returns true for valid hex', () => {
      expect(isValidHex('deadbeef')).toBe(true);
      expect(isValidHex('DEADBEEF')).toBe(true);
      expect(isValidHex('0xabcd')).toBe(true);
    });

    it('isValidHex returns false for invalid hex', () => {
      expect(isValidHex('zzzz')).toBe(false);
      expect(isValidHex('abc')).toBe(false); // Odd length
      expect(isValidHex('  ')).toBe(false);
    });

    it('isValidBase64 returns true for valid base64', () => {
      expect(isValidBase64('AQIDBA==')).toBe(true);
      expect(isValidBase64('AQ==')).toBe(true);
      expect(isValidBase64('')).toBe(true);
    });

    it('isValidBase64 returns false for invalid base64', () => {
      expect(isValidBase64('!!!!')).toBe(false);
      expect(isValidBase64('ABC')).toBe(false); // Not multiple of 4
      expect(isValidBase64('  ')).toBe(false);
    });
  });

  describe('Round-trip conversions', () => {
    it('hex round-trip: bytes -> hex -> bytes', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const hex = toHex(original);
      const decoded = fromHex(hex);
      expect(decoded).toEqual(original);
    });

    it('base64 round-trip: bytes -> base64 -> bytes', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const b64 = toBase64(original);
      const decoded = fromBase64(b64);
      expect(decoded).toEqual(original);
    });

    it('cross-format: hex -> bytes -> base64 -> bytes -> hex', () => {
      const originalHex = 'deadbeef';
      const bytes = fromHex(originalHex);
      const b64 = toBase64(bytes);
      const backToBytes = fromBase64(b64);
      const backToHex = toHex(backToBytes);
      expect(backToHex).toBe(originalHex);
    });

    it('Ed25519 signature round-trip (64 bytes)', () => {
      const sig = new Uint8Array(64).fill(0xab);

      // Hex round-trip
      const hex = toHex(sig);
      const fromHexSig = fromHex(hex);
      expect(fromHexSig).toEqual(sig);

      // Base64 round-trip
      const b64 = toBase64(sig);
      const fromB64Sig = fromBase64(b64);
      expect(fromB64Sig).toEqual(sig);
    });
  });

  describe('Empty data handling', () => {
    it('handles empty bytes in all functions', () => {
      const empty = new Uint8Array([]);
      expect(toHex(empty)).toBe('');
      expect(toBase64(empty)).toBe('');
      expect(encodeSignature(empty, 'hex')).toBe('');
      expect(encodeSignature(empty, 'base64')).toBe('');
      expect(encodeSignature(empty, 'raw')).toEqual(empty);
    });

    it('can decode empty hex/base64', () => {
      expect(fromHex('').length).toBe(0);
      expect(fromBase64('').length).toBe(0);
      expect(decodeSignature('')).toEqual(new Uint8Array([]));
    });
  });

  describe('Randomized encoding tests', () => {
    it('hex encoding is reversible for random bytes', () => {
      for (let i = 0; i < 10; i++) {
        const randomBytes = new Uint8Array(Math.floor(Math.random() * 100) + 1);
        crypto.getRandomValues(randomBytes);

        const hex = toHex(randomBytes);
        const decoded = fromHex(hex);
        expect(Buffer.from(decoded).equals(Buffer.from(randomBytes))).toBe(true);
      }
    });

    it('base64 encoding is reversible for random bytes', () => {
      for (let i = 0; i < 10; i++) {
        const randomBytes = new Uint8Array(Math.floor(Math.random() * 100) + 1);
        crypto.getRandomValues(randomBytes);

        const b64 = toBase64(randomBytes);
        const decoded = fromBase64(b64);
        expect(Buffer.from(decoded).equals(Buffer.from(randomBytes))).toBe(true);
      }
    });

    it('hex output is always lowercase', () => {
      for (let i = 0; i < 20; i++) {
        const randomBytes = new Uint8Array(Math.floor(Math.random() * 50) + 1);
        crypto.getRandomValues(randomBytes);

        const hex = toHex(randomBytes);
        expect(hex).toBe(hex.toLowerCase());
      }
    });

    it('decodeSignature auto-detects all formats correctly', () => {
      for (let i = 0; i < 10; i++) {
        const sig = new Uint8Array(Math.floor(Math.random() * 60) + 4);
        crypto.getRandomValues(sig);

        const hex = toHex(sig);
        const b64 = toBase64(sig);

        const decodedHex = decodeSignature(hex);
        const decodedB64 = decodeSignature(b64);
        const decodedRaw = decodeSignature(sig);

        expect(Buffer.from(decodedHex).equals(Buffer.from(sig))).toBe(true);
        expect(Buffer.from(decodedB64).equals(Buffer.from(sig))).toBe(true);
        expect(Buffer.from(decodedRaw).equals(Buffer.from(sig))).toBe(true);
      }
    });
  });
});
