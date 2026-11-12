import {
  NormalizedGame,
  SearchGamesQuery,
  SearchGamesResult,
  GenreItem,
  PlatformItem,
} from '../games.types';

export interface GameCatalogProvider {
  /**
   * Searches games by title and optional filters with pagination
   */
  searchGames(query: SearchGamesQuery): Promise<SearchGamesResult>;

  /**
   * Fetches detailed game information by external IGDB ID
   */
  getGameByIgdbId(igdbId: number): Promise<NormalizedGame | null>;

  /**
   * Lists available gaming genres
   */
  getGenres(): Promise<GenreItem[]>;

  /**
   * Lists available gaming platforms
   */
  getPlatforms(): Promise<PlatformItem[]>;
}
