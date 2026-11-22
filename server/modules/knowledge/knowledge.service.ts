import { Prisma, SpoilerLevel } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { hasKnowledgeTables } from '../../db/user-compat';
import { logger } from '../../utils/logger';
import { SpoilerLevelValue } from '../agent/agent.types';
import { JourneysService, journeysService as defaultJourneysService } from '../journeys/journeys.service';
import { JourneyContextDTO } from '../journeys/journeys.types';
import { chunkKnowledgeDocument } from './knowledge.chunker';
import {
  CandidateChunkRow,
  KnowledgeRepository,
  extractQueryTokens,
} from './knowledge.repository';
import {
  CreateKnowledgeGuideInput,
  ListKnowledgeGuidesQuery,
  RechunkGuideInput,
  UpdateKnowledgeGuideInput,
} from './knowledge.schema';
import {
  normalizeSearchText,
  sanitizeChunkForPrompt,
  sanitizeKnowledgeText,
  validateSafeSourceUrl,
} from './knowledge.security';
import {
  EvidenceStatus,
  KnowledgeGuideDTO,
  KnowledgeReferenceDTO,
  KnowledgeRetrievalResult,
  RetrievedKnowledgeChunkDTO,
} from './knowledge.types';

const DEFAULT_RETRIEVAL_LIMIT = 4;
const MAX_RETRIEVAL_LIMIT = 6;
const DEFAULT_MAX_CONTEXT_CHARS = 3000;

const SPOILER_RANK: Record<SpoilerLevelValue, number> = {
  STRICT_NO_SPOILERS: 0,
  CURRENT_CHAPTER: 1,
  MID_GAME_SAFE: 2,
  FULL_UNRESTRICTED: 3,
};

function createHttpError(message: string, statusCode: number, code: string) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export function normalizeKnowledgeSpoilerLevel(
  input?: string | null,
  fallback: SpoilerLevelValue = 'CURRENT_CHAPTER'
): SpoilerLevelValue {
  if (!input) return fallback;
  switch (input.toUpperCase()) {
    case 'NONE':
    case 'STRICT_NO_SPOILERS':
      return 'STRICT_NO_SPOILERS';
    case 'LIGHT':
    case 'CURRENT_CHAPTER':
      return 'CURRENT_CHAPTER';
    case 'MID_GAME_SAFE':
      return 'MID_GAME_SAFE';
    case 'ALL':
    case 'ALLOW_ALL':
    case 'FULL_UNRESTRICTED':
      return 'FULL_UNRESTRICTED';
    default:
      return fallback;
  }
}

function slugifyTitle(title: string): string {
  const base = normalizeSearchText(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return base || `guide-${Date.now()}`;
}

function regionsMatch(regionA: string | null | undefined, regionB: string | null | undefined): boolean {
  const normA = normalizeSearchText(regionA);
  const normB = normalizeSearchText(regionB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  // Safe whole-token containment (e.g. "Liurnia" matches "Liurnia dos Lagos")
  if (normA.length >= 4 && normB.includes(normA)) {
    const escaped = normA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(normB);
  }
  if (normB.length >= 4 && normA.includes(normB)) {
    const escaped = normB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(normA);
  }
  return false;
}

function splitNormalizedWords(value: string): string[] {
  if (!value) return [];
  return value.split(/\s+/).filter(Boolean);
}

function hasTokenMatch(words: string[], token: string): boolean {
  if (words.length === 0 || !token) return false;
  for (const w of words) {
    if (w === token) return true;
    // Allow morphological prefix matching only for >= 5-char tokens so short words like "rio" never match "prioridade"
    if (token.length >= 5 && (w.startsWith(token) || (w.length >= 5 && token.startsWith(w)))) {
      return true;
    }
  }
  return false;
}

export function evaluateChunkSpoilerAccess(params: {
  chunkSpoilerLevel: SpoilerLevelValue;
  guideSpoilerLevel: SpoilerLevelValue;
  chunkRegionOrChapter: string | null;
  chunkProgressionOrder: number | null;
  effectiveUserSpoilerLevel: SpoilerLevelValue;
  playerCurrentRegion: string | null;
  playerProgressionOrder: number | null;
}): { allowed: boolean; effectiveChunkLevel: SpoilerLevelValue; reason?: string } {
  const effectiveChunkLevel =
    SPOILER_RANK[params.chunkSpoilerLevel] >= SPOILER_RANK[params.guideSpoilerLevel]
      ? params.chunkSpoilerLevel
      : params.guideSpoilerLevel;

  const userPolicy = params.effectiveUserSpoilerLevel;

  if (userPolicy === 'FULL_UNRESTRICTED') {
    return { allowed: true, effectiveChunkLevel };
  }

  if (userPolicy === 'STRICT_NO_SPOILERS') {
    if (effectiveChunkLevel === 'STRICT_NO_SPOILERS') {
      return { allowed: true, effectiveChunkLevel };
    }
    return {
      allowed: false,
      effectiveChunkLevel,
      reason: 'STRICT_NO_SPOILERS bloqueia conteúdo narrativo ou de capítulos.',
    };
  }

  if (userPolicy === 'MID_GAME_SAFE') {
    if (SPOILER_RANK[effectiveChunkLevel] <= SPOILER_RANK.MID_GAME_SAFE) {
      return { allowed: true, effectiveChunkLevel };
    }
    return {
      allowed: false,
      effectiveChunkLevel,
      reason: 'MID_GAME_SAFE bloqueia conteúdo de endgame/finais.',
    };
  }

  // userPolicy === 'CURRENT_CHAPTER'
  if (effectiveChunkLevel === 'STRICT_NO_SPOILERS') {
    return { allowed: true, effectiveChunkLevel };
  }

  if (SPOILER_RANK[effectiveChunkLevel] > SPOILER_RANK.CURRENT_CHAPTER) {
    return {
      allowed: false,
      effectiveChunkLevel,
      reason: 'CURRENT_CHAPTER bloqueia conteúdo além do capítulo atual (mid/endgame).',
    };
  }

  // effectiveChunkLevel === 'CURRENT_CHAPTER' -> validate progress & metadata strictly
  const chunkRegion = params.chunkRegionOrChapter;
  const chunkOrder = params.chunkProgressionOrder;
  const playerRegion = params.playerCurrentRegion;
  const playerOrder = params.playerProgressionOrder;

  if (!playerRegion && playerOrder === null) {
    return {
      allowed: false,
      effectiveChunkLevel,
      reason: 'Progresso atual do jogador desconhecido; política conservadora aplicada.',
    };
  }

  // If chunk lacks both region/chapter and progressionOrder metadata, exclude defensively
  if (!chunkRegion && chunkOrder === null) {
    return {
      allowed: false,
      effectiveChunkLevel,
      reason: 'Metadados de capítulo/progressão insuficientes no documento.',
    };
  }

  // If both player and chunk have reliably mapped progressionOrder
  if (chunkOrder !== null && playerOrder !== null) {
    if (chunkOrder <= playerOrder) {
      return { allowed: true, effectiveChunkLevel };
    }
    return {
      allowed: false,
      effectiveChunkLevel,
      reason: 'Trecho pertence a etapa posterior ao progresso conhecido.',
    };
  }

  // If progression order isn't reliably mapped for one or both, only allow exact/safe region match
  if (chunkRegion && playerRegion && regionsMatch(chunkRegion, playerRegion)) {
    return { allowed: true, effectiveChunkLevel };
  }

  // Conservative fallback: do NOT assume alphabetical or arbitrary region order
  return {
    allowed: false,
    effectiveChunkLevel,
    reason: 'Ordem de progressão entre regiões não mapeada de forma confiável.',
  };
}

export class KnowledgeService {
  private readonly repository: KnowledgeRepository;
  private readonly journeys: JourneysService;

  constructor(repository?: KnowledgeRepository, journeys?: JourneysService) {
    this.repository = repository || new KnowledgeRepository();
    this.journeys = journeys || defaultJourneysService;
  }

  async createGuide(authorId: string, input: CreateKnowledgeGuideInput): Promise<KnowledgeGuideDTO> {
    const game = await this.repository.findGameById(input.gameId);
    if (!game) {
      throw createHttpError(
        'Jogo associado não encontrado no catálogo. Cadastre ou selecione um jogo válido.',
        404,
        'GAME_NOT_FOUND'
      );
    }

    const sanitizedTitle = sanitizeKnowledgeText(input.title, 180);
    const sanitizedContent = sanitizeKnowledgeText(input.content, 100_000);
    if (sanitizedContent.length < 20) {
      throw createHttpError(
        'Após sanitização, o conteúdo do guia ficou abaixo do mínimo permitido (20 caracteres).',
        400,
        'INVALID_GUIDE_CONTENT'
      );
    }

    const safeUrl = validateSafeSourceUrl(input.sourceUrl ?? null);
    const slug = input.slug || slugifyTitle(sanitizedTitle);

    const duplicate = await this.repository.findDuplicateGuide({
      gameId: input.gameId,
      slug,
      title: sanitizedTitle,
      sourceUrl: safeUrl,
    });
    if (duplicate) {
      throw createHttpError(
        'Já existe um documento cadastrado para este jogo com o mesmo título, slug ou URL de fonte.',
        409,
        'DUPLICATE_GUIDE'
      );
    }

    const spoilerLevel = normalizeKnowledgeSpoilerLevel(input.spoilerLevel, 'CURRENT_CHAPTER');
    const regionOrChapter =
      input.regionOrChapter !== undefined
        ? input.regionOrChapter
        : (input.targetChapter ?? null);

    const chunks = chunkKnowledgeDocument(sanitizedContent, {
      maxChunkChars: input.maxChunkChars,
      overlapChars: input.chunkOverlapChars,
    });

    if (chunks.length === 0) {
      throw createHttpError(
        'Não foi possível extrair trechos pesquisáveis válidos do documento.',
        400,
        'EMPTY_GUIDE_CHUNKS'
      );
    }

    const created = await this.repository.createGuideWithChunks(
      {
        gameId: input.gameId,
        authorId,
        title: sanitizedTitle,
        slug,
        category: input.category,
        contentType: input.contentType,
        content: sanitizedContent,
        sourceName: sanitizeKnowledgeText(input.sourceName, 120) || 'GameHub Editorial',
        sourceUrl: safeUrl,
        sourceLicense: sanitizeKnowledgeText(input.sourceLicense, 160) || 'AUTHORIZED_CURATED',
        language: input.language,
        spoilerLevel,
        regionOrChapter,
        targetChapter: regionOrChapter,
        progressionOrder: input.progressionOrder ?? null,
        obtainedAt: input.obtainedAt ?? new Date(),
        isVerified: input.isVerified ?? true,
        isActive: input.isActive ?? true,
        tags: (input.tags || []).map((t) => sanitizeKnowledgeText(t, 40)).filter(Boolean),
      },
      chunks
    );

    logger.info('[KnowledgeService] Documento cadastrado na base de conhecimento', {
      guideId: created.id,
      gameId: created.gameId,
      spoilerLevel: created.spoilerLevel,
      chunkCount: chunks.length,
    });

    return KnowledgeRepository.toGuideDTO(created);
  }

  async listGuides(query: ListKnowledgeGuidesQuery) {
    const normalizedSpoiler = query.spoilerLevel
      ? normalizeKnowledgeSpoilerLevel(query.spoilerLevel)
      : undefined;
    const { rows, total } = await this.repository.listGuides(query, normalizedSpoiler);
    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      status: 'success' as const,
      data: rows.map(KnowledgeRepository.toGuideDTO),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }

  async getGuideById(id: string) {
    const guide = await this.repository.findGuideById(id);
    if (!guide) {
      throw createHttpError('Documento de conhecimento não encontrado.', 404, 'GUIDE_NOT_FOUND');
    }

    return {
      ...KnowledgeRepository.toGuideDTO(guide),
      chunks: (guide.chunks || []).map(KnowledgeRepository.toChunkSummaryDTO),
    };
  }

  async updateGuide(id: string, input: UpdateKnowledgeGuideInput): Promise<KnowledgeGuideDTO> {
    const existing = await this.repository.findGuideById(id);
    if (!existing) {
      throw createHttpError('Documento de conhecimento não encontrado.', 404, 'GUIDE_NOT_FOUND');
    }

    const nextTitle =
      input.title !== undefined ? sanitizeKnowledgeText(input.title, 180) : existing.title;
    const nextUrl =
      input.sourceUrl !== undefined ? validateSafeSourceUrl(input.sourceUrl) : existing.sourceUrl;

    if (input.title !== undefined || input.sourceUrl !== undefined) {
      const duplicate = await this.repository.findDuplicateGuide({
        gameId: existing.gameId,
        slug: existing.slug,
        title: nextTitle,
        sourceUrl: nextUrl,
        excludeId: existing.id,
      });
      if (duplicate) {
        throw createHttpError(
          'Outro documento deste jogo já utiliza este título ou URL de fonte.',
          409,
          'DUPLICATE_GUIDE'
        );
      }
    }

    const nextContent =
      input.content !== undefined
        ? sanitizeKnowledgeText(input.content, 100_000)
        : existing.content;
    const nextSpoiler =
      input.spoilerLevel !== undefined
        ? normalizeKnowledgeSpoilerLevel(input.spoilerLevel)
        : (existing.spoilerLevel as SpoilerLevelValue);
    const nextRegion =
      input.regionOrChapter !== undefined
        ? input.regionOrChapter
        : input.targetChapter !== undefined
          ? input.targetChapter
          : (existing.regionOrChapter ?? existing.targetChapter ?? null);
    const nextOrder =
      input.progressionOrder !== undefined
        ? input.progressionOrder
        : (existing.progressionOrder ?? null);
    const nextLanguage = input.language ?? existing.language;
    const nextTags =
      input.tags !== undefined
        ? input.tags.map((t) => sanitizeKnowledgeText(t, 40)).filter(Boolean)
        : existing.tags || [];

    const updateData: Prisma.GameGuideUpdateInput = {
      ...(input.title !== undefined ? { title: nextTitle } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.contentType !== undefined ? { contentType: input.contentType } : {}),
      ...(input.content !== undefined ? { content: nextContent } : {}),
      ...(input.sourceName !== undefined
        ? { sourceName: sanitizeKnowledgeText(input.sourceName, 120) }
        : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: nextUrl } : {}),
      ...(input.sourceLicense !== undefined
        ? { sourceLicense: sanitizeKnowledgeText(input.sourceLicense, 160) }
        : {}),
      ...(input.language !== undefined ? { language: nextLanguage } : {}),
      ...(input.spoilerLevel !== undefined ? { spoilerLevel: nextSpoiler as SpoilerLevel } : {}),
      ...(input.regionOrChapter !== undefined || input.targetChapter !== undefined
        ? { regionOrChapter: nextRegion, targetChapter: nextRegion }
        : {}),
      ...(input.progressionOrder !== undefined ? { progressionOrder: nextOrder } : {}),
      ...(input.obtainedAt !== undefined ? { obtainedAt: input.obtainedAt } : {}),
      ...(input.isVerified !== undefined ? { isVerified: input.isVerified } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.tags !== undefined ? { tags: nextTags } : {}),
    };

    const needsChunkRebuild =
      input.content !== undefined ||
      input.spoilerLevel !== undefined ||
      input.regionOrChapter !== undefined ||
      input.targetChapter !== undefined ||
      input.progressionOrder !== undefined ||
      input.language !== undefined ||
      input.tags !== undefined ||
      input.maxChunkChars !== undefined ||
      input.chunkOverlapChars !== undefined;

    const updated = await this.repository.updateGuideAndReplaceChunks(
      id,
      updateData,
      needsChunkRebuild
        ? {
            gameId: existing.gameId,
            spoilerLevel: nextSpoiler,
            regionOrChapter: nextRegion,
            progressionOrder: nextOrder,
            language: nextLanguage,
            tags: nextTags,
            chunks: chunkKnowledgeDocument(nextContent, {
              maxChunkChars: input.maxChunkChars,
              overlapChars: input.chunkOverlapChars,
            }),
          }
        : undefined
    );

    return KnowledgeRepository.toGuideDTO(updated);
  }

  async rechunkGuide(id: string, input: RechunkGuideInput = {}) {
    const existing = await this.repository.findGuideById(id);
    if (!existing) {
      throw createHttpError('Documento de conhecimento não encontrado.', 404, 'GUIDE_NOT_FOUND');
    }

    const chunks = chunkKnowledgeDocument(existing.content, {
      maxChunkChars: input.maxChunkChars,
      minChunkChars: input.minChunkChars,
      overlapChars: input.chunkOverlapChars,
    });

    const updated = await this.repository.replaceChunksOnly(
      id,
      {
        gameId: existing.gameId,
        spoilerLevel: existing.spoilerLevel as SpoilerLevelValue,
        regionOrChapter: existing.regionOrChapter ?? existing.targetChapter ?? null,
        progressionOrder: existing.progressionOrder ?? null,
        language: existing.language,
        tags: existing.tags || [],
      },
      chunks
    );

    return KnowledgeRepository.toGuideDTO(updated);
  }

  async deleteGuide(id: string): Promise<void> {
    const existing = await this.repository.findGuideById(id);
    if (!existing) {
      throw createHttpError('Documento de conhecimento não encontrado.', 404, 'GUIDE_NOT_FOUND');
    }
    await this.repository.deleteGuide(id);
  }

  /**
   * Core RAG retrieval pipeline:
   * 1. Validates target game and optional user-owned journey context.
   * 2. Searches PostgreSQL FTS chunks strictly for target gameId.
   * 3. Scores textual relevance (incorporating journey hints).
   * 4. Enforces backend spoiler policy BEFORE selecting chunks.
   * 5. Deduplicates and bounds output size + chunk count.
   * 6. Returns verifiable source references and evidence status.
   */
  async retrieveKnowledge(params: {
    userId: string;
    gameId: string;
    query: string;
    journeyId?: string | null;
    effectiveSpoilerLevel: SpoilerLevelValue;
    limit?: number;
    maxTotalContextChars?: number;
  }): Promise<KnowledgeRetrievalResult> {
    const game = await this.repository.findGameById(params.gameId);
    if (!game) {
      throw createHttpError('Jogo não encontrado no catálogo.', 404, 'GAME_NOT_FOUND');
    }

    // Load & authorize journey context if provided
    let journeyContext: JourneyContextDTO | null = null;
    if (params.journeyId) {
      journeyContext = await this.journeys.getJourneyContext(params.userId, params.journeyId, 6);
      if (journeyContext.game.id !== game.id) {
        throw createHttpError(
          'A jornada informada não pertence ao jogo selecionado para busca.',
          400,
          'JOURNEY_GAME_MISMATCH'
        );
      }
    }

    // Resolve player's known region/chapter from journey or personal library
    let playerCurrentRegion: string | null = journeyContext?.journey.currentArea ?? null;
    if (!playerCurrentRegion) {
      const userGame = await prisma.userGame.findUnique({
        where: { userId_gameId: { userId: params.userId, gameId: game.id } },
        select: { currentChapter: true },
      });
      playerCurrentRegion = userGame?.currentChapter ?? null;
    }

    const knowledgeReady = await hasKnowledgeTables();
    if (!knowledgeReady) {
      return {
        sufficientEvidence: false,
        evidenceStatus: 'NO_DOCUMENTS',
        spoilerPolicyApplied: params.effectiveSpoilerLevel,
        spoilerRestricted: false,
        blockedChunksCount: 0,
        matchedBeforeFilter: 0,
        totalContextChars: 0,
        game: { id: game.id, title: game.name, slug: game.slug },
        journeyContextApplied: Boolean(journeyContext),
        playerCurrentRegion,
        chunks: [],
        references: [],
        message: `A base de conhecimento para "${game.name}" ainda não foi populada neste ambiente.`,
      };
    }

    // Resolve reliable progressionOrder ONLY when explicitly mapped in this game's guides
    const regionMappings = await this.repository.listRegionProgressionMappings(game.id);
    let playerProgressionOrder: number | null = null;
    if (playerCurrentRegion && regionMappings.length > 0) {
      const matchedMapping = regionMappings.find((m) =>
        regionsMatch(m.regionOrChapter, playerCurrentRegion)
      );
      if (matchedMapping) {
        playerProgressionOrder = matchedMapping.progressionOrder;
      }
    }

    const totalActiveChunks = await this.repository.countActiveChunksForGame(game.id);
    if (totalActiveChunks === 0) {
      return {
        sufficientEvidence: false,
        evidenceStatus: 'NO_DOCUMENTS',
        spoilerPolicyApplied: params.effectiveSpoilerLevel,
        spoilerRestricted: false,
        blockedChunksCount: 0,
        matchedBeforeFilter: 0,
        totalContextChars: 0,
        game: { id: game.id, title: game.name, slug: game.slug },
        journeyContextApplied: Boolean(journeyContext),
        playerCurrentRegion,
        chunks: [],
        references: [],
        message: `Não há documentos autorizados cadastrados na base de conhecimento para "${game.name}".`,
      };
    }

    const queryTokens = extractQueryTokens(params.query);
    const journeyHintTerms = journeyContext
      ? extractQueryTokens(
          [
            journeyContext.journey.characterClass || '',
            journeyContext.journey.currentArea || '',
            journeyContext.journey.currentObjective || '',
          ].join(' ')
        )
      : [];

    const candidates = await this.repository.searchGameChunksFts(game.id, params.query, 50);

    // Score relevance strictly against the query (plus secondary alignment boost from journey)
    const scoredCandidates: Array<{ row: CandidateChunkRow; score: number }> = [];
    for (const row of candidates) {
      const contentWords = splitNormalizedWords(normalizeSearchText(row.content));
      const headingWords = splitNormalizedWords(normalizeSearchText(row.heading || ''));
      const titleWords = splitNormalizedWords(normalizeSearchText(row.guideTitle));
      const tagWords = splitNormalizedWords(normalizeSearchText((row.chunkTags || []).join(' ')));

      let queryHits = 0;
      let headingOrTitleHits = 0;
      for (const token of queryTokens) {
        if (hasTokenMatch(contentWords, token)) queryHits++;
        if (hasTokenMatch(headingWords, token) || hasTokenMatch(titleWords, token)) {
          headingOrTitleHits++;
        }
        if (hasTokenMatch(tagWords, token)) queryHits += 0.75;
      }

      const ftsScore = Number(row.ftsRank || 0) * 6;
      const baseQueryRelevance = ftsScore + queryHits * 2 + headingOrTitleHits * 2.5;

      // Require real query relevance so unrelated chunks do not pollute context
      if (queryTokens.length > 0 && baseQueryRelevance <= 0) {
        continue;
      }
      if (queryTokens.length === 0 && ftsScore <= 0) {
        continue;
      }

      let journeyBonus = 0;
      for (const hint of journeyHintTerms) {
        if (
          hasTokenMatch(contentWords, hint) ||
          hasTokenMatch(headingWords, hint) ||
          hasTokenMatch(tagWords, hint)
        ) {
          journeyBonus += 0.6;
        }
      }
      if (
        playerCurrentRegion &&
        regionsMatch(row.chunkRegionOrChapter ?? row.guideRegionOrChapter, playerCurrentRegion)
      ) {
        journeyBonus += 1.25;
      }

      const totalScore = Number((baseQueryRelevance + journeyBonus + (row.guideIsVerified ? 0.25 : 0)).toFixed(3));
      scoredCandidates.push({ row, score: totalScore });
    }

    scoredCandidates.sort((a, b) => b.score - a.score || a.row.chunkIndex - b.row.chunkIndex);

    // CRITICAL: Apply spoiler filtering BEFORE selecting any chunks for model or client
    const allowedCandidates: Array<{ row: CandidateChunkRow; score: number; effectiveLevel: SpoilerLevelValue }> = [];
    let blockedChunksCount = 0;

    for (const candidate of scoredCandidates) {
      const check = evaluateChunkSpoilerAccess({
        chunkSpoilerLevel: candidate.row.chunkSpoilerLevel,
        guideSpoilerLevel: candidate.row.guideSpoilerLevel,
        chunkRegionOrChapter: candidate.row.chunkRegionOrChapter ?? candidate.row.guideRegionOrChapter,
        chunkProgressionOrder:
          candidate.row.chunkProgressionOrder ?? candidate.row.guideProgressionOrder,
        effectiveUserSpoilerLevel: params.effectiveSpoilerLevel,
        playerCurrentRegion,
        playerProgressionOrder,
      });

      if (check.allowed) {
        allowedCandidates.push({
          row: candidate.row,
          score: candidate.score,
          effectiveLevel: check.effectiveChunkLevel,
        });
      } else {
        blockedChunksCount++;
      }
    }

    // Deduplicate and enforce limit + total character budget
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_RETRIEVAL_LIMIT, 1), MAX_RETRIEVAL_LIMIT);
    const maxContextChars = Math.min(
      Math.max(params.maxTotalContextChars ?? DEFAULT_MAX_CONTEXT_CHARS, 600),
      4000
    );

    const selectedChunks: RetrievedKnowledgeChunkDTO[] = [];
    const seenFingerprints = new Set<string>();
    const referencesMap = new Map<string, KnowledgeReferenceDTO>();
    let totalContextChars = 0;

    for (const item of allowedCandidates) {
      if (selectedChunks.length >= limit) break;

      const cleanContent = sanitizeChunkForPrompt(item.row.content, 950);
      if (!cleanContent) continue;

      const fingerprint = normalizeSearchText(cleanContent).slice(0, 140);
      if (seenFingerprints.has(fingerprint)) continue;

      if (
        selectedChunks.length > 0 &&
        totalContextChars + cleanContent.length > maxContextChars
      ) {
        continue;
      }

      seenFingerprints.add(fingerprint);
      totalContextChars += cleanContent.length;

      selectedChunks.push({
        chunkId: item.row.chunkId,
        guideId: item.row.guideId,
        chunkIndex: item.row.chunkIndex,
        heading: item.row.heading ? sanitizeChunkForPrompt(item.row.heading, 140) : null,
        content: cleanContent,
        spoilerLevel: item.effectiveLevel,
        regionOrChapter: item.row.chunkRegionOrChapter ?? item.row.guideRegionOrChapter,
        progressionOrder: item.row.chunkProgressionOrder ?? item.row.guideProgressionOrder,
        score: item.score,
        sourceTitle: sanitizeChunkForPrompt(item.row.guideTitle, 180),
        sourceName: sanitizeChunkForPrompt(item.row.guideSourceName, 120),
        sourceUrl: item.row.guideSourceUrl,
        sourceLicense: item.row.guideSourceLicense,
        isVerified: item.row.guideIsVerified,
      });

      if (!referencesMap.has(item.row.guideId)) {
        referencesMap.set(item.row.guideId, {
          guideId: item.row.guideId,
          title: sanitizeChunkForPrompt(item.row.guideTitle, 180),
          sourceName: sanitizeChunkForPrompt(item.row.guideSourceName, 120),
          sourceUrl: item.row.guideSourceUrl,
          sourceLicense: item.row.guideSourceLicense,
          obtainedAt: new Date(item.row.guideObtainedAt).toISOString(),
          isVerified: item.row.guideIsVerified,
          spoilerLevel: item.row.guideSpoilerLevel,
          regionOrChapter: item.row.guideRegionOrChapter,
          contentType: item.row.guideContentType,
        });
      }
    }

    const spoilerRestricted = blockedChunksCount > 0;
    let evidenceStatus: EvidenceStatus;
    let message: string;

    if (selectedChunks.length > 0) {
      evidenceStatus = 'SUFFICIENT';
      message = spoilerRestricted
        ? `Encontrados ${selectedChunks.length} trechos seguros (${blockedChunksCount} trechos ocultados pela política de spoilers ${params.effectiveSpoilerLevel}).`
        : `Encontrados ${selectedChunks.length} trechos relevantes na base de conhecimento de "${game.name}".`;
    } else if (blockedChunksCount > 0) {
      evidenceStatus = 'BLOCKED_BY_SPOILERS';
      message = `Existem trechos relacionados a essa pergunta para "${game.name}", mas todos foram bloqueados pela política de spoilers ativa (${params.effectiveSpoilerLevel}).`;
    } else {
      evidenceStatus = 'INSUFFICIENT';
      message = `Não foram encontrados trechos suficientes na base de conhecimento de "${game.name}" para responder com base documental a esta pergunta.`;
    }

    return {
      sufficientEvidence: selectedChunks.length > 0,
      evidenceStatus,
      spoilerPolicyApplied: params.effectiveSpoilerLevel,
      spoilerRestricted,
      blockedChunksCount,
      matchedBeforeFilter: scoredCandidates.length,
      totalContextChars,
      game: { id: game.id, title: game.name, slug: game.slug },
      journeyContextApplied: Boolean(journeyContext),
      playerCurrentRegion,
      chunks: selectedChunks,
      references: Array.from(referencesMap.values()),
      message,
    };
  }
}

export const knowledgeService = new KnowledgeService();
