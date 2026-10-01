import { requestContext } from './middleware/requestId';

interface LogEntry {
  level: string;
  timestamp: string;
  requestId?: string;
  message: string;
  [key: string]: any;
}

const formatLogEntry = (level: string, message: string, data?: Record<string, any>): LogEntry => {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...data,
  };

  // Extract requestId from AsyncLocalStorage context if available
  const store = requestContext.getStore();
  if (store?.requestId) {
    entry.requestId = store.requestId;
  }

  return entry;
};

export const logger = {
  info: (message: string, data?: Record<string, any>) => {
    console.info(JSON.stringify(formatLogEntry('info', message, data)));
  },
  warn: (message: string, data?: Record<string, any>) => {
    console.warn(JSON.stringify(formatLogEntry('warn', message, data)));
  },
  error: (message: string, error?: Error, data?: Record<string, any>) => {
    const errorData = error ? { error: error.message, stack: error.stack } : {};
    console.error(JSON.stringify(formatLogEntry('error', message, { ...errorData, ...data })));
  },
  debug: (message: string, data?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.debug(JSON.stringify(formatLogEntry('debug', message, data)));
    }
  },
};
