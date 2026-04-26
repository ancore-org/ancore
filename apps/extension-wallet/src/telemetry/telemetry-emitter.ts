/**
 * Telemetry Emitter
 *
 * Emits privacy-safe telemetry events for wallet operations.
 * Respects opt-in configuration and handles local storage of events.
 */

import { AnyTelemetryEvent, TelemetryEventType } from './telemetry-schema';

export interface TelemetryConfig {
  enabled: boolean;
  sessionId: string;
  storageKey?: string;
  maxEvents?: number;
}

class TelemetryEmitter {
  private config: Required<TelemetryConfig>;
  private events: AnyTelemetryEvent[] = [];

  constructor(config: TelemetryConfig) {
    this.config = {
      enabled: config.enabled,
      sessionId: config.sessionId,
      storageKey: config.storageKey || 'wallet_telemetry_events',
      maxEvents: config.maxEvents || 200,
    };
    this.loadEvents();
  }

  emit(event: Omit<AnyTelemetryEvent, 'timestamp' | 'sessionId'>): void {
    if (!this.config.enabled) {
      return;
    }

    const fullEvent: AnyTelemetryEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: this.config.sessionId,
    } as AnyTelemetryEvent;

    this.events.push(fullEvent);

    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents);
    }

    this.saveEvents();
  }

  emitLockFailure(reason: 'timeout' | 'invalid_password' | 'unknown', errorCode?: string): void {
    this.emit({
      type: TelemetryEventType.LOCK_FAILURE,
      failureReason: reason,
      errorCode,
    });
  }

  emitAuthFailure(
    authType: 'signature' | 'permissions' | 'session',
    failureReason: string,
    errorCode?: string,
    errorCategory?: string
  ): void {
    this.emit({
      type: TelemetryEventType.AUTH_FAILURE,
      authType,
      failureReason,
      errorCode,
      errorCategory,
    });
  }

  emitSendFailure(
    failureStage: 'validation' | 'signing' | 'broadcast',
    errorCode?: string,
    errorCategory?: string
  ): void {
    this.emit({
      type: TelemetryEventType.SEND_FAILURE,
      failureStage,
      errorCode,
      errorCategory,
    });
  }

  emitExecuteFailure(
    failureStage: 'validation' | 'simulation' | 'execution',
    errorCode?: string,
    errorCategory?: string
  ): void {
    this.emit({
      type: TelemetryEventType.EXECUTE_FAILURE,
      failureStage,
      errorCode,
      errorCategory,
    });
  }

  emitTransactionInitiated(operationType: 'send' | 'contract_call' | 'session_creation'): void {
    this.emit({
      type: TelemetryEventType.TRANSACTION_INITIATED,
      operationType,
    });
  }

  emitTransactionCompleted(
    operationType: 'send' | 'contract_call' | 'session_creation',
    success: boolean,
    duration: number
  ): void {
    this.emit({
      type: TelemetryEventType.TRANSACTION_COMPLETED,
      operationType,
      success,
      duration,
    });
  }

  getEvents(): AnyTelemetryEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
    this.saveEvents();
  }

  private loadEvents(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch {
      this.events = [];
    }
  }

  private saveEvents(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.events));
    } catch {
      // Ignore storage errors
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

let defaultEmitter: TelemetryEmitter | null = null;

export function initTelemetry(config: TelemetryConfig): TelemetryEmitter {
  defaultEmitter = new TelemetryEmitter(config);
  return defaultEmitter;
}

export function getTelemetry(): TelemetryEmitter {
  if (!defaultEmitter) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    defaultEmitter = new TelemetryEmitter({
      enabled: false,
      sessionId,
    });
  }
  return defaultEmitter;
}
