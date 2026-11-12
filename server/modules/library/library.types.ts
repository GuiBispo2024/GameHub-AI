import { NormalizedGame } from '../games/games.types';

export const LIBRARY_STATUSES = [
  'WISHLIST',
  'BACKLOG',
  'PLAYING',
  'COMPLETED',
  'PAUSED',
  'DROPPED',
] as const;

export type LibraryStatusValue = (typeof LIBRARY_STATUSES)[number];

export const LIBRARY_SORT_OPTIONS = [
  'recentlyAdded',
  'recentlyUpdated',
  'titleAsc',
  'titleDesc',
  'ratingDesc',
  'hoursPlayedDesc',
] as const;

export type LibrarySortOption = (typeof LIBRARY_SORT_OPTIONS)[number];

export interface LibraryEntryDTO {
  id: string;
  userId: string;
  gameId: string;
  status: LibraryStatusValue;
  rating: number | null;
  hoursPlayed: number;
  notes: string | null;
  progressPercentage: number;
  isFavorite: boolean;
  currentChapter: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  game: NormalizedGame;
}

export interface AddLibraryGameInput {
  gameId: string;
  status?: LibraryStatusValue;
  rating?: number | null;
  hoursPlayed?: number;
  notes?: string | null;
}

export interface UpdateLibraryGameInput {
  status?: LibraryStatusValue;
  rating?: number | null;
  hoursPlayed?: number;
  notes?: string | null;
}

export interface LibraryListQuery {
  status?: LibraryStatusValue;
  genre?: string;
  platform?: string;
  search?: string;
  sort?: LibrarySortOption;
  page: number;
  limit: number;
}

export interface LibraryPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface LibraryListResult {
  status: 'success';
  data: LibraryEntryDTO[];
  pagination: LibraryPaginationMeta;
}

export interface LibraryStatsDTO {
  totalGames: number;
  completedCount: number;
  totalHoursPlayed: number;
  averageRating: number | null;
  ratedGamesCount: number;
  byStatus: Record<LibraryStatusValue, number>;
}
