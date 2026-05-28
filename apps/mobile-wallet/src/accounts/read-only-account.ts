import type { Address, NetworkConfig } from '@ancore/types';

export type ReadOnlyAccountStatus = 'not_configured' | 'ready';

export interface ReadOnlyAccount {
  id: string;
  address: Address;
  network: NetworkConfig;
  status: ReadOnlyAccountStatus;
}

export interface CreateReadOnlyAccountParams {
  id?: string;
  address?: string;
  network: NetworkConfig;
}

export class ReadOnlyAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadOnlyAccountError';
  }
}

export const createReadOnlyAccount = ({
  id = 'primary',
  address,
  network,
}: CreateReadOnlyAccountParams): ReadOnlyAccount => {
  const normalizedAddress = address?.trim();

  if (!normalizedAddress) {
    return {
      id,
      address: { value: 'Not connected' },
      network,
      status: 'not_configured',
    };
  }

  if (!normalizedAddress.startsWith('G')) {
    throw new ReadOnlyAccountError('Read-only account addresses must be Stellar public keys.');
  }

  return {
    id,
    address: { value: normalizedAddress },
    network,
    status: 'ready',
  };
};
