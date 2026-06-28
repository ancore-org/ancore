import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '@ancore/ui-kit';
import React from 'react';
import {
  useCopyWithFeedback,
  COPY_ERROR_TOAST,
  COPY_SUCCESS_ANNOUNCEMENT,
  COPY_SUCCESS_TOAST,
} from '../useCopyWithFeedback';

const { showSuccess, showError, emitAddressCopied, announceToScreenReader } = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  emitAddressCopied: vi.fn(),
  announceToScreenReader: vi.fn(),
}));

vi.mock('@ancore/ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ancore/ui-kit')>();
  return {
    ...actual,
    useToast: () => ({ showSuccess, showError, toast: vi.fn() }),
  };
});

vi.mock('@/telemetry', () => ({
  getTelemetry: () => ({
    emitAddressCopied,
    isEnabled: () => true,
  }),
}));

vi.mock('@/utils/accessibility', () => ({
  announceToScreenReader,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(NotificationProvider, null, children);
}

describe('useCopyWithFeedback', () => {
  beforeEach(() => {
    showSuccess.mockClear();
    showError.mockClear();
    emitAddressCopied.mockClear();
    announceToScreenReader.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('copies text, shows success toast, announces, and emits telemetry', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    const { result } = renderHook(() => useCopyWithFeedback(), { wrapper });

    await act(async () => {
      await result.current.copy('GABC123');
    });

    expect(writeText).toHaveBeenCalledWith('GABC123');
    expect(showSuccess).toHaveBeenCalledWith(COPY_SUCCESS_TOAST);
    expect(announceToScreenReader).toHaveBeenCalledWith(COPY_SUCCESS_ANNOUNCEMENT);
    expect(emitAddressCopied).toHaveBeenCalledTimes(1);
    expect(result.current.copied).toBe(true);
  });

  it('shows error toast and assertive announcement when clipboard is denied', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useCopyWithFeedback(), { wrapper });

    await act(async () => {
      await result.current.copy('GABC123');
    });

    expect(showError).toHaveBeenCalledWith(COPY_ERROR_TOAST);
    expect(announceToScreenReader).toHaveBeenCalledWith(COPY_ERROR_TOAST, 'assertive');
    expect(emitAddressCopied).not.toHaveBeenCalled();
    expect(result.current.copied).toBe(false);
  });

  it('debounces rapid copy attempts', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyWithFeedback(), { wrapper });

    await act(async () => {
      await result.current.copy('GABC123');
      await result.current.copy('GABC123');
    });

    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('resets copied state after a delay', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useCopyWithFeedback(), { wrapper });

      await act(async () => {
        await result.current.copy('GABC123');
      });

      expect(result.current.copied).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(result.current.copied).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
