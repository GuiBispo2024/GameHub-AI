import { PrismaClient } from '@prisma/client';
import { ENV, getActiveDatabaseUrl } from '../config/env';

// Global declaration for singleton PrismaClient during dev hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const activeUrl = getActiveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: activeUrl ? { db: { url: activeUrl } } : undefined,
    log: ENV.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (ENV.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export interface DatabaseStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'PENDING_CONFIGURATION' | 'ERROR';
  engine: string;
  provider: string;
  connected: boolean;
  message: string;
}

/**
 * Checks the real status of the PostgreSQL database connection.
 * Does not expose sensitive hostnames, credentials, or internal topology.
 */
export async function checkDatabaseConnection(): Promise<DatabaseStatus> {
  const rawDbUrl = ENV.DATABASE_URL?.trim() || '';

  const hasDbUrl = Boolean(
    rawDbUrl !== '' &&
      !rawDbUrl.includes('localhost:5432') &&
      !rawDbUrl.includes('ep-xyz-pooler')
  );

  if (!hasDbUrl) {
    return {
      status: 'PENDING_CONFIGURATION',
      engine: 'PostgreSQL',
      provider: 'Prisma ORM 6.19.3',
      connected: false,
      message: 'DATABASE_URL pendente de configuração.',
    };
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout (4000ms)')), 4000)
    );

    await Promise.race([prisma.$queryRaw`SELECT 1`, timeoutPromise]);

    return {
      status: 'CONNECTED',
      engine: 'PostgreSQL',
      provider: 'Prisma ORM 6.19.3',
      connected: true,
      message: 'Conexão com PostgreSQL ativa e operacional.',
    };
  } catch (err: unknown) {
    return {
      status: 'DISCONNECTED',
      engine: 'PostgreSQL',
      provider: 'Prisma ORM 6.19.3',
      connected: false,
      message: 'Falha ao conectar com o banco de dados.',
    };
  }
}
