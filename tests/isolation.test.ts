import { describe, it, expect } from 'vitest';
import {
  parseDatabaseUrl,
  validateDatabaseIsolation,
  assertDatabaseIsolation,
  verifyTestConnection,
} from './helpers/testDatabase';
import { prisma } from '../server/db/prisma';
import { PrismaClient } from '@prisma/client';
import { ENV } from '../server/config/env';

describe('GameHub AI — Proteção e Isolamento do Banco de Testes (Tarefa 3.1)', () => {
  const prodSampleUrl =
    'postgresql://neondb_owner:secret@ep-cool-shape-b6zsblhp-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';
  const prodDirectSampleUrl =
    'postgresql://neondb_owner:secret@ep-cool-shape-b6zsblhp.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';
  const testSampleUrl =
    'postgresql://neondb_owner:secret@ep-cool-salad-b6cynjgj-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';

  // 1. Parser de URLs do Neon
  it('1. Deve extrair corretamente endpoint, database e modo de pooling de URLs do Neon', () => {
    const prodInfo = parseDatabaseUrl(prodSampleUrl);
    expect(prodInfo.endpointId).toBe('ep-cool-shape-b6zsblhp');
    expect(prodInfo.database).toBe('neondb');
    expect(prodInfo.isPooler).toBe(true);

    const directInfo = parseDatabaseUrl(prodDirectSampleUrl);
    expect(directInfo.endpointId).toBe('ep-cool-shape-b6zsblhp');
    expect(directInfo.isPooler).toBe(false);

    const testInfo = parseDatabaseUrl(testSampleUrl);
    expect(testInfo.endpointId).toBe('ep-cool-salad-b6cynjgj');
    expect(testInfo.isPooler).toBe(true);
  });

  // 2. Bloqueio quando TEST_DATABASE_URL não estiver configurada
  it('2. Deve bloquear execução quando TEST_DATABASE_URL estiver vazia ou ausente', () => {
    const result = validateDatabaseIsolation({
      testUrl: '',
      prodUrl: prodSampleUrl,
      nodeEnv: 'test',
    });

    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/TEST_DATABASE_URL não configurada/i);
    expect(result.reason).toMatch(/proibida/i);
  });

  // 3. Bloqueio quando TEST_DATABASE_URL for idêntica à DATABASE_URL
  it('3. Deve bloquear execução quando TEST_DATABASE_URL e DATABASE_URL forem idênticas', () => {
    const result = validateDatabaseIsolation({
      testUrl: prodSampleUrl,
      prodUrl: prodSampleUrl,
      nodeEnv: 'test',
    });

    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/são idênticas/i);
    expect(result.reason).toMatch(/impedir escrita no banco de produção/i);
  });

  // 4. Bloqueio quando as URLs apontarem para o mesmo endpoint do Neon (mesmo com pooling diferente)
  it('4. Deve bloquear execução quando as URLs apontarem para a mesma branch do Neon mesmo com portas ou poolers diferentes', () => {
    const result = validateDatabaseIsolation({
      testUrl: prodDirectSampleUrl, // Mesmo endpoint ep-cool-shape-b6zsblhp
      prodUrl: prodSampleUrl,
      nodeEnv: 'test',
    });

    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/mesmo endpoint compute do Neon/i);
    expect(result.prodEndpoint).toBe(result.testEndpoint);
  });

  // 5. Bloqueio quando NODE_ENV não for 'test'
  it('5. Deve bloquear execução se NODE_ENV for diferente de test', () => {
    const result = validateDatabaseIsolation({
      testUrl: testSampleUrl,
      prodUrl: prodSampleUrl,
      nodeEnv: 'production',
    });

    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/NODE_ENV deve ser 'test'/i);
  });

  // 6. Aprovação quando as branches forem comprovadamente distintas
  it('6. Deve autorizar execução quando as branches do Neon forem comprovadamente distintas', () => {
    const result = validateDatabaseIsolation({
      testUrl: testSampleUrl,
      prodUrl: prodSampleUrl,
      nodeEnv: 'test',
    });

    expect(result.safe).toBe(true);
    expect(result.prodEndpoint).toBe('ep-cool-shape-b6zsblhp');
    expect(result.testEndpoint).toBe('ep-cool-salad-b6cynjgj');
    expect(result.prodEndpoint).not.toBe(result.testEndpoint);
  });

  // 7. Validação real das variáveis ativas no ambiente
  it('7. Deve comprovar que as variáveis ativas no ambiente pertencem a endpoints distintos', () => {
    const isolation = assertDatabaseIsolation();
    expect(isolation.safe).toBe(true);
    expect(isolation.testEndpoint).toBeDefined();
    expect(isolation.prodEndpoint).toBeDefined();
    expect(isolation.testEndpoint).not.toBe(isolation.prodEndpoint);
  });

  // 8. Consulta real ao banco de testes confirmando endpoint e versão do PostgreSQL
  it('8. Deve conectar com a branch testing do Neon e responder a consultas SQL reais', async () => {
    const conn = await verifyTestConnection(prisma);
    expect(conn.connected).toBe(true);
    expect(conn.database).toBe('neondb');
    expect(conn.version).toMatch(/PostgreSQL/i);
  });

  // 9. Comprovação de isolamento físico entre branch testing e branch production
  it('9. Deve persistir um usuário de teste exclusivamente na branch testing sem afetar production', async () => {
    const isolationUser = {
      email: `isolation_probe_${Date.now()}@gamehub-test.local`,
      username: `probe_${Date.now()}`,
      passwordHash: 'dummy_hash_for_isolation_test',
    };

    // 1. Criar registro via Prisma Client ativo (que deve apontar para testing)
    const createdUser = await prisma.user.create({
      data: isolationUser,
    });
    expect(createdUser.id).toBeDefined();

    // 2. Conectar explicitamente à branch de produção para verificar se o usuário vazou
    const prodClient = new PrismaClient({
      datasources: { db: { url: ENV.DATABASE_URL } },
    });

    try {
      const userInProd = await prodClient.user.findUnique({
        where: { email: isolationUser.email },
        select: { id: true, email: true },
      });

      // CRÍTICO: O usuário NÃO deve existir na branch de produção!
      expect(userInProd).toBeNull();
    } finally {
      await prodClient.$disconnect();
    }

    // 3. Exclusão controlada do registro criado no banco de testes
    await prisma.user.delete({
      where: { id: createdUser.id },
    });

    // 4. Confirmar que foi excluído do banco de testes
    const userInTestAfterDelete = await prisma.user.findUnique({
      where: { id: createdUser.id },
    });
    expect(userInTestAfterDelete).toBeNull();
  });
});
