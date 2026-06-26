import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { DEFAULTS, useSettingsStore } from '../../stores/settings';
import { useTelemetrySettingsSync } from '../useTelemetrySettingsSync';
import { getTelemetry, initTelemetry } from '@/telemetry';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState(DEFAULTS);
  initTelemetry({
    enabled: false,
    sessionId: 'test-session',
    storageKey: 'test_telemetry_events',
  });
});

describe('useTelemetrySettingsSync', () => {
  it('enables telemetry after rehydrate when opt-in is true', async () => {
    localStorage.setItem(
      'ancore-settings',
      JSON.stringify({
        state: { telemetryOptIn: true },
        version: 4,
      })
    );

    renderHook(() => useTelemetrySettingsSync());

    await waitFor(() => {
      expect(getTelemetry().isEnabled()).toBe(true);
    });
  });

  it('keeps telemetry disabled when opt-in is false', async () => {
    renderHook(() => useTelemetrySettingsSync());

    await waitFor(() => {
      expect(useSettingsStore.getState().telemetryOptIn).toBe(false);
    });

    expect(getTelemetry().isEnabled()).toBe(false);
  });

  it('updates telemetry when settings toggle changes', async () => {
    renderHook(() => useTelemetrySettingsSync());

    await waitFor(() => {
      expect(useSettingsStore.getState().telemetryOptIn).toBe(false);
    });

    useSettingsStore.getState().setTelemetryOptIn(true);
    expect(getTelemetry().isEnabled()).toBe(true);

    useSettingsStore.getState().setTelemetryOptIn(false);
    expect(getTelemetry().isEnabled()).toBe(false);
  });
});
