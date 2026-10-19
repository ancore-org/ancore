import {
  isValidBIP32Path,
  isStandardStellarPath,
  parseBIP32Path,
  deriveMainAccountPath,
  deriveSessionKeyPath,
  formatBIP32Path,
  BIP32PathError,
  MAX_BIP32_INDEX,
  STELLAR_COIN_TYPE,
  BIP44_PURPOSE,
} from '../bip32';

describe('BIP32 Path Validation & Derivation Helpers (#1451, #1453)', () => {
  describe('parseBIP32Path & isValidBIP32Path', () => {
    it('validates master path "m"', () => {
      const parsed = parseBIP32Path('m');
      expect(parsed.valid).toBe(true);
      expect(parsed.segments).toHaveLength(0);
      expect(isValidBIP32Path('m')).toBe(true);
    });

    it('validates standard BIP32/BIP44 paths with prime and h suffixes', () => {
      expect(isValidBIP32Path("m/44'/148'/0'")).toBe(true);
      expect(isValidBIP32Path('m/44h/148h/0h')).toBe(true);
      expect(isValidBIP32Path("m/44'/148'/0'/0/0")).toBe(true);
      expect(isValidBIP32Path("m/44'/0'/0'/0/1000")).toBe(true);

      const parsed = parseBIP32Path("m/44'/148'/0'");
      expect(parsed.valid).toBe(true);
      expect(parsed.segments).toEqual([
        { index: 44, hardened: true },
        { index: 148, hardened: true },
        { index: 0, hardened: true },
      ]);
    });

    it('rejects invalid path formats', () => {
      expect(isValidBIP32Path('')).toBe(false);
      expect(isValidBIP32Path('   ')).toBe(false);
      expect(isValidBIP32Path('44/148/0')).toBe(false); // missing m
      expect(isValidBIP32Path('/44/148/0')).toBe(false);
      expect(isValidBIP32Path('m//0')).toBe(false); // empty segment
      expect(isValidBIP32Path('m/abc/0')).toBe(false); // non-numeric
      expect(isValidBIP32Path('m/-1/0')).toBe(false); // negative
      expect(isValidBIP32Path('m/44.5/0')).toBe(false); // float
      expect(isValidBIP32Path("m/44'/")).toBe(false); // trailing slash
    });

    it('rejects indices exceeding 2^31 - 1', () => {
      const overflowIndex = MAX_BIP32_INDEX + 1;
      expect(isValidBIP32Path(`m/44'/148'/${overflowIndex}'`)).toBe(false);

      const parsed = parseBIP32Path(`m/44'/148'/${overflowIndex}'`);
      expect(parsed.valid).toBe(false);
      expect(parsed.error).toContain('exceeds maximum BIP32 index');
    });
  });

  describe('isStandardStellarPath', () => {
    it('accepts standard BIP44 Stellar paths', () => {
      expect(isStandardStellarPath("m/44'/148'/0'")).toBe(true);
      expect(isStandardStellarPath("m/44'/148'/1'")).toBe(true);
      expect(isStandardStellarPath("m/44'/148'/999'")).toBe(true);
      expect(isStandardStellarPath("m/44'/148'/0'/0/0")).toBe(true);
      expect(isStandardStellarPath("m/44'/148'/0'/0'/0'")).toBe(true);
    });

    it('rejects non-Stellar coin types', () => {
      // 0' is Bitcoin, 60' is Ethereum
      expect(isStandardStellarPath("m/44'/0'/0'")).toBe(false);
      expect(isStandardStellarPath("m/44'/60'/0'")).toBe(false);
    });

    it('rejects unhardened purpose, coin type, or account index', () => {
      expect(isStandardStellarPath("m/44/148'/0'")).toBe(false);
      expect(isStandardStellarPath("m/44'/148/0'")).toBe(false);
      expect(isStandardStellarPath("m/44'/148'/0")).toBe(false);
    });

    it('rejects paths that are too short or too deep', () => {
      expect(isStandardStellarPath('m')).toBe(false);
      expect(isStandardStellarPath("m/44'")).toBe(false);
      expect(isStandardStellarPath("m/44'/148'")).toBe(false);
      expect(isStandardStellarPath("m/44'/148'/0'/0/0/0/0")).toBe(false);
    });
  });

  describe('deriveMainAccountPath', () => {
    it('returns canonical m/44\'/148\'/{index}\'', () => {
      expect(deriveMainAccountPath(0)).toBe("m/44'/148'/0'");
      expect(deriveMainAccountPath(1)).toBe("m/44'/148'/1'");
      expect(deriveMainAccountPath(42)).toBe("m/44'/148'/42'");
    });

    it('throws BIP32PathError on invalid indices', () => {
      expect(() => deriveMainAccountPath(-1)).toThrow(BIP32PathError);
      expect(() => deriveMainAccountPath(1.5)).toThrow(BIP32PathError);
      expect(() => deriveMainAccountPath(MAX_BIP32_INDEX + 1)).toThrow(BIP32PathError);
    });
  });

  describe('deriveSessionKeyPath', () => {
    it('returns canonical m/44\'/148\'/{account}\'/2\'/{session}\'', () => {
      expect(deriveSessionKeyPath(0, 0)).toBe("m/44'/148'/0'/2'/0'");
      expect(deriveSessionKeyPath(5, 1)).toBe("m/44'/148'/1'/2'/5'");
    });

    it('throws BIP32PathError on invalid indices', () => {
      expect(() => deriveSessionKeyPath(-1, 0)).toThrow(BIP32PathError);
      expect(() => deriveSessionKeyPath(0, -1)).toThrow(BIP32PathError);
    });
  });

  describe('formatBIP32Path', () => {
    it('reconstructs path from segments', () => {
      expect(formatBIP32Path([])).toBe('m');
      expect(
        formatBIP32Path([
          { index: 44, hardened: true },
          { index: 148, hardened: true },
          { index: 0, hardened: true },
        ]),
      ).toBe("m/44'/148'/0'");

      expect(
        formatBIP32Path([
          { index: 44, hardened: true },
          { index: 148, hardened: true },
          { index: 0, hardened: false },
        ]),
      ).toBe("m/44'/148'/0");
    });
  });
});
