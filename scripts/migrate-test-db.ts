import { execSync } from 'child_process';
import { assertDatabaseIsolation, parseDatabaseUrl } from '../tests/helpers/testDatabase';
import { ENV } from '../server/config/env';

async function main() {
  console.log('🔄 [GameHub AI] Aplicando migrações na branch testing do Neon...\n');

  try {
    // 1. Rigorous safety assertion before running any migration
    const isolation = assertDatabaseIsolation();
    const testDirectUrl = process.env.TEST_DIRECT_URL || ENV.TEST_DIRECT_URL;

    if (!testDirectUrl) {
      throw new Error('TEST_DIRECT_URL não está configurada para migrations de teste.');
    }

    const testDirectInfo = parseDatabaseUrl(testDirectUrl);
    if (isolation.prodEndpoint && testDirectInfo.endpointId === isolation.prodEndpoint) {
      throw new Error(
        `BLOQUEIO: TEST_DIRECT_URL aponta para o endpoint da branch de produção (${isolation.prodEndpoint})!`
      );
    }

    console.log(`🛡️ Endpoint de destino para migrations: ${testDirectInfo.endpointId} (${testDirectInfo.host})`);
    console.log('⚡ Executando prisma migrate deploy na branch testing...');

    // 2. Execute prisma migrate deploy with strictly scoped environment variables
    const scopedEnv = {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL || ENV.TEST_DATABASE_URL,
      DIRECT_URL: testDirectUrl,
    };

    const output = execSync('npx prisma migrate deploy', {
      env: scopedEnv,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    console.log(output);
    console.log('✅ Migrações da branch testing aplicadas com sucesso sem tocar em production!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ [ERRO DE MIGRAÇÃO]:', err.message);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
    process.exit(1);
  }
}

main();
