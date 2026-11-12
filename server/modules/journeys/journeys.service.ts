import { JourneysRepository } from './journeys.repository';
import {
  CreateGameBuildInput,
  CreateJourneyInput,
  CreateProgressLogInput,
  GameBuildDTO,
  JourneyContextDTO,
  JourneyDTO,
  JourneyListResult,
  ListJourneysQuery,
  ProgressLogDTO,
  UpdateGameBuildInput,
  UpdateJourneyInput,
  UpdateProgressLogInput,
} from './journeys.types';

function createHttpError(message: string, statusCode: number, code: string) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class JourneysService {
  private repository: JourneysRepository;

  constructor(repository?: JourneysRepository) {
    this.repository = repository || new JourneysRepository();
  }

  private async ensureOwnedUserGame(userId: string, userGameId: string) {
    const userGame = await this.repository.findUserGameById(userGameId);
    if (!userGame) {
      throw createHttpError(
        'Jogo não encontrado na biblioteca pessoal.',
        404,
        'LIBRARY_ENTRY_NOT_FOUND'
      );
    }
    if (userGame.userId !== userId) {
      throw createHttpError(
        'Acesso negado. Você não pode criar jornadas em jogos de outro usuário.',
        403,
        'FORBIDDEN'
      );
    }
    return userGame;
  }

  private async ensureOwnedJourney(userId: string, journeyId: string) {
    const journey = await this.repository.findJourneyById(journeyId);
    if (!journey) {
      throw createHttpError('Jornada de gameplay não encontrada.', 404, 'JOURNEY_NOT_FOUND');
    }
    if (journey.userId !== userId) {
      throw createHttpError(
        'Acesso negado. Esta jornada pertence a outro usuário.',
        403,
        'FORBIDDEN'
      );
    }
    return journey;
  }

  private async ensureOwnedProgressLog(userId: string, progressId: string) {
    const log = await this.repository.findProgressLogById(progressId);
    if (!log) {
      throw createHttpError('Registro de progresso não encontrado.', 404, 'PROGRESS_LOG_NOT_FOUND');
    }
    if (log.userId !== userId) {
      throw createHttpError(
        'Acesso negado. Este registro de progresso pertence a outro usuário.',
        403,
        'FORBIDDEN'
      );
    }
    return log;
  }

  private async ensureOwnedBuild(userId: string, buildId: string) {
    const build = await this.repository.findBuildById(buildId);
    if (!build) {
      throw createHttpError('Build não encontrada.', 404, 'BUILD_NOT_FOUND');
    }
    if (build.userId !== userId) {
      throw createHttpError(
        'Acesso negado. Esta build pertence a outro usuário.',
        403,
        'FORBIDDEN'
      );
    }
    return build;
  }

  // ---------------------------------------------------------------------------
  // JOURNEYS CRUD & ACTIVATION
  // ---------------------------------------------------------------------------

  async createJourney(userId: string, input: CreateJourneyInput): Promise<JourneyDTO> {
    const userGame = await this.ensureOwnedUserGame(userId, input.userGameId);

    // Retry gracefully if concurrent creation races for the partial unique active index
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.repository.createJourney(userId, userGame.gameId, input);
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 2) {
          await sleep(15 + attempt * 20);
          continue;
        }
        throw err;
      }
    }

    return this.repository.createJourney(userId, userGame.gameId, input);
  }

  async listJourneys(userId: string, query: ListJourneysQuery): Promise<JourneyListResult> {
    if (query.userGameId) {
      await this.ensureOwnedUserGame(userId, query.userGameId);
    }

    const { items, total } = await this.repository.listJourneys(userId, query);
    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      status: 'success',
      data: items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }

  async getJourneyById(userId: string, journeyId: string): Promise<JourneyDTO> {
    const journey = await this.ensureOwnedJourney(userId, journeyId);
    return JourneysRepository.toJourneyDTO(journey);
  }

  async updateJourney(
    userId: string,
    journeyId: string,
    input: UpdateJourneyInput
  ): Promise<JourneyDTO> {
    await this.ensureOwnedJourney(userId, journeyId);
    return this.repository.updateJourney(journeyId, input);
  }

  async activateJourney(userId: string, journeyId: string): Promise<JourneyDTO> {
    const journey = await this.ensureOwnedJourney(userId, journeyId);

    // Transaction + retry guards against concurrent PATCH /activate hitting PostgreSQL partial unique index
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.repository.activateJourney(journey.id, journey.userGameId);
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 3) {
          await sleep(15 + attempt * 20);
          continue;
        }
        throw err;
      }
    }

    return this.repository.activateJourney(journey.id, journey.userGameId);
  }

  async deleteJourney(userId: string, journeyId: string): Promise<void> {
    await this.ensureOwnedJourney(userId, journeyId);
    await this.repository.deleteJourney(journeyId);
  }

  // ---------------------------------------------------------------------------
  // PROGRESS LOGS
  // ---------------------------------------------------------------------------

  async listProgress(userId: string, journeyId: string): Promise<ProgressLogDTO[]> {
    await this.ensureOwnedJourney(userId, journeyId);
    return this.repository.listProgressByJourney(journeyId);
  }

  async createProgress(
    userId: string,
    journeyId: string,
    input: CreateProgressLogInput
  ): Promise<ProgressLogDTO> {
    const journey = await this.ensureOwnedJourney(userId, journeyId);
    return this.repository.createProgressLog(userId, journey.userGameId, journey.id, input);
  }

  async updateProgress(
    userId: string,
    progressId: string,
    input: UpdateProgressLogInput
  ): Promise<ProgressLogDTO> {
    await this.ensureOwnedProgressLog(userId, progressId);
    return this.repository.updateProgressLog(progressId, input);
  }

  async deleteProgress(userId: string, progressId: string): Promise<void> {
    await this.ensureOwnedProgressLog(userId, progressId);
    await this.repository.deleteProgressLog(progressId);
  }

  // ---------------------------------------------------------------------------
  // GAME BUILDS
  // ---------------------------------------------------------------------------

  async listBuilds(userId: string, journeyId: string): Promise<GameBuildDTO[]> {
    await this.ensureOwnedJourney(userId, journeyId);
    return this.repository.listBuildsByJourney(journeyId);
  }

  async createBuild(
    userId: string,
    journeyId: string,
    input: CreateGameBuildInput
  ): Promise<GameBuildDTO> {
    const journey = await this.ensureOwnedJourney(userId, journeyId);
    return this.repository.createBuild(userId, journey.gameId, journey.id, input);
  }

  async getBuildById(userId: string, buildId: string): Promise<GameBuildDTO> {
    const build = await this.ensureOwnedBuild(userId, buildId);
    return JourneysRepository.toGameBuildDTO(build);
  }

  async updateBuild(
    userId: string,
    buildId: string,
    input: UpdateGameBuildInput
  ): Promise<GameBuildDTO> {
    await this.ensureOwnedBuild(userId, buildId);
    return this.repository.updateBuild(buildId, input);
  }

  async deleteBuild(userId: string, buildId: string): Promise<void> {
    await this.ensureOwnedBuild(userId, buildId);
    await this.repository.deleteBuild(buildId);
  }

  // ---------------------------------------------------------------------------
  // COMPANION CONTEXT SERVICE (No AI execution in Task 6)
  // ---------------------------------------------------------------------------

  /**
   * Builds structured, ownership-verified context for future Game Companion sessions.
   * Limits recent progress history to prevent uncontrolled payload / prompt growth.
   */
  async getJourneyContext(
    userId: string,
    journeyId: string,
    historyLimit = 15
  ): Promise<JourneyContextDTO> {
    await this.ensureOwnedJourney(userId, journeyId);
    const boundedLimit = Math.min(Math.max(1, historyLimit), 30);
    const context = await this.repository.getJourneyContextData(journeyId, boundedLimit);

    if (!context) {
      throw createHttpError('Jornada de gameplay não encontrada.', 404, 'JOURNEY_NOT_FOUND');
    }

    return context;
  }
}

export const journeysService = new JourneysService();
