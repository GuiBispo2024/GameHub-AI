import { z } from 'zod';

const MAX_JSON_BYTES = 16384; // 16 KB limit for flexible attributes / equipment payloads
const MAX_JSON_KEYS = 50;

const jsonPrimitiveSchema = z.union([
  z.string().max(500, { message: 'Valor textual no JSON excede 500 caracteres.' }),
  z.number().finite({ message: 'Valor numérico inválido.' }),
  z.boolean(),
  z.null(),
]);

const jsonNestedValueSchema = z.union([
  jsonPrimitiveSchema,
  z
    .array(
      z.union([
        jsonPrimitiveSchema,
        z.record(
          z.string().min(1).max(80),
          jsonPrimitiveSchema
        ),
      ])
    )
    .max(40, { message: 'Array interno excede o limite de 40 itens.' }),
  z
    .record(z.string().min(1).max(80), jsonPrimitiveSchema)
    .refine((obj) => Object.keys(obj).length <= 30, {
      message: 'Sub-objeto excede o limite de 30 chaves.',
    }),
]);

export const flexibleBuildJsonSchema = z
  .record(
    z.string().trim().min(1, { message: 'Chave não pode ser vazia.' }).max(80, {
      message: 'Chave no JSON excede 80 caracteres.',
    }),
    jsonNestedValueSchema,
    { message: 'Deve ser um objeto JSON válido com chaves e valores.' }
  )
  .refine((obj) => Object.keys(obj).length <= MAX_JSON_KEYS, {
    message: `O objeto não pode conter mais que ${MAX_JSON_KEYS} chaves.`,
  })
  .refine(
    (obj) => {
      try {
        return Buffer.byteLength(JSON.stringify(obj), 'utf8') <= MAX_JSON_BYTES;
      } catch {
        return false;
      }
    },
    {
      message: `O payload JSON excede o tamanho máximo permitido de ${MAX_JSON_BYTES} bytes.`,
    }
  );

export const uuidParamSchema = z.object({
  id: z.string().uuid({ message: 'Identificador UUID inválido.' }),
});

export const journeyStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED'], {
  message: 'Estado inválido. Valores permitidos: IN_PROGRESS ou COMPLETED.',
});

export const createJourneySchema = z.object({
  userGameId: z.string().uuid({ message: 'O userGameId deve ser um UUID válido.' }),
  name: z
    .string({ message: 'O nome da jornada é obrigatório.' })
    .trim()
    .min(1, { message: 'O nome da jornada não pode estar vazio.' })
    .max(120, { message: 'O nome da jornada deve ter no máximo 120 caracteres.' }),
  characterName: z
    .string()
    .trim()
    .max(100, { message: 'O nome do personagem deve ter no máximo 100 caracteres.' })
    .nullable()
    .optional(),
  characterClass: z
    .string()
    .trim()
    .max(100, { message: 'A classe ou arquétipo deve ter no máximo 100 caracteres.' })
    .nullable()
    .optional(),
  currentLevel: z
    .number({ message: 'O nível atual deve ser um número inteiro.' })
    .int({ message: 'O nível atual deve ser um número inteiro.' })
    .min(0, { message: 'O nível atual não pode ser negativo.' })
    .max(99999, { message: 'Nível excede o máximo permitido.' })
    .nullable()
    .optional(),
  currentArea: z
    .string()
    .trim()
    .max(150, { message: 'A região atual deve ter no máximo 150 caracteres.' })
    .nullable()
    .optional(),
  currentObjective: z
    .string()
    .trim()
    .max(300, { message: 'O objetivo atual deve ter no máximo 300 caracteres.' })
    .nullable()
    .optional(),
  playtimeHours: z
    .number({ message: 'As horas jogadas devem ser um número válido.' })
    .min(0, { message: 'As horas jogadas não podem ser negativas.' })
    .max(100000, { message: 'As horas jogadas excedem o limite permitido.' })
    .optional(),
  isCompleted: z.boolean().optional(),
  status: journeyStatusSchema.optional(),
  isActive: z.boolean().optional(),
  notes: z
    .string()
    .trim()
    .max(2000, { message: 'As notas da jornada não podem exceder 2000 caracteres.' })
    .nullable()
    .optional(),
});

export const updateJourneySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'O nome da jornada não pode estar vazio.' })
      .max(120, { message: 'O nome da jornada deve ter no máximo 120 caracteres.' })
      .optional(),
    characterName: z
      .string()
      .trim()
      .max(100, { message: 'O nome do personagem deve ter no máximo 100 caracteres.' })
      .nullable()
      .optional(),
    characterClass: z
      .string()
      .trim()
      .max(100, { message: 'A classe ou arquétipo deve ter no máximo 100 caracteres.' })
      .nullable()
      .optional(),
    currentLevel: z
      .number({ message: 'O nível atual deve ser um número inteiro.' })
      .int({ message: 'O nível atual deve ser um número inteiro.' })
      .min(0, { message: 'O nível atual não pode ser negativo.' })
      .max(99999, { message: 'Nível excede o máximo permitido.' })
      .nullable()
      .optional(),
    currentArea: z
      .string()
      .trim()
      .max(150, { message: 'A região atual deve ter no máximo 150 caracteres.' })
      .nullable()
      .optional(),
    currentObjective: z
      .string()
      .trim()
      .max(300, { message: 'O objetivo atual deve ter no máximo 300 caracteres.' })
      .nullable()
      .optional(),
    playtimeHours: z
      .number({ message: 'As horas jogadas devem ser um número válido.' })
      .min(0, { message: 'As horas jogadas não podem ser negativas.' })
      .max(100000, { message: 'As horas jogadas excedem o limite permitido.' })
      .optional(),
    isCompleted: z.boolean().optional(),
    status: journeyStatusSchema.optional(),
    notes: z
      .string()
      .trim()
      .max(2000, { message: 'As notas da jornada não podem exceder 2000 caracteres.' })
      .nullable()
      .optional(),
  })
  .strict();

export const listJourneysQuerySchema = z.object({
  userGameId: z.string().uuid({ message: 'userGameId inválido.' }).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1, { message: 'Página deve ser >= 1.' })),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

export const createProgressLogSchema = z.object({
  areaName: z
    .string()
    .trim()
    .max(150, { message: 'O nome da região deve ter no máximo 150 caracteres.' })
    .nullable()
    .optional(),
  questName: z
    .string()
    .trim()
    .max(150, { message: 'O nome da missão ou checkpoint deve ter no máximo 150 caracteres.' })
    .nullable()
    .optional(),
  description: z
    .string({ message: 'A descrição do progresso é obrigatória.' })
    .trim()
    .min(1, { message: 'A descrição do progresso não pode estar vazia.' })
    .max(2000, { message: 'A descrição não pode exceder 2000 caracteres.' }),
  completionPercent: z
    .number({ message: 'O percentual de conclusão deve ser um número inteiro.' })
    .int({ message: 'O percentual de conclusão deve ser um número inteiro.' })
    .min(0, { message: 'O percentual mínimo é 0.' })
    .max(100, { message: 'O percentual máximo é 100.' })
    .nullable()
    .optional(),
  hoursPlayedAtPoint: z
    .number()
    .min(0, { message: 'As horas jogadas não podem ser negativas.' })
    .max(100000)
    .optional(),
  playerLevelAtPoint: z
    .number()
    .int({ message: 'O nível deve ser um número inteiro.' })
    .min(0, { message: 'O nível não pode ser negativo.' })
    .max(99999)
    .nullable()
    .optional(),
});

export const updateProgressLogSchema = z
  .object({
    areaName: z
      .string()
      .trim()
      .max(150, { message: 'O nome da região deve ter no máximo 150 caracteres.' })
      .nullable()
      .optional(),
    questName: z
      .string()
      .trim()
      .max(150, { message: 'O nome da missão ou checkpoint deve ter no máximo 150 caracteres.' })
      .nullable()
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, { message: 'A descrição do progresso não pode estar vazia.' })
      .max(2000, { message: 'A descrição não pode exceder 2000 caracteres.' })
      .optional(),
    completionPercent: z
      .number({ message: 'O percentual de conclusão deve ser um número inteiro.' })
      .int({ message: 'O percentual de conclusão deve ser um número inteiro.' })
      .min(0, { message: 'O percentual mínimo é 0.' })
      .max(100, { message: 'O percentual máximo é 100.' })
      .nullable()
      .optional(),
    hoursPlayedAtPoint: z.number().min(0).max(100000).optional(),
    playerLevelAtPoint: z.number().int().min(0).max(99999).nullable().optional(),
  })
  .strict();

export const createGameBuildSchema = z.object({
  name: z
    .string({ message: 'O nome da build é obrigatório.' })
    .trim()
    .min(1, { message: 'O nome da build não pode estar vazio.' })
    .max(120, { message: 'O nome da build deve ter no máximo 120 caracteres.' }),
  description: z
    .string()
    .trim()
    .max(2000, { message: 'A descrição da build não pode exceder 2000 caracteres.' })
    .nullable()
    .optional(),
  playstyle: z
    .string()
    .trim()
    .max(100, { message: 'O estilo de jogo deve ter no máximo 100 caracteres.' })
    .nullable()
    .optional(),
  attributes: flexibleBuildJsonSchema.optional().default({}),
  equipment: flexibleBuildJsonSchema.optional().default({}),
  notes: z
    .string()
    .trim()
    .max(2000, { message: 'As observações da build não podem exceder 2000 caracteres.' })
    .nullable()
    .optional(),
});

export const updateGameBuildSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'O nome da build não pode estar vazio.' })
      .max(120, { message: 'O nome da build deve ter no máximo 120 caracteres.' })
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, { message: 'A descrição da build não pode exceder 2000 caracteres.' })
      .nullable()
      .optional(),
    playstyle: z
      .string()
      .trim()
      .max(100, { message: 'O estilo de jogo deve ter no máximo 100 caracteres.' })
      .nullable()
      .optional(),
    attributes: flexibleBuildJsonSchema.optional(),
    equipment: flexibleBuildJsonSchema.optional(),
    notes: z
      .string()
      .trim()
      .max(2000, { message: 'As observações da build não podem exceder 2000 caracteres.' })
      .nullable()
      .optional(),
  })
  .strict();
