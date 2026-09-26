/**
 * Response Queue
 *
 * Manages pending approval requests that require user interaction.
 * Stores requests by requestId and resolves them when the popup responds.
 */

import type { ApprovalQueueEntry } from '@ancore/types';

// ── Session storage helpers ───────────────────────────────────────────────────
// Entries are written to chrome.storage.session so content scripts can poll for
// results without holding an open runtime.sendMessage port (which would time out
// during long-lived approval flows). Lost on extension restart is acceptable —
// pending requests should not survive a service-worker lifecycle event.

export interface SessionQueueEntry {
  requestId: string;
  status: 'pending' | 'resolved' | 'rejected' | 'timed-out';
  result?: unknown;
  error?: string;
}

function getChromeSession(): chrome['storage']['session'] | null {
  const chromeRef = (globalThis as { chrome?: typeof chrome }).chrome;
  return chromeRef?.storage?.session ?? null;
}

export function writeSessionEntry(entry: SessionQueueEntry): void {
  const session = getChromeSession();
  if (session) {
    session.set({ [entry.requestId]: entry }, () => {
      const lastError = (globalThis as { chrome?: typeof chrome }).chrome?.runtime?.lastError;
      if (lastError) {
        console.error(
          `chrome.storage.session.set failed for ${entry.requestId}:`,
          lastError.message ?? lastError
        );
      }
    });
  }
}

export function getSessionEntry(requestId: string): Promise<SessionQueueEntry | null> {
  return new Promise((resolve) => {
    const session = getChromeSession();
    if (!session) {
      resolve(null);
      return;
    }
    session.get(requestId, (result: Record<string, unknown>) => {
      const lastError = (globalThis as { chrome?: typeof chrome }).chrome?.runtime?.lastError;
      if (lastError) {
        console.error(
          `chrome.storage.session.get failed for ${requestId}:`,
          lastError.message ?? lastError
        );
        resolve(null);
        return;
      }
      const entry = result ? result[requestId] : undefined;
      resolve((entry as SessionQueueEntry | undefined) ?? null);
    });
  });
}

export function clearSessionEntry(requestId: string): void {
  const session = getChromeSession();
  if (session) {
    session.remove(requestId, () => {
      const lastError = (globalThis as { chrome?: typeof chrome }).chrome?.runtime?.lastError;
      if (lastError) {
        console.error(
          `chrome.storage.session.remove failed for ${requestId}:`,
          lastError.message ?? lastError
        );
      }
    });
  }
}

export const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000;

// ── Approval queue (in-memory + session-persisted) ───────────────────────────

const pendingApprovals = new Map<string, ApprovalQueueEntry>();

/**
 * Enqueue a request for user approval.
 * Also writes a `{ status: 'pending' }` entry to chrome.storage.session so
 * content scripts can poll for the result without a long-lived message port.
 */
export function enqueueApproval(
  requestId: string,
  origin: string,
  method: string,
  params: unknown
): void {
  sweepStaleRequests();
  const entry: ApprovalQueueEntry = {
    requestId,
    origin,
    method: method as any,
    params,
    timestamp: Date.now(),
  };
  pendingApprovals.set(requestId, entry);
  writeSessionEntry({ requestId, status: 'pending' });
}

/**
 * Get a pending approval by requestId.
 */
export function getApproval(requestId: string): ApprovalQueueEntry | undefined {
  return pendingApprovals.get(requestId);
}

/**
 * Remove a pending approval (after user responds).
 */
export function removeApproval(requestId: string): void {
  pendingApprovals.delete(requestId);
}

/**
 * Get all pending approvals.
 */
export function getAllApprovals(): ApprovalQueueEntry[] {
  return Array.from(pendingApprovals.values());
}

/**
 * Clear all pending approvals (for testing).
 */
export function clearApprovals(): void {
  pendingApprovals.clear();
}

/**
 * Resolve map for async request/response pattern.
 * Stores resolve/reject functions for pending requests with a creation timestamp.
 */
interface ResponseCallbackEntry {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

const responseCallbacks = new Map<string, ResponseCallbackEntry>();

/**
 * Register callbacks for a request.
 */
export function registerResponseCallbacks(
  requestId: string,
  resolve: (value: unknown) => void,
  reject: (error: Error) => void
): void {
  sweepStaleRequests();
  responseCallbacks.set(requestId, { resolve, reject, timestamp: Date.now() });
}

/**
 * Sweeps and rejects any pending approvals or response callbacks older than ttlMs.
 * Returns the number of stale entries cleaned up.
 */
export function sweepStaleRequests(ttlMs: number = DEFAULT_APPROVAL_TTL_MS): number {
  const now = Date.now();
  const staleIds = new Set<string>();

  for (const [requestId, entry] of pendingApprovals.entries()) {
    if (now - entry.timestamp > ttlMs) {
      staleIds.add(requestId);
    }
  }

  for (const [requestId, entry] of responseCallbacks.entries()) {
    if (now - entry.timestamp > ttlMs) {
      staleIds.add(requestId);
    }
  }

  for (const requestId of staleIds) {
    rejectRequest(requestId, new Error('Approval request timed out'));
  }

  return staleIds.size;
}

/**
 * Resolve a request with a result.
 * Updates the chrome.storage.session entry to `{ status: 'resolved', result }`
 * so polling content scripts can detect completion.
 */
export function resolveRequest(requestId: string, result: unknown): void {
  const callbacks = responseCallbacks.get(requestId);
  if (callbacks) {
    callbacks.resolve(result);
    responseCallbacks.delete(requestId);
  }
  removeApproval(requestId);
  writeSessionEntry({ requestId, status: 'resolved', result });
}

/**
 * Reject a request with an error.
 * Updates the chrome.storage.session entry to `{ status: 'rejected', error }`
 * so polling content scripts can detect rejection.
 */
export function rejectRequest(requestId: string, error: Error): void {
  const callbacks = responseCallbacks.get(requestId);
  if (callbacks) {
    callbacks.reject(error);
    responseCallbacks.delete(requestId);
  }
  removeApproval(requestId);
  writeSessionEntry({ requestId, status: 'rejected', error: error.message });
}

/**
 * Clear all response callbacks (for testing).
 */
export function clearResponseCallbacks(): void {
  responseCallbacks.clear();
}
