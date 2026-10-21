import { describe, expect, it } from 'vitest';
import { formatRelativeExpiry } from '../time';

const NOW = 1_700_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelativeExpiry', () => {
  it('reports expired keys in red', () => {
    expect(formatRelativeExpiry(NOW - 1, NOW)).toEqual({ label: 'Expired', tone: 'red' });
    expect(formatRelativeExpiry(NOW, NOW)).toEqual({ label: 'Expired', tone: 'red' });
  });

  it('uses amber under 2 hours, in minutes', () => {
    expect(formatRelativeExpiry(NOW + 45 * MIN, NOW)).toEqual({
      label: 'Expires in 45m',
      tone: 'amber',
    });
    expect(formatRelativeExpiry(NOW + 30_000, NOW)).toEqual({
      label: 'Expires in <1m',
      tone: 'amber',
    });
    expect(formatRelativeExpiry(NOW + 2 * HOUR - 1, NOW).tone).toBe('amber');
  });

  it('uses green at 2 hours or more, in hours then days', () => {
    expect(formatRelativeExpiry(NOW + 2 * HOUR, NOW)).toEqual({
      label: 'Expires in 2h',
      tone: 'green',
    });
    expect(formatRelativeExpiry(NOW + 23 * HOUR, NOW).label).toBe('Expires in 23h');
    expect(formatRelativeExpiry(NOW + 3 * DAY, NOW)).toEqual({
      label: 'Expires in 3d',
      tone: 'green',
    });
  });

  it('switches tone and unit exactly on the thresholds', () => {
    expect(formatRelativeExpiry(NOW + 1, NOW).tone).toBe('amber');
    expect(formatRelativeExpiry(NOW + DAY - 1, NOW)).toEqual({
      label: 'Expires in 23h',
      tone: 'green',
    });
    expect(formatRelativeExpiry(NOW + DAY, NOW)).toEqual({
      label: 'Expires in 1d',
      tone: 'green',
    });
  });

  it('does not depend on the process timezone', () => {
    const original = process.env.TZ;
    try {
      for (const tz of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
        process.env.TZ = tz;
        expect(formatRelativeExpiry(NOW + 45 * MIN, NOW).label).toBe('Expires in 45m');
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
