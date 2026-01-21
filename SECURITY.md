# Security Policy

## Overview

Security is paramount for Ancore. This document outlines our security policies, disclosure process, and audit history.

## Supported Versions

| Version | Supported          | Status      |
| ------- | ------------------ | ----------- |
| 0.1.x   | :white_check_mark: | Development |
| < 0.1   | :x:                | Deprecated  |

**Note**: We are currently in active development. Mainnet launch will be announced separately.

## Security Model

### Trust Assumptions

Ancore's security model assumes:

1. **Contract Immutability**: Deployed contracts are immutable once audited
2. **Key Security**: Users maintain control of their private keys
3. **Network Security**: Stellar network operates correctly
4. **Client Security**: User devices are not compromised

### Threat Model

See [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) for detailed threat analysis.

Key threats we mitigate:

- Private key theft
- Social engineering attacks
- Malicious transaction signing
- Unauthorized session key usage
- Contract upgrade attacks
- Replay attacks

## Security Boundaries

### High-Security Components

The following components undergo rigorous security review:

#### Smart Contracts

- `contracts/account/` - Core account logic
- `contracts/validation-modules/` - Signature validation
- `contracts/upgrade/` - Upgrade mechanisms

**Process**:

- Internal security review
- External security audit
- Formal verification (where applicable)
- Bug bounty program

#### Cryptographic Operations

- `packages/crypto/` - Key generation, signing, encryption

**Requirements**:

- Use audited cryptographic libraries only
- No custom crypto primitives without expert review
- Constant-time operations for sensitive data

#### Account Abstraction Core

- `packages/account-abstraction/` - Account abstraction primitives

**Requirements**:

- Comprehensive test coverage (>90%)
- Fuzz testing for validation logic
- Integration tests with actual contracts

### Medium-Security Components

- `packages/core-sdk/` - Main SDK
- `services/relayer/` - Transaction relay service

**Requirements**:

- Standard code review
- Security considerations documented
- Input validation and sanitization

### Lower-Risk Components

- `apps/**` - User interfaces
- `packages/ui-kit/` - UI components
- `docs/**` - Documentation

**Requirements**:

- Standard code review
- XSS prevention
- CSRF protection

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities.

### Disclosure Process

1. **Report**: Contact us via Telegram at [Ancore TG](https://t.me/+OqlAx-gQx3M4YzJk) with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

2. **Response**: We will:
   - Acknowledge receipt within 24 hours
   - Provide initial assessment within 72 hours
   - Keep you updated on progress

3. **Resolution**:
   - Critical issues: Patched within 7 days
   - High severity: Patched within 14 days
   - Medium severity: Patched within 30 days
   - Low severity: Addressed in next release

4. **Disclosure**:
   - Coordinated disclosure after patch is deployed
   - Credit given to reporter (unless anonymity requested)
   - Public postmortem published

### Severity Levels

#### Critical

- Loss of funds
- Unauthorized account access
- Contract upgrade attacks

#### High

- DOS attacks on critical functionality
- Session key bypass
- Authorization flaws

#### Medium

- Information disclosure
- Limited DOS attacks
- Client-side vulnerabilities

#### Low

- Non-exploitable bugs
- Cosmetic issues
- Best practice violations

## Security Audits

### Planned Audits

- [ ] Q2 2026: Initial contract audit (Trail of Bits / OpenZeppelin)
- [ ] Q3 2026: SDK security review
- [ ] Q4 2026: Full-stack audit before mainnet

### Audit Reports

All audit reports will be published in `docs/security/audits/`.

## Secure Development Practices

### For Contributors

If you're contributing to high-security components:

1. **Threat Modeling**: Consider attack vectors
2. **Defense in Depth**: Multiple layers of security
3. **Fail Securely**: Default to safe behavior on errors
4. **Input Validation**: Validate all external inputs
5. **Access Control**: Enforce principle of least privilege
6. **Cryptography**: Use established libraries only
7. **Testing**: Include security test cases

### Code Review Checklist

High-security code must pass:

- [ ] Integer overflow/underflow checks
- [ ] Reentrancy protection
- [ ] Access control verification
- [ ] Input validation
- [ ] Error handling
- [ ] Gas optimization (but not at cost of security)
- [ ] Documentation of security assumptions

## Incident Response

### Process

1. **Detection**: Via monitoring, reports, or audits
2. **Assessment**: Evaluate severity and impact
3. **Containment**: Prevent further damage
4. **Remediation**: Deploy fixes
5. **Communication**: Notify affected users
6. **Postmortem**: Publish detailed analysis

### Emergency Contacts

- Telegram: [Ancore TG](https://t.me/+OqlAx-gQx3M4YzJk)

## Security Best Practices for Users

### Wallet Security

- Never share your seed phrase
- Use hardware wallets for large amounts
- Verify transaction details before signing
- Be cautious of phishing attempts
- Keep software updated

### Session Keys

- Grant minimal necessary permissions
- Use short expiration times
- Revoke unused session keys
- Review active sessions regularly

### Recovery

- Set up social recovery before you need it
- Choose trusted guardians
- Test recovery process with small amounts

## Responsible Disclosure Examples

### Good Report

```
Subject: Authorization Bypass in Session Key Validation

Description:
The validateSessionKey function does not properly check expiration times,
allowing expired session keys to be used.

Steps to Reproduce:
1. Create session key with 1-hour expiration
2. Wait 2 hours
3. Use expired key to sign transaction
4. Transaction is accepted

Impact:
Expired session keys can be used indefinitely, violating intended security model.

Suggested Fix:
Add explicit timestamp check before signature validation in
packages/account-abstraction/src/session.ts:145
```

### Bad Report

```
Your code is insecure
```

## Security Updates

Subscribe to security updates:

- GitHub Watch → Custom → Security alerts
- Telegram: [https://t.me/+OqlAx-gQx3M4YzJk](https://t.me/+OqlAx-gQx3M4YzJk)

## Acknowledgments

We thank the following security researchers:

- (Hall of fame will be populated as issues are reported)

## Contact

- **Telegram**: [https://t.me/+OqlAx-gQx3M4YzJk](https://t.me/+OqlAx-gQx3M4YzJk)
- **Response Time**: Within 24 hours

---

**Last Updated**: January 2026
