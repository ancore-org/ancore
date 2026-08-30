jest.mock('@ancore/account-abstraction', () => ({
  getSessionKey: jest.fn(),
}));

import { getSessionKey } from '@ancore/account-abstraction';
import { RelayService } from '../../src/services/relayService';
import type { RelayExecuteRequest, SignatureServiceContract } from '../../src/types';

const mockedGetSessionKey = jest.mocked(getSessionKey);

function makeRequest(): RelayExecuteRequest {
  return {
    sessionKey: 'a'.repeat(64),
    operation: 'relay_execute',
    parameters: { accountAddress: 'GABC' },
    signature: 'b'.repeat(128),
    nonce: 1,
  };
}

describe('RelayService session-key lookup', () => {
  it('fails closed when the on-chain lookup is unavailable', async () => {
    mockedGetSessionKey.mockRejectedValueOnce(new Error('RPC unavailable'));
    const signatureService: SignatureServiceContract = { verify: jest.fn().mockReturnValue(true) };
    const service = new RelayService(signatureService);

    const result = await service.validateRelay(makeRequest());

    expect(result).toEqual({
      valid: false,
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Session key verification unavailable: RPC unavailable',
      },
    });
    expect(signatureService.verify).not.toHaveBeenCalled();
  });
});
