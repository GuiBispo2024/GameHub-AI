export type NavTab = 'dashboard' | 'explore' | 'library' | 'journeys' | 'companion' | 'profile' | 'auth';

export type LibraryStatus =
  | 'WISHLIST'
  | 'BACKLOG'
  | 'PLAYING'
  | 'COMPLETED'
  | 'PAUSED'
  | 'DROPPED';

export type LibrarySortOption =
  | 'recentlyAdded'
  | 'recentlyUpdated'
  | 'titleAsc'
  | 'titleDesc'
  | 'ratingDesc'
  | 'hoursPlayedDesc';

export interface GameItem {
  id?: string;
  igdbId: number;
  title: string;
  slug: string;
  summary: string | null;
  storyline?: string | null;
  coverUrl: string | null;
  backdropUrl?: string | null;
  rating: number | null;
  releaseDate: string | null;
  genres: string[];
  platforms: string[];
  developer?: string | null;
  publisher?: string | null;
}

export interface LibraryEntry {
  id: string;
  userId: string;
  gameId: string;
  status: LibraryStatus;
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
  game: GameItem;
}

export interface LibraryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface LibraryStats {
  totalGames: number;
  completedCount: number;
  totalHoursPlayed: number;
  averageRating: number | null;
  ratedGamesCount: number;
  byStatus: Record<LibraryStatus, number>;
}

export type JourneyStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface GameplayJourney {
  id: string;
  userId: string;
  userGameId: string;
  gameId: string;
  name: string;
  characterName: string | null;
  characterClass: string | null;
  currentLevel: number | null;
  currentArea: string | null;
  currentObjective: string | null;
  progressPercentage: number;
  playtimeHours: number;
  isActive: boolean;
  isCompleted: boolean;
  status: JourneyStatus;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  progressLogsCount?: number;
  buildsCount?: number;
  game?: {
    id: string;
    igdbId: number | null;
    title: string;
    slug: string;
    coverUrl: string | null;
    genres: string[];
    platforms: string[];
    developer: string | null;
  };
}

export interface ProgressLogItem {
  id: string;
  userId: string;
  userGameId: string;
  journeyId: string | null;
  areaName: string | null;
  questName: string | null;
  description: string;
  completionPercent: number | null;
  hoursPlayedAtPoint: number;
  playerLevelAtPoint: number | null;
  createdAt: string;
}

export interface GameBuildItem {
  id: string;
  userId: string;
  gameId: string;
  journeyId: string | null;
  name: string;
  description: string | null;
  playstyle: string | null;
  attributes: Record<string, unknown>;
  equipment: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SpoilerLevel =
  | 'STRICT_NO_SPOILERS'
  | 'CURRENT_CHAPTER'
  | 'MID_GAME_SAFE'
  | 'FULL_UNRESTRICTED';

export type FriendlySpoilerLevel = 'NONE' | 'LIGHT' | 'ALL';

export interface UserPreference {
  id: string;
  userId: string;
  theme: string;
  defaultSpoilerLevel: string;
  spoilerLevelFriendly?: FriendlySpoilerLevel;
  preferredPlatforms: string[];
  preferredGenres: string[];
  language: string;
  overlayEnabled: boolean;
  overlayHotkey: string;
  notificationsEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  preferences?: UserPreference | null;
}

export interface DatabaseStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'PENDING_CONFIGURATION' | 'ERROR';
  engine: string;
  provider: string;
  connected?: boolean;
  configured?: boolean;
  message?: string;
}

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  database: DatabaseStatus;
  modules?: Record<string, string>;
}

export interface AuthResponse {
  status: 'success' | 'error';
  message?: string;
  user?: User;
  token?: string;
  errors?: Record<string, string[]>;
}
