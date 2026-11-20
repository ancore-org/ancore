import { isInsufficientFee, isContractNotFoundError } from '../errors';

describe('isInsufficientFee', () => {
  it('detects fee exhaustion codes and messages', () => {
    expect(isInsufficientFee({ code: 'tx_insufficient_fee' })).toBe(true);
    expect(isInsufficientFee(new Error('BudgetExceeded'))).toBe(true);
    expect(isInsufficientFee({ name: 'BudgetExceededError' })).toBe(true);
    expect(isInsufficientFee('transaction failed: insufficient fee')).toBe(true);
  });

  it('returns false for unrelated and authorization errors', () => {
    expect(isInsufficientFee(new Error('network timeout'))).toBe(false);
    expect(isInsufficientFee({ code: 'TX_BAD_AUTH', message: 'signature invalid' })).toBe(false);
    expect(isInsufficientFee(null)).toBe(false);
  });
});

describe('isContractNotFoundError', () => {
  it('detects Soroban missing-value host errors', () => {
    expect(isContractNotFoundError({ message: 'HostError: MissingValue' })).toBe(true);
    expect(isContractNotFoundError({ data: { message: 'HostError MissingValue' } })).toBe(true);
    expect(isContractNotFoundError({ code: 'CONTRACT_NOT_FOUND' })).toBe(true);
    expect(isContractNotFoundError(new Error('Contract not found'))).toBe(true);
  });

  it('does not classify authorization or signature failures as missing contracts', () => {
    expect(isContractNotFoundError({ message: 'HostError MissingValue: unauthorized' })).toBe(
      false
    );
    expect(isContractNotFoundError(new Error('signature verification failed'))).toBe(false);
    expect(isContractNotFoundError({ code: 'TX_BAD_AUTH', message: 'authorization failed' })).toBe(
      false
    );
  });

  it('returns false for unrelated errors', () => {
    expect(isContractNotFoundError(new Error('network timeout'))).toBe(false);
    expect(isContractNotFoundError(null)).toBe(false);
  });
});
