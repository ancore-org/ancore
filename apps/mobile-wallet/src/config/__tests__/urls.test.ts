import { resolveServiceUrls, validateServiceUrl, validateServiceUrls } from '../urls';

describe('mobile service URL validation', () => {
  it('accepts valid http and https URLs', () => {
    expect(validateServiceUrl('http://localhost:3000', 'indexer')).toBeUndefined();
    expect(validateServiceUrl('https://indexer.ancore.io', 'indexer')).toBeUndefined();
  });

  it('rejects empty URLs', () => {
    expect(validateServiceUrl('', 'indexer')).toBe('indexer URL must not be empty');
  });

  it('rejects malformed URLs', () => {
    expect(validateServiceUrl('not-a-url', 'relayer')).toBe(
      'relayer URL is not a valid URL: "not-a-url"'
    );
  });

  it('rejects non-http(s) schemes', () => {
    expect(validateServiceUrl('ftp://indexer.ancore.io', 'indexer')).toBe(
      'indexer URL must use http or https scheme, got "ftp:"'
    );
  });

  it('validates all required service URLs together', () => {
    const errors = validateServiceUrls({
      indexerUrl: 'http://localhost:3000',
      relayerUrl: 'http://localhost:3001',
    });
    expect(errors).toEqual([]);
  });

  it('reports missing and malformed values', () => {
    const errors = validateServiceUrls({
      indexerUrl: '',
      relayerUrl: 'bad-url',
      aiAgentUrl: 'javascript:alert(1)',
    });

    expect(errors).toContain('indexer URL must not be empty');
    expect(errors).toContain('relayer URL is not a valid URL: "bad-url"');
    expect(errors).toContain('aiAgent URL must use http or https scheme, got "javascript:"');
  });

  it('resolves explicit env overrides', () => {
    const urls = resolveServiceUrls(
      {
        EXPO_PUBLIC_INDEXER_URL: 'https://custom-indexer.example',
        EXPO_PUBLIC_RELAYER_URL: 'https://custom-relayer.example',
        EXPO_PUBLIC_AI_AGENT_URL: 'https://custom-ai.example',
      },
      'testnet'
    );

    expect(urls).toEqual({
      indexerUrl: 'https://custom-indexer.example',
      relayerUrl: 'https://custom-relayer.example',
      aiAgentUrl: 'https://custom-ai.example',
    });
  });
});
