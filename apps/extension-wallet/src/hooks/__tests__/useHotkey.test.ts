import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHotkey } from '../useHotkey';

function fireKey(options: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: options.key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
  });
  window.dispatchEvent(event);
  return event;
}

describe('useHotkey', () => {
  let callback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    callback = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the callback when the exact hotkey fires (Meta+Shift+L)', () => {
    renderHook(() => useHotkey('Meta+Shift+L', callback));
    fireKey({ key: 'L', metaKey: true, shiftKey: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls the callback when the exact hotkey fires (Ctrl+Shift+L)', () => {
    renderHook(() => useHotkey('Ctrl+Shift+L', callback));
    fireKey({ key: 'L', ctrlKey: true, shiftKey: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when the wrong key is pressed', () => {
    renderHook(() => useHotkey('Meta+Shift+L', callback));
    fireKey({ key: 'K', metaKey: true, shiftKey: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it('does NOT fire when modifier is missing', () => {
    renderHook(() => useHotkey('Meta+Shift+L', callback));
    fireKey({ key: 'L', shiftKey: true }); // no meta
    expect(callback).not.toHaveBeenCalled();
  });

  it('does NOT fire when enabled is false', () => {
    renderHook(() => useHotkey('Meta+Shift+L', callback, { enabled: false }));
    fireKey({ key: 'L', metaKey: true, shiftKey: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it('does NOT fire when an input element has focus (ignoreInputs: true)', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useHotkey('Meta+Shift+L', callback, { ignoreInputs: true }));
    fireKey({ key: 'L', metaKey: true, shiftKey: true });

    expect(callback).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('does NOT fire when a textarea element has focus (ignoreInputs: true)', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    renderHook(() => useHotkey('Meta+Shift+L', callback, { ignoreInputs: true }));
    fireKey({ key: 'L', metaKey: true, shiftKey: true });

    expect(callback).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('DOES fire when an input has focus if ignoreInputs is false', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useHotkey('Meta+Shift+L', callback, { ignoreInputs: false }));
    fireKey({ key: 'L', metaKey: true, shiftKey: true });

    expect(callback).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });

  it('removes the event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useHotkey('Meta+Shift+L', callback));
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('is case-insensitive for the key character', () => {
    renderHook(() => useHotkey('Meta+Shift+l', callback));
    fireKey({ key: 'L', metaKey: true, shiftKey: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
