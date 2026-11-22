import { z } from 'zod';
import { validateSafeSourceUrl } from './knowledge.security';

export const MAX_GUIDE_CONTENT_CHARS = 100_000;

export const knowledgeContentTypeSchema = z.enum(
  ['GUIDE', 'WALKTHROUGH', 'BOSS_STRATEGY', 'BUILD_GUIDE', 'MECHANICS', 'LORE', 'TROPHY_HUNT'],
  {
    message: 'Tipo de conteúdo inválido.',
  }
);

export const knowledgeSpoilerLevelSchema = z.enum(
  [
    'STRICT_NO_SPOILERS',
    'CURRENT_CHAPTER',
    'MID_GAME_SAFE',
    'FULL_UNRESTRICTED',
    'NONE',
    'LIGHT',
    'ALL',
    'ALLOW_ALL',
  ],
  {
    message:
      'Nível de spoiler inválido. Use STRICT_NO_SPOILERS, CURRENT_CHAPTER, MID_GAME_SAFE ou FULL_UNRESTRICTED (ALLOW_ALL).',
  }
);

const safeSourceUrlSchema = z
  .string()
  .trim()
  .max(500, 'A URL da fonte deve ter no máximo 500 caracteres.')
  .nullable()
  .optional()
  .transform((val, ctx) => {
    if (val === undefined) return undefined;
    if (val === null || val === '') return null;
    try {
      return validateSafeSourceUrl(val);
    } catch (err: any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err?.message || 'URL da fonte inválida.',
      });
      return z.NEVER;
    }
  });

export const createKnowledgeGuideSchema = z
  .object({
    gameId: z.string().uuid('O gameId deve ser um UUID válido.'),
    title: z
      .string({ message: 'O título do guia é obrigatório.' })
      .trim()
      .min(3, 'O título deve ter no mínimo 3 caracteres.')
      .max(180, 'O título deve ter no máximo 180 caracteres.'),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug deve conter apenas letras minúsculas, números e hífens.')
      .optional(),
    category: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .optional()
      .default('GUIDE'),
    contentType: knowledgeContentTypeSchema.optional().default('GUIDE'),
    content: z
      .string({ message: 'O conteúdo do documento é obrigatório.' })
      .trim()
      .min(20, 'O conteúdo do guia deve ter no mínimo 20 caracteres.')
      .max(
        MAX_GUIDE_CONTENT_CHARS,
        `O conteúdo do documento não pode exceder ${MAX_GUIDE_CONTENT_CHARS} caracteres.`
      ),
    sourceName: z
      .string()
      .trim()
      .min(2, 'O nome da fonte deve ter pelo menos 2 caracteres.')
      .max(120, 'O nome da fonte deve ter no máximo 120 caracteres.')
      .optional()
      .default('GameHub Editorial'),
    sourceUrl: safeSourceUrlSchema,
    sourceLicense: z
      .string()
      .trim()
      .min(2, 'Informe a licença ou autorização de utilização da fonte.')
      .max(160, 'A licença/autorização deve ter no máximo 160 caracteres.')
      .optional()
      .default('AUTHORIZED_CURATED'),
    language: z
      .string()
      .trim()
      .min(2)
      .max(16)
      .optional()
      .default('pt-BR'),
    spoilerLevel: knowledgeSpoilerLevelSchema.optional().default('CURRENT_CHAPTER'),
    regionOrChapter: z.string().trim().max(120).nullable().optional(),
    targetChapter: z.string().trim().max(120).nullable().optional(),
    progressionOrder: z
      .number()
      .int('progressionOrder deve ser um número inteiro.')
      .min(1, 'progressionOrder deve ser >= 1.')
      .max(1000)
      .nullable()
      .optional(),
    obtainedAt: z.coerce.date().optional(),
    isVerified: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
    maxChunkChars: z.number().int().min(250).max(2500).optional(),
    chunkOverlapChars: z.number().int().min(0).max(400).optional(),
  })
  .strict();

export const updateKnowledgeGuideSchema = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),
    category: z.string().trim().min(2).max(60).optional(),
    contentType: knowledgeContentTypeSchema.optional(),
    content: z.string().trim().min(20).max(MAX_GUIDE_CONTENT_CHARS).optional(),
    sourceName: z.string().trim().min(2).max(120).optional(),
    sourceUrl: safeSourceUrlSchema,
    sourceLicense: z.string().trim().min(2).max(160).optional(),
    language: z.string().trim().min(2).max(16).optional(),
    spoilerLevel: knowledgeSpoilerLevelSchema.optional(),
    regionOrChapter: z.string().trim().max(120).nullable().optional(),
    targetChapter: z.string().trim().max(120).nullable().optional(),
    progressionOrder: z.number().int().min(1).max(1000).nullable().optional(),
    obtainedAt: z.coerce.date().optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    maxChunkChars: z.number().int().min(250).max(2500).optional(),
    chunkOverlapChars: z.number().int().min(0).max(400).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualização.',
  });

export const rechunkGuideSchema = z
  .object({
    maxChunkChars: z.number().int().min(250).max(2500).optional(),
    minChunkChars: z.number().int().min(40).max(400).optional(),
    chunkOverlapChars: z.number().int().min(0).max(400).optional(),
  })
  .strict()
  .optional()
  .default({});

export const guideIdParamSchema = z.object({
  id: z.string().uuid('ID do documento de conhecimento inválido.'),
});

export const listKnowledgeGuidesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  gameId: z.string().uuid('gameId inválido.').optional(),
  category: z.string().trim().max(60).optional(),
  spoilerLevel: knowledgeSpoilerLevelSchema.optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateKnowledgeGuideInput = z.infer<typeof createKnowledgeGuideSchema>;
export type UpdateKnowledgeGuideInput = z.infer<typeof updateKnowledgeGuideSchema>;
export type RechunkGuideInput = z.infer<typeof rechunkGuideSchema>;
export type ListKnowledgeGuidesQuery = z.infer<typeof listKnowledgeGuidesQuerySchema>;
