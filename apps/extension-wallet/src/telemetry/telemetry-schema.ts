/**
 * Telemetry Event Schema
 *
 * Defines privacy-safe telemetry events for wallet operations.
 * All events exclude sensitive data (private keys, addresses, payloads).
 */

export enum TelemetryEventType {
  LOCK_FAILURE = 'wallet_lock_failure',
  AUTH_FAILURE = 'wallet_auth_failure',
  SEND_FAILURE = 'wallet_send_failure',
  EXECUTE_FAILURE = 'wallet_execute_failure',
  TRANSACTION_INITIATED = 'wallet_tx_initiated',
  TRANSACTION_COMPLETED = 'wallet_tx_completed',
}

export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: string;
  sessionId: string;
  errorCode?: string;
  errorCategory?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface LockFailureEvent extends TelemetryEvent {
  type: TelemetryEventType.LOCK_FAILURE;
  failureReason: 'timeout' | 'invalid_password' | 'unknown';
}

export interface AuthFailureEvent extends TelemetryEvent {
  type: TelemetryEventType.AUTH_FAILURE;
  authType: 'signature' | 'permissions' | 'session';
  failureReason: string;
}

export interface SendFailureEvent extends TelemetryEvent {
  type: TelemetryEventType.SEND_FAILURE;
  failureStage: 'validation' | 'signing' | 'broadcast';
}

export interface ExecuteFailureEvent extends TelemetryEvent {
  type: TelemetryEventType.EXECUTE_FAILURE;
  failureStage: 'validation' | 'simulation' | 'execution';
}

export interface TransactionInitiatedEvent extends TelemetryEvent {
  type: TelemetryEventType.TRANSACTION_INITIATED;
  operationType: 'send' | 'contract_call' | 'session_creation';
}

export interface TransactionCompletedEvent extends TelemetryEvent {
  type: TelemetryEventType.TRANSACTION_COMPLETED;
  operationType: 'send' | 'contract_call' | 'session_creation';
  success: boolean;
  duration: number;
}

export type AnyTelemetryEvent =
  | LockFailureEvent
  | AuthFailureEvent
  | SendFailureEvent
  | ExecuteFailureEvent
  | TransactionInitiatedEvent
  | TransactionCompletedEvent;
