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
  BookOpen,
  ArrowUpDown,
  X,
  Plus,
  Compass,
  LayoutGrid,
  List,
  Heart,
  Bot,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Skeleton } from '../components/ui/Skeleton';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/ui/PageHeader';
import { GameCover } from '../components/ui/GameCover';
import { useToast } from '../components/ui/Toast';
import { ApiService } from '../services/api';
import {
  LibraryEntry,
  LibraryPagination,
  LibrarySortOption,
  LibraryStats,
  LibraryStatus,
  NavTab,
} from '../types';
import { LIBRARY_STATUS_META, formatHours, formatShortDateBR } from '../utils/formatters';

interface LibraryViewProps {
  onNavigate: (tab: NavTab) => void;
  onManageJourneys?: (entry: LibraryEntry) => void;
  onOpenCompanion?: (context?: { gameId?: string | null; journeyId?: string | null }) => void;
}

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

export function LibraryView({
  onNavigate,
  onManageJourneys,
  onOpenCompanion,
}: LibraryViewProps) {
  const { showToast } = useToast();

  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [pagination, setPagination] = useState<LibraryPagination | null>(null);

  const [activeStatus, setActiveStatus] = useState<'ALL' | LibraryStatus>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<LibrarySortOption>('recentlyAdded');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingEntry, setEditingEntry] = useState<LibraryEntry | null>(null);
  const [editStatus, setEditStatus] = useState<LibraryStatus>('BACKLOG');
  const [editRating, setEditRating] = useState<string>('');
  const [editHours, setEditHours] = useState<string>('0');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingEntry, setDeletingEntry] = useState<LibraryEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteHasJourneys, setDeleteHasJourneys] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const data = await ApiService.getLibraryStats();
      setStats(data);
    } catch {
      // Non-blocking
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
      setEntries((res.data || []).filter((e) => Boolean(e && e.id)));
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
      setEditError('As horas jogadas devem ser maiores ou iguais a zero.');
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
      showToast({
        variant: 'success',
        message: `"${updated.game.title}" atualizado na biblioteca.`,
      });
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
      showToast({
        variant: 'success',
        message: `Status de "${updated.game.title}" alterado para ${LIBRARY_STATUS_META[newStatus].label}.`,
      });
      await Promise.all([fetchStats(), fetchLibrary()]);
    } catch (err: any) {
      showToast({
        variant: 'error',
        message: err.message || 'Erro ao alterar status.',
      });
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
      showToast({
        variant: 'success',
        message: `"${removedTitle}" removido da biblioteca.`,
      });
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

  const tabItems = FILTER_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    count: tab.id === 'ALL' ? stats?.totalGames : stats?.byStatus?.[tab.id as LibraryStatus],
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Minha Biblioteca"
        subtitle="Gerencie sua coleção pessoal, horas jogadas, notas e acesso rápido às jornadas."
        actions={
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

      {/* Real Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-950/80 border border-violet-500/30 flex items-center justify-center text-violet-300 shrink-0">
            <Gamepad2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Total de Jogos</div>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-14 mt-1" />
            ) : (
              <div className="text-xl font-bold text-white tabular-nums">{stats?.totalGames ?? 0}</div>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-300 shrink-0">
            <Clock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Horas Jogadas</div>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <div className="text-xl font-bold text-blue-300 tabular-nums">
                {formatHours(stats?.totalHoursPlayed)}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
            <Trophy className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Concluídos</div>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-12 mt-1" />
            ) : (
              <div className="text-xl font-bold text-indigo-300 tabular-nums">
                {stats?.completedCount ?? 0}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
            <Star className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Nota Média</div>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-14 mt-1" />
            ) : (
              <div className="text-xl font-bold text-amber-300 tabular-nums">
                {stats?.averageRating !== null && stats?.averageRating !== undefined
                  ? `${stats.averageRating}/10`
                  : '—'}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 px-3.5 min-h-[42px] rounded-xl bg-[var(--bg-inset)] border border-slate-700/80 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-500/20">
            <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Pesquisar jogos na biblioteca"
              placeholder="Pesquisar na biblioteca por título..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                aria-label="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" aria-hidden="true" />
              <Select
                aria-label="Ordenar biblioteca"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as LibrarySortOption);
                  setPage(1);
                }}
                className="text-xs sm:w-52"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Grid / List View Switcher */}
            <div
              className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-inset)] border border-slate-800 shrink-0"
              role="group"
              aria-label="Modo de exibição"
            >
              <button
                type="button"
                aria-pressed={viewMode === 'grid'}
                aria-label="Visualização em grade"
                onClick={() => setViewMode('grid')}
                className={`p-2 min-w-[36px] min-h-[34px] inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'list'}
                aria-label="Visualização em lista"
                onClick={() => setViewMode('list')}
                className={`p-2 min-w-[36px] min-h-[34px] inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <Tabs
          items={tabItems}
          activeId={activeStatus}
          ariaLabel="Filtrar biblioteca por status"
          onChange={(next) => {
            setActiveStatus(next);
            setPage(1);
          }}
        />
      </Card>

      {error && (
        <ErrorState
          title="Erro ao carregar biblioteca"
          message={error}
          onRetry={fetchLibrary}
        />
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl bg-[var(--bg-surface)] border border-slate-800 p-4 flex gap-4 h-44">
              <Skeleton className="w-24 h-full rounded-xl shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <EmptyState
          icon={<BookOpen className="w-7 h-7" />}
          title={
            activeStatus === 'ALL' && !debouncedSearch
              ? 'Sua biblioteca ainda está vazia'
              : 'Nenhum jogo corresponde aos filtros atuais'
          }
          description={
            activeStatus === 'ALL' && !debouncedSearch
              ? 'Explore o catálogo oficial da IGDB e adicione seus títulos favoritos para acompanhar progresso e avaliações.'
              : 'Limpe a busca ou selecione outro status para visualizar os jogos da sua coleção.'
          }
          secondaryAction={
            activeStatus !== 'ALL' || debouncedSearch ? (
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
            ) : undefined
          }
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
      )}

      {!isLoading && !error && entries.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map((entry) => {
            const statusInfo = LIBRARY_STATUS_META[entry.status] || LIBRARY_STATUS_META.BACKLOG;
            return (
              <Card key={entry.id} glow="violet" className="flex flex-col">
                <div className="flex gap-4 p-4 flex-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(entry)}
                    className="w-24 aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 cursor-pointer group focus-visible:outline-none"
                    aria-label={`Editar detalhes de ${entry.game.title}`}
                  >
                    <GameCover
                      src={entry.game.coverUrl}
                      alt={entry.game.title}
                      className="w-full h-full"
                      imgClassName="group-hover:scale-105 transition-transform duration-200"
                      fallbackLabel="Sem capa"
                      iconSize="sm"
                    />
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={statusInfo.badgeVariant} size="sm">
                            {statusInfo.label}
                          </Badge>
                          {entry.isFavorite && (
                            <span
                              className="inline-flex items-center text-rose-400"
                              title="Favorito"
                              aria-label="Jogo favorito"
                            >
                              <Heart className="w-3.5 h-3.5 fill-rose-400" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        {entry.rating !== null && (
                          <span className="flex items-center gap-1 text-xs font-bold text-amber-300 tabular-nums shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" aria-hidden="true" />
                            {entry.rating}/10
                          </span>
                        )}
                      </div>

                      <h2 className="font-bold text-sm text-white line-clamp-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(entry)}
                          className="text-left hover:text-violet-300 transition-colors cursor-pointer"
                        >
                          {entry.game.title}
                        </button>
                      </h2>

                      <div className="text-[11px] text-slate-400 truncate">
                        {entry.game.platforms.slice(0, 2).join(' · ') || 'Plataforma não listada'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300 tabular-nums">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                          <span>{formatHours(entry.hoursPlayed)} jogadas</span>
                        </span>
                        {entry.progressPercentage > 0 && (
                          <span className="text-[11px] font-semibold text-violet-300">
                            {entry.progressPercentage}%
                          </span>
                        )}
                      </div>

                      {entry.progressPercentage > 0 && (
                        <div
                          className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={entry.progressPercentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Progresso de ${entry.game.title}`}
                        >
                          <div
                            className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, entry.progressPercentage)}%` }}
                          />
                        </div>
                      )}

                      {entry.notes && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 italic">
                          &ldquo;{entry.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 bg-[var(--bg-inset)]/80 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center gap-2">
                    {onManageJourneys && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 text-xs"
                        leftIcon={<Compass className="w-3.5 h-3.5" />}
                        onClick={() => onManageJourneys(entry)}
                      >
                        Jornadas
                      </Button>
                    )}
                    {onOpenCompanion && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs px-3"
                        leftIcon={<Bot className="w-3.5 h-3.5" />}
                        onClick={() => onOpenCompanion({ gameId: entry.gameId })}
                        title="Perguntar ao Game Companion"
                      >
                        IA
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <select
                      value={entry.status}
                      onChange={(e) =>
                        handleQuickStatusChange(entry, e.target.value as LibraryStatus)
                      }
                      aria-label={`Alterar status de ${entry.game.title}`}
                      className="bg-slate-900 text-slate-200 border border-slate-700/80 rounded-lg px-2.5 py-2 min-h-[36px] text-xs focus:outline-none focus:border-violet-400 flex-1 min-w-[120px]"
                    >
                      {Object.entries(LIBRARY_STATUS_META).map(([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs px-2.5"
                        leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                        onClick={() => openEditModal(entry)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="px-2.5 text-rose-300 hover:text-rose-200 hover:border-rose-500/50"
                        aria-label={`Remover ${entry.game.title} da biblioteca`}
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

      {/* List View Mode */}
      {!isLoading && !error && entries.length > 0 && viewMode === 'list' && (
        <div className="space-y-3">
          {entries.map((entry) => {
            const statusInfo = LIBRARY_STATUS_META[entry.status] || LIBRARY_STATUS_META.BACKLOG;
            return (
              <Card
                key={entry.id}
                glow="violet"
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(entry)}
                    className="w-14 aspect-[3/4] rounded-lg overflow-hidden border border-slate-800 shrink-0 cursor-pointer"
                    aria-label={`Editar ${entry.game.title}`}
                  >
                    <GameCover
                      src={entry.game.coverUrl}
                      alt={entry.game.title}
                      className="w-full h-full"
                      iconSize="sm"
                    />
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-white truncate">{entry.game.title}</h2>
                      <Badge variant={statusInfo.badgeVariant} size="sm">
                        {statusInfo.label}
                      </Badge>
                      {entry.isFavorite && (
                        <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400 shrink-0" aria-label="Favorito" />
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap tabular-nums">
                      <span>{formatHours(entry.hoursPlayed)} jogadas</span>
                      {entry.rating !== null && <span>· Nota {entry.rating}/10</span>}
                      {entry.progressPercentage > 0 && <span>· {entry.progressPercentage}%</span>}
                      {entry.game.platforms.length > 0 && (
                        <span className="truncate">· {entry.game.platforms.slice(0, 2).join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onManageJourneys && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Compass className="w-3.5 h-3.5" />}
                      onClick={() => onManageJourneys(entry)}
                    >
                      Jornadas
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                    onClick={() => openEditModal(entry)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-2.5 text-rose-300 hover:border-rose-500/50"
                    aria-label={`Remover ${entry.game.title}`}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteHasJourneys(false);
                      setDeletingEntry(entry);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

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

      {/* Edit Modal */}
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
              <GameCover
                src={editingEntry.game.coverUrl}
                alt={editingEntry.game.title}
                className="w-20 aspect-[3/4] rounded-xl border border-slate-800 shrink-0"
                iconSize="sm"
              />
              <div className="text-xs text-slate-300 space-y-1.5 flex-1 min-w-0">
                <p className="line-clamp-3 leading-relaxed text-slate-300">
                  {editingEntry.game.summary || 'Sem sinopse cadastrada.'}
                </p>
                <div className="text-[11px] text-slate-400">
                  Plataformas: {editingEntry.game.platforms.join(', ') || 'Não informadas'}
                </div>
              </div>
            </div>

            {editError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as LibraryStatus)}
              >
                {Object.entries(LIBRARY_STATUS_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Nota Pessoal (0 a 10)"
                type="number"
                min={0}
                max={10}
                step={1}
                value={editRating}
                onChange={(e) => setEditRating(e.target.value)}
                placeholder="Sem nota"
                className="tabular-nums"
              />

              <Input
                label="Horas Jogadas"
                type="number"
                min={0}
                step={0.5}
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
                className="tabular-nums"
              />
            </div>

            <Textarea
              label="Anotações Pessoais"
              rows={4}
              maxLength={2000}
              showCount
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Registre metas, lembretes ou impressões sobre o jogo..."
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
              <span className="tabular-nums">
                Adicionado em {formatShortDateBR(editingEntry.createdAt)}
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleConfirmDelete}
        title="Remover da Biblioteca"
        description="Esta ação remove o jogo e suas anotações da sua coleção pessoal."
        message={
          deletingEntry ? (
            <>
              Tem certeza que deseja remover{' '}
              <strong className="text-white">{deletingEntry.game.title}</strong> da sua biblioteca?
            </>
          ) : null
        }
        confirmLabel="Confirmar Remoção"
        isLoading={isDeleting}
        error={deleteError}
        extraContent={
          deleteHasJourneys && onManageJourneys && deletingEntry ? (
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
          ) : undefined
        }
      />
    </div>
  );
}
