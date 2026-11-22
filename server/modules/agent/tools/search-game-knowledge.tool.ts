import { Type } from '@google/genai';
import { z } from 'zod';
import { KnowledgeService, knowledgeService as defaultKnowledgeService } from '../../knowledge/knowledge.service';
import { AgentToolDefinition, createToolError } from './tools.types';

export const searchGameKnowledgeToolSchema = z
  .object({
    gameId: z.string().uuid('O gameId deve ser um UUID válido.').optional(),
    query: z
      .string({ message: 'O termo de busca (query) é obrigatório.' })
      .trim()
      .min(1, 'A query de busca não pode estar vazia.')
      .max(250, 'A query de busca não pode exceder 250 caracteres.'),
    journeyId: z.string().uuid('O journeyId deve ser um UUID válido.').optional(),
    limit: z.number().int().min(1).max(6).optional().default(4),
  })
  .strict();

export type SearchGameKnowledgeToolInput = z.infer<typeof searchGameKnowledgeToolSchema>;

export function createSearchGameKnowledgeTool(
  knowledgeService: KnowledgeService = defaultKnowledgeService
): AgentToolDefinition<SearchGameKnowledgeToolInput> {
  return {
    name: 'searchGameKnowledge',
    description:
      'Consulta a base de conhecimento curada do jogo (guias, estratégias, mecânicas, chefes e builds) filtrada estritamente pelo jogo correto e pela política de spoilers ativa do usuário.',
    accessType: 'READ',
    allowedModes: ['LIBRARY', 'COMPANION'],
    requiresOwnershipCheck: true,
    schema: searchGameKnowledgeToolSchema,
    declaration: {
      name: 'searchGameKnowledge',
      description:
        'Busca trechos verificáveis de guias de gameplay na base de conhecimento do jogo selecionado, aplicando automaticamente a política anti-spoiler e o progresso da jornada do jogador.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          gameId: {
            type: Type.STRING,
            description:
              'UUID do jogo alvo na base do GameHub. Opcional se a conversa já estiver vinculada a um jogo.',
          },
          query: {
            type: Type.STRING,
            description:
              'Pergunta ou palavras-chave específicas sobre mecânicas, estratégia, chefe, região ou build do jogo.',
          },
          journeyId: {
            type: Type.STRING,
            description:
              'UUID opcional da jornada do usuário autenticado para alinhar a busca ao progresso atual.',
          },
          limit: {
            type: Type.INTEGER,
            description: 'Quantidade máxima de trechos retornados (entre 1 e 6, padrão 4).',
          },
        },
        required: ['query'],
      },
    },
    execute: async (args, ctx) => {
      const targetGameId = args.gameId || ctx.activeGameId;
      if (!targetGameId) {
        throw createToolError(
          'Nenhum jogo selecionado. Informe o gameId ou selecione um jogo na conversa antes de consultar a base de conhecimento.',
          400,
          'GAME_ID_REQUIRED'
        );
      }

      // Inherit activeJourneyId ONLY when targeting the active game (prevent mismatched journey/game errors)
      const targetJourneyId =
        args.journeyId !== undefined
          ? args.journeyId
          : ctx.activeJourneyId && (!args.gameId || args.gameId === ctx.activeGameId)
            ? ctx.activeJourneyId
            : null;

      // CRITICAL: spoilerLevel ALWAYS comes strictly from authenticated backend context, never from LLM args
      const effectiveSpoilerLevel = ctx.spoilerLevel || 'CURRENT_CHAPTER';

      const result = await knowledgeService.retrieveKnowledge({
        userId: ctx.userId,
        gameId: targetGameId,
        query: args.query,
        journeyId: targetJourneyId,
        effectiveSpoilerLevel,
        limit: args.limit ?? 4,
      });

      ctx.onKnowledgeRetrieved?.(result);

      return {
        source: 'GAME_KNOWLEDGE_RAG',
        sufficientEvidence: result.sufficientEvidence,
        evidenceStatus: result.evidenceStatus,
        spoilerPolicyApplied: result.spoilerPolicyApplied,
        spoilerRestricted: result.spoilerRestricted,
        blockedChunksCount: result.blockedChunksCount,
        game: result.game,
        journeyContextApplied: result.journeyContextApplied,
        playerCurrentRegion: result.playerCurrentRegion,
        message: result.message,
        chunks: result.chunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          guideId: chunk.guideId,
          heading: chunk.heading,
          content: chunk.content,
          regionOrChapter: chunk.regionOrChapter,
          spoilerLevel: chunk.spoilerLevel,
          score: chunk.score,
          sourceTitle: chunk.sourceTitle,
          sourceName: chunk.sourceName,
          sourceUrl: chunk.sourceUrl,
          isVerified: chunk.isVerified,
        })),
        references: result.references,
      };
    },
  };
}
