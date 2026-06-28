# Invoice Contracts

Invoice and request-to-pay contract for business finance workflows.

## Why this exists

- Keep the business-finance roadmap visible and contributor-friendly.
- Separate invoice/payment-request logic from the core account contract.
- Allow gradual rollout of invoice primitives and settlement hooks.

## Capabilities

- Create invoice
- Invoice status lifecycle (draft/open/paid/expired/cancelled)
- Optional due dates and references
- On-chain receipt hash anchoring for auditability

## Current status

- MVP contract implementation in `src/lib.rs`
- TypeScript types in `packages/types/src/invoice.ts`
- UI components in `apps/web-dashboard/src/features/invoices/`
- Business feature work tracked via roadmap/issues
