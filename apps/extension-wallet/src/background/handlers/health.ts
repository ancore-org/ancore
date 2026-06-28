import { registerHandler } from '@/messaging';
import {
  probeAllServiceHealth,
  setCachedHealth,
  resolveRelayerUrl,
  resolveIndexerUrl,
  validateServiceUrls,
  type ServiceUrlConfig,
} from '@/config/urls';
import { getChromeLocalStorage } from '../chrome-storage';

const logPrefix = '[ancore-extension/handlers/health]';

async function runServiceHealthProbes(): Promise<void> {
  let environment = 'production';
  try {
    const raw = await getChromeLocalStorage('ancore_dashboard_settings');
    if (raw && typeof raw === 'string') {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed['environment'] === 'string') {
        environment = parsed['environment'];
      }
    }
  } catch {
    // fall back to production
  }

  const config: ServiceUrlConfig = {
    relayerUrl: resolveRelayerUrl(environment),
    indexerUrl: resolveIndexerUrl(environment),
  };

  const formatErrors = validateServiceUrls(config);
  if (formatErrors.length > 0) {
    console.warn(`${logPrefix} invalid service URLs`, formatErrors);
    return;
  }

  console.info(`${logPrefix} probing service health`, { environment });
  const results = await probeAllServiceHealth(config);

  for (const result of results) {
    setCachedHealth(result);
    if (result.status !== 'ok') {
      console.warn(`${logPrefix} service health degraded`, result);
    }
  }
}

export function registerHealthHandlers(): void {
  registerHandler('CHECK_SERVICE_HEALTH', async () => {
    try {
      await runServiceHealthProbes();
      const { getCachedHealth } = await import('@/config/urls');
      return {
        relayer: getCachedHealth('relayer'),
        indexer: getCachedHealth('indexer'),
      };
    } catch (err) {
      console.error(`${logPrefix} CHECK_SERVICE_HEALTH failed`, err);
      return {
        relayer: { service: 'relayer' as const, status: 'unreachable' as const },
        indexer: { service: 'indexer' as const, status: 'unreachable' as const },
      };
    }
  });

  if (import.meta.env.DEV) {
    console.debug(`${logPrefix} registered`);
  }
}

/** Called on extension install/startup. */
export async function probeServicesOnStartup(): Promise<void> {
  await runServiceHealthProbes();
}
