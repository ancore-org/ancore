import { Linking } from 'react-native';

import { parseWalletConnectDeepLink } from './walletconnect';

export type WalletConnectDeepLinkHandler = (params: { uri: string }) => void;

export type WalletConnectDeepLinkSubscription = {
  remove: () => void;
};

/**
 * Subscribe to WalletConnect deep links via React Native `Linking`.
 *
 * Invokes `onDeepLink` for cold-start (`getInitialURL`) and warm-start (`url` events)
 * when the URL matches `ancore://wc?uri=<wc-pairing-uri>`.
 */
export function subscribeToWalletConnectDeepLinks(
  onDeepLink: WalletConnectDeepLinkHandler
): WalletConnectDeepLinkSubscription {
  const handleUrl = (url: string | null) => {
    if (!url) {
      return;
    }

    const params = parseWalletConnectDeepLink(url);
    if (params) {
      onDeepLink(params);
    }
  };

  void Linking.getInitialURL().then(handleUrl);

  const subscription = Linking.addEventListener('url', (event) => {
    handleUrl(event.url);
  });

  return {
    remove: () => subscription.remove(),
  };
}
