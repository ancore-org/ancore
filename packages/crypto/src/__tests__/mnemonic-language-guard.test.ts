import * as bip39 from 'bip39';
import {
  assertEnglishMnemonic,
  UnsupportedMnemonicLanguageError,
  validateMnemonic,
  SUPPORTED_MNEMONIC_LANGUAGE,
} from '../mnemonic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick N words from a bip39 wordlist (non-English) for test fixtures. */
function sampleWords(listName: string, count: number): string[] {
  const list: string[] = (bip39.wordlists as Record<string, string[]>)[listName];
  return list.slice(0, count);
}

// ---------------------------------------------------------------------------
// assertEnglishMnemonic
// ---------------------------------------------------------------------------

describe('assertEnglishMnemonic', () => {
  it('does not throw for a valid English BIP39 mnemonic', () => {
    const mnemonic = bip39.generateMnemonic(128);
    expect(() => assertEnglishMnemonic(mnemonic)).not.toThrow();
  });

  it('does not throw for a valid English BIP39 24-word mnemonic', () => {
    const mnemonic = bip39.generateMnemonic(256);
    expect(() => assertEnglishMnemonic(mnemonic)).not.toThrow();
  });

  it('throws UnsupportedMnemonicLanguageError for Japanese words', () => {
    // Use Japanese wordlist words to simulate a Japanese mnemonic input.
    const japaneseWords = sampleWords('japanese', 12);
    const mnemonic = japaneseWords.join(' ');

    expect(() => assertEnglishMnemonic(mnemonic)).toThrow(UnsupportedMnemonicLanguageError);
  });

  it('throws UnsupportedMnemonicLanguageError for Chinese (simplified) words', () => {
    const chineseWords = sampleWords('chinese_simplified', 12);
    const mnemonic = chineseWords.join(' ');

    expect(() => assertEnglishMnemonic(mnemonic)).toThrow(UnsupportedMnemonicLanguageError);
  });

  it('throws UnsupportedMnemonicLanguageError for Spanish words', () => {
    const spanishWords = sampleWords('spanish', 12);
    const mnemonic = spanishWords.join(' ');

    expect(() => assertEnglishMnemonic(mnemonic)).toThrow(UnsupportedMnemonicLanguageError);
  });

  it('throws UnsupportedMnemonicLanguageError for French words', () => {
    const frenchWords = sampleWords('french', 12);
    const mnemonic = frenchWords.join(' ');

    expect(() => assertEnglishMnemonic(mnemonic)).toThrow(UnsupportedMnemonicLanguageError);
  });

  it('throws UnsupportedMnemonicLanguageError for Italian words', () => {
    const italianWords = sampleWords('italian', 12);
    const mnemonic = italianWords.join(' ');

    expect(() => assertEnglishMnemonic(mnemonic)).toThrow(UnsupportedMnemonicLanguageError);
  });

  it('throws UnsupportedMnemonicLanguageError for Korean words', () => {
    const koreanWords = sampleWords('korean', 12);
    const mnemonic = koreanWords.join(' ');

    expect(() => assertEnglishMnemonic(mnemonic)).toThrow(UnsupportedMnemonicLanguageError);
  });

  it('error message lists the unsupported words', () => {
    const spanishWords = sampleWords('spanish', 3);
    const mnemonic = spanishWords.join(' ');

    let caught: UnsupportedMnemonicLanguageError | null = null;
    try {
      assertEnglishMnemonic(mnemonic);
    } catch (err) {
      caught = err as UnsupportedMnemonicLanguageError;
    }

    expect(caught).not.toBeNull();
    expect(caught!.unsupportedWords.length).toBeGreaterThan(0);
    // The error message should explain what is supported.
    expect(caught!.message).toMatch(/English/i);
    expect(caught!.message).toMatch(/wordlist/i);
  });

  it('error name is UnsupportedMnemonicLanguageError', () => {
    const japaneseWords = sampleWords('japanese', 12);
    let caught: Error | null = null;
    try {
      assertEnglishMnemonic(japaneseWords.join(' '));
    } catch (err) {
      caught = err as Error;
    }
    expect(caught!.name).toBe('UnsupportedMnemonicLanguageError');
  });

  it('reports only the non-English words in unsupportedWords', () => {
    // Mix: first 10 valid English words + 2 Spanish words
    const englishMnemonic = bip39.generateMnemonic(128);
    const englishWords = englishMnemonic.split(' ').slice(0, 10);
    const spanishWords = sampleWords('spanish', 2);
    const mixed = [...englishWords, ...spanishWords].join(' ');

    let caught: UnsupportedMnemonicLanguageError | null = null;
    try {
      assertEnglishMnemonic(mixed);
    } catch (err) {
      caught = err as UnsupportedMnemonicLanguageError;
    }

    expect(caught).not.toBeNull();
    // Only the Spanish words should be flagged.
    expect(caught!.unsupportedWords).toEqual(
      expect.arrayContaining(spanishWords.filter((w) => !bip39.wordlists['english'].includes(w)))
    );
  });
});

// ---------------------------------------------------------------------------
// validateMnemonic — language guard integration
// ---------------------------------------------------------------------------

describe('validateMnemonic – language guard', () => {
  it('returns true for a valid 12-word English mnemonic (no regression)', () => {
    const mnemonic = bip39.generateMnemonic(128);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('returns false (not throw) for a Japanese mnemonic', () => {
    const japaneseWords = sampleWords('japanese', 12);
    expect(validateMnemonic(japaneseWords.join(' '))).toBe(false);
  });

  it('returns false (not throw) for a Spanish mnemonic', () => {
    const spanishWords = sampleWords('spanish', 12);
    expect(validateMnemonic(spanishWords.join(' '))).toBe(false);
  });

  it('returns false (not throw) for a Chinese simplified mnemonic', () => {
    const chineseWords = sampleWords('chinese_simplified', 12);
    expect(validateMnemonic(chineseWords.join(' '))).toBe(false);
  });

  it('returns false for a mixed English + non-English mnemonic', () => {
    const englishWords = bip39.generateMnemonic(128).split(' ').slice(0, 10);
    const spanishWords = sampleWords('spanish', 2);
    const mixed = [...englishWords, ...spanishWords].join(' ');
    expect(validateMnemonic(mixed)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SUPPORTED_MNEMONIC_LANGUAGE constant
// ---------------------------------------------------------------------------

describe('SUPPORTED_MNEMONIC_LANGUAGE', () => {
  it('is "english"', () => {
    expect(SUPPORTED_MNEMONIC_LANGUAGE).toBe('english');
  });
});
