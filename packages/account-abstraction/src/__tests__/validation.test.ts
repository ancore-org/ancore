import { validateSessionKeyPolicy, type SessionKeyPolicy } from '../validation';

const NOW_MS = 1_800_000_000_000;
const NOW_S = NOW_MS / 1000;

describe('validateSessionKeyPolicy (#1539)', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const valid = (overrides: Partial<SessionKeyPolicy> = {}): SessionKeyPolicy => ({
    expiresAt: NOW_S + 3600,
    permissions: [0, 1],
    ...overrides,
  });

  const codes = (policy: SessionKeyPolicy) =>
    validateSessionKeyPolicy(policy).errors.map((e) => e.code);

  it('accepts a minimal valid policy', () => {
    expect(validateSessionKeyPolicy(valid())).toEqual({ valid: true, errors: [] });
  });

  it('accepts a full valid spend policy', () => {
    const result = validateSessionKeyPolicy(
      valid({ maxAmountPerCall: 100n, cumulativeLimit: 1000n, spendWindowSeconds: 86_400 })
    );
    expect(result.valid).toBe(true);
  });

  it('rejects an expired timestamp', () => {
    expect(codes(valid({ expiresAt: NOW_S - 1 }))).toEqual(['EXPIRED']);
  });

  it('rejects expiresAt equal to now', () => {
    expect(codes(valid({ expiresAt: NOW_S }))).toEqual(['EXPIRED']);
  });

  it('rejects negative, non-integer and non-finite expiresAt', () => {
    expect(codes(valid({ expiresAt: -5 }))).toContain('INVALID_EXPIRES_AT');
    expect(codes(valid({ expiresAt: NOW_S + 0.5 }))).toContain('INVALID_EXPIRES_AT');
    expect(codes(valid({ expiresAt: Number.NaN }))).toContain('INVALID_EXPIRES_AT');
    expect(codes(valid({ expiresAt: Infinity }))).toContain('INVALID_EXPIRES_AT');
  });

  it('rejects unknown permission bits', () => {
    expect(codes(valid({ permissions: [0, 7] }))).toEqual(['INVALID_PERMISSION']);
  });

  it('rejects duplicate permission bits', () => {
    expect(codes(valid({ permissions: [1, 1] }))).toEqual(['DUPLICATE_PERMISSION']);
  });

  it('rejects non-positive maxAmountPerCall', () => {
    expect(codes(valid({ maxAmountPerCall: 0n }))).toEqual(['INVALID_AMOUNT']);
    expect(codes(valid({ maxAmountPerCall: -1n }))).toEqual(['INVALID_AMOUNT']);
  });

  it('rejects malformed amounts', () => {
    expect(codes(valid({ maxAmountPerCall: 'abc' }))).toEqual(['INVALID_AMOUNT']);
    expect(codes(valid({ maxAmountPerCall: 1.5 }))).toEqual(['INVALID_AMOUNT']);
    expect(codes(valid({ maxAmountPerCall: Number.NaN }))).toEqual(['INVALID_AMOUNT']);
  });

  it('accepts amounts given as numeric strings and integers', () => {
    expect(validateSessionKeyPolicy(valid({ maxAmountPerCall: '100' })).valid).toBe(true);
    expect(validateSessionKeyPolicy(valid({ maxAmountPerCall: 100 })).valid).toBe(true);
  });

  it('rejects non-positive cumulativeLimit', () => {
    expect(codes(valid({ cumulativeLimit: 0n, spendWindowSeconds: 60 }))).toEqual([
      'INVALID_AMOUNT',
    ]);
  });

  it('rejects a cumulative limit without a positive spend window', () => {
    expect(codes(valid({ cumulativeLimit: 100n }))).toEqual(['INVALID_SPEND_WINDOW']);
    expect(codes(valid({ cumulativeLimit: 100n, spendWindowSeconds: 0 }))).toEqual([
      'INVALID_SPEND_WINDOW',
    ]);
  });

  it('rejects a spend window without a cumulative limit', () => {
    expect(codes(valid({ spendWindowSeconds: 60 }))).toEqual(['INVALID_SPEND_WINDOW']);
  });

  it('rejects negative or fractional spend windows', () => {
    expect(codes(valid({ cumulativeLimit: 100n, spendWindowSeconds: -1 }))).toContain(
      'INVALID_SPEND_WINDOW'
    );
    expect(codes(valid({ cumulativeLimit: 100n, spendWindowSeconds: 1.5 }))).toContain(
      'INVALID_SPEND_WINDOW'
    );
  });

  it('collects every failure at once', () => {
    expect(
      codes({
        expiresAt: NOW_S - 10,
        permissions: [9],
        maxAmountPerCall: -1n,
        spendWindowSeconds: 10,
      })
    ).toEqual(['EXPIRED', 'INVALID_PERMISSION', 'INVALID_AMOUNT', 'INVALID_SPEND_WINDOW']);
  });

  it('validates allowedContracts array format', () => {
    expect(
      codes(
        valid({
          allowedContracts: ['CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
        })
      )
    ).toEqual([]);

    expect(
      codes(
        valid({
          allowedContracts: ['invalid-contract-id'],
        })
      )
    ).toEqual(['INVALID_ALLOWED_CONTRACTS']);
  });
});
