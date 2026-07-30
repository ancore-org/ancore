import type { Intent } from '../schemas/intent';
import type { DraftIntentInput, ProviderDraftResult } from './types';

const INVOICE_KEYWORDS = ['invoice', 'bill me', 'request payment', 'request a payment'];

const STELLAR_ADDRESS_RE = /\bG[A-Z2-7]{55}\b/;
const AMOUNT_RE = /(\d+(?:\.\d+)?)/;

function isInvoicePrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return INVOICE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function extractAmount(prompt: string): string {
  const match = prompt.match(AMOUNT_RE);
  return match ? match[1] : '10';
}

function extractAsset(prompt: string): 'XLM' | 'USDC' {
  return /\busdc\b/i.test(prompt) ? 'USDC' : 'XLM';
}

function extractDestination(prompt: string, fallback: string): string {
  const match = prompt.match(STELLAR_ADDRESS_RE);
  return match ? match[0] : fallback;
}

/**
 * Deterministic, offline fallback parser.
 *
 * Used when the LLM provider is unavailable, times out, errors, or produces
 * output that fails schema validation. Deliberately simple and dependency-free
 * so it always succeeds — this is the guaranteed-availability floor beneath
 * the LLM path (item 3 of issue #1005).
 */
export function deterministicDraftIntent({
  prompt,
  accountId,
}: DraftIntentInput): ProviderDraftResult {
  const amount = extractAmount(prompt);
  const asset = extractAsset(prompt);

  if (isInvoicePrompt(prompt)) {
    const intent: Intent = {
      type: 'invoice',
      amount,
      asset,
      recipient: accountId,
      dueDate: new Date().toISOString(),
    };
    return { intent, summary: 'Drafted invoice intent' };
  }

  const destination = extractDestination(prompt, 'G123');
  const intent: Intent = { type: 'payment', destination, amount, asset };
  return { intent, summary: 'Drafted payment intent' };
}
