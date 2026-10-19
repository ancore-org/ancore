/**
 * Formatting utilities for Stellar amounts and transaction fees.
 */

/**
 * 1 XLM = 10,000,000 stroops.
 */
export const STROOPS_PER_XLM = 10_000_000;

/**
 * Convert an amount in XLM to whole stroops.
 *
 * @param xlm Amount in XLM (number or string)
 * @returns Stroop amount rounded to nearest integer
 */
export function xlmToStroops(xlm: string | number): number {
  if (typeof xlm === 'number') {
    if (isNaN(xlm) || !isFinite(xlm) || xlm <= 0) return 0;
    return Math.round(xlm * STROOPS_PER_XLM);
  }
  const cleaned = xlm.replace(/XLM/i, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num) || !isFinite(num) || num <= 0) return 0;
  return Math.round(num * STROOPS_PER_XLM);
}

/**
 * Formats a transaction fee in both XLM and stroops for developer clarity:
 * '{xlmAmount} XLM ({stroopAmount} stroops)'
 *
 * Handles:
 * - string and numeric XLM values (e.g. '0.0000100', 0.00001)
 * - fees already suffixed with 'XLM'
 * - zero fees ('0 XLM (0 stroops)')
 * - sub-stroop fractions (e.g. '0.00000005' -> '0.00000005 XLM (0.5 stroops)')
 *
 * @param fee Estimated fee in XLM
 * @returns Formatted fee string
 */
export function formatFeeWithStroops(fee: string | number | undefined | null): string {
  if (fee === undefined || fee === null || fee === '') {
    return '0 XLM (0 stroops)';
  }

  const rawStr = typeof fee === 'string' ? fee.replace(/XLM/i, '').trim() : String(fee);
  const num = parseFloat(rawStr);

  if (isNaN(num) || num === 0) {
    const displayXlm = rawStr || '0';
    return `${displayXlm} XLM (0 stroops)`;
  }

  const exactStroops = num * STROOPS_PER_XLM;
  let stroopStr: string;

  if (Math.abs(exactStroops - Math.round(exactStroops)) < 1e-9) {
    stroopStr = `${Math.round(exactStroops)}`;
  } else if (exactStroops < 1 && exactStroops > 0) {
    stroopStr = `${parseFloat(exactStroops.toFixed(4))}`;
  } else {
    stroopStr = `${parseFloat(exactStroops.toFixed(2))}`;
  }

  return `${rawStr} XLM (${stroopStr} stroops)`;
}
