import { JobQueue } from '../../queue/JobQueue';
import { QueueWorker } from '../QueueWorker';
import type { Job } from '../../queue/types';

/** Resolves after `ms` milliseconds */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('QueueWorker', () => {
  let queue: JobQueue;

  beforeEach(() => {
    queue = new JobQueue();
  });

  it('processes a job and calls ack on success', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const worker = new QueueWorker(queue, { relay_execute: handler }, { pollIntervalMs: 10 });

    queue.enqueue({ idempotencyKey: 'k1', type: 'relay_execute', payload: { x: 1 } });

    worker.start();
    await delay(100);
    await worker.stop();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(worker.stats.succeeded).toBe(1);
    expect(worker.stats.failed).toBe(0);

    const job = queue.getByIdempotencyKey('k1')!;
    expect(job.status).toBe('completed');
  });

  it('calls nack and retries on handler failure', async () => {
    let callCount = 0;
    const handler = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) throw new Error('transient');
    });

    const worker = new QueueWorker(queue, { relay_execute: handler }, { pollIntervalMs: 10 });

    queue.enqueue({
      idempotencyKey: 'k1',
      type: 'relay_execute',
      payload: {},
      maxAttempts: 5,
    });

    worker.start();

    // Allow multiple poll cycles; patch retryAfter between cycles
    for (let i = 0; i < 5; i++) {
      await delay(30);
      const job = queue.getByIdempotencyKey('k1');
      if (job && job.retryAfter) {
        // Fast-forward retryAfter so the job is immediately eligible
        (queue.getById(job.id) as unknown as Record<string, unknown>)['retryAfter'] =
          new Date(0).toISOString();
      }
    }

    await worker.stop();

    expect(handler.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(queue.getByIdempotencyKey('k1')!.status).toBe('completed');
  });

  it('moves job to dead-letter after maxAttempts failures', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('always fails'));
    const worker = new QueueWorker(queue, { relay_execute: handler }, { pollIntervalMs: 10 });

    queue.enqueue({
      idempotencyKey: 'k1',
      type: 'relay_execute',
      payload: {},
      maxAttempts: 2,
    });

    worker.start();

    for (let i = 0; i < 4; i++) {
      await delay(30);
      const job = queue.getByIdempotencyKey('k1');
      if (job?.retryAfter) {
        (queue.getById(job.id) as unknown as Record<string, unknown>)['retryAfter'] =
          new Date(0).toISOString();
      }
    }

    await worker.stop();

    const job = queue.getByIdempotencyKey('k1')!;
    expect(job.status).toBe('dead');
    expect(worker.stats.deadLettered).toBeGreaterThanOrEqual(1);
  });

  it('does not process a job type with no registered handler', async () => {
    const worker = new QueueWorker(queue, {}, { pollIntervalMs: 10 });

    queue.enqueue({ idempotencyKey: 'k1', type: 'relay_execute', payload: {}, maxAttempts: 1 });

    worker.start();
    await delay(50);
    const job = queue.getByIdempotencyKey('k1');
    if (job?.retryAfter) {
      (queue.getById(job.id) as unknown as Record<string, unknown>)['retryAfter'] =
        new Date(0).toISOString();
    }
    await delay(50);
    await worker.stop();

    // No handler → nack → dead after maxAttempts=1
    expect(queue.getByIdempotencyKey('k1')!.status).toBe('dead');
    expect(worker.stats.failed).toBeGreaterThanOrEqual(1);
  });

  it('suppresses duplicate jobs via idempotency key', () => {
    const first = queue.enqueue({ idempotencyKey: 'dup', type: 'relay_execute', payload: {} });
    const second = queue.enqueue({ idempotencyKey: 'dup', type: 'relay_execute', payload: {} });
    expect(second.id).toBe(first.id);
    expect(queue.size()).toBe(1);
  });

  it('stops cleanly without processing when no jobs are enqueued', async () => {
    const worker = new QueueWorker(queue, {}, { pollIntervalMs: 10 });
    worker.start();
    await delay(30);
    await worker.stop();
    expect(worker.stats.processed).toBe(0);
  });

  it('passes the full job object to the handler', async () => {
    let receivedJob: Job | undefined;
    const handler = jest.fn().mockImplementation(async (job: Job) => {
      receivedJob = job;
    });

    const worker = new QueueWorker(queue, { relay_execute: handler }, { pollIntervalMs: 10 });
    queue.enqueue({ idempotencyKey: 'k1', type: 'relay_execute', payload: { amount: 42 } });

    worker.start();
    await delay(100);
    await worker.stop();

    expect(receivedJob?.payload).toEqual({ amount: 42 });
    expect(receivedJob?.type).toBe('relay_execute');
  });
});
