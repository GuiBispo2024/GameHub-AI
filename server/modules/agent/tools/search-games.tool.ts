import { Type } from '@google/genai';
import { z } from 'zod';
import { GamesService } from '../../games/games.service';
import { AgentToolDefinition, truncateText } from './tools.types';

export const searchGamesToolSchema = z
  .object({
    query: z
      .string({ message: 'O termo de busca (query) é obrigatório.' })
      .trim()
      .min(1, 'O termo de busca não pode estar vazio.')
      .max(100, 'O termo de busca deve ter no máximo 100 caracteres.'),
    limit: z
      .number({ message: 'O limite deve ser um número inteiro.' })
      .int('O limite deve ser um número inteiro.')
      .min(1, 'O limite mínimo é 1.')
      .max(10, 'O limite máximo por busca é 10.')
      .optional()
      .default(5),
    genre: z
      .string()
      .trim()
      .max(50, 'O filtro de gênero deve ter no máximo 50 caracteres.')
      .optional(),
    platform: z
      .string()
      .trim()
      .max(50, 'O filtro de plataforma deve ter no máximo 50 caracteres.')
      .optional(),
  })
  .strict();

export type SearchGamesToolInput = z.infer<typeof searchGamesToolSchema>;

export function createSearchGamesTool(
  gamesService: GamesService = new GamesService()
): AgentToolDefinition<SearchGamesToolInput> {
  return {
    name: 'searchGames',
    description:
      'Pesquisa jogos reais no catálogo integrado à IGDB (e cache PostgreSQL) por título, gênero e plataforma. Retorna UUID interno (gameId), igdbId, gêneros, plataformas e resumo.',
    accessType: 'READ',
    allowedModes: ['LIBRARY', 'COMPANION'],
    requiresOwnershipCheck: false,
    schema: searchGamesToolSchema,
    declaration: {
      name: 'searchGames',
      description:
        'Pesquisa jogos no catálogo oficial IGDB com filtros opcionais. Use para encontrar jogos externos, verificar títulos existentes e obter o gameId (UUID) antes de sugerir ou propor adição à biblioteca.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'Nome ou trecho do título do jogo a pesquisar.',
          },
          limit: {
            type: Type.INTEGER,
            description: 'Quantidade máxima de resultados (1 a 10). Padrão: 5.',
          },
          genre: {
            type: Type.STRING,
            description: 'Filtro opcional de gênero (ex.: RPG, Action, Adventure, Indie).',
          },
          platform: {
            type: Type.STRING,
            description: 'Filtro opcional de plataforma (ex.: PC, PlayStation 5, Nintendo Switch).',
          },
        },
        required: ['query'],
      },
    },
    execute: async (args) => {
      const result = await gamesService.searchGames({
        query: args.query,
        limit: args.limit ?? 5,
        page: 1,
        genre: args.genre,
        platform: args.platform,
      });

      return {
        source: 'IGDB_CATALOG',
        query: args.query,
        totalReturned: result.data.length,
        hasNextPage: result.pagination.hasNextPage,
        games: result.data.map((game) => ({
          gameId: game.id ?? null,
          igdbId: game.igdbId,
          title: game.title,
          slug: game.slug,
          genres: game.genres,
          platforms: game.platforms,
          rating: game.rating,
          releaseDate: game.releaseDate,
          developer: game.developer ?? null,
          summary: truncateText(game.summary, 240),
        })),
      };
    },
  };
}
