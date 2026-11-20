import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StatusScreen } from '../StatusScreen';
import { SuccessScreen } from '../SuccessScreen';

describe('StatusScreen & SuccessScreen (CopyButton integration)', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('renders CopyButton alongside transaction hash on StatusScreen when txId is present', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(
      <StatusScreen
        txId="f0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        status="confirmed"
      />
    );

    const copyBtn = screen.getByTestId('copy-tx-hash-btn');
    expect(copyBtn).toBeInTheDocument();
    expect(
      screen.getByText('f0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      'f0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );
    expect(screen.getByTestId('copy-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('copy-tooltip')).toHaveTextContent('Copied!');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId('copy-tooltip')).not.toBeInTheDocument();
  });

  it('SuccessScreen renders confirmed StatusScreen with CopyButton', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<SuccessScreen txId="tx-hash-success-12345" />);

    expect(screen.getByText('Sent Successfully')).toBeInTheDocument();
    const copyBtn = screen.getByTestId('copy-hash-btn');
    expect(copyBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledWith('tx-hash-success-12345');
    expect(screen.getByTestId('copy-tooltip')).toBeInTheDocument();
  });
});
