import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Gamepad2,
  Star,
  Plus,
  Bot,
  Sparkles,
  AlertCircle,
  X,
  Filter,
  Check,
  Library,
  Lock,
  ArrowRight,
  ArrowUpDown,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { Select } from '../components/ui/Select';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/ui/PageHeader';
import { GameCover } from '../components/ui/GameCover';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api';
import { GameItem, LibraryEntry, LibraryStatus, NavTab } from '../types';
import { LIBRARY_STATUS_META, formatFullDateBR, formatReleaseYear } from '../utils/formatters';

interface ExploreViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenCompanion?: (context?: { gameId?: string | null; journeyId?: string | null }) => void;
}

type ExploreSortOption = 'relevance' | 'ratingDesc' | 'releaseDesc' | 'titleAsc';

const LIBRARY_STATUS_OPTIONS: Array<{ value: LibraryStatus; label: string; description: string }> = [
  { value: 'BACKLOG', label: 'Pretendo jogar', description: 'Salvar na fila para jogar em breve' },
  { value: 'PLAYING', label: 'Jogando', description: 'Em andamento no momento' },
  { value: 'WISHLIST', label: 'Desejado', description: 'Lista de desejos / interesse futuro' },
  { value: 'COMPLETED', label: 'Concluído', description: 'Campanha finalizada ou zerado' },
  { value: 'PAUSED', label: 'Pausado', description: 'Interrompido temporariamente' },
  { value: 'DROPPED', label: 'Abandonado', description: 'Não pretende continuar' },
];

export function ExploreView({ onNavigate, onOpenCompanion }: ExploreViewProps) {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('Elden Ring');
  const [debouncedSearch, setDebouncedSearch] = useState('Elden Ring');
  const [selectedGenre, setSelectedGenre] = useState<string>('Todos');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('Todas');
  const [sortBy, setSortBy] = useState<ExploreSortOption>('relevance');
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);

  const [libraryMap, setLibraryMap] = useState<Record<string, LibraryEntry>>({});
  const [addingGame, setAddingGame] = useState<GameItem | null>(null);
  const [chosenStatus, setChosenStatus] = useState<LibraryStatus>('BACKLOG');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [loginPromptGame, setLoginPromptGame] = useState<GameItem | null>(null);

  const [genresList, setGenresList] = useState<string[]>([
    'Todos',
    'Role-playing (RPG)',
    'Adventure',
    'Shooter',
    'Action',
    'Strategy',
    "Hack and slash/Beat 'em up",
    'Platform',
  ]);
  const [platformsList, setPlatformsList] = useState<string[]>([
    'Todas',
    'PC (Microsoft Windows)',
    'PlayStation 5',
    'Xbox Series X|S',
    'Nintendo Switch',
    'PlayStation 4',
  ]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadUserLibraryIndex = useCallback(async () => {
    if (!isAuthenticated) {
      setLibraryMap({});
      return;
    }

    try {
      const res = await ApiService.getLibrary({ limit: 100 });
      const map: Record<string, LibraryEntry> = {};
      for (const entry of res.data) {
        map[entry.gameId] = entry;
      }
      setLibraryMap(map);
    } catch {
      // Non-blocking preload
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadUserLibraryIndex();
  }, [loadUserLibraryIndex]);

  useEffect(() => {
    async function loadFilters() {
      try {
        const [genresRes, platformsRes] = await Promise.allSettled([
          fetch('/api/games/genres'),
          fetch('/api/games/platforms'),
        ]);

        if (genresRes.status === 'fulfilled' && genresRes.value.ok) {
          const json = await genresRes.value.json();
          if (json.data && Array.isArray(json.data)) {
            const names = json.data.map((g: any) => g.name);
            setGenresList(['Todos', ...names.slice(0, 15)]);
          }
        }

        if (platformsRes.status === 'fulfilled' && platformsRes.value.ok) {
          const json = await platformsRes.value.json();
          if (json.data && Array.isArray(json.data)) {
            const names = json.data.map((p: any) => p.name);
            setPlatformsList(['Todas', ...names.slice(0, 12)]);
          }
        }
      } catch {
        // Fallback to default filters
      }
    }

    loadFilters();
  }, []);

  const fetchGames = useCallback(async () => {
    const queryToSearch = debouncedSearch || 'Elden Ring';
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        query: queryToSearch,
        page: page.toString(),
        limit: '20',
      });

      if (selectedGenre !== 'Todos') {
        params.append('genre', selectedGenre);
      }
      if (selectedPlatform !== 'Todas') {
        params.append('platform', selectedPlatform);
      }

      const res = await fetch(`/api/games/search?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Erro ${res.status} ao carregar catálogo`);
      }

      const data = await res.json();
      setGames(data.data || []);
      setHasNextPage(Boolean(data.pagination?.hasNextPage));
    } catch (err: any) {
      setError(err.message || 'Falha ao buscar catálogo de jogos.');
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedGenre, selectedPlatform, page]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const sortedGames = useMemo(() => {
    if (sortBy === 'relevance') return games;
    const copy = [...games];
    if (sortBy === 'ratingDesc') {
      copy.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    } else if (sortBy === 'releaseDesc') {
      copy.sort((a, b) => {
        const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return db - da;
      });
    } else if (sortBy === 'titleAsc') {
      copy.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    }
    return copy;
  }, [games, sortBy]);

  const handleRequestAddToLibrary = (game: GameItem) => {
    if (!isAuthenticated) {
      setLoginPromptGame(game);
      return;
    }

    if (!game.id) {
      showToast({
        variant: 'error',
        message: 'Este jogo ainda não possui identificador persistido no catálogo local.',
      });
      return;
    }

    if (libraryMap[game.id]) {
      onNavigate('library');
      return;
    }

    setChosenStatus('BACKLOG');
    setAddError(null);
    setAddingGame(game);
  };

  const handleConfirmAddToLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingGame?.id) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const entry = await ApiService.addToLibrary({
        gameId: addingGame.id,
        status: chosenStatus,
      });

      setLibraryMap((prev) => ({
        ...prev,
        [entry.gameId]: entry,
      }));
      const statusLabel = LIBRARY_STATUS_META[chosenStatus].label;
      showToast({
        variant: 'success',
        message: `"${addingGame.title}" adicionado à biblioteca como "${statusLabel}".`,
      });
      setAddingGame(null);
    } catch (err: any) {
      if (err.status === 401) {
        setAddingGame(null);
        setLoginPromptGame(addingGame);
        return;
      }
      if (err.status === 409) {
        await loadUserLibraryIndex();
        setAddError('Este jogo já está cadastrado na sua biblioteca pessoal.');
        return;
      }
      if (err.status === 404) {
        setAddError('Jogo não encontrado no banco de dados. Tente recarregar a pesquisa.');
        return;
      }
      setAddError(err.message || 'Erro inesperado ao salvar na biblioteca.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Explorar Catálogo"
        subtitle="Pesquise jogos na base global da IGDB, confira detalhes e adicione à sua coleção."
        actions={
          isAuthenticated ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Library className="w-4 h-4" />}
              onClick={() => onNavigate('library')}
            >
              Minha Biblioteca ({Object.keys(libraryMap).length})
            </Button>
          ) : undefined
        }
      />

      {/* Search, Platform & Sort Toolbar */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-6 flex items-center gap-2 px-3.5 min-h-[42px] rounded-xl bg-[var(--bg-inset)] border border-slate-700/80 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-500/20">
            <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Pesquisar jogos por título"
              placeholder="Pesquisar por título (ex: Elden Ring, Baldur's Gate, Hades)..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <Select
              aria-label="Filtrar por plataforma"
              value={selectedPlatform}
              onChange={(e) => {
                setSelectedPlatform(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            >
              {platformsList.map((plat) => (
                <option key={plat} value={plat}>
                  {plat === 'Todas' ? 'Todas as plataformas' : plat}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" aria-hidden="true" />
            <Select
              aria-label="Ordenar resultados"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ExploreSortOption)}
              className="text-xs"
            >
              <option value="relevance">Relevância</option>
              <option value="ratingDesc">Maior nota IGDB</option>
              <option value="releaseDesc">Mais recentes</option>
              <option value="titleAsc">Título (A–Z)</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Filtrar por gênero">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
            Gênero:
          </span>
          {genresList.map((genre) => {
            const active = selectedGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedGenre(genre);
                  setPage(1);
                }}
                className={`px-3 py-1.5 min-h-[34px] rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer shrink-0 ${
                  active
                    ? 'bg-violet-600 text-white border-violet-500'
                    : 'bg-[var(--bg-inset)] text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </Card>

      {error && (
        <ErrorState
          title="Não foi possível carregar os jogos"
          message={error}
          onRetry={fetchGames}
        />
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl bg-[var(--bg-surface)] border border-slate-800 overflow-hidden flex flex-col h-[380px] p-4 space-y-3">
              <Skeleton className="w-full h-44 rounded-xl" />
              <Skeleton className="w-3/4 h-5" />
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-full h-9 mt-auto rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && sortedGames.length === 0 && (
        <EmptyState
          icon={<Gamepad2 className="w-7 h-7" />}
          title="Nenhum jogo encontrado"
          description={`Não encontramos nenhum título para "${debouncedSearch}"${
            selectedGenre !== 'Todos' ? ` no gênero ${selectedGenre}` : ''
          }. Tente ajustar os filtros.`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchTerm('Final Fantasy');
                setSelectedGenre('Todos');
                setSelectedPlatform('Todas');
              }}
            >
              Ver títulos populares
            </Button>
          }
        />
      )}

      {!loading && !error && sortedGames.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {sortedGames.map((game) => {
            const libraryEntry = game.id ? libraryMap[game.id] : undefined;

            return (
              <Card
                key={game.igdbId}
                glow="violet"
                className="group flex flex-col h-full"
              >
                <button
                  type="button"
                  onClick={() => setSelectedGame(game)}
                  className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950 text-left cursor-pointer focus-visible:outline-none"
                  aria-label={`Ver detalhes de ${game.title}`}
                >
                  <GameCover
                    src={game.coverUrl}
                    alt={game.title}
                    className="w-full h-full"
                    imgClassName="group-hover:scale-105 transition-transform duration-300"
                    fallbackLabel="Sem capa oficial"
                    iconSize="lg"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90 pointer-events-none" />

                  {libraryEntry && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="success" size="sm">
                        <Check className="w-3 h-3" aria-hidden="true" />
                        Na biblioteca
                      </Badge>
                    </div>
                  )}

                  {game.rating !== null && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-950/90 text-amber-300 border border-amber-500/35 tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" aria-hidden="true" />
                        {Math.round(game.rating)}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11px] text-slate-300 font-medium">
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/85 border border-slate-800 tabular-nums">
                      {formatReleaseYear(game.releaseDate)}
                    </span>
                    {game.developer && (
                      <span className="truncate max-w-[140px] text-slate-300 font-semibold">
                        {game.developer}
                      </span>
                    )}
                  </div>
                </button>

                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h2 className="font-bold text-sm text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                      {game.title}
                    </h2>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {game.summary || 'Sinopse não cadastrada no catálogo da IGDB.'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2.5 border-t border-slate-800/80">
                    <div className="text-[11px] text-slate-400 truncate">
                      {[...game.genres.slice(0, 2), ...game.platforms.slice(0, 2)].join(' · ') || 'Catálogo IGDB'}
                    </div>

                    <div className="flex items-center gap-2">
                      {libraryEntry ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                          leftIcon={<Check className="w-3.5 h-3.5" />}
                          onClick={() => onNavigate('library')}
                        >
                          {LIBRARY_STATUS_META[libraryEntry.status].shortLabel}
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 text-xs"
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                          onClick={() => handleRequestAddToLibrary(game)}
                        >
                          Adicionar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2.5 shrink-0"
                        aria-label={`Detalhes de ${game.title}`}
                        title="Ver detalhes"
                        onClick={() => setSelectedGame(game)}
                      >
                        <Sparkles className="w-4 h-4 text-violet-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !error && sortedGames.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Página anterior
          </Button>
          <span className="text-xs text-slate-400 font-medium tabular-nums">
            Página <strong className="text-white">{page}</strong>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima página
          </Button>
        </div>
      )}

      {/* Game Details Modal */}
      <Modal
        isOpen={!!selectedGame}
        onClose={() => setSelectedGame(null)}
        title={selectedGame?.title}
        description={
          selectedGame
            ? `${selectedGame.developer || 'Desenvolvedora não listada'} · Lançamento: ${formatFullDateBR(selectedGame.releaseDate)}`
            : undefined
        }
        maxWidth="lg"
      >
        {selectedGame && (
          <div className="space-y-5">
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
              <GameCover
                src={selectedGame.backdropUrl || selectedGame.coverUrl}
                alt={selectedGame.title}
                className="w-full h-full"
                fallbackLabel="Sem imagem de destaque"
                iconSize="lg"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent pointer-events-none" />
              {selectedGame.rating !== null && (
                <div className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950/90 text-amber-300 border border-amber-500/40 tabular-nums">
                  <Star className="w-4 h-4 fill-amber-300 text-amber-300" aria-hidden="true" />
                  <span className="font-bold text-sm">{Math.round(selectedGame.rating)}</span>
                  <span className="text-[11px] text-amber-300/80">/ 100 IGDB</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sinopse</h4>
              <p className="text-sm text-slate-200 leading-relaxed max-h-48 overflow-y-auto pr-1">
                {selectedGame.summary || 'Nenhuma sinopse disponível no momento.'}
              </p>
            </div>

            {selectedGame.storyline && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Enredo</h4>
                <p className="text-xs text-slate-300 leading-relaxed max-h-36 overflow-y-auto pr-1">
                  {selectedGame.storyline}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--bg-inset)] border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Desenvolvedora</span>
                <span className="text-slate-100 font-semibold">{selectedGame.developer || 'Não informada'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Publicadora</span>
                <span className="text-slate-100 font-semibold">{selectedGame.publisher || 'Não informada'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block mb-0.5">Gêneros</span>
                <span className="text-slate-200">
                  {selectedGame.genres.join(' · ') || 'Não informados'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block mb-0.5">Plataformas</span>
                <span className="text-slate-200">
                  {selectedGame.platforms.join(' · ') || 'Não informadas'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
              {selectedGame.id && libraryMap[selectedGame.id] ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                  leftIcon={<Check className="w-4 h-4" />}
                  onClick={() => {
                    setSelectedGame(null);
                    onNavigate('library');
                  }}
                >
                  Na sua biblioteca · Editar
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    const target = selectedGame;
                    setSelectedGame(null);
                    handleRequestAddToLibrary(target);
                  }}
                >
                  Adicionar à Biblioteca
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Bot className="w-4 h-4" />}
                onClick={() => {
                  const targetGameId = selectedGame.id || null;
                  setSelectedGame(null);
                  if (onOpenCompanion) {
                    onOpenCompanion({ gameId: targetGameId });
                  } else {
                    onNavigate('companion');
                  }
                }}
              >
                Abrir no Game Companion
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add to Library Status Modal */}
      <Modal
        isOpen={!!addingGame}
        onClose={() => !isAdding && setAddingGame(null)}
        title="Adicionar à Biblioteca"
        description={addingGame?.title}
        maxWidth="sm"
      >
        {addingGame && (
          <form onSubmit={handleConfirmAddToLibrary} className="space-y-4">
            <p className="text-xs text-slate-400">
              Escolha o status inicial para acompanhar este jogo na sua coleção:
            </p>

            {addError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                <span>{addError}</span>
              </div>
            )}

            <div className="space-y-2">
              {LIBRARY_STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    chosenStatus === opt.value
                      ? 'bg-violet-950/50 border-violet-400 text-white'
                      : 'bg-[var(--bg-inset)] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="libraryStatus"
                    value={opt.value}
                    checked={chosenStatus === opt.value}
                    onChange={() => setChosenStatus(opt.value)}
                    className="mt-0.5 accent-violet-500"
                  />
                  <div>
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[11px] text-slate-400">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isAdding}
                onClick={() => setAddingGame(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isAdding}>
                Confirmar Inclusão
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Auth Prompt Modal */}
      <Modal
        isOpen={!!loginPromptGame}
        onClose={() => setLoginPromptGame(null)}
        title="Autenticação Necessária"
        description="Acesse sua conta para salvar jogos na sua biblioteca pessoal."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--bg-inset)] border border-slate-800">
            <Lock className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-slate-300 leading-relaxed">
              Para adicionar <strong className="text-white">{loginPromptGame?.title}</strong> à sua
              coleção pessoal e acompanhar jornadas, entre na sua conta ou crie um cadastro.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLoginPromptGame(null)}
            >
              Continuar Explorando
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => {
                setLoginPromptGame(null);
                onNavigate('auth');
              }}
            >
              Entrar ou Cadastrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
