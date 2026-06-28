/**
 * useHotkey hook
 *
 * Registers a global keyboard shortcut and fires a callback when matched.
 * Supports cross-platform modifier aliases (Meta for Mac, Ctrl for Windows/Linux).
 * Ignores the shortcut when focus is on an input, textarea, or contenteditable element.
 */

import { useEffect, useRef } from 'react';

export interface UseHotkeyOptions {
  /** Whether the shortcut is active. Defaults to true. */
  enabled?: boolean;
  /** Skip the shortcut when an input/textarea/contenteditable has focus. Defaults to true. */
  ignoreInputs?: boolean;
}

type ModifierKey = 'Meta' | 'Ctrl' | 'Alt' | 'Shift';

interface ParsedHotkey {
  modifiers: Set<ModifierKey>;
  key: string;
}

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (INPUT_TAGS.has(el.tagName)) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Parses a hotkey string like "Meta+Shift+L" or "Ctrl+Shift+L".
 * The special token "CmdOrCtrl" resolves to Meta on Mac and Ctrl elsewhere.
 */
function parseHotkey(hotkey: string): ParsedHotkey {
  const parts = hotkey.split('+');
  const modifiers = new Set<ModifierKey>();
  let key = '';

  for (const part of parts) {
    const token = part.trim();
    if (token === 'Meta' || token === 'Cmd') {
      modifiers.add('Meta');
    } else if (token === 'Ctrl' || token === 'Control') {
      modifiers.add('Ctrl');
    } else if (token === 'Alt' || token === 'Option') {
      modifiers.add('Alt');
    } else if (token === 'Shift') {
      modifiers.add('Shift');
    } else {
      key = token.toLowerCase();
    }
  }

  return { modifiers, key };
}

function matchesEvent(event: KeyboardEvent, parsed: ParsedHotkey): boolean {
  if (event.key.toLowerCase() !== parsed.key) return false;

  const wantsMeta = parsed.modifiers.has('Meta');
  const wantsCtrl = parsed.modifiers.has('Ctrl');
  const wantsAlt = parsed.modifiers.has('Alt');
  const wantsShift = parsed.modifiers.has('Shift');

  if (wantsShift !== event.shiftKey) return false;
  if (wantsAlt !== event.altKey) return false;

  // Support cross-platform: Meta matches metaKey (Mac ⌘), Ctrl matches ctrlKey
  if (wantsMeta && wantsCtrl) {
    // Caller wants both — require both (unusual but valid)
    if (!event.metaKey || !event.ctrlKey) return false;
  } else if (wantsMeta) {
    if (!event.metaKey) return false;
    if (event.ctrlKey) return false;
  } else if (wantsCtrl) {
    if (!event.ctrlKey) return false;
    if (event.metaKey) return false;
  } else {
    if (event.metaKey || event.ctrlKey) return false;
  }

  return true;
}

/**
 * Registers a global keyboard shortcut.
 *
 * @param hotkey  Hotkey string, e.g. "Meta+Shift+L" or "Ctrl+Shift+L"
 * @param callback  Function to call when the hotkey fires
 * @param options  Configuration options
 *
 * @example
 * useHotkey('Meta+Shift+L', () => lock(), { enabled: settings.enableLockShortcut, ignoreInputs: true });
 */
export function useHotkey(
  hotkey: string,
  callback: () => void,
  options: UseHotkeyOptions = {}
): void {
  const { enabled = true, ignoreInputs = true } = options;

  // Keep refs stable to avoid re-attaching the listener on every render
  const callbackRef = useRef(callback);
  const enabledRef = useRef(enabled);
  const ignoreInputsRef = useRef(ignoreInputs);

  callbackRef.current = callback;
  enabledRef.current = enabled;
  ignoreInputsRef.current = ignoreInputs;

  useEffect(() => {
    const parsed = parseHotkey(hotkey);

    function handleKeyDown(event: KeyboardEvent) {
      if (!enabledRef.current) return;
      if (ignoreInputsRef.current && isInputFocused()) return;
      if (!matchesEvent(event, parsed)) return;

      event.preventDefault();
      callbackRef.current();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hotkey]); // re-attach only if the hotkey string itself changes
}
