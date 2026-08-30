import type { MobileWalletEnvSource } from './environment';

/** Safe dev/e2e defaults — never use in production builds. */
export const DEV_MOBILE_WALLET_ENV: MobileWalletEnvSource = {
  ANCORE_ACCOUNT_CONTRACT_ID: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
  ANCORE_MOBILE_NETWORK: 'testnet',
  ANCORE_MOBILE_APP_NAME: 'Ancore Wallet Dev',
  EXPO_PUBLIC_INDEXER_URL: 'http://localhost:3000',
  EXPO_PUBLIC_RELAYER_URL: 'http://localhost:3001',
  WALLETCONNECT_PROJECT_ID: 'test-project-id-for-e2e',
};

export const resolveMobileWalletEnv = (
  source: MobileWalletEnvSource = {}
): MobileWalletEnvSource => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return { ...DEV_MOBILE_WALLET_ENV, ...source };
  }

  return source;
};
