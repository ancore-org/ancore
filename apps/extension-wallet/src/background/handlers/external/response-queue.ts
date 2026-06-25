/**
 * Response Queue
 *
 * Manages pending approval requests that require user interaction.
 * Stores requests by requestId and resolves them when the popup responds.
 */

import type { ApprovalQueueEntry } from '@ancore/types';

const pendingApprovals = new Map<string, ApprovalQueueEntry>();

/**
 * Enqueue a request for user approval.
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
 */
export function resolveRequest(requestId: string, result: unknown): void {
  const callbacks = responseCallbacks.get(requestId);
  if (callbacks) {
    callbacks.resolve(result);
    responseCallbacks.delete(requestId);
  }
}

/**
 * Reject a request with an error.
 */
export function rejectRequest(requestId: string, error: Error): void {
  const callbacks = responseCallbacks.get(requestId);
  if (callbacks) {
    callbacks.reject(error);
    responseCallbacks.delete(requestId);
  }
}

/**
 * Clear all response callbacks (for testing).
 */
export function clearResponseCallbacks(): void {
  responseCallbacks.clear();
}
