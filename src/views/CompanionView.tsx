import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Send,
  History,
  Gamepad2,
  Compass,
  AlertTriangle,
  Flame,
  Check,
  Plus,
  Trash2,
  BookOpen,
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCw,
  PanelLeftOpen,
  X,
  Wrench,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileCheck2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { ApiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  AgentActionProposal,
  AgentActionStatus,
  AgentConversationSummary,
  AgentMessage,
  AgentMode,
  AgentToolExecutionTrace,
  GameplayJourney,
  KnowledgeTurnMeta,
  LibraryEntry,
  SpoilerLevel,
} from '../types';

const MAX_MESSAGE_CHARS = 2000;

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDefaultSpoiler(raw?: string | null): SpoilerLevel {
  switch (raw) {
    case 'STRICT_NO_SPOILERS':
    case 'NONE':
      return 'STRICT_NO_SPOILERS';
    case 'MID_GAME_SAFE':
      return 'MID_GAME_SAFE';
    case 'FULL_UNRESTRICTED':
    case 'ALL':
      return 'FULL_UNRESTRICTED';
    case 'CURRENT_CHAPTER':
    case 'LIGHT':
    default:
      return 'CURRENT_CHAPTER';
  }
}

function getToolDisplayName(toolName: string): string {
  switch (toolName) {
    case 'searchGames':
      return 'Catálogo IGDB';
    case 'searchGameKnowledge':
      return 'Base de Conhecimento (RAG)';
    case 'getUserLibrary':
      return 'Biblioteca Pessoal';
    case 'getUserPreferences':
      return 'Preferências Gamer';
    case 'getJourneyContext':
      return 'Contexto da Jornada';
    case 'getGameBuilds':
      return 'Builds do Personagem';
    case 'addGameToLibrary':
      return 'Adicionar à Biblioteca';
    case 'updateGameProgress':
      return 'Registrar Progresso';
    default:
      return toolName;
  }
}

function isSafeHttpUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getActionStatusMeta(status: AgentActionStatus): {
  label: string;
  classes: string;
} {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Aguardando confirmação',
        classes: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
      };
    case 'CONFIRMED':
      return {
        label: 'Processando',
        classes: 'bg-sky-950/70 text-sky-300 border-sky-500/40',
      };
    case 'EXECUTED':
      return {
        label: 'Executada',
        classes: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelada',
        classes: 'bg-slate-900 text-slate-400 border-slate-700',
      };
    case 'EXPIRED':
      return {
        label: 'Expirada',
        classes: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
      };
    case 'FAILED':
    default:
      return {
        label: 'Falhou',
        classes: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
      };
  }
}

function formatExpirationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function CompanionView() {
  const { user } = useAuth();

  // Mode, Context & Spoiler Configuration
  const [mode, setMode] = useState<AgentMode>('COMPANION');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [spoilerLevel, setSpoilerLevel] = useState<SpoilerLevel>(() =>
    normalizeDefaultSpoiler(user?.preferences?.defaultSpoilerLevel)
  );

  // Library & Journeys Options
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [journeys, setJourneys] = useState<GameplayJourney[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(true);
  const [isLoadingJourneys, setIsLoadingJourneys] = useState<boolean>(false);

  // Conversations & Messages State
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState<boolean>(false);

  // Chat Input & Request Lifecycle
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingRetryPayload, setPendingRetryPayload] = useState<{
    message: string;
    clientRequestId: string;
  } | null>(null);

  // Mobile History Drawer & Delete Confirmation Modal
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentConversationSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Function Calling Write Action Proposals State
  const [actionProposals, setActionProposals] = useState<AgentActionProposal[]>([]);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const spoilerOptions: { id: SpoilerLevel; label: string; desc: string; icon: any }[] = [
    {
      id: 'STRICT_NO_SPOILERS',
      label: 'Zero Spoilers',
      desc: 'Apenas mecânicas, controles e dicas iniciais.',
      icon: ShieldCheck,
    },
    {
      id: 'CURRENT_CHAPTER',
      label: 'Capítulo Atual',
      desc: 'Respeita o progresso da sua jornada atual.',
      icon: ShieldAlert,
    },
    {
      id: 'MID_GAME_SAFE',
      label: 'Até Mid-Game',
      desc: 'Permite builds intermediárias sem endgame.',
      icon: Flame,
    },
    {
      id: 'FULL_UNRESTRICTED',
      label: 'Sem Restrições',
      desc: 'Acesso completo a lore, chefes e finais.',
      icon: AlertTriangle,
    },
  ];

  // Auto-scroll to latest message or action proposal
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, actionProposals, isSending]);

  // Load initial library games & conversation history
  const loadInitialData = useCallback(async () => {
    setIsLoadingOptions(true);
    setIsLoadingConversations(true);
    try {
      const [libRes, convRes] = await Promise.all([
        ApiService.getLibrary({ limit: 50, sort: 'recentlyUpdated' }),
        ApiService.getAgentConversations({ limit: 30 }),
      ]);
      setLibraryEntries((libRes.data || []).filter((e) => Boolean(e && e.id)));
      setConversations((convRes.data || []).filter((c) => Boolean(c && c.id)));
    } catch (err: any) {
      setChatError(err.message || 'Erro ao carregar dados iniciais do GameAgent.');
    } finally {
      setIsLoadingOptions(false);
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load journeys when selectedGameId changes
  useEffect(() => {
    const entry = libraryEntries.find((item) => item.gameId === selectedGameId);
    if (!entry) {
      setJourneys([]);
      setSelectedJourneyId('');
      return;
    }

    let cancelled = false;
    setIsLoadingJourneys(true);

    ApiService.getJourneys({ userGameId: entry.id, limit: 30 })
      .then((res) => {
        if (cancelled) return;
        const validJourneys = (res.data || []).filter((j) => Boolean(j && j.id));
        setJourneys(validJourneys);
        setSelectedJourneyId((current) => {
          if (current && validJourneys.some((j) => j.id === current)) {
            return current;
          }
          const active = validJourneys.find((j) => j.isActive);
          return active ? active.id : '';
        });
      })
      .catch(() => {
        if (!cancelled) setJourneys([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingJourneys(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGameId, libraryEntries]);

  const handleSelectConversation = async (conv: AgentConversationSummary) => {
    setIsMobileHistoryOpen(false);
    setChatError(null);
    setActionFeedback(null);
    setPendingRetryPayload(null);
    setIsLoadingThread(true);
    setActiveConversationId(conv.id);

    try {
      const detail = await ApiService.getAgentConversation(conv.id);
      setMessages(detail.messages);
      setActionProposals(detail.actionProposals || []);
      setMode(detail.mode);
      setSpoilerLevel(detail.spoilerLevel);
      setSelectedGameId(detail.gameId || '');
      setSelectedJourneyId(detail.journeyId || '');
    } catch (err: any) {
      setChatError(err.message || 'Não foi possível abrir o histórico desta conversa.');
    } finally {
      setIsLoadingThread(false);
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setActionProposals([]);
    setActionFeedback(null);
    setChatError(null);
    setPendingRetryPayload(null);
    setIsMobileHistoryOpen(false);
  };

  const handleConfirmDelete = async () => {
    const targetId = deleteTarget?.id;
    if (!targetId) return;
    setIsDeleting(true);
    try {
      await ApiService.deleteAgentConversation(targetId);
      setConversations((prev) => prev.filter((c) => Boolean(c && c.id && c.id !== targetId)));
      if (activeConversationId === targetId) {
        handleNewConversation();
      }
      setDeleteTarget(null);
    } catch (err: any) {
      setChatError(err.message || 'Não foi possível excluir a conversa.');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const executeSend = async (textToSend: string, clientRequestId: string, isRetry = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    setChatError(null);
    setActionFeedback(null);
    setPendingRetryPayload(null);
    setIsSending(true);

    const tempUserId = `temp-user-${clientRequestId}`;
    if (!isRetry) {
      const optimisticUserMsg: AgentMessage = {
        id: tempUserId,
        sessionId: activeConversationId || 'pending',
        role: 'USER',
        content: trimmed,
        isSpoiler: false,
        metadata: { status: 'PROCESSING' },
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);
      setInputMessage('');
    }

    try {
      const response = await ApiService.sendAgentMessage({
        message: trimmed,
        mode,
        conversationId: activeConversationId,
        gameId: selectedGameId || null,
        journeyId: mode === 'COMPANION' && selectedJourneyId ? selectedJourneyId : null,
        spoilerLevel,
        clientRequestId,
      });

      if (response?.conversationId) {
        setActiveConversationId(response.conversationId);
      }

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => Boolean(m && m.id && m.id !== tempUserId));
        const next = [...withoutTemp];
        if (response?.userMessage?.id && !withoutTemp.some((m) => m.id === response.userMessage.id)) {
          next.push(response.userMessage);
        }
        if (response?.reply?.id && !withoutTemp.some((m) => m.id === response.reply.id)) {
          next.push(response.reply);
        }
        return next;
      });

      if (Array.isArray(response?.pendingActions) && response.pendingActions.length > 0) {
        setActionProposals((prev) => {
          const map = new Map<string, AgentActionProposal>();
          prev.forEach((p) => {
            if (p && p.id) map.set(p.id, p);
          });
          response.pendingActions!.forEach((p) => {
            if (p && p.id) map.set(p.id, p);
          });
          return Array.from(map.values());
        });
      }

      if (response?.conversation?.id) {
        setConversations((prev) => {
          const filtered = prev.filter(
            (c) => Boolean(c && c.id && c.id !== response.conversation.id)
          );
          return [response.conversation, ...filtered];
        });
      }
    } catch (err: any) {
      setChatError(err.message || 'Erro ao comunicar com o GameAgent.');
      setPendingRetryPayload({ message: trimmed, clientRequestId });
    } finally {
      setIsSending(false);
    }
  };

  const refreshAfterConfirmedWrite = useCallback(
    async (toolName: string) => {
      try {
        const libRes = await ApiService.getLibrary({ limit: 50, sort: 'recentlyUpdated' });
        setLibraryEntries(libRes.data);

        if (toolName === 'updateGameProgress' && selectedGameId) {
          const matchedEntry = libRes.data.find((item) => item.gameId === selectedGameId);
          if (matchedEntry) {
            const jrnRes = await ApiService.getJourneys({
              userGameId: matchedEntry.id,
              limit: 30,
            });
            setJourneys(jrnRes.data);
          }
        }
      } catch {
        // Non-blocking UI refresh after confirmed write
      }
    },
    [selectedGameId]
  );

  const handleConfirmAction = async (proposal: AgentActionProposal) => {
    if (confirmingActionId) return;
    setConfirmingActionId(proposal.id);
    setActionFeedback(null);

    try {
      const res = await ApiService.confirmAgentAction(proposal.id);
      if (res.action?.id) {
        setActionProposals((prev) =>
          prev.map((item) => (item && item.id === res.action.id ? res.action : item))
        );
      }
      if (res.followUpMessage?.id) {
        setMessages((prev) =>
          prev.some((m) => m && m.id === res.followUpMessage!.id)
            ? prev
            : [...prev, res.followUpMessage!]
        );
      }
      setActionFeedback({ type: 'success', message: res.message });
      if (res.action?.toolName) {
        await refreshAfterConfirmedWrite(res.action.toolName);
      }
    } catch (err: any) {
      if (err?.code === 'ACTION_EXPIRED' || err?.status === 410) {
        setActionProposals((prev) =>
          prev.map((item) =>
            item.id === proposal.id ? { ...item, status: 'EXPIRED' } : item
          )
        );
      }
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Não foi possível confirmar a ação.',
      });
    } finally {
      setConfirmingActionId(null);
    }
  };

  const handleCancelAction = async (proposal: AgentActionProposal) => {
    if (confirmingActionId) return;
    setConfirmingActionId(proposal.id);
    setActionFeedback(null);

    try {
      const res = await ApiService.cancelAgentAction(proposal.id);
      if (res.action?.id) {
        setActionProposals((prev) =>
          prev.map((item) => (item && item.id === res.action.id ? res.action : item))
        );
      }
      if (res.followUpMessage?.id) {
        setMessages((prev) =>
          prev.some((m) => m && m.id === res.followUpMessage!.id)
            ? prev
            : [...prev, res.followUpMessage!]
        );
      }
      setActionFeedback({ type: 'success', message: res.message });
    } catch (err: any) {
      if (err?.code === 'ACTION_EXPIRED' || err?.status === 410) {
        setActionProposals((prev) =>
          prev.map((item) =>
            item.id === proposal.id ? { ...item, status: 'EXPIRED' } : item
          )
        );
      }
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Não foi possível cancelar a ação.',
      });
    } finally {
      setConfirmingActionId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;
    executeSend(inputMessage, generateRequestId(), false);
  };

  const handleRetry = () => {
    if (!pendingRetryPayload || isSending) return;
    executeSend(pendingRetryPayload.message, pendingRetryPayload.clientRequestId, true);
  };

  const selectedGameObj = libraryEntries.find((e) => e.gameId === selectedGameId)?.game || null;
  const selectedJourneyObj = journeys.find((j) => j.id === selectedJourneyId) || null;
  const activeSpoilerOption = spoilerOptions.find((s) => s.id === spoilerLevel);

  const renderConversationsList = () => (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="sm"
        className="w-full justify-center"
        leftIcon={<Plus className="w-4 h-4" />}
        onClick={handleNewConversation}
      >
        Nova Conversa
      </Button>

      {isLoadingConversations ? (
        <div className="space-y-2 pt-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl mt-2">
          Nenhuma conversa salva ainda. Envie uma pergunta para iniciar.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1 pt-1">
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={`group p-2.5 rounded-xl text-xs transition-all border flex items-start justify-between gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-violet-950/70 text-violet-100 border-violet-500/50 shadow-md shadow-violet-950/40'
                    : 'bg-slate-950/50 text-slate-400 border-slate-800/70 hover:bg-slate-900/70 hover:text-slate-200'
                }`}
                onClick={() => handleSelectConversation(conv)}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate text-slate-200">{conv.title}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        conv.mode === 'LIBRARY'
                          ? 'bg-sky-950/80 text-sky-300 border border-sky-700/40'
                          : 'bg-violet-950/80 text-violet-300 border border-violet-700/40'
                      }`}
                    >
                      {conv.mode === 'LIBRARY' ? 'Biblioteca' : 'Companion'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {conv.messageCount} msg{conv.messageCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(conv);
                  }}
                  className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors shrink-0 cursor-pointer"
                  aria-label={`Excluir conversa ${conv.title}`}
                  title="Excluir conversa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5 max-w-7xl mx-auto min-w-0">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              GameAgent AI
            </h1>
            <Badge variant="ai">Gemini Engine</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Assistente contextual com histórico persistente, integração com suas jornadas e filtro anti-spoiler.
          </p>
        </div>

        {/* Mode Toggle + Mobile History Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl bg-slate-900/90 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('COMPANION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                mode === 'COMPANION'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-950/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Companion</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('LIBRARY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                mode === 'LIBRARY'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-950/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Biblioteca</span>
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="lg:hidden"
            leftIcon={<PanelLeftOpen className="w-4 h-4" />}
            onClick={() => setIsMobileHistoryOpen(true)}
          >
            Conversas ({conversations.length})
          </Button>
        </div>
      </div>

      {/* Configuration Bar: Game, Journey & Spoiler Policy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Game & Journey Selector */}
        <Card className="p-4 lg:col-span-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Gamepad2 className="w-4 h-4 text-violet-400" />
              <span>Jogo em Foco ({mode === 'LIBRARY' ? 'Opcional' : 'Recomendado'}):</span>
            </label>
            {isLoadingOptions ? (
              <Skeleton className="h-10 w-full rounded-xl" />
            ) : (
              <select
                value={selectedGameId}
                onChange={(e) => {
                  setSelectedGameId(e.target.value);
                  setSelectedJourneyId('');
                }}
                className="w-full bg-slate-950 text-xs sm:text-sm text-white rounded-xl p-2.5 border border-slate-800 focus:outline-none focus:border-violet-500"
              >
                <option value="">
                  {mode === 'LIBRARY'
                    ? 'Consulta geral da minha biblioteca'
                    : 'Nenhum jogo específico selecionado'}
                </option>
                {libraryEntries.map((entry) => (
                  <option key={entry.id} value={entry.gameId}>
                    {entry.game.title} ({entry.hoursPlayed}h)
                  </option>
                ))}
              </select>
            )}
          </div>

          {mode === 'COMPANION' && (
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-sky-400" />
                <span>Jornada de Gameplay:</span>
              </label>
              {isLoadingJourneys ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : (
                <select
                  value={selectedJourneyId}
                  onChange={(e) => setSelectedJourneyId(e.target.value)}
                  disabled={!selectedGameId || journeys.length === 0}
                  className="w-full bg-slate-950 text-xs sm:text-sm text-white rounded-xl p-2.5 border border-slate-800 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                >
                  <option value="">
                    {!selectedGameId
                      ? 'Selecione um jogo primeiro'
                      : journeys.length === 0
                        ? 'Nenhuma jornada cadastrada para este jogo'
                        : 'Sem jornada específica'}
                  </option>
                  {journeys.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                      {j.isActive ? ' (Ativa)' : ''}
                      {j.currentArea ? ` — ${j.currentArea}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </Card>

        {/* Spoiler Controller Selector */}
        <Card className="p-4 lg:col-span-7 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Controle Anti-Spoiler:</span>
            </span>
            <span className="text-[11px] text-violet-400 font-medium">
              {activeSpoilerOption?.label}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {spoilerOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = spoilerLevel === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSpoilerLevel(opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-w-0 ${
                    isSelected
                      ? 'bg-violet-950/80 border-violet-500 text-white shadow-md shadow-violet-950/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Icon
                      className={`w-4 h-4 ${isSelected ? 'text-violet-400' : 'text-slate-500'}`}
                    />
                    {isSelected && <Check className="w-3.5 h-3.5 text-violet-400" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight truncate">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Main Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Desktop Conversations Sidebar */}
        <Card className="hidden lg:block lg:col-span-4 xl:col-span-3 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 pb-2 border-b border-slate-800">
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" />
              Conversas Salvas
            </span>
            <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
              {conversations.length}
            </span>
          </div>
          {renderConversationsList()}
        </Card>

        {/* Chat Area */}
        <Card glow="violet" className="lg:col-span-8 xl:col-span-9 flex flex-col h-[560px] min-w-0">
          <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-violet-900/40 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                  <span className="truncate">
                    {mode === 'LIBRARY'
                      ? 'Consultor de Biblioteca'
                      : selectedGameObj
                        ? `Companion: ${selectedGameObj.title}`
                        : 'Game Companion AI'}
                  </span>
                  <Badge variant="ai" size="sm">
                    {mode === 'LIBRARY' ? 'Biblioteca' : 'Companion'}
                  </Badge>
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  Proteção: {activeSpoilerOption?.label}
                  {selectedJourneyObj
                    ? ` • Jornada: ${selectedJourneyObj.name}${
                        selectedJourneyObj.currentArea ? ` (${selectedJourneyObj.currentArea})` : ''
                      }`
                    : ''}
                </p>
              </div>
            </div>

            {activeConversationId && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleNewConversation}
              >
                Nova
              </Button>
            )}
          </CardHeader>

          {/* Messages Viewport */}
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-4">
            {isLoadingThread ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-3/4 rounded-2xl ml-auto" />
                <Skeleton className="h-28 w-4/5 rounded-2xl" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-950/70 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h4 className="text-sm font-bold text-white">
                    {mode === 'LIBRARY'
                      ? 'Pronto para organizar sua biblioteca e backlog'
                      : 'Companion pronto para auxiliar na sua jornada'}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {mode === 'LIBRARY'
                      ? 'Pergunte o que jogar a seguir, peça comparações entre estilos ou organize seus jogos por tempo disponível.'
                      : 'Selecione um jogo e uma jornada acima para dicas de build, estratégia e progresso sem spoilers além do seu capítulo.'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {(mode === 'LIBRARY'
                    ? [
                        'Qual jogo da minha biblioteca devo priorizar neste fim de semana?',
                        'Como equilibrar RPGs longos com jogos curtos no backlog?',
                      ]
                    : [
                        'Quais atributos devo priorizar para a minha jornada atual?',
                        'Quais dicas sem spoiler você recomenda para esta etapa?',
                      ]
                  ).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInputMessage(suggestion)}
                      className="text-[11px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:border-violet-500/50 hover:text-white transition-colors cursor-pointer text-left"
                    >
                      <MessageSquare className="w-3 h-3 inline mr-1.5 text-violet-400" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'USER';
                const grounded = Boolean(msg.metadata?.groundedInRealData);
                const toolsUsed = Array.isArray(msg.metadata?.toolsUsed)
                  ? (msg.metadata!.toolsUsed as AgentToolExecutionTrace[])
                  : [];
                const knowledge =
                  msg.metadata?.knowledge && typeof msg.metadata.knowledge === 'object'
                    ? (msg.metadata.knowledge as KnowledgeTurnMeta)
                    : null;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-xl p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words shadow-md ${
                        isUser
                          ? 'rounded-tr-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                          : 'rounded-tl-sm bg-slate-950/90 border border-violet-500/25 text-slate-200'
                      }`}
                    >
                      {!isUser && (
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                          <div className="flex items-center gap-1.5 text-violet-400 font-bold text-[11px]">
                            <Bot className="w-3.5 h-3.5" />
                            <span>GameAgent</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {knowledge?.hasSources && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-sky-950/70 text-sky-300 border border-sky-500/30">
                                <FileCheck2 className="w-2.5 h-2.5" />
                                Fundamentado em fontes
                              </span>
                            )}
                            {grounded && !knowledge?.hasSources && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                                <Database className="w-2.5 h-2.5" />
                                Baseado em dados reais
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div>{msg.content}</div>

                      {!isUser && knowledge && knowledge.references.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-300 uppercase tracking-wider">
                            <BookOpen className="w-3 h-3 text-sky-400" />
                            <span>Fontes Consultadas ({knowledge.chunksUsedCount} trecho{knowledge.chunksUsedCount === 1 ? '' : 's'})</span>
                          </div>
                          <ul className="space-y-1">
                            {knowledge.references.map((ref) => (
                              <li
                                key={ref.guideId}
                                className="flex items-center justify-between gap-2 text-[11px] text-slate-300 bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1.5"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-200 truncate">
                                    {ref.title}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                                    <span>{ref.sourceName}</span>
                                    {ref.regionOrChapter && <span>· {ref.regionOrChapter}</span>}
                                    {ref.isVerified && (
                                      <span className="text-emerald-400">· Verificada</span>
                                    )}
                                  </div>
                                </div>
                                {isSafeHttpUrl(ref.sourceUrl) && (
                                  <a
                                    href={ref.sourceUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-sky-300 hover:text-sky-200 shrink-0 underline underline-offset-2"
                                  >
                                    <span>Fonte</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!isUser && knowledge?.spoilerRestricted && (
                        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-start gap-1.5 text-[11px] text-amber-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>
                            Filtro anti-spoiler ativo: {knowledge.blockedChunksCount} trecho
                            {knowledge.blockedChunksCount === 1 ? '' : 's'} omitido
                            {knowledge.blockedChunksCount === 1 ? '' : 's'} para proteger sua experiência.
                          </span>
                        </div>
                      )}

                      {!isUser &&
                        knowledge &&
                        (knowledge.evidenceStatus === 'NO_DOCUMENTS' ||
                          knowledge.evidenceStatus === 'INSUFFICIENT') && (
                          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-start gap-1.5 text-[11px] text-slate-400">
                            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>
                              Informação documental insuficiente na base de conhecimento curada para esta consulta.
                            </span>
                          </div>
                        )}

                      {!isUser && toolsUsed.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 mr-0.5">
                            <Wrench className="w-3 h-3 text-sky-400" />
                            Ferramentas:
                          </span>
                          {toolsUsed.map((tool, idx) => (
                            <span
                              key={`${tool.name}-${idx}`}
                              className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${
                                tool.status === 'EXECUTED'
                                  ? 'bg-sky-950/60 text-sky-300 border-sky-700/40'
                                  : tool.status === 'PENDING_CONFIRMATION'
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-700/40'
                                    : 'bg-rose-950/60 text-rose-300 border-rose-700/40'
                              }`}
                            >
                              {getToolDisplayName(tool.name)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {actionProposals.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ações Propostas pelo GameAgent</span>
                </div>
                {actionProposals.map((proposal) => {
                  const statusMeta = getActionStatusMeta(proposal.status);
                  const isPending = proposal.status === 'PENDING';
                  const isBusy = confirmingActionId === proposal.id;
                  const preview = proposal.preview || {};

                  return (
                    <div
                      key={proposal.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                        isPending
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-slate-900/70 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{getToolDisplayName(proposal.toolName)}</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed">{proposal.summary}</p>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold shrink-0 ${statusMeta.classes}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300 bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/80">
                        {typeof preview.gameTitle === 'string' && (
                          <div>
                            <span className="text-slate-500">Jogo: </span>
                            <span className="text-slate-200 font-medium">{preview.gameTitle}</span>
                          </div>
                        )}
                        {typeof preview.statusLabel === 'string' && (
                          <div>
                            <span className="text-slate-500">Status: </span>
                            <span className="text-slate-200 font-medium">{preview.statusLabel}</span>
                          </div>
                        )}
                        {typeof preview.journeyName === 'string' && (
                          <div>
                            <span className="text-slate-500">Jornada: </span>
                            <span className="text-slate-200 font-medium">{preview.journeyName}</span>
                          </div>
                        )}
                        {typeof preview.areaName === 'string' && preview.areaName && (
                          <div>
                            <span className="text-slate-500">Área: </span>
                            <span className="text-slate-200 font-medium">{preview.areaName}</span>
                          </div>
                        )}
                        {typeof preview.questName === 'string' && preview.questName && (
                          <div>
                            <span className="text-slate-500">Missão: </span>
                            <span className="text-slate-200 font-medium">{preview.questName}</span>
                          </div>
                        )}
                        {typeof preview.completionPercent === 'number' && (
                          <div>
                            <span className="text-slate-500">Progresso: </span>
                            <span className="text-slate-200 font-medium">
                              {preview.completionPercent}%
                            </span>
                          </div>
                        )}
                        {typeof preview.description === 'string' && preview.description && (
                          <div className="sm:col-span-2">
                            <span className="text-slate-500">Descrição: </span>
                            <span className="text-slate-200">{preview.description}</span>
                          </div>
                        )}
                      </div>

                      {proposal.errorMessage && proposal.status === 'FAILED' && (
                        <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
                          {proposal.errorMessage}
                        </div>
                      )}

                      {isPending && (
                        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                            <Clock className="w-3 h-3 text-amber-400" />
                            Expira às {formatExpirationTime(proposal.expiresAt)}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelAction(proposal)}
                              disabled={confirmingActionId !== null}
                              leftIcon={<XCircle className="w-3.5 h-3.5 text-slate-400" />}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleConfirmAction(proposal)}
                              disabled={confirmingActionId !== null}
                              leftIcon={
                                isBusy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )
                              }
                            >
                              {isBusy ? 'Confirmando...' : 'Confirmar'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {actionFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  actionFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                }`}
              >
                {actionFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
            )}

            {isSending && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-950/90 border border-violet-500/25 text-xs text-slate-300 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  <span>Consultando ferramentas e formulando resposta...</span>
                </div>
              </div>
            )}

            {chatError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{chatError}</span>
                </div>
                {pendingRetryPayload && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={handleRetry}
                    disabled={isSending}
                  >
                    Tentar Novamente
                  </Button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          {/* Chat Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-1.5"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                maxLength={MAX_MESSAGE_CHARS}
                disabled={isSending}
                placeholder={
                  mode === 'LIBRARY'
                    ? 'Pergunte sobre organização do backlog, recomendações ou comparações...'
                    : 'Pergunte sobre builds, atributos, área atual ou próximos passos...'
                }
                className="flex-1 min-w-0 bg-slate-900 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-violet-500 transition-all disabled:opacity-60"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                leftIcon={
                  isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )
                }
                disabled={!inputMessage.trim() || isSending}
              >
                <span className="hidden sm:inline">{isSending ? 'Enviando...' : 'Enviar'}</span>
              </Button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
              <span>As respostas seguem estritamente o filtro anti-spoiler selecionado.</span>
              <span className="font-mono">
                {inputMessage.length}/{MAX_MESSAGE_CHARS}
              </span>
            </div>
          </form>
        </Card>
      </div>

      {/* Mobile Conversations Drawer Modal */}
      {isMobileHistoryOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsMobileHistoryOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-slate-900 border-r border-slate-800 h-full p-4 z-10 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-violet-400" />
                Conversas Salvas
              </span>
              <button
                type="button"
                onClick={() => setIsMobileHistoryOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Fechar histórico"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderConversationsList()}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Excluir Conversa"
        description="Esta ação removerá permanentemente todas as mensagens desta conversa."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Tem certeza que deseja excluir{' '}
            <strong className="text-white">{deleteTarget?.title}</strong>?
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              leftIcon={
                isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )
              }
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
