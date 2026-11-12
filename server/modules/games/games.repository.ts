import { prisma } from '../../db/prisma';
import { NormalizedGame } from './games.types';
import { ENV } from '../../config/env';
import { logger } from '../../utils/logger';

export class GamesRepository {
  /**
   * Helper to check if a cached game is still considered fresh according to TTL
   */
  static isCacheFresh(updatedAt: Date | string, ttlHours: number = ENV.GAME_CACHE_TTL_HOURS): boolean {
    const lastUpdated = new Date(updatedAt).getTime();
    if (isNaN(lastUpdated)) return false;
    const ttlMs = ttlHours * 60 * 60 * 1000;
    return Date.now() - lastUpdated < ttlMs;
  }

  /**
   * Maps Prisma database entity to NormalizedGame domain structure
   */
  static toNormalized(dbGame: any): NormalizedGame {
    return {
      id: dbGame.id,
      igdbId: dbGame.igdbId,
      title: dbGame.name,
      slug: dbGame.slug,
      summary: dbGame.summary ?? null,
      storyline: dbGame.storyline ?? null,
      coverUrl: dbGame.coverUrl ?? null,
      backdropUrl: dbGame.backdropUrl ?? null,
      rating: dbGame.rating ?? null,
      releaseDate: dbGame.releaseDate ? new Date(dbGame.releaseDate).toISOString().split('T')[0] : null,
      genres: dbGame.genres || [],
      platforms: dbGame.platforms || [],
      developer: dbGame.developer ?? null,
      publisher: dbGame.publisher ?? null,
      createdAt: dbGame.createdAt ? new Date(dbGame.createdAt).toISOString() : undefined,
      updatedAt: dbGame.updatedAt ? new Date(dbGame.updatedAt).toISOString() : undefined,
    };
  }

  /**
   * Finds game in local PostgreSQL database by internal UUID
   */
  async findById(id: string) {
    return prisma.game.findUnique({
      where: { id },
    });
  }

  /**
   * Finds game in local PostgreSQL database by external IGDB ID
   */
  async findByIgdbId(igdbId: number) {
    return prisma.game.findUnique({
      where: { igdbId },
    });
  }

  /**
   * Finds game by unique slug
   */
  async findBySlug(slug: string) {
    return prisma.game.findUnique({
      where: { slug },
    });
  }

  /**
   * Upserts game into PostgreSQL caching layer.
   * If a slug conflict occurs with a different game, generates an IGDB-suffixed unique slug.
   */
  async upsertGame(game: NormalizedGame): Promise<NormalizedGame> {
    try {
      let slug = game.slug || `game-${game.igdbId}`;
      const existingSlugRecord = await prisma.game.findUnique({
        where: { slug },
        select: { id: true, igdbId: true },
      });

      if (existingSlugRecord && existingSlugRecord.igdbId !== game.igdbId) {
        slug = `${slug}-${game.igdbId}`;
      }

      let parsedReleaseDate: Date | null = null;
      if (game.releaseDate) {
        try {
          const parsed = new Date(game.releaseDate);
          if (!isNaN(parsed.getTime())) {
            parsedReleaseDate = parsed;
          }
        } catch {}
      }

      const upserted = await prisma.game.upsert({
        where: { igdbId: game.igdbId },
        update: {
          name: game.title,
          slug,
          summary: game.summary,
          storyline: game.storyline,
          coverUrl: game.coverUrl,
          backdropUrl: game.backdropUrl,
          rating: game.rating,
          releaseDate: parsedReleaseDate,
          genres: game.genres,
          platforms: game.platforms,
          developer: game.developer,
          publisher: game.publisher,
          updatedAt: new Date(),
        },
        create: {
          igdbId: game.igdbId,
          name: game.title,
          slug,
          summary: game.summary,
          storyline: game.storyline,
          coverUrl: game.coverUrl,
          backdropUrl: game.backdropUrl,
          rating: game.rating,
          releaseDate: parsedReleaseDate,
          genres: game.genres,
          platforms: game.platforms,
          developer: game.developer,
          publisher: game.publisher,
        },
      });

      return GamesRepository.toNormalized(upserted);
    } catch (err) {
      logger.error(`Erro ao salvar cache do jogo ${game.title} (IGDB ID: ${game.igdbId}):`, err);
      // In case of transient db error, return original game
      return game;
    }
  }

  /**
   * Batch upserts multiple games without blocking the main search response
   */
  async batchCacheGames(games: NormalizedGame[]): Promise<NormalizedGame[]> {
    const results: NormalizedGame[] = [];
    for (const game of games) {
      const persisted = await this.upsertGame(game);
      results.push(persisted);
    }
    return results;
  }
}
