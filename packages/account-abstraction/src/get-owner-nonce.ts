/**
 * Standalone read methods for account abstraction contract.
 * Provides getOwner() and getNonce() as named async functions.
 */

import type { AccountContractReadOptions } from './account-contract';
import { AccountContract } from './account-contract';

/**
 * Get the owner address of an account abstraction contract.
 *
 * @param contractId - The contract ID of the account abstraction contract
 * @param options - Server and source account for simulation
 * @returns The owner's address as a string
 */
export async function getOwner(
  contractId: string,
  options: AccountContractReadOptions
): Promise<string> {
  const contract = new AccountContract(contractId);
  const result = await contract.getOwner(options);
  return result;
}

/**
 * Get the current nonce of an account abstraction contract.
 *
 * @param contractId - The contract ID of the account abstraction contract
 * @options - Server and source account for simulation
 * @returns The current nonce as a number
 */
export async function getNonce(
  contractId: string,
  options: AccountContractReadOptions
): Promise<number> {
  const contract = new AccountContract(contractId);
  const result = await contract.getNonce(options);
  return result;
}
