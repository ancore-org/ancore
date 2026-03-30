# Ancore Extension Wallet

Browser extension wallet for the Ancore account abstraction layer on Stellar.

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

## Permissions

- `storage` — persist wallet state
- `activeTab` — interact with active tab for dApp connections
