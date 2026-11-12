/**
 * Structured Logger for GameHub AI
 * Masks sensitive keys (passwords, JWTs, secrets) in logs and provides uniform log levels.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'confirmpassword',
  'token',
  'jwt',
  'gamehub_token',
  'secret',
  'jwt_secret',
  'passwordhash',
  'database_url',
  'direct_url',
  'authorization',
  'cookie',
]);

function maskSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Mask potential JWT tokens or Bearer headers
    if (data.startsWith('Bearer ') || data.split('.').length === 3) {
      return '[REDACTED_TOKEN]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = maskSensitiveData(val);
      }
    }
    return sanitized;
  }

  return data;
}

export const logger = {
  info(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    if (meta !== undefined) {
      console.log(`[${timestamp}] [INFO] ${message}`, JSON.stringify(maskSensitiveData(meta)));
    } else {
      console.log(`[${timestamp}] [INFO] ${message}`);
    }
  },

  warn(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    if (meta !== undefined) {
      console.warn(`[${timestamp}] [WARN] ${message}`, JSON.stringify(maskSensitiveData(meta)));
    } else {
      console.warn(`[${timestamp}] [WARN] ${message}`);
    }
  },

  error(message: string, err?: any) {
    const timestamp = new Date().toISOString();
    const errorDetails = err instanceof Error
      ? { name: err.name, message: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined }
      : maskSensitiveData(err);

    console.error(`[${timestamp}] [ERROR] ${message}`, errorDetails ? JSON.stringify(errorDetails) : '');
  },

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      const timestamp = new Date().toISOString();
      if (meta !== undefined) {
        console.debug(`[${timestamp}] [DEBUG] ${message}`, JSON.stringify(maskSensitiveData(meta)));
      } else {
        console.debug(`[${timestamp}] [DEBUG] ${message}`);
      }
    }
  },
};
