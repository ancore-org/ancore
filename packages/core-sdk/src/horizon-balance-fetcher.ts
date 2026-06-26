import { AccountNotFoundError, StellarClient } from '@ancore/stellar';

/**
 * Creates a balance fetcher backed by Horizon via {@link StellarClient}.
 * Unfunded accounts resolve to null so discovery can skip them.
 */
export function createHorizonNativeBalanceFetcher(client: StellarClient) {
  return async (publicKey: string): Promise<string | null> => {
    try {
      const balances = await client.getBalances(publicKey);
      const native = balances.find((balance) => balance.assetType === 'native');

      if (!native) {
        return null;
      }

      return native.balance;
    } catch (error) {
      if (error instanceof AccountNotFoundError) {
        return null;
      }

      throw error;
    }
  };
}
