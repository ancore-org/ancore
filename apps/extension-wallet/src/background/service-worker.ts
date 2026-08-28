import { installMessageDispatcher } from '@/messaging';
import { registerInternalHandlers, probeServicesOnStartup } from './handlers';
import { restoreUnlockSessionFromStorage, refreshSessionExpiry } from './session-state';
import {
  registerAllExternalHandlers,
  dispatchExternalRequest,
} from '@/background/handlers/external';
import { openMockApproval } from './approval-window';
import {
  resolveRequest,
  rejectRequest,
  getApproval,
  removeApproval,
} from './handlers/external/response-queue';
import { signAuthEntry } from './handlers/sign-auth-entry';
import { signTransaction } from './handlers/sign-transaction';
import { signMessage } from './handlers/sign-message';
import { signRelayPayload } from './handlers/sign-relay-payload';
import { ExternalApiMethodName } from '@ancore/types';
import type { ExternalApiRequest } from '@ancore/types';
import { createLogger } from './logger';

type ChromeRuntimeManifest = {
  name: string;
  version: string;
};

type ChromeInstalledDetails = {
  reason: string;
};

declare const chrome: {
  runtime: {
    getManifest(): ChromeRuntimeManifest;
    onInstalled: {
      addListener(callback: (details: ChromeInstalledDetails) => void): void;
    };
    onStartup: {
      addListener(callback: () => void): void;
    };
    onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: { url?: string; origin?: string; tab?: { id?: number } },
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ): void;
    };
    getURL(path: string): string;
  };
  tabs: {
    query(queryInfo: {
      active?: boolean;
      lastFocusedWindow?: boolean;
    }): Promise<{ id?: number; windowId?: number }[]>;
  };
  sidePanel?: {
    setOptions(options: { path?: string; enabled?: boolean }): Promise<void>;
    open(options: { windowId: number }): Promise<void>;
  };
  windows: {
    create(createData: {
      url?: string;
      type?: string;
      width?: number;
      height?: number;
    }): Promise<{ id?: number }>;
  };
};

const log = createLogger('[ancore-extension/background]');

const runtime = (globalThis as { chrome?: { runtime?: typeof chrome.runtime } }).chrome?.runtime;
const manifest = (runtime?.getManifest?.() as ChromeRuntimeManifest | undefined) ?? {
  name: 'ancore-extension-wallet',
  version: '0.0.0',
};

log.info('booted', {
  name: manifest.name,
  version: manifest.version,
});

void restoreUnlockSessionFromStorage().then((restored) => {
  if (restored) {
    log.info('unlock session restored from chrome.storage.session');
  }
});

runtime?.onInstalled?.addListener((details: ChromeInstalledDetails) => {
  log.info('installed', { reason: details.reason });
});

runtime?.onStartup?.addListener(() => {
  log.info('startup');
  void probeServicesOnStartup().catch((err) => {
    log.warn('health probe failed on startup', err);
  });
});

// Broadcast network changes to all tabs via chrome.storage.onChanged
const storage = (globalThis as { chrome?: { storage?: typeof chrome.storage } }).chrome?.storage;
storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === 'local' && 'ancore-settings' in changes) {
    const newSettings = changes['ancore-settings'].newValue as Record<string, unknown> | undefined;
    const oldSettings = changes['ancore-settings'].oldValue as Record<string, unknown> | undefined;

    // Check if network changed
    if (newSettings?.network !== oldSettings?.network) {
      log.info('network changed', {
        from: oldSettings?.network,
        to: newSettings?.network,
      });

      // Broadcast to all tabs to refresh their state
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: 'NETWORK_CHANGED',
                network: newSettings?.network,
                horizonUrl: newSettings?.horizonUrl,
              })
              .catch(() => {
                // Tab may not have content script, ignore error
              });
          }
        });
      });
    }

    // Check if auto-lock settings changed
    if (newSettings?.autoLockMinutes !== oldSettings?.autoLockMinutes) {
      log.info('auto-lock settings changed', {
        from: oldSettings?.autoLockMinutes,
        to: newSettings?.autoLockMinutes,
      });

      // Refresh session expiry with new TTL if currently unlocked
      void refreshSessionExpiry().then(() => {
        log.info('session expiry refreshed with new auto-lock TTL');
      });
    }
  }
});

// ---------------------------------------------------------------------------
// External API handlers (dApp connectivity)
// ---------------------------------------------------------------------------

// Register all external API handlers
registerAllExternalHandlers();

/**
 * Handle EXTERNAL_API_REQUEST messages from content script.
 * These are requests from dApps to interact with the wallet.
 *
 * SECURITY: This handler is the authoritative second layer of defence.
 * The content-script prefilter is the first layer; both must be correct.
 *
 * Checks (fail closed on any failure):
 *   1. Message type must be exactly 'EXTERNAL_API_REQUEST'.
 *   2. requestId must be a non-empty string (correlation, not trusted).
 *   3. origin must be a non-empty string.
 *   4. method must be a non-empty string that resolves to a registered handler.
 *   5. sender.origin (browser-provided) must match the claimed origin when
 *      present — prevents a compromised content script from escalating to a
 *      different origin's permissions.
 *   6. Every privileged handler independently validates the allowlist.
 *      This file does NOT bypass that check.
 *
 * Error messages returned to the content script via sendResponse are generic
 * for validation failures so internal routing details are not exposed.
 */
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: { url?: string; origin?: string; tab?: { id?: number } },
    sendResponse: (response: unknown) => void
  ) => {
    // ── 1. Type guard — ignore non-external messages.
    if (
      !message ||
      typeof message !== 'object' ||
      (message as Partial<ExternalApiRequest>).type !== 'EXTERNAL_API_REQUEST'
    ) {
      return false;
    }

    const request = message as Partial<ExternalApiRequest>;
    const { method, requestId, params, origin } = request;

    // ── 2. requestId must be a non-empty string.
    if (!requestId || typeof requestId !== 'string') {
      // Cannot send a useful response without a requestId; drop silently.
      log.warn('EXTERNAL_API_REQUEST dropped: missing requestId');
      return false;
    }

    // ── 3. origin must be a non-empty string.
    if (!origin || typeof origin !== 'string') {
      sendResponse({
        type: 'EXTERNAL_API_RESPONSE',
        requestId,
        ok: false,
        error: 'Invalid request',
      });
      return true;
    }

    // ── 4. method must be a non-empty string.
    if (!method || typeof method !== 'string') {
      sendResponse({
        type: 'EXTERNAL_API_RESPONSE',
        requestId,
        ok: false,
        error: 'Invalid request',
      });
      return true;
    }

    // ── 5. Sender-origin check (browser-provided; cannot be forged by the page).
    //       When the browser populates sender.origin it MUST match the claimed
    //       origin or we reject — a mismatch means something is wrong.
    if (sender.origin && sender.origin !== origin) {
      log.warn('EXTERNAL_API_REQUEST rejected: sender.origin mismatch', {
        senderOrigin: sender.origin,
        claimedOrigin: origin,
      });
      sendResponse({
        type: 'EXTERNAL_API_RESPONSE',
        requestId,
        ok: false,
        error: 'Invalid request',
      });
      return true;
    }

    // ── 6. Dispatch to the registered external handler.
    //       `dispatchExternalRequest` throws for unknown methods (fail closed).
    //       Each handler independently verifies the allowlist.
    void dispatchExternalRequest(method as ExternalApiMethodName, {
      origin,
      params,
      requestId,
      sender,
    })
      .then((result) => {
        sendResponse({
          type: 'EXTERNAL_API_RESPONSE',
          requestId,
          ok: true,
          result,
        });
      })
      .catch((error: Error) => {
        sendResponse({
          type: 'EXTERNAL_API_RESPONSE',
          requestId,
          ok: false,
          error: error.message,
        });
      });

    return true; // Async response
  }
);

// Register internal handlers and activate dispatcher
registerInternalHandlers();
installMessageDispatcher();

// Dev-only: handle mock approval requests from popup
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if ((message as { type?: string }).type === 'DEV_OPEN_APPROVAL') {
    void openMockApproval().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

// Handle approve/reject from side panel or popup approval screen
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const msg = message as { type?: string; requestId?: string };
  if (msg.type === 'APPROVE_SIGN_REQUEST' && msg.requestId) {
    const pending = getApproval(msg.requestId);
    if (!pending) {
      rejectRequest(msg.requestId, new Error('Approval request not found'));
      sendResponse({ ok: false, error: 'Approval request not found' });
      return true;
    }
    const signer =
      pending.method === ExternalApiMethodName.SIGN_MESSAGE
        ? signMessage
        : pending.method === ExternalApiMethodName.SIGN_RELAY_PAYLOAD
          ? signRelayPayload
          : signTransaction;
    void signer(pending.params as never)
      .then((result) => {
        resolveRequest(msg.requestId!, result);
        removeApproval(msg.requestId!);
        sendResponse({ ok: true });
      })
      .catch((err: Error) => {
        rejectRequest(msg.requestId!, err);
        removeApproval(msg.requestId!);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
  if (msg.type === 'REJECT_SIGN_REQUEST' && msg.requestId) {
    rejectRequest(msg.requestId, new Error('User rejected the sign request'));
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'APPROVE_AUTH_ENTRY_REQUEST' && msg.requestId) {
    const pending = getApproval(msg.requestId);
    if (!pending) {
      rejectRequest(msg.requestId, new Error('Approval request not found'));
      sendResponse({ ok: false, error: 'Approval request not found' });
      return true;
    }
    const params = pending.params as { authEntry?: string; networkPassphrase?: string };
    if (!params?.authEntry) {
      rejectRequest(msg.requestId, new Error('Auth entry XDR not found in request'));
      sendResponse({ ok: false, error: 'Auth entry XDR not found' });
      return true;
    }
    void signAuthEntry({
      authEntryXdr: params.authEntry,
      networkPassphrase: params.networkPassphrase,
    })
      .then((result) => {
        resolveRequest(msg.requestId!, result);
        removeApproval(msg.requestId!);
        sendResponse({ ok: true });
      })
      .catch((err: Error) => {
        rejectRequest(msg.requestId!, err);
        removeApproval(msg.requestId!);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
  if (msg.type === 'REJECT_AUTH_ENTRY_REQUEST' && msg.requestId) {
    rejectRequest(msg.requestId, new Error('User rejected the auth entry sign request'));
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
