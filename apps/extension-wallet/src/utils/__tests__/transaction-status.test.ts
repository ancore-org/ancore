import { describe, it, expect } from 'vitest';
import {
  mapRpcStatus,
  isKnownRpcStatus,
  isTerminalStatus,
  type AnyRpcStatus,
} from '../transaction-status';

const EXPECTED_MAP: Record<AnyRpcStatus, string> = {
  success: 'confirmed',
  failure: 'failed',
  pending: 'pending',
  not_found: 'pending',
  error: 'failed',
  timeout: 'failed',
  idle: 'pending',
  confirmed: 'confirmed',
  failed: 'failed',
  unreachable: 'pending',
};

describe('mapRpcStatus', () => {
  it.each(Object.entries(EXPECTED_MAP))('maps %s → %s', (raw, expected) => {
    expect(mapRpcStatus(raw)).toBe(expected);
  });

  it('is case-insensitive', () => {
    expect(mapRpcStatus('SUCCESS')).toBe('confirmed');
    expect(mapRpcStatus('Failure')).toBe('failed');
    expect(mapRpcStatus('Not_Found')).toBe('pending');
  });

  it('falls back to pending for unknown strings', () => {
    expect(mapRpcStatus('UNKNOWN')).toBe('pending');
    expect(mapRpcStatus('')).toBe('pending');
    expect(mapRpcStatus('  success  ')).toBe('pending');
  });

  it('does not treat inherited object keys as statuses', () => {
    expect(mapRpcStatus('constructor')).toBe('pending');
    expect(mapRpcStatus('__proto__')).toBe('pending');
    expect(mapRpcStatus('toString')).toBe('pending');
    expect(mapRpcStatus('hasOwnProperty')).toBe('pending');
  });
});

describe('isKnownRpcStatus', () => {
  it.each(Object.keys(EXPECTED_MAP))('recognises %s', (raw) => {
    expect(isKnownRpcStatus(raw)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isKnownRpcStatus('SUCCESS')).toBe(true);
    expect(isKnownRpcStatus('Confirmed')).toBe(true);
  });

  it('rejects unknown strings', () => {
    expect(isKnownRpcStatus('UNKNOWN')).toBe(false);
    expect(isKnownRpcStatus('')).toBe(false);
  });

  it('rejects inherited object keys', () => {
    expect(isKnownRpcStatus('constructor')).toBe(false);
    expect(isKnownRpcStatus('__proto__')).toBe(false);
    expect(isKnownRpcStatus('toString')).toBe(false);
    expect(isKnownRpcStatus('hasOwnProperty')).toBe(false);
  });
});

describe('isTerminalStatus', () => {
  it('treats confirmed, failed and cancelled as terminal', () => {
    expect(isTerminalStatus('confirmed')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
  });

  it('treats pending as non-terminal', () => {
    expect(isTerminalStatus('pending')).toBe(false);
  });
});
