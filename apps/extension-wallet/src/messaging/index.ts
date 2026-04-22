/**
 * Messaging — public API
 *
 * Popup usage:
 *   import { sendMessage } from '@/messaging';
 *
 * Background usage:
 *   import { registerHandler, installMessageDispatcher } from '@/messaging';
 */

export type {
  Messages,
  MessageType,
  MessageRequest,
  MessageResponse,
  MessageHandler,
  MessageEnvelope,
  ResponseEnvelope,
  SendOptions,
} from './types';

export { sendMessage } from './sender';
export { registerHandler, unregisterHandler, installMessageDispatcher } from './handler';
