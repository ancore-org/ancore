import { buildWalletKitMetadata } from '../constants';

describe('buildWalletKitMetadata', () => {
  it('uses a native redirect scheme', () => {
    const metadata = buildWalletKitMetadata({ name: 'Ancore Wallet Dev' });
    expect(['ancore://', 'ancoredev://']).toContain(metadata.redirect.native);
  });
});
