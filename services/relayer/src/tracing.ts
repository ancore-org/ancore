import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

const OTEL_ENABLED = process.env.OTEL_ENABLED !== 'false';
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'ancore-relayer';
const OTEL_EXPORTER_OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

let sdk: NodeSDK | null = null;

function shutdown(): void {
  if (sdk) {
    sdk
      .shutdown()
      .then(() => diag.info('OpenTelemetry SDK shut down gracefully'))
      .catch((err) => diag.error('Error shutting down OpenTelemetry SDK', err));
  }
}

if (OTEL_ENABLED) {
  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': OTEL_SERVICE_NAME,
      'service.version': process.env.npm_package_version ?? '0.1.0',
    }),
    spanProcessor: new BatchSpanProcessor(traceExporter, {
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  diag.info('OpenTelemetry SDK auto-initialized for %s', OTEL_SERVICE_NAME);

  process.on('SIGTERM', () => shutdown());
  process.on('SIGINT', () => shutdown());
} else {
  diag.info('OpenTelemetry tracing is disabled (OTEL_ENABLED=false)');
}
