import {
  parseAllowlist,
  serializeAllowlist,
  isOriginAllowed,
  addOriginToAllowlist,
  removeOriginFromAllowlist,
} from '../allowlist';
import type { AllowlistEntry } from '../allowlist';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTRY_TESTNET: AllowlistEntry = {
  origin: 'https://app.example.com',
  grantedAt: 1_700_000_000_000,
  network: 'testnet',
  smartAccountId: 'CABC1234',
};

const ENTRY_MAINNET: AllowlistEntry = {
  origin: 'https://app.example.com',
  grantedAt: 1_700_000_001_000,
  network: 'mainnet',
  smartAccountId: 'CABC1234',
};

const ENTRY_OTHER_ORIGIN: AllowlistEntry = {
  origin: 'https://other.example.com',
  grantedAt: 1_700_000_002_000,
  network: 'testnet',
  smartAccountId: 'CABC1234',
};

// ---------------------------------------------------------------------------
// parseAllowlist
// ---------------------------------------------------------------------------

describe('parseAllowlist', () => {
  it('returns empty array for null', () => {
    expect(parseAllowlist(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseAllowlist('')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseAllowlist('not-json')).toEqual([]);
  });

  it('returns empty array when JSON is not an array', () => {
    expect(parseAllowlist(JSON.stringify({ origin: 'https://x.com' }))).toEqual([]);
  });

  it('filters out malformed entries', () => {
    const raw = JSON.stringify([
      ENTRY_TESTNET,
      { origin: 'https://bad.com' }, // missing required fields
      null,
    ]);
    const result = parseAllowlist(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(ENTRY_TESTNET);
  });

  it('parses a valid serialized entry', () => {
    const raw = serializeAllowlist([ENTRY_TESTNET]);
    expect(parseAllowlist(raw)).toEqual([ENTRY_TESTNET]);
  });
});

// ---------------------------------------------------------------------------
// serializeAllowlist + round-trip
// ---------------------------------------------------------------------------

describe('serializeAllowlist', () => {
  it('serializes an empty array', () => {
    expect(serializeAllowlist([])).toBe('[]');
  });

  it('serialize → parse round-trip preserves entries', () => {
    const entries = [ENTRY_TESTNET, ENTRY_MAINNET, ENTRY_OTHER_ORIGIN];
    const result = parseAllowlist(serializeAllowlist(entries));
    expect(result).toEqual(entries);
  });
});

// ---------------------------------------------------------------------------
// isOriginAllowed
// ---------------------------------------------------------------------------

describe('isOriginAllowed', () => {
  const entries = [ENTRY_TESTNET, ENTRY_OTHER_ORIGIN];

  it('returns true for a granted origin on the correct network', () => {
    expect(isOriginAllowed(entries, 'https://app.example.com', 'testnet')).toBe(true);
  });

  it('returns false for a granted origin on a different network', () => {
    expect(isOriginAllowed(entries, 'https://app.example.com', 'mainnet')).toBe(false);
  });

  it('returns false for an ungranted origin', () => {
    expect(isOriginAllowed(entries, 'https://never-granted.com', 'testnet')).toBe(false);
  });

  it('returns false when entry list is empty', () => {
    expect(isOriginAllowed([], 'https://app.example.com', 'testnet')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addOriginToAllowlist
// ---------------------------------------------------------------------------

describe('addOriginToAllowlist', () => {
  it('adds a new entry', () => {
    const result = addOriginToAllowlist([], ENTRY_TESTNET);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(ENTRY_TESTNET);
  });

  it('replaces an existing entry for the same (origin, network, smartAccountId)', () => {
    const updated: AllowlistEntry = { ...ENTRY_TESTNET, grantedAt: 9_999_999_999_000 };
    const result = addOriginToAllowlist([ENTRY_TESTNET], updated);
    expect(result).toHaveLength(1);
    expect(result[0].grantedAt).toBe(9_999_999_999_000);
  });

  it('does not remove entries for different networks', () => {
    const result = addOriginToAllowlist([ENTRY_TESTNET], ENTRY_MAINNET);
    // ENTRY_MAINNET has same origin + smartAccountId but different network — kept separately
    expect(result).toHaveLength(2);
  });

  it('does not mutate the original array', () => {
    const original = [ENTRY_TESTNET];
    addOriginToAllowlist(original, ENTRY_OTHER_ORIGIN);
    expect(original).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// removeOriginFromAllowlist
// ---------------------------------------------------------------------------

describe('removeOriginFromAllowlist', () => {
  it('removes all entries matching the origin', () => {
    // ENTRY_TESTNET and ENTRY_MAINNET share the same origin across two networks
    const entries = [ENTRY_TESTNET, ENTRY_MAINNET, ENTRY_OTHER_ORIGIN];
    const result = removeOriginFromAllowlist(entries, 'https://app.example.com');
    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe('https://other.example.com');
  });

  it('returns unchanged array when origin is not present', () => {
    const entries = [ENTRY_TESTNET];
    const result = removeOriginFromAllowlist(entries, 'https://never-here.com');
    expect(result).toEqual(entries);
  });

  it('returns empty array when removing the only entry', () => {
    const result = removeOriginFromAllowlist([ENTRY_TESTNET], ENTRY_TESTNET.origin);
    expect(result).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const original = [ENTRY_TESTNET, ENTRY_OTHER_ORIGIN];
    removeOriginFromAllowlist(original, ENTRY_TESTNET.origin);
    expect(original).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Revoke + re-grant cycle (integration)
// ---------------------------------------------------------------------------

describe('grant → check → revoke → check cycle', () => {
  it('correctly tracks grant and revoke', () => {
    let entries: AllowlistEntry[] = [];

    // Grant
    entries = addOriginToAllowlist(entries, ENTRY_TESTNET);
    expect(isOriginAllowed(entries, ENTRY_TESTNET.origin, 'testnet')).toBe(true);

    // Revoke
    entries = removeOriginFromAllowlist(entries, ENTRY_TESTNET.origin);
    expect(isOriginAllowed(entries, ENTRY_TESTNET.origin, 'testnet')).toBe(false);
  });
});
