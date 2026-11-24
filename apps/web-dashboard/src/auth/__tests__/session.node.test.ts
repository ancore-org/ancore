// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { readDashboardSession } from '../session';

describe('readDashboardSession without a browser', () => {
  it('returns null when window is unavailable', () => {
    expect(typeof window).toBe('undefined');
    expect(readDashboardSession()).toBeNull();
  });
});
