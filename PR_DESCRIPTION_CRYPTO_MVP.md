# Crypto Utilities Package MVP - Issue #60

## Summary
Implements the complete crypto utilities package for Ancore, providing essential cryptographic functions needed for wallet onboarding and secure storage of wallet secrets.

## Features Implemented

### 🔑 Mnemonic Support
- **BIP39 12-word mnemonic generation** using secure randomness
- **Mnemonic validation** for BIP39 compliance
- Full integration with `bip39` library for standards compliance

### 🔐 Key Derivation
- **Stellar keypair derivation** from mnemonic using BIP44 path: `m/44'/148'/0'/0/{index}`
- **Multiple keypair generation** with configurable count and start index
- **Mnemonic validation** specifically for Stellar compatibility
- Uses `ed25519-hd-key` for hierarchical deterministic key derivation

### 🛡️ Encryption & Decryption
- **AES-256-GCM encryption** with authenticated encryption
- **PBKDF2 key derivation** with 100,000 iterations for password-based encryption
- **Secure random salt and IV generation** for each encryption
- **Versioned payload format** for future compatibility
- **Comprehensive input validation** and error handling

### ✍️ Digital Signing
- **Transaction signing** for standard Stellar transactions
- **Fee-bump transaction signing** support
- **Message signing** for arbitrary data
- **Signature verification** using Stellar public keys
- Support for both Keypair objects and secret key strings

### 🔐 Password Security
- **Password strength validation** with comprehensive rules
- **Three-tier strength levels**: weak, medium, strong
- **Common weak pattern detection** (sequences, dictionary words, etc.)
- **Detailed feedback** with specific reasons for validation failures

## Files Added/Modified

### Core Implementation
- `packages/crypto/src/mnemonic.ts` - Mnemonic generation and validation
- `packages/crypto/src/key-derivation.ts` - Stellar key derivation from mnemonic
- `packages/crypto/src/encryption.ts` - AES-256-GCM encryption with PBKDF2
- `packages/crypto/src/signing.ts` - Transaction and message signing
- `packages/crypto/src/password.ts` - Password strength validation
- `packages/crypto/src/index.ts` - Package exports and version

### Comprehensive Test Suite
- `packages/crypto/src/__tests__/mnemonic-generate.test.ts` - Mnemonic tests
- `packages/crypto/src/__tests__/derive-keypair.test.ts` - Key derivation tests
- `packages/crypto/src/__tests__/encryption-roundtrip.test.ts` - Encryption tests
- `packages/crypto/src/__tests__/signing.test.ts` - Signing tests
- `packages/crypto/src/__tests__/verify-signature.test.ts` - Signature verification tests
- `packages/crypto/src/__tests__/password-strengh.test.ts` - Password validation tests

## Technical Specifications

### Security Standards
- **BIP39**: Standard mnemonic phrase generation
- **BIP44**: Hierarchical deterministic wallet derivation path `m/44'/148'/0'/0/{index}`
- **AES-256-GCM**: Authenticated encryption with associated data
- **PBKDF2**: Password-based key derivation with SHA-256
- **Ed25519**: Digital signature algorithm for Stellar

### Performance & Safety
- **100,000 PBKDF2 iterations** for strong password-based encryption
- **Secure random generation** for salts and IVs using WebCrypto API
- **Input validation** on all public functions
- **Error handling** that doesn't leak sensitive information
- **Memory-safe** operations using Uint8Array and Buffer

## Definition of Done ✅

- [x] **Encrypt/decrypt round-trip** restores the original secret
- [x] **Signing produces verifiable signatures** 
- [x] **Test suite passes** with comprehensive coverage
- [x] **BIP39 12-word mnemonic** generation and validation
- [x] **Stellar key derivation** from mnemonic
- [x] **AES-256-GCM encryption** with PBKDF2-derived keys
- [x] **Transaction signing helpers** for Stellar operations
- [x] **Unit tests** for each function

## Usage Examples

### Mnemonic Generation
```typescript
import { generateMnemonic, validateMnemonic } from '@ancore/crypto';

const mnemonic = generateMnemonic(); // 12-word BIP39 phrase
const isValid = validateMnemonic(mnemonic); // true
```

### Key Derivation
```typescript
import { deriveKeypairFromMnemonic } from '@ancore/crypto';

const keypair = deriveKeypairFromMnemonic(mnemonic, 0); // First account
console.log(keypair.publicKey()); // Stellar public key
```

### Encryption
```typescript
import { encryptSecretKey, decryptSecretKey } from '@ancore/crypto';

const encrypted = await encryptSecretKey(secretKey, password);
const decrypted = await decryptSecretKey(encrypted, password);
// decrypted === secretKey
```

### Signing
```typescript
import { signTransaction, verifySignature } from '@ancore/crypto';

const signature = await signTransaction(transaction, keypair);
const isValid = await verifySignature(message, signature, publicKey);
```

### Password Validation
```typescript
import { validatePasswordStrength } from '@ancore/crypto';

const result = validatePasswordStrength(password);
if (!result.valid) {
  console.log(result.reasons); // Detailed feedback
}
```

## Dependencies
- `@noble/ed25519` - Ed25519 cryptographic operations
- `@noble/hashes` - Hashing functions
- `@stellar/stellar-sdk` - Stellar SDK integration
- `bip39` - BIP39 mnemonic implementation
- `ed25519-hd-key` - Hierarchical deterministic key derivation

## Testing
The package includes a comprehensive test suite covering:
- Mnemonic generation and validation
- Key derivation accuracy
- Encryption/decryption round-trips
- Digital signature creation and verification
- Password strength validation
- Error handling and edge cases

All tests pass and provide coverage for critical security functions.

## Impact
This implementation enables:
- **Secure wallet onboarding** with mnemonic-based key generation
- **Safe storage** of encrypted wallet secrets in extension storage
- **Local transaction signing** without exposing private keys
- **Message verification** for secure communication
- **Password security** enforcement for user data protection

## Security Considerations
- All cryptographic operations use industry-standard libraries
- Password-based encryption uses strong PBKDF2 iteration count
- Random salts and IVs prevent rainbow table attacks
- Error messages avoid leaking sensitive information
- Input validation prevents malformed data attacks

Resolves: #60
