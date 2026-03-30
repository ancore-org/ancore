# Implement deriveKeypairFromMnemonic(mnemonic, index)

## Summary
This PR implements deterministic key derivation from BIP39 mnemonic phrases for the Ancore wallet, enabling secure account recovery and onboarding without storing secret material.

## Changes Made

### Dependencies Added
- Added `bip39@^3.1.0` and `ed25519-hd-key@^1.3.0` to `packages/crypto/package.json`

### New Implementation
- **File**: `packages/crypto/src/key-derivation.ts`
- **Main Function**: `deriveKeypairFromMnemonic(mnemonic, index)`
  - Uses standard BIP44 derivation path: `m/44'/148'/0'/0/{index}`
  - Supports both 12-word and 24-word BIP39 mnemonics
  - Returns Stellar-compatible Keypair objects
  - Comprehensive input validation

### Additional Helper Functions
- `validateMnemonicForStellar(mnemonic)` - Validates mnemonic can derive Stellar keys
- `deriveMultipleKeypairsFromMnemonic(mnemonic, count, startIndex)` - Batch key derivation

### Exports
- Updated `packages/crypto/src/index.ts` to export all new functions

### Comprehensive Testing
- **File**: `packages/crypto/src/__tests__/derive-keypair.test.ts`
- **Test Coverage**:
  - Deterministic derivation (same inputs → same outputs)
  - Index variation (different indices → different keys)
  - Mnemonic variation (different mnemonics → different keys)
  - Support for 12-word and 24-word mnemonics
  - Input validation and error handling
  - Edge cases (large indices, batch derivation)
  - Integration with existing mnemonic functions

## Key Features

### Security
- Uses industry-standard BIP39 and BIP44 derivation
- No secret material storage required
- Deterministic: same mnemonic + index always produces same keypair

### Compatibility
- Follows Stellar's BIP44 coin type (148')
- Compatible with existing Stellar SDK Keypair class
- Works with both 12-word and 24-word mnemonics

### Testing
- 100% deterministic behavior verified
- Index variation thoroughly tested
- Error conditions properly handled
- Integration with existing crypto package functions

## Usage Example

```typescript
import { deriveKeypairFromMnemonic } from '@ancore/crypto';

// Derive keypair for account index 0
const keypair = deriveKeypairFromMnemonic(
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  0
);

console.log(keypair.publicKey()); // Stellar public key starting with 'G'
console.log(keypair.secret());    // Stellar secret key starting with 'S'
```

## Definition of Done ✅

- [x] Deterministic derivation passes tests
- [x] Different index values yield different keypairs  
- [x] Same mnemonic+index produces same keypair
- [x] Compatible with Stellar address generation
- [x] Comprehensive unit tests for determinism and index variation
- [x] Required derivation dependencies added
- [x] Error handling for invalid inputs

## Files Changed

1. `packages/crypto/package.json` - Added dependencies
2. `packages/crypto/src/key-derivation.ts` - New implementation
3. `packages/crypto/src/index.ts` - Updated exports
4. `packages/crypto/src/__tests__/derive-keypair.test.ts` - Comprehensive tests

## Labels
crypto, security, foundation, critical
