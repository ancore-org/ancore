import {
  parseWalletConnectDeepLink,
  isWalletConnectDeepLink,
  extractPairingUri,
} from '../walletconnect';

describe('WalletConnect Deep Link Handler', () => {
  describe('parseWalletConnectDeepLink', () => {
    it('should parse a valid WalletConnect deep link', () => {
      const url = 'ancore://wc?uri=wc:abc123def456';
      const result = parseWalletConnectDeepLink(url);

      expect(result).toEqual({
        uri: 'wc:abc123def456',
      });
    });

    it('should return null for invalid URL format', () => {
      const url = 'https://example.com?uri=wc:abc123';
      const result = parseWalletConnectDeepLink(url);

      expect(result).toBeNull();
    });

    it('should return null when uri parameter is missing', () => {
      const url = 'ancore://wc?other=value';
      const result = parseWalletConnectDeepLink(url);

      expect(result).toBeNull();
    });

    it('should return null for non-wc URI', () => {
      const url = 'ancore://wc?uri=https://example.com';
      const result = parseWalletConnectDeepLink(url);

      expect(result).toBeNull();
    });

    it('should handle complex WalletConnect URIs', () => {
      const url = 'ancore://wc?uri=wc:abc123@2?relay-protocol=irn&symKey=xyz789';
      const result = parseWalletConnectDeepLink(url);

      expect(result).toEqual({
        uri: 'wc:abc123@2?relay-protocol=irn&symKey=xyz789',
      });
    });

    it('should handle malformed URLs gracefully', () => {
      const url = 'not-a-url';
      const result = parseWalletConnectDeepLink(url);

      expect(result).toBeNull();
    });
  });

  describe('isWalletConnectDeepLink', () => {
    it('should return true for valid WalletConnect deep link', () => {
      const url = 'ancore://wc?uri=wc:abc123';
      const result = isWalletConnectDeepLink(url);

      expect(result).toBe(true);
    });

    it('should return false for other deep links', () => {
      const url = 'ancore://payment?amount=100';
      const result = isWalletConnectDeepLink(url);

      expect(result).toBe(false);
    });

    it('should return false for regular URLs', () => {
      const url = 'https://example.com';
      const result = isWalletConnectDeepLink(url);

      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = isWalletConnectDeepLink('');

      expect(result).toBe(false);
    });
  });

  describe('extractPairingUri', () => {
    it('should extract pairing URI from valid deep link', () => {
      const url = 'ancore://wc?uri=wc:abc123def456';
      const result = extractPairingUri(url);

      expect(result).toBe('wc:abc123def456');
    });

    it('should return null for invalid deep link', () => {
      const url = 'ancore://payment?amount=100';
      const result = extractPairingUri(url);

      expect(result).toBeNull();
    });

    it('should return null when uri parameter is missing', () => {
      const url = 'ancore://wc?other=value';
      const result = extractPairingUri(url);

      expect(result).toBeNull();
    });

    it('should handle complex pairing URIs', () => {
      const url = 'ancore://wc?uri=wc:abc123@2?relay-protocol=irn&symKey=xyz789';
      const result = extractPairingUri(url);

      expect(result).toBe('wc:abc123@2?relay-protocol=irn&symKey=xyz789');
    });
  });
});
