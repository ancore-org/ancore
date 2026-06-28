import { isExternalRequest, WALLET_API_SOURCE, ANCORE_WALLET_REQUEST } from '@ancore/wallet-shared';

describe('wallet-api protocol', () => {
  it('recognizes valid external request shape', () => {
    expect(
      isExternalRequest({
        type: ANCORE_WALLET_REQUEST,
        source: WALLET_API_SOURCE,
        requestId: 'req-1',
        method: 'getAddress',
      })
    ).toBe(true);
  });
});
