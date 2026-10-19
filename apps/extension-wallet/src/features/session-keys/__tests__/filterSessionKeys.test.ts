import { describe, it, expect } from 'vitest';
import type { SessionKey } from '@ancore/types';
import { filterSessionKeys } from '../filterSessionKeys';

const keys: SessionKey[] = [
  { publicKey: 'GABCDEF1234', permissions: [], expiresAt: 1, label: 'Swap App' },
  { publicKey: 'GXYZ9876543', permissions: [], expiresAt: 1, label: 'Game' },
  { publicKey: 'GQQQ0000000', permissions: [], expiresAt: 1 },
];

describe('filterSessionKeys', () => {
  it('returns all keys for an empty or whitespace query', () => {
    expect(filterSessionKeys(keys, '')).toEqual(keys);
    expect(filterSessionKeys(keys, '   ')).toEqual(keys);
  });

  it('matches public key case-insensitively by substring', () => {
    expect(filterSessionKeys(keys, 'gabc')).toEqual([keys[0]]);
    expect(filterSessionKeys(keys, '9876')).toEqual([keys[1]]);
  });

  it('matches label case-insensitively', () => {
    expect(filterSessionKeys(keys, 'SWAP')).toEqual([keys[0]]);
  });

  it('matches the hex representation of the public key', () => {
    const hex = Array.from(new TextEncoder().encode(keys[2].publicKey))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(filterSessionKeys(keys, hex.slice(0, 12))).toEqual([keys[2]]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterSessionKeys(keys, 'nomatch')).toEqual([]);
  });
});
