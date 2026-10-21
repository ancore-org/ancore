import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { SuccessScreen } from '../SuccessScreen';

describe('SuccessScreen', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders txId, amount, and handles copy hash button click', async () => {
    const txId = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    render(
      <SuccessScreen
        txId={txId}
        amount="25.5"
        assetCode="XLM"
        recipient="GDXTVHXGF6DZ4YCVLXV4LEBQ4RPQBHKX5XQOQU4ONHV6BQNVJFQ4XKZ2"
      />
    );

    expect(screen.getByText('25.5')).toBeDefined();
    expect(screen.getByTestId('tx-hash-display').textContent).toContain(txId);

    const copyBtn = screen.getByTestId('copy-hash-btn');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(txId);
  });

  it('invokes onDone callback on return to dashboard click', () => {
    const onDone = vi.fn();
    render(<SuccessScreen txId="abc-tx" onDone={onDone} />);

    fireEvent.click(screen.getByTestId('done-btn'));
    expect(onDone).toHaveBeenCalled();
  });
});
