# Ancore Financial OS Roadmap

## Product Thesis

Stellar is the settlement layer.  
Ancore is the user-facing financial operating system built on top of it.

Use Stellar where it improves settlement, trust, and interoperability.  
Use traditional software where it improves usability, speed of product iteration, analytics, and risk controls.

## Phase 1 - Core Wallet and Identity

- Secure send/receive
- User handles (`@username`) and contact-based payments
- Payment request links
- Statement export (CSV/PDF)
- Device/session security controls

## Delivery cadence (2-3 features at a time)

To avoid scattered delivery, each wave ships 2-3 focused features end-to-end.

### Stellar Wave A (active)

1. Handle payments (`@username`) - issue #409
2. Contacts and favorites - issue #410
3. Payment request links + QR - issue #411

### Stellar Wave B (next)

1. Scheduled transfers - issue #412
2. Recurring transfers - issue #412
3. Transfer limits + step-up verification - issue #413

### Stellar Wave C (business kickoff)

1. Invoice MVP - issue #415
2. Statement exports - issue #417
3. Bulk payouts CSV flow - issue #416

## Phase 2 - Fintech UX

- Scheduled and recurring transfers
- QR pay and merchant request flows
- Spending categories and analytics
- Savings vault primitives
- Recipient safety warnings and confirmation UX

## Phase 3 - Business Finance

- Invoicing
- Bulk payouts
- Payroll runs
- Role-based approvals
- Treasury dashboard and compliance-grade records

## Phase 4 - Network and Platform

- Escrow flows
- Merchant APIs/payment pages
- Tokenized asset workflows
- Partner integrations
- Controlled AI assistant workflows

## Module Strategy

The following module paths are preserved intentionally as scaffolds:

- `contracts/validation-modules/`
- `contracts/invoice/`
- `contracts/upgrade/`
- `services/ai-agent/`

They represent roadmap commitments, not production-complete implementations.

## Labeling standard for roadmap issues

- Always include: `Stellar Wave`
- Complexity: `easy` or `medium`
- Domain tags as applicable: `extension`, `transaction`, `security`, `contract`, `ui`
