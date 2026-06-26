/**
 * Messaging Types
 *
 * Typed message definitions for communication between
 * popup (sender) and background service worker (handler).
 *
 * Add new message types to the Messages interface to extend the system.
 */

import type { WalletState } from '@ancore/types';
import type { ServiceHealthResult } from '@/config/urls';

/**
 * Registry of all messages exchanged between extension contexts.
 *
 * Each key is a message type name; each value declares the
 * `request` payload shape and the expected `response` shape.
 */
export interface Messages {
  GET_BALANCE: {
    request: { publicKey: string };
    response: { balance: string };
  };
  SEND_TRANSACTION: {
    request: { to: string; amount: string };
    response: { txId: string };
  };
  SIGN_TRANSACTION: {
    request: { xdr: string; networkPassphrase: string };
    response: { signedXdr: string } | { error: string };
  };
  GET_WALLET_STATE: {
    request: Record<string, never>;
    response: { state: WalletState };
  };
  UNLOCK_WALLET: {
    request: { password: string };
    response: { success: boolean; retryAfterMs?: number; message?: string };
  };
  LOCK_WALLET: {
    request: Record<string, never>;
    response: { success: boolean };
  };
  CHECK_SERVICE_HEALTH: {
    request: Record<string, never>;
    response: {
      relayer: ServiceHealthResult;
      indexer: ServiceHealthResult;
    };
  };

  // ── External dApp messages (content script → background) ──────────────────

  /** dApp requests wallet access; background checks/updates the allowlist. */
  EXTERNAL_REQUEST_ACCESS: {
    request: { origin: string; params?: Record<string, unknown> };
    response: { smartAccountId: string; network: string };
  };
  /** dApp asks the background to sign an XDR transaction envelope. */
  EXTERNAL_SIGN_TRANSACTION: {
    request: { xdr: string; origin: string; networkPassphrase?: string };
    response: { signedXdr: string };
  };
  /** dApp requests the wallet's public key / smart-account address. */
  EXTERNAL_GET_PUBLIC_KEY: {
    request: { origin: string };
    response: { publicKey: string };
  };
  /** dApp queries which Stellar network the wallet is currently on. */
  EXTERNAL_GET_NETWORK: {
    request: { origin: string };
    response: { network: string; networkPassphrase: string };
  };
}

/** Union of all valid message type names */
export type MessageType = keyof Messages;

/** Request payload type for a given message */
export type MessageRequest<T extends MessageType> = Messages[T]['request'];

/** Response payload type for a given message */
export type MessageResponse<T extends MessageType> = Messages[T]['response'];

/** Handler function — registered in the background service worker */
export type MessageHandler<T extends MessageType> = (
  request: MessageRequest<T>
) => Promise<MessageResponse<T>>;

/**
 * Internal envelope sent from popup → background via chrome.runtime.sendMessage.
 * Not part of the public API — used only by sender.ts and handler.ts.
 */
export interface MessageEnvelope {
  /** Message type discriminant */
  readonly type: MessageType;
  /** Unique request ID for log correlation */
  readonly id: string;
  /** Serialised request payload */
  readonly payload: unknown;
}

/**
 * Internal response envelope sent from background → popup.
 * Not part of the public API — used only by sender.ts and handler.ts.
 */
export interface ResponseEnvelope {
  /** Echoes the request ID for log correlation */
  readonly id: string;
  /** Whether the handler resolved successfully */
  readonly ok: boolean;
  /** Serialised response payload — present when ok is true */
  readonly payload?: unknown;
  /** Human-readable error message — present when ok is false */
  readonly error?: string;
}

/** Options accepted by sendMessage */
export interface SendOptions {
  /**
   * Milliseconds to wait before rejecting with a timeout error.
   * @default 5000
   */
  timeoutMs?: number;
}
