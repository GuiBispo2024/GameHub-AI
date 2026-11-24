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
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
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
import { getSafeHttpUrl } from '../utils/url';
import { getSpoilerLabel } from '../utils/formatters';

const MAX_MESSAGE_CHARS = 2000;

interface CompanionViewProps {
  seedContext?: {
    gameId?: string | null;
    journeyId?: string | null;
    nonce: number;
  } | null;
}

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
      return 'Base de Conhecimento';
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

function getActionStatusMeta(status: AgentActionStatus): {
  label: string;
  classes: string;
} {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Aguardando confirmação',
        classes: 'bg-amber-950/75 text-amber-200 border-amber-500/40',
      };
    case 'CONFIRMED':
      return {
        label: 'Processando',
        classes: 'bg-sky-950/75 text-sky-200 border-sky-500/40',
      };
    case 'EXECUTED':
      return {
        label: 'Executada',
        classes: 'bg-emerald-950/75 text-emerald-200 border-emerald-500/40',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelada',
        classes: 'bg-slate-900 text-slate-300 border-slate-700',
      };
    case 'EXPIRED':
      return {
        label: 'Expirada',
        classes: 'bg-rose-950/75 text-rose-200 border-rose-500/40',
      };
    case 'FAILED':
    default:
      return {
        label: 'Falhou',
        classes: 'bg-rose-950/75 text-rose-200 border-rose-500/40',
      };
  }
}

function formatExpirationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function CompanionView({ seedContext }: CompanionViewProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<AgentMode>('COMPANION');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [spoilerLevel, setSpoilerLevel] = useState<SpoilerLevel>(() =>
    normalizeDefaultSpoiler(user?.preferences?.defaultSpoilerLevel)
  );

  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [journeys, setJourneys] = useState<GameplayJourney[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(true);
  const [isLoadingJourneys, setIsLoadingJourneys] = useState<boolean>(false);

  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState<boolean>(false);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingRetryPayload, setPendingRetryPayload] = useState<{
    message: string;
    clientRequestId: string;
  } | null>(null);

  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentConversationSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

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

  // Apply external seed context when navigating from Explore, Library, or Journeys
  useEffect(() => {
    if (!seedContext) return;
    setActiveConversationId(null);
    setMessages([]);
    setActionProposals([]);
    setChatError(null);
    setActionFeedback(null);
    setPendingRetryPayload(null);
    setMode('COMPANION');
    if (seedContext.gameId) {
      setSelectedGameId(seedContext.gameId);
    }
    if (seedContext.journeyId) {
      setSelectedJourneyId(seedContext.journeyId);
    }
  }, [seedContext?.nonce, seedContext?.gameId, seedContext?.journeyId]);

  useEffect(() => {
    if (!isMobileHistoryOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileHistoryOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMobileHistoryOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, actionProposals, isSending]);

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
      setMessages((detail.messages || []).filter((m) => Boolean(m && m.id)));
      setActionProposals((detail.actionProposals || []).filter((p) => Boolean(p && p.id)));
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
      showToast({ variant: 'success', message: 'Conversa excluída.' });
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
        const validLib = (libRes.data || []).filter((e) => Boolean(e && e.id));
        setLibraryEntries(validLib);

        if (toolName === 'updateGameProgress' && selectedGameId) {
          const matchedEntry = validLib.find((item) => item.gameId === selectedGameId);
          if (matchedEntry) {
            const jrnRes = await ApiService.getJourneys({
              userGameId: matchedEntry.id,
              limit: 30,
            });
            setJourneys((jrnRes.data || []).filter((j) => Boolean(j && j.id)));
          }
        }
      } catch {
        // Non-blocking refresh
      }
    },
    [selectedGameId]
  );

  const handleConfirmAction = async (proposal: AgentActionProposal) => {
    if (confirmingActionId || proposal.status !== 'PENDING') return;
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
      showToast({ variant: 'success', message: res.message });
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
      const msg = err?.message || 'Não foi possível confirmar a ação.';
      setActionFeedback({ type: 'error', message: msg });
      showToast({ variant: 'error', message: msg });
    } finally {
      setConfirmingActionId(null);
    }
  };

  const handleCancelAction = async (proposal: AgentActionProposal) => {
    if (confirmingActionId || proposal.status !== 'PENDING') return;
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
      showToast({ variant: 'info', message: res.message });
    } catch (err: any) {
      if (err?.code === 'ACTION_EXPIRED' || err?.status === 410) {
        setActionProposals((prev) =>
          prev.map((item) =>
            item.id === proposal.id ? { ...item, status: 'EXPIRED' } : item
          )
        );
      }
      const msg = err?.message || 'Não foi possível cancelar a ação.';
      setActionFeedback({ type: 'error', message: msg });
    } finally {
      setConfirmingActionId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;
    executeSend(inputMessage, generateRequestId(), false);
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputMessage.trim() && !isSending) {
        executeSend(inputMessage, generateRequestId(), false);
      }
    }
  };

  const handleRetry = () => {
    if (!pendingRetryPayload || isSending) return;
    executeSend(pendingRetryPayload.message, pendingRetryPayload.clientRequestId, true);
  };

  const selectedGameObj = libraryEntries.find((e) => e.gameId === selectedGameId)?.game || null;
  const selectedJourneyObj = journeys.find((j) => j.id === selectedJourneyId) || null;
  const activeSpoilerOption = spoilerOptions.find((s) => s.id === spoilerLevel);

  const renderConversationsList = () => (
    <div className="space-y-2.5 flex-1 min-h-0 flex flex-col">
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        leftIcon={<Plus className="w-4 h-4" />}
        onClick={handleNewConversation}
      >
        Nova Conversa
      </Button>

      {isLoadingConversations ? (
        <div className="space-y-2 pt-1">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl mt-1">
          Nenhuma conversa salva ainda. Envie uma pergunta para começar.
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 max-h-[460px]">
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={`group p-2.5 rounded-xl text-xs transition-colors border flex items-start justify-between gap-2 ${
                  isActive
                    ? 'bg-violet-950/60 text-white border-violet-500/50'
                    : 'bg-[var(--bg-inset)] text-slate-300 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectConversation(conv)}
                  className="min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="font-semibold truncate text-slate-100">{conv.title}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 tabular-nums">
                    <span className={conv.mode === 'LIBRARY' ? 'text-sky-300' : 'text-violet-300'}>
                      {conv.mode === 'LIBRARY' ? 'Biblioteca' : 'Companion'}
                    </span>
                    <span>·</span>
                    <span>
                      {conv.messageCount} msg{conv.messageCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(conv)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
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
    <div className="space-y-5 max-w-7xl mx-auto min-w-0 pb-6">
      <PageHeader
        title="Game Companion"
        subtitle="Assistente contextual conectado às suas jornadas, guias verificados e controle rigoroso de spoilers."
        badge={<Badge variant="ai" size="sm">Gemini + RAG</Badge>}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div
              role="group"
              aria-label="Modo do assistente"
              className="inline-flex rounded-xl bg-[var(--bg-surface)] p-1 border border-slate-800"
            >
              <button
                type="button"
                aria-pressed={mode === 'COMPANION'}
                onClick={() => setMode('COMPANION')}
                className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'COMPANION'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Companion</span>
              </button>
              <button
                type="button"
                aria-pressed={mode === 'LIBRARY'}
                onClick={() => setMode('LIBRARY')}
                className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'LIBRARY'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
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
        }
      />

      {/* Context & Spoiler Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="p-4 lg:col-span-5 space-y-3">
          {isLoadingOptions ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : (
            <Select
              label={`Jogo em foco (${mode === 'LIBRARY' ? 'Opcional' : 'Recomendado'})`}
              value={selectedGameId}
              onChange={(e) => {
                setSelectedGameId(e.target.value);
                setSelectedJourneyId('');
              }}
              className="text-xs sm:text-sm"
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
            </Select>
          )}

          {mode === 'COMPANION' && (
            isLoadingJourneys ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (
              <Select
                label="Jornada de gameplay"
                value={selectedJourneyId}
                onChange={(e) => setSelectedJourneyId(e.target.value)}
                disabled={!selectedGameId || journeys.length === 0}
                className="text-xs sm:text-sm"
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
              </Select>
            )
          )}
        </Card>

        <Card className="p-4 lg:col-span-7 flex flex-col justify-between gap-2.5">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>Política Anti-Spoiler Ativa</span>
            </span>
            <Badge variant="warning" size="sm">
              {activeSpoilerOption?.label}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Nível de proteção contra spoilers">
            {spoilerOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = spoilerLevel === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSpoilerLevel(opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between min-w-0 ${
                    isSelected
                      ? 'bg-violet-950/65 border-violet-400 text-white'
                      : 'bg-[var(--bg-inset)] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Icon
                      className={`w-4 h-4 ${isSelected ? 'text-violet-300' : 'text-slate-400'}`}
                      aria-hidden="true"
                    />
                    {isSelected && <Check className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight truncate">{opt.label}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                      {opt.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Main Chat Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Desktop Conversations Sidebar */}
        <Card className="hidden lg:flex lg:flex-col lg:col-span-4 xl:col-span-3 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-2 border-b border-slate-800">
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>Conversas Salvas</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {conversations.length}
            </span>
          </div>
          {renderConversationsList()}
        </Card>

        {/* Chat Area */}
        <Card
          glow="violet"
          className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-[460px] h-[calc(100dvh-17rem)] lg:h-[calc(100dvh-14.5rem)] max-h-[780px] min-w-0"
        >
          <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white shrink-0">
                <Bot className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-sm text-white truncate">
                    {mode === 'LIBRARY'
                      ? 'Consultor de Biblioteca'
                      : selectedGameObj
                        ? selectedGameObj.title
                        : 'Game Companion'}
                  </h2>
                  <Badge variant="ai" size="sm">
                    {mode === 'LIBRARY' ? 'Biblioteca' : 'Companion'}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Proteção: {getSpoilerLabel(spoilerLevel)}
                  {selectedJourneyObj
                    ? ` · Jornada: ${selectedJourneyObj.name}${
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
                Nova conversa
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
                <div className="w-12 h-12 rounded-2xl bg-violet-950/70 border border-violet-500/35 flex items-center justify-center text-violet-300">
                  <Sparkles className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-sm font-bold text-white">
                    {mode === 'LIBRARY'
                      ? 'Pronto para organizar sua biblioteca'
                      : 'Companion pronto para auxiliar na sua jornada'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {mode === 'LIBRARY'
                      ? 'Peça recomendações baseadas no seu tempo livre, compare títulos da sua coleção ou organize o backlog.'
                      : 'Selecione um jogo e uma jornada acima para receber estratégias com referências verificadas e proteção contra spoilers.'}
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
                      className="text-xs px-3 py-2 rounded-xl bg-[var(--bg-inset)] border border-slate-800 text-slate-200 hover:border-violet-500/50 hover:text-white transition-colors cursor-pointer text-left"
                    >
                      <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 text-violet-400" aria-hidden="true" />
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
                      className={`max-w-[92%] sm:max-w-2xl p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isUser
                          ? 'rounded-tr-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                          : 'rounded-tl-sm bg-[var(--bg-inset)] border border-slate-800 text-slate-100'
                      }`}
                    >
                      {!isUser && (
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-2 pb-1.5 border-b border-slate-800/80">
                          <div className="flex items-center gap-1.5 text-violet-300 font-bold text-xs">
                            <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>GameAgent</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {knowledge?.hasSources ? (
                              <Badge variant="info" size="sm">
                                <FileCheck2 className="w-3 h-3" aria-hidden="true" />
                                Baseado em fontes
                              </Badge>
                            ) : grounded ? (
                              <Badge variant="success" size="sm">
                                <Database className="w-3 h-3" aria-hidden="true" />
                                Dados da sua conta
                              </Badge>
                            ) : (
                              <Badge variant="default" size="sm">
                                Orientação geral
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      <div>{msg.content}</div>

                      {/* Verified RAG Knowledge References */}
                      {!isUser && knowledge && knowledge.references.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-300 uppercase tracking-wider">
                            <BookOpen className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                            <span>
                              Fontes Consultadas ({knowledge.chunksUsedCount} trecho
                              {knowledge.chunksUsedCount === 1 ? '' : 's'})
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            {knowledge.references.map((ref) => {
                              const safeUrl = getSafeHttpUrl(ref.sourceUrl);
                              return (
                                <li
                                  key={ref.guideId}
                                  className="flex items-center justify-between gap-2 text-xs text-slate-300 bg-slate-900/75 border border-slate-800 rounded-xl px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-100 truncate">
                                      {ref.title}
                                    </div>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                                      <span>{ref.sourceName}</span>
                                      {ref.sourceLicense && <span>· {ref.sourceLicense}</span>}
                                      {ref.regionOrChapter && <span>· {ref.regionOrChapter}</span>}
                                      {ref.isVerified && (
                                        <span className="text-emerald-400 font-medium">· Verificada</span>
                                      )}
                                    </div>
                                  </div>
                                  {safeUrl && (
                                    <a
                                      href={safeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200 shrink-0 underline underline-offset-2"
                                    >
                                      <span>Fonte</span>
                                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                    </a>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Explicit Anti-Spoiler Restriction Banner (No leaked titles/chunks) */}
                      {!isUser && knowledge?.spoilerRestricted && (
                        <div
                          role="status"
                          className="mt-2.5 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/35 flex items-start gap-2 text-xs text-amber-200"
                        >
                          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>
                            Filtro anti-spoiler ativo ({getSpoilerLabel(spoilerLevel)}):{' '}
                            <strong className="tabular-nums">{knowledge.blockedChunksCount}</strong>{' '}
                            trecho{knowledge.blockedChunksCount === 1 ? '' : 's'} avançado
                            {knowledge.blockedChunksCount === 1 ? '' : 's'} foi omitido para proteger sua experiência.
                          </span>
                        </div>
                      )}

                      {/* Insufficient / No Documents Notice */}
                      {!isUser &&
                        knowledge &&
                        (knowledge.evidenceStatus === 'NO_DOCUMENTS' ||
                          knowledge.evidenceStatus === 'INSUFFICIENT') && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-start gap-2 text-xs text-slate-300">
                            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>
                              Não há documentos verificados suficientes na base de conhecimento para esta consulta específica; a resposta utiliza apenas orientação geral segura.
                            </span>
                          </div>
                        )}

                      {/* Tools Executed */}
                      {!isUser && toolsUsed.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1 mr-1">
                            <Wrench className="w-3 h-3 text-sky-400" aria-hidden="true" />
                            Consultas:
                          </span>
                          <span>
                            {Array.from(new Set(toolsUsed.map((t) => getToolDisplayName(t.name)))).join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Write Action Proposals */}
            {actionProposals.length > 0 && (
              <div className="space-y-2.5 pt-3 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
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
                          ? 'bg-amber-950/20 border-amber-500/45'
                          : 'bg-[var(--bg-inset)] border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold text-white">
                            {getToolDisplayName(proposal.toolName)}
                          </div>
                          <p className="text-slate-300 leading-relaxed">{proposal.summary}</p>
                        </div>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold shrink-0 ${statusMeta.classes}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-300 bg-slate-950/70 rounded-xl p-3 border border-slate-800/80">
                        {typeof preview.gameTitle === 'string' && (
                          <div>
                            <span className="text-slate-400">Jogo: </span>
                            <span className="text-slate-100 font-medium">{preview.gameTitle}</span>
                          </div>
                        )}
                        {typeof preview.statusLabel === 'string' && (
                          <div>
                            <span className="text-slate-400">Status: </span>
                            <span className="text-slate-100 font-medium">{preview.statusLabel}</span>
                          </div>
                        )}
                        {typeof preview.journeyName === 'string' && (
                          <div>
                            <span className="text-slate-400">Jornada: </span>
                            <span className="text-slate-100 font-medium">{preview.journeyName}</span>
                          </div>
                        )}
                        {typeof preview.areaName === 'string' && preview.areaName && (
                          <div>
                            <span className="text-slate-400">Área: </span>
                            <span className="text-slate-100 font-medium">{preview.areaName}</span>
                          </div>
                        )}
                        {typeof preview.questName === 'string' && preview.questName && (
                          <div>
                            <span className="text-slate-400">Missão: </span>
                            <span className="text-slate-100 font-medium">{preview.questName}</span>
                          </div>
                        )}
                        {typeof preview.completionPercent === 'number' && (
                          <div className="tabular-nums">
                            <span className="text-slate-400">Progresso: </span>
                            <span className="text-slate-100 font-medium">{preview.completionPercent}%</span>
                          </div>
                        )}
                        {typeof preview.description === 'string' && preview.description && (
                          <div className="sm:col-span-2">
                            <span className="text-slate-400">Descrição: </span>
                            <span className="text-slate-100">{preview.description}</span>
                          </div>
                        )}
                      </div>

                      {proposal.errorMessage && proposal.status === 'FAILED' && (
                        <div className="text-xs text-rose-200 bg-rose-950/40 border border-rose-500/35 rounded-lg px-3 py-2">
                          {proposal.errorMessage}
                        </div>
                      )}

                      {isPending && (
                        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 tabular-nums">
                            <Clock className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
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
                role={actionFeedback.type === 'error' ? 'alert' : 'status'}
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  actionFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                }`}
              >
                {actionFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
            )}

            {isSending && (
              <div className="flex justify-start" role="status" aria-live="polite">
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[var(--bg-inset)] border border-violet-500/30 text-xs text-slate-200 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" aria-hidden="true" />
                  <span>Consultando fontes e formulando resposta...</span>
                </div>
              </div>
            )}

            {chatError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
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

          {/* Sticky Composer */}
          <form
            onSubmit={handleSubmit}
            className="p-3 sm:p-4 border-t border-slate-800/80 bg-[var(--bg-inset)]/90 space-y-1.5 shrink-0"
          >
            <div className="flex items-end gap-2">
              <label htmlFor="companion-message-input" className="sr-only">
                Mensagem para o Game Companion
              </label>
              <textarea
                id="companion-message-input"
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                maxLength={MAX_MESSAGE_CHARS}
                disabled={isSending}
                placeholder={
                  mode === 'LIBRARY'
                    ? 'Pergunte sobre organização do backlog, recomendações ou comparações...'
                    : 'Pergunte sobre builds, estratégia, área atual ou próximos passos...'
                }
                className="flex-1 min-w-0 min-h-[44px] max-h-32 bg-slate-900 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 rounded-xl px-3.5 py-2.5 border border-slate-700/80 focus:outline-none focus:border-violet-400 transition-colors disabled:opacity-60 resize-none"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="min-h-[44px]"
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
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 gap-2">
              <span className="truncate">
                Enter envia · Shift+Enter quebra linha · Filtro anti-spoiler ativo
              </span>
              <span className="font-mono tabular-nums shrink-0">
                {inputMessage.length}/{MAX_MESSAGE_CHARS}
              </span>
            </div>
          </form>
        </Card>
      </div>

      {/* Mobile Conversations Drawer */}
      {isMobileHistoryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Histórico de conversas"
          className="fixed inset-0 z-50 lg:hidden flex"
        >
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsMobileHistoryOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-80 max-w-[85vw] bg-[var(--bg-surface)] border-r border-slate-800 h-full p-4 z-10 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-violet-400" aria-hidden="true" />
                Conversas Salvas
              </span>
              <button
                type="button"
                onClick={() => setIsMobileHistoryOpen(false)}
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Fechar histórico de conversas"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderConversationsList()}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Conversa"
        description="Esta ação removerá permanentemente todas as mensagens desta conversa."
        message={
          deleteTarget ? (
            <>
              Tem certeza que deseja excluir{' '}
              <strong className="text-white">{deleteTarget.title}</strong>?
            </>
          ) : null
        }
        confirmLabel="Excluir"
        isLoading={isDeleting}
      />
    </div>
  );
}
