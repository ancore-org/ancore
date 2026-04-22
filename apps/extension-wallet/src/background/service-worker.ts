import { registerHandler, installMessageDispatcher } from '@/messaging';

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
  };
};

const logPrefix = '[ancore-extension/background]';

const manifest = chrome.runtime.getManifest();

console.info(`${logPrefix} booted`, {
  name: manifest.name,
  version: manifest.version,
});

chrome.runtime.onInstalled.addListener((details) => {
  console.info(`${logPrefix} installed`, { reason: details.reason });
});

chrome.runtime.onStartup.addListener(() => {
  console.info(`${logPrefix} startup`);
});

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

registerHandler('GET_WALLET_STATE', async () => {
  // TODO: read real state from storage
  return { state: 'uninitialized' };
});

registerHandler('LOCK_WALLET', async () => {
  // TODO: implement lock logic
  return { success: true };
});

registerHandler('UNLOCK_WALLET', async (_request) => {
  // TODO: implement unlock + password verification
  return { success: false };
});

// Activate the dispatcher — must be called after all handlers are registered.
installMessageDispatcher();
