import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env
dotenv.config();

// Auto-populate env from running server process if running in container subshell (e.g. tests or CLI)
if (!process.env.DATABASE_URL || !process.env.TEST_DATABASE_URL) {
  try {
    const pids = fs.readdirSync('/proc').filter((f) => /^\d+$/.test(f));
    for (const pid of pids) {
      try {
        const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
        if (cmd.includes('server.ts')) {
          const envData = fs.readFileSync(`/proc/${pid}/environ`, 'utf8');
          for (const line of envData.split('\0')) {
            const [k, ...v] = line.split('=');
            if (
              ['DATABASE_URL', 'DIRECT_URL', 'TEST_DATABASE_URL', 'TEST_DIRECT_URL', 'JWT_SECRET', 'GEMINI_API_KEY', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'GAME_CACHE_TTL_HOURS'].includes(k) &&
              !process.env[k]
            ) {
              process.env[k] = v.join('=');
            }
          }
          break;
        }
      } catch {}
    }
  } catch {}
}

export const ENV = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  // Production branch connections (default runtime)
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  // Testing branch connections (exclusive to test runs)
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || '',
  TEST_DIRECT_URL: process.env.TEST_DIRECT_URL || process.env.TEST_DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'gamehub_default_secret_key',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID || '',
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET || '',
  GAME_CACHE_TTL_HOURS: parseInt(process.env.GAME_CACHE_TTL_HOURS || '24', 10),
};

/**
 * Returns the active database URL based on the execution context.
 * In test mode, strictly requires TEST_DATABASE_URL and blocks fallback to production.
 */
export function getActiveDatabaseUrl(): string {
  if (process.env.NODE_ENV === 'test') {
    const testUrl = process.env.TEST_DATABASE_URL || ENV.TEST_DATABASE_URL;
    if (!testUrl || testUrl.trim() === '') {
      throw new Error(
        'BLOQUEIO DE SEGURANÇA: TEST_DATABASE_URL não está configurada. A execução de testes contra o banco principal (production) é proibida.'
      );
    }
    return testUrl;
  }
  return process.env.DATABASE_URL || ENV.DATABASE_URL;
}

export const isDev = ENV.NODE_ENV !== 'production';
