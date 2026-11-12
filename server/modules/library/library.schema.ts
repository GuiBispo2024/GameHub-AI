import { z } from 'zod';
import { LIBRARY_STATUSES, LIBRARY_SORT_OPTIONS } from './library.types';

export const libraryStatusSchema = z.enum(LIBRARY_STATUSES, {
  message: 'Status inválido. Valores permitidos: WISHLIST, BACKLOG, PLAYING, COMPLETED, PAUSED, DROPPED.',
});

export const librarySortSchema = z.enum(LIBRARY_SORT_OPTIONS, {
  message:
    'Ordenação inválida. Valores permitidos: recentlyAdded, recentlyUpdated, titleAsc, titleDesc, ratingDesc, hoursPlayedDesc.',
});

export const addLibraryGameSchema = z.object({
  gameId: z.string().uuid({ message: 'O gameId deve ser um UUID válido.' }),
  status: libraryStatusSchema.optional().default('BACKLOG'),
  rating: z
    .number({ message: 'A avaliação deve ser um número inteiro de 0 a 10.' })
    .int({ message: 'A avaliação deve ser um número inteiro de 0 a 10.' })
    .min(0, { message: 'A nota mínima permitida é 0.' })
    .max(10, { message: 'A nota máxima permitida é 10.' })
    .nullable()
    .optional(),
  hoursPlayed: z
    .number({ message: 'As horas jogadas devem ser um número válido.' })
    .min(0, { message: 'As horas jogadas não podem ser negativas.' })
    .max(100000, { message: 'Valor de horas jogadas excede o limite permitido.' })
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000, { message: 'As anotações não podem exceder 2000 caracteres.' })
    .nullable()
    .optional(),
});

export const updateLibraryGameSchema = z
  .object({
    status: libraryStatusSchema.optional(),
    rating: z
      .number({ message: 'A avaliação deve ser um número inteiro de 0 a 10.' })
      .int({ message: 'A avaliação deve ser um número inteiro de 0 a 10.' })
      .min(0, { message: 'A nota mínima permitida é 0.' })
      .max(10, { message: 'A nota máxima permitida é 10.' })
      .nullable()
      .optional(),
    hoursPlayed: z
      .number({ message: 'As horas jogadas devem ser um número válido.' })
      .min(0, { message: 'As horas jogadas não podem ser negativas.' })
      .max(100000, { message: 'Valor de horas jogadas excede o limite permitido.' })
      .optional(),
    notes: z
      .string()
      .trim()
      .max(2000, { message: 'As anotações não podem exceder 2000 caracteres.' })
      .nullable()
      .optional(),
  })
  .strict();

export const libraryEntryIdParamSchema = z.object({
  id: z.string().uuid({ message: 'O identificador da entrada na biblioteca deve ser um UUID válido.' }),
});

export const libraryQuerySchema = z.object({
  status: libraryStatusSchema.optional(),
  genre: z.string().trim().max(80).optional(),
  platform: z.string().trim().max(80).optional(),
  search: z.string().trim().max(100).optional(),
  sort: librarySortSchema.optional().default('recentlyAdded'),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, { message: 'A página deve ser maior ou igual a 1.' })),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(
      z
        .number()
        .int()
        .min(1, { message: 'O limite mínimo é 1.' })
        .max(100, { message: 'O limite máximo é 100.' })
    ),
});
