import { z } from 'zod';

// ── Request ───────────────────────────────────────────────────────────────────

export const DraftIntentRequestSchema = z.object({
  /** Natural-language description of the intended operation */
  prompt: z.string().min(1).max(1000),
  /** Stellar account address of the initiating user */
  accountId: z.string().min(1),
  /** Optional context for the intent (e.g. invoice ID, session key) */
  context: z.record(z.unknown()).optional(),
});

export type DraftIntentRequest = z.infer<typeof DraftIntentRequestSchema>;

// ── Response ──────────────────────────────────────────────────────────────────

export type IntentType = 'payment' | 'invoice';

export interface DraftPaymentIntent {
  type: 'payment';
  destination: string;
  amount: string;
  asset: string;
  memo?: string;
}

export interface DraftInvoiceIntent {
  type: 'invoice';
  requestedBy: string;
  amount: string;
  asset: string;
  description?: string;
}

export type DraftIntent = DraftPaymentIntent | DraftInvoiceIntent;

export interface DraftIntentResponse {
  /** Always "draft" — this intent requires explicit user confirmation before execution */
  status: 'draft';
  intent: DraftIntent;
  /** Human-readable summary for display */
  summary: string;
  /** Guardrail confirmation: service never executes autonomously */
  requiresConfirmation: true;
}
