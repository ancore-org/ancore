# Contributing to Ancore

Thank you for your interest in contributing to Ancore! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Security Boundaries](#security-boundaries)
- [Contribution Guidelines](#contribution-guidelines)
- [Testing Requirements](#testing-requirements)
- [Code Review Process](#code-review-process)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and constructive
- Focus on what is best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Rust toolchain (1.74.0+)
- wasm32-unknown-unknown target (`rustup target add wasm32-unknown-unknown`)
- Soroban CLI (`cargo install --locked soroban-cli`)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ancore.git
   cd ancore
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ancore-org/ancore.git
   ```
4. Install dependencies:
   ```bash
   pnpm install
   ```
5. Build the project:
   ```bash
   pnpm build
   ```

## Development Workflow

### Branch Naming

- `feat/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions/improvements

### Making Changes

1. Create a new branch:

   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes following our [code style](#code-style)

3. Run tests:

   ```bash
   pnpm test
   ```

4. Run linting:

   ```bash
   pnpm lint
   ```

5. Commit your changes:

   ```bash
   git commit -m "feat: add awesome feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/)

6. Push to your fork:

   ```bash
   git push origin feat/my-feature
   ```

7. Open a Pull Request

## Security Boundaries

Contributions are subject to different review processes based on the security level of the code:

### 🔒 High Security (Core Team Only)

These areas require core team approval and formal security review:

- `contracts/**` - All smart contracts
- `packages/crypto/**` - Cryptographic primitives
- `packages/account-abstraction/**` - Account abstraction core logic

**If you want to contribute here:**

1. Open an issue first to discuss the change
2. Expect rigorous review
3. Sign our CLA
4. Provide comprehensive tests

### ⚠️ Medium Risk (Experienced Contributors)

- `packages/core-sdk/**` - Main SDK
- `services/**` - Backend services

**Requirements:**

- Demonstrated understanding of the codebase
- Comprehensive test coverage
- Security considerations documented

### 🟢 Low Risk (All Contributors Welcome)

Great areas for first-time contributors:

- `apps/**` - Wallet applications
- `packages/ui-kit/**` - UI components
- `docs/**` - Documentation
- Tests for existing features
- Bug fixes
- Performance improvements

## Contribution Guidelines

### Code Style

#### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow the existing code style (enforced by Prettier)
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Prefer functional programming patterns

Example:

```typescript
/**
 * Creates a new session key with the specified permissions.
 *
 * @param account - The account to create the session for
 * @param permissions - Permissions for the session key
 * @returns A promise resolving to the session key
 */
export async function createSessionKey(
  account: Account,
  permissions: SessionPermissions
): Promise<SessionKey> {
  // Implementation
}
```

#### Rust (Soroban Smart Contracts)

- Follow Rust conventions and idioms
- Use snake_case for functions and variables
- Use PascalCase for types and traits
- Add comprehensive documentation comments
- Include security considerations in comments
- Write tests for all contract functions

Example:

```rust
/// Validates a transaction signature.
///
/// # Arguments
/// * `env` - The contract environment
/// * `tx_hash` - Hash of the transaction to validate
/// * `signature` - Signature to verify
///
/// # Security
/// Must verify the signer has appropriate permissions
pub fn validate_signature(
    env: Env,
    tx_hash: BytesN<32>,
    signature: BytesN<64>
) -> bool {
    // Implementation
}
```

### Testing Requirements

All contributions must include tests:

#### For TypeScript/JavaScript

```typescript
describe('SessionKey', () => {
  it('should create a valid session key', async () => {
    const account = await createTestAccount();
    const sessionKey = await createSessionKey(account, defaultPermissions);

    expect(sessionKey).toBeDefined();
    expect(sessionKey.isValid()).toBe(true);
  });
});
```

#### For Rust Contracts

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Env, testutils::Address as _};

    #[test]
    fn test_validate_signature() {
        let env = Env::default();
        // Test implementation
        assert!(result);
    }
}
```

### Documentation Requirements

- Update relevant documentation in `docs/`
- Add JSDoc/inline comments for public APIs
- Include examples for new features
- Update README.md if needed

## Code Review Process

### Timeline

- Initial review: 1-3 business days
- High-security code: 1-2 weeks (includes security review)
- Simple fixes: Often same-day

### Review Criteria

Reviewers will check:

- ✅ Code quality and style
- ✅ Test coverage
- ✅ Documentation completeness
- ✅ Security implications
- ✅ Performance considerations
- ✅ Breaking changes properly flagged

### Addressing Feedback

- Respond to all review comments
- Push additional commits to your branch
- Request re-review when ready

## Pull Request Template

When opening a PR, please include:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Security Considerations

Describe any security implications

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests pass locally
- [ ] No new warnings introduced
```

## Community Contributions

### Good First Issues

Look for issues labeled `good-first-issue` to get started.

### Help Wanted

Issues labeled `help-wanted` are priorities where we need community help.

### Documentation

Improving documentation is always appreciated:

- Fix typos
- Clarify confusing sections
- Add examples
- Translate to other languages

## RFCs (Request for Comments)

Major changes require an RFC:

1. Copy `docs/rfcs/0000-template.md` to `docs/rfcs/XXXX-my-feature.md`
2. Fill in the RFC template
3. Open a PR with the RFC
4. Discuss in the PR comments
5. Once approved, implement the feature

## Getting Help

- **Telegram**: [Ancore](https://t.me/+OqlAx-gQx3M4YzJk)
- **Issues**: Open a GitHub issue

## Recognition

Contributors are recognized in:

- Release notes
- `CONTRIBUTORS.md`
- Monthly community highlights

## License

By contributing, you agree that your contributions will be licensed under:

- Apache 2.0 (for contracts and core SDK)
- MIT (for applications and UI)

---

Thank you for contributing to Ancore! 🚀
