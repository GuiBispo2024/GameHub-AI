import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Gamepad2,
  Star,
  Plus,
  Bot,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Filter,
  Check,
  Library,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api';
import { GameItem, LibraryEntry, LibraryStatus, NavTab } from '../types';

interface ExploreViewProps {
  onNavigate: (tab: NavTab) => void;
}

const LIBRARY_STATUS_OPTIONS: Array<{ value: LibraryStatus; label: string; description: string }> = [
  { value: 'BACKLOG', label: 'Pretendo jogar', description: 'Salvar na fila para jogar em breve' },
  { value: 'PLAYING', label: 'Jogando', description: 'Em andamento no momento' },
  { value: 'WISHLIST', label: 'Desejado', description: 'Lista de desejos / interesse futuro' },
  { value: 'COMPLETED', label: 'Concluído', description: 'Campanha finalizada ou zerado' },
  { value: 'PAUSED', label: 'Pausado', description: 'Interrompido temporariamente' },
  { value: 'DROPPED', label: 'Abandonado', description: 'Não pretende continuar' },
];

const STATUS_LABEL_MAP: Record<LibraryStatus, string> = {
  WISHLIST: 'Desejado',
  BACKLOG: 'Pretendo jogar',
  PLAYING: 'Jogando',
  COMPLETED: 'Concluído',
  PAUSED: 'Pausado',
  DROPPED: 'Abandonado',
};

export function ExploreView({ onNavigate }: ExploreViewProps) {
  const { isAuthenticated } = useAuth();

  const [searchTerm, setSearchTerm] = useState('Elden Ring');
  const [debouncedSearch, setDebouncedSearch] = useState('Elden Ring');
  const [selectedGenre, setSelectedGenre] = useState<string>('Todos');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('Todas');
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);

  // User Library state mapped by gameId -> LibraryEntry
  const [libraryMap, setLibraryMap] = useState<Record<string, LibraryEntry>>({});
  const [addingGame, setAddingGame] = useState<GameItem | null>(null);
  const [chosenStatus, setChosenStatus] = useState<LibraryStatus>('BACKLOG');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [loginPromptGame, setLoginPromptGame] = useState<GameItem | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

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

  // Debounce search term by 400ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Auto-dismiss feedback banner
  useEffect(() => {
    if (!feedbackBanner) return;
    const t = setTimeout(() => setFeedbackBanner(null), 5000);
    return () => clearTimeout(t);
  }, [feedbackBanner]);

  // Load authenticated user's library index to mark already-added games
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
      // Ignore silent preload failures; POST /api/library enforces server-side 409 anyway
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadUserLibraryIndex();
  }, [loadUserLibraryIndex]);

  // Load available genres & platforms on mount
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
        // Use defaults if filters endpoint fails
      }
    }

    loadFilters();
  }, []);

  // Fetch games when search, genre, platform or page changes
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

  const handleRequestAddToLibrary = (game: GameItem) => {
    if (!isAuthenticated) {
      setLoginPromptGame(game);
      return;
    }

    if (!game.id) {
      setFeedbackBanner({
        type: 'error',
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
      setAddingGame(null);
      setFeedbackBanner({
        type: 'success',
        message: `"${addingGame.title}" adicionado à sua biblioteca como "${STATUS_LABEL_MAP[chosenStatus]}".`,
      });
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
      setAddError(err.message || 'Erro inesperado ao salvar na biblioteca (500).');
    } finally {
      setIsAdding(false);
    }
  };

  const formatReleaseYear = (dateStr?: string | null) => {
    if (!dateStr) return 'TBA';
    try {
      const year = new Date(dateStr).getFullYear();
      return isNaN(year) ? 'TBA' : year.toString();
    } catch {
      return 'TBA';
    }
  };

  const formatFullDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Não informada';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and status banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Explorar Catálogo de Jogos</h1>
            <Badge variant="ai" size="sm">IGDB Real API</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pesquisa em tempo real na base de dados global da IGDB com persistência no Neon PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Library className="w-4 h-4" />}
              onClick={() => onNavigate('library')}
            >
              Minha Biblioteca ({Object.keys(libraryMap).length})
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' && (
              <button
                type="button"
                onClick={() => onNavigate('library')}
                className="text-emerald-300 underline hover:text-white font-semibold"
              >
                Abrir Biblioteca
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por título (ex: Elden Ring, God of War, Cyberpunk, Zelda)..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-white p-0.5"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedPlatform}
              onChange={(e) => {
                setSelectedPlatform(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-auto bg-slate-950 text-slate-300 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
            >
              {platformsList.map((plat) => (
                <option key={plat} value={plat}>
                  {plat === 'Todas' ? 'Todas Plataformas' : plat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Genre Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3 h-3 text-violet-400" />
            Gênero:
          </span>
          {genresList.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => {
                setSelectedGenre(genre);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                selectedGenre === genre
                  ? 'bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-500/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Error state with retry */}
      {error && (
        <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-rose-200">Não foi possível carregar os jogos</h3>
              <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchGames}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col h-[380px] p-4 space-y-3">
              <Skeleton className="w-full h-44 rounded-xl" />
              <Skeleton className="w-3/4 h-5" />
              <Skeleton className="w-full h-10" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-16 h-4" />
              </div>
              <Skeleton className="w-full h-8 mt-auto rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && games.length === 0 && (
        <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
            <Gamepad2 className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">Nenhum jogo encontrado</h3>
            <p className="text-xs text-slate-400">
              Não encontramos nenhum título correspondente à busca &ldquo;{debouncedSearch}&rdquo;
              {selectedGenre !== 'Todos' && ` no gênero ${selectedGenre}`}. Tente ajustar os termos ou filtros.
            </p>
          </div>
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
        </div>
      )}

      {/* Games Cards Grid */}
      {!loading && !error && games.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {games.map((game) => {
            const libraryEntry = game.id ? libraryMap[game.id] : undefined;

            return (
              <Card
                key={game.igdbId}
                glow="violet"
                className="group cursor-pointer flex flex-col h-full hover:-translate-y-1 transition-all bg-slate-900/80 border-slate-800"
                onClick={() => setSelectedGame(game)}
              >
                {/* Cover Image */}
                <div className="relative aspect-[3/4] overflow-hidden bg-slate-950">
                  {game.coverUrl ? (
                    <img
                      src={game.coverUrl}
                      alt={game.title}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-900 text-slate-600 space-y-2">
                      <Gamepad2 className="w-12 h-12" />
                      <span className="text-xs text-center font-medium">Sem imagem de capa oficial</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90" />

                  {/* Library indicator on top-left */}
                  {libraryEntry && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="success" size="sm">
                        <Check className="w-3 h-3" />
                        Na sua biblioteca
                      </Badge>
                    </div>
                  )}

                  {/* Rating Badge */}
                  {game.rating !== null && (
                    <div className="absolute top-3 right-3">
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-950/90 text-amber-300 border border-amber-500/40 backdrop-blur-md shadow-lg shadow-black/60 tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                        {Math.round(game.rating)}
                      </span>
                    </div>
                  )}

                  {/* Year and Developer */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 font-medium">
                    <span className="px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 tabular-nums">
                      {formatReleaseYear(game.releaseDate)}
                    </span>
                    {game.developer && (
                      <span className="truncate max-w-[120px] text-slate-400 font-semibold">
                        {game.developer}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                      {game.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {game.summary || 'Sinopse não cadastrada no catálogo da IGDB.'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    {/* Clean unboxed genre · platform metadata */}
                    <div className="text-[11px] text-slate-400 truncate">
                      {[...game.genres.slice(0, 2), ...game.platforms.slice(0, 2)].join(' · ') || 'Metadados IGDB'}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {libraryEntry ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                          leftIcon={<Check className="w-3.5 h-3.5" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('library');
                          }}
                        >
                          Na sua biblioteca ({STATUS_LABEL_MAP[libraryEntry.status]})
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full text-xs"
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestAddToLibrary(game);
                          }}
                        >
                          Adicionar à Biblioteca
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-2 shrink-0"
                        title="Ver detalhes completos"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGame(game);
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !error && games.length > 0 && (
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
            Página <span className="text-white font-bold">{page}</span>
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

      {/* Modal for Game Details */}
      {selectedGame && (
        <Modal
          isOpen={!!selectedGame}
          onClose={() => setSelectedGame(null)}
          title={selectedGame.title}
          description={`${selectedGame.developer || 'Desenvolvedora não listada'} • Lançamento: ${formatFullDate(selectedGame.releaseDate)}`}
        >
          <div className="space-y-5">
            {/* Backdrop / Cover Banner */}
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
              {(selectedGame.backdropUrl || selectedGame.coverUrl) && (
                <img
                  src={selectedGame.backdropUrl || selectedGame.coverUrl || ''}
                  alt={selectedGame.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              {selectedGame.rating !== null && (
                <div className="absolute bottom-3 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-amber-300 border border-amber-500/40 backdrop-blur-md tabular-nums">
                  <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                  <span className="font-bold text-sm">{Math.round(selectedGame.rating)}</span>
                  <span className="text-[10px] text-amber-400/80 uppercase">/ 100 na IGDB</span>
                </div>
              )}
            </div>

            {/* Synopsis */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sinopse</h4>
              <p className="text-sm text-slate-200 leading-relaxed max-h-48 overflow-y-auto pr-1">
                {selectedGame.summary || 'Nenhuma sinopse disponível no momento.'}
              </p>
            </div>

            {/* Storyline if available */}
            {selectedGame.storyline && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Enredo</h4>
                <p className="text-xs text-slate-300 leading-relaxed max-h-36 overflow-y-auto pr-1">
                  {selectedGame.storyline}
                </p>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Desenvolvedora:</span>
                <span className="text-slate-200 font-semibold">{selectedGame.developer || 'Não informada'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Publicadora:</span>
                <span className="text-slate-200 font-semibold">{selectedGame.publisher || 'Não informada'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block mb-1">Gêneros:</span>
                <span className="text-slate-300">
                  {selectedGame.genres.join(' · ') || 'Não informados'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block mb-1">Plataformas:</span>
                <span className="text-slate-300">
                  {selectedGame.platforms.join(' · ') || 'Não informadas'}
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
              {selectedGame.id && libraryMap[selectedGame.id] ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
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
                  className="text-xs"
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
                  setSelectedGame(null);
                  onNavigate('companion');
                }}
              >
                Abrir no Game Companion
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Choose Status to Add to Library */}
      <Modal
        isOpen={!!addingGame}
        onClose={() => !isAdding && setAddingGame(null)}
        title="Adicionar à Biblioteca Pessoal"
        description={addingGame?.title}
        maxWidth="sm"
      >
        {addingGame && (
          <form onSubmit={handleConfirmAddToLibrary} className="space-y-4">
            <p className="text-xs text-slate-400">
              Escolha o status inicial para acompanhar este jogo na sua coleção:
            </p>

            {addError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <div className="space-y-2">
              {LIBRARY_STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    chosenStatus === opt.value
                      ? 'bg-violet-950/40 border-violet-500/60 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
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

      {/* Modal: Prompt Authentication if Unauthenticated */}
      <Modal
        isOpen={!!loginPromptGame}
        onClose={() => setLoginPromptGame(null)}
        title="Autenticação Necessária"
        description="Acesse sua conta para salvar jogos na sua biblioteca pessoal."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <Lock className="w-5 h-5 text-violet-400 shrink-0" />
            <p className="text-xs text-slate-300 leading-relaxed">
              Para adicionar <strong className="text-white">{loginPromptGame?.title}</strong> à sua
              coleção pessoal e sincronizar seu progresso no PostgreSQL, faça login ou crie uma conta.
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
