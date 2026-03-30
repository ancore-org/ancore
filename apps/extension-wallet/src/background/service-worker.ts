type ChromeRuntimeManifest = {
  name: string;
  version: string;
};

type ChromeInstalledDetails = {
  reason: string;
};

type ChromeMessageSender = object;

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
          sender: ChromeMessageSender,
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ): void;
    };
  };
};

const logPrefix = '[ancore-extension/background]';

const manifest = chrome.runtime.getManifest();

interface RuntimeMessage {
  type?: string;
}

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

chrome.runtime.onMessage.addListener(
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
