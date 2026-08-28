import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AiDraftPanel } from '../AiDraftPanel';

function fakeFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi
    .fn()
    .mockResolvedValue({ ok, status, json: async () => body }) as unknown as typeof fetch;
}

const paymentDraft = {
  status: 'draft',
  requiresConfirmation: true,
  summary: 'Drafted payment intent',
  intent: { type: 'payment', destination: 'GDEST123', amount: '10', asset: 'XLM' },
  risk: { level: 'low', reasons: [] },
  source: 'deterministic',
};

const highRiskInvoiceDraft = {
  status: 'draft',
  requiresConfirmation: true,
  summary: 'Drafted invoice intent',
  intent: {
    type: 'invoice',
    recipient: 'Alice',
    amount: '50000',
    asset: 'XLM',
    dueDate: '2026-12-31',
  },
  risk: { level: 'high', reasons: ['High-value transfer: 50000 XLM exceeds 10000'] },
  source: 'llm',
};

describe('AiDraftPanel', () => {
  it('renders the prompt form and never calls fetch before submission', () => {
    const fetcher = fakeFetch(paymentDraft);
    render(<AiDraftPanel accountId="GACC" onAccept={vi.fn()} fetcher={fetcher} />);

    expect(screen.getByLabelText(/describe what you want to do/i)).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('shows the draft with type, amount, destination, risk, and summary after submitting', async () => {
    const user = userEvent.setup();
    const fetcher = fakeFetch(paymentDraft);
    render(<AiDraftPanel accountId="GACC" onAccept={vi.fn()} fetcher={fetcher} />);

    await user.type(screen.getByLabelText(/describe what you want to do/i), 'Send 10 XLM to Alice');
    await user.click(screen.getByRole('button', { name: /draft intent/i }));

    await waitFor(() => expect(screen.getByTestId('ai-draft-result')).toBeInTheDocument());

    expect(screen.getByText('payment')).toBeInTheDocument();
    expect(screen.getByText('10 XLM')).toBeInTheDocument();
    expect(screen.getByText('GDEST123')).toBeInTheDocument();
    expect(screen.getByTestId('ai-draft-risk-badge')).toHaveTextContent('low');
    expect(screen.getByText('Drafted payment intent')).toBeInTheDocument();
  });

  it('calls onAccept with the intent only when the user clicks Confirm draft', async () => {
    const user = userEvent.setup();
    const fetcher = fakeFetch(paymentDraft);
    const onAccept = vi.fn();
    render(<AiDraftPanel accountId="GACC" onAccept={onAccept} fetcher={fetcher} />);

    await user.type(screen.getByLabelText(/describe what you want to do/i), 'Send 10 XLM to Alice');
    await user.click(screen.getByRole('button', { name: /draft intent/i }));
    await waitFor(() => expect(screen.getByTestId('ai-draft-result')).toBeInTheDocument());

    expect(onAccept).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /confirm draft/i }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith(paymentDraft.intent);
  });

  it('does not call onAccept when the user rejects the draft, and clears the form', async () => {
    const user = userEvent.setup();
    const fetcher = fakeFetch(paymentDraft);
    const onAccept = vi.fn();
    render(<AiDraftPanel accountId="GACC" onAccept={onAccept} fetcher={fetcher} />);

    await user.type(screen.getByLabelText(/describe what you want to do/i), 'Send 10 XLM to Alice');
    await user.click(screen.getByRole('button', { name: /draft intent/i }));
    await waitFor(() => expect(screen.getByTestId('ai-draft-result')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /reject/i }));

    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ai-draft-result')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/describe what you want to do/i)).toHaveValue('');
  });

  it('renders high-risk invoice drafts with the risk reasons and recipient field', async () => {
    const user = userEvent.setup();
    const fetcher = fakeFetch(highRiskInvoiceDraft);
    render(<AiDraftPanel accountId="GACC" onAccept={vi.fn()} fetcher={fetcher} />);

    await user.type(
      screen.getByLabelText(/describe what you want to do/i),
      'Invoice Alice for 50000 XLM'
    );
    await user.click(screen.getByRole('button', { name: /draft intent/i }));
    await waitFor(() => expect(screen.getByTestId('ai-draft-result')).toBeInTheDocument());

    expect(screen.getByText('invoice')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByTestId('ai-draft-risk-badge')).toHaveTextContent('high');
    expect(screen.getByText(/High-value transfer/)).toBeInTheDocument();
  });

  it('shows an error message and never renders a draft when the request fails', async () => {
    const user = userEvent.setup();
    const fetcher = fakeFetch({ error: 'Too many draft-intent requests.' }, false, 429);
    render(<AiDraftPanel accountId="GACC" onAccept={vi.fn()} fetcher={fetcher} />);

    await user.type(screen.getByLabelText(/describe what you want to do/i), 'Send 10 XLM to Alice');
    await user.click(screen.getByRole('button', { name: /draft intent/i }));

    await waitFor(() =>
      expect(screen.getByText('Too many draft-intent requests.')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('ai-draft-result')).not.toBeInTheDocument();
  });
});
