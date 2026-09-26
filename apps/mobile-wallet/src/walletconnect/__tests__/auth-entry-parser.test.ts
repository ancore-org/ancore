import { parseAuthEntryXdr } from '../auth-entry-parser';

/**
 * Fixtures below are real base64-encoded SorobanAuthorizationEntry XDR, generated
 * with @stellar/stellar-sdk (xdr.SorobanAuthorizationEntry.toXDR('base64')) from
 * hand-built invocation trees - not synthetic ASCII byte patterns.
 */
const CONTRACT_1 = 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526';
const CONTRACT_2 = 'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ';
const CONTRACT_4 = 'CACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAINCW';
const CONTRACT_5 = 'CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U';
const CONTRACT_6 = 'CADAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMSST';

const SINGLE_NO_ARGS =
  'AAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAAAIdHJhbnNmZXIAAAAAAAAAAA==';

const SINGLE_WITH_ARGS =
  'AAAAAAAAAAAAAAABAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAIdHJhbnNmZXIAAAACAAAAEgAAAAAAAAAALjKJCCWJf+DL/62n31gucq08CasEV85izTeqRvZxUWQAAAAKAAAAAAAAAAAAAAAAAAAD6AAAAAA=';

const NESTED =
  'AAAAAAAAAAAAAAABBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUAAAAFcm91dGUAAAAAAAAAAAAAAgAAAAAAAAABBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAAAEc3dhcAAAAAAAAAABAAAAAAAAAAEDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwAAAAdhcHByb3ZlAAAAAAEAAAAKAAAAAAAAAAAAAAAAAAAB9AAAAAAAAAAAAAAAAQYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGAAAACHRyYW5zZmVyAAAAAAAAAAA=';

describe('parseAuthEntryXdr', () => {
  it('structurally decodes a single invocation with no args', () => {
    const parsed = parseAuthEntryXdr(SINGLE_NO_ARGS);

    expect(parsed.contractId).toBe(CONTRACT_1);
    expect(parsed.functionName).toBe('transfer');
    expect(parsed.subInvocationCount).toBe(0);
    expect(parsed.invocation.args).toEqual([]);
    expect(parsed.invocation.subInvocations).toEqual([]);
  });

  it('structurally decodes a single invocation with args', () => {
    const parsed = parseAuthEntryXdr(SINGLE_WITH_ARGS);

    expect(parsed.contractId).toBe(CONTRACT_2);
    expect(parsed.functionName).toBe('transfer');
    expect(parsed.subInvocationCount).toBe(0);
    expect(parsed.invocation.args).toHaveLength(2);
    expect(parsed.invocation.args[1]).toBe('1000');
  });

  it('correctly identifies and counts nested sub-invocations (not heuristically)', () => {
    const parsed = parseAuthEntryXdr(NESTED);

    expect(parsed.contractId).toBe(CONTRACT_5);
    expect(parsed.functionName).toBe('route');
    // root -> [swap -> [approve], transfer] == 3 sub-invocations total
    expect(parsed.subInvocationCount).toBe(3);
    expect(parsed.invocation.subInvocations).toHaveLength(2);

    const [swap, transfer] = parsed.invocation.subInvocations;
    expect(swap.contractId).toBe(CONTRACT_4);
    expect(swap.functionName).toBe('swap');
    expect(swap.subInvocations).toHaveLength(1);
    expect(swap.subInvocations[0].functionName).toBe('approve');

    expect(transfer.contractId).toBe(CONTRACT_6);
    expect(transfer.functionName).toBe('transfer');
    expect(transfer.subInvocations).toHaveLength(0);
  });

  it('rejects missing XDR', () => {
    expect(() => parseAuthEntryXdr('')).toThrow('Missing auth entry XDR');
  });

  it('rejects empty decoded payload', () => {
    expect(() => parseAuthEntryXdr('=')).toThrow('Auth entry XDR is empty');
  });

  it('explicitly rejects malformed (non-XDR) input rather than guessing', () => {
    const malformed = Buffer.from('this looks like text but is not valid XDR at all').toString(
      'base64'
    );

    expect(() => parseAuthEntryXdr(malformed)).toThrow(
      'Auth entry XDR could not be structurally decoded'
    );
  });

  it('explicitly rejects truncated XDR rather than guessing', () => {
    const truncated = Buffer.from(SINGLE_WITH_ARGS, 'base64').subarray(0, 10).toString('base64');

    expect(() => parseAuthEntryXdr(truncated)).toThrow(
      'Auth entry XDR could not be structurally decoded'
    );
  });
});
