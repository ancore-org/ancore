import { beforeEach, describe, expect, it } from 'vitest';
import { initTelemetry } from '../telemetry-emitter';
import { TelemetryEventType } from '../telemetry-schema';

describe('TelemetryEmitter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not record address_copied when telemetry is disabled', () => {
    const emitter = initTelemetry({
      enabled: false,
      sessionId: 'test-session',
      storageKey: 'test_telemetry_events',
    });

    emitter.emitAddressCopied();

    expect(emitter.getEvents()).toHaveLength(0);
  });

  it('records address_copied without address payload when enabled', () => {
    const emitter = initTelemetry({
      enabled: true,
      sessionId: 'test-session',
      storageKey: 'test_telemetry_events',
    });

    emitter.emitAddressCopied();

    const events = emitter.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(TelemetryEventType.ADDRESS_COPIED);
    expect(JSON.stringify(events[0])).not.toMatch(/G[A-Z0-9]{55}/);
  });

  it('drops events when disabled after being enabled', () => {
    const emitter = initTelemetry({
      enabled: true,
      sessionId: 'test-session',
      storageKey: 'test_telemetry_events',
    });

    emitter.emitAddressCopied();
    expect(emitter.getEvents()).toHaveLength(1);

    emitter.setEnabled(false);
    emitter.emitAddressCopied();
    expect(emitter.getEvents()).toHaveLength(1);
  });

  it('clears buffered events on clearEvents', () => {
    const emitter = initTelemetry({
      enabled: true,
      sessionId: 'test-session',
      storageKey: 'test_telemetry_events',
    });

    emitter.emitAddressCopied();
    emitter.clearEvents();
    expect(emitter.getEvents()).toHaveLength(0);
  });
});
