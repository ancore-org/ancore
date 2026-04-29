/**
 * Passphrase entropy estimation for security strength assessment.
 * Useful for determining password quality and guiding users toward stronger passphrases.
 */

export interface EntropyEstimate {
  bits: number;
  score: EntropyScore;
  crackTime: string;
}

export type EntropyScore = 'very_weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very_strong';

/**
 * Default minimum entropy threshold in bits.
 * This represents a reasonable security level for most applications.
 */
export const DEFAULT_ENTROPY_THRESHOLD = 50;

/**
 * Strict minimum entropy threshold in bits.
 * Use for highly sensitive applications like crypto wallets.
 */
export const STRICT_ENTROPY_THRESHOLD = 60;

/**
 * Calculates the Shannon entropy of a passphrase in bits.
 * Entropy = log2(character_set_size) * length
 *
 * @param passphrase - The passphrase to analyze
 * @returns Entropy in bits
 *
 * @example
 * estimateEntropy("MyP@ssw0rd1234") // ~74 bits
 * estimateEntropy("password") // ~26 bits
 */
export function estimateEntropy(passphrase: string): number {
  if (!passphrase || passphrase.length === 0) {
    return 0;
  }

  let characterSetSize = 0;

  // Check for character classes
  if (/[a-z]/.test(passphrase)) characterSetSize += 26;
  if (/[A-Z]/.test(passphrase)) characterSetSize += 26;
  if (/[0-9]/.test(passphrase)) characterSetSize += 10;
  if (/[^a-zA-Z0-9]/.test(passphrase)) characterSetSize += 32; // Rough estimate for special chars

  if (characterSetSize === 0) {
    return 0;
  }

  return Math.log2(characterSetSize) * passphrase.length;
}

/**
 * Scores entropy and categorizes it into strength levels.
 *
 * @param entropy - Entropy in bits
 * @returns An entropy score category
 *
 * @example
 * scoreEntropy(30) // 'weak'
 * scoreEntropy(80) // 'very_strong'
 */
export function scoreEntropy(entropy: number): EntropyScore {
  if (entropy < 30) return 'very_weak';
  if (entropy < 50) return 'weak';
  if (entropy < 60) return 'fair';
  if (entropy < 80) return 'good';
  if (entropy < 100) return 'strong';
  return 'very_strong';
}

/**
 * Estimates time to crack based on entropy.
 * Assumes 1 trillion guesses per second (a very powerful attacker).
 *
 * @param entropy - Entropy in bits
 * @returns Human-readable string describing the estimated time to crack
 *
 * @example
 * estimateCrackTime(30) // "Minutes"
 * estimateCrackTime(80) // "Millennia"
 */
export function estimateCrackTime(entropy: number): string {
  const possibilities = Math.pow(2, entropy);
  const guessesPerSecond = 1e12; // 1 trillion guesses/second
  const secondsToGuess = possibilities / (2 * guessesPerSecond);

  if (secondsToGuess < 1e-3) return 'Milliseconds';
  if (secondsToGuess < 1) return 'Seconds';
  if (secondsToGuess < 60) return 'Seconds';
  if (secondsToGuess < 3600) return 'Minutes';
  if (secondsToGuess < 86400) return 'Hours';
  if (secondsToGuess < 2592000) return 'Days';
  if (secondsToGuess < 31536000) return 'Months';
  if (secondsToGuess < 315360000) return 'Years';
  if (secondsToGuess < 3153600000) return 'Decades';
  if (secondsToGuess < 31536000000) return 'Centuries';
  return 'Millennia';
}

/**
 * Comprehensive entropy analysis for a passphrase.
 *
 * @param passphrase - The passphrase to analyze
 * @returns An object containing entropy bits, score, and estimated crack time
 *
 * @example
 * analyzeEntropy("MyP@ssw0rd1234")
 * // { bits: 74.3, score: 'strong', crackTime: 'Centuries' }
 */
export function analyzeEntropy(passphrase: string): EntropyEstimate {
  const bits = estimateEntropy(passphrase);
  const score = scoreEntropy(bits);
  const crackTime = estimateCrackTime(bits);

  return { bits: Math.round(bits * 10) / 10, score, crackTime };
}

/**
 * Checks if a passphrase meets the minimum entropy threshold.
 *
 * @param passphrase - The passphrase to check
 * @param threshold - Minimum required entropy in bits (defaults to DEFAULT_ENTROPY_THRESHOLD)
 * @returns true if entropy >= threshold, false otherwise
 *
 * @example
 * meetsEntropyThreshold("MyP@ssw0rd1234") // true (if entropy > 50)
 * meetsEntropyThreshold("password") // false
 */
export function meetsEntropyThreshold(
  passphrase: string,
  threshold: number = DEFAULT_ENTROPY_THRESHOLD
): boolean {
  return estimateEntropy(passphrase) >= threshold;
}

/**
 * Checks if a passphrase meets the strict entropy threshold.
 * Recommended for crypto wallets and highly sensitive applications.
 *
 * @param passphrase - The passphrase to check
 * @returns true if entropy >= STRICT_ENTROPY_THRESHOLD, false otherwise
 *
 * @example
 * meetsStrictEntropyThreshold("MyP@ssw0rd1234!@#") // true or false
 */
export function meetsStrictEntropyThreshold(passphrase: string): boolean {
  return meetsEntropyThreshold(passphrase, STRICT_ENTROPY_THRESHOLD);
}
