import { GameCatalogProvider } from './providers/game-catalog.provider';
import { IgdbCatalogProvider } from './providers/igdb.provider';
import { GamesRepository } from './games.repository';
import {
  NormalizedGame,
  SearchGamesQuery,
  SearchGamesResult,
  GenreItem,
  PlatformItem,
} from './games.types';
import { logger } from '../../utils/logger';

export class GamesService {
  private provider: GameCatalogProvider;
  private repository: GamesRepository;

  constructor(
    provider?: GameCatalogProvider,
    repository?: GamesRepository
  ) {
    this.provider = provider || new IgdbCatalogProvider();
    this.repository = repository || new GamesRepository();
  }

  /**
   * Searches games by title and optional filters with pagination and caching
   */
  async searchGames(query: SearchGamesQuery): Promise<SearchGamesResult> {
    const searchResult = await this.provider.searchGames(query);

    // Cache retrieved games asynchronously to populate PostgreSQL and assign internal IDs
    const enrichedData: NormalizedGame[] = [];
    for (const game of searchResult.data) {
      try {
        const cached = await this.repository.upsertGame(game);
        enrichedData.push(cached);
      } catch (err) {
        logger.warn(`Falha ao sincronizar cache para o jogo ${game.title}:`, err);
        enrichedData.push(game);
      }
    }

    return {
      data: enrichedData,
      pagination: searchResult.pagination,
    };
  }

  /**
   * Retrieves a game by its internal PostgreSQL UUID.
   * Checks cache freshness and refreshes from IGDB if stale.
   */
  async getGameById(id: string): Promise<NormalizedGame | null> {
    const cached = await this.repository.findById(id);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    if (GamesRepository.isCacheFresh(cached.updatedAt) || !cached.igdbId) {
      return GamesRepository.toNormalized(cached);
    }

    // Cache is stale -> attempt to refresh from IGDB
    try {
      const freshFromIgdb = await this.provider.getGameByIgdbId(cached.igdbId);
      if (freshFromIgdb) {
        return await this.repository.upsertGame(freshFromIgdb);
      }
    } catch (err) {
      logger.warn(`Erro ao revalidar cache do jogo ${cached.name} via IGDB:`, err);
    }

    // Graceful fallback to existing cached record
    return GamesRepository.toNormalized(cached);
  }

  /**
   * Retrieves a game by external IGDB ID.
   * Returns from cache if fresh, otherwise fetches from IGDB and caches.
   */
  async getGameByIgdbId(igdbId: number): Promise<NormalizedGame | null> {
    const cached = await this.repository.findByIgdbId(igdbId);

    if (cached && GamesRepository.isCacheFresh(cached.updatedAt)) {
      return GamesRepository.toNormalized(cached);
    }

    try {
      const freshGame = await this.provider.getGameByIgdbId(igdbId);
      if (freshGame) {
        return await this.repository.upsertGame(freshGame);
      }
    } catch (err) {
      logger.error(`Erro ao buscar jogo com IGDB ID ${igdbId}:`, err);
      if (cached) {
        // Return stale cache if external API failed
        return GamesRepository.toNormalized(cached);
      }
      throw err;
    }

    if (cached) {
      return GamesRepository.toNormalized(cached);
    }

    return null;
  }

  /**
   * Lists available gaming genres
   */
  async getGenres(): Promise<GenreItem[]> {
    return this.provider.getGenres();
  }

  /**
   * Lists available gaming platforms
   */
  async getPlatforms(): Promise<PlatformItem[]> {
    return this.provider.getPlatforms();
  }
}
