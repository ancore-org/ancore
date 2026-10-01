import { createSmartAccount } from '../src/account';
import { Signer } from '../src/signer';
import { NetworkConfig } from '../src/types';

describe('createSmartAccount', () => {
  const mockNetwork: NetworkConfig = {
    chainId: 1,
    rpcUrl: 'https://mock-rpc.url',
  };

  const mockSigner: Signer = {
    signMessage: jest.fn().mockResolvedValue('mock-signature'),
    getAddress: jest.fn().mockReturnValue('0xMockAddress'),
  };

  it('should create a smart account with default salt', async () => {
    const result = await createSmartAccount({
      signer: mockSigner,
      network: mockNetwork,
    });

    expect(result).toHaveProperty('address');
    expect(result.signer).toBe(mockSigner);
    expect(result.network).toBe(mockNetwork);
    expect(typeof result.salt).toBe('string');
    expect(result.salt.length).toBeGreaterThan(0);
  });

  it('should create a smart account with custom salt', async () => {
    const customSalt = 'custom-salt-value';
    const result = await createSmartAccount({
      signer: mockSigner,
      network: mockNetwork,
      salt: customSalt,
    });

    expect(result.salt).toBe(customSalt);
  });

  it('should throw when account creation fails', async () => {
    const failingSigner: Signer = {
      signMessage: jest.fn().mockRejectedValue(new Error('Signing failed')),
      getAddress: jest.fn().mockReturnValue('0xMockAddress'),
    };

    await expect(
      createSmartAccount({
        signer: failingSigner,
        network: mockNetwork,
      })
    ).rejects.toThrow('Signing failed');
  });
});
