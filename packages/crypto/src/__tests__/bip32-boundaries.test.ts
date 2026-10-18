import { deriveKeypairFromMnemonic } from '../key-derivation';

// SEP-0005 test vector 1
const SEP5_MNEMONIC = 'illness spike retreat truth genius clock brain pass fit cave bargain toe';
const SEP5_ACCOUNTS = [
  'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6',
  'GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX',
];

const MAX_HARDENED_INDEX = 0x7fffffff;

describe('BIP32 hardened derivation boundaries', () => {
  describe("SEP-0005 path m/44'/148'/index'", () => {
    it.each(SEP5_ACCOUNTS.map((address, index) => [index, address] as const))(
      'derives the SEP-0005 vector for account %i',
      (index, address) => {
        expect(deriveKeypairFromMnemonic(SEP5_MNEMONIC, index).publicKey()).toBe(address);
      }
    );
  });

  describe('valid boundary indices', () => {
    it('accepts index 0', () => {
      expect(() => deriveKeypairFromMnemonic(SEP5_MNEMONIC, 0)).not.toThrow();
    });

    it('accepts the largest hardened-safe index 2^31 - 1', () => {
      const keypair = deriveKeypairFromMnemonic(SEP5_MNEMONIC, MAX_HARDENED_INDEX);
      expect(keypair.publicKey()).toMatch(/^G[A-Z2-7]{55}$/);
      expect(keypair.publicKey()).not.toBe(SEP5_ACCOUNTS[0]);
    });
  });

  describe('invalid boundary indices', () => {
    it.each([0x80000000, 0x80000001, 0xffffffff, 0x100000000, Number.MAX_SAFE_INTEGER])(
      'throws RangeError for index %i (>= 2^31)',
      (index) => {
        expect(() => deriveKeypairFromMnemonic(SEP5_MNEMONIC, index)).toThrow(RangeError);
        expect(() => deriveKeypairFromMnemonic(SEP5_MNEMONIC, index)).toThrow(
          /Index must be between 0 and 2147483647/
        );
      }
    );

    it.each([-1, -0x80000000, 0.5, Number.NaN, Infinity, -Infinity])(
      'throws RangeError for index %p',
      (index) => {
        expect(() => deriveKeypairFromMnemonic(SEP5_MNEMONIC, index)).toThrow(RangeError);
      }
    );
  });
});
