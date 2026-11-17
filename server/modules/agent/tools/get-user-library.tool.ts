import { Type } from '@google/genai';
import { z } from 'zod';
import { librarySortSchema, libraryStatusSchema } from '../../library/library.schema';
import { LibraryService } from '../../library/library.service';
import { AgentToolDefinition } from './tools.types';

export const getUserLibraryToolSchema = z
  .object({
    status: libraryStatusSchema.optional(),
    genre: z
      .string()
      .trim()
      .max(60, 'O filtro de gênero deve ter no máximo 60 caracteres.')
      .optional(),
    platform: z
      .string()
      .trim()
      .max(60, 'O filtro de plataforma deve ter no máximo 60 caracteres.')
      .optional(),
    search: z
      .string()
      .trim()
      .max(100, 'O filtro de nome deve ter no máximo 100 caracteres.')
      .optional(),
    sort: librarySortSchema.optional().default('recentlyUpdated'),
    page: z
      .number({ message: 'A página deve ser um número inteiro.' })
      .int()
      .min(1, 'Página mínima é 1.')
      .max(50, 'Página máxima é 50.')
      .optional()
      .default(1),
    limit: z
      .number({ message: 'O limite deve ser um número inteiro.' })
      .int()
      .min(1, 'O limite mínimo é 1.')
      .max(20, 'O limite máximo é 20.')
      .optional()
      .default(10),
  })
  .strict();

export type GetUserLibraryToolInput = z.infer<typeof getUserLibraryToolSchema>;

export function createGetUserLibraryTool(
  libraryService: LibraryService = new LibraryService()
): AgentToolDefinition<GetUserLibraryToolInput> {
  return {
    name: 'getUserLibrary',
    description:
      'Consulta a biblioteca pessoal de jogos do usuário autenticado, com filtros por status, gênero, plataforma e nome, além de ordenação e estatísticas reais.',
    accessType: 'READ',
    allowedModes: ['LIBRARY', 'COMPANION'],
    requiresOwnershipCheck: true,
    schema: getUserLibraryToolSchema,
    declaration: {
      name: 'getUserLibrary',
      description:
        'Lista os jogos pertencentes à biblioteca pessoal do usuário autenticado com filtros opcionais (status, gênero, plataforma, busca por nome, ordenação) e retorna estatísticas gerais.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          status: {
            type: Type.STRING,
            description:
              'Filtro opcional de status: WISHLIST, BACKLOG, PLAYING, COMPLETED, PAUSED ou DROPPED.',
          },
          genre: {
            type: Type.STRING,
            description: 'Filtro opcional de gênero.',
          },
          platform: {
            type: Type.STRING,
            description: 'Filtro opcional de plataforma.',
          },
          search: {
            type: Type.STRING,
            description: 'Busca parcial pelo título do jogo na biblioteca.',
          },
          sort: {
            type: Type.STRING,
            description:
              'Critério de ordenação: recentlyAdded, recentlyUpdated, titleAsc, titleDesc, ratingDesc ou hoursPlayedDesc.',
          },
          page: {
            type: Type.INTEGER,
            description: 'Página de resultados (padrão 1).',
          },
          limit: {
            type: Type.INTEGER,
            description: 'Quantidade de itens por página (1 a 20, padrão 10).',
          },
        },
      },
    },
    execute: async (args, ctx) => {
      // Security: userId comes strictly from authenticated session context
      const [listResult, stats] = await Promise.all([
        libraryService.listGames(ctx.userId, {
          status: args.status,
          genre: args.genre,
          platform: args.platform,
          search: args.search,
          sort: args.sort ?? 'recentlyUpdated',
          page: args.page ?? 1,
          limit: args.limit ?? 10,
        }),
        libraryService.getStats(ctx.userId),
      ]);

      return {
        source: 'USER_PERSONAL_LIBRARY',
        stats,
        pagination: listResult.pagination,
        entries: listResult.data.map((entry) => ({
          entryId: entry.id,
          gameId: entry.gameId,
          title: entry.game.title,
          status: entry.status,
          rating: entry.rating,
          hoursPlayed: entry.hoursPlayed,
          progressPercentage: entry.progressPercentage,
          currentChapter: entry.currentChapter,
          isFavorite: entry.isFavorite,
          genres: entry.game.genres,
          platforms: entry.game.platforms,
        })),
      };
    },
  };
}
