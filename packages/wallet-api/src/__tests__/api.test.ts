import { ExternalApiMethod } from '@ancore/wallet-shared';

const sendExternalRequest = jest.fn();

jest.mock('../bridge', () => ({
  ...jest.requireActual('../bridge'),
  sendExternalRequest: (...args: unknown[]) => sendExternalRequest(...args),
}));

import { connect, getAddress, getNetwork, isConnected } from '../index';

describe('wallet-api public methods', () => {
  beforeEach(() => {
    sendExternalRequest.mockReset();
  });

  it('connect returns smart account C-address from requestAccess flow', async () => {
    sendExternalRequest.mockResolvedValue({
      smartAccountId: 'CADDR999',
      network: 'testnet',
    });

    await expect(connect()).resolves.toBe('CADDR999');
    expect(sendExternalRequest).toHaveBeenCalledWith(ExternalApiMethod.CONNECT);
  });

  it('getAddress maps background address to smartAccountId', async () => {
    sendExternalRequest.mockResolvedValue({
      address: 'CADDR123',
      network: 'testnet',
    });

    await expect(getAddress()).resolves.toEqual({ smartAccountId: 'CADDR123' });
    expect(sendExternalRequest).toHaveBeenCalledWith(ExternalApiMethod.GET_ADDRESS);
  });

  it('getNetwork returns mainnet or testnet', async () => {
    sendExternalRequest.mockResolvedValue({
      network: 'mainnet',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });

    await expect(getNetwork()).resolves.toBe('mainnet');
    expect(sendExternalRequest).toHaveBeenCalledWith(ExternalApiMethod.GET_NETWORK);
  });

  it('isConnected returns allowlist status', async () => {
    sendExternalRequest.mockResolvedValue({ connected: true });

    await expect(isConnected()).resolves.toBe(true);
    expect(sendExternalRequest).toHaveBeenCalledWith(ExternalApiMethod.IS_CONNECTED);
  });
});
