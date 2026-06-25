export * from './accounts';
export * from './app';
export * from './config/environment';
export * from './linking';
export * from './navigation';
export * from './sdk';

export { HistoryScreen } from './screens/history/HistoryScreen';

export type {
  FetchTransactionPageParams,
  HistoryPage,
  Transaction,
  TransactionHistoryAdapter,
} from './screens/history/types';

export { OnboardingNavigator, OnboardingNavigatorTestHarness } from './navigation';

export type { OnboardingRoute, OnboardingFlow } from './screens/onboarding/types';
export * from './security';
export * from './storage';

// WalletConnect exports
export { WalletKitProvider, useWalletConnect } from './providers/WalletKitProvider';
export { createStellarRpcHandlers, handleStellarRpcRequest } from './providers/stellar-handlers';
export type { StellarRpcHandlers } from './providers/stellar-handlers';
export { SessionApprovalSheet } from './components/SessionApprovalSheet';
export type { SessionProposal } from './components/SessionApprovalSheet';
export {
  parseWalletConnectDeepLink,
  isWalletConnectDeepLink,
  extractPairingUri,
} from './linking/walletconnect';
export type { WalletConnectDeepLinkParams } from './linking/walletconnect';
