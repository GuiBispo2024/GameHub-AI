import { Type } from '@google/genai';
import { z } from 'zod';
import { UserService } from '../../users/user.service';
import { AgentToolDefinition } from './tools.types';

export const getUserPreferencesToolSchema = z.object({}).strict();

export type GetUserPreferencesToolInput = z.infer<typeof getUserPreferencesToolSchema>;

export function createGetUserPreferencesTool(): AgentToolDefinition<GetUserPreferencesToolInput> {
  return {
    name: 'getUserPreferences',
    description:
      'Consulta as preferências gamer do usuário autenticado: plataformas preferidas, gêneros favoritos, idioma e política de spoilers.',
    accessType: 'READ',
    allowedModes: ['LIBRARY', 'COMPANION'],
    requiresOwnershipCheck: true,
    schema: getUserPreferencesToolSchema,
    declaration: {
      name: 'getUserPreferences',
      description:
        'Obtém plataformas favoritas, gêneros favoritos, idioma e nível de preferência de spoilers do usuário autenticado para personalizar recomendações e respostas.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
    execute: async (_args, ctx) => {
      const prefs = await UserService.getPreferences(ctx.userId);
      return {
        source: 'USER_PREFERENCES',
        preferredPlatforms: prefs.preferredPlatforms || [],
        preferredGenres: prefs.preferredGenres || [],
        language: prefs.language || 'pt-BR',
        defaultSpoilerLevel: prefs.defaultSpoilerLevel,
        spoilerLevelFriendly: prefs.spoilerLevelFriendly,
      };
    },
  };
}
