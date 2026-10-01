import { Signer } from './signer';
import { AccountFactory } from './factory';
import { NetworkConfig } from './types';

/**
 * Account creation parameters
 */
export interface CreateSmartAccountParams {
  signer: Signer;
  network: NetworkConfig;
  salt?: string;
}

/**
 * Smart account creation result
 */
export interface SmartAccount {
  address: string;
  signer: Signer;
  network: NetworkConfig;
  salt: string;
}

/**
 * Creates a new smart account with the given parameters
 * @param params - Account creation parameters
 * @returns Promise resolving to the created smart account
 */
export async function createSmartAccount(
  params: CreateSmartAccountParams
): Promise<SmartAccount> {
  const { signer, network, salt = Date.now().toString() } = params;

  const factory = new AccountFactory(network);
  const address = await factory.createAccount(signer, salt);

  return {
    address,
    signer,
    network,
    salt,
  };
}

/**
 * Batch creates multiple smart accounts
 * @param params - Array of account creation parameters
 * @returns Promise resolving to array of created smart accounts
 */
export async function createSmartAccounts(
  params: CreateSmartAccountParams[]
): Promise<SmartAccount[]> {
  return Promise.all(params.map(createSmartAccount));
}