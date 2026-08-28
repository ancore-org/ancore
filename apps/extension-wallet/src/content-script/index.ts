/**
 * Content script — dApp ↔ extension bridge.
 *
 * Security model (two-layer defence-in-depth):
 *
 *   Layer 1 — content-script origin prefilter (this file):
 *     • Only http: / https: origins are forwarded to the background.
 *     • Known-blocked origins (chrome:// etc.) are rejected before relay.
 *     • The origin is taken from the browser-provided `event.origin` (not a
 *       caller-controlled field), and validated against the active tab's
 *       window.location.origin.  Requests whose `event.origin` does not match
 *       `window.location.origin` are dropped silently.
 *     • Unknown / unlisted methods are rejected before relay.
 *     • Malformed / missing envelopes are dropped silently.
 *     • Error messages returned to the page are generic — raw internals are
 *       not exposed.
 *
 *   Layer 2 — background allowlist (authoritative security boundary):
 *     • `service-worker.ts` re-validates `sender.origin` vs the claimed
 *       `origin` field in the EXTERNAL_API_REQUEST envelope.
 *     • Every privileged handler calls `isAllowed(…)` against the persistent
 *       Zustand allowlist before proceeding.
 *     • The background MUST NOT be relied upon to be the only check; equally
 *       the content-script prefilter MUST NOT be relied upon as the sole gate.
 *
 * Session-approval caching decision:
 *   No in-memory origin-approval cache is maintained in the content script.
 *   The allowlist store is in the background (chrome.storage, Zustand), so
 *   any cache here would be stale after a revoke without a guaranteed
 *   invalidation signal.  The background is fast enough that the extra round
 *   trip is not a usability concern.  If a cache is added in future it MUST
 *   subscribe to background revoke notifications so stale approvals cannot
 *   survive a user revocation.
 *
 * Freighter reference:
 *   extension/src/contentScript/redirectMessagesToBackground.ts
 */

import {
  ANCORE_WALLET_RESPONSE,
  CONTENT_SCRIPT_SOURCE,
  ExternalApiMethod,
  isExternalRequest,
  type ExternalApiMethodName,
} from '@ancore/wallet-shared';
import type { MessageType } from '@/messaging/types';

const logPrefix = '[ancore/content-script]';

type ChromeRuntime = {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>;
  };
};

declare const chrome: ChromeRuntime;

// ── Origin prefilter ──────────────────────────────────────────────────────────

/** Only http: and https: origins may relay requests to the background. */
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

/**
 * Origins that must never be forwarded regardless of protocol.
 * This list supplements the protocol check: any origin matching one of these
 * prefixes is rejected before relay even if the protocol is http/https.
 *
 * NOTE: The background allowlist is the authoritative security boundary.
 * This list is a prefilter to avoid unnecessary background round-trips for
 * obviously-blocked origins, not a replacement for the background check.
 */
const BLOCKED_ORIGIN_PREFIXES: ReadonlyArray<string> = [
  'chrome-extension://',
  'moz-extension://',
  'safari-extension://',
  'safari-web-extension://',
  'chrome://',
  'about:',
  'data:',
  'blob:',
  'file://',
  // eslint-disable-next-line no-script-url
  'javascript:',
];

/**
 * Validate that an origin is permitted to relay requests to the background.
 *
 * Uses exact URL parsing (not string matching) to extract the protocol, so
 * hand-crafted strings like "https://evil\nchrome://" are rejected by the
 * URL parser rather than passing a naïve prefix test.
 *
 * Fails closed: any parse error → false.
 */
export function isOriginPermitted(origin: string): boolean {
  if (!origin || typeof origin !== 'string') return false;

  // Reject against known-blocked prefixes first (fast path, no URL parse needed).
  const lower = origin.toLowerCase();
  for (const prefix of BLOCKED_ORIGIN_PREFIXES) {
    if (lower.startsWith(prefix)) return false;
  }

  // Parse the origin through the URL constructor so the browser performs
  // canonical normalisation — this avoids bypasses via encoding tricks.
  try {
    const parsed = new URL(origin);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    // Unparseable origin string — fail closed.
    return false;
  }
}

// ── Method → typed message-type mapping ──────────────────────────────────────

/**
 * Authoritative mapping of every external API method to its typed background
 * message type.
 *
 * SECURITY REQUIREMENTS:
 *   • Every entry in ExternalApiMethod MUST appear in this map.
 *   • Each method MUST map to the correct, dedicated background message type.
 *   • No method may accidentally share a message type with a different
 *     privileged operation.
 *   • Methods absent from this map are unknown and MUST be rejected.
 *
 * The `messageType` value is used in this file only as a method-whitelist
 * guard (if falsy → reject).  The actual background routing uses the `method`
 * string via `dispatchExternalRequest`.  Nonetheless the mapping must be
 * correct so that future code that forwards `messageType` cannot accidentally
 * route one privileged operation through another handler.
 *
 * GET_SMART_ACCOUNT specifically: maps to 'EXTERNAL_GET_SMART_ACCOUNT' (not
 * 'EXTERNAL_SIGN_TRANSACTION').  This was the mapping bug described in #970.
 *
 * SIGN_AUTH_ENTRY, SIGN_MESSAGE, REQUEST_SESSION_KEY: each has its own
 * dedicated message type — they must NOT share 'EXTERNAL_SIGN_TRANSACTION'.
 */
const METHOD_TO_MESSAGE_TYPE: Readonly<Record<ExternalApiMethodName, MessageType>> = {
  [ExternalApiMethod.REQUEST_ACCESS]: 'EXTERNAL_REQUEST_ACCESS',
  [ExternalApiMethod.CONNECT]: 'EXTERNAL_REQUEST_ACCESS',
  [ExternalApiMethod.GET_ADDRESS]: 'EXTERNAL_GET_PUBLIC_KEY',
  [ExternalApiMethod.GET_PUBLIC_KEY]: 'EXTERNAL_GET_PUBLIC_KEY',
  [ExternalApiMethod.GET_NETWORK]: 'EXTERNAL_GET_NETWORK',
  [ExternalApiMethod.IS_CONNECTED]: 'EXTERNAL_IS_CONNECTED',
  [ExternalApiMethod.GET_SMART_ACCOUNT]: 'EXTERNAL_GET_SMART_ACCOUNT',
  [ExternalApiMethod.SIGN_TRANSACTION]: 'EXTERNAL_SIGN_TRANSACTION',
  [ExternalApiMethod.SIGN_AUTH_ENTRY]: 'EXTERNAL_SIGN_AUTH_ENTRY',
  [ExternalApiMethod.SIGN_MESSAGE]: 'EXTERNAL_SIGN_MESSAGE',
  [ExternalApiMethod.REQUEST_SESSION_KEY]: 'EXTERNAL_REQUEST_SESSION_KEY',
} as const;

// ── Response helpers ──────────────────────────────────────────────────────────

/**
 * Send a response back to the dApp page.
 *
 * SECURITY: `targetOrigin` is set to the specific page origin so the response
 * cannot be read by a different origin loaded in the same tab.  We never use
 * `'*'` as the target.  If the origin is not a valid http/https origin the
 * postMessage is skipped entirely.
 */
function respond(
  requestId: string,
  ok: boolean,
  pageOrigin: string,
  result?: unknown,
  error?: string
): void {
  // Only reply to http/https pages — do not post to unknown origins.
  if (!isOriginPermitted(pageOrigin)) return;

  window.postMessage(
    {
      type: ANCORE_WALLET_RESPONSE,
      source: CONTENT_SCRIPT_SOURCE,
      requestId,
      ok,
      result,
      error,
    },
    pageOrigin
  );
}

// ── Message listener ──────────────────────────────────────────────────────────

window.addEventListener('message', (event: MessageEvent) => {
  // ── 1. Source guard: only accept messages from the same window (not iframes,
  //       not other tabs, not injected frames).
  if (event.source !== window) return;

  // ── 2. Envelope validation: drop silently if not a recognised wallet request.
  if (!isExternalRequest(event.data)) {
    if (import.meta.env.DEV && event.data) {
      console.debug(`${logPrefix} Dropped non-wallet message`, event.data);
    }
    return;
  }

  const { requestId, method, params } = event.data;

  // ── 3. Origin resolution: prefer the browser-provided event.origin over the
  //       page's window.location.origin.  Both should agree for same-frame
  //       messages; if they differ something anomalous is happening and we
  //       fail closed.
  //
  //       The browser sets event.origin from the frame that posted the message
  //       and it cannot be forged by the page script.  window.location.origin
  //       is also controlled by the browser for same-origin content scripts, but
  //       we cross-check both to detect any inconsistency.
  const browserOrigin: string =
    typeof event.origin === 'string' && event.origin.length > 0
      ? event.origin
      : window.location.origin;

  const tabOrigin: string = window.location.origin;

  // If the two sources disagree, drop the message — something is wrong.
  if (browserOrigin !== tabOrigin) {
    if (import.meta.env.DEV) {
      console.warn(
        `${logPrefix} Origin mismatch: event.origin=${browserOrigin} vs window=${tabOrigin}`
      );
    }
    return;
  }

  const origin = browserOrigin;

  // ── 4. Protocol + blocked-origin prefilter.
  if (!isOriginPermitted(origin)) {
    respond(requestId, false, origin, undefined, 'Origin not permitted');
    return;
  }

  // ── 5. Method whitelist: map the method to its background message type.
  //       Any method not in the map is unknown and must be rejected.
  //       Using `in` with `hasOwnProperty` semantics via `Object.prototype` to
  //       avoid prototype-chain attacks on the const object.
  const messageType: MessageType | undefined = Object.prototype.hasOwnProperty.call(
    METHOD_TO_MESSAGE_TYPE,
    method
  )
    ? METHOD_TO_MESSAGE_TYPE[method as ExternalApiMethodName]
    : undefined;

  if (!messageType) {
    respond(requestId, false, origin, undefined, 'Unknown method');
    return;
  }

  if (import.meta.env.DEV) {
    console.debug(`${logPrefix} ← ${method} (→ ${messageType})`, { requestId, params });
  }

  // ── 6. Generate an internal correlation ID so the background response can be
  //       matched back to this page request even if multiple requests are in
  //       flight.  The page's requestId is kept only for the final response;
  //       it is never forwarded to the background.
  const correlationId = crypto.randomUUID();

  chrome.runtime
    .sendMessage({
      type: 'EXTERNAL_API_REQUEST',
      requestId: correlationId,
      method,
      params: params ?? {},
      origin,
    })
    .then((backgroundResult: unknown) => {
      const payload = backgroundResult as { ok?: boolean; result?: unknown; error?: string } | null;

      if (payload === null || payload === undefined) {
        respond(requestId, false, origin, undefined, 'No response from background');
        return;
      }

      if (typeof payload.ok !== 'boolean') {
        respond(requestId, false, origin, undefined, 'Malformed background response');
        return;
      }

      // SECURITY: forward only the ok/result/error — never forward the
      // internal correlationId or any other background-internal field.
      respond(requestId, payload.ok, origin, payload.result, payload.error);
    })
    .catch((err: unknown) => {
      // SECURITY: do not forward raw error details to the page; use a generic
      // message so internal state is not leaked.
      if (import.meta.env.DEV) {
        console.error(`${logPrefix} Background relay error for ${method}`, err);
      }
      respond(requestId, false, origin, undefined, 'Request failed');
    });
});

if (import.meta.env.DEV) {
  console.info(`${logPrefix} loaded on`, window.location.origin);
}
