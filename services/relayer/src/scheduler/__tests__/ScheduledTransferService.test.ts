import { ScheduledTransferStore } from '../ScheduledTransferStore';
import { ScheduledTransferService } from '../ScheduledTransferService';
import { RelayService } from '../../services/relayService';

const VALID_KEY = 'a'.repeat(64);
const VALID_SIG = 'b'.repeat(128);
const ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const RECIPIENT = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function validBody(startAt: string) {
  return {
    accountAddress: ACCOUNT,
    to: RECIPIENT,
    amount: '10.5',
    asset: 'XLM',
    frequency: 'daily' as const,
    startAt,
    userApproved: true as const,
    relayPayload: {
      sessionKey: VALID_KEY,
      operation: 'relay_execute' as const,
      parameters: { to: RECIPIENT, amount: '10.5' },
      signature: VALID_SIG,
      nonce: 1,
    },
  };
}

describe('ScheduledTransferService execution safeguards', () => {
  it('does not execute the same transfer concurrently', async () => {
    const store = new ScheduledTransferStore();
    const relayService = new RelayService({ verify: () => true });
    const service = new ScheduledTransferService(store, relayService);

    const transfer = service.create(validBody(new Date().toISOString()), 'caller-a');
    expect(store.tryAcquireProcessing(transfer.id)).toBe(true);
    expect(store.tryAcquireProcessing(transfer.id)).toBe(false);
    store.releaseProcessing(transfer.id);
  });

  it('backs off recurring failures instead of hot-looping', async () => {
    const store = new ScheduledTransferStore();
    const relayService = {
      executeRelay: jest.fn().mockResolvedValue({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'bad sig' },
        gasUsed: 0,
      }),
    };
    const service = new ScheduledTransferService(store, relayService as never);
    const transfer = service.create(validBody(new Date().toISOString()), 'caller-a');

    await service.processDueTransfers(new Date());

    const updated = store.getById(transfer.id);
    expect(updated?.consecutiveFailures).toBe(1);
    expect(new Date(updated!.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    expect(service.listExecutions(transfer.id, 'caller-a')).toHaveLength(1);
  });

  it('scopes pause/cancel/get to the owning caller', () => {
    const store = new ScheduledTransferStore();
    const relayService = new RelayService({ verify: () => true });
    const service = new ScheduledTransferService(store, relayService);

    const transfer = service.create(validBody('2099-01-01T00:00:00.000Z'), 'caller-a');

    expect(service.get(transfer.id, 'caller-a')?.id).toBe(transfer.id);
    expect(service.get(transfer.id, 'caller-b')).toBeUndefined();
    expect(service.pause(transfer.id, 'caller-b')).toBeUndefined();
    expect(service.cancel(transfer.id, 'caller-b')).toBeUndefined();
  });
});
