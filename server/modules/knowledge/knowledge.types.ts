import { SpoilerLevelValue } from '../agent/agent.types';

export type KnowledgeContentType =
  | 'GUIDE'
  | 'WALKTHROUGH'
  | 'BOSS_STRATEGY'
  | 'BUILD_GUIDE'
  | 'MECHANICS'
  | 'LORE'
  | 'TROPHY_HUNT';

export type EvidenceStatus =
  | 'SUFFICIENT'
  | 'INSUFFICIENT'
  | 'BLOCKED_BY_SPOILERS'
  | 'NO_DOCUMENTS';

export interface KnowledgeGuideDTO {
  id: string;
  gameId: string;
  gameTitle?: string;
  authorId: string | null;
  title: string;
  slug: string;
  category: string;
  contentType: KnowledgeContentType | string;
  content: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceLicense: string;
  language: string;
  spoilerLevel: SpoilerLevelValue;
  regionOrChapter: string | null;
  progressionOrder: number | null;
  obtainedAt: string;
  isVerified: boolean;
  isActive: boolean;
  tags: string[];
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkSummaryDTO {
  id: string;
  guideId: string;
  chunkIndex: number;
  heading: string | null;
  content: string;
  charCount: number;
  tokenCount: number;
  spoilerLevel: SpoilerLevelValue;
  regionOrChapter: string | null;
  progressionOrder: number | null;
  language: string;
  tags: string[];
}

export interface KnowledgeReferenceDTO {
  guideId: string;
  title: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceLicense: string;
  obtainedAt: string;
  isVerified: boolean;
  spoilerLevel: SpoilerLevelValue;
  regionOrChapter: string | null;
  contentType: string;
}

export interface RetrievedKnowledgeChunkDTO {
  chunkId: string;
  guideId: string;
  chunkIndex: number;
  heading: string | null;
  content: string;
  spoilerLevel: SpoilerLevelValue;
  regionOrChapter: string | null;
  progressionOrder: number | null;
  score: number;
  sourceTitle: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceLicense: string;
  isVerified: boolean;
}

export interface KnowledgeRetrievalResult {
  sufficientEvidence: boolean;
  evidenceStatus: EvidenceStatus;
  spoilerPolicyApplied: SpoilerLevelValue;
  spoilerRestricted: boolean;
  blockedChunksCount: number;
  matchedBeforeFilter: number;
  totalContextChars: number;
  game: {
    id: string;
    title: string;
    slug: string;
  };
  journeyContextApplied: boolean;
  playerCurrentRegion: string | null;
  chunks: RetrievedKnowledgeChunkDTO[];
  references: KnowledgeReferenceDTO[];
  message: string;
}

export interface KnowledgeTurnMeta {
  hasSources: boolean;
  evidenceStatus: EvidenceStatus;
  spoilerRestricted: boolean;
  blockedChunksCount: number;
  chunksUsedCount: number;
  references: KnowledgeReferenceDTO[];
}
