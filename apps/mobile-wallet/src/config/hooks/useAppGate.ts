import { useEffect, useState } from 'react';
import { checkAppGate, type AppGateResult, type FetchLike } from '../remote-config';

export interface UseAppGateOptions {
  configUrl?: string;
  appVersion?: string;
  bypass?: boolean;
  fetchFn?: FetchLike;
}

export interface AppGateState {
  isLoading: boolean;
  result: AppGateResult;
}

/**
 * Runs the remote-config app gate before the main navigation renders.
 * Resolves immediately to "ok" when no config URL or app version is set,
 * or when the dev bypass flag is enabled.
 */
export function useAppGate({
  configUrl,
  appVersion,
  bypass,
  fetchFn,
}: UseAppGateOptions): AppGateState {
  const shouldCheck = Boolean(configUrl && appVersion && !bypass);

  const [state, setState] = useState<AppGateState>({
    isLoading: shouldCheck,
    result: { status: 'ok' },
  });

  useEffect(() => {
    if (!shouldCheck) {
      return;
    }

    let cancelled = false;

    checkAppGate({ configUrl, appVersion, bypass, fetchFn }).then((result) => {
      if (!cancelled) {
        setState({ isLoading: false, result });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldCheck, configUrl, appVersion, bypass, fetchFn]);

  return state;
}
