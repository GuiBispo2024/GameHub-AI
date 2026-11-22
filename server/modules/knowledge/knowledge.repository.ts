import { Prisma, SpoilerLevel } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { SpoilerLevelValue } from '../agent/agent.types';
import { DocumentChunkOutput } from './knowledge.chunker';
import { normalizeSearchText } from './knowledge.security';
import { ListKnowledgeGuidesQuery } from './knowledge.schema';
import { KnowledgeChunkSummaryDTO, KnowledgeGuideDTO } from './knowledge.types';

export interface CandidateChunkRow {
  chunkId: string;
  guideId: string;
  gameId: string;
  chunkIndex: number;
  heading: string | null;
  content: string;
  charCount: number;
  tokenCount: number;
  chunkSpoilerLevel: SpoilerLevelValue;
  chunkRegionOrChapter: string | null;
  chunkProgressionOrder: number | null;
  chunkLanguage: string;
  chunkTags: string[];
  guideTitle: string;
  guideContentType: string;
  guideSourceName: string;
  guideSourceUrl: string | null;
  guideSourceLicense: string;
  guideSpoilerLevel: SpoilerLevelValue;
  guideRegionOrChapter: string | null;
  guideProgressionOrder: number | null;
  guideObtainedAt: Date;
  guideIsVerified: boolean;
  ftsRank: number;
}

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
  'para', 'por', 'com', 'sem', 'sob', 'sobre', 'entre',
  'e', 'ou', 'mas', 'que', 'qual', 'quais', 'como', 'onde', 'quando',
  'the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'with', 'and', 'or', 'is', 'are', 'how', 'what', 'where',
]);

export function extractQueryTokens(rawQuery: string): string[] {
  const normalized = normalizeSearchText(rawQuery);
  if (!normalized) return [];
  const tokens = normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return Array.from(new Set(tokens)).slice(0, 12);
}

function buildSafeSimpleTsQuery(rawQuery: string): string | null {
  // Extract strict alphanumeric tokens only so to_tsquery syntax cannot ever throw
  const cleaned = rawQuery
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(normalizeSearchText(t)));

  const unique = Array.from(new Set(cleaned)).slice(0, 10);
  if (unique.length === 0) return null;
  return unique.join(' | ');
}

export class KnowledgeRepository {
  static toGuideDTO(record: any): KnowledgeGuideDTO {
    return {
      id: record.id,
      gameId: record.gameId,
      ...(record.game ? { gameTitle: record.game.name } : {}),
      authorId: record.authorId ?? null,
      title: record.title,
      slug: record.slug,
      category: record.category,
      contentType: record.contentType,
      content: record.content,
      sourceName: record.sourceName,
      sourceUrl: record.sourceUrl ?? null,
      sourceLicense: record.sourceLicense,
      language: record.language,
      spoilerLevel: record.spoilerLevel as SpoilerLevelValue,
      regionOrChapter: record.regionOrChapter ?? record.targetChapter ?? null,
      progressionOrder: record.progressionOrder ?? null,
      obtainedAt: new Date(record.obtainedAt).toISOString(),
      isVerified: Boolean(record.isVerified),
      isActive: Boolean(record.isActive),
      tags: record.tags || [],
      chunkCount: record._count?.chunks ?? (Array.isArray(record.chunks) ? record.chunks.length : 0),
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  static toChunkSummaryDTO(record: any): KnowledgeChunkSummaryDTO {
    return {
      id: record.id,
      guideId: record.guideId,
      chunkIndex: record.chunkIndex,
      heading: record.heading ?? null,
      content: record.content,
      charCount: record.charCount,
      tokenCount: record.tokenCount,
      spoilerLevel: record.spoilerLevel as SpoilerLevelValue,
      regionOrChapter: record.regionOrChapter ?? null,
      progressionOrder: record.progressionOrder ?? null,
      language: record.language,
      tags: record.tags || [],
    };
  }

  async findGameById(gameId: string) {
    return prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, name: true, slug: true },
    });
  }

  async findGuideById(id: string) {
    return prisma.gameGuide.findUnique({
      where: { id },
      include: {
        game: { select: { id: true, name: true, slug: true } },
        chunks: { orderBy: { chunkIndex: 'asc' } },
        _count: { select: { chunks: true } },
      },
    });
  }

  async findGuideByGameAndSlug(gameId: string, slug: string) {
    return prisma.gameGuide.findUnique({
      where: {
        gameId_slug: { gameId, slug },
      },
    });
  }

  async findDuplicateGuide(params: {
    gameId: string;
    slug: string;
    title: string;
    sourceUrl?: string | null;
    excludeId?: string;
  }) {
    const orClauses: Prisma.GameGuideWhereInput[] = [
      { slug: params.slug },
      { title: { equals: params.title, mode: 'insensitive' } },
    ];
    if (params.sourceUrl) {
      orClauses.push({ sourceUrl: params.sourceUrl });
    }

    return prisma.gameGuide.findFirst({
      where: {
        gameId: params.gameId,
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        OR: orClauses,
      },
      select: { id: true, title: true, slug: true, sourceUrl: true },
    });
  }

  async createGuideWithChunks(
    data: {
      gameId: string;
      authorId: string | null;
      title: string;
      slug: string;
      category: string;
      contentType: string;
      content: string;
      sourceName: string;
      sourceUrl: string | null;
      sourceLicense: string;
      language: string;
      spoilerLevel: SpoilerLevelValue;
      regionOrChapter: string | null;
      targetChapter: string | null;
      progressionOrder: number | null;
      obtainedAt: Date;
      isVerified: boolean;
      isActive: boolean;
      tags: string[];
    },
    chunks: DocumentChunkOutput[]
  ) {
    return prisma.$transaction(async (tx) => {
      const guide = await tx.gameGuide.create({
        data: {
          gameId: data.gameId,
          authorId: data.authorId,
          title: data.title,
          slug: data.slug,
          category: data.category,
          contentType: data.contentType,
          content: data.content,
          sourceName: data.sourceName,
          sourceUrl: data.sourceUrl,
          sourceLicense: data.sourceLicense,
          language: data.language,
          spoilerLevel: data.spoilerLevel as SpoilerLevel,
          regionOrChapter: data.regionOrChapter,
          targetChapter: data.targetChapter,
          progressionOrder: data.progressionOrder,
          obtainedAt: data.obtainedAt,
          isVerified: data.isVerified,
          isActive: data.isActive,
          tags: data.tags,
        },
      });

      if (chunks.length > 0) {
        await tx.gameGuideChunk.createMany({
          data: chunks.map((chunk) => ({
            guideId: guide.id,
            gameId: data.gameId,
            chunkIndex: chunk.chunkIndex,
            heading: chunk.heading,
            content: chunk.content,
            charCount: chunk.charCount,
            tokenCount: chunk.tokenCount,
            spoilerLevel: data.spoilerLevel as SpoilerLevel,
            regionOrChapter: data.regionOrChapter,
            progressionOrder: data.progressionOrder,
            language: data.language,
            tags: data.tags,
          })),
        });
      }

      return tx.gameGuide.findUniqueOrThrow({
        where: { id: guide.id },
        include: {
          game: { select: { id: true, name: true, slug: true } },
          chunks: { orderBy: { chunkIndex: 'asc' } },
          _count: { select: { chunks: true } },
        },
      });
    });
  }

  async updateGuideAndReplaceChunks(
    id: string,
    updateData: Prisma.GameGuideUpdateInput,
    newChunks?: {
      gameId: string;
      spoilerLevel: SpoilerLevelValue;
      regionOrChapter: string | null;
      progressionOrder: number | null;
      language: string;
      tags: string[];
      chunks: DocumentChunkOutput[];
    }
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.gameGuide.update({
        where: { id },
        data: updateData,
      });

      if (newChunks) {
        await tx.gameGuideChunk.deleteMany({ where: { guideId: id } });
        if (newChunks.chunks.length > 0) {
          await tx.gameGuideChunk.createMany({
            data: newChunks.chunks.map((chunk) => ({
              guideId: id,
              gameId: newChunks.gameId,
              chunkIndex: chunk.chunkIndex,
              heading: chunk.heading,
              content: chunk.content,
              charCount: chunk.charCount,
              tokenCount: chunk.tokenCount,
              spoilerLevel: newChunks.spoilerLevel as SpoilerLevel,
              regionOrChapter: newChunks.regionOrChapter,
              progressionOrder: newChunks.progressionOrder,
              language: newChunks.language,
              tags: newChunks.tags,
            })),
          });
        }
      }

      return tx.gameGuide.findUniqueOrThrow({
        where: { id },
        include: {
          game: { select: { id: true, name: true, slug: true } },
          chunks: { orderBy: { chunkIndex: 'asc' } },
          _count: { select: { chunks: true } },
        },
      });
    });
  }

  async replaceChunksOnly(
    guideId: string,
    meta: {
      gameId: string;
      spoilerLevel: SpoilerLevelValue;
      regionOrChapter: string | null;
      progressionOrder: number | null;
      language: string;
      tags: string[];
    },
    chunks: DocumentChunkOutput[]
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.gameGuideChunk.deleteMany({ where: { guideId } });
      if (chunks.length > 0) {
        await tx.gameGuideChunk.createMany({
          data: chunks.map((chunk) => ({
            guideId,
            gameId: meta.gameId,
            chunkIndex: chunk.chunkIndex,
            heading: chunk.heading,
            content: chunk.content,
            charCount: chunk.charCount,
            tokenCount: chunk.tokenCount,
            spoilerLevel: meta.spoilerLevel as SpoilerLevel,
            regionOrChapter: meta.regionOrChapter,
            progressionOrder: meta.progressionOrder,
            language: meta.language,
            tags: meta.tags,
          })),
        });
      }

      return tx.gameGuide.findUniqueOrThrow({
        where: { id: guideId },
        include: {
          game: { select: { id: true, name: true, slug: true } },
          chunks: { orderBy: { chunkIndex: 'asc' } },
          _count: { select: { chunks: true } },
        },
      });
    });
  }

  async deleteGuide(id: string): Promise<void> {
    await prisma.gameGuide.delete({ where: { id } });
  }

  async listGuides(query: ListKnowledgeGuidesQuery, normalizedSpoiler?: SpoilerLevelValue) {
    const where: Prisma.GameGuideWhereInput = {
      ...(query.gameId ? { gameId: query.gameId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(normalizedSpoiler ? { spoilerLevel: normalizedSpoiler as SpoilerLevel } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { sourceName: { contains: query.search, mode: 'insensitive' } },
              { regionOrChapter: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      prisma.gameGuide.findMany({
        where,
        include: {
          game: { select: { id: true, name: true, slug: true } },
          _count: { select: { chunks: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      prisma.gameGuide.count({ where }),
    ]);

    return { rows, total };
  }

  async countActiveChunksForGame(gameId: string): Promise<number> {
    return prisma.gameGuideChunk.count({
      where: {
        gameId,
        guide: { isActive: true },
      },
    });
  }

  /**
   * Resolves known progressionOrder values for regions already mapped in this game's guides.
   */
  async listRegionProgressionMappings(gameId: string): Promise<
    Array<{ regionOrChapter: string; progressionOrder: number }>
  > {
    const guides = await prisma.gameGuide.findMany({
      where: {
        gameId,
        isActive: true,
        regionOrChapter: { not: null },
        progressionOrder: { not: null },
      },
      select: {
        regionOrChapter: true,
        progressionOrder: true,
      },
    });

    return guides
      .filter((g) => g.regionOrChapter && g.progressionOrder !== null)
      .map((g) => ({
        regionOrChapter: g.regionOrChapter!,
        progressionOrder: g.progressionOrder!,
      }));
  }

  /**
   * Executes PostgreSQL Full-Text Search (using parameterized $queryRaw + GIN index)
   * strictly scoped to a single gameId, with accent-insensitive fallback retrieval within that game.
   */
  async searchGameChunksFts(
    gameId: string,
    rawQuery: string,
    maxCandidates = 40
  ): Promise<CandidateChunkRow[]> {
    const tsQueryExpr = buildSafeSimpleTsQuery(rawQuery);

    let ftsRows: CandidateChunkRow[] = [];
    if (tsQueryExpr) {
      ftsRows = await prisma.$queryRaw<CandidateChunkRow[]>`
        SELECT
          c."id" AS "chunkId",
          c."guideId" AS "guideId",
          c."gameId" AS "gameId",
          c."chunkIndex" AS "chunkIndex",
          c."heading" AS "heading",
          c."content" AS "content",
          c."charCount" AS "charCount",
          c."tokenCount" AS "tokenCount",
          c."spoilerLevel"::text AS "chunkSpoilerLevel",
          c."regionOrChapter" AS "chunkRegionOrChapter",
          c."progressionOrder" AS "chunkProgressionOrder",
          c."language" AS "chunkLanguage",
          c."tags" AS "chunkTags",
          g."title" AS "guideTitle",
          g."contentType" AS "guideContentType",
          g."sourceName" AS "guideSourceName",
          g."sourceUrl" AS "guideSourceUrl",
          g."sourceLicense" AS "guideSourceLicense",
          g."spoilerLevel"::text AS "guideSpoilerLevel",
          COALESCE(g."regionOrChapter", g."targetChapter") AS "guideRegionOrChapter",
          g."progressionOrder" AS "guideProgressionOrder",
          g."obtainedAt" AS "guideObtainedAt",
          g."isVerified" AS "guideIsVerified",
          ts_rank_cd(
            to_tsvector('simple', COALESCE(c."heading", '') || ' ' || c."content" || ' ' || g."title"),
            to_tsquery('simple', ${tsQueryExpr})
          )::float8 AS "ftsRank"
        FROM "game_guide_chunks" c
        INNER JOIN "game_guides" g ON g."id" = c."guideId"
        WHERE c."gameId" = ${gameId}
          AND g."isActive" = true
          AND to_tsvector('simple', COALESCE(c."heading", '') || ' ' || c."content" || ' ' || g."title")
              @@ to_tsquery('simple', ${tsQueryExpr})
        ORDER BY "ftsRank" DESC, c."chunkIndex" ASC
        LIMIT ${maxCandidates}
      `;
    }

    // Merge with bounded game-scoped scan if FTS missed accent-normalized / tag matches
    const seenIds = new Set(ftsRows.map((r) => r.chunkId));
    if (ftsRows.length < maxCandidates) {
      const remainingLimit = maxCandidates - ftsRows.length;
      const fallbackRows = await prisma.gameGuideChunk.findMany({
        where: {
          gameId,
          guide: { isActive: true },
          ...(seenIds.size > 0 ? { id: { notIn: Array.from(seenIds) } } : {}),
        },
        include: {
          guide: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { chunkIndex: 'asc' }],
        take: remainingLimit,
      });

      for (const row of fallbackRows) {
        ftsRows.push({
          chunkId: row.id,
          guideId: row.guideId,
          gameId: row.gameId,
          chunkIndex: row.chunkIndex,
          heading: row.heading ?? null,
          content: row.content,
          charCount: row.charCount,
          tokenCount: row.tokenCount,
          chunkSpoilerLevel: row.spoilerLevel as SpoilerLevelValue,
          chunkRegionOrChapter: row.regionOrChapter ?? null,
          chunkProgressionOrder: row.progressionOrder ?? null,
          chunkLanguage: row.language,
          chunkTags: row.tags || [],
          guideTitle: row.guide.title,
          guideContentType: row.guide.contentType,
          guideSourceName: row.guide.sourceName,
          guideSourceUrl: row.guide.sourceUrl ?? null,
          guideSourceLicense: row.guide.sourceLicense,
          guideSpoilerLevel: row.guide.spoilerLevel as SpoilerLevelValue,
          guideRegionOrChapter: row.guide.regionOrChapter ?? row.guide.targetChapter ?? null,
          guideProgressionOrder: row.guide.progressionOrder ?? null,
          guideObtainedAt: row.guide.obtainedAt,
          guideIsVerified: row.guide.isVerified,
          ftsRank: 0,
        });
      }
    }

    return ftsRows;
  }
}
