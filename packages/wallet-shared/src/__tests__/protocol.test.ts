import {
  ANCORE_WALLET_REQUEST,
  WALLET_API_SOURCE,
  isExternalRequest,
  isExternalResponse,
  ANCORE_WALLET_RESPONSE,
  CONTENT_SCRIPT_SOURCE,
} from '../protocol';

describe('protocol', () => {
  it('validates external request envelopes', () => {
    expect(
      isExternalRequest({
        type: ANCORE_WALLET_REQUEST,
        source: WALLET_API_SOURCE,
        requestId: 'abc',
        method: 'getAddress',
      })
    ).toBe(true);

    expect(isExternalRequest({ type: 'OTHER' })).toBe(false);
  });

  it('validates external response envelopes', () => {
    expect(
      isExternalResponse({
        type: ANCORE_WALLET_RESPONSE,
        source: CONTENT_SCRIPT_SOURCE,
        requestId: 'abc',
        ok: true,
        result: { address: 'CABC...' },
      })
    ).toBe(true);
  });
});
