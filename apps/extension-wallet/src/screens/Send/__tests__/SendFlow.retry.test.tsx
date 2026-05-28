/**
 * @vitest-environment jsdom
 *
 * SendFlow retry-after-failure tests — covers #429 acceptance criteria:
 *
 *  ✓ Retry button rehydrates previous draft
 *  ✓ Errors are shown inline
 *  ✓ Retry path clears stale error on success
 *  ✓ Tests cover retry after failure
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendFlow } from '../SendFlow';
import type { SendDraft } from '@/hooks/useSendDraft';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DRAFT: SendDraft = { recipient: 'GABCDEF1234567890', amount: '42' };

function fillForm(recipient = DRAFT.recipient, amount = DRAFT.amount) {
  fireEvent.change(screen.getByTestId('send-recipient'), { target: { value: recipient } });
  fireEvent.change(screen.getByTestId('send-amount'), { target: { value: amount } });
}

function submitForm() {
  fireEvent.click(screen.getByTestId('send-review-btn'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SendFlow — retry after failure (#429)', () => {
  let sendTransaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendTransaction = vi.fn();
  });

  // -------------------------------------------------------------------------
  it('shows the send form on initial render', () => {
    render(<SendFlow sendTransaction={sendTransaction} />);
    expect(screen.getByTestId('send-form')).toBeInTheDocument();
    expect(screen.queryByTestId('retry-btn')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('displays inline error and Retry CTA after a failed transaction', async () => {
    sendTransaction.mockRejectedValueOnce(new Error('Network congestion'));

    render(<SendFlow sendTransaction={sendTransaction} />);

    fillForm();
    submitForm();

    await waitFor(() => {
      // StatusScreen with failed status should be visible
      expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('rehydrates the draft when Retry is clicked', async () => {
    sendTransaction.mockRejectedValueOnce(new Error('Timeout'));

    render(<SendFlow sendTransaction={sendTransaction} />);

    fillForm(DRAFT.recipient, DRAFT.amount);
    submitForm();

    await waitFor(() => expect(screen.getByTestId('retry-btn')).toBeInTheDocument());

    // Click retry — should return to form
    fireEvent.click(screen.getByTestId('retry-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('send-form')).toBeInTheDocument();
    });

    // Draft values must be pre-populated
    const recipientInput = screen.getByTestId('send-recipient') as HTMLInputElement;
    const amountInput = screen.getByTestId('send-amount') as HTMLInputElement;

    expect(recipientInput.value).toBe(DRAFT.recipient);
    expect(amountInput.value).toBe(DRAFT.amount);
  });

  // -------------------------------------------------------------------------
  it('shows inline error on the form after retry returns to form step', async () => {
    sendTransaction.mockRejectedValueOnce(new Error('Fee bump required'));

    render(<SendFlow sendTransaction={sendTransaction} />);

    fillForm();
    submitForm();

    await waitFor(() => expect(screen.getByTestId('retry-btn')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('retry-btn'));

    await waitFor(() => {
      // The previous error message should surface inline on the form
      expect(screen.getByTestId('send-form-error')).toBeInTheDocument();
      expect(screen.getByTestId('send-form-error')).toHaveTextContent('Fee bump required');
    });
  });

  // -------------------------------------------------------------------------
  it('clears stale error on successful retry', async () => {
    // First call fails, second call succeeds
    sendTransaction
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({ txId: 'TXSUCCESS123' });

    render(<SendFlow sendTransaction={sendTransaction} />);

    // First attempt — fails
    fillForm();
    submitForm();

    await waitFor(() => expect(screen.getByTestId('retry-btn')).toBeInTheDocument());

    // Retry — goes back to form
    fireEvent.click(screen.getByTestId('retry-btn'));

    await waitFor(() => expect(screen.getByTestId('send-form')).toBeInTheDocument());

    // Second attempt — succeeds
    submitForm();

    await waitFor(() => {
      // Should now be on the confirmed status screen — no retry button
      expect(screen.queryByTestId('retry-btn')).not.toBeInTheDocument();
      // No inline error
      expect(screen.queryByTestId('send-form-error')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('does not show Retry CTA on a successful transaction', async () => {
    sendTransaction.mockResolvedValueOnce({ txId: 'TXOK456' });

    render(<SendFlow sendTransaction={sendTransaction} />);

    fillForm();
    submitForm();

    await waitFor(() => {
      expect(screen.queryByTestId('retry-btn')).not.toBeInTheDocument();
      expect(screen.getByTestId('close-btn')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('can retry multiple times, each time preserving the latest draft', async () => {
    sendTransaction
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockResolvedValueOnce({ txId: 'TXFINAL' });

    render(<SendFlow sendTransaction={sendTransaction} />);

    fillForm('GORIGINAL', '10');
    submitForm();

    // Fail 1 → retry
    await waitFor(() => expect(screen.getByTestId('retry-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('retry-btn'));

    await waitFor(() => expect(screen.getByTestId('send-form')).toBeInTheDocument());

    // Adjust amount and retry again
    fireEvent.change(screen.getByTestId('send-amount'), { target: { value: '20' } });
    submitForm();

    // Fail 2 → retry
    await waitFor(() => expect(screen.getByTestId('retry-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('retry-btn'));

    await waitFor(() => expect(screen.getByTestId('send-form')).toBeInTheDocument());

    // Latest draft should reflect the updated amount
    const amountInput = screen.getByTestId('send-amount') as HTMLInputElement;
    expect(amountInput.value).toBe('20');

    // Third attempt succeeds
    submitForm();

    await waitFor(() => {
      expect(screen.queryByTestId('retry-btn')).not.toBeInTheDocument();
    });
  });
});
