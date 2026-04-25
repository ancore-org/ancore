/**
 * Telemetry Module
 *
 * Provides privacy-safe telemetry event emission for wallet operations.
 */

export { TelemetryEventType, type TelemetryEvent, type AnyTelemetryEvent } from './telemetry-schema';
export {
  getTelemetry,
  initTelemetry,
  type TelemetryConfig,
} from './telemetry-emitter';
