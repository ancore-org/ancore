# Cryptography

This document provides a comprehensive overview of the cryptographic implementations used in Ancore, including algorithms, key management, encryption schemes, and security considerations.

## Overview

Ancore employs a defense-in-depth cryptographic approach to secure user assets, private keys, and sensitive data. The cryptographic stack is designed to provide confidentiality, integrity, authenticity, and non-repudiation while maintaining usability and performance.

## Cryptographic Architecture

### Core Cryptographic Primitives

#### Symmetric Encryption

- **Algorithm**: AES-256-GCM (Advanced Encryption Standard in Galois/Counter Mode)
- **Key Length**: 256 bits
- **IV Length**: 96 bits (12 bytes)
- **Authentication Tag**: 128 bits
- **Purpose**: Encrypted storage of sensitive data

#### Asymmetric Cryptography

- **Algorithm**: Ed25519 (Edwards-curve Digital Signature Algorithm)
- **Curve**: Curve25519
- **Key Length**: 256 bits
- **Signature Length**: 512 bits (64 bytes)
- **Purpose**: Digital signatures, key derivation

#### Key Derivation

- **Algorithm**: PBKDF2 (Password-Based Key Derivation Function 2)
- **Hash Function**: SHA-256
- **Iterations**: 100,000 (minimum), 600,000 (maximum)
- **Salt Length**: 128 bits (16 bytes)
- **Purpose**: Password-based encryption key derivation

#### Random Number Generation

- **Source**: WebCrypto API `getRandomValues()`
- **Entropy**: Cryptographically secure
- **Quality**: CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
- **Purpose**: Key generation, salts, IVs, nonces

## Implementation Details

### Encryption (`packages/crypto/src/encryption.ts`)

#### Secret Key Encryption

```typescript
interface EncryptedSecretKeyPayload {
  version: number;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}
```

**Process Flow**:

1. **Input Validation**: Validate secret key and password inputs
2. **Salt Generation**: Generate 16-byte cryptographically secure random salt
3. **IV Generation**: Generate 12-byte random initialization vector
4. **Key Derivation**: Derive AES-256 key using PBKDF2
5. **Encryption**: Encrypt secret key using AES-256-GCM
6. **Payload Assembly**: Create structured encrypted payload

**Security Features**:

- **Authenticated Encryption**: AES-GCM provides confidentiality and integrity
- **Random Salts**: Unique salts prevent rainbow table attacks
- **Random IVs**: Unique IVs prevent replay attacks
- **Version Control**: Payload versioning for future upgrades
- **Input Validation**: Comprehensive input validation and sanitization

#### Decryption Process

1. **Payload Validation**: Validate encrypted payload structure and version
2. **Parameter Validation**: Validate iteration count, salt, and IV
3. **Key Derivation**: Re-derive encryption key using provided password
4. **Decryption**: Decrypt ciphertext using AES-256-GCM
5. **Integrity Verification**: Verify authentication tag
6. **Error Handling**: Generic error messages to prevent timing attacks

### Key Derivation (`packages/crypto/src/key-derivation.ts`)

#### BIP39 Mnemonic Processing

```typescript
function deriveKeypairFromMnemonic(mnemonic: string, index: number): Keypair;
```

**Derivation Path**: `m/44'/148'/0'/0/{index}`

- **Purpose**: BIP44 purpose
- **Coin Type**: 148' (Stellar - [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md))
- **Account**: 0' (account level)
- **Change**: 0 (external addresses)
- **Index**: {index} (address index)

**Security Features**:

- **Standard Derivation**: Follows BIP44 standard for Stellar
- **Index Validation**: Non-negative integer validation
- **Mnemonic Validation**: BIP39 mnemonic phrase validation
- **Secure Libraries**: Uses audited cryptographic libraries

#### Multiple Key Derivation

```typescript
function deriveMultipleKeypairsFromMnemonic(
  mnemonic: string,
  count: number,
  startIndex: number = 0
): Keypair[];
```

**Security Considerations**:

- **Batch Validation**: Input parameter validation
- **Sequential Derivation**: Ordered key derivation
- **Error Handling**: Comprehensive error management
- **Memory Management**: Secure memory handling

### Digital Signatures (`packages/crypto/src/signing.ts`)

#### Transaction Signing

```typescript
function signTransaction(
  tx: Transaction | FeeBumpTransaction,
  keypair: SignableKeypair
): Promise<Uint8Array>;
```

**Process Flow**:

1. **Key Validation**: Validate keypair or secret key
2. **Transaction Preparation**: Prepare transaction for signing
3. **Hash Calculation**: Calculate transaction hash
4. **Signature Generation**: Generate Ed25519 signature
5. **Signature Attachment**: Attach signature to transaction
6. **Verification**: Verify signature attachment

**Security Features**:

- **Ed25519 Security**: Strong elliptic curve cryptography
- **Transaction Integrity**: Cryptographic transaction binding
- **Key Security**: Secure private key handling
- **Error Handling**: Secure error management

#### Signature Verification

```typescript
function verifySignature(
  message: SignableValue,
  signature: SignableValue,
  publicKey: string
): Promise<boolean>;
```

**Verification Process**:

1. **Input Validation**: Validate message, signature, and public key
2. **Format Conversion**: Convert inputs to appropriate formats
3. **Signature Verification**: Verify Ed25519 signature
4. **Result Handling**: Secure result processing

### Password Security (`packages/crypto/src/password.ts`)

#### Password Strength Validation

```typescript
interface PasswordValidationResult {
  valid: boolean;
  strength: PasswordStrength;
  reasons: string[];
}
```

**Validation Criteria**:

- **Minimum Length**: 12 characters
- **Recommended Length**: 16+ characters
- **Character Requirements**: Uppercase, lowercase, digits, special characters
- **Weak Pattern Detection**: Common password patterns
- **Entropy Assessment**: Password entropy evaluation

**Security Features**:

- **Comprehensive Validation**: Multi-factor password strength assessment
- **Pattern Detection**: Common weak password pattern recognition
- **User Guidance**: Clear security recommendations
- **Privacy Protection**: No password storage or logging

## Cryptographic Parameters

### Encryption Parameters

```typescript
const PBKDF2_ITERATIONS = 100000;
const MAX_PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AES_KEY_LENGTH = 256;
```

### Security Analysis

#### PBKDF2 Iterations

- **100,000 iterations**: Current minimum standard
- **600,000 iterations**: Maximum supported iterations
- **Rationale**: Balance between security and performance
- **Future-proofing**: Support for increased iterations

#### Salt and IV Management

- **16-byte salts**: Sufficient entropy for key derivation
- **12-byte IVs**: Standard for AES-GCM
- **Random Generation**: Cryptographically secure random generation
- **Uniqueness**: Unique salts and IVs for each operation

#### Key Length Selection

- **256-bit AES**: Strong symmetric encryption
- **256-bit Ed25519**: Strong asymmetric cryptography
- **SHA-256**: Secure hash function
- **Future Compatibility**: Adequate security margin

## Security Considerations

### Threat Mitigations

#### Brute Force Attacks

- **High Iteration Count**: 100,000+ PBKDF2 iterations
- **Strong Password Requirements**: Minimum 12 characters with complexity
- **Rate Limiting**: Application-level rate limiting
- **Account Lockout**: Temporary account lockout after failed attempts

#### Side-Channel Attacks

- **Constant-Time Operations**: Where applicable
- **Memory Protection**: Secure memory handling
- **Timing Attack Prevention**: Generic error messages
- **Cache Attack Mitigation**: Regular memory clearing

#### Cryptographic Agility

- **Algorithm Selection**: Industry-standard algorithms
- **Parameter Flexibility**: Configurable security parameters
- **Version Management**: Payload versioning for upgrades
- **Migration Support**: Smooth migration to stronger algorithms

### Implementation Security

#### Secure Coding Practices

- **Input Validation**: Comprehensive input validation
- **Error Handling**: Secure error management
- **Memory Management**: Secure memory handling
- **Code Review**: Security-focused code reviews

#### Library Selection

- **Audited Libraries**: Use of well-audited cryptographic libraries
- **Standard Implementations**: Industry-standard implementations
- **Regular Updates**: Regular library updates and security patches
- **Dependency Management**: Secure dependency management

## Performance Considerations

### Encryption Performance

- **AES-GCM**: Hardware acceleration support
- **PBKDF2**: Tunable iteration count
- **Memory Usage**: Optimized memory usage
- **Caching**: Appropriate caching strategies

### Key Derivation Performance

- **BIP39 Processing**: Efficient mnemonic processing
- **HD Key Derivation**: Optimized hierarchical derivation
- **Batch Operations**: Efficient batch key derivation
- **Memory Optimization**: Optimized memory usage

## Compliance and Standards

### Cryptographic Standards

- **NIST Standards**: NIST-approved cryptographic algorithms
- **FIPS Compliance**: FIPS 140-2 compliance where applicable
- **Industry Standards**: Industry best practices
- **Regulatory Compliance**: Compliance with relevant regulations

### Blockchain Standards

- **Stellar Integration**: Stellar network cryptographic requirements
- **BIP Standards**: BIP39, BIP44 compliance
- **SLIP Standards**: SLIP-0044 compliance
- **EIP Standards**: Relevant Ethereum Improvement Proposals

## Testing and Validation

### Cryptographic Testing

- **Unit Tests**: Comprehensive unit test coverage
- **Integration Tests**: End-to-end cryptographic flows
- **Fuzz Testing**: Fuzz testing for cryptographic functions
- **Performance Testing**: Cryptographic performance validation

### Security Testing

- **Penetration Testing**: Security penetration testing
- **Vulnerability Scanning**: Regular vulnerability scanning
- **Code Analysis**: Static and dynamic code analysis
- **Security Audits**: Regular security audits

## Future Enhancements

### Algorithm Upgrades

- **Post-Quantum Cryptography**: Preparation for quantum-resistant algorithms
- **Hardware Security Modules**: HSM integration support
- **Multi-Party Computation**: MPC support for enhanced security
- **Zero-Knowledge Proofs**: ZKP integration for privacy

### Performance Optimizations

- **Hardware Acceleration**: Enhanced hardware acceleration support
- **Parallel Processing**: Parallel cryptographic operations
- **Memory Optimization**: Further memory usage optimization
- **Caching Improvements**: Intelligent caching strategies

## Monitoring and Maintenance

### Security Monitoring

- **Cryptographic Health**: Monitoring cryptographic operations
- **Performance Metrics**: Cryptographic performance monitoring
- **Error Tracking**: Cryptographic error monitoring
- **Security Events**: Security event tracking

### Maintenance Activities

- **Regular Updates**: Regular cryptographic library updates
- **Parameter Review**: Regular security parameter review
- **Threat Assessment**: Ongoing threat assessment
- **Compliance Review**: Regular compliance review

## References

### Cryptographic Standards

- NIST Special Publication 800-132: Recommendation for Password-Based Key Derivation
- NIST Special Publication 800-38D: Recommendation for Block Cipher Modes of Operation
- RFC 8032: Ed25519: High-speed high-security signatures
- RFC 2898: PKCS #5: Password-Based Cryptography Specification

### Blockchain Standards

- BIP39: Mnemonic Code for Generating Deterministic Keys
- BIP44: Multi-Account Hierarchy for Deterministic Wallets
- SLIP-0044: Registered Coin Types for BIP-0044
- Stellar Technical Documentation

### Security Guidelines

- OWASP Cryptographic Storage Cheat Sheet
- NIST Cybersecurity Framework
- ISO/IEC 27001: Information Security Management
- SANS Cryptographic Security Guidelines

---

**Last Updated**: March 2026
**Version**: 1.0
**Review Frequency**: Quarterly or after cryptographic updates
