import { Type } from '@google/genai';
import { z } from 'zod';
import { JourneysService, journeysService as defaultJourneysService } from '../../journeys/journeys.service';
import { AgentToolDefinition, createToolError, truncateText } from './tools.types';

export const getGameBuildsToolSchema = z
  .object({
    journeyId: z.string().uuid('O journeyId deve ser um UUID válido.').optional(),
  })
  .strict();

export type GetGameBuildsToolInput = z.infer<typeof getGameBuildsToolSchema>;

function normalizeFlexibleRecord(
  record: Record<string, unknown> | null | undefined
): {
  map: Record<string, unknown>;
  entries: Array<{ key: string; value: unknown }>;
} {
  const safeMap =
    record && typeof record === 'object' && !Array.isArray(record) ? record : {};
  return {
    map: safeMap,
    entries: Object.entries(safeMap).map(([key, value]) => ({ key, value })),
  };
}

export function createGetGameBuildsTool(
  journeysService: JourneysService = defaultJourneysService
): AgentToolDefinition<GetGameBuildsToolInput> {
  return {
    name: 'getGameBuilds',
    description:
      'Consulta as builds cadastradas em uma jornada autorizada do usuário autenticado, retornando atributos e equipamentos normalizados de forma agnóstica ao gênero do jogo.',
    accessType: 'READ',
    allowedModes: ['LIBRARY', 'COMPANION'],
    requiresOwnershipCheck: true,
    schema: getGameBuildsToolSchema,
    declaration: {
      name: 'getGameBuilds',
      description:
        'Lista as builds do personagem cadastradas em uma jornada de gameplay do usuário, normalizando atributos e equipamentos sem assumir mecânicas fixas de um único gênero.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          journeyId: {
            type: Type.STRING,
            description:
              'UUID da jornada cujas builds devem ser consultadas. Opcional se a conversa já possuir uma jornada vinculada.',
          },
        },
      },
    },
    execute: async (args, ctx) => {
      const targetJourneyId = args.journeyId || ctx.activeJourneyId;
      if (!targetJourneyId) {
        throw createToolError(
          'Nenhuma jornada selecionada. Informe o journeyId ou selecione uma jornada ativa.',
          400,
          'JOURNEY_ID_REQUIRED'
        );
      }

      // Enforces ownership check internally (403/404 if not owned)
      const builds = await journeysService.listBuilds(ctx.userId, targetJourneyId);

      return {
        source: 'GAME_BUILDS',
        journeyId: targetJourneyId,
        totalBuilds: builds.length,
        builds: builds.map((b) => {
          const normalizedAttributes = normalizeFlexibleRecord(b.attributes);
          const normalizedEquipment = normalizeFlexibleRecord(b.equipment);
          return {
            id: b.id,
            name: b.name,
            playstyle: b.playstyle,
            description: truncateText(b.description, 260),
            notes: truncateText(b.notes, 260),
            attributes: normalizedAttributes.map,
            attributeEntries: normalizedAttributes.entries,
            equipment: normalizedEquipment.map,
            equipmentEntries: normalizedEquipment.entries,
            updatedAt: b.updatedAt,
          };
        }),
      };
    },
  };
}
