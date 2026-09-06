import { isUsernameHandle } from '@ancore/types';
import { intentSchema, type Intent } from '../schemas/intent';
import type { DraftIntentInput, ProviderDraftResult } from './types';

const INVOICE_KEYWORDS = ['invoice', 'bill me', 'request payment', 'request a payment'];

const STELLAR_ADDRESS_RE = /\bG[A-Z2-7]{55}\b/;
const STELLAR_ADDRESS_RE_G = /\bG[A-Z2-7]{55}\b/g;
const AMOUNT_RE = /(\d+(?:\.\d+)?)/;
const ASSET_KEYWORDS = '(?:xlm|lumens?|usdc)';
// A number adjacent to an asset keyword ("25 XLM", "USDC 25") is far more
// likely to be the payment amount than an unrelated number elsewhere in the
// prompt ("wait 3 days then send 25 XLM to G..." should extract "25", not "3").
const AMOUNT_BEFORE_ASSET_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${ASSET_KEYWORDS}\\b`, 'i');
const AMOUNT_AFTER_ASSET_RE = new RegExp(`${ASSET_KEYWORDS}\\s*(\\d+(?:\\.\\d+)?)`, 'i');

/**
 * Default invoice term, matching the LLM tool description's
 * "Default to 7 days from now if unspecified" for the same field.
 *
 * This path used to emit `new Date().toISOString()` — already in the past by
 * the time `InvoiceIntentSchema`'s "must not be in the past" refinement ran.
 * Nothing caught it because the deterministic output was never parsed.
 */
const DEFAULT_INVOICE_TERM_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isInvoicePrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return INVOICE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function extractAmount(prompt: string): string {
  // Stellar strkeys are base32 and contain the digits 2-7, so an address in the
  // prompt would otherwise be a candidate amount ("Pay GD..7.. 25 XLM" -> "7").
  // Strip addresses before scanning for a number.
  const stripped = prompt.replace(STELLAR_ADDRESS_RE_G, ' ');
  const nearAsset = stripped.match(AMOUNT_BEFORE_ASSET_RE) ?? stripped.match(AMOUNT_AFTER_ASSET_RE);
  if (nearAsset) return nearAsset[1];
  const match = stripped.match(AMOUNT_RE);
  return match ? match[1] : '10';
}

function extractAsset(prompt: string): 'XLM' | 'USDC' {
  return /\busdc\b/i.test(prompt) ? 'USDC' : 'XLM';
}

function extractDestination(prompt: string): string | undefined {
  const match = prompt.match(STELLAR_ADDRESS_RE);
  if (match) {
    return match[0];
  }

  // No address — fall back to an @handle, which the schema accepts and
  // ../recipients.ts resolves. Tokenising and testing each candidate with the
  // shared `isUsernameHandle` guard keeps handle syntax defined in exactly one
  // place (@ancore/types) rather than in a second regex here.
  return prompt
    .split(/\s+/)
    .map((token) => token.replace(/[.,;:!?]+$/, ''))
    .find(isUsernameHandle);
}

/**
 * Deterministic, offline fallback parser.
 *
 * Used when the LLM provider is unavailable, times out, errors, or produces
 * output that fails schema validation. Deliberately simple and dependency-free
 * so it always succeeds — this is the guaranteed-availability floor beneath
 * the LLM path (item 3 of issue #1005).
 *
 * Output goes through `intentSchema` exactly as the Anthropic provider's does.
 * This path previously only *asserted* the `Intent` type on a hand-built
 * object, so nothing it produced was ever validated at runtime — which let an
 * unchecked `accountId` through as an invoice recipient (issue #1210).
 */
export function deterministicDraftIntent({
  prompt,
  accountId,
}: DraftIntentInput): ProviderDraftResult {
  const amount = extractAmount(prompt);
  const asset = extractAsset(prompt);

  if (isInvoicePrompt(prompt)) {
    const intent = parseOrThrow(
      {
        type: 'invoice',
        amount,
        asset,
        recipient: accountId,
        dueDate: new Date(Date.now() + DEFAULT_INVOICE_TERM_DAYS * MS_PER_DAY).toISOString(),
      },
      'invoice'
    );
    return { intent, summary: 'Drafted invoice intent' };
  }

  const destination = extractDestination(prompt);
  if (!destination) {
    throw new Error(
      'Unable to draft payment intent: destination address or @handle missing from prompt'
    );
  }

  const intent = parseOrThrow({ type: 'payment', destination, amount, asset }, 'payment');
  return { intent, summary: 'Drafted payment intent' };
}

/**
 * Validates a constructed intent against the shared schema.
 *
 * The deterministic parser is the availability floor, but "always succeeds"
 * must not mean "emits anything" — an intent it cannot validate is a rejection,
 * not a draft.
 */
function parseOrThrow(candidate: unknown, kind: 'payment' | 'invoice'): Intent {
  const parsed = intentSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `Unable to draft ${kind} intent: ${parsed.error.issues.map((i) => i.message).join('; ')}`
    );
  }
  return parsed.data;
}
