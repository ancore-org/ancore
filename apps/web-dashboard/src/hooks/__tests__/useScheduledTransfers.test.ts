import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ScheduledTransfer,
  ScheduledTransferExecutionLog,
} from '@ancore/types';

vi.mock('../../auth', () => ({
  useDashboardAuth: () => ({
    session: { accessToken: 'test-token' },
  }),
}));

vi.mock('../../services/scheduler-client', () => ({
  createSchedulerClient: vi.fn(),
  DEMO_ACCOUNT_ADDRESS: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
}));

const sampleTransfer: ScheduledTransfer = {
  id: '11111111-1111-1111-1111-111111111111',
  accountId: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  callerId: 'dashboard-user',
  to: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
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
  transactionId: 'ABCDEF',
};

describe('useScheduledTransfers', () => {
  it('loads transfers and execution logs from the scheduler client', async () => {
    const client = {
      createScheduledTransfer: vi.fn(),
      listScheduledTransfers: vi.fn().mockResolvedValue([sampleTransfer]),
      getScheduledTransfer: vi.fn(),
      pauseScheduledTransfer: vi.fn(),
      cancelScheduledTransfer: vi.fn(),
      listExecutions: vi.fn().mockResolvedValue([sampleExecution]),
    };

    const { useScheduledTransfers } = await import('../useScheduledTransfers');
    const { result } = renderHook(() =>
      useScheduledTransfers({ client, refreshIntervalMs: 60_000 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.transfers).toHaveLength(1);
    expect(result.current.executions[sampleTransfer.id]).toHaveLength(1);
    expect(client.listScheduledTransfers).toHaveBeenCalled();
    expect(client.listExecutions).toHaveBeenCalledWith(sampleTransfer.id);
  });
});
