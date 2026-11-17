import { AIToolExecutionTrace } from './ai.provider';

export type AgentModeValue = 'LIBRARY' | 'COMPANION';

export type AgentRequestStatusValue = 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type AgentActionStatusValue =
  | 'PENDING'
  | 'CONFIRMED'
  | 'EXECUTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export type SpoilerLevelValue =
  | 'STRICT_NO_SPOILERS'
  | 'CURRENT_CHAPTER'
  | 'MID_GAME_SAFE'
  | 'FULL_UNRESTRICTED';

export type MessageRoleValue = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface ChatRequestInput {
  message: string;
  mode?: AgentModeValue;
  conversationId?: string | null;
  gameId?: string | null;
  journeyId?: string | null;
  spoilerLevel?: SpoilerLevelValue | 'NONE' | 'LIGHT' | 'ALL' | null;
  title?: string | null;
  clientRequestId?: string | null;
}

export interface ListConversationsQuery {
  page: number;
  limit: number;
  mode?: AgentModeValue;
  gameId?: string;
}

export interface AgentGameSummaryDTO {
  id: string;
  igdbId: number | null;
  title: string;
  slug: string;
  coverUrl: string | null;
  genres: string[];
  platforms: string[];
}

export interface AgentJourneySummaryDTO {
  id: string;
  name: string;
  characterName: string | null;
  characterClass: string | null;
  currentLevel: number | null;
  currentArea: string | null;
  currentObjective: string | null;
  playtimeHours: number;
  isCompleted: boolean;
}

export interface AgentMessageDTO {
  id: string;
  sessionId: string;
  role: MessageRoleValue;
  content: string;
  isSpoiler: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AgentActionProposalDTO {
  id: string;
  sessionId: string;
  messageId: string | null;
  toolName: string;
  validatedArgs: Record<string, unknown>;
  summary: string;
  preview: Record<string, unknown> | null;
  status: AgentActionStatusValue;
  expiresAt: string;
  confirmedAt: string | null;
  executedAt: string | null;
  cancelledAt: string | null;
  executionResult: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface AgentConversationSummaryDTO {
  id: string;
  userId: string;
  title: string;
  mode: AgentModeValue;
  spoilerLevel: SpoilerLevelValue;
  gameId: string | null;
  journeyId: string | null;
  lastRequestStatus: AgentRequestStatusValue;
  lastErrorMessage: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  game?: AgentGameSummaryDTO | null;
  journey?: AgentJourneySummaryDTO | null;
}

export interface AgentConversationDetailDTO extends AgentConversationSummaryDTO {
  messages: AgentMessageDTO[];
  actionProposals?: AgentActionProposalDTO[];
}

export interface AgentChatResponseDTO {
  status: 'success';
  conversationId: string;
  mode: AgentModeValue;
  requestStatus: 'COMPLETED';
  spoilerLevel: SpoilerLevelValue;
  deduplicated?: boolean;
  groundedInRealData?: boolean;
  toolsUsed?: AIToolExecutionTrace[];
  pendingActions?: AgentActionProposalDTO[];
  contextUsed: {
    gameId: string | null;
    gameTitle: string | null;
    journeyId: string | null;
    journeyName: string | null;
    librarySummaryIncluded: boolean;
  };
  userMessage: AgentMessageDTO;
  reply: AgentMessageDTO;
  conversation: AgentConversationSummaryDTO;
}

export interface AgentActionDecisionResponseDTO {
  status: 'success';
  message: string;
  action: AgentActionProposalDTO;
  followUpMessage?: AgentMessageDTO | null;
}

export interface AgentConversationListResult {
  status: 'success';
  data: AgentConversationSummaryDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
