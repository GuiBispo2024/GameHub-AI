import { assertDatabaseIsolation, verifyTestConnection } from '../tests/helpers/testDatabase';
import { ENV } from '../server/config/env';

async function main() {
  console.log('🔍 [GameHub AI] Verificando isolamento da branch testing do Neon...\n');

  try {
    const isolation = assertDatabaseIsolation();
    console.log('✅ Verificação de Segurança Aprovada:');
    console.log(`   - Branch Production Endpoint: ${isolation.prodEndpoint || 'N/A'}`);
    console.log(`   - Branch Testing Endpoint:    ${isolation.testEndpoint}`);
    console.log(`   - Banco de Dados:             ${isolation.database}`);
    console.log(`   - Modo de Execução:           Isolamento Ativo`);

    console.log('\n📡 Testando conexão ativa com a branch testing...');
    const conn = await verifyTestConnection();
    console.log(`✅ Conexão bem-sucedida!`);
    console.log(`   - PostgreSQL Version: ${conn.version.split(' ')[0]} ${conn.version.split(' ')[1]}`);
    console.log(`   - Banco:              ${conn.database}`);
    console.log(`   - Endpoint ID:        ${conn.endpointId}`);
    console.log('\n🎯 O ambiente de testes está seguro e pronto para execuções.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ [FALHA DE SEGURANÇA]:', err.message);
    process.exit(1);
  }
}

main();
