import { jsxs as _jsxs, jsx as _jsx } from 'react/jsx-runtime';
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
import { ErrorBoundary, useErrorHandler, handleError, createRetryable } from './errors';
/**
 * Example component that fetches data - demonstrates async error handling
 * Uses the error-handler to classify and log errors
 */
function DataFetcher() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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
      setError(handledError.originalError);
    } finally {
      setLoading(false);
    }
  }, []);
  // Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  if (error) {
    return _jsxs('div', {
      className: 'p-4 border border-red-300 rounded-lg bg-red-50',
      children: [
        _jsxs('p', { className: 'text-red-800 mb-2', children: ['Error: ', error.message] }),
        _jsxs('div', {
          className: 'flex gap-2',
          children: [
            _jsx('button', {
              onClick: fetchData,
              className: 'px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700',
              children: 'Retry',
            }),
            _jsx('button', {
              onClick: reset,
              className: 'px-3 py-1 border border-red-600 text-red-600 rounded hover:bg-red-50',
              children: 'Reset',
            }),
          ],
        }),
      ],
    });
  }
  if (loading) {
    return _jsx('div', { className: 'p-4', children: 'Loading...' });
  }
  return _jsxs('div', {
    className: 'p-4',
    children: [
      _jsx('h3', { className: 'font-bold', children: 'User Data' }),
      data &&
        _jsxs('ul', {
          children: [
            _jsxs('li', { children: ['ID: ', data.id] }),
            _jsxs('li', { children: ['Name: ', data.name] }),
            _jsxs('li', { children: ['Balance: ', data.balance] }),
          ],
        }),
      _jsx('button', {
        onClick: fetchData,
        className: 'mt-2 px-3 py-1 bg-blue-600 text-white rounded',
        children: 'Refresh',
      }),
    ],
  });
}
/**
 * Example component using createRetryable
 * Creates a function that automatically retries on failure
 */
async function submitTransaction(txData) {
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
const submitTransactionWithRetry = createRetryable(submitTransaction, 3, 1000);
/**
 * Transaction component - demonstrates retry functionality
 */
function TransactionComponent() {
  const [status, setStatus] = useState('idle');
  const [txHash, setTxHash] = useState(null);
  const handleSubmit = async () => {
    setStatus('submitting');
    const result = await submitTransactionWithRetry({ amount: 100 });
    if ('txHash' in result) {
      setTxHash(result.txHash);
      setStatus('success');
    } else {
      setStatus('failed');
    }
  };
  return _jsxs('div', {
    className: 'p-4 border rounded-lg',
    children: [
      _jsx('h3', { className: 'font-bold mb-2', children: 'Transaction' }),
      _jsxs('p', { className: 'mb-2', children: ['Status: ', status] }),
      txHash && _jsxs('p', { className: 'mb-2', children: ['Tx Hash: ', txHash] }),
      _jsx('button', {
        onClick: handleSubmit,
        disabled: status === 'submitting',
        className: 'px-3 py-1 bg-green-600 text-white rounded',
        children: status === 'submitting' ? 'Submitting...' : 'Submit Transaction',
      }),
    ],
  });
}
/**
 * Main App component - wrapped with ErrorBoundary
 * The ErrorBoundary will catch any rendering errors in children
 */
export function App() {
  // Callback for handling errors that escape component boundaries
  const handleAppError = (error, errorInfo) => {
    console.error('App-level error:', error, errorInfo.componentStack);
  };
  // Callback for resetting app state
  const handleReset = () => {
    console.log('App reset requested');
  };
  return _jsxs('div', {
    className: 'min-h-screen bg-gray-100 p-8',
    children: [
      _jsx('h1', { className: 'text-3xl font-bold mb-8', children: 'Extension Wallet' }),
      _jsx(ErrorBoundary, {
        onError: handleAppError,
        onReset: handleReset,
        children: _jsxs('div', {
          className: 'space-y-8',
          children: [
            _jsxs('section', {
              className: 'bg-white p-4 rounded-lg shadow',
              children: [
                _jsx('h2', {
                  className: 'text-xl font-semibold mb-4',
                  children: 'Data Fetcher Example',
                }),
                _jsx(DataFetcher, {}),
              ],
            }),
            _jsxs('section', {
              className: 'bg-white p-4 rounded-lg shadow',
              children: [
                _jsx('h2', {
                  className: 'text-xl font-semibold mb-4',
                  children: 'Transaction Example (with retry)',
                }),
                _jsx(TransactionComponent, {}),
              ],
            }),
            _jsxs('section', {
              className: 'bg-white p-4 rounded-lg shadow',
              children: [
                _jsx('h2', {
                  className: 'text-xl font-semibold mb-4',
                  children: 'Direct Error Handler Example',
                }),
                _jsx(DirectErrorExample, {}),
              ],
            }),
          ],
        }),
      }),
    ],
  });
}
/**
 * Component demonstrating direct use of error-handler
 */
function DirectErrorExample() {
  const [result, setResult] = useState(null);
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
  return _jsxs('div', {
    children: [
      _jsxs('div', {
        className: 'flex gap-2 mb-4',
        children: [
          _jsx('button', {
            onClick: testNetworkError,
            className: 'px-2 py-1 bg-gray-200 rounded text-sm',
            children: 'Test Network Error',
          }),
          _jsx('button', {
            onClick: testValidationError,
            className: 'px-2 py-1 bg-gray-200 rounded text-sm',
            children: 'Test Validation Error',
          }),
          _jsx('button', {
            onClick: testContractError,
            className: 'px-2 py-1 bg-gray-200 rounded text-sm',
            children: 'Test Contract Error',
          }),
          _jsx('button', {
            onClick: testUnknownError,
            className: 'px-2 py-1 bg-gray-200 rounded text-sm',
            children: 'Test Unknown Error',
          }),
        ],
      }),
      result && _jsx('p', { className: 'p-2 bg-blue-50 rounded text-sm', children: result }),
    ],
  });
}
export default App;
//# sourceMappingURL=App.js.map
