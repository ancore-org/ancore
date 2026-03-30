import { 
  deriveKeypairFromMnemonic, 
  validateMnemonicForStellar, 
  deriveMultipleKeypairsFromMnemonic 
} from '../key-derivation';
import { generateMnemonic } from '../mnemonic';
import { Keypair } from '@stellar/stellar-sdk';

describe('Key Derivation', () => {
  // Test mnemonic from BIP39 wordlist (12 words)
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  
  // Another test mnemonic (24 words) 
  const testMnemonic24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
  
  describe('deriveKeypairFromMnemonic', () => {
    it('should derive the same keypair for the same mnemonic and index', () => {
      const keypair1 = deriveKeypairFromMnemonic(testMnemonic, 0);
      const keypair2 = deriveKeypairFromMnemonic(testMnemonic, 0);
      
      expect(keypair1.publicKey()).toEqual(keypair2.publicKey());
      expect(keypair1.secret()).toEqual(keypair2.secret());
    });
    
    it('should derive different keypairs for different indices', () => {
      const keypair0 = deriveKeypairFromMnemonic(testMnemonic, 0);
      const keypair1 = deriveKeypairFromMnemonic(testMnemonic, 1);
      const keypair2 = deriveKeypairFromMnemonic(testMnemonic, 2);
      
      expect(keypair0.publicKey()).not.toEqual(keypair1.publicKey());
      expect(keypair1.publicKey()).not.toEqual(keypair2.publicKey());
      expect(keypair0.publicKey()).not.toEqual(keypair2.publicKey());
    });
    
    it('should derive different keypairs for different mnemonics with same index', () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();
      
      // Ensure we get different mnemonics
      while (mnemonic1 === mnemonic2) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const newMnemonic = generateMnemonic();
        if (newMnemonic !== mnemonic1) break;
      }
      
      const keypair1 = deriveKeypairFromMnemonic(mnemonic1, 0);
      const keypair2 = deriveKeypairFromMnemonic(mnemonic2, 0);
      
      expect(keypair1.publicKey()).not.toEqual(keypair2.publicKey());
    });
    
    it('should work with 24-word mnemonics', () => {
      const keypair = deriveKeypairFromMnemonic(testMnemonic24, 0);
      
      expect(keypair).toBeInstanceOf(Keypair);
      expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
      expect(keypair.secret()).toMatch(/^S[A-Z0-9]{55}$/);
    });
    
    it('should throw error for invalid mnemonic', () => {
      const invalidMnemonic = 'invalid mnemonic phrase';
      
      expect(() => deriveKeypairFromMnemonic(invalidMnemonic, 0)).toThrow('Invalid mnemonic phrase');
    });
    
    it('should throw error for negative index', () => {
      expect(() => deriveKeypairFromMnemonic(testMnemonic, -1)).toThrow('Index must be a non-negative integer');
    });
    
    it('should throw error for non-integer index', () => {
      expect(() => deriveKeypairFromMnemonic(testMnemonic, 0.5)).toThrow('Index must be a non-negative integer');
    });
    
    it('should produce valid Stellar keypairs', () => {
      const keypair = deriveKeypairFromMnemonic(testMnemonic, 0);
      
      // Stellar public keys start with 'G' and are 56 characters (base32)
      expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
      
      // Stellar secret keys start with 'S' and are 56 characters (base32)
      expect(keypair.secret()).toMatch(/^S[A-Z0-9]{55}$/);
    });
    
    it('should be deterministic across multiple calls', () => {
      const derivedKeys = Array.from({ length: 10 }, () => 
        deriveKeypairFromMnemonic(testMnemonic, 5)
      );
      
      // All derived keys should be identical
      const firstKey = derivedKeys[0];
      derivedKeys.forEach(key => {
        expect(key.publicKey()).toEqual(firstKey.publicKey());
        expect(key.secret()).toEqual(firstKey.secret());
      });
    });
  });
  
  describe('validateMnemonicForStellar', () => {
    it('should return true for valid mnemonics', () => {
      expect(validateMnemonicForStellar(testMnemonic)).toBe(true);
      expect(validateMnemonicForStellar(testMnemonic24)).toBe(true);
      expect(validateMnemonicForStellar(generateMnemonic())).toBe(true);
    });
    
    it('should return false for invalid mnemonics', () => {
      expect(validateMnemonicForStellar('invalid mnemonic')).toBe(false);
      expect(validateMnemonicForStellar('')).toBe(false);
      expect(validateMnemonicForStellar('abandon abandon abandon')).toBe(false); // Too short
    });
  });
  
  describe('deriveMultipleKeypairsFromMnemonic', () => {
    it('should derive the specified number of keypairs', () => {
      const keypairs = deriveMultipleKeypairsFromMnemonic(testMnemonic, 5);
      
      expect(keypairs).toHaveLength(5);
      
      // All should be different
      const publicKeys = keypairs.map(kp => kp.publicKey());
      const uniqueKeys = new Set(publicKeys);
      expect(uniqueKeys.size).toBe(5);
    });
    
    it('should derive keypairs starting from the specified index', () => {
      const keypairsFrom0 = deriveMultipleKeypairsFromMnemonic(testMnemonic, 3, 0);
      const keypairsFrom3 = deriveMultipleKeypairsFromMnemonic(testMnemonic, 3, 3);
      
      // Keys should be different
      const keys0 = keypairsFrom0.map(kp => kp.publicKey());
      const keys3 = keypairsFrom3.map(kp => kp.publicKey());
      
      keys0.forEach(key => {
        expect(keys3).not.toContain(key);
      });
      
      // But keypairsFrom3[0] should equal keypairsFrom0[3] if we derived more
      const keypairsFrom0Extended = deriveMultipleKeypairsFromMnemonic(testMnemonic, 4, 0);
      expect(keypairsFrom3[0].publicKey()).toEqual(keypairsFrom0Extended[3].publicKey());
    });
    
    it('should throw error for invalid count', () => {
      expect(() => deriveMultipleKeypairsFromMnemonic(testMnemonic, 0)).toThrow('Count must be a positive integer');
      expect(() => deriveMultipleKeypairsFromMnemonic(testMnemonic, -1)).toThrow('Count must be a positive integer');
      expect(() => deriveMultipleKeypairsFromMnemonic(testMnemonic, 1.5)).toThrow('Count must be a positive integer');
    });
    
    it('should throw error for invalid start index', () => {
      expect(() => deriveMultipleKeypairsFromMnemonic(testMnemonic, 1, -1)).toThrow('Start index must be a non-negative integer');
      expect(() => deriveMultipleKeypairsFromMnemonic(testMnemonic, 1, 0.5)).toThrow('Start index must be a non-negative integer');
    });
    
    it('should work with single keypair derivation', () => {
      const keypairs = deriveMultipleKeypairsFromMnemonic(testMnemonic, 1);
      const singleKeypair = deriveKeypairFromMnemonic(testMnemonic, 0);
      
      expect(keypairs).toHaveLength(1);
      expect(keypairs[0].publicKey()).toEqual(singleKeypair.publicKey());
    });
  });
  
  describe('Integration with existing mnemonic functions', () => {
    it('should work with generated mnemonics', () => {
      const generatedMnemonic = generateMnemonic();
      
      expect(validateMnemonicForStellar(generatedMnemonic)).toBe(true);
      
      const keypair = deriveKeypairFromMnemonic(generatedMnemonic, 0);
      expect(keypair).toBeInstanceOf(Keypair);
      expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle large indices gracefully', () => {
      const keypair0 = deriveKeypairFromMnemonic(testMnemonic, 0);
      const keypair1000 = deriveKeypairFromMnemonic(testMnemonic, 1000);
      
      expect(keypair0.publicKey()).not.toEqual(keypair1000.publicKey());
      expect(keypair1000).toBeInstanceOf(Keypair);
    });
    
    it('should maintain determinism with large indices', () => {
      const keypair1 = deriveKeypairFromMnemonic(testMnemonic, 100);
      const keypair2 = deriveKeypairFromMnemonic(testMnemonic, 100);
      
      expect(keypair1.publicKey()).toEqual(keypair2.publicKey());
      expect(keypair1.secret()).toEqual(keypair2.secret());
    });
  });
});
