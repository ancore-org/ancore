/**
 * Register all internal (popup ↔ background) message handlers.
 *
 * Freighter pattern: one module per handler domain under messageListener/handlers/
 * https://github.com/stellar/freighter/tree/master/extension/src/background/messageListener/handlers
 *
 * External dApp handlers (requestAccess, signTransaction, …) go in external-handlers.ts
 * — see docs/wallets/FREIGHTER_COMPARISON.md §3.1
 */

import { registerHealthHandlers } from './health';
import { registerLockUnlockHandlers } from './lock-unlock';
import { registerWalletStateHandlers } from './wallet-state';
import { registerSignTransactionHandlers } from './sign-transaction';
import { registerSignAuthEntryHandlers } from './sign-auth-entry';
import { registerSignMessageHandlers } from './sign-message';
import { registerSignRelayPayloadHandlers } from './sign-relay-payload';

export function registerInternalHandlers(): void {
  registerWalletStateHandlers();
  registerLockUnlockHandlers();
  registerHealthHandlers();
  registerSignTransactionHandlers();
  registerSignAuthEntryHandlers();
  registerSignMessageHandlers();
  registerSignRelayPayloadHandlers();
}

export { probeServicesOnStartup } from './health';
