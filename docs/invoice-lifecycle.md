# Invoice Lifecycle

The Ancore invoice module enables creators to issue payment requests that
recipients can settle on-chain via a Stellar Asset Contract (SAC) transfer.

## States

```
Draft ──open()──► Open ──pay()──► Paid
  │                 │
  └──cancel()──►    └──cancel()──► Cancelled
                    └──expire()──► Expired (after due_date)
```

| State     | Description |
|-----------|-------------|
| Draft     | Created but not yet actionable; only the creator can see it |
| Open      | Published and payable; recipient can pay or creator can cancel |
| Paid      | Payment confirmed on-chain; terminal |
| Expired   | Past `due_date` before payment; terminal |
| Cancelled | Cancelled by creator; terminal |

## Contract methods

| Method | Auth | Description |
|--------|------|-------------|
| `create(creator, recipient, amount, asset, description?, due_date?, reference?)` | creator | Creates invoice in Draft state |
| `open(id)` | creator | Transitions Draft → Open |
| `pay(id, payer, payment_tx)` | payer | Transfers tokens via SAC; transitions Open → Paid |
| `cancel(id)` | creator | Cancels Draft or Open invoice |
| `expire(id)` | anyone | Transitions Open → Expired when `due_date` has passed |
| `get(id)` | — | Returns invoice by ID |
| `list_by_creator(creator)` | — | Returns invoice IDs created by account |
| `list_by_recipient(recipient)` | — | Returns invoice IDs payable by account |

## Events

Every state transition emits a contract event indexed by `("inv", <event_name>)`:

| Event | Topics | Payload |
|-------|--------|---------|
| `inv/created` | `inv`, `created` | `(id, creator, recipient, amount, asset, due_date)` |
| `inv/opened` | `inv`, `opened` | `(id, creator)` |
| `inv/paid` | `inv`, `paid` | `(id, payer, amount, asset, payment_tx)` |
| `inv/cancelled` | `inv`, `cancelled` | `(id, cancelled_by)` |
| `inv/expired` | `inv`, `expired` | `(id, creator)` |

Events are decoded by `services/relayer/src/indexer/invoice-event-decoder.ts`.

## SDK usage

```typescript
import { InvoiceClient } from '@ancore/core-sdk';

const client = new InvoiceClient({ getAuthToken: () => session.token });

// 1. Create a draft
const invoice = await client.create({
  accountAddress: myAddress,
  recipientAddress: vendorAddress,
  amount: '100',
  asset: 'USDC',
  description: 'Web design services – Q2',
  dueDate: '2026-08-31T23:59:59Z',
  reference: 'INV-2026-042',
});

// 2. Open it (makes it payable)
await client.open(invoice.id);

// 3. Share a payment link with the recipient
const link = client.buildPaymentLink(invoice.id);

// 4. Recipient pays (after signing on-chain)
await client.pay({ invoiceId: invoice.id, paymentTxHash: txHash });
```

## Expiry sweep

Any cron job or relayer worker can expire overdue invoices:

```typescript
const { invoices } = await client.listByCreator(address);
for (const inv of invoices.filter(i => i.status === 'open' && isPast(i.dueDate))) {
  await client.expire(inv.id);
}
```

## Storage

Invoice data is stored in the contract's `instance` storage using composite
keys `(INV, id)`. Creator and recipient indexes use keys `(CRIDX, address)` and
`(RCIDX, address)` respectively.

A running nonce counter (`CNT`) guarantees unique IDs even when the same
creator/recipient/amount combination is used multiple times in the same ledger.
