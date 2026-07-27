import {
  ANCORE_WALLET_REQUEST,
  WALLET_API_SOURCE,
  isExternalRequest,
  isExternalResponse,
  ANCORE_WALLET_RESPONSE,
  CONTENT_SCRIPT_SOURCE,
} from '../protocol';

describe('protocol', () => {
  describe('isExternalRequest', () => {
    it('validates external request envelopes', () => {
      expect(
        isExternalRequest({
          type: ANCORE_WALLET_REQUEST,
          source: WALLET_API_SOURCE,
          requestId: 'abc',
          method: 'getAddress',
        })
      ).toBe(true);
    });

    it('rejects malformed payloads', () => {
      // Missing type
      expect(isExternalRequest({ source: WALLET_API_SOURCE, requestId: 'abc', method: 'getAddress' })).toBe(false);
      
      // Wrong type
      expect(isExternalRequest({ type: 'OTHER', source: WALLET_API_SOURCE, requestId: 'abc', method: 'getAddress' })).toBe(false);
      
      // Missing source
      expect(isExternalRequest({ type: ANCORE_WALLET_REQUEST, requestId: 'abc', method: 'getAddress' })).toBe(false);
      
      // Wrong source
      expect(isExternalRequest({ type: ANCORE_WALLET_REQUEST, source: 'malicious', requestId: 'abc', method: 'getAddress' })).toBe(false);
      
      // Missing requestId
      expect(isExternalRequest({ type: ANCORE_WALLET_REQUEST, source: WALLET_API_SOURCE, method: 'getAddress' })).toBe(false);
      
      // Non-string requestId
      expect(isExternalRequest({ type: ANCORE_WALLET_REQUEST, source: WALLET_API_SOURCE, requestId: 123, method: 'getAddress' })).toBe(false);
      
      // Missing method
      expect(isExternalRequest({ type: ANCORE_WALLET_REQUEST, source: WALLET_API_SOURCE, requestId: 'abc' })).toBe(false);
      
      // Non-string method
      expect(isExternalRequest({ type: ANCORE_WALLET_REQUEST, source: WALLET_API_SOURCE, requestId: 'abc', method: 123 })).toBe(false);
      
      // null
      expect(isExternalRequest(null)).toBe(false);
      
      // undefined
      expect(isExternalRequest(undefined)).toBe(false);
      
      // Empty object
      expect(isExternalRequest({})).toBe(false);
      
      // Array
      expect(isExternalRequest([])).toBe(false);
      
      // Primitive
      expect(isExternalRequest('string')).toBe(false);
      expect(isExternalRequest(123)).toBe(false);
      expect(isExternalRequest(true)).toBe(false);
    });

    it('accepts valid request with optional params', () => {
      expect(
        isExternalRequest({
          type: ANCORE_WALLET_REQUEST,
          source: WALLET_API_SOURCE,
          requestId: 'abc',
          method: 'signTransaction',
          params: { xdr: 'AAAA...' },
        })
      ).toBe(true);
    });
  });

  describe('isExternalResponse', () => {
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

    it('rejects malformed response payloads', () => {
      // Missing type
      expect(isExternalResponse({ source: CONTENT_SCRIPT_SOURCE, requestId: 'abc', ok: true })).toBe(false);
      
      // Wrong type
      expect(isExternalResponse({ type: 'OTHER', source: CONTENT_SCRIPT_SOURCE, requestId: 'abc', ok: true })).toBe(false);
      
      // Missing source
      expect(isExternalResponse({ type: ANCORE_WALLET_RESPONSE, requestId: 'abc', ok: true })).toBe(false);
      
      // Wrong source
      expect(isExternalResponse({ type: ANCORE_WALLET_RESPONSE, source: 'malicious', requestId: 'abc', ok: true })).toBe(false);
      
      // Missing requestId
      expect(isExternalResponse({ type: ANCORE_WALLET_RESPONSE, source: CONTENT_SCRIPT_SOURCE, ok: true })).toBe(false);
      
      // Non-string requestId
      expect(isExternalResponse({ type: ANCORE_WALLET_RESPONSE, source: CONTENT_SCRIPT_SOURCE, requestId: 123, ok: true })).toBe(false);
      
      // Missing ok
      expect(isExternalResponse({ type: ANCORE_WALLET_RESPONSE, source: CONTENT_SCRIPT_SOURCE, requestId: 'abc' })).toBe(false);
      
      // Non-boolean ok
      expect(isExternalResponse({ type: ANCORE_WALLET_RESPONSE, source: CONTENT_SCRIPT_SOURCE, requestId: 'abc', ok: 'true' })).toBe(false);
      
      // null
      expect(isExternalResponse(null)).toBe(false);
      
      // undefined
      expect(isExternalResponse(undefined)).toBe(false);
    });

    it('accepts error response', () => {
      expect(
        isExternalResponse({
          type: ANCORE_WALLET_RESPONSE,
          source: CONTENT_SCRIPT_SOURCE,
          requestId: 'abc',
          ok: false,
          error: 'User rejected',
        })
      ).toBe(true);
    });
  });
});
