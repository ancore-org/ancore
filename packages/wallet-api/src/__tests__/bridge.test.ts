import {
  ANCORE_WALLET_REQUEST,
  ANCORE_WALLET_RESPONSE,
  CONTENT_SCRIPT_SOURCE,
  WALLET_API_SOURCE,
} from '@ancore/wallet-shared';
import { sendExternalRequest, WalletApiError } from '../bridge';

describe('sendExternalRequest', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('posts ANCORE_WALLET_REQUEST and resolves on matching response', async () => {
    const postMessage = jest.spyOn(window, 'postMessage').mockImplementation(() => {});

    const promise = sendExternalRequest<{ address: string }>('getAddress');

    const [[request]] = postMessage.mock.calls;
    expect(request).toMatchObject({
      type: ANCORE_WALLET_REQUEST,
      source: WALLET_API_SOURCE,
      method: 'getAddress',
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          type: ANCORE_WALLET_RESPONSE,
          source: CONTENT_SCRIPT_SOURCE,
          requestId: request.requestId,
          ok: true,
          result: { address: 'CADDR123' },
        },
      })
    );

    await expect(promise).resolves.toEqual({ address: 'CADDR123' });
    postMessage.mockRestore();
  });

  it('rejects with WalletApiError when ok is false', async () => {
    const postMessage = jest.spyOn(window, 'postMessage').mockImplementation(() => {});

    const promise = sendExternalRequest('getNetwork');

    const requestId = postMessage.mock.calls[0][0].requestId;

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          type: ANCORE_WALLET_RESPONSE,
          source: CONTENT_SCRIPT_SOURCE,
          requestId,
          ok: false,
          error: 'Origin not allowed',
        },
      })
    );

    await expect(promise).rejects.toThrow(new WalletApiError('Origin not allowed'));
    postMessage.mockRestore();
  });

  it('rejects after the configured timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(window, 'postMessage').mockImplementation(() => {});

    const promise = sendExternalRequest('isConnected', {}, 30_000);

    jest.advanceTimersByTime(30_000);

    await expect(promise).rejects.toThrow('Request timed out after 30000ms');
  });
});
