import { ENV } from '../server/config/env';
import { TwitchAuthService } from '../server/modules/games/providers/twitch-auth.service';
import { IgdbCatalogProvider } from '../server/modules/games/providers/igdb.provider';

async function main() {
  console.log('🎮 [GameHub AI] Validação da Integração Real IGDB & Twitch OAuth\n');

  const clientId = (ENV.TWITCH_CLIENT_ID || process.env.TWITCH_CLIENT_ID || '').trim();
  const clientSecret = (ENV.TWITCH_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    console.error('❌ Credenciais TWITCH_CLIENT_ID e/ou TWITCH_CLIENT_SECRET não configuradas.');
    process.exit(1);
  }

  console.log(`🔑 Credenciais detectadas:`);
  console.log(`   - Client ID: ${clientId.slice(0, 6)}...${clientId.slice(-4)}`);
  console.log(`   - Client Secret: [CONFIGURADO COM SUCESSO]`);

  try {
    // 1. Authenticate with Twitch
    console.log('\n📡 1. Solicitando Access Token OAuth 2.0 (Twitch Developer)...');
    const token = await TwitchAuthService.getAccessToken();
    console.log(`✅ Token OAuth obtido com sucesso! Formato: Bearer (comprimento: ${token.length} chars)`);

    // 2. Query IGDB games
    console.log('\n🎮 2. Consultando jogos no endpoint oficial da IGDB (/games)...');
    const provider = new IgdbCatalogProvider();
    const searchResult = await provider.searchGames({ query: 'Elden Ring', limit: 3 });

    console.log(`✅ Consulta realizada com sucesso! Títulos retornados: ${searchResult.data.length}`);
    searchResult.data.forEach((game, idx) => {
      console.log(`   [${idx + 1}] ${game.title} (IGDB ID: ${game.igdbId})`);
      console.log(`       - Gêneros: ${game.genres.join(', ') || 'N/A'}`);
      console.log(`       - Plataformas: ${game.platforms.slice(0, 3).join(', ')}`);
      console.log(`       - Lançamento: ${game.releaseDate || 'N/A'} | Nota: ${game.rating || 'N/A'}/100`);
      console.log(`       - Capa CDN: ${game.coverUrl || 'N/A'}`);
    });

    // 3. Query Genres
    console.log('\n🏷️  3. Consultando gêneros oficiais (/genres)...');
    const genres = await provider.getGenres();
    console.log(`✅ ${genres.length} gêneros recuperados com sucesso (ex: ${genres.slice(0, 4).map((g) => g.name).join(', ')})`);

    // 4. Query Platforms
    console.log('\n💻 4. Consultando plataformas oficiais (/platforms)...');
    const platforms = await provider.getPlatforms();
    console.log(`✅ ${platforms.length} plataformas recuperadas com sucesso (ex: ${platforms.slice(0, 4).map((p) => p.name).join(', ')})`);

    console.log('\n🎉 [Sucesso Total]: A integração entre GameHub AI e a API IGDB está 100% operacional!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Falha na integração IGDB:', err.message);
    process.exit(1);
  }
}

main();
