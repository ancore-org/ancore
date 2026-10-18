import { describe, it, expect } from 'vitest';
import { deriveKeypairFromMnemonic } from '../key-derivation';
import { Keypair } from '@stellar/stellar-sdk';

describe('BIP32 Hardened Derivation Boundaries (#1536)', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('should successfully derive at index 0', () => {
    const keypair = deriveKeypairFromMnemonic(mnemonic, 0);
    expect(keypair).toBeInstanceOf(Keypair);
    expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
    expect(keypair.secret()).toMatch(/^S[A-Z0-9]{55}$/);
  });

  it('should successfully derive at maximum hardened index 2^31 - 1 (0x7FFFFFFF)', () => {
    const maxIndex = 0x7fffffff; // 2,147,483,647
    const keypair = deriveKeypairFromMnemonic(mnemonic, maxIndex);
    expect(keypair).toBeInstanceOf(Keypair);
    expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
  });

  it('should throw RangeError for index 2^31 (0x80000000)', () => {
    const boundaryIndex = 0x80000000; // 2,147,483,648
    expect(() => deriveKeypairFromMnemonic(mnemonic, boundaryIndex)).toThrow(RangeError);
  });

  it('should throw RangeError for index 0xFFFFFFFF', () => {
    const maxUint32 = 0xffffffff;
    expect(() => deriveKeypairFromMnemonic(mnemonic, maxUint32)).toThrow(RangeError);
  });

  it('should throw RangeError for negative indices', () => {
    expect(() => deriveKeypairFromMnemonic(mnemonic, -1)).toThrow(RangeError);
    expect(() => deriveKeypairFromMnemonic(mnemonic, -0x80000000)).toThrow(RangeError);
  });
});
