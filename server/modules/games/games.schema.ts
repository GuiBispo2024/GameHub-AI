import { z } from 'zod';

export const searchGamesQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, { message: 'A busca deve conter pelo menos 1 caractere' })
    .max(100, { message: 'A busca não pode exceder 100 caracteres' }),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, { message: 'A página deve ser maior ou igual a 1' })),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(
      z.number().int().min(1, { message: 'O limite mínimo é 1' }).max(50, { message: 'O limite máximo é 50' })
    ),
  genre: z.string().trim().max(50).optional(),
  platform: z.string().trim().max(50).optional(),
});

export const gameUuidParamSchema = z.object({
  id: z.string().uuid({ message: 'O identificador deve ser um UUID válido' }),
});

export const igdbIdParamSchema = z.object({
  igdbId: z
    .string()
    .regex(/^\d+$/, { message: 'O identificador IGDB deve ser um número inteiro' })
    .transform((val) => parseInt(val, 10)),
});

export type SearchGamesQueryInput = z.infer<typeof searchGamesQuerySchema>;
