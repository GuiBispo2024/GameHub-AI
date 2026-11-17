import { Type } from '@google/genai';
import { z } from 'zod';
import { JourneysService, journeysService as defaultJourneysService } from '../../journeys/journeys.service';
import { AgentToolDefinition, createToolError } from './tools.types';

export const updateGameProgressToolSchema = z
  .object({
    journeyId: z.string().uuid('O journeyId deve ser um UUID válido.').optional(),
    areaName: z
      .string()
      .trim()
      .max(150, 'O nome da área deve ter no máximo 150 caracteres.')
      .nullable()
      .optional(),
    questName: z
      .string()
      .trim()
      .max(150, 'O nome da missão ou checkpoint deve ter no máximo 150 caracteres.')
      .nullable()
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, 'A descrição não pode ser vazia.')
      .max(2000, 'A descrição não pode exceder 2000 caracteres.')
      .optional(),
    completionPercent: z
      .number({ message: 'O percentual de conclusão deve ser um número inteiro.' })
      .int('O percentual de conclusão deve ser um número inteiro.')
      .min(0, 'O percentual mínimo é 0.')
      .max(100, 'O percentual máximo é 100.')
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(
        (data.description && data.description.trim().length > 0) ||
          (data.questName && data.questName.trim().length > 0) ||
          (data.areaName && data.areaName.trim().length > 0)
      ),
    {
      message: 'Informe ao menos description, questName ou areaName para registrar o progresso.',
    }
  );

export type UpdateGameProgressToolInput = z.infer<typeof updateGameProgressToolSchema>;

function buildCheckpointDescription(args: UpdateGameProgressToolInput): string {
  if (args.description && args.description.trim().length > 0) {
    return args.description.trim();
  }
  const parts: string[] = [];
  if (args.questName) parts.push(`Missão/Marco: ${args.questName}`);
  if (args.areaName) parts.push(`Região: ${args.areaName}`);
  if (args.completionPercent !== undefined && args.completionPercent !== null) {
    parts.push(`Conclusão: ${args.completionPercent}%`);
  }
  return parts.join(' — ') || 'Progresso registrado via GameAgent.';
}

export function createUpdateGameProgressTool(
  journeysService: JourneysService = defaultJourneysService
): AgentToolDefinition<UpdateGameProgressToolInput> {
  return {
    name: 'updateGameProgress',
    description:
      'Propõe registrar um novo checkpoint de progresso em uma jornada autorizada do usuário autenticado. Exige confirmação explícita antes de persistir.',
    accessType: 'WRITE',
    allowedModes: ['LIBRARY', 'COMPANION'],
    requiresOwnershipCheck: true,
    schema: updateGameProgressToolSchema,
    declaration: {
      name: 'updateGameProgress',
      description:
        'Cria uma proposta pendente para registrar um marco/checkpoint no histórico de progresso de uma jornada do usuário. Nunca grava dados sem confirmação explícita na interface.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          journeyId: {
            type: Type.STRING,
            description:
              'UUID da jornada do usuário. Opcional quando já existe uma jornada selecionada na conversa.',
          },
          areaName: {
            type: Type.STRING,
            description: 'Região, fase ou capítulo onde o jogador está (opcional).',
          },
          questName: {
            type: Type.STRING,
            description: 'Nome da missão, objetivo ou chefe concluído (opcional).',
          },
          description: {
            type: Type.STRING,
            description: 'Descrição resumida do avanço conquistado pelo jogador.',
          },
          completionPercent: {
            type: Type.INTEGER,
            description: 'Percentual estimado de conclusão de 0 a 100 (opcional).',
          },
        },
      },
    },
    prepareProposal: async (args, ctx) => {
      const targetJourneyId = args.journeyId || ctx.activeJourneyId;
      if (!targetJourneyId) {
        throw createToolError(
          'Nenhuma jornada selecionada para registrar progresso. Selecione uma jornada ou informe o journeyId.',
          400,
          'JOURNEY_ID_REQUIRED'
        );
      }

      // Enforces ownership check before even proposing the action (403/404 if not owned)
      const journey = await journeysService.getJourneyById(ctx.userId, targetJourneyId);
      const description = buildCheckpointDescription(args);

      const details: string[] = [];
      if (args.questName) details.push(`Missão: "${args.questName}"`);
      if (args.areaName) details.push(`Área: "${args.areaName}"`);
      if (args.completionPercent !== undefined && args.completionPercent !== null) {
        details.push(`${args.completionPercent}%`);
      }

      const gameTitle = journey.game?.title ? ` (${journey.game.title})` : '';
      const suffix = details.length > 0 ? details.join(' • ') : description;

      return {
        summary: `Registrar progresso na jornada "${journey.name}"${gameTitle}: ${suffix}.`,
        resolvedArgs: {
          journeyId: journey.id,
          areaName: args.areaName ?? null,
          questName: args.questName ?? null,
          description,
          completionPercent: args.completionPercent ?? null,
        },
        preview: {
          actionType: 'UPDATE_GAME_PROGRESS',
          journeyId: journey.id,
          journeyName: journey.name,
          gameTitle: journey.game?.title ?? null,
          areaName: args.areaName ?? null,
          questName: args.questName ?? null,
          description,
          completionPercent: args.completionPercent ?? null,
        },
      };
    },
    execute: async (args, ctx) => {
      const targetJourneyId = args.journeyId || ctx.activeJourneyId;
      if (!targetJourneyId) {
        throw createToolError('Identificador da jornada não informado.', 400, 'JOURNEY_ID_REQUIRED');
      }

      const description = buildCheckpointDescription(args);
      const log = await journeysService.createProgress(ctx.userId, targetJourneyId, {
        areaName: args.areaName ?? null,
        questName: args.questName ?? null,
        description,
        completionPercent: args.completionPercent ?? null,
      });

      return {
        source: 'GAMEPLAY_PROGRESS_LOG',
        action: 'PROGRESS_LOG_CREATED',
        progressId: log.id,
        journeyId: log.journeyId,
        areaName: log.areaName,
        questName: log.questName,
        description: log.description,
        completionPercent: log.completionPercent,
        createdAt: log.createdAt,
      };
    },
  };
}
