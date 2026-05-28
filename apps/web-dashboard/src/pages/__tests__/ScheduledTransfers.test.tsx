import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ScheduledTransfer,
  ScheduledTransferExecutionLog,
} from '@ancore/types';
import { ScheduledTransfersPage } from '../ScheduledTransfers';

const sampleTransfer: ScheduledTransfer = {
  id: '11111111-1111-1111-1111-111111111111',
  accountId: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  callerId: 'dashboard-user',
  to: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  amount: '12',
  asset: 'XLM',
  frequency: 'once',
  status: 'active',
  startAt: '2099-01-01T00:00:00.000Z',
  nextRunAt: '2099-01-01T00:00:00.000Z',
  userApprovedAt: '2099-01-01T00:00:00.000Z',
  relayPayload: {
    sessionKey: 'a'.repeat(64),
    operation: 'relay_execute',
    parameters: {},
    signature: 'b'.repeat(128),
    nonce: 1,
  },
  consecutiveFailures: 0,
  createdAt: '2099-01-01T00:00:00.000Z',
  updatedAt: '2099-01-01T00:00:00.000Z',
};

const sampleExecution: ScheduledTransferExecutionLog = {
  id: '22222222-2222-2222-2222-222222222222',
  scheduledTransferId: sampleTransfer.id,
  executedAt: '2099-01-02T00:00:00.000Z',
  outcome: 'success',
  transactionId: 'ABCDEF1234567890',
};

const mockHook = vi.fn();

vi.mock('../../hooks/useScheduledTransfers', () => ({
  useScheduledTransfers: () => mockHook(),
}));

vi.mock('@ancore/ui-kit', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock('../../services/scheduler-client', () => ({
  SCHEDULE_FREQUENCY_OPTIONS: [
    { value: 'once', label: 'One-time' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ],
}));

describe('ScheduledTransfersPage', () => {
  beforeEach(() => {
    mockHook.mockReturnValue({
      transfers: [sampleTransfer],
      executions: { [sampleTransfer.id]: [sampleExecution] },
      loading: false,
      error: null,
      submitting: false,
      refresh: vi.fn(),
      createTransfer: vi.fn(),
      pauseTransfer: vi.fn(),
      cancelTransfer: vi.fn(),
    });
  });

  it('renders scheduled jobs and execution history', () => {
    render(<ScheduledTransfersPage />);

    expect(screen.getByText(/12 XLM/)).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('Execution history')).toBeInTheDocument();
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it('requires explicit approval before creating a transfer', async () => {
    const user = userEvent.setup();
    mockHook.mockReturnValue({
      transfers: [],
      executions: {},
      loading: false,
      error: null,
      submitting: false,
      refresh: vi.fn(),
      createTransfer: vi.fn(),
      pauseTransfer: vi.fn(),
      cancelTransfer: vi.fn(),
    });

    render(<ScheduledTransfersPage />);

    const submit = screen.getByRole('button', { name: 'Create scheduled transfer' });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
  });
});
