I need to see the current content of `error-messages.ts` to write accurate tests. Since only the test file is being created, I'll write tests based on the described exports and structure. Let me create the test file based on the plan.

```typescript
import {
  SPECIFIC_ERROR_MESSAGES,
  getErrorMessageByCode,
  getFallbackErrorMessage,
  ERROR_MESSAGES,
  ErrorCategory,
} from '../error-messages';

describe('error-messages', () => {
  describe('getErrorMessageByCode', () => {
    it.each(Object.keys(SPECIFIC_ERROR_MESSAGES))(
      'returns a non-empty title and description for code "%s"',
      (code) => {
        const message = getErrorMessageByCode(code);

        expect(message).toBeDefined();
        expect(typeof message.title).toBe('string');
        expect(message.title.length).toBeGreaterThan(0);
        expect(typeof message.description).toBe('string');
        expect(message.description.length).toBeGreaterThan(0);
      },
    );

    it('returns the fallback message for an unknown code', () => {
      const message = getErrorMessageByCode('NOT_A_REAL_CODE');

      expect(message).toEqual(ERROR_MESSAGES[ErrorCategory.UNKNOWN]);
    });

    it('does not leak "undefined" or "[object Object]" in messages for known codes', () => {
      Object.keys(SPECIFIC_ERROR_MESSAGES).forEach((code) => {
        const message = getErrorMessageByCode(code);

        expect(message.title).not.toContain('undefined');
        expect(message.title).not.toContain('[object Object]');
        expect(message.description).not.toContain('undefined');
        expect(message.description).not.toContain('[object Object]');

        if (message.recoveryHint !== undefined) {
          expect(message.recoveryHint).not.toContain('undefined');
          expect(message.recoveryHint).not.toContain('[object Object]');
        }
      });
    });

    it('does not leak "undefined" or "[object Object]" in the fallback message', () => {
      const message = getErrorMessageByCode('NOT_A_REAL_CODE');

      expect(message.title).not.toContain('undefined');
      expect(message.title).not.toContain('[object Object]');
      expect(message.description).not.toContain('undefined');
      expect(message.description).not.toContain('[object Object]');

      if (message.recoveryHint !== undefined) {
        expect(message.recoveryHint).not.toContain('undefined');
        expect(message.recoveryHint).not.toContain('[object Object]');
      }
    });
  });

  describe('getFallbackErrorMessage', () => {
    const categories = Object.values(ErrorCategory);

    it.each(categories)(
      'returns the UNKNOWN message for category "%s"',
      (category) => {
        const message = getFallbackErrorMessage(category);

        expect(message).toEqual(ERROR_MESSAGES[ErrorCategory.UNKNOWN]);
      },
    );

    it('returns a message with non-empty title and description', () => {
      categories.forEach((category) => {
        const message = getFallbackErrorMessage(category);

        expect(typeof message.title).toBe('string');
        expect(message.title.length).toBeGreaterThan(0);
        expect(typeof message.description).toBe('string');
        expect(message.description.length).toBeGreaterThan(0);
      });
    });

    it('does not leak "undefined" or "[object Object]" for any category', () => {
      categories.forEach((category) => {
        const message = getFallbackErrorMessage(category);

        expect(message.title).not.toContain('undefined');
        expect(message.title).not.toContain('[object Object]');
        expect(message.description).not.toContain('undefined');
        expect(message.description).not.toContain('[object Object]');

        if (message.recoveryHint !== undefined) {
          expect(message.recoveryHint).not.toContain('undefined');
          expect(message.recoveryHint).not.toContain('[object Object]');
        }
      });
    });
  });
});