# Ancore Extension Wallet

Browser extension wallet for the Ancore account abstraction layer on Stellar.

**Agent / contributor guide:** [AGENTS.md](./AGENTS.md) (modeled on [Freighter AGENTS.md](https://github.com/stellar/freighter/blob/master/AGENTS.md)).

## Architecture

```
src/
├── popup/          # Extension popup entry (React app, 360px)
├── background/     # Service worker (MV3)
├── screens/        # Page-level React components
├── stores/         # Zustand state (account, session, settings)
├── hooks/          # React hooks (useLockManager, useSettings)
├── security/       # Lock manager & inactivity detector
├── components/     # Shared UI components
├── errors/         # Error boundary & classification
└── utils/          # Helpers
```

## Build

```bash
# Development (HMR via Vite)
pnpm dev

# Production bundle
pnpm build
```

The build outputs to `dist/` with:

- `manifest.json` — MV3 manifest
- `popup/index.html` — popup entry
- `background/service-worker.js` — background worker
- `icons/` — extension icons (16, 32, 48, 128px)

**Troubleshooting:** See [Extension Build Troubleshooting Guide](../../docs/troubleshooting/extension-build.md) for common build issues and fixes.

## Loading in Chrome

1. Run `pnpm build`
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" → select `dist/`

## Loading in Firefox

1. Run `pnpm build`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on" → select `dist/manifest.json`

## State Management

Zustand stores with persistence to `chrome.storage.local` / `browser.storage.local`:

- `useAccountStore` — wallet accounts and active account
- `useSettingsStore` — network, theme, auto-lock timeout
- `useSessionStore` — runtime session (route, lock status) — not persisted

## Auto-Lock

The `useLockManager` hook wires `LockManager` + `InactivityDetector` to the session store.
Configure timeout via `useSettingsStore().setAutoLockMinutes(n)` (0 = never lock).

## QR Export

Settings → Address QR renders a downloadable PNG QR of the active account's public
receive address, for support tickets and desktop use outside the receive flow.

**All QR downloads must go through `utils/public-address-qr.ts`, never
`utils/export-qr.ts` directly.** A downloaded QR is a file that leaves the extension —
a secret encoded in one is catastrophic and invisible, since the PNG looks identical
either way. `assertPublicAddressOnly` whitelists the Stellar public formats
(`G…` account, `C…` contract, `M…` muxed) and throws `SecretExportBlockedError` on
anything else, so a secret shape nobody anticipated still cannot slip through. Secret
seeds, raw hex private keys, and recovery phrases get a specific message; everything
else gets the generic rejection.

`AccountQrScreen` applies the same check at the render boundary, so a non-public value
never reaches the QR renderer even if a caller passes one.

## Permissions

- `storage` — persist wallet state

## E2E Smoke Suite

Release candidates use a deterministic Playwright smoke suite that validates:

- onboarding (`/welcome` -> `/home`)
- lock/unlock (`/unlock` -> `/home`)
- send/receive navigation (`/send`, `/receive`)
- session key access controls (`/session-keys`)

Run locally:

```bash
pnpm --filter @ancore/extension-wallet test:e2e:smoke
```

Debug locally (headed, single worker, traces on):

```bash
pnpm --filter @ancore/extension-wallet test:e2e:smoke:debug
```

See `docs/testing/extension-e2e-smoke.md` for troubleshooting and CI behavior.
