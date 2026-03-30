type ChromeRuntimeManifest = {
  name: string;
  version: string;
};

type ChromeInstalledDetails = {
  reason: string;
};

type ChromeMessageSender = object;

const logPrefix = '[ancore-extension/background]';

const runtime = (globalThis as { chrome?: { runtime?: any } }).chrome?.runtime;
const manifest = (runtime?.getManifest?.() as ChromeRuntimeManifest | undefined) ?? {
  name: 'ancore-extension-wallet',
  version: '0.0.0',
};

interface RuntimeMessage {
  type?: string;
}

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

runtime?.onMessage?.addListener(
  (message: unknown, _sender: ChromeMessageSender, sendResponse: (response: unknown) => void) => {
    const runtimeMessage = message as RuntimeMessage;

    if (runtimeMessage.type === 'wallet/ping') {
      sendResponse({
        ok: true,
        version: manifest.version,
        source: 'service-worker',
      });

      return true;
    }

    return false;
  }
);
