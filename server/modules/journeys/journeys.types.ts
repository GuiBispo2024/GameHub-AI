export type JourneyStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface JourneyGameSummaryDTO {
  id: string;
  igdbId: number | null;
  title: string;
  slug: string;
  coverUrl: string | null;
  genres: string[];
  platforms: string[];
  developer: string | null;
}

export interface JourneyDTO {
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
  game?: JourneyGameSummaryDTO;
}

export interface ProgressLogDTO {
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

export interface GameBuildDTO {
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

export interface CreateJourneyInput {
  userGameId: string;
  name: string;
  characterName?: string | null;
  characterClass?: string | null;
  currentLevel?: number | null;
  currentArea?: string | null;
  currentObjective?: string | null;
  playtimeHours?: number;
  isCompleted?: boolean;
  status?: JourneyStatus;
  isActive?: boolean;
  notes?: string | null;
}

export interface UpdateJourneyInput {
  name?: string;
  characterName?: string | null;
  characterClass?: string | null;
  currentLevel?: number | null;
  currentArea?: string | null;
  currentObjective?: string | null;
  playtimeHours?: number;
  isCompleted?: boolean;
  status?: JourneyStatus;
  notes?: string | null;
}

export interface ListJourneysQuery {
  userGameId?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}

export interface JourneyListResult {
  status: 'success';
  data: JourneyDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreateProgressLogInput {
  areaName?: string | null;
  questName?: string | null;
  description: string;
  completionPercent?: number | null;
  hoursPlayedAtPoint?: number;
  playerLevelAtPoint?: number | null;
}

export interface UpdateProgressLogInput {
  areaName?: string | null;
  questName?: string | null;
  description?: string;
  completionPercent?: number | null;
  hoursPlayedAtPoint?: number;
  playerLevelAtPoint?: number | null;
}

export interface CreateGameBuildInput {
  name: string;
  description?: string | null;
  playstyle?: string | null;
  attributes?: Record<string, unknown>;
  equipment?: Record<string, unknown>;
  notes?: string | null;
}

export interface UpdateGameBuildInput {
  name?: string;
  description?: string | null;
  playstyle?: string | null;
  attributes?: Record<string, unknown>;
  equipment?: Record<string, unknown>;
  notes?: string | null;
}

export interface JourneyContextDTO {
  game: {
    id: string;
    igdbId: number | null;
    title: string;
    slug: string;
    genres: string[];
    platforms: string[];
    developer: string | null;
    publisher: string | null;
  };
  journey: {
    id: string;
    name: string;
    characterName: string | null;
    characterClass: string | null;
    currentLevel: number | null;
    currentArea: string | null;
    currentObjective: string | null;
    playtimeHours: number;
    isActive: boolean;
    isCompleted: boolean;
    status: JourneyStatus;
    notes: string | null;
  };
  builds: GameBuildDTO[];
  recentProgress: ProgressLogDTO[];
  totalProgressLogs: number;
}
