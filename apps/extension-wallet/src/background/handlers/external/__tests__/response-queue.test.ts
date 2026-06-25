/**
 * Unit tests for response queue
 */

import {
  enqueueApproval,
  getApproval,
  removeApproval,
  getAllApprovals,
  clearApprovals,
  registerResponseCallbacks,
  resolveRequest,
  rejectRequest,
  clearResponseCallbacks,
  getSessionEntry,
} from '../response-queue';

// ── chrome.storage.session mock ───────────────────────────────────────────────

const sessionStore: Record<string, unknown> = {};
const mockSession = {
  set: vi.fn((data: Record<string, unknown>, _cb?: () => void) => {
    Object.assign(sessionStore, data);
  }),
  get: vi.fn((key: string, cb: (result: Record<string, unknown>) => void) => {
    cb({ [key]: sessionStore[key] });
  }),
  remove: vi.fn((key: string) => {
    delete sessionStore[key];
  }),
};

// Re-set globalThis.chrome in beforeEach because vitest.setup.ts deletes it
// before every test to prevent leakage between files.
beforeEach(() => {
  (globalThis as any).chrome = { storage: { session: mockSession } };
  Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
  mockSession.set.mockClear();
  mockSession.get.mockClear();
  mockSession.remove.mockClear();
});

describe('response queue', () => {
  beforeEach(() => {
    clearApprovals();
    clearResponseCallbacks();
  });

  describe('approval queue', () => {
    describe('enqueueApproval', () => {
      it('enqueues a request for approval', () => {
        enqueueApproval('123', 'https://example.com', 'signTransaction', { xdr: 'test' });

        const approval = getApproval('123');
        expect(approval).toEqual({
          requestId: '123',
          origin: 'https://example.com',
          method: 'signTransaction',
          params: { xdr: 'test' },
          timestamp: expect.any(Number),
        });
      });

      it('replaces existing approval with same requestId', () => {
        enqueueApproval('123', 'https://example.com', 'signTransaction', { xdr: 'test1' });
        enqueueApproval('123', 'https://example.com', 'signTransaction', { xdr: 'test2' });

        const approval = getApproval('123');
        expect(approval?.params).toEqual({ xdr: 'test2' });
      });
    });

    describe('getApproval', () => {
      it('returns approval for existing requestId', () => {
        enqueueApproval('123', 'https://example.com', 'signTransaction', { xdr: 'test' });

        const approval = getApproval('123');
        expect(approval).toBeDefined();
      });

      it('returns undefined for non-existent requestId', () => {
        const approval = getApproval('123');
        expect(approval).toBeUndefined();
      });
    });

    describe('removeApproval', () => {
      it('removes an approval', () => {
        enqueueApproval('123', 'https://example.com', 'signTransaction', { xdr: 'test' });
        removeApproval('123');

        const approval = getApproval('123');
        expect(approval).toBeUndefined();
      });

      it('handles removing non-existent approval', () => {
        expect(() => removeApproval('123')).not.toThrow();
      });
    });

    describe('getAllApprovals', () => {
      it('returns all pending approvals', () => {
        enqueueApproval('123', 'https://example.com', 'signTransaction', { xdr: 'test1' });
        enqueueApproval('456', 'https://other.com', 'signTransaction', { xdr: 'test2' });

        const approvals = getAllApprovals();
        expect(approvals).toHaveLength(2);
      });

      it('returns empty array when no approvals', () => {
        const approvals = getAllApprovals();
        expect(approvals).toEqual([]);
      });
    });

    describe('clearApprovals', () => {
      it('clears all approvals', () => {
        enqueueApproval('123', 'https://example.com', 'signTransaction', { xdr: 'test' });
        clearApprovals();

        const approvals = getAllApprovals();
        expect(approvals).toEqual([]);
      });
    });
  });

  describe('response callbacks', () => {
    describe('registerResponseCallbacks', () => {
      it('registers resolve and reject callbacks', async () => {
        let resolved = false;
        let rejected = false;

        registerResponseCallbacks(
          '123',
          () => {
            resolved = true;
          },
          () => {
            rejected = true;
          }
        );

        resolveRequest('123', { result: 'test' });

        expect(resolved).toBe(true);
        expect(rejected).toBe(false);
      });

      it('replaces existing callbacks for same requestId', async () => {
        let resolved1 = false;
        let resolved2 = false;

        registerResponseCallbacks(
          '123',
          () => {
            resolved1 = true;
          },
          () => {}
        );
        registerResponseCallbacks(
          '123',
          () => {
            resolved2 = true;
          },
          () => {}
        );

        resolveRequest('123', { result: 'test' });

        expect(resolved1).toBe(false);
        expect(resolved2).toBe(true);
      });
    });

    describe('resolveRequest', () => {
      it('resolves a request with result', async () => {
        let result: unknown;

        registerResponseCallbacks(
          '123',
          (value) => {
            result = value;
          },
          () => {}
        );

        resolveRequest('123', { result: 'test' });

        expect(result).toEqual({ result: 'test' });
      });

      it('removes callbacks after resolving', async () => {
        registerResponseCallbacks(
          '123',
          () => {},
          () => {}
        );
        resolveRequest('123', { result: 'test' });

        // Should not throw when resolving again
        resolveRequest('123', { result: 'test2' });
      });

      it('handles resolving non-existent request', () => {
        expect(() => resolveRequest('123', { result: 'test' })).not.toThrow();
      });
    });

    describe('rejectRequest', () => {
      it('rejects a request with error', async () => {
        let error: Error | null = null;

        registerResponseCallbacks(
          '123',
          () => {},
          (err) => {
            error = err;
          }
        );

        rejectRequest('123', new Error('Test error'));

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('Test error');
      });

      it('removes callbacks after rejecting', async () => {
        registerResponseCallbacks(
          '123',
          () => {},
          () => {}
        );
        rejectRequest('123', new Error('Test error'));

        // Should not throw when rejecting again
        rejectRequest('123', new Error('Test error 2'));
      });

      it('handles rejecting non-existent request', () => {
        expect(() => rejectRequest('123', new Error('Test error'))).not.toThrow();
      });
    });

    describe('clearResponseCallbacks', () => {
      it('clears all response callbacks', () => {
        registerResponseCallbacks(
          '123',
          () => {},
          () => {}
        );
        registerResponseCallbacks(
          '456',
          () => {},
          () => {}
        );

        clearResponseCallbacks();

        // Should not throw when resolving after clear
        resolveRequest('123', { result: 'test' });
        resolveRequest('456', { result: 'test' });
      });
    });
  });

  // ── Session storage (chrome.storage.session) ────────────────────────────────

  describe('session storage', () => {
    it('enqueueApproval writes pending status to session storage', () => {
      enqueueApproval('req-1', 'https://dapp.example', 'signTransaction', {});

      expect(mockSession.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'req-1': expect.objectContaining({ requestId: 'req-1', status: 'pending' }),
        })
      );
    });

    it('resolveRequest updates session entry to resolved', async () => {
      registerResponseCallbacks(
        'req-2',
        () => {},
        () => {}
      );
      resolveRequest('req-2', { signedXdr: 'abc' });

      const entry = await getSessionEntry('req-2');
      expect(entry).toEqual(
        expect.objectContaining({
          requestId: 'req-2',
          status: 'resolved',
          result: { signedXdr: 'abc' },
        })
      );
    });

    it('rejectRequest updates session entry to rejected with error message', async () => {
      registerResponseCallbacks(
        'req-3',
        () => {},
        () => {}
      );
      rejectRequest('req-3', new Error('user rejected'));

      const entry = await getSessionEntry('req-3');
      expect(entry).toEqual(
        expect.objectContaining({ requestId: 'req-3', status: 'rejected', error: 'user rejected' })
      );
    });

    it('getSessionEntry returns null for unknown requestId', async () => {
      const entry = await getSessionEntry('no-such-id');
      expect(entry).toBeNull();
    });
  });
});
