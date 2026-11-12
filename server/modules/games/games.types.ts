/**
 * Game Catalog Domain Types and DTOs
 */

export interface NormalizedGame {
  id?: string;               // Internal PostgreSQL UUID (when persisted)
  igdbId: number;            // External IGDB unique ID
  title: string;             // Game name
  slug: string;              // URL-friendly slug
  summary: string | null;    // Short synopsis
  storyline?: string | null; // Detailed storyline
  coverUrl: string | null;   // Full URL to IGDB cover image
  backdropUrl?: string | null;
  rating: number | null;     // Aggregated / critic rating (0-100)
  releaseDate: string | null;// ISO-8601 date string (YYYY-MM-DD)
  genres: string[];          // List of genre names
  platforms: string[];       // List of platform names
  developer?: string | null; // Primary development studio
  publisher?: string | null; // Primary publishing company
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchGamesQuery {
  query: string;
  page?: number;
  limit?: number;
  genre?: string;
  platform?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  hasNextPage: boolean;
}

export interface SearchGamesResult {
  data: NormalizedGame[];
  pagination: PaginationMeta;
}

export interface GenreItem {
  id: number;
  name: string;
  slug: string;
}

export interface PlatformItem {
  id: number;
  name: string;
  abbreviation?: string;
  slug: string;
}

export interface RawIgdbGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  aggregated_rating?: number;
  total_rating?: number;
  rating?: number;
  cover?: {
    id: number;
    image_id: string;
  };
  screenshots?: Array<{
    id: number;
    image_id: string;
  }>;
  genres?: Array<{
    id: number;
    name: string;
  }>;
  platforms?: Array<{
    id: number;
    name: string;
  }>;
  involved_companies?: Array<{
    id: number;
    developer: boolean;
    publisher: boolean;
    company: {
      id: number;
      name: string;
    };
  }>;
}
