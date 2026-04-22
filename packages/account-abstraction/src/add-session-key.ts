/* eslint-disable no-redeclare */

import type {
  AccountContractReadOptions,
  AccountContractWriteResult,
  InvocationArgs,
} from './account-contract';
import { AccountContract } from './account-contract';

function getContract(contract: AccountContract | string): AccountContract {
  return typeof contract === 'string' ? new AccountContract(contract) : contract;
}

export function addSessionKey(
  contract: AccountContract | string,
  publicKey: string | Uint8Array,
  permissions: number[],
  expiresAt: number
): InvocationArgs;
export function addSessionKey(
  contract: AccountContract | string,
  publicKey: string | Uint8Array,
  permissions: number[],
  expiresAt: number,
  options: AccountContractReadOptions
): Promise<AccountContractWriteResult>;
export function addSessionKey(
  contract: AccountContract | string,
  publicKey: string | Uint8Array,
  permissions: number[],
  expiresAt: number,
  options?: AccountContractReadOptions
): InvocationArgs | Promise<AccountContractWriteResult> {
  if (options) {
    return getContract(contract).addSessionKey(publicKey, permissions, expiresAt, options);
  }

  return getContract(contract).addSessionKey(publicKey, permissions, expiresAt);
}
