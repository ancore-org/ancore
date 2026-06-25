const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

/**
 * Format an ISO-8601 date string as a relative human-readable string.
 * Uses `Intl.RelativeTimeFormat` with the browser's locale.
 * Throws `RangeError` if `iso` is not a valid date string.
 */
export function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    throw new RangeError(`formatRelative: invalid date string "${iso}"`);
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  const { unit, ms } = UNITS.find((u) => absMs >= u.ms) ?? UNITS[UNITS.length - 1];
  const value = Math.round(diffMs / ms);

  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(value, unit);
}

/**
 * Format an ISO-8601 date string for display in a transaction row.
 *
 * - Default: absolute format consistent with ISO 8601 locale representation.
 * - `opts.relative`: render as a relative string via `Intl.RelativeTimeFormat`.
 * - `opts.timeZone`: IANA timezone identifier (e.g. `"America/New_York"`).
 *
 * Returns the string `"Invalid date"` for unparseable input (never throws).
 */
export function formatTxDate(
  iso: string,
  opts?: { relative?: boolean; timeZone?: string }
): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  if (opts?.relative) {
    return formatRelative(iso);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: opts?.timeZone,
  }).format(date);
}
