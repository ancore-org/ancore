# Ancore Web Dashboard

Web dashboard application for the Ancore ecosystem.

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Environment

All runtime configuration is provided through `VITE_*` environment variables. Copy `.env.example`
to `.env.local` before starting the dev server:

```bash
cp .env.example .env.local
# edit .env.local with your local service URLs
```

Variables are validated at startup by `src/lib/env.ts` (zod schema). An invalid or missing URL
will throw a descriptive error in development so misconfiguration is immediately visible.

| Variable                    | Required | Description                                                                  |
| --------------------------- | -------- | ---------------------------------------------------------------------------- |
| `VITE_RELAYER_URL`          | Yes      | Base URL for the Ancore relayer service                                      |
| `VITE_INDEXER_BASE_URL`     | Yes      | Base URL for the Ancore indexer service                                      |
| `VITE_STATEMENT_PDF_EXPORT` | No       | Set to `"true"` to enable PDF export on Statements page (default: `"false"`) |

## Statement Export

The dashboard includes a statement export feature accessible from the **Reports** page or the
**Transactions** page. Exports are fetched from the Ancore indexer and generated entirely
client-side — no data leaves the browser during export.

### Formats

| Format | Availability | Library           | Notes                                                    |
| ------ | ------------ | ----------------- | -------------------------------------------------------- |
| CSV    | Always on    | Built-in          | RFC 4180 compliant; proper escaping of commas and quotes |
| PDF    | Feature-flag | jsPDF + autotable | Gated behind `VITE_STATEMENT_PDF_EXPORT=true`            |

### Columns

| Column         | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| Timestamp      | ISO 8601 timestamp of the transaction                        |
| Counterparty   | Address or label of the counterparty                         |
| Amount         | Transaction amount as a string (preserves decimal precision) |
| Asset          | Asset code (e.g. `XLM`, `USDC`)                              |
| Status         | `completed`, `pending`, `failed`, or `unknown`               |
| Memo/Reference | Optional memo or reference string from the transaction       |

### Privacy

- Statement data is fetched directly from the Ancore indexer for the selected account.
- Memo fields are sanitized before PDF inclusion (control characters stripped, line breaks
  normalized). CSV escaping follows RFC 4180.
- Exported files are generated entirely in the browser and never transmitted to third-party
  servers.
- Store exported files securely — they contain financial activity associated with your Stellar
  account.
- Large exports (>5,000 rows) are blocked; narrow the date range to stay within limits.
