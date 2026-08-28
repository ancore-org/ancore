import {
  DEFAULT_POLICY_ASSET_CODE,
  DEFAULT_TRANSFER_POLICY,
  validateTransferPolicy,
} from '../transfer-policy';

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

  describe('asset code in messages (issue #1254)', () => {
    it('uses the supplied asset code in the daily-limit message', () => {
      const result = validateTransferPolicy(500, 600, DEFAULT_TRANSFER_POLICY, 'USDC');
      expect(result.action).toBe('block');
      expect(result.message).toContain('daily limit of 1000 USDC');
      expect(result.message).not.toContain('XLM');
    });

    it('uses the supplied asset code in the step-up message', () => {
      const result = validateTransferPolicy(300, 100, DEFAULT_TRANSFER_POLICY, 'EURC');
      expect(result.action).toBe('step_up');
      expect(result.message).toContain('step-up threshold of 250 EURC');
      expect(result.message).not.toContain('XLM');
    });

    it('defaults to XLM when no asset code is supplied', () => {
      expect(validateTransferPolicy(500, 600, DEFAULT_TRANSFER_POLICY).message).toContain(
        `1000 ${DEFAULT_POLICY_ASSET_CODE}`
      );
      expect(validateTransferPolicy(300, 100, DEFAULT_TRANSFER_POLICY).message).toContain(
        `250 ${DEFAULT_POLICY_ASSET_CODE}`
      );
    });

    it('falls back to the default unit for a blank asset code', () => {
      const result = validateTransferPolicy(500, 600, DEFAULT_TRANSFER_POLICY, '   ');
      expect(result.message).toContain(`1000 ${DEFAULT_POLICY_ASSET_CODE}`);
    });
  });
});
