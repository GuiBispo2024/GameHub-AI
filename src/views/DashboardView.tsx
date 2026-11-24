import React, { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2,
  Bot,
  Compass,
  Library,
  Swords,
  Clock,
  Trophy,
  Star,
  ArrowRight,
  Plus,
  MessageSquare,
  MapPin,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { GameCover } from '../components/ui/GameCover';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api';
import {
  AgentConversationSummary,
  GameplayJourney,
  LibraryEntry,
  LibraryStats,
  NavTab,
} from '../types';
import {
  LIBRARY_STATUS_META,
  formatHours,
  formatShortDateBR,
  getSpoilerLabel,
} from '../utils/formatters';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onManageJourneys?: (entry: LibraryEntry) => void;
  onOpenCompanion?: (context?: { gameId?: string | null; journeyId?: string | null }) => void;
}

export function DashboardView({
  onNavigate,
  onManageJourneys,
  onOpenCompanion,
}: DashboardViewProps) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [recentGames, setRecentGames] = useState<LibraryEntry[]>([]);
  const [recentJourneys, setRecentJourneys] = useState<GameplayJourney[]>([]);
  const [recentConversations, setRecentConversations] = useState<AgentConversationSummary[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingData(true);
    setLoadError(null);

    try {
      const [statsRes, libRes, journeysRes, convsRes] = await Promise.allSettled([
        ApiService.getLibraryStats(),
        ApiService.getLibrary({ limit: 6, sort: 'recentlyUpdated' }),
        ApiService.getJourneys({ limit: 4 }),
        ApiService.getAgentConversations({ limit: 3 }),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
      if (libRes.status === 'fulfilled') {
        setRecentGames((libRes.value.data || []).filter((e) => Boolean(e && e.id)));
      }
      if (journeysRes.status === 'fulfilled') {
        const list = (journeysRes.value.data || []).filter((j) => Boolean(j && j.id));
        const activeFirst = [...list].sort((a, b) => Number(b.isActive) - Number(a.isActive));
        setRecentJourneys(activeFirst.slice(0, 4));
      }
      if (convsRes.status === 'fulfilled') {
        setRecentConversations((convsRes.value.data || []).filter((c) => Boolean(c && c.id)));
      }

      if (
        statsRes.status === 'rejected' &&
        libRes.status === 'rejected' &&
        journeysRes.status === 'rejected'
      ) {
        setLoadError('Não foi possível carregar o resumo da sua conta no momento.');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Erro ao carregar o painel principal.');
    } finally {
      setIsLoadingData(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    } else {
      setStats(null);
      setRecentGames([]);
      setRecentJourneys([]);
      setRecentConversations([]);
      setLoadError(null);
    }
  }, [isAuthenticated, fetchDashboardData]);

  if (isAuthLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950/75 via-[var(--bg-surface)] to-blue-950/65 border border-violet-500/30 p-6 sm:p-10 shadow-xl">
          <div className="max-w-2xl space-y-4">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Sua biblioteca gamer organizada com acompanhamento inteligente de jornadas
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Pesquise títulos no catálogo oficial da IGDB, registre seu progresso por campanha e conte com o Game Companion para dicas fundamentadas e sem spoilers.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Compass className="w-4 h-4" />}
                onClick={() => onNavigate('explore')}
              >
                Explorar Catálogo
              </Button>
              <Button
                variant="outline"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => onNavigate('auth')}
              >
                Entrar ou Criar Conta
              </Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card glow="blue" className="p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-300">
                <Compass className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-white">Catálogo IGDB em Tempo Real</h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Explore sinopses, datas de lançamento, plataformas e avaliações diretamente da base da IGDB.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="self-start -ml-2 text-blue-300"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('explore')}
            >
              Buscar jogos agora
            </Button>
          </Card>

          <Card glow="violet" className="p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-violet-950/80 border border-violet-500/30 flex items-center justify-center text-violet-300">
                <Swords className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-white">Biblioteca, Jornadas & Builds</h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Separe múltiplas campanhas no mesmo jogo, registre marcos cronológicos e salve builds flexíveis para qualquer gênero.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="self-start -ml-2 text-violet-300"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('auth')}
            >
              Criar conta gratuita
            </Button>
          </Card>

          <Card glow="indigo" className="p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-white">Companion com Filtro Anti-Spoiler</h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Respostas baseadas na sua jornada atual e em guias verificados, respeitando o nível de spoilers escolhido por você.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="self-start -ml-2 text-indigo-300"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('auth')}
            >
              Acessar Companion
            </Button>
          </Card>
        </section>
      </div>
    );
  }

  const playingCount = stats?.byStatus?.PLAYING ?? 0;

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-12">
      {/* Greeting & Quick Actions */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-950/70 via-[var(--bg-surface)] to-blue-950/60 border border-violet-500/30 p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Olá, {user?.username}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Acompanhe seus jogos em andamento, retome sua jornada ativa ou consulte o Game Companion com seu filtro de spoilers configurado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Compass className="w-4 h-4" />}
              onClick={() => onNavigate('explore')}
            >
              Explorar Catálogo
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Bot className="w-4 h-4" />}
              onClick={() => (onOpenCompanion ? onOpenCompanion() : onNavigate('companion'))}
            >
              Abrir Companion
            </Button>
          </div>
        </div>
      </section>

      {loadError && (
        <ErrorState message={loadError} onRetry={fetchDashboardData} />
      )}

      {/* Real Library Metrics Strip */}
      <section aria-label="Resumo da sua biblioteca">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-violet-950/80 border border-violet-500/30 flex items-center justify-center text-violet-300 shrink-0">
              <Library className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 truncate">Total na Biblioteca</div>
              {isLoadingData && !stats ? (
                <Skeleton className="h-6 w-14 mt-1" />
              ) : (
                <div className="text-xl font-bold text-white tabular-nums">
                  {stats?.totalGames ?? 0}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Gamepad2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 truncate">Jogando Agora</div>
              {isLoadingData && !stats ? (
                <Skeleton className="h-6 w-14 mt-1" />
              ) : (
                <div className="text-xl font-bold text-emerald-300 tabular-nums">
                  {playingCount}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-300 shrink-0">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 truncate">Horas Registradas</div>
              {isLoadingData && !stats ? (
                <Skeleton className="h-6 w-16 mt-1" />
              ) : (
                <div className="text-xl font-bold text-blue-300 tabular-nums">
                  {formatHours(stats?.totalHoursPlayed)}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Trophy className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 truncate">Concluídos</div>
              {isLoadingData && !stats ? (
                <Skeleton className="h-6 w-20 mt-1" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-indigo-300 tabular-nums">
                    {stats?.completedCount ?? 0}
                  </span>
                  {stats?.averageRating !== null && stats?.averageRating !== undefined && (
                    <span className="text-[11px] text-amber-300 tabular-nums inline-flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-300 text-amber-300" aria-hidden="true" />
                      {stats.averageRating}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* Recent / Active Games */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Jogos Recentes na Biblioteca</h2>
            <p className="text-xs text-slate-400">Últimos títulos atualizados na sua coleção pessoal</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('library')}
          >
            Ver biblioteca
          </Button>
        </div>

        {isLoadingData && recentGames.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : recentGames.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-6 h-6" />}
            title="Sua biblioteca ainda está vazia"
            description="Adicione jogos a partir do catálogo da IGDB para acompanhar seu progresso, horas jogadas e jornadas."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => onNavigate('explore')}
              >
                Explorar Catálogo
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentGames.map((entry) => {
              const statusMeta = LIBRARY_STATUS_META[entry.status] || LIBRARY_STATUS_META.BACKLOG;
              return (
                <Card key={entry.id} glow="violet" className="p-4 flex gap-3.5 items-stretch">
                  <GameCover
                    src={entry.game.coverUrl}
                    alt={entry.game.title}
                    className="w-20 aspect-[3/4] rounded-xl border border-slate-800 shrink-0"
                    iconSize="sm"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={statusMeta.badgeVariant} size="sm">
                          {statusMeta.label}
                        </Badge>
                        {entry.rating !== null && (
                          <span className="text-xs font-bold text-amber-300 tabular-nums inline-flex items-center gap-1 shrink-0">
                            <Star className="w-3 h-3 fill-amber-300 text-amber-300" aria-hidden="true" />
                            {entry.rating}/10
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white line-clamp-1">
                        {entry.game.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate tabular-nums">
                        {formatHours(entry.hoursPlayed)}
                        {entry.game.platforms.length > 0 ? ` · ${entry.game.platforms[0]}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {onManageJourneys && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 text-[11px] min-h-[32px] py-1"
                          onClick={() => onManageJourneys(entry)}
                        >
                          Jornadas
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-[11px] min-h-[32px] py-1"
                        onClick={() =>
                          onOpenCompanion
                            ? onOpenCompanion({ gameId: entry.gameId })
                            : onNavigate('companion')
                        }
                      >
                        Companion
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Active Journeys & Recent Companion Conversations */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>
                <Swords className="w-4 h-4 text-violet-400" aria-hidden="true" />
                <span>Jornadas de Gameplay</span>
              </CardTitle>
              <CardDescription>Campanhas em andamento e progresso salvo</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('journeys')}
            >
              Gerenciar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingData && recentJourneys.length === 0 ? (
              <div className="space-y-2.5">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            ) : recentJourneys.length === 0 ? (
              <div className="py-6 text-center space-y-2.5">
                <p className="text-xs text-slate-400">
                  Nenhuma jornada criada ainda. Crie uma jornada para registrar personagem, área atual e builds.
                </p>
                <Button variant="secondary" size="sm" onClick={() => onNavigate('journeys')}>
                  Ir para Jornadas
                </Button>
              </div>
            ) : (
              recentJourneys.map((journey) => (
                <div
                  key={journey.id}
                  className="p-3.5 rounded-xl bg-[var(--bg-inset)] border border-slate-800/80 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">
                        {journey.name}
                      </span>
                      {journey.isActive && (
                        <Badge variant="success" size="sm">Ativa</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap tabular-nums">
                      {journey.game?.title && <span className="text-slate-300">{journey.game.title}</span>}
                      {journey.currentArea && (
                        <span className="inline-flex items-center gap-1">
                          · <MapPin className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                          {journey.currentArea}
                        </span>
                      )}
                      <span>· {formatHours(journey.playtimeHours)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      onOpenCompanion
                        ? onOpenCompanion({ gameId: journey.gameId, journeyId: journey.id })
                        : onNavigate('journeys')
                    }
                  >
                    Companion
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>
                <Bot className="w-4 h-4 text-blue-400" aria-hidden="true" />
                <span>Conversas no Game Companion</span>
              </CardTitle>
              <CardDescription>Histórico recente com filtro anti-spoiler</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => (onOpenCompanion ? onOpenCompanion() : onNavigate('companion'))}
            >
              Abrir chat
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingData && recentConversations.length === 0 ? (
              <div className="space-y-2.5">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            ) : recentConversations.length === 0 ? (
              <div className="py-6 text-center space-y-2.5">
                <p className="text-xs text-slate-400">
                  Você ainda não iniciou nenhuma conversa com o Game Companion.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => (onOpenCompanion ? onOpenCompanion() : onNavigate('companion'))}
                >
                  Iniciar Conversa
                </Button>
              </div>
            ) : (
              recentConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="p-3.5 rounded-xl bg-[var(--bg-inset)] border border-slate-800/80 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-violet-400 shrink-0" aria-hidden="true" />
                      <span className="text-sm font-semibold text-white truncate">{conv.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 tabular-nums truncate">
                      {conv.mode === 'LIBRARY' ? 'Biblioteca' : 'Companion'} ·{' '}
                      {getSpoilerLabel(conv.spoilerLevel)} · {conv.messageCount} msg
                      {conv.messageCount === 1 ? '' : 's'} · {formatShortDateBR(conv.updatedAt)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onNavigate('companion')}
                  >
                    Abrir
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
