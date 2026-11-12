import { LibraryRepository } from './library.repository';
import {
  AddLibraryGameInput,
  LibraryEntryDTO,
  LibraryListQuery,
  LibraryListResult,
  LibraryStatsDTO,
  UpdateLibraryGameInput,
} from './library.types';
import { logger } from '../../utils/logger';

export class LibraryService {
  private repository: LibraryRepository;

  constructor(repository?: LibraryRepository) {
    this.repository = repository || new LibraryRepository();
  }

  /**
   * Adds a game from the catalog (Game table) to the authenticated user's library (UserGame)
   */
  async addGame(userId: string, input: AddLibraryGameInput): Promise<LibraryEntryDTO> {
    const game = await this.repository.findGameById(input.gameId);
    if (!game) {
      const err: any = new Error('Jogo não encontrado no catálogo.');
      err.statusCode = 404;
      err.code = 'GAME_NOT_FOUND';
      throw err;
    }

    const existing = await this.repository.findByUserAndGame(userId, input.gameId);
    if (existing) {
      const err: any = new Error('Este jogo já está na sua biblioteca pessoal.');
      err.statusCode = 409;
      err.code = 'ALREADY_IN_LIBRARY';
      err.existingEntryId = existing.id;
      throw err;
    }

    const status = input.status || 'BACKLOG';
    const now = new Date();
    const startedAt = status === 'PLAYING' ? now : null;
    const completedAt = status === 'COMPLETED' ? now : null;

    try {
      return await this.repository.createEntry({
        userId,
        gameId: input.gameId,
        status,
        rating: input.rating ?? null,
        hoursPlayed: input.hoursPlayed ?? 0,
        personalNotes: input.notes ?? null,
        startedAt,
        completedAt,
      });
    } catch (err: any) {
      // Handle race-condition unique constraint violation (P2002)
      if (err?.code === 'P2002') {
        const conflictErr: any = new Error('Este jogo já está na sua biblioteca pessoal.');
        conflictErr.statusCode = 409;
        conflictErr.code = 'ALREADY_IN_LIBRARY';
        throw conflictErr;
      }
      throw err;
    }
  }

  /**
   * Lists the authenticated user's personal game library with filtering, sorting and pagination
   */
  async listGames(userId: string, query: LibraryListQuery): Promise<LibraryListResult> {
    const { items, total } = await this.repository.listByUser(userId, query);
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

  /**
   * Retrieves details of a specific UserGame entry after verifying ownership
   */
  async getEntryById(userId: string, entryId: string): Promise<LibraryEntryDTO> {
    const entry = await this.repository.findById(entryId);

    if (!entry) {
      const err: any = new Error('Registro não encontrado na biblioteca.');
      err.statusCode = 404;
      err.code = 'LIBRARY_ENTRY_NOT_FOUND';
      throw err;
    }

    if (entry.userId !== userId) {
      const err: any = new Error('Acesso negado. Este registro pertence a outro usuário.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    return LibraryRepository.toDTO(entry);
  }

  /**
   * Partially updates a UserGame entry (status, rating, hoursPlayed, notes) after verifying ownership
   */
  async updateEntry(
    userId: string,
    entryId: string,
    input: UpdateLibraryGameInput
  ): Promise<LibraryEntryDTO> {
    const existing = await this.repository.findById(entryId);

    if (!existing) {
      const err: any = new Error('Registro não encontrado na biblioteca.');
      err.statusCode = 404;
      err.code = 'LIBRARY_ENTRY_NOT_FOUND';
      throw err;
    }

    if (existing.userId !== userId) {
      const err: any = new Error('Acesso negado. Você não pode alterar a biblioteca de outro usuário.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    let startedAt: Date | null | undefined = undefined;
    let completedAt: Date | null | undefined = undefined;

    if (input.status !== undefined) {
      const now = new Date();
      if (input.status === 'PLAYING' && !existing.startedAt) {
        startedAt = now;
      }
      if (input.status === 'COMPLETED' && !existing.completedAt) {
        completedAt = now;
      } else if (input.status !== 'COMPLETED' && existing.completedAt) {
        completedAt = null;
      }
    }

    return this.repository.updateEntry(entryId, {
      status: input.status,
      rating: input.rating,
      hoursPlayed: input.hoursPlayed,
      personalNotes: input.notes,
      startedAt,
      completedAt,
    });
  }

  /**
   * Removes a UserGame entry from the user's personal library without deleting the shared Game record.
   *
   * Future Deletion Policy (Phase 3 - Gameplay Journeys):
   * Currently GameplayJourney is not yet implemented, so UserGame entries have no active journeys.
   * When GameplayJourney is introduced, deletion must verify `dependentJourneysCount` and either:
   * - Block removal (HTTP 409 CONFLICT) requiring explicit confirmation (`?confirmCascade=true`), or
   * - Archive progress logs safely so gameplay history is never lost silently.
   */
  async removeEntry(userId: string, entryId: string): Promise<void> {
    const existing = await this.repository.findById(entryId);

    if (!existing) {
      const err: any = new Error('Registro não encontrado na biblioteca.');
      err.statusCode = 404;
      err.code = 'LIBRARY_ENTRY_NOT_FOUND';
      throw err;
    }

    if (existing.userId !== userId) {
      const err: any = new Error('Acesso negado. Você não pode remover jogos da biblioteca de outro usuário.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const dependentJourneys = await this.repository.countDependentJourneys(entryId);
    if (dependentJourneys > 0) {
      logger.warn(
        `UserGame ${entryId} possui ${dependentJourneys} jornada(s) dependente(s). Política futura de bloqueio/confirmação ativada.`
      );
      const err: any = new Error(
        'Este jogo possui jornadas de gameplay associadas. Remova ou arquive as jornadas antes de excluir o jogo da biblioteca.'
      );
      err.statusCode = 409;
      err.code = 'HAS_DEPENDENT_JOURNEYS';
      throw err;
    }

    await this.repository.deleteEntry(entryId);
  }

  /**
   * Computes real library statistics for the authenticated user
   */
  async getStats(userId: string): Promise<LibraryStatsDTO> {
    return this.repository.getStatsByUser(userId);
  }
}
