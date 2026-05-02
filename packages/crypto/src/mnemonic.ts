import * as bip39 from 'bip39';

/**
 * The only supported mnemonic wordlist language.
 * Non-English BIP39 wordlists (Chinese, French, Italian, Japanese, Korean,
 * Spanish, Czech, Portuguese) are intentionally not supported.
 */
export const SUPPORTED_MNEMONIC_LANGUAGE = 'english' as const;

/**
 * Error thrown when a mnemonic phrase contains words from an unsupported
 * (non-English) BIP39 wordlist.
 */
export class UnsupportedMnemonicLanguageError extends Error {
  /** Words found in the input that are not part of the English BIP39 wordlist. */
  public readonly unsupportedWords: string[];

  constructor(unsupportedWords: string[]) {
    super(
      `Mnemonic contains words not found in the English BIP39 wordlist: [${unsupportedWords.join(', ')}]. ` +
        `Only the English wordlist is supported. ` +
        `Non-English wordlists (Chinese, French, Italian, Japanese, Korean, Spanish, Czech, Portuguese) are not accepted.`
    );
    this.name = 'UnsupportedMnemonicLanguageError';
    this.unsupportedWords = unsupportedWords;
  }
}

/**
 * Checks whether every word in the mnemonic belongs to the English BIP39
 * wordlist.  Throws {@link UnsupportedMnemonicLanguageError} when one or more
 * words are not in the English wordlist.
 *
 * This guard must be called before any further mnemonic processing to ensure
 * non-English wordlists are rejected with a clear, actionable error rather
 * than a silent validation failure.
 *
 * @param mnemonic - The mnemonic phrase to check (whitespace-separated words)
 * @throws {UnsupportedMnemonicLanguageError} If any word is absent from the
 *   English BIP39 wordlist
 */
export function assertEnglishMnemonic(mnemonic: string): void {
  // bip39 exports `wordlists` at runtime but the stub @types/bip39 does not
  // declare it; cast through `unknown` to satisfy the DTS compiler while
  // retaining full type safety at the call site.
  const allWordlists = (bip39 as unknown as { wordlists: Record<string, string[]> }).wordlists;
  const englishWordlist: string[] = allWordlists['english'];
  const englishSet = new Set(englishWordlist);

  const words = mnemonic.trim().split(/\s+/);
  const nonEnglishWords = words.filter((w) => !englishSet.has(w));

  if (nonEnglishWords.length > 0) {
    throw new UnsupportedMnemonicLanguageError(nonEnglishWords);
  }
}

/**
 * Generates a standard BIP39 12-word mnemonic phrase.
 * Uses secure randomness provided by the environment.
 *
 * @returns {string} A 12-word mnemonic phrase.
 */
export function generateMnemonic(): string {
  // bip39.generateMnemonic(128) generates a 12-word mnemonic.
  // Entropy for 12 words is 128 bits.
  return bip39.generateMnemonic(128);
}

/**
 * Validates a given mnemonic phrase.
 * Ensures the phrase is a valid BIP39 12-word mnemonic using the English
 * wordlist only.
 *
 * Non-English BIP39 wordlists are not supported. If the mnemonic contains
 * words outside the English wordlist the function returns false (it does NOT
 * throw; use {@link assertEnglishMnemonic} when you need a descriptive error).
 *
 * @param mnemonic - The mnemonic phrase to validate
 * @returns true if the mnemonic is a valid 12-word English BIP39 mnemonic,
 *   false otherwise
 */
export function validateMnemonic(mnemonic: string): boolean {
  if (!mnemonic || typeof mnemonic !== 'string') {
    return false;
  }

  // Ensure it's exactly 12 words
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 12) {
    return false;
  }

  const normalizedMnemonic = words.join(' ');

  // Language guard: reject any word not in the English BIP39 wordlist.
  try {
    assertEnglishMnemonic(normalizedMnemonic);
  } catch {
    return false;
  }

  // Validate against BIP39 English wordlist and checksum
  return bip39.validateMnemonic(normalizedMnemonic);
}
