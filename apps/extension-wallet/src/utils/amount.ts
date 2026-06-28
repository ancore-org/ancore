/**
 * Amount utilities for send flow calculations.
 */

export const BASE_SEND_RESERVE = 1.0;
export const DEFAULT_SEND_FEE = 0.00001;

export interface ComputeMaxSendableOptions {
  balance: number;
  fee: number | string;
  reserve?: number;
  asset?: string;
  assetDecimals?: number;
}

function normalizeAmount(value: number, decimals: number): string {
  const formatted = value.toFixed(decimals);
  return formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function computeMaxSendable({
  balance,
  fee,
  reserve = BASE_SEND_RESERVE,
  asset = 'XLM',
  assetDecimals = 7,
}: ComputeMaxSendableOptions): string {
  const feeAmount = Math.max(0, Number(fee) || 0);
  const reserveAmount = asset === 'XLM' ? reserve : 0;
  const maxSendable = asset === 'XLM' ? balance - feeAmount - reserveAmount : balance;

  if (maxSendable <= 0) {
    return '0';
  }

  return normalizeAmount(maxSendable, assetDecimals);
}
