import {
  normalizeError,
  AncoreSdkError,
  SimulationFailedError,
  SimulationExpiredError,
  BuilderValidationError,
  SessionKeyManagementError,
  SessionKeyExecutionError,
  SessionKeyExecutionValidationError,
  PaymentRequestValidationError,
  InvalidAmountError,
  TransactionSubmissionError,
} from '../errors';

// ---------------------------------------------------------------------------
// Error class constructors
// ---------------------------------------------------------------------------

describe('error classes', () => {
  it('AncoreSdkError carries code and name', () => {
    const err = new AncoreSdkError('TEST_CODE', 'test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.message).toBe('test message');
    expect(err.name).toBe('AncoreSdkError');
    expect(err).toBeInstanceOf(AncoreSdkError);
  });

  it('SimulationFailedError carries diagnosticMessage', () => {
    const err = new SimulationFailedError('contract revert: nonce mismatch');
    expect(err.code).toBe('SIMULATION_FAILED');
    expect(err.diagnosticMessage).toBe('contract revert: nonce mismatch');
    expect(err.name).toBe('SimulationFailedError');
    expect(err).toBeInstanceOf(AncoreSdkError);
  });

  it('SimulationExpiredError has correct code and name', () => {
    const err = new SimulationExpiredError();
    expect(err.code).toBe('SIMULATION_EXPIRED');
    expect(err.name).toBe('SimulationExpiredError');
    expect(err).toBeInstanceOf(AncoreSdkError);
  });

  it('BuilderValidationError has correct code', () => {
    const err = new BuilderValidationError('no operations added');
    expect(err.code).toBe('BUILDER_VALIDATION');
    expect(err.name).toBe('BuilderValidationError');
  });

  it('SessionKeyManagementError accepts custom code and cause', () => {
    const cause = new Error('underlying');
    const err = new SessionKeyManagementError('failed', 'CUSTOM_CODE', cause);
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('SessionKeyManagementError');
  });

  it('SessionKeyManagementError uses default code when omitted', () => {
    const err = new SessionKeyManagementError('failed');
    expect(err.code).toBe('SESSION_KEY_MANAGEMENT_FAILED');
  });

  it('TransactionSubmissionError carries resultXdr', () => {
    const err = new TransactionSubmissionError('network error', 'AAAA==');
    expect(err.code).toBe('SUBMISSION_FAILED');
    expect(err.resultXdr).toBe('AAAA==');
    expect(err.name).toBe('TransactionSubmissionError');
  });

  it('TransactionSubmissionError works without resultXdr', () => {
    const err = new TransactionSubmissionError('network error');
    expect(err.resultXdr).toBeUndefined();
  });

  it('SessionKeyExecutionValidationError has correct code', () => {
    const err = new SessionKeyExecutionValidationError('invalid signer');
    expect(err.code).toBe('SESSION_KEY_EXECUTION_VALIDATION');
    expect(err.name).toBe('SessionKeyExecutionValidationError');
  });

  it('SessionKeyExecutionError carries code and cause', () => {
    const cause = new Error('root cause');
    const err = new SessionKeyExecutionError('SESSION_KEY_EXECUTION_FAILED', 'exec failed', cause);
    expect(err.code).toBe('SESSION_KEY_EXECUTION_FAILED');
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('SessionKeyExecutionError');
  });

  it('PaymentRequestValidationError has correct code', () => {
    const err = new PaymentRequestValidationError('missing field');
    expect(err.code).toBe('PAYMENT_REQUEST_VALIDATION');
    expect(err.name).toBe('PaymentRequestValidationError');
  });

  it('InvalidAmountError has correct code', () => {
    const err = new InvalidAmountError('amount too large');
    expect(err.code).toBe('INVALID_AMOUNT');
    expect(err.name).toBe('InvalidAmountError');
  });
});

// ---------------------------------------------------------------------------
// normalizeError — uncovered branches
// ---------------------------------------------------------------------------

describe('normalizeError — additional branches', () => {
  it('returns UNKNOWN for null', () => {
    const n = normalizeError(null);
    expect(n.code).toBe('UNKNOWN');
    expect(n.category).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for undefined', () => {
    const n = normalizeError(undefined);
    expect(n.code).toBe('UNKNOWN');
    expect(n.category).toBe('UNKNOWN');
  });

  it('handles AncoreSdkError instance', () => {
    const err = new BuilderValidationError('bad input');
    const n = normalizeError(err);
    expect(n.code).toBe('BUILDER_VALIDATION');
    expect(n.category).toBe('VALIDATION');
  });

  it('handles Error with .code property', () => {
    const err = Object.assign(new Error('oops'), { code: 'ETIMEDOUT' });
    const n = normalizeError(err);
    expect(n.code).toBe('ETIMEDOUT');
    expect(n.category).toBe('NETWORK');
  });

  it('handles Error with resultXdr (submission shape)', () => {
    const err = Object.assign(new Error('submission failed'), { resultXdr: 'AAAA==' });
    const n = normalizeError(err);
    expect(n.code).toBe('SUBMISSION_FAILED');
    expect(n.category).toBe('CONTRACT');
  });

  it('classifies network-pattern error message', () => {
    const err = new Error('Failed to fetch data from server');
    const n = normalizeError(err);
    expect(n.category).toBe('NETWORK');
  });

  it('classifies contract-pattern error message', () => {
    const err = new Error('contract execution reverted');
    const n = normalizeError(err);
    expect(n.category).toBe('CONTRACT');
  });

  it('returns UNKNOWN for plain Error with no matching pattern', () => {
    const err = new Error('something completely different');
    const n = normalizeError(err);
    expect(n.code).toBe('UNKNOWN');
    expect(n.category).toBe('UNKNOWN');
  });

  it('handles network-pattern string input', () => {
    const n = normalizeError('net::ERR_CONNECTION_REFUSED');
    expect(n.category).toBe('NETWORK');
  });

  it('handles validation-pattern string input', () => {
    const n = normalizeError('invalid address format');
    expect(n.category).toBe('VALIDATION');
  });

  it('handles contract-pattern string input', () => {
    const n = normalizeError('insufficient balance for session key');
    expect(n.category).toBe('CONTRACT');
  });

  it('handles plain unknown string input', () => {
    const n = normalizeError('something random');
    expect(n.code).toBe('UNKNOWN');
    expect(n.category).toBe('UNKNOWN');
  });

  it('handles non-Error object with code and message', () => {
    const n = normalizeError({ code: 'SIMULATION_FAILED', message: 'sim failed' });
    expect(n.code).toBe('SIMULATION_FAILED');
    expect(n.category).toBe('CONTRACT');
  });

  it('handles non-Error object with empty code', () => {
    const n = normalizeError({ code: '', message: 'no code' });
    expect(n.code).toBe('UNKNOWN');
  });

  it('handles non-serialisable object fallback', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const n = normalizeError(circular);
    // circular object has no code/message — falls through to stringify which throws,
    // so it hits the final String(error) fallback
    expect(n.code).toBe('UNKNOWN');
    expect(typeof n.message).toBe('string');
  });
});
