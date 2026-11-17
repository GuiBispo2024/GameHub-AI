import { Type } from '@google/genai';
import { z } from 'zod';
import { GamesRepository } from '../../games/games.repository';
import { LibraryRepository } from '../../library/library.repository';
import { libraryStatusSchema } from '../../library/library.schema';
import { LibraryService } from '../../library/library.service';
import { AgentToolDefinition, createToolError } from './tools.types';

export const addGameToLibraryToolSchema = z
  .object({
    gameId: z.string().uuid('O gameId deve ser um UUID válido do catálogo.'),
    status: libraryStatusSchema.optional().default('BACKLOG'),
  })
  .strict();

export type AddGameToLibraryToolInput = z.infer<typeof addGameToLibraryToolSchema>;

const STATUS_LABELS: Record<string, string> = {
  WISHLIST: 'Lista de Desejos (WISHLIST)',
  BACKLOG: 'Na Fila / Backlog (BACKLOG)',
  PLAYING: 'Jogando (PLAYING)',
  COMPLETED: 'Concluído (COMPLETED)',
  PAUSED: 'Pausado (PAUSED)',
  DROPPED: 'Abandonado (DROPPED)',
};

export function createAddGameToLibraryTool(
  libraryService: LibraryService = new LibraryService(),
  gamesRepository: GamesRepository = new GamesRepository(),
  libraryRepository: LibraryRepository = new LibraryRepository()
): AgentToolDefinition<AddGameToLibraryToolInput> {
  return {
    name: 'addGameToLibrary',
    description:
      'Propõe adicionar um jogo do catálogo à biblioteca pessoal do usuário autenticado. Exige confirmação explícita do usuário antes de persistir no banco.',
    accessType: 'WRITE',
    allowedModes: ['LIBRARY', 'COMPANION'],
    requiresOwnershipCheck: true,
    schema: addGameToLibraryToolSchema,
    declaration: {
      name: 'addGameToLibrary',
      description:
        'Cria uma proposta pendente para adicionar um jogo (via UUID gameId do catálogo) à biblioteca pessoal do usuário com o status escolhido. Nunca executa sem confirmação explícita do usuário.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          gameId: {
            type: Type.STRING,
            description:
              'UUID interno do jogo no catálogo PostgreSQL (obtido via searchGames ou contexto atual).',
          },
          status: {
            type: Type.STRING,
            description:
              'Status inicial na biblioteca: WISHLIST, BACKLOG, PLAYING, COMPLETED, PAUSED ou DROPPED. Padrão: BACKLOG.',
          },
        },
        required: ['gameId'],
      },
    },
    prepareProposal: async (args, ctx) => {
      const game = await gamesRepository.findById(args.gameId);
      if (!game) {
        throw createToolError('Jogo não encontrado no catálogo para adicionar à biblioteca.', 404, 'GAME_NOT_FOUND');
      }

      const existing = await libraryRepository.findByUserAndGame(ctx.userId, args.gameId);
      if (existing) {
        throw createToolError(
          `O jogo "${game.name}" já está na sua biblioteca pessoal com status ${existing.status}.`,
          409,
          'ALREADY_IN_LIBRARY'
        );
      }

      const effectiveStatus = args.status ?? 'BACKLOG';
      const statusLabel = STATUS_LABELS[effectiveStatus] || effectiveStatus;

      return {
        summary: `Adicionar "${game.name}" à sua biblioteca pessoal com status ${statusLabel}.`,
        resolvedArgs: {
          gameId: game.id,
          status: effectiveStatus,
        },
        preview: {
          actionType: 'ADD_GAME_TO_LIBRARY',
          gameId: game.id,
          gameTitle: game.name,
          status: effectiveStatus,
          statusLabel,
          genres: game.genres || [],
          platforms: game.platforms || [],
        },
      };
    },
    execute: async (args, ctx) => {
      const entry = await libraryService.addGame(ctx.userId, {
        gameId: args.gameId,
        status: args.status ?? 'BACKLOG',
      });

      return {
        source: 'USER_PERSONAL_LIBRARY',
        action: 'ADDED_TO_LIBRARY',
        entryId: entry.id,
        gameId: entry.gameId,
        gameTitle: entry.game.title,
        status: entry.status,
      };
    },
  };
}
