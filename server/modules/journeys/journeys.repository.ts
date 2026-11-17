import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import {
  CreateGameBuildInput,
  CreateJourneyInput,
  CreateProgressLogInput,
  GameBuildDTO,
  JourneyContextDTO,
  JourneyDTO,
  ListJourneysQuery,
  ProgressLogDTO,
  UpdateGameBuildInput,
  UpdateJourneyInput,
  UpdateProgressLogInput,
} from './journeys.types';

export class JourneysRepository {
  static toJourneyDTO(record: any): JourneyDTO {
    return {
      id: record.id,
      userId: record.userId,
      userGameId: record.userGameId,
      gameId: record.gameId,
      name: record.title,
      characterName: record.characterName ?? null,
      characterClass: record.playstyle ?? null,
      currentLevel: record.currentLevel ?? null,
      currentArea: record.currentChapter ?? null,
      currentObjective: record.currentObjective ?? null,
      progressPercentage: record.progressPercentage ?? 0,
      playtimeHours: record.playtimeHours ?? 0,
      isActive: Boolean(record.isActive),
      isCompleted: Boolean(record.isCompleted),
      status: record.isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      notes: record.notes ?? null,
      startedAt: new Date(record.startedAt).toISOString(),
      completedAt: record.completedAt ? new Date(record.completedAt).toISOString() : null,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
      ...(record._count
        ? {
            progressLogsCount: record._count.progressLogs ?? 0,
            buildsCount: record._count.builds ?? 0,
          }
        : {}),
      ...(record.game
        ? {
            game: {
              id: record.game.id,
              igdbId: record.game.igdbId ?? null,
              title: record.game.name,
              slug: record.game.slug,
              coverUrl: record.game.coverUrl ?? null,
              genres: record.game.genres || [],
              platforms: record.game.platforms || [],
              developer: record.game.developer ?? null,
            },
          }
        : {}),
    };
  }

  static toProgressLogDTO(record: any): ProgressLogDTO {
    return {
      id: record.id,
      userId: record.userId,
      userGameId: record.userGameId,
      journeyId: record.journeyId ?? null,
      areaName: record.areaName ?? null,
      questName: record.questName ?? null,
      description: record.notes || record.chapterOrCheckpoint || '',
      completionPercent: record.completionPercent ?? null,
      hoursPlayedAtPoint: record.hoursPlayedAtPoint ?? 0,
      playerLevelAtPoint: record.playerLevelAtPoint ?? null,
      createdAt: new Date(record.loggedAt).toISOString(),
    };
  }

  static toGameBuildDTO(record: any): GameBuildDTO {
    return {
      id: record.id,
      userId: record.userId,
      gameId: record.gameId,
      journeyId: record.journeyId ?? null,
      name: record.title,
      description: record.description ?? null,
      playstyle: record.playstyle ?? null,
      attributes:
        record.attributes && typeof record.attributes === 'object' && !Array.isArray(record.attributes)
          ? (record.attributes as Record<string, unknown>)
          : {},
      equipment:
        record.equipment && typeof record.equipment === 'object' && !Array.isArray(record.equipment)
          ? (record.equipment as Record<string, unknown>)
          : {},
      notes: record.tips ?? null,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async findUserGameById(userGameId: string) {
    return prisma.userGame.findUnique({
      where: { id: userGameId },
      include: { game: true },
    });
  }

  async findJourneyById(id: string) {
    return prisma.gameplayJourney.findUnique({
      where: { id },
      include: {
        game: true,
        _count: {
          select: {
            progressLogs: true,
            builds: true,
          },
        },
      },
    });
  }

  async createJourney(
    userId: string,
    gameId: string,
    input: CreateJourneyInput
  ): Promise<JourneyDTO> {
    const isCompleted =
      input.isCompleted !== undefined
        ? input.isCompleted
        : input.status === 'COMPLETED';

    const created = await prisma.$transaction(async (tx) => {
      // Serializes concurrent journey creation/activation for the same UserGame row
      await tx.$queryRaw`SELECT id FROM "user_games" WHERE id = ${input.userGameId} FOR UPDATE`;

      const existingCount = await tx.gameplayJourney.count({
        where: { userGameId: input.userGameId },
      });

      const shouldActivate = existingCount === 0 || input.isActive === true;

      if (shouldActivate) {
        await tx.gameplayJourney.updateMany({
          where: {
            userGameId: input.userGameId,
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      return tx.gameplayJourney.create({
        data: {
          userId,
          userGameId: input.userGameId,
          gameId,
          title: input.name,
          characterName: input.characterName ?? null,
          playstyle: input.characterClass ?? null,
          currentLevel: input.currentLevel ?? null,
          currentChapter: input.currentArea ?? null,
          currentObjective: input.currentObjective ?? null,
          playtimeHours: input.playtimeHours ?? 0,
          isActive: shouldActivate,
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          notes: input.notes ?? null,
        },
        include: {
          game: true,
          _count: {
            select: {
              progressLogs: true,
              builds: true,
            },
          },
        },
      });
    });

    return JourneysRepository.toJourneyDTO(created);
  }

  async listJourneys(
    userId: string,
    query: ListJourneysQuery
  ): Promise<{ items: JourneyDTO[]; total: number }> {
    const where: Prisma.GameplayJourneyWhereInput = {
      userId,
    };

    if (query.userGameId) {
      where.userGameId = query.userGameId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const skip = (query.page - 1) * query.limit;

    const [records, total] = await Promise.all([
      prisma.gameplayJourney.findMany({
        where,
        include: {
          game: true,
          _count: {
            select: {
              progressLogs: true,
              builds: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      prisma.gameplayJourney.count({ where }),
    ]);

    return {
      items: records.map(JourneysRepository.toJourneyDTO),
      total,
    };
  }

  async updateJourney(id: string, input: UpdateJourneyInput): Promise<JourneyDTO> {
    const data: Prisma.GameplayJourneyUpdateInput = {};

    if (input.name !== undefined) data.title = input.name;
    if (input.characterName !== undefined) data.characterName = input.characterName;
    if (input.characterClass !== undefined) data.playstyle = input.characterClass;
    if (input.currentLevel !== undefined) data.currentLevel = input.currentLevel;
    if (input.currentArea !== undefined) data.currentChapter = input.currentArea;
    if (input.currentObjective !== undefined) data.currentObjective = input.currentObjective;
    if (input.playtimeHours !== undefined) data.playtimeHours = input.playtimeHours;
    if (input.notes !== undefined) data.notes = input.notes;

    const resolvedCompleted =
      input.isCompleted !== undefined
        ? input.isCompleted
        : input.status !== undefined
          ? input.status === 'COMPLETED'
          : undefined;

    if (resolvedCompleted !== undefined) {
      data.isCompleted = resolvedCompleted;
      data.completedAt = resolvedCompleted ? new Date() : null;
    }

    const updated = await prisma.gameplayJourney.update({
      where: { id },
      data,
      include: {
        game: true,
        _count: {
          select: {
            progressLogs: true,
            builds: true,
          },
        },
      },
    });

    return JourneysRepository.toJourneyDTO(updated);
  }

  async activateJourney(id: string, userGameId: string): Promise<JourneyDTO> {
    const activated = await prisma.$transaction(async (tx) => {
      // Serializes concurrent activations for the same UserGame so transactions never collide on the partial unique index
      await tx.$queryRaw`SELECT id FROM "user_games" WHERE id = ${userGameId} FOR UPDATE`;

      await tx.gameplayJourney.updateMany({
        where: {
          userGameId,
          isActive: true,
          id: { not: id },
        },
        data: { isActive: false },
      });

      return tx.gameplayJourney.update({
        where: { id },
        data: { isActive: true },
        include: {
          game: true,
          _count: {
            select: {
              progressLogs: true,
              builds: true,
            },
          },
        },
      });
    });

    return JourneysRepository.toJourneyDTO(activated);
  }

  async deleteJourney(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.progressLog.deleteMany({ where: { journeyId: id } });
      await tx.gameBuild.deleteMany({ where: { journeyId: id } });
      await tx.gameplayJourney.delete({ where: { id } });
    });
  }

  // ---------------------------------------------------------------------------
  // PROGRESS LOGS
  // ---------------------------------------------------------------------------

  async findProgressLogById(id: string) {
    return prisma.progressLog.findUnique({
      where: { id },
    });
  }

  async listProgressByJourney(journeyId: string): Promise<ProgressLogDTO[]> {
    const logs = await prisma.progressLog.findMany({
      where: { journeyId },
      orderBy: [{ loggedAt: 'asc' }, { id: 'asc' }],
    });
    return logs.map(JourneysRepository.toProgressLogDTO);
  }

  async createProgressLog(
    userId: string,
    userGameId: string,
    journeyId: string,
    input: CreateProgressLogInput
  ): Promise<ProgressLogDTO> {
    const checkpointLabel = (
      input.questName ||
      input.areaName ||
      input.description
    ).slice(0, 150);

    const created = await prisma.progressLog.create({
      data: {
        userId,
        userGameId,
        journeyId,
        chapterOrCheckpoint: checkpointLabel,
        areaName: input.areaName ?? null,
        questName: input.questName ?? null,
        notes: input.description,
        completionPercent: input.completionPercent ?? null,
        progressPercentage: input.completionPercent ?? 0,
        hoursPlayedAtPoint: input.hoursPlayedAtPoint ?? 0,
        playerLevelAtPoint: input.playerLevelAtPoint ?? null,
      },
    });

    return JourneysRepository.toProgressLogDTO(created);
  }

  async updateProgressLog(id: string, input: UpdateProgressLogInput): Promise<ProgressLogDTO> {
    const data: Prisma.ProgressLogUpdateInput = {};

    if (input.areaName !== undefined) data.areaName = input.areaName;
    if (input.questName !== undefined) data.questName = input.questName;
    if (input.description !== undefined) data.notes = input.description;
    if (input.completionPercent !== undefined) {
      data.completionPercent = input.completionPercent;
      data.progressPercentage = input.completionPercent ?? 0;
    }
    if (input.hoursPlayedAtPoint !== undefined) {
      data.hoursPlayedAtPoint = input.hoursPlayedAtPoint;
    }
    if (input.playerLevelAtPoint !== undefined) {
      data.playerLevelAtPoint = input.playerLevelAtPoint;
    }

    if (
      input.questName !== undefined ||
      input.areaName !== undefined ||
      input.description !== undefined
    ) {
      const fallback = input.questName || input.areaName || input.description;
      if (fallback) {
        data.chapterOrCheckpoint = fallback.slice(0, 150);
      }
    }

    const updated = await prisma.progressLog.update({
      where: { id },
      data,
    });

    return JourneysRepository.toProgressLogDTO(updated);
  }

  async deleteProgressLog(id: string): Promise<void> {
    await prisma.progressLog.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // GAME BUILDS
  // ---------------------------------------------------------------------------

  async findBuildById(id: string) {
    return prisma.gameBuild.findUnique({
      where: { id },
    });
  }

  async listBuildsByJourney(journeyId: string): Promise<GameBuildDTO[]> {
    const builds = await prisma.gameBuild.findMany({
      where: { journeyId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return builds.map(JourneysRepository.toGameBuildDTO);
  }

  async createBuild(
    userId: string,
    gameId: string,
    journeyId: string,
    input: CreateGameBuildInput
  ): Promise<GameBuildDTO> {
    const created = await prisma.gameBuild.create({
      data: {
        userId,
        gameId,
        journeyId,
        title: input.name,
        description: input.description ?? null,
        playstyle: input.playstyle ?? null,
        attributes: (input.attributes || {}) as Prisma.InputJsonValue,
        equipment: (input.equipment || {}) as Prisma.InputJsonValue,
        tips: input.notes ?? null,
      },
    });

    return JourneysRepository.toGameBuildDTO(created);
  }

  async updateBuild(id: string, input: UpdateGameBuildInput): Promise<GameBuildDTO> {
    const data: Prisma.GameBuildUpdateInput = {};

    if (input.name !== undefined) data.title = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.playstyle !== undefined) data.playstyle = input.playstyle;
    if (input.attributes !== undefined) {
      data.attributes = input.attributes as Prisma.InputJsonValue;
    }
    if (input.equipment !== undefined) {
      data.equipment = input.equipment as Prisma.InputJsonValue;
    }
    if (input.notes !== undefined) data.tips = input.notes;

    const updated = await prisma.gameBuild.update({
      where: { id },
      data,
    });

    return JourneysRepository.toGameBuildDTO(updated);
  }

  async deleteBuild(id: string): Promise<void> {
    await prisma.gameBuild.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // COMPANION CONTEXT PREPARATION (No Gemini calls in this task)
  // ---------------------------------------------------------------------------

  async getJourneyContextData(
    journeyId: string,
    historyLimit = 15
  ): Promise<JourneyContextDTO | null> {
    const journey = await prisma.gameplayJourney.findUnique({
      where: { id: journeyId },
      include: {
        game: true,
        builds: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        progressLogs: {
          orderBy: { loggedAt: 'desc' },
          take: historyLimit,
        },
        _count: {
          select: { progressLogs: true },
        },
      },
    });

    if (!journey) return null;

    // Reverse recent logs so Companion receives bounded recent history in chronological order
    const orderedRecentLogs = [...journey.progressLogs].reverse();

    return {
      game: {
        id: journey.game.id,
        igdbId: journey.game.igdbId ?? null,
        title: journey.game.name,
        slug: journey.game.slug,
        genres: journey.game.genres || [],
        platforms: journey.game.platforms || [],
        developer: journey.game.developer ?? null,
        publisher: journey.game.publisher ?? null,
      },
      journey: {
        id: journey.id,
        name: journey.title,
        characterName: journey.characterName ?? null,
        characterClass: journey.playstyle ?? null,
        currentLevel: journey.currentLevel ?? null,
        currentArea: journey.currentChapter ?? null,
        currentObjective: journey.currentObjective ?? null,
        playtimeHours: journey.playtimeHours ?? 0,
        isActive: Boolean(journey.isActive),
        isCompleted: Boolean(journey.isCompleted),
        status: journey.isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        notes: journey.notes ?? null,
      },
      builds: journey.builds.map(JourneysRepository.toGameBuildDTO),
      recentProgress: orderedRecentLogs.map(JourneysRepository.toProgressLogDTO),
      totalProgressLogs: journey._count.progressLogs,
    };
  }
}
