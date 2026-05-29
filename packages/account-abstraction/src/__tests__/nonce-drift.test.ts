/**
 * Unit tests for detectNonceDrift and isValidNonce.
 *
 * All tests are deterministic and require no network/DB access.
 */

import {
  detectNonceDrift,
  isValidNonce,
  NonceDriftKind,
  NONCE_DRIFT_RETRY_GUIDANCE,
} from '../nonce-drift';

// ── isValidNonce ──────────────────────────────────────────────────────────────

describe('isValidNonce', () => {
  it('accepts zero', () => expect(isValidNonce(0)).toBe(true));
  it('accepts positive integers', () => expect(isValidNonce(42)).toBe(true));
  it('accepts large safe integer', () => expect(isValidNonce(Number.MAX_SAFE_INTEGER)).toBe(true));

  it('rejects negative integers', () => expect(isValidNonce(-1)).toBe(false));
  it('rejects floats', () => expect(isValidNonce(1.5)).toBe(false));
  it('rejects NaN', () => expect(isValidNonce(NaN)).toBe(false));
  it('rejects Infinity', () => expect(isValidNonce(Infinity)).toBe(false));
  it('rejects -Infinity', () => expect(isValidNonce(-Infinity)).toBe(false));
});

// ── detectNonceDrift — ExactMatch ─────────────────────────────────────────────

describe('detectNonceDrift — ExactMatch', () => {
  it('classifies equal nonces as ExactMatch', () => {
    const result = detectNonceDrift(5, 5);
    expect(result.kind).toBe(NonceDriftKind.ExactMatch);
    expect(result.delta).toBe(0);
  });

  it('sets the correct retry guidance for ExactMatch', () => {
    const result = detectNonceDrift(0, 0);
    expect(result.retryGuidance).toBe(NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.ExactMatch]);
  });

  it('works for zero nonces', () => {
    expect(detectNonceDrift(0, 0).kind).toBe(NonceDriftKind.ExactMatch);
  });
});

// ── detectNonceDrift — ObservedAhead ─────────────────────────────────────────

describe('detectNonceDrift — ObservedAhead', () => {
  it('classifies observed > expected as ObservedAhead', () => {
    const result = detectNonceDrift(3, 5);
    expect(result.kind).toBe(NonceDriftKind.ObservedAhead);
    expect(result.delta).toBe(2);
  });

  it('ObservedAhead delta is positive', () => {
    const { delta } = detectNonceDrift(0, 1);
    expect(delta).toBeGreaterThan(0);
  });

  it('sets the correct retry guidance for ObservedAhead', () => {
    const result = detectNonceDrift(1, 3);
    expect(result.retryGuidance).toBe(NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.ObservedAhead]);
  });

  it('includes both nonces and delta in message', () => {
    const { message } = detectNonceDrift(4, 6);
    expect(message).toContain('6');
    expect(message).toContain('4');
  });
});

// ── detectNonceDrift — ObservedBehind ────────────────────────────────────────

describe('detectNonceDrift — ObservedBehind', () => {
  it('classifies observed < expected as ObservedBehind', () => {
    const result = detectNonceDrift(5, 3);
    expect(result.kind).toBe(NonceDriftKind.ObservedBehind);
    expect(result.delta).toBe(-2);
  });

  it('ObservedBehind delta is negative', () => {
    const { delta } = detectNonceDrift(5, 4);
    expect(delta).toBeLessThan(0);
  });

  it('sets the correct retry guidance for ObservedBehind', () => {
    const result = detectNonceDrift(10, 8);
    expect(result.retryGuidance).toBe(NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.ObservedBehind]);
  });
});

// ── detectNonceDrift — ExcessiveDrift ────────────────────────────────────────

describe('detectNonceDrift — ExcessiveDrift', () => {
  it('classifies delta > threshold as ExcessiveDrift (ahead)', () => {
    const result = detectNonceDrift(0, 11); // default threshold = 10
    expect(result.kind).toBe(NonceDriftKind.ExcessiveDrift);
    expect(result.delta).toBe(11);
  });

  it('classifies delta > threshold as ExcessiveDrift (behind)', () => {
    const result = detectNonceDrift(11, 0);
    expect(result.kind).toBe(NonceDriftKind.ExcessiveDrift);
    expect(result.delta).toBe(-11);
  });

  it('delta == threshold is NOT excessive (ObservedAhead)', () => {
    const result = detectNonceDrift(0, 10); // exactly at threshold
    expect(result.kind).toBe(NonceDriftKind.ObservedAhead);
  });

  it('respects a custom excessiveDriftThreshold', () => {
    const result = detectNonceDrift(0, 3, { excessiveDriftThreshold: 2 });
    expect(result.kind).toBe(NonceDriftKind.ExcessiveDrift);
  });

  it('custom threshold of 1: delta of 2 is excessive', () => {
    expect(detectNonceDrift(0, 2, { excessiveDriftThreshold: 1 }).kind).toBe(
      NonceDriftKind.ExcessiveDrift
    );
  });

  it('sets the correct retry guidance for ExcessiveDrift', () => {
    const result = detectNonceDrift(0, 50);
    expect(result.retryGuidance).toBe(NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.ExcessiveDrift]);
  });

  it('message includes threshold value', () => {
    const result = detectNonceDrift(0, 11);
    expect(result.message).toContain('threshold=10');
  });
});

// ── detectNonceDrift — InvalidNonceState ─────────────────────────────────────

describe('detectNonceDrift — InvalidNonceState', () => {
  it('classifies negative expected as InvalidNonceState', () => {
    expect(detectNonceDrift(-1, 5).kind).toBe(NonceDriftKind.InvalidNonceState);
  });

  it('classifies negative observed as InvalidNonceState', () => {
    expect(detectNonceDrift(5, -1).kind).toBe(NonceDriftKind.InvalidNonceState);
  });

  it('classifies NaN expected as InvalidNonceState', () => {
    expect(detectNonceDrift(NaN, 5).kind).toBe(NonceDriftKind.InvalidNonceState);
  });

  it('classifies NaN observed as InvalidNonceState', () => {
    expect(detectNonceDrift(5, NaN).kind).toBe(NonceDriftKind.InvalidNonceState);
  });

  it('classifies Infinity expected as InvalidNonceState', () => {
    expect(detectNonceDrift(Infinity, 5).kind).toBe(NonceDriftKind.InvalidNonceState);
  });

  it('classifies float expected as InvalidNonceState', () => {
    expect(detectNonceDrift(1.5, 2).kind).toBe(NonceDriftKind.InvalidNonceState);
  });

  it('delta is NaN for invalid inputs', () => {
    expect(detectNonceDrift(-1, 5).delta).toBeNaN();
  });

  it('sets the correct retry guidance for InvalidNonceState', () => {
    const result = detectNonceDrift(-1, 5);
    expect(result.retryGuidance).toBe(NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.InvalidNonceState]);
  });
});

// ── Composability / determinism ───────────────────────────────────────────────

describe('detectNonceDrift — determinism and composability', () => {
  it('produces identical results on repeated calls with same inputs', () => {
    const a = detectNonceDrift(7, 9);
    const b = detectNonceDrift(7, 9);
    expect(a).toEqual(b);
  });

  it('result can be used as a discriminated union on kind', () => {
    const result = detectNonceDrift(5, 5);
    if (result.kind === NonceDriftKind.ExactMatch) {
      expect(result.delta).toBe(0);
    } else {
      fail('Expected ExactMatch');
    }
  });

  it('all NonceDriftKind values have retry guidance entries', () => {
    const kinds = Object.values(NonceDriftKind);
    for (const kind of kinds) {
      expect(NONCE_DRIFT_RETRY_GUIDANCE[kind]).toBeTruthy();
    }
  });
});
