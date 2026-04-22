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

const runtime = (globalThis as { chrome?: { runtime?: any } }).chrome?.runtime;
const manifest = (runtime?.getManifest?.() as ChromeRuntimeManifest | undefined) ?? {
  name: 'ancore-extension-wallet',
  version: '0.0.0',
};

console.info(`${logPrefix} booted`, {
  name: manifest.name,
  version: manifest.version,
});

runtime?.onInstalled?.addListener((details: ChromeInstalledDetails) => {
  console.info(`${logPrefix} installed`, { reason: details.reason });
});

runtime?.onStartup?.addListener(() => {
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
