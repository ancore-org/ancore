import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { CopyButton } from '../CopyButton';

describe('CopyButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('copies text to clipboard and displays tooltip on click', async () => {
    const txHash = '4b9a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b';
    render(<CopyButton text={txHash} label="Copy Hash" />);

    const button = screen.getByTestId('copy-btn');
    expect(button).toBeDefined();

    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(txHash);

    const tooltip = screen.getByTestId('copy-tooltip');
    expect(tooltip).toBeDefined();
    expect(tooltip.textContent).toBe('Copied!');

    // Advance timers by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId('copy-tooltip')).toBeNull();
  });

  it('handles clipboard write failure gracefully', async () => {
    (navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('Permission denied'));
    render(<CopyButton text="error-test" />);

    const button = screen.getByTestId('copy-btn');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.queryByTestId('copy-tooltip')).toBeNull();
  });
});
