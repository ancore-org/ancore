import { ReadOnlyAccountError, createReadOnlyAccount } from '../read-only-account';

const network = {
  network: 'testnet' as const,
  rpcUrl: 'https://soroban-testnet.stellar.org',
};

describe('createReadOnlyAccount', () => {
  it('creates a ready read-only account for a Stellar public key', () => {
    const account = createReadOnlyAccount({
      id: 'primary',
      address: 'GABC123',
      network,
    });

    expect(account).toEqual({
      id: 'primary',
      address: { value: 'GABC123' },
      network,
      status: 'ready',
    });
  });

  it('returns a not-configured account when no address is provided', () => {
    const account = createReadOnlyAccount({ network });

    expect(account.status).toBe('not_configured');
    expect(account.address.value).toBe('Not connected');
  });

  it('rejects non-Stellar public key account addresses', () => {
    expect(() =>
      createReadOnlyAccount({
        address: 'CABC123',
        network,
      })
    ).toThrow(ReadOnlyAccountError);
  });
});
