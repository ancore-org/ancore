/**
 * Runtime type guards for custom types in this package.
 */

import { SmartAccount } from './smart-account';
import { SessionKey } from './session-key';
import { UserOperation, TransactionResult } from './user-operation';
import { WalletState } from './wallet';
import { Invoice, InvoiceSchema } from './invoice';
import { TransferPolicy, TransferPolicySchema } from './transfer-policy';
import { ScheduledTransfer, ScheduledTransferSchema } from './scheduled-transfer';
import { SessionKeyPolicy, SessionKeyPolicySchema } from './session-key-policy';
import { StatementRow } from './statement';

export function isSmartAccount(value: unknown): value is SmartAccount {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.publicKey === 'string' &&
    typeof v.contractId === 'string' &&
    typeof v.nonce === 'number'
  );
}

export function isSessionKey(value: unknown): value is SessionKey {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.publicKey === 'string' &&
    Array.isArray(v.permissions) &&
    typeof v.expiresAt === 'number'
  );
}

export function isValidPermission(value: unknown): boolean {
  if (typeof value !== 'number') return false;
  return [0, 1, 2].includes(value);
}

/**
 * Type guard for UserOperation.
 */
export function isUserOperation(value: unknown): value is UserOperation {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.type === 'string' &&
    typeof v.operation === 'object' &&
    v.operation !== null &&
    typeof v.createdAt === 'number'
  );
}

/**
 * Type guard for TransactionResult.
 */
export function isTransactionResult(value: unknown): value is TransactionResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.status === 'string' &&
    ['success', 'failure', 'pending'].includes(v.status as string) &&
    typeof v.timestamp === 'number' &&
    (v.hash === undefined || typeof v.hash === 'string') &&
    (v.ledger === undefined || typeof v.ledger === 'number') &&
    (v.error === undefined || typeof v.error === 'string')
  );
}

/**
 * Type guard for WalletState.
 */
export function isWalletState(value: unknown): value is WalletState {
  return typeof value === 'string' && ['uninitialized', 'locked', 'unlocked'].includes(value);
}

/**
 * Type guard for Invoice.
 */
export function isInvoice(value: unknown): value is Invoice {
  return InvoiceSchema.safeParse(value).success;
}

/**
 * Type guard for TransferPolicy.
 */
export function isTransferPolicy(value: unknown): value is TransferPolicy {
  return TransferPolicySchema.safeParse(value).success;
}

/**
 * Type guard for ScheduledTransfer.
 */
export function isScheduledTransfer(value: unknown): value is ScheduledTransfer {
  return ScheduledTransferSchema.safeParse(value).success;
}

/**
 * Type guard for SessionKeyPolicy.
 */
export function isSessionKeyPolicy(value: unknown): value is SessionKeyPolicy {
  return SessionKeyPolicySchema.safeParse(value).success;
}

/**
 * Type guard for StatementRow.
 * StatementRow has no Zod schema, so we check the shape manually.
 */
export function isStatementRow(value: unknown): value is StatementRow {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.date === 'string' &&
    typeof v.type === 'string' &&
    typeof v.amount === 'string' &&
    typeof v.asset === 'string' &&
    typeof v.status === 'string' &&
    ['completed', 'pending', 'failed', 'unknown'].includes(v.status as string)
  );
}
