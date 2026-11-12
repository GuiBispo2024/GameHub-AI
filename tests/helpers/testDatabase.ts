import { PrismaClient } from '@prisma/client';
import { ENV } from '../../server/config/env';

export interface EndpointInfo {
  host: string;
  endpointId: string;
  database: string;
  isPooler: boolean;
}

/**
 * Parses a PostgreSQL connection URL and extracts Neon-specific endpoint identifiers.
 */
export function parseDatabaseUrl(rawUrl: string): EndpointInfo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL de conexão PostgreSQL inválida ou não fornecida.');
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname;
    const database = parsed.pathname.replace(/^\//, '');

    // Neon endpoint identifier format: ep-xyz-12345678
    const endpointMatch = host.match(/^(ep-[a-z0-9-]+?)(?:-pooler)?\./i);
    const endpointId = endpointMatch ? endpointMatch[1] : host;
    const isPooler = host.includes('-pooler');

    return {
      host,
      endpointId,
      database,
      isPooler,
    };
  } catch (err: any) {
    throw new Error(`Falha ao analisar string de conexão: ${err.message}`);
  }
}

export interface IsolationCheckResult {
  safe: boolean;
  reason?: string;
  prodEndpoint?: string;
  testEndpoint?: string;
  database?: string;
}

/**
 * Validates strict isolation between production and testing database connections.
 * Enforces all 5 safety requirements:
 * 1. TEST_DATABASE_URL must be configured.
 * 2. TEST_DATABASE_URL and DATABASE_URL must not be identical.
 * 3. Both URLs must not share the same Neon compute endpoint/branch.
 * 4. The branch destination must be clearly distinguishable.
 * 5. Environment must be explicitly set to 'test'.
 */
export function validateDatabaseIsolation(options?: {
  testUrl?: string;
  prodUrl?: string;
  nodeEnv?: string;
}): IsolationCheckResult {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  const testUrl = (options?.testUrl ?? process.env.TEST_DATABASE_URL ?? ENV.TEST_DATABASE_URL ?? '').trim();
  const prodUrl = (options?.prodUrl ?? process.env.DATABASE_URL ?? ENV.DATABASE_URL ?? '').trim();

  // 1. Strict environment verification
  if (nodeEnv !== 'test') {
    return {
      safe: false,
      reason: `Ambiente incorreto: NODE_ENV deve ser 'test' durante a execução dos testes (atual: '${nodeEnv}').`,
    };
  }

  // 2. TEST_DATABASE_URL presence
  if (!testUrl) {
    return {
      safe: false,
      reason: 'TEST_DATABASE_URL não configurada. A execução de testes contra o banco principal (production) é terminantemente proibida.',
    };
  }

  // 3. Exact URL match check
  if (prodUrl && testUrl === prodUrl) {
    return {
      safe: false,
      reason: 'TEST_DATABASE_URL e DATABASE_URL são idênticas. A execução foi interrompida para impedir escrita no banco de produção.',
    };
  }

  // 4. Neon Compute Endpoint / Branch Check
  const testInfo = parseDatabaseUrl(testUrl);

  if (prodUrl) {
    const prodInfo = parseDatabaseUrl(prodUrl);

    if (testInfo.endpointId === prodInfo.endpointId) {
      return {
        safe: false,
        reason: `Bloqueio de segurança acionado: TEST_DATABASE_URL e DATABASE_URL apontam para o mesmo endpoint compute do Neon (${testInfo.endpointId}). O ambiente de testes deve utilizar uma branch dedicada diferente da production.`,
        prodEndpoint: prodInfo.endpointId,
        testEndpoint: testInfo.endpointId,
        database: testInfo.database,
      };
    }

    return {
      safe: true,
      prodEndpoint: prodInfo.endpointId,
      testEndpoint: testInfo.endpointId,
      database: testInfo.database,
    };
  }

  return {
    safe: true,
    testEndpoint: testInfo.endpointId,
    database: testInfo.database,
  };
}

/**
 * Asserts isolation and throws fatal error if test safety is not proven.
 */
export function assertDatabaseIsolation(): IsolationCheckResult {
  const result = validateDatabaseIsolation();
  if (!result.safe) {
    throw new Error(`[ISOLATION ERROR]: ${result.reason}`);
  }
  return result;
}

/**
 * Connects to the test database and executes real verification query.
 */
export async function verifyTestConnection(prismaClient?: PrismaClient): Promise<{
  connected: boolean;
  database: string;
  endpointId: string;
  version: string;
}> {
  const isolation = assertDatabaseIsolation();
  const testUrl = process.env.TEST_DATABASE_URL || ENV.TEST_DATABASE_URL;

  const client =
    prismaClient ??
    new PrismaClient({
      datasources: { db: { url: testUrl } },
    });

  try {
    const result: any[] = await client.$queryRaw`SELECT current_database(), current_user, version()`;
    const dbInfo = result[0] || {};

    return {
      connected: true,
      database: dbInfo.current_database,
      endpointId: isolation.testEndpoint || '',
      version: dbInfo.version,
    };
  } finally {
    if (!prismaClient) {
      await client.$disconnect();
    }
  }
}
