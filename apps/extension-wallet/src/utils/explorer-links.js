const STELLAR_EXPERT_BASE_URL = {
  mainnet: 'https://stellar.expert/explorer/public',
  testnet: 'https://stellar.expert/explorer/testnet',
  futurenet: 'https://stellar.expert/explorer/futurenet',
};
export function getTransactionExplorerLink(hash, network = 'mainnet') {
  return `${STELLAR_EXPERT_BASE_URL[network]}/tx/${encodeURIComponent(hash)}`;
}
//# sourceMappingURL=explorer-links.js.map
