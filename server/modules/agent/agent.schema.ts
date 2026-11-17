import { z } from 'zod';

export const MAX_AGENT_MESSAGE_LENGTH = 2000;
export const MAX_CONVERSATION_HISTORY_MESSAGES = 16;
export const MAX_CONVERSATION_HISTORY_CHARS = 12000;
export const ACTION_PROPOSAL_TTL_MINUTES = 15;

export const agentModeSchema = z.enum(['LIBRARY', 'COMPANION'], {
  message: 'Modo do agente inválido. Use LIBRARY ou COMPANION.',
});

export const spoilerLevelInputSchema = z.enum(
  [
    'STRICT_NO_SPOILERS',
    'CURRENT_CHAPTER',
    'MID_GAME_SAFE',
    'FULL_UNRESTRICTED',
    'NONE',
    'LIGHT',
    'ALL',
  ],
  {
    message:
      'Nível de spoiler inválido. Use STRICT_NO_SPOILERS, CURRENT_CHAPTER, MID_GAME_SAFE ou FULL_UNRESTRICTED.',
  }
);

export const chatRequestSchema = z
  .object({
    message: z
      .string({ message: 'A mensagem é obrigatória.' })
      .trim()
      .min(1, 'A mensagem não pode estar vazia.')
      .max(
        MAX_AGENT_MESSAGE_LENGTH,
        `A mensagem não pode exceder ${MAX_AGENT_MESSAGE_LENGTH} caracteres.`
      ),
    mode: agentModeSchema.optional(),
    conversationId: z
      .string()
      .uuid('ID de conversa inválido.')
      .nullable()
      .optional(),
    gameId: z
      .string()
      .uuid('ID de jogo inválido.')
      .nullable()
      .optional(),
    journeyId: z
      .string()
      .uuid('ID de jornada inválido.')
      .nullable()
      .optional(),
    spoilerLevel: spoilerLevelInputSchema.nullable().optional(),
    title: z
      .string()
      .trim()
      .min(1, 'O título não pode estar vazio.')
      .max(120, 'O título não pode exceder 120 caracteres.')
      .nullable()
      .optional(),
    clientRequestId: z
      .string()
      .trim()
      .min(1)
      .max(100, 'Identificador de requisição inválido.')
      .nullable()
      .optional(),
  })
  .strict();

export const conversationIdParamSchema = z.object({
  id: z.string().uuid('ID de conversa inválido.'),
});

export const actionIdParamSchema = z.object({
  id: z.string().uuid('ID de proposta de ação inválido.'),
});

export const listConversationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  mode: agentModeSchema.optional(),
  gameId: z.string().uuid('ID de jogo inválido.').optional(),
});
