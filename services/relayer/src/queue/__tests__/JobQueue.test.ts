import { JobQueue } from '../JobQueue';

describe('JobQueue', () => {
  let queue: JobQueue;

  beforeEach(() => {
    queue = new JobQueue();
  });

  // ── Enqueue ────────────────────────────────────────────────────────────────

  describe('enqueue', () => {
    it('creates a pending job with the supplied payload', () => {
      const job = queue.enqueue({
        idempotencyKey: 'key-1',
        type: 'relay_execute',
        payload: { foo: 'bar' },
      });

      expect(job.status).toBe('pending');
      expect(job.attempts).toBe(0);
      expect(job.payload).toEqual({ foo: 'bar' });
      expect(job.idempotencyKey).toBe('key-1');
    });

    it('suppresses duplicate jobs with the same idempotency key', () => {
      const first = queue.enqueue({ idempotencyKey: 'dup', type: 'relay_execute', payload: {} });
      const second = queue.enqueue({ idempotencyKey: 'dup', type: 'relay_execute', payload: {} });

      expect(second.id).toBe(first.id);
      expect(queue.size()).toBe(1);
    });

    it('allows re-enqueue after a job reaches terminal state (completed)', () => {
      const first = queue.enqueue({ idempotencyKey: 'done', type: 'relay_execute', payload: {} });
      const result = queue.dequeue()!;
      result.ack();

      const second = queue.enqueue({ idempotencyKey: 'done', type: 'relay_execute', payload: {} });
      expect(second.id).not.toBe(first.id);
    });

    it('allows re-enqueue after a job reaches terminal state (dead)', () => {
      queue.enqueue({
        idempotencyKey: 'dead-key',
        type: 'relay_execute',
        payload: {},
        maxAttempts: 1,
      });

      const result = queue.dequeue()!;
      result.nack(new Error('boom'));

      const second = queue.enqueue({
        idempotencyKey: 'dead-key',
        type: 'relay_execute',
        payload: {},
      });
      expect(second.status).toBe('pending');
    });
  });

  // ── Dequeue ────────────────────────────────────────────────────────────────

  describe('dequeue', () => {
    it('returns null when the queue is empty', () => {
      expect(queue.dequeue()).toBeNull();
    });

    it('transitions job to processing on dequeue', () => {
      queue.enqueue({ idempotencyKey: 'k1', type: 'relay_execute', payload: {} });
      const result = queue.dequeue()!;
      expect(result.job.status).toBe('processing');
    });

    it('does not return the same job twice before ack/nack', () => {
      queue.enqueue({ idempotencyKey: 'k1', type: 'relay_execute', payload: {} });
      queue.dequeue(); // first dequeue — job is now processing
      const second = queue.dequeue();
      expect(second).toBeNull();
    });
  });

  // ── Ack ────────────────────────────────────────────────────────────────────

  describe('ack', () => {
    it('marks the job as completed', () => {
      queue.enqueue({ idempotencyKey: 'k1', type: 'relay_execute', payload: {} });
      const result = queue.dequeue()!;
      result.ack();

      const job = queue.getById(result.job.id)!;
      expect(job.status).toBe('completed');
    });
  });

  // ── Nack / retry ──────────────────────────────────────────────────────────

  describe('nack', () => {
    it('increments attempts and re-queues as pending on failure', () => {
      queue.enqueue({
        idempotencyKey: 'k1',
        type: 'relay_execute',
        payload: {},
        maxAttempts: 3,
      });
      const result = queue.dequeue()!;
      result.nack(new Error('transient'));

      const job = queue.getById(result.job.id)!;
      expect(job.status).toBe('pending');
      expect(job.attempts).toBe(1);
      expect(job.lastError).toBe('transient');
    });

    it('moves job to dead-letter when maxAttempts is reached', () => {
      queue.enqueue({
        idempotencyKey: 'k1',
        type: 'relay_execute',
        payload: {},
        maxAttempts: 1,
      });
      const result = queue.dequeue()!;
      result.nack(new Error('fatal'));

      const job = queue.getById(result.job.id)!;
      expect(job.status).toBe('dead');
      expect(job.attempts).toBe(1);
    });

    it('records the last error message on dead-letter', () => {
      queue.enqueue({
        idempotencyKey: 'k1',
        type: 'relay_execute',
        payload: {},
        maxAttempts: 1,
      });
      const result = queue.dequeue()!;
      result.nack(new Error('something went wrong'));

      const job = queue.getById(result.job.id)!;
      expect(job.lastError).toBe('something went wrong');
    });

    it('exhausts retries across multiple dequeue cycles', () => {
      queue.enqueue({
        idempotencyKey: 'k1',
        type: 'relay_execute',
        payload: {},
        maxAttempts: 3,
      });

      for (let i = 0; i < 2; i++) {
        // Force retryAfter to be in the past so the job is immediately eligible
        const job = queue.getByIdempotencyKey('k1')!;
        // Patch retryAfter via re-enqueue trick: directly manipulate via getById
        const stored = queue.getById(job.id) as unknown as Record<string, unknown>;
        stored['retryAfter'] = new Date(0).toISOString();

        const r = queue.dequeue()!;
        r.nack(new Error(`attempt ${i + 1}`));
      }

      // Third attempt — should go dead
      const job = queue.getByIdempotencyKey('k1')!;
      const stored = queue.getById(job.id) as unknown as Record<string, unknown>;
      stored['retryAfter'] = new Date(0).toISOString();

      const last = queue.dequeue()!;
      last.nack(new Error('final'));

      expect(queue.getById(last.job.id)!.status).toBe('dead');
    });
  });

  // ── Dead-letter ────────────────────────────────────────────────────────────

  describe('getDeadLetterJobs', () => {
    it('returns all dead jobs', () => {
      queue.enqueue({ idempotencyKey: 'a', type: 'relay_execute', payload: {}, maxAttempts: 1 });
      queue.enqueue({ idempotencyKey: 'b', type: 'relay_execute', payload: {}, maxAttempts: 1 });

      queue.dequeue()!.nack(new Error('x'));
      queue.dequeue()!.nack(new Error('y'));

      expect(queue.getDeadLetterJobs()).toHaveLength(2);
    });
  });
});
