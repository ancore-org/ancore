import { installMessageDispatcher } from '@/messaging';
import { registerInternalHandlers, probeServicesOnStartup } from './handlers';
import { restoreUnlockSessionFromStorage } from './session-state';
import {
  registerAllExternalHandlers,
  dispatchExternalRequest,
} from '@/background/handlers/external';
import { openMockApproval } from './approval-window';
import { resolveRequest, rejectRequest } from './handlers/external/response-queue';
import type { ExternalApiRequest, ExternalApiMethodName } from '@ancore/types';

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

const logPrefix = '[ancore-extension/background]';

const runtime = (globalThis as { chrome?: { runtime?: typeof chrome.runtime } }).chrome?.runtime;
const manifest = (runtime?.getManifest?.() as ChromeRuntimeManifest | undefined) ?? {
  name: 'ancore-extension-wallet',
  version: '0.0.0',
};

console.info(`${logPrefix} booted`, {
  name: manifest.name,
  version: manifest.version,
});

void restoreUnlockSessionFromStorage().then((restored) => {
  if (restored) {
    console.info(`${logPrefix} unlock session restored from chrome.storage.session`);
  }
});

runtime?.onInstalled?.addListener((details: ChromeInstalledDetails) => {
  console.info(`${logPrefix} installed`, { reason: details.reason });
});

runtime?.onStartup?.addListener(() => {
  console.info(`${logPrefix} startup`);
  void probeServicesOnStartup().catch((err) => {
    console.warn(`${logPrefix} health probe failed on startup`, err);
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
      console.info(`${logPrefix} network changed`, {
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
 */
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: { url?: string; origin?: string; tab?: { id?: number } },
    sendResponse: (response: unknown) => void
  ) => {
    const request = message as ExternalApiRequest;

    if (request.type !== 'EXTERNAL_API_REQUEST') {
      return false;
    }

    const { method, requestId, params, origin } = request;

    // Validate origin
    if (!origin || typeof origin !== 'string') {
      sendResponse({
        type: 'EXTERNAL_API_RESPONSE',
        requestId,
        ok: false,
        error: 'Invalid origin',
      });
      return true;
    }

    // Validate sender origin matches
    if (sender.origin && sender.origin !== origin) {
      sendResponse({
        type: 'EXTERNAL_API_RESPONSE',
        requestId,
        ok: false,
        error: 'Origin mismatch',
      });
      return true;
    }

    // Dispatch to handler
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
    resolveRequest(msg.requestId, { signedXdr: 'AAAAAgAAAAA=' });
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'REJECT_SIGN_REQUEST' && msg.requestId) {
    rejectRequest(msg.requestId, new Error('User rejected the sign request'));
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
