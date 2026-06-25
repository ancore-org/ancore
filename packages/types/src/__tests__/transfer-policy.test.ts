import { DEFAULT_TRANSFER_POLICY, validateTransferPolicy } from '../transfer-policy';

describe('TransferPolicy', () => {
  it('allows transfers below the step-up threshold when under the daily limit', () => {
    const result = validateTransferPolicy(100, 200, DEFAULT_TRANSFER_POLICY);
    expect(result.action).toBe('allow');
    expect(result.message).toContain('within policy limits');
  });

  it('flags transfers above the step-up threshold for explicit confirmation', () => {
    const result = validateTransferPolicy(300, 100, DEFAULT_TRANSFER_POLICY);
    expect(result.action).toBe('step_up');
    expect(result.message).toContain('requires additional confirmation');
  });

  it('blocks transfers that would exceed the daily limit', () => {
    const result = validateTransferPolicy(500, 600, DEFAULT_TRANSFER_POLICY);
    expect(result.action).toBe('block');
    expect(result.message).toContain('exceeds daily limit');
  });

  it('rejects invalid negative amounts', () => {
    const result = validateTransferPolicy(-10, 0, DEFAULT_TRANSFER_POLICY);
    expect(result.action).toBe('block');
    expect(result.message).toContain('greater than zero');
  });

  it('rejects invalid negative daily totals', () => {
    const result = validateTransferPolicy(10, -5, DEFAULT_TRANSFER_POLICY);
    expect(result.action).toBe('block');
    expect(result.message).toContain('Invalid daily total');
  });
});
