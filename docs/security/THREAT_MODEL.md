# Threat Model

This document outlines the threat model for Ancore, identifying assets, adversaries, attack vectors, and mitigation strategies for the smart wallet system built on Stellar.

## Overview

Ancore is a decentralized smart wallet system that provides account abstraction, session key management, and encrypted storage. The threat model focuses on protecting user funds, private keys, and sensitive data while maintaining usability and decentralization.

## System Assets

### Primary Assets

#### User Funds

- **Description**: Cryptocurrency assets held in user accounts
- **Value**: High - Direct financial value
- **Location**: Stellar blockchain, smart contracts
- **Threat Level**: Critical

#### Private Keys

- **Description**: Ed25519 private keys for account control
- **Value**: Critical - Complete account control
- **Location**: Client-side storage, encrypted backups
- **Threat Level**: Critical

#### Mnemonic Phrases

- **Description**: BIP39 seed phrases for wallet recovery
- **Value**: Critical - Wallet recovery capability
- **Location**: User backup, encrypted storage
- **Threat Level**: Critical

#### Session Keys

- **Description**: Time-limited signing keys for specific operations
- **Value**: High - Limited account access
- **Location**: Smart contracts, client applications
- **Threat Level**: High

#### Encrypted Data

- **Description**: User data encrypted with password-derived keys
- **Value**: Medium - Sensitive user information
- **Location**: Client storage, cloud backups
- **Threat Level**: Medium

### Secondary Assets

#### User Identity Data

- **Description**: Personal information and preferences
- **Value**: Low-Medium - Privacy concerns
- **Location**: Client applications
- **Threat Level**: Low

#### Transaction History

- **Description**: Historical transaction data
- **Value**: Low - Privacy implications
- **Location**: Stellar blockchain, client cache
- **Threat Level**: Low

#### Application State

- **Description**: Application configuration and settings
- **Value**: Low - Operational continuity
- **Location**: Client applications
- **Threat Level**: Low

## Trust Boundaries

### Trust Domain 1: Client Environment

**Components**:

- User devices (mobile, desktop, web)
- Browser extensions
- Mobile applications

**Trust Assumptions**:

- Client environment may be compromised
- Device security varies by user
- Network connectivity may be intercepted

**Boundary Protection**:

- Client-side encryption
- Secure key derivation
- Input validation and sanitization

### Trust Domain 2: Smart Contracts

**Components**:

- Account abstraction contract
- Session key management
- Validation modules

**Trust Assumptions**:

- Contract code is audited and immutable
- Stellar blockchain operates correctly
- Consensus mechanisms function properly

**Boundary Protection**:

- Formal verification
- Comprehensive testing
- Upgrade safety mechanisms

### Trust Domain 3: Stellar Network

**Components**:

- Stellar consensus protocol
- Network validators
- Horizon API endpoints

**Trust Assumptions**:

- Stellar network security model holds
- Majority of validators are honest
- Network remains available

**Boundary Protection**:

- Transaction validation
- Network monitoring
- Fallback mechanisms

### Trust Domain 4: External Services

**Components**:

- RPC endpoints
- API services
- Infrastructure providers

**Trust Assumptions**:

- Services may be unavailable or compromised
- Network connectivity may be unreliable
- Rate limiting may be enforced

**Boundary Protection**:

- Multiple endpoint support
- Local caching
- Graceful degradation

## Adversary Profiles

### Adversary A1: External Attacker

**Capabilities**:

- Network traffic analysis
- Public contract interaction
- Social engineering
- Phishing attacks

**Resources**:

- Moderate technical skills
- Limited financial resources
- Publicly available tools

**Motivation**:

- Financial gain
- Data theft
- Service disruption

### Adversary A2: Insider Threat

**Capabilities**:

- Access to internal systems
- Knowledge of architecture
- Ability to modify code/configuration

**Resources**:

- High technical skills
- Internal access privileges
- Time and patience

**Motivation**:

- Financial gain
- Revenge
- Ideological reasons

### Adversary A3: Nation-State Actor

**Capabilities**:

- Advanced cryptographic attacks
- Network infrastructure compromise
- Supply chain attacks
- Significant computing resources

**Resources**:

- Very high technical skills
- Substantial financial resources
- Multiple attack vectors

**Motivation**:

- Intelligence gathering
- Financial disruption
- Strategic advantage

### Adversary A4: Malicious User

**Capabilities**:

- Legitimate account access
- Client application usage
- Transaction manipulation

**Resources**:

- Basic technical skills
- Limited financial resources
- Understanding of system

**Motivation**:

- Fee avoidance
- Transaction manipulation
- Exploiting vulnerabilities

## Attack Vectors

### AV1: Private Key Compromise

**Description**: Unauthorized access to user private keys
**Impact**: Complete loss of account control and funds
**Likelihood**: Medium
**Severity**: Critical

**Attack Methods**:

- Malware on user devices
- Phishing attacks
- Physical device theft
- Social engineering
- Side-channel attacks

**Mitigations**:

- Hardware wallet support
- Encrypted key storage
- Multi-factor authentication
- Security best practices education
- Regular security updates

### AV2: Mnemonic Phrase Exposure

**Description**: Unauthorized access to wallet recovery phrases
**Impact**: Complete wallet compromise
**Likelihood**: Medium
**Severity**: Critical

**Attack Methods**:

- Insecure storage
- Screenshots/photos
- Digital backups
- Physical observation
- Keylogger malware

**Mitigations**:

- Secure backup guidance
- Encryption of backups
- Physical security recommendations
- Warning systems for insecure practices
- Recovery phrase validation

### AV3: Session Key Abuse

**Description**: Unauthorized use of compromised or expired session keys
**Impact**: Limited account access and transaction capabilities
**Likelihood**: High
**Severity**: High

**Attack Methods**:

- Session key theft
- Expiration bypass
- Permission escalation
- Replay attacks
- Man-in-the-middle attacks

**Mitigations**:

- Time-based expiration
- Permission scoping
- Secure key generation
- Nonce-based replay protection
- Regular session key rotation

### AV4: Smart Contract Vulnerabilities

**Description**: Exploitation of contract logic flaws
**Impact**: Contract manipulation, fund loss, system disruption
**Likelihood**: Low
**Severity**: Critical

**Attack Methods**:

- Reentrancy attacks
- Integer overflow/underflow
- Access control bypass
- Logic errors
- Gas limit manipulation

**Mitigations**:

- Formal verification
- Comprehensive testing
- Code audits
- Upgrade safety mechanisms
- Bug bounty programs

### AV5: Cryptographic Weaknesses

**Description**: Weaknesses in cryptographic implementation
**Impact**: Key recovery, data decryption, signature forgery
**Likelihood**: Low
**Severity**: Critical

**Attack Methods**:

- Weak random number generation
- Insufficient key derivation
- Algorithm selection attacks
- Side-channel attacks
- Implementation flaws

**Mitigations**:

- Use of established cryptographic libraries
- Proper parameter selection
- Regular security reviews
- Implementation best practices
- Cryptographic agility

### AV6: Network Attacks

**Description**: Attacks on network infrastructure and communication
**Impact**: Transaction manipulation, service disruption, data interception
**Likelihood**: Medium
**Severity**: Medium

**Attack Methods**:

- Man-in-the-middle attacks
- DNS spoofing
- RPC endpoint compromise
- Network denial of service
- Traffic analysis

**Mitigations**:

- TLS encryption
- Certificate pinning
- Multiple endpoint support
- Request/response validation
- Network monitoring

### AV7: Client-Side Attacks

**Description**: Attacks targeting user devices and applications
**Impact**: Key theft, transaction manipulation, data exposure
**Likelihood**: High
**Severity**: High

**Attack Methods**:

- Malware infection
- Browser extension attacks
- Supply chain attacks
- Memory scraping
- UI spoofing

**Mitigations**:

- Code signing
- Regular security updates
- Input validation
- Secure development practices
- User education

### AV8: Social Engineering

**Description**: Manipulation of users to reveal sensitive information
**Impact**: Credential theft, unauthorized transactions, data exposure
**Likelihood**: High
**Severity**: High

**Attack Methods**:

- Phishing emails/messages
- Fake support calls
- Impersonation attacks
- Urgency tactics
- Authority exploitation

**Mitigations**:

- User education
- Warning systems
- Transaction confirmations
- Support verification
- Security best practices

## Risk Assessment

### Critical Risks

#### RC1: Private Key Theft

- **Risk**: Complete loss of user funds
- **Probability**: Medium
- **Impact**: Critical
- **Mitigation**: Hardware wallets, encrypted storage, user education

#### RC2: Contract Upgrade Attacks

- **Risk**: Unauthorized contract modifications
- **Probability**: Low
- **Impact**: Critical
- **Mitigation**: Owner-controlled upgrades, formal verification

#### RC3: Session Key Bypass

- **Risk**: Unauthorized account access
- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Time-based expiration, permission scoping

### High Risks

#### RH1: Mnemonic Phrase Compromise

- **Risk**: Complete wallet compromise
- **Probability**: Medium
- **Impact**: Critical
- **Mitigation**: Secure backup guidance, encryption

#### RH2: Replay Attacks

- **Risk**: Transaction replay and double-spending
- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Nonce management, sequence numbers

#### RH3: Denial of Service

- **Risk**: Service unavailability
- **Probability**: High
- **Impact**: Medium
- **Mitigation**: Redundancy, rate limiting, monitoring

### Medium Risks

#### RM1: Information Disclosure

- **Risk**: Sensitive data exposure
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: Encryption, access controls

#### RM2: Supply Chain Attacks

- **Risk**: Malicious code injection
- **Probability**: Low
- **Impact**: High
- **Mitigation**: Code signing, dependency scanning

## Security Controls

### Preventive Controls

#### Cryptographic Controls

- Strong encryption algorithms (AES-256-GCM)
- Secure key derivation (PBKDF2 with 100K+ iterations)
- Ed25519 digital signatures
- Cryptographically secure random number generation

#### Access Controls

- Owner-only contract operations
- Session key permission scoping
- Time-based access controls
- Multi-factor authentication support

#### Development Controls

- Secure coding practices
- Code review requirements
- Static analysis tools
- Dependency scanning

### Detective Controls

#### Monitoring

- Transaction monitoring
- Anomaly detection
- Security event logging
- Performance monitoring

#### Auditing

- Transaction audit trails
- Access log analysis
- Security incident tracking
- Regular security assessments

### Corrective Controls

#### Incident Response

- Security incident procedures
- Emergency response team
- Communication protocols
- Recovery procedures

#### Recovery

- Backup and restore procedures
- Key rotation mechanisms
- Contract upgrade capabilities
- Service restoration plans

## Assumptions and Limitations

### Security Assumptions

#### Cryptographic Assumptions

- AES-256-GCM remains secure
- Ed25519 signature scheme is secure
- PBKDF2 with sufficient iterations is secure
- Stellar network cryptographic primitives are secure

#### Network Assumptions

- Stellar network remains operational
- Majority of validators are honest
- Network consensus mechanisms function correctly
- Internet connectivity is available

#### User Assumptions

- Users follow security best practices
- Users protect their devices and credentials
- Users understand the risks and responsibilities
- Users keep software updated

### Limitations

#### Technical Limitations

- Client-side security depends on user device security
- Network attacks may affect service availability
- Zero-day vulnerabilities may exist
- Social engineering attacks are difficult to prevent

#### Operational Limitations

- User education effectiveness varies
- Security updates may not be immediately adopted
- Incident response time may be limited
- Resource constraints may impact security measures

## Ongoing Threat Monitoring

### Emerging Threats

- New cryptographic attacks
- Evolving social engineering tactics
- Advanced persistent threats
- Regulatory changes affecting security

### Monitoring Activities

- Security intelligence gathering
- Vulnerability scanning
- Threat hunting
- Security assessment updates

### Review Process

- Quarterly threat model reviews
- Annual security assessments
- Post-incident threat analysis
- Continuous improvement process

## References

### Security Standards

- OWASP Application Security Verification Standard
- NIST Cybersecurity Framework
- ISO 27001 Information Security Management
- SANS Security Controls

### Blockchain Security

- Smart Contract Weakness Classification Registry
- Ethereum Smart Contract Best Practices
- Stellar Network Security Documentation
- Blockchain Security Guidelines

### Cryptographic Standards

- NIST Cryptographic Standards and Guidelines
- RFC 8032: Ed25519 Digital Signatures
- NIST SP 800-132: Recommendation for Password-Based Key Derivation
- FIPS 197: Advanced Encryption Standard (AES)

---

**Last Updated**: March 2026
**Version**: 1.0
**Review Frequency**: Quarterly or after security incidents
