import { GameCatalogProvider } from './game-catalog.provider';
import {
  NormalizedGame,
  SearchGamesQuery,
  SearchGamesResult,
  GenreItem,
  PlatformItem,
  RawIgdbGame,
} from '../games.types';
import { TwitchAuthService } from './twitch-auth.service';
import { ENV } from '../../../config/env';
import { logger } from '../../../utils/logger';

export class IgdbCatalogProvider implements GameCatalogProvider {
  private static readonly BASE_URL = 'https://api.igdb.com/v4';
  private static readonly REQUEST_TIMEOUT_MS = 10000;

  /**
   * Helper to build verified IGDB image URLs using official CDN endpoints.
   */
  static buildImageUrl(
    imageId?: string | null,
    size: 'cover_big' | 'cover_small' | '720p' | '1080p' | 'screenshot_big' = 'cover_big'
  ): string | null {
    if (!imageId || typeof imageId !== 'string' || imageId.trim() === '') {
      return null;
    }
    return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId.trim()}.jpg`;
  }

  /**
   * Normalizes raw IGDB API entities into GameHub AI domain model.
   */
  static normalizeGame(raw: RawIgdbGame): NormalizedGame {
    const genres = (raw.genres || []).map((g) => g.name).filter(Boolean);
    const platforms = (raw.platforms || []).map((p) => p.name).filter(Boolean);

    let developer: string | null = null;
    let publisher: string | null = null;

    if (raw.involved_companies && Array.isArray(raw.involved_companies)) {
      for (const ic of raw.involved_companies) {
        if (ic.developer && ic.company?.name && !developer) {
          developer = ic.company.name;
        }
        if (ic.publisher && ic.company?.name && !publisher) {
          publisher = ic.company.name;
        }
      }
    }

    let releaseDate: string | null = null;
    if (raw.first_release_date && typeof raw.first_release_date === 'number') {
      try {
        const dateObj = new Date(raw.first_release_date * 1000);
        if (!isNaN(dateObj.getTime())) {
          releaseDate = dateObj.toISOString().split('T')[0];
        }
      } catch {}
    }

    const rawRating = raw.aggregated_rating ?? raw.total_rating ?? raw.rating ?? null;
    const rating = rawRating !== null ? Math.round(rawRating * 10) / 10 : null;

    const coverUrl = IgdbCatalogProvider.buildImageUrl(raw.cover?.image_id, 'cover_big');
    const backdropUrl = raw.screenshots?.[0]?.image_id
      ? IgdbCatalogProvider.buildImageUrl(raw.screenshots[0].image_id, '1080p')
      : IgdbCatalogProvider.buildImageUrl(raw.cover?.image_id, '1080p');

    const slug = raw.slug || raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `game-${raw.id}`;

    return {
      igdbId: raw.id,
      title: raw.name,
      slug,
      summary: raw.summary || null,
      storyline: raw.storyline || null,
      coverUrl,
      backdropUrl,
      rating,
      releaseDate,
      genres,
      platforms,
      developer,
      publisher,
    };
  }

  /**
   * Sanitizes user search input to prevent APICalypse query syntax injection.
   */
  private sanitizeSearchTerm(term: string): string {
    return term
      .replace(/["\\;]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Executes an APICalypse query against an IGDB endpoint with automatic token injection and retry.
   */
  async executeQuery<T>(endpoint: string, apicalypseBody: string, retryCount = 0): Promise<T> {
    const clientId = (ENV.TWITCH_CLIENT_ID || process.env.TWITCH_CLIENT_ID || '').trim();
    const token = await TwitchAuthService.getAccessToken();

    try {
      const response = await fetch(`${IgdbCatalogProvider.BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'text/plain',
        },
        body: apicalypseBody,
        signal: AbortSignal.timeout(IgdbCatalogProvider.REQUEST_TIMEOUT_MS),
      });

      // 401 Unauthorized: token may have expired or revoked externally -> clear cache & retry once
      if (response.status === 401 && retryCount === 0) {
        logger.warn('IGDB retornou 401 Unauthorized. Renovando token Twitch e tentando novamente...');
        TwitchAuthService.clearCache();
        return this.executeQuery<T>(endpoint, apicalypseBody, retryCount + 1);
      }

      // 429 Rate Limit
      if (response.status === 429) {
        logger.warn('IGDB Rate limit (429) atingido.');
        if (retryCount < 2) {
          const delayMs = 1000 * Math.pow(2, retryCount);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return this.executeQuery<T>(endpoint, apicalypseBody, retryCount + 1);
        }
        const rateLimitErr: any = new Error(
          'Limite de requisições à API da IGDB atingido temporariamente. Tente novamente em alguns segundos.'
        );
        rateLimitErr.statusCode = 429;
        rateLimitErr.code = 'IGDB_RATE_LIMIT';
        throw rateLimitErr;
      }

      // 5xx Server Error: transient server error -> retry with backoff
      if (response.status >= 500 && retryCount < 2) {
        const delayMs = 500 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.executeQuery<T>(endpoint, apicalypseBody, retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Erro na consulta IGDB /${endpoint} (HTTP ${response.status}): ${errorText}`);
        const err: any = new Error(
          `Falha ao consultar catálogo na IGDB (HTTP ${response.status}).`
        );
        err.statusCode = response.status >= 500 ? 502 : 400;
        err.code = 'IGDB_API_ERROR';
        throw err;
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        const timeoutErr: any = new Error('Tempo limite esgotado ao consultar a base de dados da IGDB.');
        timeoutErr.statusCode = 504;
        timeoutErr.code = 'IGDB_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * Searches games by title and optional filters with pagination
   */
  async searchGames(query: SearchGamesQuery): Promise<SearchGamesResult> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const sanitized = this.sanitizeSearchTerm(query.query);

    // Build APICalypse query:
    // Fetch limit + 1 items to determine hasNextPage without guessing total pages
    const queryLimit = limit + 1;

    let apicalypse = `fields id, name, slug, summary, storyline, cover.image_id, screenshots.image_id, first_release_date, genres.name, platforms.name, aggregated_rating, total_rating, involved_companies.developer, involved_companies.publisher, involved_companies.company.name; search "${sanitized}"; limit ${queryLimit}; offset ${offset};`;

    const rawGames = await this.executeQuery<RawIgdbGame[]>('games', apicalypse);

    const hasNextPage = rawGames.length > limit;
    let paginatedRaw = rawGames.slice(0, limit);

    // If client-side genre or platform filter requested, apply strict filter matching
    if (query.genre && query.genre.trim()) {
      const genreLower = query.genre.trim().toLowerCase();
      paginatedRaw = paginatedRaw.filter((g) =>
        (g.genres || []).some((gr) => gr.name.toLowerCase().includes(genreLower))
      );
    }

    if (query.platform && query.platform.trim()) {
      const platformLower = query.platform.trim().toLowerCase();
      paginatedRaw = paginatedRaw.filter((g) =>
        (g.platforms || []).some((pl) => pl.name.toLowerCase().includes(platformLower))
      );
    }

    const data = paginatedRaw.map(IgdbCatalogProvider.normalizeGame);

    return {
      data,
      pagination: {
        page,
        limit,
        hasNextPage,
      },
    };
  }

  /**
   * Fetches detailed game information by external IGDB ID
   */
  async getGameByIgdbId(igdbId: number): Promise<NormalizedGame | null> {
    const apicalypse = `fields id, name, slug, summary, storyline, cover.image_id, screenshots.image_id, first_release_date, genres.name, platforms.name, aggregated_rating, total_rating, involved_companies.developer, involved_companies.publisher, involved_companies.company.name; where id = ${igdbId}; limit 1;`;

    const rawGames = await this.executeQuery<RawIgdbGame[]>('games', apicalypse);

    if (!rawGames || rawGames.length === 0) {
      return null;
    }

    return IgdbCatalogProvider.normalizeGame(rawGames[0]);
  }

  /**
   * Lists available gaming genres from IGDB
   */
  async getGenres(): Promise<GenreItem[]> {
    const apicalypse = `fields id, name, slug; limit 50; sort name asc;`;
    return this.executeQuery<GenreItem[]>('genres', apicalypse);
  }

  /**
   * Lists available gaming platforms from IGDB
   */
  async getPlatforms(): Promise<PlatformItem[]> {
    const apicalypse = `fields id, name, abbreviation, slug; limit 50; sort name asc;`;
    return this.executeQuery<PlatformItem[]>('platforms', apicalypse);
  }
}
