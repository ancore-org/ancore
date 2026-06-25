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
   * it falls back directly to 'en-US'.
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

function resolveSupportedLocale(locale: string | string[]): string | string[] {
  try {
    const requestedLocales = Array.isArray(locale) ? locale : [locale];
    const supportedLocales = Intl.NumberFormat.supportedLocalesOf(requestedLocales);

    if (supportedLocales.length > 0) {
      return Array.isArray(locale) ? supportedLocales : supportedLocales[0];
    }
  } catch {
    // Fall through to the stable fallback below.
  }

  return 'en-US';
}

/**
 * Formats a numeric amount as a fiat currency string.
 *
 * Rounding rules:
 * Uses standard Intl.NumberFormat rounding (half-expand).
 *
 * Fallback behavior:
 * - If locale is invalid or unsupported, falls back to 'en-US'
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
    return new Intl.NumberFormat(resolveSupportedLocale(locale), {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
  } catch {
    // Fallback if Intl fails (e.g., due to an invalid locale input)
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(amount);
    } catch {
      // Ultimate fallback if even en-US fails (e.g., completely invalid currency code)
      // Return a basic string representation with maximum fraction digits and the currency code.
      return `${amount.toFixed(maximumFractionDigits)} ${currency}`;
    }
  }
}
