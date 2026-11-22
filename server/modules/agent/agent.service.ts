import { AgentActionStatus, MessageRole } from '@prisma/client';
import { logger } from '../../utils/logger';
import { JourneysService, journeysService } from '../journeys/journeys.service';
import { JourneyContextDTO } from '../journeys/journeys.types';
import {
  AuthorizedGameContext,
  AuthorizedLibraryGameSummary,
  buildAgentSystemPrompt,
  sanitizePromptData,
} from './agent.prompts';
import { AgentRepository } from './agent.repository';
import {
  ACTION_PROPOSAL_TTL_MINUTES,
  MAX_AGENT_MESSAGE_LENGTH,
  MAX_CONVERSATION_HISTORY_CHARS,
  MAX_CONVERSATION_HISTORY_MESSAGES,
} from './agent.schema';
import {
  AgentActionDecisionResponseDTO,
  AgentActionProposalDTO,
  AgentChatResponseDTO,
  AgentConversationDetailDTO,
  AgentConversationListResult,
  AgentModeValue,
  ChatRequestInput,
  ListConversationsQuery,
  SpoilerLevelValue,
} from './agent.types';
import {
  AIConversationMessage,
  AIProvider,
  AIProviderError,
  AIToolCallInvocation,
  AIToolExecutionTrace,
} from './ai.provider';
import { GeminiProvider } from './gemini.provider';
import {
  EvidenceStatus,
  KnowledgeReferenceDTO,
  KnowledgeRetrievalResult,
  KnowledgeTurnMeta,
} from '../knowledge/knowledge.types';
import { ToolsRegistry, defaultToolsRegistry } from './tools/tools.registry';
import { ToolExecutionContext } from './tools/tools.types';

function createHttpError(message: string, statusCode: number, code: string) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export function normalizeSpoilerLevel(
  input?: string | null,
  fallback: SpoilerLevelValue = 'CURRENT_CHAPTER'
): SpoilerLevelValue {
  if (!input) return fallback;
  switch (input) {
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

function aggregateKnowledgeMeta(
  results: KnowledgeRetrievalResult[]
): KnowledgeTurnMeta | undefined {
  if (results.length === 0) return undefined;

  const refsMap = new Map<string, KnowledgeReferenceDTO>();
  const uniqueChunkIds = new Set<string>();
  let blockedChunksCount = 0;
  let spoilerRestricted = false;

  for (const res of results) {
    if (res.spoilerRestricted) spoilerRestricted = true;
    blockedChunksCount += res.blockedChunksCount || 0;

    for (const chunk of res.chunks) {
      uniqueChunkIds.add(chunk.chunkId);
    }
    for (const ref of res.references) {
      if (!refsMap.has(ref.guideId)) {
        refsMap.set(ref.guideId, ref);
      }
    }
  }

  const chunksUsedCount = uniqueChunkIds.size;
  const references = Array.from(refsMap.values());

  let evidenceStatus: EvidenceStatus;
  if (chunksUsedCount > 0) {
    evidenceStatus = 'SUFFICIENT';
  } else if (results.some((r) => r.evidenceStatus === 'BLOCKED_BY_SPOILERS')) {
    evidenceStatus = 'BLOCKED_BY_SPOILERS';
  } else if (results.some((r) => r.evidenceStatus === 'INSUFFICIENT')) {
    evidenceStatus = 'INSUFFICIENT';
  } else {
    evidenceStatus = 'NO_DOCUMENTS';
  }

  return {
    hasSources: chunksUsedCount > 0 && references.length > 0,
    evidenceStatus,
    spoilerRestricted,
    blockedChunksCount,
    chunksUsedCount,
    references,
  };
}

function buildAutoConversationTitle(
  explicitTitle: string | null | undefined,
  mode: AgentModeValue,
  gameTitle: string | null,
  message: string
): string {
  if (explicitTitle && explicitTitle.trim().length > 0) {
    return explicitTitle.trim().slice(0, 120);
  }
  const cleanSnippet = message.replace(/\s+/g, ' ').trim().slice(0, 56);
  if (gameTitle) {
    return `${gameTitle}: ${cleanSnippet}`.slice(0, 120);
  }
  const prefix = mode === 'LIBRARY' ? 'Biblioteca' : 'Companion';
  return `${prefix}: ${cleanSnippet}`.slice(0, 120);
}

export class GameAgent {
  private provider: AIProvider;
  private readonly repository: AgentRepository;
  private readonly journeys: JourneysService;
  private toolsRegistry: ToolsRegistry;
  private readonly activeLocks = new Set<string>();

  constructor(
    provider?: AIProvider,
    repository?: AgentRepository,
    journeys?: JourneysService,
    toolsRegistry?: ToolsRegistry
  ) {
    this.provider = provider || new GeminiProvider();
    this.repository = repository || new AgentRepository();
    this.journeys = journeys || journeysService;
    this.toolsRegistry = toolsRegistry || defaultToolsRegistry;
  }

  /**
   * Allows tests to inject a deterministic AIProvider mock cleanly without touching production defaults.
   */
  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  resetProvider(): void {
    this.provider = new GeminiProvider();
  }

  setToolsRegistry(registry: ToolsRegistry): void {
    this.toolsRegistry = registry;
  }

  resetToolsRegistry(): void {
    this.toolsRegistry = defaultToolsRegistry;
  }

  getToolsRegistry(): ToolsRegistry {
    return this.toolsRegistry;
  }

  private acquireLock(userId: string, conversationId?: string | null): string[] {
    const keys = [`user:${userId}`];
    if (conversationId) {
      keys.push(`conv:${conversationId}`);
    }

    for (const key of keys) {
      if (this.activeLocks.has(key)) {
        throw createHttpError(
          'Já existe uma solicitação em andamento para esta conta/conversa. Aguarde a resposta anterior finalizar.',
          409,
          'AGENT_CONCURRENT_REQUEST'
        );
      }
    }

    for (const key of keys) {
      this.activeLocks.add(key);
    }
    return keys;
  }

  private releaseLocks(keys: string[]): void {
    for (const key of keys) {
      this.activeLocks.delete(key);
    }
  }

  private buildBoundedHistory(
    messages: Array<{ id: string; role: MessageRole; content: string }>,
    excludeMessageId?: string
  ): AIConversationMessage[] {
    const filtered = messages.filter(
      (m) =>
        m.id !== excludeMessageId &&
        (m.role === MessageRole.USER || m.role === MessageRole.ASSISTANT)
    );

    const limitedMessages = filtered.slice(-MAX_CONVERSATION_HISTORY_MESSAGES);
    const selectedReversed: AIConversationMessage[] = [];
    let totalChars = 0;

    for (let i = limitedMessages.length - 1; i >= 0; i--) {
      const m = limitedMessages[i];
      const text = m.content.trim();
      if (!text) continue;
      if (
        totalChars + text.length > MAX_CONVERSATION_HISTORY_CHARS &&
        selectedReversed.length > 0
      ) {
        break;
      }
      totalChars += text.length;
      selectedReversed.push({
        role: m.role === MessageRole.USER ? 'user' : 'model',
        content: text,
      });
    }

    return selectedReversed.reverse();
  }

  private async handleToolCall(
    call: AIToolCallInvocation,
    toolCtx: ToolExecutionContext,
    createdProposals: AgentActionProposalDTO[]
  ): Promise<{
    response: Record<string, unknown>;
    trace: AIToolExecutionTrace;
  }> {
    const started = Date.now();
    const tool = this.toolsRegistry.getTool(call.name);

    if (!tool) {
      return {
        response: {
          status: 'error',
          code: 'UNKNOWN_TOOL',
          message: `Ferramenta "${call.name}" não é reconhecida ou não está autorizada.`,
        },
        trace: {
          name: call.name || 'unknown',
          accessType: 'READ',
          status: 'REJECTED',
          durationMs: Date.now() - started,
          errorCode: 'UNKNOWN_TOOL',
        },
      };
    }

    try {
      if (tool.accessType === 'READ') {
        const result = await this.toolsRegistry.executeReadTool(call.name, call.args, toolCtx);
        const durationMs = Date.now() - started;

        logger.info('[GameAgent Tool READ]', {
          userId: toolCtx.userId,
          sessionId: toolCtx.sessionId,
          tool: call.name,
          status: 'EXECUTED',
          durationMs,
        });

        return {
          response: {
            status: 'success',
            data: result,
          },
          trace: {
            name: call.name,
            accessType: 'READ',
            status: 'EXECUTED',
            durationMs,
          },
        };
      }

      // WRITE tool -> NEVER auto-executes; validates & creates a persistent pending proposal
      const prepared = await this.toolsRegistry.prepareWriteProposal(call.name, call.args, toolCtx);
      const expiresAt = new Date(Date.now() + ACTION_PROPOSAL_TTL_MINUTES * 60 * 1000);

      const createdRecord = await this.repository.createActionProposal({
        userId: toolCtx.userId,
        sessionId: toolCtx.sessionId!,
        toolName: prepared.tool.name,
        validatedArgs: prepared.validatedArgs,
        argsHash: prepared.argsHash,
        summary: prepared.proposal.summary,
        preview: prepared.proposal.preview,
        expiresAt,
      });

      const proposalDTO = AgentRepository.toActionProposalDTO(createdRecord);
      createdProposals.push(proposalDTO);
      const durationMs = Date.now() - started;

      logger.info('[GameAgent Tool WRITE Proposal]', {
        userId: toolCtx.userId,
        sessionId: toolCtx.sessionId,
        proposalId: proposalDTO.id,
        tool: call.name,
        status: 'PENDING_CONFIRMATION',
        durationMs,
      });

      return {
        response: {
          status: 'PENDING_CONFIRMATION',
          requiresUserConfirmation: true,
          proposalId: proposalDTO.id,
          summary: proposalDTO.summary,
          preview: proposalDTO.preview,
          expiresAt: proposalDTO.expiresAt,
          message:
            'Proposta de ação criada com sucesso. Os dados NÃO foram alterados ainda. Informe o resumo da operação e solicite ao usuário que clique em Confirmar ou Cancelar.',
        },
        trace: {
          name: call.name,
          accessType: 'WRITE',
          status: 'PENDING_CONFIRMATION',
          durationMs,
        },
      };
    } catch (err: any) {
      const errorCode = err?.code || 'TOOL_EXECUTION_ERROR';
      const safeMessage =
        err?.message || 'Não foi possível executar a ferramenta solicitada.';
      const durationMs = Date.now() - started;

      logger.warn('[GameAgent Tool Error]', {
        userId: toolCtx.userId,
        sessionId: toolCtx.sessionId,
        tool: call.name,
        accessType: tool.accessType,
        errorCode,
        durationMs,
      });

      return {
        response: {
          status: 'error',
          code: errorCode,
          message: safeMessage,
        },
        trace: {
          name: call.name,
          accessType: tool.accessType,
          status: 'FAILED',
          durationMs,
          errorCode,
        },
      };
    }
  }

  async chat(userId: string, input: ChatRequestInput): Promise<AgentChatResponseDTO> {
    const lockKeys = this.acquireLock(userId, input.conversationId);

    try {
      // 1. Load authorized user & gamer preferences strictly from authenticated userId
      const user = await this.repository.findUserWithPreferences(userId);
      if (!user) {
        throw createHttpError('Usuário autenticado não encontrado.', 404, 'USER_NOT_FOUND');
      }

      const userDefaultSpoiler = normalizeSpoilerLevel(
        user.preferences?.defaultSpoilerLevel,
        'CURRENT_CHAPTER'
      );

      // 2. If continuing an existing conversation, validate ownership first
      let existingSession: Awaited<ReturnType<AgentRepository['findSessionById']>> = null;
      if (input.conversationId) {
        existingSession = await this.repository.findSessionById(input.conversationId);
        if (!existingSession) {
          throw createHttpError('Conversa não encontrada.', 404, 'CONVERSATION_NOT_FOUND');
        }
        if (existingSession.userId !== userId) {
          throw createHttpError(
            'Acesso negado. Esta conversa pertence a outro usuário.',
            403,
            'FORBIDDEN'
          );
        }

        // Check idempotency if clientRequestId already completed
        if (input.clientRequestId) {
          const existingTurn = await this.repository.findTurnByClientRequestId(
            existingSession.id,
            input.clientRequestId
          );
          if (existingTurn.userMsg && existingTurn.assistantMsg) {
            const summary = AgentRepository.toConversationSummaryDTO(existingSession);
            const assistantDto = AgentRepository.toMessageDTO(existingTurn.assistantMsg);
            const meta = assistantDto.metadata || {};
            const proposalIds = Array.isArray(meta.pendingActionIds)
              ? (meta.pendingActionIds.filter((x) => typeof x === 'string') as string[])
              : [];
            const linkedProposals =
              proposalIds.length > 0
                ? (await this.repository.findActionProposalsByIds(proposalIds)).map(
                    AgentRepository.toActionProposalDTO
                  )
                : [];

            const knowledgeMeta =
              meta.knowledge && typeof meta.knowledge === 'object'
                ? (meta.knowledge as KnowledgeTurnMeta)
                : undefined;

            return {
              status: 'success',
              conversationId: existingSession.id,
              mode: summary.mode,
              requestStatus: 'COMPLETED',
              spoilerLevel: summary.spoilerLevel,
              deduplicated: true,
              groundedInRealData: Boolean(meta.groundedInRealData),
              toolsUsed: Array.isArray(meta.toolsUsed)
                ? (meta.toolsUsed as AIToolExecutionTrace[])
                : undefined,
              pendingActions: linkedProposals.length > 0 ? linkedProposals : undefined,
              ...(knowledgeMeta ? { knowledge: knowledgeMeta } : {}),
              contextUsed: {
                gameId: summary.gameId,
                gameTitle: summary.game?.title ?? null,
                journeyId: summary.journeyId,
                journeyName: summary.journey?.name ?? null,
                librarySummaryIncluded: summary.mode === 'LIBRARY',
              },
              userMessage: AgentRepository.toMessageDTO(existingTurn.userMsg),
              reply: assistantDto,
              conversation: summary,
            };
          }
        }
      }

      // 3. Resolve effective mode, spoiler level, gameId and journeyId
      const effectiveMode: AgentModeValue =
        input.mode || (existingSession?.mode as AgentModeValue) || 'COMPANION';

      const effectiveSpoilerLevel: SpoilerLevelValue = input.spoilerLevel
        ? normalizeSpoilerLevel(input.spoilerLevel, userDefaultSpoiler)
        : existingSession
          ? normalizeSpoilerLevel(existingSession.spoilerLevel, userDefaultSpoiler)
          : userDefaultSpoiler;

      let resolvedJourneyId: string | null =
        input.journeyId !== undefined
          ? input.journeyId
          : (existingSession?.journeyId ?? null);

      let resolvedGameId: string | null =
        input.gameId !== undefined ? input.gameId : (existingSession?.gameId ?? null);

      // 4. Load & authorize journey context via journeysService.getJourneyContext (enforces ownership!)
      let journeyContext: JourneyContextDTO | null = null;
      if (resolvedJourneyId) {
        journeyContext = await this.journeys.getJourneyContext(userId, resolvedJourneyId, 10);

        if (resolvedGameId && resolvedGameId !== journeyContext.game.id) {
          throw createHttpError(
            'A jornada selecionada não pertence ao jogo informado.',
            400,
            'JOURNEY_GAME_MISMATCH'
          );
        }
        resolvedGameId = journeyContext.game.id;
      }

      // 5. Load game context if gameId is selected
      let gameContext: AuthorizedGameContext | null = null;
      if (resolvedGameId) {
        const dbGame = await this.repository.findGameById(resolvedGameId);
        if (!dbGame) {
          throw createHttpError('Jogo não encontrado no catálogo.', 404, 'GAME_NOT_FOUND');
        }

        const userGameEntry = await this.repository.findUserGameByUserAndGame(
          userId,
          resolvedGameId
        );

        gameContext = {
          id: dbGame.id,
          title: dbGame.name,
          genres: dbGame.genres || [],
          platforms: dbGame.platforms || [],
          developer: dbGame.developer ?? null,
          summary: dbGame.summary ?? null,
          userStatus: userGameEntry?.status ?? null,
          userHoursPlayed: userGameEntry?.hoursPlayed ?? null,
          userCurrentChapter: userGameEntry?.currentChapter ?? null,
        };
      }

      // 6. In LIBRARY mode, load ONLY the authenticated user's authorized library entries (if any)
      let librarySummary: AuthorizedLibraryGameSummary[] | null = null;
      if (effectiveMode === 'LIBRARY') {
        const userEntries = await this.repository.listAuthorizedUserLibrary(userId, 20);
        if (userEntries.length > 0) {
          librarySummary = userEntries.map((entry) => ({
            title: entry.game.name,
            status: entry.status,
            hoursPlayed: entry.hoursPlayed,
            rating: entry.rating ?? null,
            currentChapter: entry.currentChapter ?? null,
          }));
        }
      }

      // 7. Create or update conversation session before invoking AI provider
      const userProgressSummary = journeyContext
        ? `${journeyContext.journey.currentArea || ''}${journeyContext.journey.currentObjective ? ` — ${journeyContext.journey.currentObjective}` : ''}`.trim() ||
          null
        : gameContext?.userCurrentChapter || null;

      let session = existingSession;
      if (!session) {
        const title = buildAutoConversationTitle(
          input.title,
          effectiveMode,
          gameContext?.title ?? null,
          input.message
        );
        session = await this.repository.createSession({
          userId,
          title,
          mode: effectiveMode,
          spoilerLevel: effectiveSpoilerLevel,
          gameId: resolvedGameId,
          journeyId: resolvedJourneyId,
          userProgress: userProgressSummary,
        });
      } else {
        session = await this.repository.updateSessionContext(session.id, {
          mode: effectiveMode,
          spoilerLevel: effectiveSpoilerLevel,
          gameId: resolvedGameId,
          journeyId: resolvedJourneyId,
          userProgress: userProgressSummary,
          lastRequestStatus: 'PROCESSING',
          lastErrorMessage: null,
        });
      }

      // 8. Ensure single USER message (no duplication on retries)
      const userMessageRecord = await this.repository.ensureUserMessageForAttempt({
        sessionId: session.id,
        content: input.message,
        clientRequestId: input.clientRequestId ?? null,
        metadata: {
          mode: effectiveMode,
          spoilerLevel: effectiveSpoilerLevel,
          status: 'PROCESSING',
        },
      });

      // 9. Build bounded conversation history and secure system instruction
      const recentRecords = await this.repository.getRecentMessages(
        session.id,
        MAX_CONVERSATION_HISTORY_MESSAGES + 2
      );
      const boundedHistory = this.buildBoundedHistory(recentRecords, userMessageRecord.id);

      const availableToolNames = this.toolsRegistry.getToolNames(effectiveMode);
      const functionDeclarations = this.toolsRegistry.getFunctionDeclarations(effectiveMode);

      const systemInstruction = buildAgentSystemPrompt({
        mode: effectiveMode,
        user: {
          userId: user.id,
          username: user.username,
          language: user.preferences?.language || 'pt-BR',
          preferredPlatforms: user.preferences?.preferredPlatforms || [],
          preferredGenres: user.preferences?.preferredGenres || [],
          spoilerLevel: effectiveSpoilerLevel,
        },
        gameContext,
        journeyContext,
        librarySummary,
        availableTools: availableToolNames,
      });

      const createdProposals: AgentActionProposalDTO[] = [];
      const knowledgeResults: KnowledgeRetrievalResult[] = [];
      const toolCtx: ToolExecutionContext = {
        userId,
        mode: effectiveMode,
        sessionId: session.id,
        activeGameId: resolvedGameId,
        activeJourneyId: resolvedJourneyId,
        spoilerLevel: effectiveSpoilerLevel,
        onKnowledgeRetrieved: (res) => {
          knowledgeResults.push(res);
        },
      };

      // 10. Invoke AIProvider with Function Calling, timeout, token limits and sanitized telemetry
      const startedAt = Date.now();
      try {
        const sanitizedUserPrompt = sanitizePromptData(
          input.message,
          MAX_AGENT_MESSAGE_LENGTH
        );
        const aiResult = await this.provider.generateReply({
          systemInstruction,
          history: boundedHistory,
          userMessage: `<user_input>\n${sanitizedUserPrompt}\n</user_input>`,
          tools: functionDeclarations,
          onToolCall: (call) => this.handleToolCall(call, toolCtx, createdProposals),
          maxToolRounds: 4,
          maxToolCalls: 6,
        });

        const durationMs = Date.now() - startedAt;
        const knowledgeMeta = aggregateKnowledgeMeta(knowledgeResults);
        const executedReadTools = (aiResult.toolExecutions || []).some(
          (t) => t.accessType === 'READ' && t.status === 'EXECUTED'
        );
        const groundedInRealData = Boolean(
          executedReadTools ||
            knowledgeMeta?.hasSources ||
            journeyContext !== null ||
            gameContext !== null ||
            (librarySummary && librarySummary.length > 0)
        );

        const { assistantMessage, updatedSession } = await this.repository.completeChatTurn({
          sessionId: session.id,
          userMessageId: userMessageRecord.id,
          assistantContent: aiResult.text,
          clientRequestId: input.clientRequestId ?? null,
          isSpoiler: effectiveSpoilerLevel === 'FULL_UNRESTRICTED',
          proposalIds: createdProposals.map((p) => p.id),
          assistantMetadata: {
            status: 'COMPLETED',
            provider: this.provider.providerName,
            model: aiResult.model,
            mode: effectiveMode,
            spoilerLevel: effectiveSpoilerLevel,
            usage: aiResult.usage ?? null,
            finishReason: aiResult.finishReason ?? null,
            durationMs,
            groundedInRealData,
            toolsUsed: aiResult.toolExecutions ?? [],
            pendingActionIds: createdProposals.map((p) => p.id),
            ...(knowledgeMeta ? { knowledge: knowledgeMeta } : {}),
          },
        });

        logger.info('[GameAgent] Turno concluído com sucesso', {
          userId,
          conversationId: session.id,
          mode: effectiveMode,
          spoilerLevel: effectiveSpoilerLevel,
          model: aiResult.model,
          toolCallsCount: aiResult.toolExecutions?.length ?? 0,
          pendingActionsCount: createdProposals.length,
          knowledgeChunksUsed: knowledgeMeta?.chunksUsedCount ?? 0,
          knowledgeBlockedCount: knowledgeMeta?.blockedChunksCount ?? 0,
          promptTokens: aiResult.usage?.promptTokens,
          candidatesTokens: aiResult.usage?.candidatesTokens,
          totalTokens: aiResult.usage?.totalTokens,
          durationMs,
        });

        return {
          status: 'success',
          conversationId: session.id,
          mode: effectiveMode,
          requestStatus: 'COMPLETED',
          spoilerLevel: effectiveSpoilerLevel,
          groundedInRealData,
          ...(aiResult.toolExecutions && aiResult.toolExecutions.length > 0
            ? { toolsUsed: aiResult.toolExecutions }
            : {}),
          ...(createdProposals.length > 0 ? { pendingActions: createdProposals } : {}),
          ...(knowledgeMeta ? { knowledge: knowledgeMeta } : {}),
          contextUsed: {
            gameId: gameContext?.id ?? null,
            gameTitle: gameContext?.title ?? null,
            journeyId: journeyContext?.journey.id ?? null,
            journeyName: journeyContext?.journey.name ?? null,
            librarySummaryIncluded: Boolean(librarySummary && librarySummary.length > 0),
          },
          userMessage: AgentRepository.toMessageDTO(userMessageRecord),
          reply: AgentRepository.toMessageDTO(assistantMessage),
          conversation: AgentRepository.toConversationSummaryDTO(updatedSession),
        };
      } catch (err: any) {
        const errorCode = err instanceof AIProviderError ? err.code : 'AI_PROVIDER_ERROR';
        const errorMessage =
          err instanceof AIProviderError
            ? err.message
            : 'Falha temporária ao processar resposta do GameAgent.';

        await this.repository.failChatTurn({
          sessionId: session.id,
          userMessageId: userMessageRecord.id,
          errorCode,
          errorMessage,
        });

        logger.warn('[GameAgent] Falha ao processar turno de chat', {
          userId,
          conversationId: session.id,
          mode: effectiveMode,
          errorCode,
          durationMs: Date.now() - startedAt,
        });

        if (err instanceof AIProviderError) {
          throw err;
        }
        throw createHttpError(errorMessage, 502, errorCode);
      }
    } finally {
      this.releaseLocks(lockKeys);
    }
  }

  // ---------------------------------------------------------------------------
  // EXPLICIT USER CONFIRMATION / CANCELLATION OF WRITE ACTION PROPOSALS
  // ---------------------------------------------------------------------------

  async confirmActionProposal(
    userId: string,
    actionId: string
  ): Promise<AgentActionDecisionResponseDTO> {
    const proposal = await this.repository.findActionProposalById(actionId);
    if (!proposal) {
      throw createHttpError('Proposta de ação não encontrada.', 404, 'ACTION_PROPOSAL_NOT_FOUND');
    }

    if (proposal.userId !== userId) {
      throw createHttpError(
        'Acesso negado. Esta proposta de ação pertence a outro usuário.',
        403,
        'FORBIDDEN'
      );
    }

    if (proposal.status === AgentActionStatus.EXECUTED) {
      throw createHttpError(
        'Esta ação já foi confirmada e executada anteriormente.',
        409,
        'ACTION_ALREADY_EXECUTED'
      );
    }

    if (proposal.status === AgentActionStatus.CANCELLED) {
      throw createHttpError(
        'Esta proposta de ação foi cancelada e não pode ser executada.',
        409,
        'ACTION_ALREADY_CANCELLED'
      );
    }

    const now = new Date();
    if (
      proposal.status === AgentActionStatus.EXPIRED ||
      new Date(proposal.expiresAt).getTime() <= now.getTime()
    ) {
      await this.repository.markProposalExpired(proposal.id);
      throw createHttpError(
        'Esta proposta de ação expirou. Solicite novamente ao GameAgent para gerar uma nova confirmação.',
        410,
        'ACTION_EXPIRED'
      );
    }

    if (proposal.status !== AgentActionStatus.PENDING) {
      throw createHttpError(
        `Esta proposta não está mais pendente (estado atual: ${proposal.status}).`,
        409,
        'ACTION_INVALID_STATE'
      );
    }

    // DB-level atomic claim: only ONE concurrent request can transition PENDING -> CONFIRMED
    const claimed = await this.repository.atomicallyClaimPendingProposal(proposal.id, userId, now);
    if (!claimed) {
      throw createHttpError(
        'Esta proposta de ação já foi processada ou expirou.',
        409,
        'ACTION_ALREADY_PROCESSED'
      );
    }

    try {
      const validatedArgs =
        proposal.validatedArgs &&
        typeof proposal.validatedArgs === 'object' &&
        !Array.isArray(proposal.validatedArgs)
          ? (proposal.validatedArgs as Record<string, unknown>)
          : {};

      const executionResult = await this.toolsRegistry.executeConfirmedWriteTool(
        proposal.toolName,
        validatedArgs,
        proposal.argsHash,
        {
          userId,
          mode: 'COMPANION',
          sessionId: proposal.sessionId,
        }
      );

      const executedRecord = await this.repository.markProposalExecuted(
        proposal.id,
        executionResult
      );

      const followUpRecord = await this.repository.appendActionFollowUpMessage(
        proposal.sessionId,
        `Ação confirmada e concluída: ${proposal.summary}`,
        {
          status: 'COMPLETED',
          groundedInRealData: true,
          actionProposalId: proposal.id,
          actionStatus: 'EXECUTED',
          toolName: proposal.toolName,
          executionResult,
        }
      );

      logger.info('[GameAgent Action Executed]', {
        userId,
        proposalId: proposal.id,
        sessionId: proposal.sessionId,
        toolName: proposal.toolName,
      });

      return {
        status: 'success',
        message: 'Ação confirmada e executada com sucesso.',
        action: AgentRepository.toActionProposalDTO(executedRecord),
        followUpMessage: AgentRepository.toMessageDTO(followUpRecord),
      };
    } catch (err: any) {
      const errMessage = err?.message || 'Erro ao executar a ação confirmada.';
      await this.repository.markProposalFailed(proposal.id, errMessage);

      logger.warn('[GameAgent Action Execution Failed]', {
        userId,
        proposalId: proposal.id,
        toolName: proposal.toolName,
        errorCode: err?.code,
      });

      throw err;
    }
  }

  async cancelActionProposal(
    userId: string,
    actionId: string
  ): Promise<AgentActionDecisionResponseDTO> {
    const proposal = await this.repository.findActionProposalById(actionId);
    if (!proposal) {
      throw createHttpError('Proposta de ação não encontrada.', 404, 'ACTION_PROPOSAL_NOT_FOUND');
    }

    if (proposal.userId !== userId) {
      throw createHttpError(
        'Acesso negado. Esta proposta de ação pertence a outro usuário.',
        403,
        'FORBIDDEN'
      );
    }

    if (proposal.status === AgentActionStatus.EXECUTED) {
      throw createHttpError(
        'Esta ação já foi executada e não pode ser cancelada.',
        409,
        'ACTION_ALREADY_EXECUTED'
      );
    }

    if (proposal.status === AgentActionStatus.CANCELLED) {
      throw createHttpError(
        'Esta proposta de ação já foi cancelada.',
        409,
        'ACTION_ALREADY_CANCELLED'
      );
    }

    const now = new Date();
    if (
      proposal.status === AgentActionStatus.EXPIRED ||
      new Date(proposal.expiresAt).getTime() <= now.getTime()
    ) {
      await this.repository.markProposalExpired(proposal.id);
      throw createHttpError(
        'Esta proposta de ação já expirou.',
        410,
        'ACTION_EXPIRED'
      );
    }

    const cancelled = await this.repository.atomicallyCancelPendingProposal(
      proposal.id,
      userId,
      now
    );
    if (!cancelled) {
      throw createHttpError(
        'Não foi possível cancelar a proposta de ação no estado atual.',
        409,
        'ACTION_ALREADY_PROCESSED'
      );
    }

    const updated = await this.repository.findActionProposalById(proposal.id);
    const followUpRecord = await this.repository.appendActionFollowUpMessage(
      proposal.sessionId,
      `Ação cancelada pelo usuário: ${proposal.summary} Nenhuma alteração foi feita.`,
      {
        status: 'COMPLETED',
        actionProposalId: proposal.id,
        actionStatus: 'CANCELLED',
        toolName: proposal.toolName,
      }
    );

    logger.info('[GameAgent Action Cancelled]', {
      userId,
      proposalId: proposal.id,
      sessionId: proposal.sessionId,
      toolName: proposal.toolName,
    });

    return {
      status: 'success',
      message: 'Proposta de ação cancelada. Nenhuma alteração foi realizada.',
      action: AgentRepository.toActionProposalDTO(updated),
      followUpMessage: AgentRepository.toMessageDTO(followUpRecord),
    };
  }

  async listConversations(
    userId: string,
    query: ListConversationsQuery
  ): Promise<AgentConversationListResult> {
    const { items, total } = await this.repository.listSessionsByUser(userId, query);
    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      status: 'success',
      data: items,
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

  async getConversationById(
    userId: string,
    conversationId: string
  ): Promise<AgentConversationDetailDTO> {
    const detail = await this.repository.findSessionDetail(conversationId);
    if (!detail) {
      throw createHttpError('Conversa não encontrada.', 404, 'CONVERSATION_NOT_FOUND');
    }
    if (detail.userId !== userId) {
      throw createHttpError(
        'Acesso negado. Esta conversa pertence a outro usuário.',
        403,
        'FORBIDDEN'
      );
    }
    return detail;
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const session = await this.repository.findSessionById(conversationId);
    if (!session) {
      throw createHttpError('Conversa não encontrada.', 404, 'CONVERSATION_NOT_FOUND');
    }
    if (session.userId !== userId) {
      throw createHttpError(
        'Acesso negado. Esta conversa pertence a outro usuário.',
        403,
        'FORBIDDEN'
      );
    }
    await this.repository.deleteSession(conversationId);
  }
}

export const gameAgent = new GameAgent();
