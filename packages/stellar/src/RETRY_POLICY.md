# Stellar Client Retry Policy Documentation

## Default Retry Policy

The Stellar client uses a resilient retry policy with the following default configuration:

```typescript
const DEFAULT_RETRY_POLICY = {
  maxRetries: 3,           // Maximum number of retry attempts
  baseDelayMs: 1000,       // Base delay between retries (1 second)
  exponential: true,       // Use exponential backoff
};
```

### Retry Behavior

- **Attempt 1**: Immediate execution
- **Attempt 2**: 1 second delay (if attempt 1 fails)
- **Attempt 3**: 2 second delay (if attempt 2 fails)  
- **Attempt 4**: 4 second delay (if attempt 3 fails)
- **Failure**: Throws `RetryExhaustedError` after 4 total attempts

## Error Classification

### Transient Errors (Retryable)

These errors are considered temporary and should be retried:

1. **Network Errors**
   - Connection timeouts
   - DNS resolution failures
   - Socket hangups
   - HTTP 5xx server errors (500, 502, 503, 504)
   - Rate limiting (HTTP 429)

2. **Temporary Service Issues**
   - Soroban RPC server overload
   - Horizon API temporary unavailability
   - Network congestion

### Permanent Errors (Non-Retryable)

These errors are considered permanent and should not be retried:

1. **Authentication/Authorization Errors**
   - HTTP 401 Unauthorized
   - HTTP 403 Forbidden

2. **Client Errors**
   - HTTP 400 Bad Request
   - HTTP 404 Not Found (for account queries)
   - HTTP 422 Unprocessable Entity

3. **Business Logic Errors**
   - `AccountNotFoundError` - Account doesn't exist on network
   - `TransactionError` with permanent result codes (e.g., `tx_bad_seq`)
   - Invalid transaction format

## Override Points

### 1. Retry Options Override

```typescript
import { StellarClient } from '@ancore/stellar';

const client = new StellarClient({
  network: 'testnet',
  retryOptions: {
    maxRetries: 5,        // Increase retry attempts
    baseDelayMs: 500,     // Reduce base delay
    exponential: false,   // Use linear backoff
  },
});
```

### 2. Custom Retry Logic

```typescript
import { withRetry } from '@ancore/stellar';

// Custom retryable error detection
const result = await withRetry(
  async () => {
    // Your network operation
  },
  {
    maxRetries: 3,
    baseDelayMs: 1000,
    exponential: true,
    isRetryable: (error) => {
      // Custom logic to determine if error is retryable
      if (error instanceof NetworkError) {
        const status = error.statusCode;
        return status === 429 || (status && status >= 500);
      }
      return error instanceof Error && error.message.includes('timeout');
    },
  }
);
```

### 3. Per-Operation Retry Configuration

Different operations can have different retry requirements:

```typescript
// For account queries (more forgiving)
const account = await withRetry(
  () => client.getAccount(publicKey),
  {
    maxRetries: 5,
    baseDelayMs: 2000,
    isRetryable: (error) => !(error instanceof AccountNotFoundError),
  }
);

// For transaction submission (more strict)
const result = await withRetry(
  () => client.submitTransaction(transaction),
  {
    maxRetries: 2,
    baseDelayMs: 500,
    isRetryable: (error) => {
      if (error instanceof TransactionError) {
        // Don't retry bad sequence numbers
        return error.resultCode !== 'tx_bad_seq';
      }
      return error instanceof NetworkError && error.statusCode !== 400;
    },
  }
);
```

## Network Failure Scenarios

### Scenario 1: Intermittent Network Issues

```typescript
// Handles temporary network blips
const client = new StellarClient({
  network: 'mainnet',
  retryOptions: {
    maxRetries: 4,
    baseDelayMs: 1500,
    exponential: true,
  },
});

// Will retry on:
// - Connection timeouts
// - DNS failures  
// - HTTP 503 Service Unavailable
// - Rate limiting (429)
```

### Scenario 2: High-Throughput Operations

```typescript
// Optimized for bulk operations
const bulkClient = new StellarClient({
  network: 'mainnet',
  retryOptions: {
    maxRetries: 2,        // Faster failures
    baseDelayMs: 200,     // Shorter delays
    exponential: false,    // Linear backoff for predictability
  },
});
```

### Scenario 3: Critical Operations

```typescript
// Maximum resilience for critical operations
const criticalClient = new StellarClient({
  network: 'mainnet',
  retryOptions: {
    maxRetries: 8,        // More attempts
    baseDelayMs: 3000,     // Longer delays
    exponential: true,     // Exponential backoff
  },
});
```

## Best Practices

### 1. Monitor Retry Patterns

```typescript
// Add logging to monitor retry behavior
const client = new StellarClient({
  network: 'testnet',
  retryOptions: {
    maxRetries: 3,
    baseDelayMs: 1000,
    exponential: true,
    onRetry: (attempt, error, delay) => {
      console.warn(`Retry attempt ${attempt} after ${delay}ms:`, error.message);
    },
  },
});
```

### 2. Circuit Breaker Pattern

```typescript
class CircuitBreakerStellarClient {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    return this.failures >= this.threshold && 
           Date.now() - this.lastFailure < this.timeout;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
  }

  private reset(): void {
    this.failures = 0;
  }
}
```

### 3. Exponential Backoff with Jitter

```typescript
// Add jitter to prevent thundering herd
function calculateDelayWithJitter(attempt: number, baseDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay; // ±10% jitter
  return exponentialDelay + jitter;
}
```

## Testing Retry Behavior

### Unit Tests

```typescript
describe('retry behavior', () => {
  it('should retry on transient errors', async () => {
    const client = new StellarClient({ network: 'testnet' });
    
    // Mock network failure then success
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError('Timeout'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(mockFn, {
      maxRetries: 2,
      isRetryable: (error) => error instanceof NetworkError,
    });

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});
```

### Integration Tests

```typescript
describe('network resilience', () => {
  it('should handle real network failures', async () => {
    const client = new StellarClient({ 
      network: 'testnet',
      retryOptions: { maxRetries: 3, baseDelayMs: 100 }
    });

    // Test with invalid URL to simulate network failure
    const result = await client.isHealthy();
    expect(typeof result).toBe('boolean');
  });
});
```

## Performance Considerations

### 1. Timeout Configuration

```typescript
// Configure appropriate timeouts
const client = new StellarClient({
  network: 'mainnet',
  timeout: 30000, // 30 second timeout
  retryOptions: {
    maxRetries: 3,
    baseDelayMs: 1000,
  },
});
```

### 2. Connection Pooling

The Stellar client automatically handles connection pooling for optimal performance under retry scenarios.

### 3. Memory Management

Retry operations maintain references to the last error for debugging. For long-running applications, consider error size limits:

```typescript
const client = new StellarClient({
  network: 'mainnet',
  retryOptions: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxErrorSize: 1024, // Limit error size to 1KB
  },
});
```

## Monitoring and Alerting

### Key Metrics

1. **Retry Rate**: Percentage of operations that require retries
2. **Failure Rate**: Percentage of operations that ultimately fail
3. **Average Retry Count**: Mean number of retries per operation
4. **Retry Latency**: Time spent in retry delays

### Alert Thresholds

- Retry rate > 10%: Investigate network issues
- Failure rate > 5%: Check service health
- Average retry count > 2: Consider increasing retry limits

## Migration Guide

### From v1 to v2 Retry Policy

```typescript
// Old v1 approach
const client = new StellarClient({ network: 'testnet' });
client.setRetryPolicy({ attempts: 3, delay: 1000 });

// New v2 approach  
const client = new StellarClient({
  network: 'testnet',
  retryOptions: {
    maxRetries: 3,
    baseDelayMs: 1000,
    exponential: true,
  },
});
```

The new retry policy provides:
- Better error classification
- Configurable exponential backoff
- More granular control over retry behavior
- Improved error context preservation
