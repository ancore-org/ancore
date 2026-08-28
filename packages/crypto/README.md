# @ancore/crypto

Cryptographic utilities for Ancore wallet.

## Assumptions

This package makes several assumptions about cryptographic operations. For details on supported transaction envelope types, encryption parameters, and other security assumptions, see [CRYPTO_ASSUMPTIONS.md](./src/CRYPTO_ASSUMPTIONS.md).

## Mnemonic Validation

### `validateMnemonicStrength(mnemonic: string): void`

Validates a BIP39 mnemonic phrase and throws a typed `MnemonicValidationError` on failure.
Use this in wallet import flows where clear error messages are needed.

```typescript
import { validateMnemonicStrength, MnemonicValidationError } from '@ancore/crypto';

try {
  validateMnemonicStrength(userInput);
  // Proceed with import — checksum and wordlist are valid
} catch (err) {
  if (err instanceof MnemonicValidationError) {
    // err.code is one of:
    //   'INVALID_TYPE'     — not a non-empty string
    //   'INVALID_LENGTH'   — must be 12 or 24 words
    //   'UNKNOWN_WORDS'    — contains words not in the English BIP39 wordlist
    //   'INVALID_CHECKSUM' — BIP39 checksum mismatch (likely a typo)
    console.error(err.message); // Human-readable message safe to show users
    console.debug(err.details); // Extra debugging context (optional)
  }
}
```

**Validated checks (in order):**

1. Input must be a non-empty string.
2. Word count must be exactly 12 or 24 (other BIP39 lengths are not supported).
3. Every word must exist in the English BIP39 wordlist (non-English wordlists are rejected).
4. BIP39 checksum must pass.

**Note:** Non-English BIP39 wordlists (Chinese, French, Italian, Japanese, Korean, Spanish, Czech,
Portuguese) are intentionally not supported. Use `assertEnglishMnemonic` directly if you need
a descriptive error specifically for language rejection.

### `validateMnemonic(mnemonic: string): boolean`

Non-throwing variant. Returns `true` for a valid 12-word English BIP39 mnemonic, `false` otherwise.
Only accepts 12-word mnemonics (unlike `validateMnemonicStrength` which also accepts 24 words).

### `generateMnemonic(): string`

Generates a cryptographically secure 12-word BIP39 mnemonic using 128 bits of entropy.

## Stellar signing test vectors

Ed25519 payload signing is guarded by Stellar SDK-aligned fixtures in
`src/__tests__/vectors/stellar-ed25519-signing.json`. The vector suite covers empty, one-byte,
31-byte, 32-byte, 64-byte, and larger payloads used by intent signing so curve or encoding changes
fail loudly.

To add a vector from the upstream SDK:

1. Use only a disposable `Keypair.random()` test key.
2. Run `pnpm --dir packages/crypto exec node scripts/generate-signing-vectors.mjs` or sign exact UTF-8 payload bytes with `keypair.sign(Buffer.from(payload, 'utf8'))`.
3. Commit the payload, public key, test secret seed, and hex signature in the JSON fixture.
4. Run `pnpm --dir packages/crypto test -- signing-vectors.test.ts` before opening a PR.

Never commit production secrets or user-derived seeds.
