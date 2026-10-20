import { describe, expect, it } from '@jest/globals';
import { Buffer } from 'node:buffer';
import { importFromRawEd25519Seed } from '../keys';

describe('importFromRawEd25519Seed', () => {
  it('successfully imports a 32-byte seed', () => {
    const seed = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1));
    const keypair = importFromRawEd25519Seed(seed);
    expect(keypair).toBeDefined();
    expect(keypair.publicKey()).toBeTruthy();
  });

  it('throws TypeError for 16-byte seed', () => {
    const seed = Buffer.from(Array.from({ length: 16 }, (_, i) => i));
    expect(() => importFromRawEd25519Seed(seed)).toThrow(TypeError);
    expect(() => importFromRawEd25519Seed(seed)).toThrow('Seed must be exactly 32 bytes');
  });

  it('throws TypeError for 31-byte seed', () => {
    const seed = Buffer.from(Array.from({ length: 31 }, (_, i) => i));
    expect(() => importFromRawEd25519Seed(seed)).toThrow(TypeError);
    expect(() => importFromRawEd25519Seed(seed)).toThrow('Seed must be exactly 32 bytes');
  });

  it('throws TypeError for 33-byte seed', () => {
    const seed = Buffer.from(Array.from({ length: 33 }, (_, i) => i));
    expect(() => importFromRawEd25519Seed(seed)).toThrow(TypeError);
    expect(() => importFromRawEd25519Seed(seed)).toThrow('Seed must be exactly 32 bytes');
  });

  it('throws TypeError for 64-byte seed', () => {
    const seed = Buffer.from(Array.from({ length: 64 }, (_, i) => i));
    expect(() => importFromRawEd25519Seed(seed)).toThrow(TypeError);
    expect(() => importFromRawEd25519Seed(seed)).toThrow('Seed must be exactly 32 bytes');
  });

  it('accepts Uint8Array as seed', () => {
    const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
    const keypair = importFromRawEd25519Seed(seed);
    expect(keypair).toBeDefined();
    expect(keypair.publicKey()).toBeTruthy();
  });

  it('throws TypeError for null seed', () => {
    expect(() => importFromRawEd25519Seed(null as any)).toThrow(TypeError);
    expect(() => importFromRawEd25519Seed(null as any)).toThrow('Seed must be a Buffer or Uint8Array');
  });

  it('throws TypeError for undefined seed', () => {
    expect(() => importFromRawEd25519Seed(undefined as any)).toThrow(TypeError);
    expect(() => importFromRawEd25519Seed(undefined as any)).toThrow('Seed must be a Buffer or Uint8Array');
  });

  it('throws TypeError for string seed', () => {
    expect(() => importFromRawEd25519Seed('not a buffer' as any)).toThrow(TypeError);
    expect(() => importFromRawEd25519Seed('not a buffer' as any)).toThrow('Seed must be a Buffer or Uint8Array');
  });
});
