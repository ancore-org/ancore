# RFC Process

## Overview

Significant changes to Ancore require an RFC (Request for Comments) to ensure proper review and community input.

## When to Write an RFC

### Requires an RFC

- New public API surfaces
- Breaking changes to existing APIs
- New cryptographic primitives
- Changes to account validation logic
- New contract deployments
- Major architectural changes
- Changes to security model
- New protocols or standards

### Does Not Require an RFC

- Bug fixes
- Documentation improvements
- Performance optimizations (without API changes)
- Internal refactoring
- Test additions
- Minor UX improvements

**When in doubt, ask in [Telegram](https://t.me/+OqlAx-gQx3M4YzJk) or open an issue.**

## RFC Process

### 1. Preparation

Before writing an RFC:

- Search existing RFCs and issues
- Discuss informally in [Telegram](https://t.me/+OqlAx-gQx3M4YzJk)
- Gather initial feedback
- Consider alternatives

### 2. Writing

1. Copy the template:

   ```bash
   cp docs/rfcs/0000-template.md docs/rfcs/0000-my-feature.md
   ```

2. Fill in all sections:
   - Summary
   - Motivation
   - Detailed Design
   - Drawbacks
   - Alternatives
   - Adoption Strategy

3. Be specific and thorough

### 3. Submission

1. Open a pull request with the RFC
2. Title: `RFC: Brief Description`
3. Label: `rfc`
4. Assign to relevant maintainers

### 4. Discussion

- Community reviews and comments
- Author addresses feedback
- Revisions pushed to the same PR
- Discussion period: minimum 1 week (2 weeks for major changes)

### 5. Decision

Possible outcomes:

- **Accepted**: RFC is merged, implementation can begin
- **Rejected**: RFC is closed with explanation
- **Postponed**: Good idea, but not right now
- **Withdrawn**: Author decides not to proceed

Decision makers:

- Relevant component maintainers
- Core team for major changes
- Lead maintainer for final call if needed

### 6. Implementation

Once accepted:

1. RFC is assigned a number (e.g., `0001-session-keys.md`)
2. Implementation PRs reference the RFC
3. RFC updated if design changes during implementation
4. RFC marked as "Implemented" when complete

## RFC Lifecycle

```
Proposed → In Discussion → Accepted/Rejected/Postponed
                              ↓
                         Implementation
                              ↓
                          Completed
```

## RFC Template

```markdown
# RFC: [Title]

- **RFC Number**: [Assigned upon merge]
- **Author**: [Your Name]
- **Status**: Proposed
- **Created**: YYYY-MM-DD
- **Updated**: YYYY-MM-DD

## Summary

One paragraph explanation.

## Motivation

Why is this change needed? What problem does it solve?

## Detailed Design

Thorough explanation of the feature:

- API surface
- Implementation approach
- Examples
- Edge cases

## Drawbacks

Why should we _not_ do this?

## Alternatives

What other approaches were considered?

## Security Considerations

Security implications and mitigations.

## Adoption Strategy

How will this be rolled out?

- Migration path
- Backward compatibility
- Documentation needs

## Unresolved Questions

What remains to be decided?

## References

Related issues, discussions, external resources.
```

## Examples of Good RFCs

### Accepted RFCs

(Will be populated as RFCs are written)

### Example Outline: Session Keys

```markdown
# RFC: Session Key Management

## Summary

Add time-limited, permission-scoped signing keys to enable seamless UX.

## Motivation

Users shouldn't need to sign every transaction. Enable "logged in" experience
while maintaining security.

## Detailed Design

### API

\`\`\`typescript
interface SessionKey {
publicKey: string;
permissions: Permission[];
expiresAt: number;
}

async function createSession(
account: Account,
permissions: Permission[],
duration: number
): Promise<SessionKey>;
\`\`\`

### Contract Interface

\`\`\`rust #[external(v0)]
fn add_session_key(
ref self: ContractState,
key: PublicKey,
permissions: Permissions,
expiry: u64
);
\`\`\`

### Storage

Sessions stored on-chain in a sparse merkle tree...

### Validation

On transaction validation, check:

1. Session key is registered
2. Not expired
3. Transaction matches permissions
4. Signature valid

## Security Considerations

- Key rotation mechanism needed
- Revocation must be immediate
- Permissions must be granular enough
- Rate limiting to prevent abuse

## Alternatives

1. **OAuth-style tokens**: More complex, requires backend
2. **Multisig**: Poor UX, gas intensive
3. **No sessions**: Secure but bad UX

## Adoption Strategy

- Add to SDK first
- Update extension wallet
- Document for third-party developers
- Example implementations

## Unresolved Questions

- Should we support key delegation (meta-sessions)?
- What's the maximum permission granularity?
```

## RFC Numbering

- RFCs are numbered sequentially starting from 0001
- Number assigned when RFC is accepted
- File renamed from `0000-feature.md` to `XXXX-feature.md`

## RFC Status Values

- **Proposed**: Under discussion
- **Accepted**: Approved, ready for implementation
- **Rejected**: Will not be implemented
- **Postponed**: Good idea, wrong time
- **Withdrawn**: Author withdrew the proposal
- **Implemented**: Completed and shipped

## Tips for Writing Good RFCs

### Do

✅ Be concrete and specific  
✅ Include code examples  
✅ Discuss trade-offs honestly  
✅ Address security implications  
✅ Consider backward compatibility  
✅ Explain the "why" not just the "what"

### Don't

❌ Be vague or hand-wavy  
❌ Ignore alternatives  
❌ Skip the drawbacks section  
❌ Assume everyone has context  
❌ Write a novel (be concise)  
❌ Propose multiple changes at once

## Questions?

- **Telegram**: [https://t.me/+OqlAx-gQx3M4YzJk](https://t.me/+OqlAx-gQx3M4YzJk)
- **Issues**: Open a discussion issue first

## References

Our RFC process is inspired by:

- [Rust RFCs](https://github.com/rust-lang/rfcs)
- [React RFCs](https://github.com/reactjs/rfcs)
- [Ethereum EIPs](https://eips.ethereum.org/)

---

**See also**: [CONTRIBUTING.md](CONTRIBUTING.md), [MAINTAINERS.md](MAINTAINERS.md)
