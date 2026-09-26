import { WalletKit } from '@reown/walletkit';
import { Core } from '@walletconnect/core';

import { buildWalletKitMetadata } from '../constants';
import { createWalletKit } from '../create-wallet-kit';

jest.mock('@walletconnect/core', () => ({
  Core: jest.fn().mockImplementation(() => ({ id: 'mock-core' })),
}));

describe('createWalletKit', () => {
  it('initializes WalletKit with project id and metadata', async () => {
    const metadata = buildWalletKitMetadata({ name: 'Ancore Wallet' });

    const kit = await createWalletKit({
      projectId: 'test-project-id',
      metadata,
    });

    expect(Core).toHaveBeenCalledWith({ projectId: 'test-project-id' });
    expect(WalletKit.init).toHaveBeenCalledWith({
      core: { id: 'mock-core' },
      metadata,
    });
    expect(kit).toBeDefined();
  });
});
