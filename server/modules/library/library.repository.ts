import { Prisma, LibraryStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { GamesRepository } from '../games/games.repository';
import {
  LibraryEntryDTO,
  LibraryListQuery,
  LibraryStatusValue,
  LibraryStatsDTO,
} from './library.types';

export class LibraryRepository {
  /**
   * Normalizes legacy DB status values (e.g., ON_HOLD -> PAUSED) for API consistency
   */
  private static normalizeStatus(status: LibraryStatus): LibraryStatusValue {
    if (status === 'ON_HOLD') return 'PAUSED';
    return status as LibraryStatusValue;
  }

  /**
   * Maps Prisma UserGame + Game record to LibraryEntryDTO
   */
  static toDTO(record: any): LibraryEntryDTO {
    return {
      id: record.id,
      userId: record.userId,
      gameId: record.gameId,
      status: LibraryRepository.normalizeStatus(record.status),
      rating: record.rating ?? null,
      hoursPlayed: record.hoursPlayed ?? 0,
      notes: record.personalNotes ?? null,
      progressPercentage: record.progressPercentage ?? 0,
      isFavorite: Boolean(record.isFavorite),
      currentChapter: record.currentChapter ?? null,
      startedAt: record.startedAt ? new Date(record.startedAt).toISOString() : null,
      completedAt: record.completedAt ? new Date(record.completedAt).toISOString() : null,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
      game: GamesRepository.toNormalized(record.game),
    };
  }

  async findGameById(gameId: string) {
    return prisma.game.findUnique({
      where: { id: gameId },
    });
  }

  async findByUserAndGame(userId: string, gameId: string) {
    return prisma.userGame.findUnique({
      where: {
        userId_gameId: {
          userId,
          gameId,
        },
      },
      include: { game: true },
    });
  }

  async findById(id: string) {
    return prisma.userGame.findUnique({
      where: { id },
      include: { game: true },
    });
  }

  async createEntry(data: {
    userId: string;
    gameId: string;
    status: LibraryStatusValue;
    rating?: number | null;
    hoursPlayed?: number;
    personalNotes?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<LibraryEntryDTO> {
    const created = await prisma.userGame.create({
      data: {
        userId: data.userId,
        gameId: data.gameId,
        status: data.status as LibraryStatus,
        rating: data.rating ?? null,
        hoursPlayed: data.hoursPlayed ?? 0,
        personalNotes: data.personalNotes ?? null,
        startedAt: data.startedAt ?? null,
        completedAt: data.completedAt ?? null,
      },
      include: { game: true },
    });

    return LibraryRepository.toDTO(created);
  }

  async listByUser(
    userId: string,
    query: LibraryListQuery
  ): Promise<{ items: LibraryEntryDTO[]; total: number }> {
    const where: Prisma.UserGameWhereInput = {
      userId,
    };

    if (query.status) {
      if (query.status === 'PAUSED') {
        where.status = { in: ['PAUSED', 'ON_HOLD'] };
      } else {
        where.status = query.status as LibraryStatus;
      }
    }

    if (query.search) {
      where.game = {
        name: {
          contains: query.search,
          mode: 'insensitive',
        },
      };
    }

    let orderBy: Prisma.UserGameOrderByWithRelationInput[];
    switch (query.sort) {
      case 'recentlyUpdated':
        orderBy = [{ updatedAt: 'desc' }];
        break;
      case 'titleAsc':
        orderBy = [{ game: { name: 'asc' } }];
        break;
      case 'titleDesc':
        orderBy = [{ game: { name: 'desc' } }];
        break;
      case 'ratingDesc':
        orderBy = [{ rating: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }];
        break;
      case 'hoursPlayedDesc':
        orderBy = [{ hoursPlayed: 'desc' }, { updatedAt: 'desc' }];
        break;
      case 'recentlyAdded':
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    // Fetch filtered records from DB; apply case-insensitive substring matching for genre/platform arrays
    // (since IGDB stores values like "Role-playing (RPG)" or "PC (Microsoft Windows)")
    const hasArrayFilters = Boolean(query.genre || query.platform);

    if (!hasArrayFilters) {
      const skip = (query.page - 1) * query.limit;
      const [records, total] = await Promise.all([
        prisma.userGame.findMany({
          where,
          include: { game: true },
          orderBy,
          skip,
          take: query.limit,
        }),
        prisma.userGame.count({ where }),
      ]);

      return {
        items: records.map(LibraryRepository.toDTO),
        total,
      };
    }

    // With genre/platform array substring filters
    const allMatching = await prisma.userGame.findMany({
      where,
      include: { game: true },
      orderBy,
    });

    const genreLower = query.genre?.toLowerCase();
    const platformLower = query.platform?.toLowerCase();

    const filtered = allMatching.filter((entry) => {
      if (genreLower) {
        const matchesGenre = (entry.game.genres || []).some((g) =>
          g.toLowerCase().includes(genreLower)
        );
        if (!matchesGenre) return false;
      }
      if (platformLower) {
        const matchesPlatform = (entry.game.platforms || []).some((p) =>
          p.toLowerCase().includes(platformLower)
        );
        if (!matchesPlatform) return false;
      }
      return true;
    });

    const total = filtered.length;
    const skip = (query.page - 1) * query.limit;
    const paged = filtered.slice(skip, skip + query.limit);

    return {
      items: paged.map(LibraryRepository.toDTO),
      total,
    };
  }

  async updateEntry(
    id: string,
    data: {
      status?: LibraryStatusValue;
      rating?: number | null;
      hoursPlayed?: number;
      personalNotes?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    }
  ): Promise<LibraryEntryDTO> {
    // Strictly update only permitted fields; userId and gameId are never mutable
    const updatePayload: Prisma.UserGameUpdateInput = {};

    if (data.status !== undefined) {
      updatePayload.status = data.status as LibraryStatus;
    }
    if (data.rating !== undefined) {
      updatePayload.rating = data.rating;
    }
    if (data.hoursPlayed !== undefined) {
      updatePayload.hoursPlayed = data.hoursPlayed;
    }
    if (data.personalNotes !== undefined) {
      updatePayload.personalNotes = data.personalNotes;
    }
    if (data.startedAt !== undefined) {
      updatePayload.startedAt = data.startedAt;
    }
    if (data.completedAt !== undefined) {
      updatePayload.completedAt = data.completedAt;
    }

    const updated = await prisma.userGame.update({
      where: { id },
      data: updatePayload,
      include: { game: true },
    });

    return LibraryRepository.toDTO(updated);
  }

  async countDependentJourneys(userGameId: string): Promise<number> {
    return prisma.gameplayJourney.count({
      where: { userGameId },
    });
  }

  async deleteEntry(id: string): Promise<void> {
    await prisma.userGame.delete({
      where: { id },
    });
  }

  async getStatsByUser(userId: string): Promise<LibraryStatsDTO> {
    const entries = await prisma.userGame.findMany({
      where: { userId },
      select: {
        status: true,
        rating: true,
        hoursPlayed: true,
      },
    });

    const byStatus: Record<LibraryStatusValue, number> = {
      WISHLIST: 0,
      BACKLOG: 0,
      PLAYING: 0,
      COMPLETED: 0,
      PAUSED: 0,
      DROPPED: 0,
    };

    let totalHours = 0;
    let ratingSum = 0;
    let ratedCount = 0;

    for (const entry of entries) {
      const normalizedStatus = LibraryRepository.normalizeStatus(entry.status);
      if (normalizedStatus in byStatus) {
        byStatus[normalizedStatus]++;
      }

      totalHours += entry.hoursPlayed || 0;

      if (entry.rating !== null && entry.rating !== undefined) {
        ratingSum += entry.rating;
        ratedCount++;
      }
    }

    const averageRating =
      ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : null;

    return {
      totalGames: entries.length,
      completedCount: byStatus.COMPLETED,
      totalHoursPlayed: Math.round(totalHours * 10) / 10,
      averageRating,
      ratedGamesCount: ratedCount,
      byStatus,
    };
  }
}
