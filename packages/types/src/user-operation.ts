/**
 * User operation types for smart account transactions.
 * Represents an operation to be executed via the Soroban contract.
 */

import { z } from 'zod';
import { Operation } from '@stellar/stellar-sdk';

/**
 * UserOperation represents a smart account operation to be executed via the contract.
 * This is the primary abstraction for operations within the account abstraction layer.
 *
 * Fields:
 * - `id`: Unique identifier for this operation
 * - `type`: Operation type (e.g., 'payment', 'invoke', 'manage_data')
 * - `operation`: The underlying Stellar Operation object
 * - `gasLimit`: Maximum gas units to consume (for future use with fee abstraction)
 * - `createdAt`: Unix timestamp (ms) when the operation was created
 */
export interface UserOperation {
  id: string;
  type: string;
  operation: Operation;
  gasLimit?: number;
  createdAt: number;
}

/**
 * TransactionResult represents the result of submitting a transaction.
 * Contains status, hash, ledger, and optional error information.
 *
 * Fields:
 * - `status`: Result status ('success', 'failure', 'pending')
 * - `hash`: Transaction hash (if available)
 * - `ledger`: Ledger sequence number (if confirmed)
 * - `error`: Error message (if failed)
 * - `timestamp`: Unix timestamp (ms) when the result was recorded
 */
export interface TransactionResult {
  status: 'success' | 'failure' | 'pending';
  hash?: string;
  ledger?: number;
  error?: string;
  timestamp: number;
}

/**
 * Strict Zod schema for UserOperation validation.
 * Ensures all required fields are present and correctly typed.
 */
export const UserOperationSchema = z.object({
  id: z
    .string()
    .min(1, 'Operation ID must not be empty')
    .describe('Unique identifier for the operation'),
  type: z
    .string()
    .min(1, 'Operation type must not be empty')
    .describe('Operation type (e.g., payment, invoke, manage_data)'),
  operation: z.object({}).passthrough().describe('Stellar Operation object'),
  gasLimit: z
    .number()
    .int('Gas limit must be an integer')
    .positive('Gas limit must be positive')
    .optional()
    .describe('Maximum gas units to consume'),
  createdAt: z
    .number()
    .int('Timestamp must be an integer')
    .nonnegative('Timestamp must be non-negative')
    .describe('Unix timestamp (ms) when operation was created'),
});

/**
 * Strict Zod schema for TransactionResult validation.
 */
export const TransactionResultSchema = z.object({
  status: z
    .enum(['success', 'failure', 'pending'], {
      errorMap: () => ({
        message: 'Status must be one of: success, failure, pending',
      }),
    })
    .describe('Transaction result status'),
  hash: z.string().optional().describe('Transaction hash on Stellar network'),
  ledger: z
    .number()
    .int('Ledger must be an integer')
    .positive('Ledger must be positive')
    .optional()
    .describe('Ledger sequence number where transaction was confirmed'),
  error: z.string().optional().describe('Error message if transaction failed'),
  timestamp: z
    .number()
    .int('Timestamp must be an integer')
    .nonnegative('Timestamp must be non-negative')
    .describe('Unix timestamp (ms) when result was recorded'),
});

/**
 * Type inferred from UserOperationSchema for use across SDK and extensions.
 */
export type UserOperationFromSchema = z.infer<typeof UserOperationSchema>;

/**
 * Type inferred from TransactionResultSchema for use across SDK and extensions.
 */
export type TransactionResultFromSchema = z.infer<typeof TransactionResultSchema>;

/**
 * Safe parser wrapper for UserOperation validation.
 * Returns validation result with detailed error messages.
 *
 * @example
 * const result = parseUserOperation(data);
 * if (result.success) {
 *   console.log('Valid operation:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error.issues);
 * }
 */
export function parseUserOperation(data: unknown) {
  return UserOperationSchema.safeParse(data);
}

/**
 * Safe parser wrapper for TransactionResult validation.
 */
export function parseTransactionResult(data: unknown) {
  return TransactionResultSchema.safeParse(data);
}
