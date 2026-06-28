/**
 * Service URL configuration and validation for the mobile wallet.
 *
 * Parity with extension wallet URL validation (issue #567 / #617).
 */

export type ServiceName = 'relayer' | 'indexer' | 'aiAgent';

export interface ServiceUrlConfig {
  relayerUrl: string;
  indexerUrl: string;
  aiAgentUrl?: string;
}

export type MobileServiceEnvironment = 'development' | 'staging' | 'production';

const RELAYER_URLS: Record<MobileServiceEnvironment, string> = {
  production: 'https://relayer.ancore.io',
  staging: 'https://relayer-staging.ancore.io',
  development: 'http://localhost:3001',
};

const INDEXER_URLS: Record<MobileServiceEnvironment, string> = {
  production: 'https://indexer.ancore.io',
  staging: 'https://indexer-staging.ancore.io',
  development: 'http://localhost:3000',
};

const AI_AGENT_URLS: Record<MobileServiceEnvironment, string> = {
  production: 'https://ai-agent.ancore.io',
  staging: 'https://ai-agent-staging.ancore.io',
  development: 'http://localhost:3002',
};

const ALLOWED_SCHEMES = ['http:', 'https:'];

export function resolveServiceEnvironment(
  network: string,
  nodeEnv?: string
): MobileServiceEnvironment {
  if (nodeEnv === 'production' && network === 'mainnet') {
    return 'production';
  }
  if (network === 'mainnet') {
    return 'staging';
  }
  return 'development';
}

export function resolveRelayerUrl(environment: MobileServiceEnvironment): string {
  return RELAYER_URLS[environment];
}

export function resolveIndexerUrl(environment: MobileServiceEnvironment): string {
  return INDEXER_URLS[environment];
}

export function resolveAiAgentUrl(environment: MobileServiceEnvironment): string {
  return AI_AGENT_URLS[environment];
}

/**
 * Validates a URL string synchronously.
 * @returns An error message string if invalid, undefined if valid.
 */
export function validateServiceUrl(url: string, service: ServiceName): string | undefined {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return `${service} URL must not be empty`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return `${service} URL is not a valid URL: "${url}"`;
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return `${service} URL must use http or https scheme, got "${parsed.protocol}"`;
  }

  if (!parsed.hostname || parsed.hostname.trim().length === 0) {
    return `${service} URL must include a valid hostname`;
  }

  return undefined;
}

/**
 * Validates relayer, indexer, and optional AI agent URLs.
 * Returns an array of error messages (empty if all valid).
 */
export function validateServiceUrls(config: ServiceUrlConfig): string[] {
  const errors: string[] = [];

  const relayerError = validateServiceUrl(config.relayerUrl, 'relayer');
  if (relayerError) errors.push(relayerError);

  const indexerError = validateServiceUrl(config.indexerUrl, 'indexer');
  if (indexerError) errors.push(indexerError);

  if (config.aiAgentUrl) {
    const aiAgentError = validateServiceUrl(config.aiAgentUrl, 'aiAgent');
    if (aiAgentError) errors.push(aiAgentError);
  }

  return errors;
}

export function resolveServiceUrls(
  source: Record<string, string | undefined>,
  network: string,
  nodeEnv?: string
): ServiceUrlConfig {
  const environment = resolveServiceEnvironment(network, nodeEnv);

  return {
    indexerUrl:
      source.EXPO_PUBLIC_INDEXER_URL?.trim() ||
      source.ANCORE_INDEXER_URL?.trim() ||
      resolveIndexerUrl(environment),
    relayerUrl:
      source.EXPO_PUBLIC_RELAYER_URL?.trim() ||
      source.ANCORE_RELAYER_URL?.trim() ||
      resolveRelayerUrl(environment),
    aiAgentUrl:
      source.EXPO_PUBLIC_AI_AGENT_URL?.trim() ||
      source.ANCORE_AI_AGENT_URL?.trim() ||
      resolveAiAgentUrl(environment),
  };
}
