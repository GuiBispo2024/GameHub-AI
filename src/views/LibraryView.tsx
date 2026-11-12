import React, { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2,
  Clock,
  Trophy,
  Star,
  Search,
  Trash2,
  Edit3,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  BookOpen,
  ArrowUpDown,
  X,
  Plus,
  Compass,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { ApiService } from '../services/api';
import {
  LibraryEntry,
  LibraryPagination,
  LibrarySortOption,
  LibraryStats,
  LibraryStatus,
  NavTab,
  HealthResponse,
} from '../types';

interface LibraryViewProps {
  onNavigate: (tab: NavTab) => void;
  onManageJourneys?: (entry: LibraryEntry) => void;
  health?: HealthResponse | null;
}

const STATUS_META: Record<
  LibraryStatus,
  {
    label: string;
    badgeVariant: 'wishlist' | 'backlog' | 'playing' | 'completed' | 'paused' | 'dropped';
  }
> = {
  PLAYING: { label: 'Jogando', badgeVariant: 'playing' },
  BACKLOG: { label: 'Pretendo jogar', badgeVariant: 'backlog' },
  COMPLETED: { label: 'Concluído', badgeVariant: 'completed' },
  WISHLIST: { label: 'Desejado', badgeVariant: 'wishlist' },
  PAUSED: { label: 'Pausado', badgeVariant: 'paused' },
  DROPPED: { label: 'Abandonado', badgeVariant: 'dropped' },
};

const FILTER_TABS: Array<{ id: 'ALL' | LibraryStatus; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PLAYING', label: 'Jogando' },
  { id: 'BACKLOG', label: 'Pretendo jogar' },
  { id: 'COMPLETED', label: 'Concluídos' },
  { id: 'WISHLIST', label: 'Desejados' },
  { id: 'PAUSED', label: 'Pausados' },
  { id: 'DROPPED', label: 'Abandonados' },
];

const SORT_OPTIONS: Array<{ value: LibrarySortOption; label: string }> = [
  { value: 'recentlyAdded', label: 'Adicionados recentemente' },
  { value: 'recentlyUpdated', label: 'Atualizados recentemente' },
  { value: 'titleAsc', label: 'Título (A–Z)' },
  { value: 'titleDesc', label: 'Título (Z–A)' },
  { value: 'ratingDesc', label: 'Maior nota pessoal' },
  { value: 'hoursPlayedDesc', label: 'Mais horas jogadas' },
];

export function LibraryView({ onNavigate, onManageJourneys }: LibraryViewProps) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [pagination, setPagination] = useState<LibraryPagination | null>(null);

  const [activeStatus, setActiveStatus] = useState<'ALL' | LibraryStatus>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<LibrarySortOption>('recentlyAdded');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Edit / Details Modal state
  const [editingEntry, setEditingEntry] = useState<LibraryEntry | null>(null);
  const [editStatus, setEditStatus] = useState<LibraryStatus>('BACKLOG');
  const [editRating, setEditRating] = useState<string>('');
  const [editHours, setEditHours] = useState<string>('0');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation modal state
  const [deletingEntry, setDeletingEntry] = useState<LibraryEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteHasJourneys, setDeleteHasJourneys] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Clear temporary feedback banner
  useEffect(() => {
    if (!feedbackMessage) return;
    const t = setTimeout(() => setFeedbackMessage(null), 4000);
    return () => clearTimeout(t);
  }, [feedbackMessage]);

  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const data = await ApiService.getLibraryStats();
      setStats(data);
    } catch {
      // Non-blocking: main library fetch handles error reporting
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  const fetchLibrary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiService.getLibrary({
        status: activeStatus === 'ALL' ? undefined : activeStatus,
        search: debouncedSearch || undefined,
        sort: sortBy,
        page,
        limit: 12,
      });
      setEntries(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      if (err.status === 401) {
        onNavigate('auth');
        return;
      }
      setError(err.message || 'Erro ao carregar sua biblioteca.');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeStatus, debouncedSearch, sortBy, page, onNavigate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const openEditModal = (entry: LibraryEntry) => {
    setEditingEntry(entry);
    setEditStatus(entry.status);
    setEditRating(entry.rating !== null && entry.rating !== undefined ? String(entry.rating) : '');
    setEditHours(String(entry.hoursPlayed ?? 0));
    setEditNotes(entry.notes || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setEditError(null);

    let parsedRating: number | null = null;
    if (editRating.trim() !== '') {
      const num = Number(editRating);
      if (!Number.isInteger(num) || num < 0 || num > 10) {
        setEditError('A nota pessoal deve ser um número inteiro de 0 a 10.');
        return;
      }
      parsedRating = num;
    }

    const parsedHours = Number(editHours);
    if (isNaN(parsedHours) || parsedHours < 0) {
      setEditError('As horas jogadas devem ser um número maior ou igual a zero.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await ApiService.updateLibraryEntry(editingEntry.id, {
        status: editStatus,
        rating: parsedRating,
        hoursPlayed: parsedHours,
        notes: editNotes.trim() === '' ? null : editNotes.trim(),
      });

      setEntries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingEntry(null);
      setFeedbackMessage(`"${updated.game.title}" atualizado na sua biblioteca.`);
      await Promise.all([fetchStats(), fetchLibrary()]);
    } catch (err: any) {
      setEditError(err.message || 'Não foi possível salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatusChange = async (entry: LibraryEntry, newStatus: LibraryStatus) => {
    if (entry.status === newStatus) return;
    try {
      const updated = await ApiService.updateLibraryEntry(entry.id, { status: newStatus });
      setEntries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setFeedbackMessage(`Status de "${updated.game.title}" alterado para ${STATUS_META[newStatus].label}.`);
      await Promise.all([fetchStats(), fetchLibrary()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEntry) return;
    setDeleteError(null);
    setDeleteHasJourneys(false);
    setIsDeleting(true);

    try {
      await ApiService.removeFromLibrary(deletingEntry.id);
      const removedTitle = deletingEntry.game.title;
      setDeletingEntry(null);
      setFeedbackMessage(`"${removedTitle}" removido da sua biblioteca pessoal.`);
      await Promise.all([fetchStats(), fetchLibrary()]);
    } catch (err: any) {
      if (err.status === 409 || err.code === 'HAS_DEPENDENT_JOURNEYS') {
        setDeleteHasJourneys(true);
      }
      setDeleteError(err.message || 'Erro ao remover jogo da biblioteca.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Minha Biblioteca</h1>
          <p className="text-xs text-slate-400 mt-1">
            Gerencie seus jogos, acompanhe horas jogadas, notas pessoais e anotações de campanha.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => onNavigate('explore')}
          >
            Explorar Catálogo
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Real Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-950/80 flex items-center justify-center text-violet-400 border border-violet-800/60 shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Total de Jogos</div>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <div className="text-xl font-bold text-white tabular-nums">
                {stats?.totalGames ?? 0}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950/80 flex items-center justify-center text-blue-400 border border-blue-800/60 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Horas Jogadas</div>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <div className="text-xl font-bold text-blue-300 tabular-nums">
                {stats?.totalHoursPlayed ?? 0}h
              </div>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-950/80 flex items-center justify-center text-indigo-400 border border-indigo-800/60 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Jogos Concluídos</div>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-14 mt-1" />
            ) : (
              <div className="text-xl font-bold text-indigo-300 tabular-nums">
                {stats?.completedCount ?? 0}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-950/80 flex items-center justify-center text-amber-400 border border-amber-800/60 shrink-0">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Nota Média</div>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <div className="text-xl font-bold text-amber-300 tabular-nums">
                {stats?.averageRating !== null && stats?.averageRating !== undefined
                  ? `${stats.averageRating}/10`
                  : '—'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Pesquisar na sua biblioteca por título..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="text-slate-400 hover:text-white p-0.5"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as LibrarySortOption);
                setPage(1);
              }}
              aria-label="Ordenar biblioteca"
              className="bg-slate-950 text-slate-200 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => {
            const isActive = activeStatus === tab.id;
            const count =
              tab.id === 'ALL'
                ? stats?.totalGames
                : stats?.byStatus?.[tab.id as LibraryStatus];

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveStatus(tab.id);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-900/40'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                {count !== undefined && (
                  <span
                    className={`text-[11px] tabular-nums ${
                      isActive ? 'text-violet-200' : 'text-slate-500'
                    }`}
                  >
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-rose-200">Erro ao carregar biblioteca</h3>
              <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLibrary}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex gap-4 h-44"
            >
              <Skeleton className="w-28 h-full rounded-xl shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full mt-auto" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && entries.length === 0 && (
        <div className="py-16 text-center rounded-2xl bg-slate-900/50 border border-slate-800 p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-white">
              {activeStatus === 'ALL' && !debouncedSearch
                ? 'Sua biblioteca ainda está vazia'
                : 'Nenhum jogo corresponde aos filtros atuais'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {activeStatus === 'ALL' && !debouncedSearch
                ? 'Explore o catálogo oficial da IGDB e adicione seus títulos favoritos para acompanhar seu progresso e avaliações.'
                : 'Tente limpar a busca ou selecionar outro filtro de status para visualizar seus jogos.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            {(activeStatus !== 'ALL' || debouncedSearch) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActiveStatus('ALL');
                  setSearchInput('');
                }}
              >
                Limpar filtros
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => onNavigate('explore')}
            >
              Explorar Catálogo
            </Button>
          </div>
        </div>
      )}

      {/* Library Entries Grid */}
      {!isLoading && !error && entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map((entry) => {
            const statusInfo = STATUS_META[entry.status] || STATUS_META.BACKLOG;
            return (
              <Card
                key={entry.id}
                glow="violet"
                className="flex flex-col bg-slate-900/80 border-slate-800 overflow-hidden hover:border-violet-500/40 transition-colors"
              >
                <div className="flex gap-4 p-4 flex-1">
                  {/* Cover Thumbnail */}
                  <div
                    onClick={() => openEditModal(entry)}
                    className="w-24 sm:w-28 aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 cursor-pointer group"
                  >
                    {entry.game.coverUrl ? (
                      <img
                        src={entry.game.coverUrl}
                        alt={entry.game.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-slate-600 text-center">
                        <Gamepad2 className="w-7 h-7 mb-1" />
                        <span className="text-[10px]">Sem capa</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata & Controls */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant={statusInfo.badgeVariant} size="sm">
                          {statusInfo.label}
                        </Badge>
                        {entry.rating !== null && (
                          <span className="flex items-center gap-1 text-xs font-bold text-amber-300 tabular-nums shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                            {entry.rating}/10
                          </span>
                        )}
                      </div>

                      <h3
                        onClick={() => openEditModal(entry)}
                        className="font-bold text-sm text-white hover:text-violet-300 transition-colors line-clamp-2 cursor-pointer"
                      >
                        {entry.game.title}
                      </h3>

                      <div className="text-[11px] text-slate-400 truncate">
                        {entry.game.platforms.slice(0, 2).join(' · ') || 'Plataforma não listada'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300 tabular-nums">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>{entry.hoursPlayed}h jogadas</span>
                        </span>
                      </div>

                      {entry.notes && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 italic">
                          &ldquo;{entry.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800/80 space-y-2.5">
                  {onManageJourneys && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs"
                      leftIcon={<Compass className="w-3.5 h-3.5" />}
                      onClick={() => onManageJourneys(entry)}
                    >
                      Gerenciar Jornadas
                    </Button>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <select
                      value={entry.status}
                      onChange={(e) =>
                        handleQuickStatusChange(entry, e.target.value as LibraryStatus)
                      }
                      aria-label={`Alterar status de ${entry.game.title}`}
                      className="bg-slate-900 text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-violet-500 flex-1 min-w-[120px]"
                    >
                      {Object.entries(STATUS_META).map(([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs px-2.5 py-1.5"
                        leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                        onClick={() => openEditModal(entry)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:border-rose-500/50"
                        title="Remover da biblioteca"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteHasJourneys(false);
                          setDeletingEntry(entry);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasPrevPage}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-slate-400 tabular-nums">
            Página <strong className="text-white">{pagination.page}</strong> de{' '}
            <strong className="text-white">{pagination.totalPages}</strong> ({pagination.total} jogos)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Edit / Details Modal */}
      <Modal
        isOpen={!!editingEntry}
        onClose={() => !isSaving && setEditingEntry(null)}
        title={editingEntry?.game.title}
        description={
          editingEntry
            ? `${editingEntry.game.developer || 'Estúdio não informado'} · ${
                editingEntry.game.genres.slice(0, 3).join(' · ') || 'Sem gênero'
              }`
            : undefined
        }
        maxWidth="lg"
      >
        {editingEntry && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="flex gap-4 items-start">
              {editingEntry.game.coverUrl && (
                <img
                  src={editingEntry.game.coverUrl}
                  alt={editingEntry.game.title}
                  referrerPolicy="no-referrer"
                  className="w-20 aspect-[3/4] rounded-xl object-cover border border-slate-800 shrink-0"
                />
              )}
              <div className="text-xs text-slate-300 space-y-1.5 flex-1">
                <p className="line-clamp-3 leading-relaxed text-slate-400">
                  {editingEntry.game.summary || 'Sem sinopse cadastrada.'}
                </p>
                <div className="text-[11px] text-slate-500">
                  Plataformas: {editingEntry.game.platforms.join(', ') || 'Não informadas'}
                </div>
              </div>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as LibraryStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  {Object.entries(STATUS_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nota Pessoal (0 a 10)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  value={editRating}
                  onChange={(e) => setEditRating(e.target.value)}
                  placeholder="Sem nota"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Horas Jogadas
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 tabular-nums"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">Anotações Pessoais</label>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {editNotes.length}/2000
                </span>
              </div>
              <textarea
                rows={4}
                maxLength={2000}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Registre metas, builds, chefes derrotados ou lembretes para sua próxima sessão..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
              <span>
                Adicionado em {new Date(editingEntry.createdAt).toLocaleDateString('pt-BR')}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {onManageJourneys && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Compass className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const target = editingEntry;
                      setEditingEntry(null);
                      onManageJourneys(target);
                    }}
                  >
                    Gerenciar Jornadas
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => setEditingEntry(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingEntry}
        onClose={() => !isDeleting && setDeletingEntry(null)}
        title="Remover da Biblioteca"
        description="Esta ação remove apenas o jogo da sua coleção pessoal."
        maxWidth="sm"
      >
        {deletingEntry && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Tem certeza que deseja remover{' '}
              <strong className="text-white">{deletingEntry.game.title}</strong> da sua biblioteca?
              Suas anotações pessoais e horas registradas para este jogo serão apagadas.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 space-y-2">
                <p>{deleteError}</p>
                {deleteHasJourneys && onManageJourneys && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Compass className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const target = deletingEntry;
                      setDeletingEntry(null);
                      onManageJourneys(target);
                    }}
                  >
                    Gerenciar Jornadas deste Jogo
                  </Button>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setDeletingEntry(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isDeleting}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={handleConfirmDelete}
              >
                Confirmar Remoção
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
