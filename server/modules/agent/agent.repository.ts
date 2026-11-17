import {
  AgentActionStatus,
  AgentMode,
  AgentRequestStatus,
  MessageRole,
  Prisma,
  SpoilerLevel,
} from '@prisma/client';
import { prisma } from '../../db/prisma';
import {
  AgentActionProposalDTO,
  AgentActionStatusValue,
  AgentConversationDetailDTO,
  AgentConversationSummaryDTO,
  AgentMessageDTO,
  AgentModeValue,
  AgentRequestStatusValue,
  ListConversationsQuery,
  SpoilerLevelValue,
} from './agent.types';

export class AgentRepository {
  static toMessageDTO(record: any): AgentMessageDTO {
    return {
      id: record.id,
      sessionId: record.sessionId,
      role: record.role,
      content: record.content,
      isSpoiler: Boolean(record.isSpoiler),
      metadata:
        record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
          ? (record.metadata as Record<string, unknown>)
          : null,
      createdAt: new Date(record.createdAt).toISOString(),
    };
  }

  static toActionProposalDTO(record: any): AgentActionProposalDTO {
    const now = Date.now();
    const expiresMs = new Date(record.expiresAt).getTime();
    const effectiveStatus: AgentActionStatusValue =
      record.status === AgentActionStatus.PENDING && expiresMs <= now
        ? 'EXPIRED'
        : (record.status as AgentActionStatusValue);

    return {
      id: record.id,
      sessionId: record.sessionId,
      messageId: record.messageId ?? null,
      toolName: record.toolName,
      validatedArgs:
        record.validatedArgs && typeof record.validatedArgs === 'object' && !Array.isArray(record.validatedArgs)
          ? (record.validatedArgs as Record<string, unknown>)
          : {},
      summary: record.summary,
      preview:
        record.preview && typeof record.preview === 'object' && !Array.isArray(record.preview)
          ? (record.preview as Record<string, unknown>)
          : null,
      status: effectiveStatus,
      expiresAt: new Date(record.expiresAt).toISOString(),
      confirmedAt: record.confirmedAt ? new Date(record.confirmedAt).toISOString() : null,
      executedAt: record.executedAt ? new Date(record.executedAt).toISOString() : null,
      cancelledAt: record.cancelledAt ? new Date(record.cancelledAt).toISOString() : null,
      executionResult:
        record.executionResult &&
        typeof record.executionResult === 'object' &&
        !Array.isArray(record.executionResult)
          ? (record.executionResult as Record<string, unknown>)
          : null,
      errorMessage: record.errorMessage ?? null,
      createdAt: new Date(record.createdAt).toISOString(),
    };
  }

  static toConversationSummaryDTO(record: any): AgentConversationSummaryDTO {
    return {
      id: record.id,
      userId: record.userId,
      title: record.title,
      mode: record.mode as AgentModeValue,
      spoilerLevel: record.spoilerLevel as SpoilerLevelValue,
      gameId: record.gameId ?? null,
      journeyId: record.journeyId ?? null,
      lastRequestStatus: record.lastRequestStatus as AgentRequestStatusValue,
      lastErrorMessage: record.lastErrorMessage ?? null,
      messageCount:
        record._count?.messages ?? (Array.isArray(record.messages) ? record.messages.length : 0),
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
      ...(record.game
        ? {
            game: {
              id: record.game.id,
              igdbId: record.game.igdbId ?? null,
              title: record.game.name,
              slug: record.game.slug,
              coverUrl: record.game.coverUrl ?? null,
              genres: record.game.genres || [],
              platforms: record.game.platforms || [],
            },
          }
        : { game: null }),
      ...(record.journey
        ? {
            journey: {
              id: record.journey.id,
              name: record.journey.title,
              characterName: record.journey.characterName ?? null,
              characterClass: record.journey.playstyle ?? null,
              currentLevel: record.journey.currentLevel ?? null,
              currentArea: record.journey.currentChapter ?? null,
              currentObjective: record.journey.currentObjective ?? null,
              playtimeHours: record.journey.playtimeHours ?? 0,
              isCompleted: Boolean(record.journey.isCompleted),
            },
          }
        : { journey: null }),
    };
  }

  async findUserWithPreferences(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });
  }

  async findGameById(gameId: string) {
    return prisma.game.findUnique({
      where: { id: gameId },
    });
  }

  async findUserGameByUserAndGame(userId: string, gameId: string) {
    return prisma.userGame.findUnique({
      where: {
        userId_gameId: { userId, gameId },
      },
    });
  }

  async listAuthorizedUserLibrary(userId: string, limit = 20) {
    return prisma.userGame.findMany({
      where: { userId },
      include: { game: true },
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    });
  }

  async findSessionById(id: string) {
    return prisma.companionSession.findUnique({
      where: { id },
      include: {
        game: true,
        journey: true,
        _count: { select: { messages: true } },
      },
    });
  }

  async createSession(data: {
    userId: string;
    title: string;
    mode: AgentModeValue;
    spoilerLevel: SpoilerLevelValue;
    gameId?: string | null;
    journeyId?: string | null;
    userProgress?: string | null;
  }) {
    return prisma.companionSession.create({
      data: {
        userId: data.userId,
        title: data.title,
        mode: data.mode as AgentMode,
        spoilerLevel: data.spoilerLevel as SpoilerLevel,
        gameId: data.gameId ?? null,
        journeyId: data.journeyId ?? null,
        userProgress: data.userProgress ?? null,
        lastRequestStatus: AgentRequestStatus.PROCESSING,
      },
      include: {
        game: true,
        journey: true,
        _count: { select: { messages: true } },
      },
    });
  }

  async updateSessionContext(
    sessionId: string,
    data: {
      mode?: AgentModeValue;
      spoilerLevel?: SpoilerLevelValue;
      gameId?: string | null;
      journeyId?: string | null;
      userProgress?: string | null;
      lastRequestStatus?: AgentRequestStatusValue;
      lastErrorMessage?: string | null;
    }
  ) {
    return prisma.companionSession.update({
      where: { id: sessionId },
      data: {
        ...(data.mode !== undefined ? { mode: data.mode as AgentMode } : {}),
        ...(data.spoilerLevel !== undefined
          ? { spoilerLevel: data.spoilerLevel as SpoilerLevel }
          : {}),
        ...(data.gameId !== undefined ? { gameId: data.gameId } : {}),
        ...(data.journeyId !== undefined ? { journeyId: data.journeyId } : {}),
        ...(data.userProgress !== undefined ? { userProgress: data.userProgress } : {}),
        ...(data.lastRequestStatus !== undefined
          ? { lastRequestStatus: data.lastRequestStatus as AgentRequestStatus }
          : {}),
        ...(data.lastErrorMessage !== undefined
          ? { lastErrorMessage: data.lastErrorMessage }
          : {}),
      },
      include: {
        game: true,
        journey: true,
        _count: { select: { messages: true } },
      },
    });
  }

  async getRecentMessages(sessionId: string, limit = 16) {
    const recentDesc = await prisma.companionMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return recentDesc.reverse();
  }

  async findLatestMessage(sessionId: string) {
    return prisma.companionMessage.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTurnByClientRequestId(sessionId: string, clientRequestId: string) {
    const messages = await prisma.companionMessage.findMany({
      where: { sessionId, clientRequestId },
      orderBy: { createdAt: 'asc' },
    });

    const userMsg = messages.find((m) => m.role === MessageRole.USER) || null;
    const assistantMsg = messages.find((m) => m.role === MessageRole.ASSISTANT) || null;

    return { userMsg, assistantMsg };
  }

  /**
   * Ensures a USER message exists for the current attempt without duplicating on retries
   * or concurrent requests (backed by DB partial unique index on (sessionId, role, clientRequestId)).
   */
  async ensureUserMessageForAttempt(params: {
    sessionId: string;
    content: string;
    clientRequestId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    if (params.clientRequestId) {
      const existing = await prisma.companionMessage.findFirst({
        where: {
          sessionId: params.sessionId,
          clientRequestId: params.clientRequestId,
          role: MessageRole.USER,
        },
      });
      if (existing) {
        return existing;
      }
    }

    const session = await prisma.companionSession.findUnique({
      where: { id: params.sessionId },
      select: { lastRequestStatus: true },
    });

    if (session?.lastRequestStatus === AgentRequestStatus.FAILED) {
      const latest = await this.findLatestMessage(params.sessionId);
      if (
        latest &&
        latest.role === MessageRole.USER &&
        latest.content.trim() === params.content.trim()
      ) {
        return latest;
      }
    }

    try {
      return await prisma.companionMessage.create({
        data: {
          sessionId: params.sessionId,
          role: MessageRole.USER,
          content: params.content,
          clientRequestId: params.clientRequestId ?? null,
          metadata: (params.metadata || { status: 'PROCESSING' }) as Prisma.InputJsonValue,
        },
      });
    } catch (err: any) {
      // Handle DB partial unique index race condition cleanly
      if (err?.code === 'P2002' && params.clientRequestId) {
        const existing = await prisma.companionMessage.findFirst({
          where: {
            sessionId: params.sessionId,
            clientRequestId: params.clientRequestId,
            role: MessageRole.USER,
          },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  async completeChatTurn(params: {
    sessionId: string;
    userMessageId: string;
    assistantContent: string;
    clientRequestId?: string | null;
    assistantMetadata?: Record<string, unknown>;
    isSpoiler?: boolean;
    proposalIds?: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.companionMessage.update({
        where: { id: params.userMessageId },
        data: {
          metadata: { status: 'COMPLETED' } as Prisma.InputJsonValue,
        },
      });

      let assistantMessage: any;
      try {
        assistantMessage = await tx.companionMessage.create({
          data: {
            sessionId: params.sessionId,
            role: MessageRole.ASSISTANT,
            content: params.assistantContent,
            clientRequestId: params.clientRequestId ?? null,
            isSpoiler: Boolean(params.isSpoiler),
            metadata: (params.assistantMetadata || { status: 'COMPLETED' }) as Prisma.InputJsonValue,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && params.clientRequestId) {
          const existing = await tx.companionMessage.findFirst({
            where: {
              sessionId: params.sessionId,
              clientRequestId: params.clientRequestId,
              role: MessageRole.ASSISTANT,
            },
          });
          if (existing) {
            assistantMessage = existing;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      if (params.proposalIds && params.proposalIds.length > 0) {
        await tx.agentActionProposal.updateMany({
          where: {
            id: { in: params.proposalIds },
            sessionId: params.sessionId,
          },
          data: {
            messageId: assistantMessage.id,
          },
        });
      }

      const updatedSession = await tx.companionSession.update({
        where: { id: params.sessionId },
        data: {
          lastRequestStatus: AgentRequestStatus.COMPLETED,
          lastErrorMessage: null,
        },
        include: {
          game: true,
          journey: true,
          _count: { select: { messages: true } },
        },
      });

      return { assistantMessage, updatedSession };
    });
  }

  async failChatTurn(params: {
    sessionId: string;
    userMessageId?: string;
    errorCode: string;
    errorMessage: string;
  }) {
    return prisma.$transaction(async (tx) => {
      if (params.userMessageId) {
        await tx.companionMessage.update({
          where: { id: params.userMessageId },
          data: {
            metadata: {
              status: 'FAILED',
              errorCode: params.errorCode,
              errorMessage: params.errorMessage,
            } as Prisma.InputJsonValue,
          },
        });
      }

      await tx.companionSession.update({
        where: { id: params.sessionId },
        data: {
          lastRequestStatus: AgentRequestStatus.FAILED,
          lastErrorMessage: params.errorMessage,
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // WRITE ACTION PROPOSALS (PostgreSQL-backed confirmation & idempotency)
  // ---------------------------------------------------------------------------

  async createActionProposal(data: {
    userId: string;
    sessionId: string;
    toolName: string;
    validatedArgs: Record<string, unknown>;
    argsHash: string;
    summary: string;
    preview: Record<string, unknown>;
    expiresAt: Date;
  }) {
    return prisma.agentActionProposal.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        toolName: data.toolName,
        validatedArgs: data.validatedArgs as Prisma.InputJsonValue,
        argsHash: data.argsHash,
        summary: data.summary,
        preview: data.preview as Prisma.InputJsonValue,
        status: AgentActionStatus.PENDING,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findActionProposalById(id: string) {
    return prisma.agentActionProposal.findUnique({
      where: { id },
    });
  }

  async findActionProposalsByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.agentActionProposal.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Atomically transitions a PENDING non-expired proposal to CONFIRMED in PostgreSQL.
   * Returns `true` ONLY to the winning concurrent request (prevents duplicate execution).
   */
  async atomicallyClaimPendingProposal(id: string, userId: string, now: Date): Promise<boolean> {
    const result = await prisma.agentActionProposal.updateMany({
      where: {
        id,
        userId,
        status: AgentActionStatus.PENDING,
        expiresAt: { gt: now },
      },
      data: {
        status: AgentActionStatus.CONFIRMED,
        confirmedAt: now,
      },
    });
    return result.count === 1;
  }

  async atomicallyCancelPendingProposal(id: string, userId: string, now: Date): Promise<boolean> {
    const result = await prisma.agentActionProposal.updateMany({
      where: {
        id,
        userId,
        status: AgentActionStatus.PENDING,
        expiresAt: { gt: now },
      },
      data: {
        status: AgentActionStatus.CANCELLED,
        cancelledAt: now,
      },
    });
    return result.count === 1;
  }

  async markProposalExpired(id: string) {
    return prisma.agentActionProposal.updateMany({
      where: { id, status: AgentActionStatus.PENDING },
      data: { status: AgentActionStatus.EXPIRED },
    });
  }

  async markProposalExecuted(id: string, executionResult: Record<string, unknown>) {
    return prisma.agentActionProposal.update({
      where: { id },
      data: {
        status: AgentActionStatus.EXECUTED,
        executedAt: new Date(),
        executionResult: executionResult as Prisma.InputJsonValue,
        errorMessage: null,
      },
    });
  }

  async markProposalFailed(id: string, errorMessage: string) {
    return prisma.agentActionProposal.update({
      where: { id },
      data: {
        status: AgentActionStatus.FAILED,
        errorMessage: errorMessage.slice(0, 500),
      },
    });
  }

  async appendActionFollowUpMessage(
    sessionId: string,
    content: string,
    metadata: Record<string, unknown>
  ) {
    return prisma.companionMessage.create({
      data: {
        sessionId,
        role: MessageRole.ASSISTANT,
        content,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async listSessionsByUser(
    userId: string,
    query: ListConversationsQuery
  ): Promise<{ items: AgentConversationSummaryDTO[]; total: number }> {
    const where: Prisma.CompanionSessionWhereInput = {
      userId,
      ...(query.mode ? { mode: query.mode as AgentMode } : {}),
      ...(query.gameId ? { gameId: query.gameId } : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      prisma.companionSession.findMany({
        where,
        include: {
          game: true,
          journey: true,
          _count: { select: { messages: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      prisma.companionSession.count({ where }),
    ]);

    return {
      items: rows.map(AgentRepository.toConversationSummaryDTO),
      total,
    };
  }

  async findSessionDetail(
    id: string
  ): Promise<(AgentConversationDetailDTO & { userId: string }) | null> {
    const session = await prisma.companionSession.findUnique({
      where: { id },
      include: {
        game: true,
        journey: true,
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 150,
        },
        actionProposals: {
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
    });

    if (!session) return null;

    return {
      ...AgentRepository.toConversationSummaryDTO(session),
      messages: session.messages.map(AgentRepository.toMessageDTO),
      actionProposals: session.actionProposals.map(AgentRepository.toActionProposalDTO),
    };
  }

  async deleteSession(id: string): Promise<void> {
    await prisma.companionSession.delete({
      where: { id },
    });
  }
}
