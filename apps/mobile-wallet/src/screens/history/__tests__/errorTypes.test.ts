import { detectErrorKind } from '../errorTypes';

describe('detectErrorKind', () => {
  describe('network errors', () => {
    it('detects network error from fetch failure', () => {
      const error = new Error('Failed to fetch');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('network');
      expect(result.message).toBe('Failed to fetch');
    });

    it('detects network error from timeout', () => {
      const error = new Error('Request timeout');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('network');
    });

    it('detects network error from offline', () => {
      const error = new Error('Network is offline');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('network');
    });

    it('detects network error from ECONNREFUSED', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('network');
    });

    it('detects network error from ENOTFOUND', () => {
      const error = new Error('ENOTFOUND: getaddrinfo ENOTFOUND example.com');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('network');
    });
  });

  describe('server errors', () => {
    it('detects 4xx server error', () => {
      const error = new Error('HTTP 400: Bad Request');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('server');
      expect(result.statusCode).toBe(400);
    });

    it('detects 401 unauthorized error', () => {
      const error = new Error('HTTP 401: Unauthorized');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('server');
      expect(result.statusCode).toBe(401);
    });

    it('detects 404 not found error', () => {
      const error = new Error('HTTP 404: Not Found');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('server');
      expect(result.statusCode).toBe(404);
    });

    it('detects 5xx server error', () => {
      const error = new Error('HTTP 500: Internal Server Error');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('server');
      expect(result.statusCode).toBe(500);
    });

    it('detects 503 service unavailable error', () => {
      const error = new Error('HTTP 503: Service Unavailable');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('server');
      expect(result.statusCode).toBe(503);
    });
  });

  describe('configuration errors', () => {
    it('detects missing INDEXER_URL', () => {
      const error = new Error('INDEXER_URL is not configured');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('configuration');
    });

    it('detects missing indexer url (lowercase)', () => {
      const error = new Error('indexer url not set');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('configuration');
    });

    it('detects not configured error', () => {
      const error = new Error('Adapter not configured');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('configuration');
    });

    it('detects missing config error', () => {
      const error = new Error('Missing config for transaction service');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('configuration');
    });
  });

  describe('unknown errors', () => {
    it('handles non-Error objects', () => {
      const result = detectErrorKind('string error');

      expect(result.kind).toBe('unknown');
      expect(result.message).toBe('string error');
    });

    it('handles null error', () => {
      const result = detectErrorKind(null);

      expect(result.kind).toBe('unknown');
    });

    it('handles undefined error', () => {
      const result = detectErrorKind(undefined);

      expect(result.kind).toBe('unknown');
    });

    it('handles generic error', () => {
      const error = new Error('Something went wrong');
      const result = detectErrorKind(error);

      expect(result.kind).toBe('unknown');
      expect(result.message).toBe('Something went wrong');
    });
  });

  describe('error message preservation', () => {
    it('preserves original error message', () => {
      const message = 'Custom error message';
      const error = new Error(message);
      const result = detectErrorKind(error);

      expect(result.message).toBe(message);
    });

    it('extracts status code from message', () => {
      const error = new Error('Request failed with status 429');
      const result = detectErrorKind(error);

      expect(result.statusCode).toBe(429);
    });
  });
});
