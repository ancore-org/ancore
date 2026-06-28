import type { DraftIntentResponse } from './types';

/**
 * GUARDRAIL: The AI agent MUST NOT execute any financial operation autonomously.
 *
 * All outputs are drafts that require explicit user confirmation before any
 * on-chain or off-chain action is taken. This function enforces that invariant
 * by asserting the response is always in "draft" status with requiresConfirmation=true.
 *
 * @throws {Error} if the response violates the no-autonomous-execution policy
 */
export function enforceNoAutonomousExecution(response: DraftIntentResponse): void {
  if (response.status !== 'draft') {
    throw new Error(
      `GUARDRAIL VIOLATION: response status must be "draft", got "${response.status}"`
    );
  }
  if (response.requiresConfirmation !== true) {
    throw new Error(
      'GUARDRAIL VIOLATION: requiresConfirmation must be true — the agent never executes autonomously'
    );
  }
}
