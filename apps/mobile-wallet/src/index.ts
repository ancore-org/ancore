// @ts-nocheck
export * from './accounts';
export * from './app';
export * from './config/environment';
export * from './config/remote-config';
export * from './config/hooks/useAppGate';
export * from './config/urls';
export * from './linking';
export * from './navigation';
export * from './sdk';

export { HistoryScreen } from './screens/history/HistoryScreen';
export { ForceUpdateScreen } from './screens/gate/ForceUpdateScreen';
export { MaintenanceScreen } from './screens/gate/MaintenanceScreen';

export type {
  FetchTransactionPageParams,
  HistoryPage,
  Transaction,
  TransactionHistoryAdapter,
} from './screens/history/types';

export { OnboardingNavigator, OnboardingNavigatorTestHarness } from './navigation';
export { MobileAppRoot } from './navigation';

export type { OnboardingRoute, OnboardingFlow } from './screens/onboarding/types';
export * from './security';
export * from './services/secure-clipboard';
export * from './storage';

// WalletConnect exports
export { WalletKitProvider, useWalletConnect } from './providers/WalletKitProvider';
export type { IWalletKit } from './providers/WalletKitProvider';
export { createWalletKit } from './walletconnect/create-wallet-kit';
export { resolveMobileWalletEnv, DEV_MOBILE_WALLET_ENV } from './config/dev-defaults';
export {
  buildWalletKitMetadata,
  buildStellarAccountId,
  networkToStellarChain,
  StellarRpcChains,
} from './walletconnect/constants';
export type { StellarRpcChain, WalletKitMetadataInput } from './walletconnect/constants';
export { buildApprovedSessionNamespaces } from './walletconnect/approve-session';
export { WalletConnectPanel } from './screens/walletconnect/WalletConnectPanel';
export { createStellarRpcHandlers, handleStellarRpcRequest } from './providers/stellar-handlers';
export type { StellarRpcHandlers, SignService } from './providers/stellar-handlers';
export { createVaultSignService } from './providers/mobile-sign-service';
export { SignAuthEntryApprovalSheet } from './components/SignAuthEntryApprovalSheet';
export type { SignAuthEntryRequest } from './components/SignAuthEntryApprovalSheet';
export { SignXdrApprovalSheet } from './components/SignXdrApprovalSheet';
export type { SignXdrRequest } from './components/SignXdrApprovalSheet';
export { SessionApprovalSheet } from './components/SessionApprovalSheet';
export { parseAuthEntryXdr } from './walletconnect/auth-entry-parser';
export type { ParsedAuthEntry } from './walletconnect/auth-entry-parser';
export type { SessionProposal } from './components/SessionApprovalSheet';
export { WCPairingScreen } from './screens/walletconnect/WCPairingScreen';
export type {
  WCPairingScreenProps,
  WCPairingStatus,
} from './screens/walletconnect/WCPairingScreen';
