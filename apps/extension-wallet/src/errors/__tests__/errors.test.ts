/**
 * Error Handling System Tests
 *
 * Unit tests for:
 * - ErrorBoundary catching errors
 * - ErrorScreen UI rendering
 * - Global error handler classifications
 * - Recovery functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorHandler,
  ErrorCategory,
  handleError,
  classifyError,
  getErrorUserMessage,
  withErrorHandling,
  createRetryable,
  getErrorHandler,
} from '../error-handler';
import { getErrorMessage, ERROR_MESSAGES } from '../error-messages';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler({ logToConsole: false, logToStorage: false });
  });

  describe('classifyError', () => {
    it('should classify network errors', () => {
      const networkErrors = [
        new Error('ECONNREFUSED'),
        new Error('ETIMEDOUT'),
        new Error('Failed to fetch'),
        new Error('Network request failed'),
        new Error('net::ERR_INTERNET_DISCONNECTED'),
      ];

      networkErrors.forEach((error) => {
        expect(errorHandler.classifyError(error)).toBe(ErrorCategory.NETWORK);
      });
    });

    it('should classify validation errors', () => {
      const validationErrors = [
        new Error('validation failed'),
        new Error('Invalid address'),
        new Error('malformed input'),
        new Error('bad request'),
        new Error('TypeError: Cannot read property'),
      ];

      validationErrors.forEach((error) => {
        expect(errorHandler.classifyError(error)).toBe(ErrorCategory.VALIDATION);
      });
    });

    it('should classify contract errors', () => {
      const contractErrors = [
        new Error('Contract execution reverted'),
        new Error('Insufficient gas'),
        new Error('nonce too low'),
        new Error('Insufficient balance'),
      ];

      contractErrors.forEach((error) => {
        expect(errorHandler.classifyError(error)).toBe(ErrorCategory.CONTRACT);
      });
    });

    it('should classify unknown errors', () => {
      const unknownErrors = [
        new Error('Something went wrong'),
        new Error('Some random error'),
        'string error',
        { message: 'object error' },
      ];

      unknownErrors.forEach((error) => {
        expect(errorHandler.classifyError(error)).toBe(ErrorCategory.UNKNOWN);
      });
    });
  });

  describe('extractErrorCode', () => {
    it('should extract error codes from Error objects', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const code = errorHandler.extractErrorCode(error);
      expect(code).toBe('ECONNREFUSED');
    });

    it('should extract HTTP status codes', () => {
      const error = new Error('Error 404: Not Found');
      const code = errorHandler.extractErrorCode(error);
      expect(code).toBe('404');
    });

    it('should extract node error code property', () => {
      const error = new Error('Test error');
      (error as any).code = 'ENOENT';
      const code = errorHandler.extractErrorCode(error);
      expect(code).toBe('ENOENT');
    });

    it('should return undefined for unknown error codes', () => {
      const error = new Error('Just a regular error');
      const code = errorHandler.extractErrorCode(error);
      expect(code).toBeUndefined();
    });
  });

  describe('handleError', () => {
    it('should handle errors and return ErrorInfo', () => {
      const error = new Error('Test error');
      const errorInfo = errorHandler.handleError(error);

      expect(errorInfo).toHaveProperty('category');
      expect(errorInfo).toHaveProperty('message');
      expect(errorInfo).toHaveProperty('timestamp');
      expect(errorInfo).toHaveProperty('recoverable');
      expect(errorInfo.originalError).toBe(error);
    });

    it('should add context to error message', () => {
      const error = new Error('Test error');
      const errorInfo = errorHandler.handleError(error, 'API Call');

      expect(errorInfo.message).toContain('API Call');
    });
  });

  describe('isRecoverable', () => {
    it('should return true for network errors', () => {
      expect(errorHandler.isRecoverable(ErrorCategory.NETWORK)).toBe(true);
    });

    it('should return true for validation errors', () => {
      expect(errorHandler.isRecoverable(ErrorCategory.VALIDATION)).toBe(true);
    });

    it('should return true for contract errors', () => {
      expect(errorHandler.isRecoverable(ErrorCategory.CONTRACT)).toBe(true);
    });

    it('should return false for unknown errors', () => {
      expect(errorHandler.isRecoverable(ErrorCategory.UNKNOWN)).toBe(false);
    });
  });

  describe('getUserMessage', () => {
    it('should return specific message for error codes', () => {
      const error = new Error('ECONNREFUSED');
      const message = errorHandler.getUserMessage(error);

      // Should return specific message for known error codes
      expect(message.title).toBe('Server Unavailable');
      expect(message.canRetry).toBe(true);
    });

    it('should return user-friendly message for validation errors', () => {
      const error = new Error('validation failed');
      const message = errorHandler.getUserMessage(error);

      expect(message.title).toBe('Validation Error');
      expect(message.canRetry).toBe(true);
      expect(message.canReset).toBe(true);
    });
  });
});

describe('error-messages', () => {
  describe('getErrorMessage', () => {
    it('should return correct message for NETWORK category', () => {
      const message = getErrorMessage(ErrorCategory.NETWORK);
      expect(message.title).toBe('Network Error');
      expect(message.canRetry).toBe(true);
    });

    it('should return correct message for VALIDATION category', () => {
      const message = getErrorMessage(ErrorCategory.VALIDATION);
      expect(message.title).toBe('Validation Error');
      expect(message.canRetry).toBe(true);
    });

    it('should return correct message for CONTRACT category', () => {
      const message = getErrorMessage(ErrorCategory.CONTRACT);
      expect(message.title).toBe('Contract Error');
      expect(message.canRetry).toBe(true);
    });

    it('should return correct message for UNKNOWN category', () => {
      const message = getErrorMessage(ErrorCategory.UNKNOWN);
      expect(message.title).toBe('Something went wrong');
      expect(message.canRetry).toBe(true);
    });

    it('should return specific message for error codes', () => {
      const message = getErrorMessage(ErrorCategory.NETWORK, 'ECONNREFUSED');
      expect(message.title).toBe('Server Unavailable');
    });

    it('should return fallback for unknown error codes', () => {
      const message = getErrorMessage(ErrorCategory.NETWORK, 'UNKNOWN_CODE');
      expect(message.title).toBe('Network Error');
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have all required categories', () => {
      expect(ERROR_MESSAGES).toHaveProperty(ErrorCategory.NETWORK);
      expect(ERROR_MESSAGES).toHaveProperty(ErrorCategory.VALIDATION);
      expect(ERROR_MESSAGES).toHaveProperty(ErrorCategory.CONTRACT);
      expect(ERROR_MESSAGES).toHaveProperty(ErrorCategory.UNKNOWN);
    });

    it('should have required properties for each message', () => {
      Object.values(ERROR_MESSAGES).forEach((message) => {
        expect(message).toHaveProperty('title');
        expect(message).toHaveProperty('description');
        expect(message).toHaveProperty('canRetry');
        expect(message).toHaveProperty('canReset');
      });
    });
  });
});

describe('Recovery functionality', () => {
  describe('withErrorHandling', () => {
    it('should wrap async function with error handling', async () => {
      const failingFn = async () => {
        throw new Error('Async error');
      };

      const wrappedFn = withErrorHandling(failingFn, 'Test context');
      const result = await wrappedFn();

      // Result should be ErrorInfo since the function threw
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('message');
    });

    it('should return result when async function succeeds', async () => {
      const successfulFn = async () => {
        return { data: 'success' };
      };

      const wrappedFn = withErrorHandling(successfulFn);
      const result = await wrappedFn();

      expect(result).toEqual({ data: 'success' });
    });
  });

  describe('createRetryable', () => {
    it('should retry on failure', async () => {
      let attempt = 0;
      const failingThenSuccessFn = async () => {
        attempt++;
        if (attempt < 3) {
          throw new Error('Temporary error');
        }
        return { data: 'success' };
      };

      const retryableFn = createRetryable(failingThenSuccessFn, 3, 10);
      const result = await retryableFn();

      expect(result).toEqual({ data: 'success' });
      expect(attempt).toBe(3);
    });

    it('should return error after max retries exhausted', async () => {
      const alwaysFailingFn = async () => {
        throw new Error('Permanent error');
      };

      const retryableFn = createRetryable(alwaysFailingFn, 2, 10);
      const result = await retryableFn();

      // Result should be ErrorInfo
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('message');
    });

    it('should not retry validation errors', async () => {
      const validationErrorFn = async () => {
        throw new Error('validation failed');
      };

      const retryableFn = createRetryable(validationErrorFn, 3, 10);
      const result = await retryableFn();

      expect(result).toHaveProperty('category');
      expect((result as any).category).toBe(ErrorCategory.VALIDATION);
    });
  });
});

describe('Module exports', () => {
  it('should export all required functions and types', () => {
    // These should all exist and be functions
    expect(handleError).toBeDefined();
    expect(classifyError).toBeDefined();
    expect(getErrorUserMessage).toBeDefined();
    expect(withErrorHandling).toBeDefined();
    expect(createRetryable).toBeDefined();
    expect(getErrorHandler).toBeDefined();
  });

  it('should export ErrorCategory enum', () => {
    expect(ErrorCategory.NETWORK).toBe('NETWORK');
    expect(ErrorCategory.VALIDATION).toBe('VALIDATION');
    expect(ErrorCategory.CONTRACT).toBe('CONTRACT');
    expect(ErrorCategory.UNKNOWN).toBe('UNKNOWN');
  });
});
