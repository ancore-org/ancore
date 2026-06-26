import { useEffect } from 'react';
import { getTelemetry } from '@/telemetry';
import { useSettingsStore } from '@/stores/settings';

function applyTelemetryOptIn(optIn: boolean): void {
  getTelemetry().setEnabled(optIn);
  if (!optIn) {
    getTelemetry().clearEvents();
  }
}

/**
 * Keeps the telemetry emitter in sync with the persisted settings opt-in flag.
 */
export function useTelemetrySettingsSync(): void {
  useEffect(() => {
    let cancelled = false;

    void useSettingsStore.persist.rehydrate().then(() => {
      if (cancelled) return;
      applyTelemetryOptIn(useSettingsStore.getState().telemetryOptIn);
    });

    const unsubscribe = useSettingsStore.subscribe((state, previousState) => {
      if (state.telemetryOptIn !== previousState.telemetryOptIn) {
        applyTelemetryOptIn(state.telemetryOptIn);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
}
