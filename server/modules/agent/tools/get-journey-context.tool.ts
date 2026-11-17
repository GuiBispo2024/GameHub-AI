import { Type } from '@google/genai';
import { z } from 'zod';
import { JourneysService, journeysService as defaultJourneysService } from '../../journeys/journeys.service';
import { AgentToolDefinition, createToolError, truncateText } from './tools.types';

export const getJourneyContextToolSchema = z
  .object({
    journeyId: z.string().uuid('O journeyId deve ser um UUID válido.').optional(),
  })
  .strict();

export type GetJourneyContextToolInput = z.infer<typeof getJourneyContextToolSchema>;

export function createGetJourneyContextTool(
  journeysService: JourneysService = defaultJourneysService
): AgentToolDefinition<GetJourneyContextToolInput> {
  return {
    name: 'getJourneyContext',
    description:
      'Consulta dados completos de uma jornada de gameplay pertencente ao usuário autenticado (jogo, personagem, classe, nível, área, objetivo, builds e marcos recentes de progresso).',
    accessType: 'READ',
    allowedModes: ['LIBRARY', 'COMPANION'],
    requiresOwnershipCheck: true,
    schema: getJourneyContextToolSchema,
    declaration: {
      name: 'getJourneyContext',
      description:
        'Retorna o contexto completo da jornada de gameplay do usuário autenticado, incluindo jogo, personagem, classe, nível atual, área atual, objetivo, resumo de builds e histórico recente de progresso.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          journeyId: {
            type: Type.STRING,
            description:
              'UUID da jornada a consultar. Opcional se a conversa já estiver vinculada a uma jornada selecionada.',
          },
        },
      },
    },
    execute: async (args, ctx) => {
      const targetJourneyId = args.journeyId || ctx.activeJourneyId;
      if (!targetJourneyId) {
        throw createToolError(
          'Nenhuma jornada selecionada. Informe o journeyId ou selecione uma jornada ativa na interface.',
          400,
          'JOURNEY_ID_REQUIRED'
        );
      }

      // Enforces ownership check internally (403/404 if not owned)
      const context = await journeysService.getJourneyContext(ctx.userId, targetJourneyId, 10);

      return {
        source: 'GAMEPLAY_JOURNEY_CONTEXT',
        game: {
          id: context.game.id,
          igdbId: context.game.igdbId,
          title: context.game.title,
          genres: context.game.genres,
          platforms: context.game.platforms,
          developer: context.game.developer,
        },
        journey: {
          id: context.journey.id,
          name: context.journey.name,
          characterName: context.journey.characterName,
          characterClass: context.journey.characterClass,
          currentLevel: context.journey.currentLevel,
          currentArea: context.journey.currentArea,
          currentObjective: context.journey.currentObjective,
          playtimeHours: context.journey.playtimeHours,
          isActive: context.journey.isActive,
          isCompleted: context.journey.isCompleted,
          status: context.journey.status,
          notes: truncateText(context.journey.notes, 300),
        },
        builds: context.builds.slice(0, 5).map((b) => ({
          id: b.id,
          name: b.name,
          playstyle: b.playstyle,
          description: truncateText(b.description, 200),
          attributes: b.attributes,
          equipment: b.equipment,
        })),
        totalProgressLogs: context.totalProgressLogs,
        recentProgress: context.recentProgress.map((log) => ({
          id: log.id,
          areaName: log.areaName,
          questName: log.questName,
          description: truncateText(log.description, 200),
          completionPercent: log.completionPercent,
          hoursPlayedAtPoint: log.hoursPlayedAtPoint,
          playerLevelAtPoint: log.playerLevelAtPoint,
          createdAt: log.createdAt,
        })),
      };
    },
  };
}
