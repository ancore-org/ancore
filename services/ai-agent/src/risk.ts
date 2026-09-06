import type { RiskLevel, RiskScore } from './types';
import { isStellarAccountAddress } from './schemas/recipient';

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

/**
 * Signal for a destination that is not a usable Stellar address — malformed,
 * or an `@handle` that was never resolved (issue #1210).
 *
 * Distinct from the first-time-recipient signal on purpose. "Unfamiliar" and
 * "unusable" are different findings, and scoring a malformed destination as
 * merely unfamiliar both understates it and buries it in the medium bucket
 * alongside legitimate new payees. Only one of the two is ever emitted.
 */
const INVALID_RECIPIENT_REASON =
  'Invalid recipient: destination is not a valid Stellar address or a resolved @handle';

/**
 * Reason prefixes that force a `high` score. Reasons are plain strings in this
 * module, so severity is carried by the prefix.
 */
const HIGH_SEVERITY_PREFIXES = ['High-value', 'Invalid recipient'];

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
    if (!Number.isFinite(amount)) {
      reasons.push(`Unparseable amount: '${intent.amount}'`);
      return { level: 'high', reasons };
    }
    const isUsdc = intent.asset === 'USDC';
    const mediumThreshold = isUsdc ? MEDIUM_THRESHOLD_USDC : MEDIUM_THRESHOLD_XLM;
    const highThreshold = isUsdc ? HIGH_THRESHOLD_USDC : HIGH_THRESHOLD_XLM;

    if (amount >= highThreshold) {
      reasons.push(`High-value transfer: ${amount} ${intent.asset} exceeds ${highThreshold}`);
    } else if (amount >= mediumThreshold) {
      reasons.push(`Large transfer: ${amount} ${intent.asset} exceeds ${mediumThreshold}`);
    }

    // Defence in depth: the schema layer should have rejected this long before
    // now, and generateDraftIntent() resolves handles ahead of scoring — but
    // /v1/intents/validate scores structurally valid input with no resolver, so
    // an unresolved handle can still arrive here.
    if (!isStellarAccountAddress(intent.destination)) {
      reasons.push(INVALID_RECIPIENT_REASON);
    } else if (ctx.knownRecipients && !ctx.knownRecipients.has(intent.destination)) {
      reasons.push('First-time recipient: this address has not been paid before');
    }

    if (amount >= mediumThreshold && Number.isInteger(amount)) {
      reasons.push('Round number above threshold may indicate manual high-value entry');
    }
  }

  let level: RiskLevel = 'low';
  if (reasons.length > 0) {
    const hasHigh = reasons.some((r) => HIGH_SEVERITY_PREFIXES.some((p) => r.startsWith(p)));
    level = hasHigh ? 'high' : 'medium';
  }

  return { level, reasons };
}
