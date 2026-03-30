import type { AccountContractReadOptions } from './account-contract';
import { AccountContract } from './account-contract';
import type { SessionKey } from './session-key';

function getContract(contract: AccountContract | string): AccountContract {
  return typeof contract === 'string' ? new AccountContract(contract) : contract;
}

export async function getSessionKey(
  contract: AccountContract | string,
  publicKey: string | Uint8Array,
  options: AccountContractReadOptions
): Promise<SessionKey | null> {
  return getContract(contract).getSessionKey(publicKey, options);
}
