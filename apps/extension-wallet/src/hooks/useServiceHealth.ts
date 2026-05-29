/**
 * useServiceHealth hook
 *
 * Reads cached service health state and exposes a retry trigger.
 * Polls the background service worker via CHECK_SERVICE_HEALTH message.
 *
 * Issue #567
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCachedHealth,
  getConfigErrors,
  setCachedHealth,
  isSendBlocked,
  type ServiceHealthResult,
  type ConfigError,
} from '@/config/urls';
import { sendMessage } from '@/messaging';

export interface UseServiceHealthReturn {
  relayerHealth: ServiceHealthResult;
  indexerHealth: ServiceHealthResult;
  configErrors: ConfigError[];
  sendBlocked: boolean;
  isChecking: boolean;
  retry: () => void;
}

export function useServiceHealth(): UseServiceHealthReturn {
  const [relayerHealth, setRelayerHealth] = useState<ServiceHealthResult>(
    getCachedHealth('relayer')
  );
  const [indexerHealth, setIndexerHealth] = useState<ServiceHealthResult>(
    getCachedHealth('indexer')
  );
  const [configErrors, setConfigErrors] = useState<ConfigError[]>(getConfigErrors());
  const [isChecking, setIsChecking] = useState(false);

  const refresh = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await sendMessage('CHECK_SERVICE_HEALTH', {});
      setCachedHealth(result.relayer);
      setCachedHealth(result.indexer);
      setRelayerHealth(result.relayer);
      setIndexerHealth(result.indexer);
      setConfigErrors(getConfigErrors());
    } catch {
      // Background not available (e.g. in popup dev mode) — read from cache
      setRelayerHealth(getCachedHealth('relayer'));
      setIndexerHealth(getCachedHealth('indexer'));
      setConfigErrors(getConfigErrors());
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Run once on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    relayerHealth,
    indexerHealth,
    configErrors,
    sendBlocked: isSendBlocked(),
    isChecking,
    retry: refresh,
  };
}
