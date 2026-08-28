/**
 * Display formatting for on-ledger amounts.
 *
 * Stellar amounts carry 7 decimal places and the dashboard handles arbitrary
 * asset codes, so an amount cannot be rendered as a two-decimal dollar value.
 * Formatting an XLM balance as `$12.35` both invents a currency and silently
 * discards up to five decimal places of the real amount.
 *
 * Everything here is pure so the rules can be unit-tested without React.
 */

/** Stellar's fixed precision: amounts are exact to 7 decimal places. */
export const STELLAR_DECIMALS = 7;

/** Asset code assumed when a transaction does not carry one. */
export const DEFAULT_ASSET_CODE = 'XLM';

/**
 * Render an amount at Stellar's precision, without trailing zeros.
 *
 * Grouping separators are applied to the integer part so large amounts stay
 * readable; the fractional part is left ungrouped.
 */
export function formatAssetAmountValue(amount: number): string {
  if (!Number.isFinite(amount)) return '—';

  const fixed = amount.toFixed(STELLAR_DECIMALS);
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  const [integerPart, fractionPart] = trimmed.split('.');
  const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Number(integerPart)
  );

  return fractionPart ? `${grouped}.${fractionPart}` : grouped;
}

/**
 * Render an amount alongside its asset code, e.g. `142.5 XLM`.
 *
 * The asset code is appended rather than turned into a currency symbol: only
 * the issuer knows what an arbitrary code is worth, and prefixing `$` would
 * assert a currency the ledger never stated.
 */
export function formatAssetAmount(amount: number, assetCode?: string | null): string {
  const code = assetCode?.trim() || DEFAULT_ASSET_CODE;
  return `${formatAssetAmountValue(amount)} ${code}`;
}
