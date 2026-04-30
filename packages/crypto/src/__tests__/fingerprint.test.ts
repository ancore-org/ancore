import { keyFingerprint } from '../fingerprint';

const KEY_A = 'GBVZZ3XZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZX';
const KEY_B = 'GCAAA3XZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZXZX';

describe('keyFingerprint', () => {
  it('matches format: 8 groups of 4 lowercase hex chars separated by colons', () => {
    const fp = keyFingerprint(KEY_A);
    expect(fp).toMatch(/^[0-9a-f]{4}(:[0-9a-f]{4}){7}$/);
  });

  it('is deterministic — same key always produces the same fingerprint', () => {
    expect(keyFingerprint(KEY_A)).toBe(keyFingerprint(KEY_A));
  });

  it('produces different fingerprints for different keys', () => {
    expect(keyFingerprint(KEY_A)).not.toBe(keyFingerprint(KEY_B));
  });

  it('accepts raw Uint8Array key material', () => {
    const raw = new Uint8Array(32).fill(0xab);
    const fp = keyFingerprint(raw);
    expect(fp).toMatch(/^[0-9a-f]{4}(:[0-9a-f]{4}){7}$/);
  });

  it('different raw byte inputs produce different fingerprints', () => {
    const raw1 = new Uint8Array(32).fill(0xab);
    const raw2 = new Uint8Array(32).fill(0xcd);
    expect(keyFingerprint(raw1)).not.toBe(keyFingerprint(raw2));
  });
});
