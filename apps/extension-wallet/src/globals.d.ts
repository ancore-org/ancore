/**
 * This app overrides `paths`, so `@ancore/core-sdk` resolves to its built types
 * rather than to source — which means the `/// <reference path>` inside
 * `storage/storage-adapter.ts` never reaches this program. Point at the same
 * canonical declaration directly so there is still only one copy of the
 * `browser` global in the monorepo.
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- ambient global declarations have no importable binding
/// <reference path="../../../packages/core-sdk/src/types/webextension-global.d.ts" />

interface Window {
  /** Set by Playwright e2e fixtures when seeding an unlocked wallet in dev mode. */
  __E2E_INITIALLY_UNLOCKED__?: boolean;
}
