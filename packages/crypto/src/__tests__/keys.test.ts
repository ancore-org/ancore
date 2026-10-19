import { importRawEd25519Seed } from '../keys';
import { Keypair } from '@stellar/stellar-sdk';

describe('importRawEd25519Seed', () => {
  it('successfully imports valid 32-byte Buffer seed', () => {
    const rawSeed = Buffer.alloc(32, 7);
    const keypair = importRawEd25519Seed(rawSeed);

    expect(keypair).toBeInstanceOf(Keypair);
    expect(keypair.rawPublicKey().length).toBe(32);
    expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
  });

  it('successfully imports valid 32-byte Uint8Array seed', () => {
    const rawSeed = new Uint8Array(32);
    rawSeed.fill(42);
    const keypair = importRawEd25519Seed(rawSeed);

    expect(keypair).toBeInstanceOf(Keypair);
    expect(keypair.rawPublicKey().length).toBe(32);
  });

  it('successfully imports 32-byte subarray with non-zero offset', () => {
    const largeBuffer = Buffer.alloc(64, 1);
    const slice = largeBuffer.subarray(10, 42); // exactly 32 bytes with offset 10
    expect(slice.byteLength).toBe(32);

    const keypair = importRawEd25519Seed(slice);
    expect(keypair).toBeInstanceOf(Keypair);
  });

  it.each([16, 31, 33, 64])(
    'throws TypeError("Seed must be exactly 32 bytes") for %i-byte Buffer',
    (len) => {
      const invalidSeed = Buffer.alloc(len, 1);
      expect(() => importRawEd25519Seed(invalidSeed)).toThrow(TypeError);
      expect(() => importRawEd25519Seed(invalidSeed)).toThrow('Seed must be exactly 32 bytes');
    }
  );

  it.each([16, 31, 33, 64])(
    'throws TypeError("Seed must be exactly 32 bytes") for %i-byte Uint8Array',
    (len) => {
      const invalidSeed = new Uint8Array(len);
      expect(() => importRawEd25519Seed(invalidSeed)).toThrow(TypeError);
      expect(() => importRawEd25519Seed(invalidSeed)).toThrow('Seed must be exactly 32 bytes');
    }
  );

  it('throws TypeError for non-buffer or falsy inputs', () => {
    expect(() => importRawEd25519Seed(null as any)).toThrow(TypeError);
    expect(() => importRawEd25519Seed(undefined as any)).toThrow(TypeError);
    expect(() => importRawEd25519Seed('not-a-buffer' as any)).toThrow(TypeError);
    expect(() => importRawEd25519Seed({} as any)).toThrow(TypeError);
  });
});
