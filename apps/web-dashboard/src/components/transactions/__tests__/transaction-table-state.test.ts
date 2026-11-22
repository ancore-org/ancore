import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSACTION_TABLE_STATE,
  buildTransactionTableSearchParams,
  parseTransactionTableState,
} from '../transaction-table-state';

describe('parseTransactionTableState', () => {
  it('returns the defaults for empty params', () => {
    expect(parseTransactionTableState(new URLSearchParams())).toEqual(
      DEFAULT_TRANSACTION_TABLE_STATE,
    );
  });

  it('returns the defaults for an empty string', () => {
    expect(parseTransactionTableState(new URLSearchParams(''))).toEqual(
      DEFAULT_TRANSACTION_TABLE_STATE,
    );
  });

  it('parses a valid date value', () => {
    const state = parseTransactionTableState(new URLSearchParams('date=7d'));
    expect(state.date).toBe('7d');
  });

  it('parses a valid type value', () => {
    const state = parseTransactionTableState(new URLSearchParams('type=payment'));
    expect(state.type).toBe('payment');
  });

  it('parses a valid status value', () => {
    const state = parseTransactionTableState(new URLSearchParams('status=completed'));
    expect(state.status).toBe('completed');
  });

  it('parses a valid sort value', () => {
    const state = parseTransactionTableState(new URLSearchParams('sort=amount'));
    expect(state.sort).toBe('amount');
  });

  it('parses a valid direction value', () => {
    const state = parseTransactionTableState(new URLSearchParams('direction=asc'));
    expect(state.direction).toBe('asc');
  });

  it('parses multiple valid values together', () => {
    const state = parseTransactionTableState(
      new URLSearchParams('date=7d&type=payment&status=completed&sort=amount&direction=asc'),
    );
    expect(state).toEqual({
      date: '7d',
      type: 'payment',
      status: 'completed',
      sort: 'amount',
      direction: 'asc',
    });
  });

  it('falls back to the default date for an invalid value while preserving other fields', () => {
    const state = parseTransactionTableState(
      new URLSearchParams('date=not-a-date&type=payment'),
    );
    expect(state.date).toBe(DEFAULT_TRANSACTION_TABLE_STATE.date);
    expect(state.type).toBe('payment');
  });

  it('falls back to the default type for an invalid value while preserving other fields', () => {
    const state = parseTransactionTableState(
      new URLSearchParams('date=7d&type=not-a-type'),
    );
    expect(state.type).toBe(DEFAULT_TRANSACTION_TABLE_STATE.type);
    expect(state.date).toBe('7d');
  });

  it('falls back to the default status for an invalid value while preserving other fields', () => {
    const state = parseTransactionTableState(
      new URLSearchParams('status=not-a-status&sort=amount'),
    );
    expect(state.status).toBe(DEFAULT_TRANSACTION_TABLE_STATE.status);
    expect(state.sort).toBe('amount');
  });

  it('falls back to the default sort for an invalid value while preserving other fields', () => {
    const state = parseTransactionTableState(
      new URLSearchParams('sort=not-a-sort&direction=asc'),
    );
    expect(state.sort).toBe(DEFAULT_TRANSACTION_TABLE_STATE.sort);
    expect(state.direction).toBe('asc');
  });

  it('falls back to the default direction for an invalid value while preserving other fields', () => {
    const state = parseTransactionTableState(
      new URLSearchParams('direction=sideways&sort=amount'),
    );
    expect(state.direction).toBe(DEFAULT_TRANSACTION_TABLE_STATE.direction);
    expect(state.sort).toBe('amount');
  });

  it('ignores unknown params', () => {
    const state = parseTransactionTableState(
      new URLSearchParams('foo=bar&baz=qux&date=7d'),
    );
    expect(state).toEqual({
      ...DEFAULT_TRANSACTION_TABLE_STATE,
      date: '7d',
    });
  });

  it('ignores unknown params when no valid params are present', () => {
    const state = parseTransactionTableState(new URLSearchParams('foo=bar&baz=qux'));
    expect(state).toEqual(DEFAULT_TRANSACTION_TABLE_STATE);
  });
});

describe('buildTransactionTableSearchParams', () => {
  it('omits default values', () => {
    const params = buildTransactionTableSearchParams(DEFAULT_TRANSACTION_TABLE_STATE);
    expect(params.toString()).toBe('');
  });

  it('includes non-default values', () => {
    const params = buildTransactionTableSearchParams({
      ...DEFAULT_TRANSACTION_TABLE_STATE,
      date: '7d',
      type: 'payment',
    });
    expect(params.get('date')).toBe('7d');
    expect(params.get('type')).toBe('payment');
  });

  it('omits fields that equal their default while including changed fields', () => {
    const params = buildTransactionTableSearchParams({
      ...DEFAULT_TRANSACTION_TABLE_STATE,
      status: 'completed',
    });
    expect(params.has('status')).toBe(true);
    expect(params.get('status')).toBe('completed');
    expect(params.has('date')).toBe(false);
    expect(params.has('type')).toBe(false);
    expect(params.has('sort')).toBe(false);
    expect(params.has('direction')).toBe(false);
  });

  it('round-trips through parseTransactionTableState', () => {
    const state = {
      date: '7d' as const,
      type: 'payment' as const,
      status: 'completed' as const,
      sort: 'amount' as const,
      direction: 'asc' as const,
    };
    const params = buildTransactionTableSearchParams(state);
    expect(parseTransactionTableState(params)).toEqual(state);
  });

  it('round-trips the default state', () => {
    const params = buildTransactionTableSearchParams(DEFAULT_TRANSACTION_TABLE_STATE);
    expect(parseTransactionTableState(params)).toEqual(DEFAULT_TRANSACTION_TABLE_STATE);
  });

  it('round-trips a partially customized state', () => {
    const state = {
      ...DEFAULT_TRANSACTION_TABLE_STATE,
      date: '7d' as const,
    };
    const params = buildTransactionTableSearchParams(state);
    expect(parseTransactionTableState(params)).toEqual(state);
  });
});