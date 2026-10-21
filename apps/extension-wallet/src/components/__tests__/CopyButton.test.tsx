import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CopyButton } from '../CopyButton';

describe('CopyButton', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (document as any).execCommand;
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('renders with copy button and default aria-label', () => {
    render(<CopyButton text="0x1234567890abcdef" />);
    const button = screen.getByTestId('copy-btn');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Copy to clipboard');
  });

  it('copies text via navigator.clipboard and displays "Copied!" for 2 seconds', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const onCopySuccess = vi.fn();
    render(
      <CopyButton
        text="stellar-tx-hash-12345"
        onCopySuccess={onCopySuccess}
      />
    );

    const button = screen.getByTestId('copy-btn');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith('stellar-tx-hash-12345');
    expect(onCopySuccess).toHaveBeenCalled();

    // Tooltip should be visible
    expect(screen.getByTestId('copy-tooltip')).toBeInTheDocument();
    expect(screen.getByText('Copied!')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Copied!');

    // Advance 1999ms - tooltip still visible
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.queryByTestId('copy-tooltip')).toBeInTheDocument();

    // Advance 1ms more (2000ms total) - tooltip disappears
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('copy-tooltip')).not.toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Copy to clipboard');
  });

  it('falls back to document.execCommand when navigator.clipboard fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;
    const onCopySuccess = vi.fn();

    render(
      <CopyButton
        text="fallback-tx-hash"
        onCopySuccess={onCopySuccess}
      />
    );

    const button = screen.getByTestId('copy-btn');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(onCopySuccess).toHaveBeenCalled();
    expect(screen.getByTestId('copy-tooltip')).toBeInTheDocument();
  });

  it('calls onCopyError when both clipboard API and fallback fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
      writable: true,
      configurable: true,
    });

    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error('execCommand error');
    });
    const onCopyError = vi.fn();

    render(
      <CopyButton
        text="failed-copy"
        onCopyError={onCopyError}
      />
    );

    const button = screen.getByTestId('copy-btn');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(onCopyError).toHaveBeenCalledWith(expect.any(Error));
    expect(screen.queryByTestId('copy-tooltip')).not.toBeInTheDocument();
  });

  it('supports custom tooltipDurationMs prop', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CopyButton text="custom-duration" tooltipDurationMs={1000} />);
    const button = screen.getByTestId('copy-btn');

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByTestId('copy-tooltip')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId('copy-tooltip')).not.toBeInTheDocument();
  });
});
