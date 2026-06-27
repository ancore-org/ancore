import type { RiskLevel, RiskScore } from './types';

type ScoreablePayment = {
  type: 'payment';
  amount: string;
  asset: string;
  destination: string;
};

type ScoreableIntent = ScoreablePayment | { type: 'invoice' };

const MEDIUM_THRESHOLD_USDC = 1000;
const HIGH_THRESHOLD_USDC = 10_000;
const MEDIUM_THRESHOLD_XLM = 10_000;
const HIGH_THRESHOLD_XLM = 100_000;

interface RiskContext {
  /** Set of addresses the sender has transacted with before */
  knownRecipients?: Set<string>;
}

export function scoreRisk(intent: ScoreableIntent, ctx: RiskContext = {}): RiskScore {
  const reasons: string[] = [];

  if (intent.type === 'invoice') {
    return { level: 'low', reasons };
  }

  if (intent.type === 'payment') {
    const amount = parseFloat(intent.amount);
    const isUsdc = intent.asset === 'USDC';
    const mediumThreshold = isUsdc ? MEDIUM_THRESHOLD_USDC : MEDIUM_THRESHOLD_XLM;
    const highThreshold = isUsdc ? HIGH_THRESHOLD_USDC : HIGH_THRESHOLD_XLM;

    if (amount >= highThreshold) {
      reasons.push(`High-value transfer: ${amount} ${intent.asset} exceeds ${highThreshold}`);
    } else if (amount >= mediumThreshold) {
      reasons.push(`Large transfer: ${amount} ${intent.asset} exceeds ${mediumThreshold}`);
    }

    if (ctx.knownRecipients && !ctx.knownRecipients.has(intent.destination)) {
      reasons.push('First-time recipient: this address has not been paid before');
    }

    if (amount >= mediumThreshold && Number.isInteger(amount)) {
      reasons.push('Round number above threshold may indicate manual high-value entry');
    }
  }

  let level: RiskLevel = 'low';
  if (reasons.length > 0) {
    const hasHigh = reasons.some((r) => r.startsWith('High-value'));
    level = hasHigh ? 'high' : 'medium';
  }

  return { level, reasons };
}
