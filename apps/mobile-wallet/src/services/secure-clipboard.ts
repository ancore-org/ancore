/**
 * Secure clipboard service.
 *
 * Copies a value to the system clipboard and schedules an automatic clear
 * after a configurable timeout (default 60 seconds).
 *
 * Freighter reference: SecureClipboardService auto-clears clipboard after
 * 60s for mnemonics, private keys, and wallet addresses.
 *
 * Use only for sensitive data: mnemonic words, private keys, wallet addresses.
 * Do NOT use for non-sensitive data like display names or URLs.
 */

let clipboardModule: typeof import('@react-native-clipboard/clipboard') | null = null;
let activeTimer: ReturnType<typeof setTimeout> | null = null;

async function getClipboard() {
  if (!clipboardModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      clipboardModule = require('@react-native-clipboard/clipboard');
    } catch {
      // Fallback for test environments where the native module isn't available
      clipboardModule = {
        setString: async (_value: string) => {
          /* noop */
        },
        getString: async () => '',
      } as { setString: (v: string) => Promise<void>; getString: () => Promise<string> };
    }
  }
  return clipboardModule;
}

/**
 * Copy a sensitive value to the clipboard and schedule auto-clear.
 *
 * @param value - The string to copy (mnemonic, private key, wallet address)
 * @param clearAfterMs - Milliseconds before clipboard is cleared (default 60s)
 */
export async function copySecure(value: string, clearAfterMs = 60_000): Promise<void> {
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }

  const Clipboard = await getClipboard();
  if (!Clipboard) return;
  await Clipboard.setString(value);

  activeTimer = setTimeout(async () => {
    activeTimer = null;
    try {
      await Clipboard.setString('');
    } catch {
      // Silently ignore clear failures — best-effort cleanup
    }
  }, clearAfterMs);
}

/**
 * Immediately clear the clipboard (e.g. on app background or navigation away).
 */
export async function clearClipboard(): Promise<void> {
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }

  const Clipboard = await getClipboard();
  if (!Clipboard) return;
  try {
    await Clipboard.setString('');
  } catch {
    // Silently ignore
  }
}
