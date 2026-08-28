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
import { createLogger } from '../logger';

const log = createLogger('[ancore-extension/handlers/health]');

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
    log.warn('invalid service URLs', { errors: formatErrors });
    return;
  }

  log.info('probing service health', { environment });
  const results = await probeAllServiceHealth(config);

  for (const result of results) {
    setCachedHealth(result);
    if (result.status !== 'ok') {
      log.warn('service health degraded', result);
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
      log.error('CHECK_SERVICE_HEALTH failed', err);
      return {
        relayer: { service: 'relayer' as const, status: 'unreachable' as const },
        indexer: { service: 'indexer' as const, status: 'unreachable' as const },
      };
    }
  });

  log.debug('registered');
}

/** Called on extension install/startup. */
export async function probeServicesOnStartup(): Promise<void> {
  await runServiceHealthProbes();
}
