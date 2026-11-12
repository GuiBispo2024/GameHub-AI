import { beforeAll, afterAll } from 'vitest';
import { assertDatabaseIsolation, verifyTestConnection } from './helpers/testDatabase';
import { prisma } from '../server/db/prisma';

// Ensure NODE_ENV is test
process.env.NODE_ENV = 'test';

beforeAll(async () => {
  // 1. Mandatory security check: Confirm tests are isolated to testing branch
  const isolation = assertDatabaseIsolation();
  console.log(`\n🛡️ [Test Isolation Check]: Conexão validada com sucesso!`);
  console.log(`   - Branch Production Endpoint: ${isolation.prodEndpoint || 'N/A'}`);
  console.log(`   - Branch Testing Endpoint:    ${isolation.testEndpoint}`);
  console.log(`   - Banco de Dados:             ${isolation.database}`);

  // 2. Real connectivity check to the testing branch
  const conn = await verifyTestConnection(prisma);
  if (!conn.connected) {
    throw new Error('Falha ao conectar com a branch testing do Neon PostgreSQL.');
  }
});

afterAll(async () => {
  // Gracefully close Prisma Client connection pools
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.warn('[Test Teardown Warning]: Error disconnecting Prisma Client:', err);
  }
});
