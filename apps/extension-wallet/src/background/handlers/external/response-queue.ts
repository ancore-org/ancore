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
  status: 'pending' | 'resolved' | 'rejected';
  result?: unknown;
  error?: string;
}

function getChromeSession(): chrome['storage']['session'] | null {
  const chromeRef = (globalThis as { chrome?: typeof chrome }).chrome;
  return chromeRef?.storage?.session ?? null;
}

function writeSessionEntry(entry: SessionQueueEntry): void {
  const session = getChromeSession();
  if (session) {
    session.set({ [entry.requestId]: entry });
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
      const entry = result[requestId];
      resolve((entry as SessionQueueEntry | undefined) ?? null);
    });
  });
}

export function clearSessionEntry(requestId: string): void {
  const session = getChromeSession();
  if (session) {
    session.remove(requestId);
  }
}

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
 * Stores resolve/reject functions for pending requests.
 */
const responseCallbacks = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

/**
 * Register callbacks for a request.
 */
export function registerResponseCallbacks(
  requestId: string,
  resolve: (value: unknown) => void,
  reject: (error: Error) => void
): void {
  responseCallbacks.set(requestId, { resolve, reject });
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
  writeSessionEntry({ requestId, status: 'rejected', error: error.message });
}

/**
 * Clear all response callbacks (for testing).
 */
export function clearResponseCallbacks(): void {
  responseCallbacks.clear();
}
