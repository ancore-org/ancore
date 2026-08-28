import { computeMaxSendable, BASE_SEND_RESERVE, DEFAULT_SEND_FEE } from '@/utils/amount';

describe('computeMaxSendable', () => {
  it('subtracts fee and reserve from native asset balance', () => {
    const max = computeMaxSendable({
      balance: 5,
      fee: 0.00001,
      reserve: BASE_SEND_RESERVE,
      asset: 'XLM',
      assetDecimals: 7,
    });

    expect(max).toBe('3.99999');
  });

  it('returns 0 when balance is insufficient to cover fee and reserve', () => {
    const max = computeMaxSendable({
      balance: 1.000005,
      fee: DEFAULT_SEND_FEE,
      reserve: BASE_SEND_RESERVE,
      asset: 'XLM',
      assetDecimals: 7,
    });

    expect(max).toBe('0');
  });

  it('returns full balance for non-native assets', () => {
    const max = computeMaxSendable({
      balance: 123.456,
      fee: 0.00001,
      reserve: BASE_SEND_RESERVE,
      asset: 'USDC',
      assetDecimals: 6,
    });

    expect(max).toBe('123.456');
  });
});
