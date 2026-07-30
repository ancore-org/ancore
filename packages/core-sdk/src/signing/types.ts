/**
 * Shared signing contracts for software and hardware wallets.
 */

/** Signer that returns a fully signed transaction envelope XDR. */
export interface SigningAdapter {
  /** Sign an unsigned transaction envelope XDR; return signed XDR. */
  sign(transactionXdr: string): Promise<string>;
}

/** BIP-44 account index for Stellar (`m/44'/148'/{account}'`). */
export type StellarBip44AccountIndex = number;

/**
 * Build a Stellar BIP-44 derivation path.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md
 */
export function stellarBip44Path(accountIndex: StellarBip44AccountIndex = 0): string {
  if (!Number.isInteger(accountIndex) || accountIndex < 0) {
    throw new Error(`Invalid Stellar BIP-44 account index: ${accountIndex}`);
  }
  return `44'/148'/${accountIndex}'`;
}
