export type StellarNetwork = 'mainnet' | 'testnet' | 'futurenet';

const STELLAR_EXPERT_BASE_URL: Record<StellarNetwork, string> = {
  mainnet: 'https://stellar.expert/explorer/public',
  testnet: 'https://stellar.expert/explorer/testnet',
  futurenet: 'https://stellar.expert/explorer/futurenet',
};

export function getTransactionExplorerLink(
  hash: string,
  network: StellarNetwork = 'mainnet'
): string {
  return `${STELLAR_EXPERT_BASE_URL[network]}/tx/${encodeURIComponent(hash)}`;
}
