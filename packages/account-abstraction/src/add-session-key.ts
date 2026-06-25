/* eslint-disable no-redeclare */

import type { SessionPermission } from '@ancore/types';

import type {
  AccountContractReadOptions,
  AccountContractWriteResult,
  InvocationArgs,
} from './account-contract';
import { AccountContract } from './account-contract';
import { permissionsToContractVec } from './permissions';

function getContract(contract: AccountContract | string): AccountContract {
  return typeof contract === 'string' ? new AccountContract(contract) : contract;
}

function resolveSessionKeyPermissions(permissions: SessionPermission[] | number[]): number[] {
  return permissionsToContractVec(permissions as SessionPermission[]);
}

export function addSessionKey(
  contract: AccountContract | string,
  publicKey: string | Uint8Array,
  permissions: SessionPermission[] | number[],
  expiresAt: number
): InvocationArgs;
export function addSessionKey(
  contract: AccountContract | string,
  publicKey: string | Uint8Array,
  permissions: SessionPermission[] | number[],
  expiresAt: number,
  options: AccountContractReadOptions
): Promise<AccountContractWriteResult>;
export function addSessionKey(
  contract: AccountContract | string,
  publicKey: string | Uint8Array,
  permissions: SessionPermission[] | number[],
  expiresAt: number,
  options?: AccountContractReadOptions
): InvocationArgs | Promise<AccountContractWriteResult> {
  const contractPermissions = resolveSessionKeyPermissions(permissions);

  if (options) {
    const resolvedContract = getContract(contract);
    const invocation = resolvedContract.addSessionKey(publicKey, contractPermissions, expiresAt);
    return Promise.resolve({
      invocation,
      operation: resolvedContract.buildInvokeOperation(invocation),
    });
  }

  return getContract(contract).addSessionKey(publicKey, contractPermissions, expiresAt);
}
