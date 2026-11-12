import { z } from 'zod';

export const updateUserSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'O nome de usuário deve ter no mínimo 3 caracteres' })
    .max(30, { message: 'O nome de usuário deve ter no máximo 30 caracteres' })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'O nome de usuário só pode conter letras, números, sublinhados e hífens',
    })
    .optional(),
  bio: z
    .string()
    .max(300, { message: 'A bio não pode exceder 300 caracteres' })
    .optional()
    .nullable(),
  avatarUrl: z
    .string()
    .url({ message: 'URL do avatar inválida' })
    .optional()
    .nullable()
    .or(z.literal('')),
});

export const spoilerLevelEnum = z.enum([
  'NONE',
  'LIGHT',
  'ALL',
  'STRICT_NO_SPOILERS',
  'CURRENT_CHAPTER',
  'MID_GAME_SAFE',
  'FULL_UNRESTRICTED',
]);

export const updatePreferencesSchema = z.object({
  theme: z.enum(['dark', 'neon', 'cyberpunk', 'high-contrast']).optional(),
  defaultSpoilerLevel: spoilerLevelEnum.optional(),
  spoilerLevel: spoilerLevelEnum.optional(),
  preferredPlatforms: z.array(z.string()).optional(),
  preferredGenres: z.array(z.string()).optional(),
  language: z.string().min(2).max(10).optional(),
  overlayEnabled: z.boolean().optional(),
  overlayHotkey: z.string().min(2).max(20).optional(),
  notificationsEnabled: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
