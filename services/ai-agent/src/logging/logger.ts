export function redactForLog(record: any): any {
  if (record === null || record === undefined) {
    return record;
  }

  if (Array.isArray(record)) {
    return record.map(redactForLog);
  }

  if (typeof record === 'object') {
    if (record instanceof Date) {
      return record;
    }
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key.toLowerCase() === 'prompt' || key.toLowerCase() === 'freetext') {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactForLog(value);
      }
    }
    return redacted;
  }

  return record;
}

export const log = {
  info: (data: any, message: string) => {
    const logEntry = {
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      ...redactForLog(data),
    };
    console.info(JSON.stringify(logEntry));
  },
  error: (data: any, message: string) => {
    const logEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      ...redactForLog(data),
    };
    console.error(JSON.stringify(logEntry));
  },
  debug: (data: any, message: string) => {
    const logEntry = {
      level: 'debug',
      timestamp: new Date().toISOString(),
      message,
      ...redactForLog(data),
    };
    // Even in debug mode, prompt is redacted by redactForLog
    if (process.env.DEBUG === 'true') {
      console.debug(JSON.stringify(logEntry));
    }
  },
};
