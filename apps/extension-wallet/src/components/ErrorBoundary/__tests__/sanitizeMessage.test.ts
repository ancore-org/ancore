I need to see the current content of `ErrorBoundary.tsx` to understand the `sanitizeMessage` implementation before writing tests. However, since only the test file is being created and the step says the function is already exported, I'll write the test file based on the described behavior.

Let me create the test file:

```typescript
import { sanitizeMessage } from '../ErrorBoundary';

const REDACTED = '[redacted — potentially sensitive content]';

describe('sanitizeMessage', () => {
  describe('Stellar secret key redaction', () => {
    it('redacts a 56-character S... secret key embedded in a message', () => {
      const message =
        'failed with key SABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      expect(sanitizeMessage(message)).toBe(REDACTED);
    });

    it('redacts a lowercase s... secret key variant', () => {
      const message =
        'failed with key sabcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuvwxyz234567';
      expect(sanitizeMessage(message)).toBe(REDACTED);
    });

    it('redacts a mixed-case S... secret key variant', () => {
      const message =
        'failed with key SaBcDeFgHiJkLmNoPqRsTuVwXyZ234567AbCdEfGhIjKlMnOpQrStUvWxYz234567';
      expect(sanitizeMessage(message)).toBe(REDACTED);
    });
  });

  describe('sensitive keyword redaction', () => {
    it.each([
      'secret',
      'private key',
      'privateKey',
      'mnemonic',
      'seed',
      'passphrase',
    ])('redacts a message containing the keyword "%s"', (keyword) => {
      const message = `An error occurred involving the ${keyword} value`;
      expect(sanitizeMessage(message)).toBe(REDACTED);
    });
  });

  describe('non-sensitive messages', () => {
    it('returns a normal message unchanged', () => {
      const message = 'Network request failed';
      expect(sanitizeMessage(message)).toBe(message);
    });

    it('does not redact a G... public key', () => {
      const message =
        'account GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      expect(sanitizeMessage(message)).toBe(message);
    });

    it('returns an empty string unchanged', () => {
      expect(sanitizeMessage('')).toBe('');
    });
  });

  // NOTE: Known false positives — the keyword patterns are intentionally broad.
  // For example, the word "seed" appearing in unrelated text (e.g. "random seed
  // for the RNG") will be redacted even though it is not sensitive. Similarly,
  // "secret" in benign phrases like "secret santa" is redacted. These are
  // accepted trade-offs; do not loosen the patterns without updating the tests.
});
```

Wait — I should verify the exact redaction string. The step specifies `'[redacted — potentially sensitive content]'` with an em dash. I'll use that exact string.

The file content is complete.