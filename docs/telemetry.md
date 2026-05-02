# Wallet Telemetry

Privacy-safe telemetry infrastructure for the Ancore wallet extension. Provides operational visibility into critical failure classes without compromising user privacy or security.

## Overview

The telemetry system emits structured events for key operational boundaries:
- Lock/unlock failures
- Authentication and signing failures
- Transaction send failures
- Contract execution failures
- Transaction lifecycle events

All events are designed to exclude sensitive data such as private keys, user addresses, transaction payloads, and personal information.

## Data Minimization Policy

### What is collected:
- Event type and timestamp
- Error classification category (NETWORK, VALIDATION, CONTRACT, UNKNOWN)
- Error code or HTTP status (when applicable)
- Operation type (send, contract_call, session_creation)
- Failure stage (validation, signing, broadcast, execution, simulation)
- Operation duration in milliseconds
- Session identifier (random, per-session)

### What is never collected:
- Private keys or key material
- Wallet addresses or account identifiers
- Transaction amounts, recipients, or contract parameters
- Signature data
- Personal information or metadata about users
- Full error messages or stack traces that might leak secrets

## Initialization

Initialize telemetry early in the extension startup:

```typescript
import { initTelemetry } from '@ancore/extension-wallet/telemetry';

const telemetry = initTelemetry({
  enabled: true,  // Check user preferences
  sessionId: generateSessionId(),
  storageKey: 'wallet_telemetry_events',
  maxEvents: 200,
});
```

## Opt-in Behavior

Telemetry is disabled by default. Enable only with explicit user consent:

```typescript
const telemetry = getTelemetry();

// Respect user settings
if (userPreferences.shareTelemetry) {
  telemetry.setEnabled(true);
}

// Allow users to disable at any time
telemetry.setEnabled(false);
```

## Usage Examples

### Lock Failure
```typescript
import { getTelemetry } from '@ancore/extension-wallet/telemetry';

try {
  await wallet.unlock(password);
} catch (error) {
  getTelemetry().emitLockFailure('invalid_password', error.code);
  throw error;
}
```

### Authentication Failure
```typescript
try {
  await signMessage(message);
} catch (error) {
  getTelemetry().emitAuthFailure('signature', error.message, error.code);
  throw error;
}
```

### Transaction Send Failure
```typescript
try {
  await sendTransaction(tx);
} catch (error) {
  getTelemetry().emitSendFailure('broadcast', error.code, classifyError(error));
  throw error;
}
```

### Contract Execution Failure
```typescript
try {
  await executeContract(contract);
} catch (error) {
  getTelemetry().emitExecuteFailure('execution', error.code, classifyError(error));
  throw error;
}
```

### Transaction Lifecycle
```typescript
const startTime = Date.now();
getTelemetry().emitTransactionInitiated('send');

try {
  const result = await sendTransaction(tx);
  getTelemetry().emitTransactionCompleted('send', true, Date.now() - startTime);
} catch (error) {
  getTelemetry().emitTransactionCompleted('send', false, Date.now() - startTime);
  throw error;
}
```

## Event Structure

All events include:
- `type`: Event type enum
- `timestamp`: ISO 8601 timestamp
- `sessionId`: Random session identifier
- `errorCode`: Optional error/HTTP status code
- `errorCategory`: Optional classification (NETWORK, VALIDATION, CONTRACT, UNKNOWN)
- `metadata`: Optional additional structured data

## Storage

Events are stored locally in localStorage and persisted across sessions. The extension can:
1. Upload events to backend telemetry service
2. Export events for support/debugging
3. Clear events manually

Maximum of 200 events stored per session.

## Security Considerations

- **No server transmission**: Events are stored locally only. Export requires explicit user action.
- **Session isolation**: Each session gets a random identifier, not tied to wallet identity.
- **No linkage**: Events cannot be correlated across sessions.
- **Audit trail**: Users can export and review what telemetry is being collected.
- **Data minimization**: Only failure classification, not failure details.

## Testing

Enable telemetry in development for testing:

```typescript
initTelemetry({
  enabled: true,
  sessionId: 'dev-session',
  maxEvents: 1000, // Keep more events for debugging
});

// Clear events between test runs
getTelemetry().clearEvents();
```

## Future Enhancements

- Backend upload endpoint for aggregated failure insights
- Trend analysis and alerting for regressions
- User consent UI and preference management
- Event filtering and sampling strategies
- Encrypted storage for sensitive deployments
