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
