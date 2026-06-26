import { deriveKeypairFromMnemonic } from '@ancore/crypto';

export interface DiscoveredHdAccount {
  accountIndex: number;
  publicKey: string;
  balance: string;
}

export const DEFAULT_HD_SCAN_START_INDEX = 0;
export const DEFAULT_HD_SCAN_END_INDEX = 5;

export interface DiscoverFundedHdAccountsOptions {
  mnemonic: string;
  startIndex?: number;
  endIndex?: number;
  /** Returns native XLM balance, or null when the account is unfunded or not found. */
  fetchNativeBalance: (publicKey: string) => Promise<string | null>;
  onProgress?: (progress: { accountIndex: number; scanned: number; total: number }) => void;
  signal?: { aborted: boolean };
}

function assertNotAborted(signal?: { aborted: boolean }): void {
  if (signal?.aborted) {
    const error = new Error('Discovery scan cancelled');
    error.name = 'AbortError';
    throw error;
  }
}

function normalizeScanRange(startIndex: number, endIndex: number): void {
  if (!Number.isInteger(startIndex) || startIndex < 0) {
    throw new Error('startIndex must be a non-negative integer.');
  }

  if (!Number.isInteger(endIndex) || endIndex < startIndex) {
    throw new Error('endIndex must be a non-negative integer greater than or equal to startIndex.');
  }
}

/**
 * Derives Stellar HD accounts (m/44'/148'/{index}') and returns those with a
 * positive native balance on the connected network.
 */
export async function discoverFundedHdAccounts(
  options: DiscoverFundedHdAccountsOptions
): Promise<DiscoveredHdAccount[]> {
  const startIndex = options.startIndex ?? DEFAULT_HD_SCAN_START_INDEX;
  const endIndex = options.endIndex ?? DEFAULT_HD_SCAN_END_INDEX;
  normalizeScanRange(startIndex, endIndex);

  const discovered: DiscoveredHdAccount[] = [];
  const total = endIndex - startIndex + 1;
  let scanned = 0;

  for (let accountIndex = startIndex; accountIndex <= endIndex; accountIndex++) {
    assertNotAborted(options.signal);

    const keypair = deriveKeypairFromMnemonic(options.mnemonic, accountIndex);
    scanned += 1;
    options.onProgress?.({ accountIndex, scanned, total });

    const balance = await options.fetchNativeBalance(keypair.publicKey());
    assertNotAborted(options.signal);

    if (balance !== null && Number.parseFloat(balance) > 0) {
      discovered.push({
        accountIndex,
        publicKey: keypair.publicKey(),
        balance,
      });
    }
  }

  return discovered;
}
