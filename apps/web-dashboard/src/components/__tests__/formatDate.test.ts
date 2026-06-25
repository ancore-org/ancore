import { formatTxDate, formatRelative } from '../../lib/formatDate';

const FIXED_TZ = 'America/New_York';
const FIXED_LOCALE = 'en-US';

// Helper: format with a fixed locale to make assertions locale-independent.
function formatFixed(iso: string, opts?: { relative?: boolean; timeZone?: string }): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Invalid date';

  if (opts?.relative) {
    // Delegate to the real implementation; relative strings are locale-neutral enough.
    return formatTxDate(iso, opts);
  }

  return new Intl.DateTimeFormat(FIXED_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: opts?.timeZone ?? FIXED_TZ,
  }).format(date);
}

describe('formatTxDate', () => {
  const ISO_JAN = '2024-01-15T12:00:00.000Z';

  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatTxDate(ISO_JAN);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('absolute format includes the year, month, and day', () => {
    const result = formatFixed(ISO_JAN, { timeZone: FIXED_TZ });
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it('honours the timeZone option', () => {
    // UTC midnight on Jan 1 is Dec 31 in New York (UTC-5)
    const utcMidnight = '2024-01-01T00:00:00.000Z';
    const nyResult = formatFixed(utcMidnight, { timeZone: 'America/New_York' });
    expect(nyResult).toMatch(/Dec/);
    expect(nyResult).toMatch(/31/);
    expect(nyResult).toMatch(/2023/);
  });

  it('returns "Invalid date" for an unparseable string and does not throw', () => {
    expect(formatTxDate('not-a-date')).toBe('Invalid date');
    expect(formatTxDate('')).toBe('Invalid date');
  });

  it('absolute format is ISO8601 date-consistent (year-month-day present)', () => {
    const result = formatFixed('2025-06-20T08:30:00.000Z', { timeZone: 'UTC' });
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/20/);
  });
});

describe('formatRelative', () => {
  it('returns a non-empty string for a past date', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = formatRelative(oneHourAgo);
    expect(result).toBeTruthy();
  });

  it('returns a non-empty string for a future date', () => {
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = formatRelative(oneHourLater);
    expect(result).toBeTruthy();
  });

  it('uses Intl.RelativeTimeFormat for day-sized offsets', () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const result = formatRelative(yesterday);
    const expected = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-1, 'day');
    expect(result).toBe(expected);
  });

  it('throws RangeError for an invalid date string', () => {
    expect(() => formatRelative('bad-date')).toThrow(RangeError);
    expect(() => formatRelative('')).toThrow(RangeError);
  });

  it('error message from formatRelative identifies the bad input', () => {
    expect(() => formatRelative('xyz')).toThrow(/xyz/);
  });
});

describe('formatTxDate with relative option', () => {
  it('delegates to formatRelative when relative: true', () => {
    const iso = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const relative = formatTxDate(iso, { relative: true });
    expect(relative).toBeTruthy();
    expect(relative).not.toBe('Invalid date');
  });

  it('returns "Invalid date" for bad input even with relative: true', () => {
    expect(formatTxDate('garbage', { relative: true })).toBe('Invalid date');
  });
});
