/**
 * Client-side validation for the split-bill create form.
 *
 * A split is only well-formed when the participant shares actually add up:
 * either to 100% (percentage mode) or to the stated bill total (amount mode).
 * Without this check the UI happily creates bills whose participant amounts
 * bear no relation to what was owed.
 *
 * Everything here is pure so the rules can be unit-tested without React.
 */

/** How participant shares are entered. */
export type SplitMode = 'amount' | 'percentage';

/**
 * Stellar amounts carry 7 decimal places. Sums are compared with a tolerance
 * of half a stroop so that values which are exact at Stellar's precision are
 * not rejected by binary floating-point drift (e.g. 0.1 + 0.2 !== 0.3).
 */
export const AMOUNT_DECIMALS = 7;
const TOLERANCE = 0.5 / 10 ** AMOUNT_DECIMALS;

/** Percentages must total exactly this. */
export const PERCENTAGE_TOTAL = 100;

/** One row of the participants editor. */
export interface ShareInput {
  /** Stable row key, echoed back on any error that belongs to this row. */
  key: string;
  /** Raw text from the share field — amount or percentage depending on mode. */
  share: string;
}

/** A validation failure tied to a specific row, or to the form as a whole. */
export interface ShareValidationError {
  /** Row key, or `null` for a form-level error such as a bad sum. */
  key: string | null;
  message: string;
}

export interface ValidateSharesInput {
  mode: SplitMode;
  participants: ShareInput[];
  /** Raw text from the bill total field. Required in percentage mode. */
  totalAmount?: string;
}

export interface ValidateSharesResult {
  valid: boolean;
  errors: ShareValidationError[];
  /** Sum of the parsed shares — percent in percentage mode, else an amount. */
  sum: number;
  /**
   * Resolved amount owed per participant, keyed by row key. Only populated
   * when validation passes; in percentage mode these are derived from the
   * total, with any rounding remainder folded into the last participant so
   * the amounts sum exactly to the total.
   */
  amounts: Record<string, string>;
}

/**
 * Parse a user-entered decimal.
 *
 * Rejects blank input, non-numeric text, and the JS-specific values
 * (`Infinity`, `NaN`) that `Number()` would otherwise accept.
 */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^-?\d*\.?\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Round to Stellar's 7-decimal precision and render without trailing zeros. */
export function formatAmount(value: number): string {
  const fixed = value.toFixed(AMOUNT_DECIMALS);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** Whether two amounts are equal at Stellar's precision. */
export function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < TOLERANCE;
}

function roundToPrecision(value: number): number {
  return Number(value.toFixed(AMOUNT_DECIMALS));
}

/**
 * Split `total` across `weights` (percentages), assigning the rounding
 * remainder to the last participant so the parts sum exactly to `total`.
 */
function allocate(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];

  const parts = weights
    .slice(0, -1)
    .map((weight) => roundToPrecision((total * weight) / PERCENTAGE_TOTAL));
  const allocated = parts.reduce((acc, part) => acc + part, 0);

  return [...parts, roundToPrecision(total - allocated)];
}

/**
 * Validate that participant shares sum to 100% (percentage mode) or to the
 * bill total (amount mode).
 *
 * In amount mode the total is optional: when it is blank the individual
 * amounts are still checked for validity, but no sum check is applied — that
 * preserves the "just enter what each person owes" flow.
 */
export function validateShares({
  mode,
  participants,
  totalAmount,
}: ValidateSharesInput): ValidateSharesResult {
  const errors: ShareValidationError[] = [];

  if (participants.length === 0) {
    return {
      valid: false,
      errors: [{ key: null, message: 'Add at least one participant.' }],
      sum: 0,
      amounts: {},
    };
  }

  const parsedTotal = totalAmount === undefined ? null : parseDecimal(totalAmount);
  const totalProvided = totalAmount !== undefined && totalAmount.trim() !== '';

  if (totalProvided && parsedTotal === null) {
    errors.push({ key: null, message: 'Total amount must be a number.' });
  } else if (parsedTotal !== null && parsedTotal <= 0) {
    errors.push({ key: null, message: 'Total amount must be greater than zero.' });
  }

  if (mode === 'percentage' && !totalProvided) {
    errors.push({
      key: null,
      message: 'Enter the bill total so percentage shares can be converted to amounts.',
    });
  }

  const unit = mode === 'percentage' ? '%' : 'amount';
  const values: number[] = [];

  for (const participant of participants) {
    const value = parseDecimal(participant.share);

    if (value === null) {
      errors.push({
        key: participant.key,
        message:
          mode === 'percentage'
            ? 'Enter a percentage share.'
            : 'Enter an amount for this participant.',
      });
      values.push(0);
      continue;
    }

    if (value <= 0) {
      errors.push({
        key: participant.key,
        message: `Share must be greater than zero (${unit}).`,
      });
      values.push(0);
      continue;
    }

    if (mode === 'percentage' && value > PERCENTAGE_TOTAL) {
      errors.push({ key: participant.key, message: 'Share cannot exceed 100%.' });
      values.push(0);
      continue;
    }

    values.push(value);
  }

  const sum = roundToPrecision(values.reduce((acc, value) => acc + value, 0));

  // Only run the sum check once every individual value parsed — otherwise the
  // user gets a confusing "doesn't add up" on top of "this field is empty".
  const allSharesValid = !errors.some((error) => error.key !== null);

  if (allSharesValid) {
    if (mode === 'percentage') {
      if (!amountsEqual(sum, PERCENTAGE_TOTAL)) {
        const delta = roundToPrecision(PERCENTAGE_TOTAL - sum);
        errors.push({
          key: null,
          message:
            delta > 0
              ? `Shares total ${formatAmount(sum)}% — ${formatAmount(delta)}% short of 100%.`
              : `Shares total ${formatAmount(sum)}% — ${formatAmount(-delta)}% over 100%.`,
        });
      }
    } else if (parsedTotal !== null && parsedTotal > 0) {
      if (!amountsEqual(sum, parsedTotal)) {
        const delta = roundToPrecision(parsedTotal - sum);
        errors.push({
          key: null,
          message:
            delta > 0
              ? `Participant amounts total ${formatAmount(sum)} — ${formatAmount(delta)} short of the ${formatAmount(parsedTotal)} total.`
              : `Participant amounts total ${formatAmount(sum)} — ${formatAmount(-delta)} over the ${formatAmount(parsedTotal)} total.`,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, sum, amounts: {} };
  }

  const resolved =
    mode === 'percentage' && parsedTotal !== null ? allocate(parsedTotal, values) : values;

  const amounts: Record<string, string> = {};
  participants.forEach((participant, index) => {
    amounts[participant.key] = formatAmount(resolved[index]);
  });

  return { valid: true, errors: [], sum, amounts };
}

/** Index errors by row key for rendering inline messages. */
export function errorsByKey(errors: ShareValidationError[]): Record<string, string> {
  const byKey: Record<string, string> = {};
  for (const error of errors) {
    if (error.key !== null && !(error.key in byKey)) {
      byKey[error.key] = error.message;
    }
  }
  return byKey;
}

/** The first form-level (non-row) error, if any. */
export function formError(errors: ShareValidationError[]): string | null {
  return errors.find((error) => error.key === null)?.message ?? null;
}
