/**
 * Options for fiat currency formatting
 */
export interface FiatFormatOptions {
  /**
   * Currency code (ISO 4217)
   * @default 'USD'
   */
  currency?: string;

  /**
   * Locale string for formatting
   * Fallback behavior: If the provided locale is invalid or unsupported,
   * it falls back to the system default locale, and ultimately to 'en-US'.
   * @default 'en-US'
   */
  locale?: string | string[];

  /**
   * Minimum fraction digits
   * @default 2
   */
  minimumFractionDigits?: number;

  /**
   * Maximum fraction digits.
   * Rounding rule: Uses half-expand rounding (standard Intl.NumberFormat behavior)
   * where it rounds to the nearest number, and in case of a tie, rounds away from zero.
   * E.g., 1.005 becomes 1.01, and 1.004 becomes 1.00
   * @default 2
   */
  maximumFractionDigits?: number;
}

/**
 * Formats a numeric amount as a fiat currency string.
 *
 * Rounding rules:
 * Uses standard Intl.NumberFormat rounding (half-expand).
 *
 * Fallback behavior:
 * - If locale is invalid, falls back to standard Intl fallback ('en-US' usually)
 * - If Intl is not available or parameters are severely malformed, falls back to basic string formatting
 *
 * @param amount The numerical amount to format
 * @param options Formatting options
 * @returns Formatted currency string
 */
export function formatFiatAmount(amount: number, options: FiatFormatOptions = {}): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
  } catch (error) {
    // Fallback if Intl fails (e.g., due to an invalid locale input)
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(amount);
    } catch (fallbackError) {
      // Ultimate fallback if even en-US fails (e.g., completely invalid currency code)
      // Return a basic string representation with maximum fraction digits and the currency code.
      return `${amount.toFixed(maximumFractionDigits)} ${currency}`;
    }
  }
}