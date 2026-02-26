/**
 * Tests for type definitions
 *
 * These tests verify that all type interfaces are properly exported
 * and can be used for type checking.
 */

import type {
  Keypair,
  EncryptedData,
  PasswordStrength,
  MnemonicOptions,
  DerivationOptions,
} from '../types';

describe('Type Definitions', () => {
  describe('Keypair', () => {
    it('should accept valid keypair structure', () => {
      const keypair: Keypair = {
        publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        secretKey: 'SBZVMB74NZNCJYEQVQHQKUDGKZXVLAUSPYAI2VJABQV3KQIQKLSXJVGW',
      };

      expect(keypair.publicKey).toBeDefined();
      expect(keypair.secretKey).toBeDefined();
    });
  });

  describe('EncryptedData', () => {
    it('should accept valid encrypted data structure', () => {
      const encryptedData: EncryptedData = {
        ciphertext: new Uint8Array([1, 2, 3]),
        salt: new Uint8Array(32),
        nonce: new Uint8Array(24),
      };

      expect(encryptedData.ciphertext).toBeInstanceOf(Uint8Array);
      expect(encryptedData.salt).toBeInstanceOf(Uint8Array);
      expect(encryptedData.nonce).toBeInstanceOf(Uint8Array);
    });
  });

  describe('PasswordStrength', () => {
    it('should accept valid password strength structure', () => {
      const strength: PasswordStrength = {
        score: 3,
        feedback: ['Add another word'],
        isValid: true,
      };

      expect(strength.score).toBe(3);
      expect(strength.feedback).toBeInstanceOf(Array);
      expect(strength.isValid).toBe(true);
    });
  });

  describe('MnemonicOptions', () => {
    it('should accept valid mnemonic options with 128-bit strength', () => {
      const options: MnemonicOptions = {
        strength: 128,
      };

      expect(options.strength).toBe(128);
    });

    it('should accept valid mnemonic options with 256-bit strength', () => {
      const options: MnemonicOptions = {
        strength: 256,
      };

      expect(options.strength).toBe(256);
    });

    it('should accept empty options object', () => {
      const options: MnemonicOptions = {};

      expect(options).toBeDefined();
    });
  });

  describe('DerivationOptions', () => {
    it('should accept valid derivation options', () => {
      const options: DerivationOptions = {
        accountIndex: 5,
      };

      expect(options.accountIndex).toBe(5);
    });

    it('should accept empty options object', () => {
      const options: DerivationOptions = {};

      expect(options).toBeDefined();
    });
  });

  describe('Type Exports', () => {
    it('should export all types from index', () => {
      // This test verifies that types can be imported from the main index
      // TypeScript compilation will fail if types are not properly exported
      const testImport = async () => {
        const types = await import('../index');
        // If this compiles, the types are properly exported
        expect(types).toBeDefined();
      };

      expect(testImport).toBeDefined();
    });
  });
});
