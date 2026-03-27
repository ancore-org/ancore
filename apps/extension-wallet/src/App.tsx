/**
 * App Component Example
 *
 * Demonstrates how to use ErrorBoundary and error-handler in a React application.
 * This example shows:
 * 1. Wrapping the app with ErrorBoundary
 * 2. Using error-handler in async functions
 * 3. Implementing retry functionality
 * 4. Handling different error categories
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ErrorBoundary,
  useErrorHandler,
  handleError,
  withErrorHandling,
  createRetryable,
} from './errors';

/**
 * Sample data type
 */
interface UserData {
  id: string;
  name: string;
  balance: string;
}

/**
 * Example component that fetches data - demonstrates async error handling
 * Uses the error-handler to classify and log errors
 */
function DataFetcher(): JSX.Element {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use the error handler hook for manual error dispatching
  const { reset } = useErrorHandler();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate a network request that might fail
      const response = await fetch('/api/user');

      if (!response.ok) {
        // Use the global error handler to classify the error
        const errorInfo = handleError(
          new Error(`HTTP ${response.status}: ${response.statusText}`),
          'fetchUserData'
        );
        throw new Error(errorInfo.message);
      }

      const userData = await response.json();
      setData(userData);
    } catch (err) {
      const handledError = handleError(err, 'fetchUserData');

      // Log the error (handled by error-handler internally)
      console.log('Error category:', handledError.category);
      console.log('Recoverable:', handledError.recoverable);

      setError(handledError.originalError as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="p-4 border border-red-300 rounded-lg bg-red-50">
        <p className="text-red-800 mb-2">Error: {error.message}</p>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
          <button
            onClick={reset}
            className="px-3 py-1 border border-red-600 text-red-600 rounded hover:bg-red-50"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <h3 className="font-bold">User Data</h3>
      {data && (
        <ul>
          <li>ID: {data.id}</li>
          <li>Name: {data.name}</li>
          <li>Balance: {data.balance}</li>
        </ul>
      )}
      <button onClick={fetchData} className="mt-2 px-3 py-1 bg-blue-600 text-white rounded">
        Refresh
      </button>
    </div>
  );
}

/**
 * Example component using withErrorHandling HOC
 * Wraps an async function with automatic error handling
 */
async function fetchUserBalance(userId: string): Promise<string> {
  // Simulate network call
  const response = await fetch(`/api/balance/${userId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch balance');
  }

  const data = await response.json();
  return data.balance;
}

// Wrap function with error handling (example utility export usage)
void withErrorHandling(fetchUserBalance as any, 'fetchUserBalance');

/**
 * Example component using createRetryable
 * Creates a function that automatically retries on failure
 */
async function submitTransaction(txData: object): Promise<{ txHash: string }> {
  // Simulate transaction submission
  const response = await fetch('/api/submit', {
    method: 'POST',
    body: JSON.stringify(txData),
  });

  if (!response.ok) {
    throw new Error('Transaction failed');
  }

  return response.json();
}

// Create a retryable version that retries up to 3 times
const submitTransactionWithRetry = createRetryable(submitTransaction as any, 3, 1000);

/**
 * Transaction component - demonstrates retry functionality
 */
function TransactionComponent(): JSX.Element {
  const [status, setStatus] = useState<string>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSubmit = async () => {
    setStatus('submitting');

    const result = (await submitTransactionWithRetry({ amount: 100 })) as { txHash: string };

    if ('txHash' in result) {
      setTxHash(result.txHash);
      setStatus('success');
    } else {
      setStatus('failed');
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-2">Transaction</h3>
      <p className="mb-2">Status: {status}</p>
      {txHash && <p className="mb-2">Tx Hash: {txHash}</p>}
      <button
        onClick={handleSubmit}
        disabled={status === 'submitting'}
        className="px-3 py-1 bg-green-600 text-white rounded"
      >
        {status === 'submitting' ? 'Submitting...' : 'Submit Transaction'}
      </button>
    </div>
  );
}

/**
 * Main App component - wrapped with ErrorBoundary
 * The ErrorBoundary will catch any rendering errors in children
 */
export function App(): JSX.Element {
  // Callback for handling errors that escape component boundaries
  const handleAppError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('App-level error:', error, errorInfo.componentStack);
  };

  // Callback for resetting app state
  const handleReset = () => {
    console.log('App reset requested');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">Extension Wallet</h1>

      {/* Wrap the entire app with ErrorBoundary */}
      <ErrorBoundary onError={handleAppError} onReset={handleReset}>
        <div className="space-y-8">
          {/* Example 1: Data fetching with manual error handling */}
          <section className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Data Fetcher Example</h2>
            <DataFetcher />
          </section>

          {/* Example 2: Transaction with retry */}
          <section className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Transaction Example (with retry)</h2>
            <TransactionComponent />
          </section>

          {/* Example 3: Direct error handler usage */}
          <section className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Direct Error Handler Example</h2>
            <DirectErrorExample />
          </section>
        </div>
      </ErrorBoundary>
    </div>
  );
}

/**
 * Component demonstrating direct use of error-handler
 */
function DirectErrorExample(): JSX.Element {
  const [result, setResult] = useState<string | null>(null);

  const testNetworkError = () => {
    const errorInfo = handleError(new Error('ECONNREFUSED: Connection refused'), 'networkTest');
    setResult(`Category: ${errorInfo.category}, Recoverable: ${errorInfo.recoverable}`);
  };

  const testValidationError = () => {
    const errorInfo = handleError(
      new Error('validation failed: invalid address'),
      'validationTest'
    );
    setResult(`Category: ${errorInfo.category}, Recoverable: ${errorInfo.recoverable}`);
  };

  const testContractError = () => {
    const errorInfo = handleError(new Error('Contract: execution reverted'), 'contractTest');
    setResult(`Category: ${errorInfo.category}, Recoverable: ${errorInfo.recoverable}`);
  };

  const testUnknownError = () => {
    const errorInfo = handleError(new Error('Something unexpected'), 'unknownTest');
    setResult(`Category: ${errorInfo.category}, Recoverable: ${errorInfo.recoverable}`);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={testNetworkError} className="px-2 py-1 bg-gray-200 rounded text-sm">
          Test Network Error
        </button>
        <button onClick={testValidationError} className="px-2 py-1 bg-gray-200 rounded text-sm">
          Test Validation Error
        </button>
        <button onClick={testContractError} className="px-2 py-1 bg-gray-200 rounded text-sm">
          Test Contract Error
        </button>
        <button onClick={testUnknownError} className="px-2 py-1 bg-gray-200 rounded text-sm">
          Test Unknown Error
        </button>
      </div>
      {result && <p className="p-2 bg-blue-50 rounded text-sm">{result}</p>}
    </div>
  );
}

export default App;
