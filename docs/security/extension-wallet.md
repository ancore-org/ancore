# Extension Wallet Security: Content Security Policy

## Overview

The Ancore browser extension enforces a strict Content Security Policy (CSP) via
`manifest.json` (`content_security_policy.extension_pages`). This document explains
each directive, the rationale behind it, and how to maintain the policy as the
codebase evolves.

---

## Policy

```
script-src 'self';
object-src 'none';
connect-src 'self'
  https://*.stellar.org
  https://relayer.ancore.io
  https://relayer-staging.ancore.io
  https://indexer.ancore.io
  https://indexer-staging.ancore.io;
img-src 'self' data:;
style-src 'self' 'unsafe-inline';
default-src 'none'
```

---

## Directive Rationale

| Directive | Value | Rationale |
|-----------|-------|-----------|
| `script-src` | `'self'` | Only scripts bundled with the extension may execute. Blocks XSS via injected `<script>` tags and `eval()`. MV3 prohibits `'unsafe-eval'` and remote script sources. |
| `object-src` | `'none'` | Disables Flash/plugin execution vectors entirely. |
| `connect-src` | `'self'` + allowlist | Restricts `fetch`/`XMLHttpRequest`/WebSocket to the extension origin and the explicit service allowlist below. Prevents data exfiltration to arbitrary hosts. |
| `img-src` | `'self' data:` | Allows bundled icons and inline QR-code `data:` URIs (used by `PaymentQRCode.tsx`). |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind CSS injects runtime style attributes; `'unsafe-inline'` is required. Styles cannot execute code, so the risk is low. |
| `default-src` | `'none'` | Deny-by-default for any fetch type not explicitly listed above. |

### `connect-src` allowlist (relates to issue #567)

| Host | Purpose |
|------|---------|
| `https://*.stellar.org` | Horizon API, Soroban RPC, Friendbot (testnet) |
| `https://relayer.ancore.io` | Production transaction relayer |
| `https://relayer-staging.ancore.io` | Staging relayer (QA / pre-release) |
| `https://indexer.ancore.io` | Production indexer |
| `https://indexer-staging.ancore.io` | Staging indexer |

When adding a new service origin, update **both** `manifest.json` and this table.

---

## Inline Script Strategy

MV3 forbids `'unsafe-inline'` in `script-src`. The build pipeline enforces this:

1. **Vite plugin** (`cspInlineScriptGuard` in `vite.config.ts`) — fails the build if
   any emitted HTML file contains an inline `<script>` tag or inline event handler.
2. **Post-build script** (`scripts/check-csp.js`) — scans `dist/` for inline scripts,
   event handlers, `javascript:` URIs, `eval()`, and `new Function()`. Run with:
   ```
   pnpm check:csp
   ```
3. **ESLint rule** (`no-script-url: error` in `eslint.config.cjs`) — catches
   `javascript:` URIs in source code at lint time.

If a third-party library introduces an inline script, the build will fail. Options:
- Find an alternative library.
- Fork/patch the library to use external scripts.
- If unavoidable, document the exception here with a hash (`'sha256-...'`) and a
  justification, and add it to `script-src` in `manifest.json`.

---

## Manual Test Checklist

Run these checks before every release on both Chrome and Firefox.

### Load & basic function

- [ ] Extension installs without errors in Chrome (MV3) and Firefox (MV2 polyfill).
- [ ] Popup opens; no CSP errors in the browser console (`F12 → Console`).
- [ ] Onboarding flow completes end-to-end.
- [ ] Wallet unlocks with correct password; lock button re-locks.

### Network requests

- [ ] Send transaction reaches the relayer (`Network` tab shows request to
  `relayer.ancore.io` or configured URL, not blocked).
- [ ] Balance fetch reaches Horizon (`*.stellar.org`, not blocked).
- [ ] No requests to unlisted origins appear in the `Network` tab.

### CSP violation check

- [ ] Open `chrome://extensions` → click **Errors** on the Ancore entry — no CSP
  violations listed.
- [ ] In Firefox: `about:debugging` → Inspect → Console — no CSP errors.

### Inline script regression

- [ ] Run `pnpm build && pnpm check:csp` — exits 0.
- [ ] Run `pnpm lint` — no `no-script-url` errors.

### QR code

- [ ] Receive screen displays QR code (validates `img-src data:` is working).

---

## Adding a New External Origin

1. Add the origin to `content_security_policy.extension_pages` in `manifest.json`.
2. Add a row to the allowlist table in this document with the purpose.
3. If the origin is a configurable service URL, add it to `src/config/urls.ts`.
4. Run `pnpm build && pnpm check:csp` to confirm no regressions.

---

## References

- [Chrome MV3 CSP documentation](https://developer.chrome.com/docs/extensions/mv3/manifest/content_security_policy/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Issue #567 — service origins](../../services/)
