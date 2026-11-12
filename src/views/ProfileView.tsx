import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Shield,
  Key,
  Database,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  Laptop,
  Flame,
  Gamepad2,
  LogOut,
  Save,
  Sparkles,
  Sliders,
  Check,
  Languages,
  Layers,
  Edit3,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api';
import { HealthResponse, FriendlySpoilerLevel, NavTab } from '../types';

interface ProfileViewProps {
  health: HealthResponse | null;
  onNavigate?: (tab: NavTab) => void;
}

const AVAILABLE_PLATFORMS = [
  'PC',
  'PlayStation 5',
  'Xbox Series X/S',
  'Nintendo Switch',
  'Steam Deck',
  'PlayStation 4',
  'Xbox One',
  'Mobile',
];

const AVAILABLE_GENRES = [
  'RPG',
  'Ação',
  'Soulslike',
  'Aventura',
  'Estratégia',
  'FPS',
  'Hack and Slash',
  'Sobrevivência',
  'Terror / Horror',
  'Mundo Aberto',
];

const SPOILER_LEVELS: { id: FriendlySpoilerLevel; label: string; desc: string }[] = [
  { id: 'NONE', label: 'Sem Spoilers (NONE)', desc: 'Apenas mecânicas básicas e tutoriais. Nenhuma revelação de enredo.' },
  { id: 'LIGHT', label: 'Spoilers Leves (LIGHT)', desc: 'Respeita o capítulo atual e mecânicas do jogo.' },
  { id: 'ALL', label: 'Spoilers Liberados (ALL)', desc: 'Livre acesso a lore, chefes secretos e desfechos da história.' },
];

export function ProfileView({ health, onNavigate }: ProfileViewProps) {
  const { user, isAuthenticated, logout, updateUserProfileState, updateUserPreferencesState } = useAuth();

  // Profile edit fields
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Preference edit fields
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [spoilerLevel, setSpoilerLevel] = useState<FriendlySpoilerLevel>('LIGHT');
  const [language, setLanguage] = useState('pt-BR');
  const [theme, setTheme] = useState('dark');

  // UI status
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [prefsMessage, setPrefsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatarUrl || '');

      if (user.preferences) {
        setSelectedPlatforms(user.preferences.preferredPlatforms || ['PC']);
        setSelectedGenres(user.preferences.preferredGenres || ['RPG']);
        setSpoilerLevel(user.preferences.spoilerLevelFriendly || 'LIGHT');
        setLanguage(user.preferences.language || 'pt-BR');
        setTheme(user.preferences.theme || 'dark');
      }
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    try {
      setIsSavingProfile(true);
      const updated = await ApiService.updateProfile({
        username,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      updateUserProfileState(updated);
      setProfileMessage({ type: 'success', text: 'Perfil gamer atualizado com sucesso!' });
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsMessage(null);
    try {
      setIsSavingPrefs(true);
      const updatedPrefs = await ApiService.updatePreferences({
        preferredPlatforms: selectedPlatforms,
        preferredGenres: selectedGenres,
        defaultSpoilerLevel: spoilerLevel as any,
        language,
        theme,
      });
      updateUserPreferencesState(updatedPrefs);
      setPrefsMessage({ type: 'success', text: 'Preferências gamer salvas com sucesso!' });
      setTimeout(() => setPrefsMessage(null), 3000);
    } catch (err: any) {
      setPrefsMessage({ type: 'error', text: err.message || 'Erro ao salvar preferências.' });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((item) => item !== g) : [...prev, g]
    );
  };

  const handleLogout = async () => {
    await logout();
    if (onNavigate) onNavigate('dashboard');
  };

  // If user is not authenticated, present an invitation to login / register
  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto my-12 space-y-6 text-center">
        <Card glow="violet" className="p-8 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-blue-600 flex items-center justify-center mx-auto shadow-xl shadow-violet-900/40">
            <Key className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Acesso ao Perfil Gamer</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
              Cadastre-se ou faça login com JWT e Argon2id para acessar seu perfil gamer, salvar preferências e sincronizar sua biblioteca pessoal.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate && onNavigate('auth')}
            >
              Fazer Login / Cadastrar
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => onNavigate && onNavigate('dashboard')}
            >
              Voltar ao Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Perfil Gamer & Preferências</h1>
            <Badge variant="ai">Autenticado</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gerenciamento de credenciais, plataformas favoritas, regras de spoiler e integração.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="danger"
            size="sm"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={handleLogout}
          >
            Encerrar Sessão (Logout)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Gamer Identity Card & Edit Profile */}
        <Card glow="violet" className="space-y-6">
          <CardHeader>
            <CardTitle>
              <UserIcon className="w-5 h-5 text-violet-400" />
              <span>Identidade Gamer</span>
            </CardTitle>
            <CardDescription>
              Dados da sua conta no GameHub AI protegidos por Argon2id
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* User Avatar & Level */}
            <div className="text-center space-y-3">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-500 p-1 shadow-xl shadow-violet-900/40 mx-auto overflow-hidden">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-full h-full object-cover rounded-[14px]"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                      <UserIcon className="w-10 h-10 text-violet-400" />
                    </div>
                  )}
                </div>
                <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-md">
                  LVL 1
                </span>
              </div>

              <div>
                <h3 className="font-bold text-lg text-white">{user?.username}</h3>
                <p className="text-xs text-slate-400 font-mono">{user?.email}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Membro desde {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'Hoje'}
                </p>
              </div>
            </div>

            {/* Profile Feedback Alert */}
            {profileMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  profileMessage.type === 'success'
                    ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-200'
                    : 'bg-red-950/70 border border-red-700/60 text-red-200'
                }`}
              >
                {profileMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{profileMessage.text}</span>
              </div>
            )}

            {/* Edit Profile Form */}
            <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 border-t border-slate-800">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Gamer Tag (Username)</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Seu nome gamer"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Bio Gamer</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="Compartilhe seu estilo de jogo, classes favoritas..."
                  className="w-full bg-slate-900/90 text-slate-100 placeholder:text-slate-500 rounded-xl border border-slate-700/80 p-2.5 text-xs focus:outline-none focus:border-violet-500 transition-all resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">URL do Avatar</label>
                <Input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://exemplo.com/avatar.jpg"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                isLoading={isSavingProfile}
                leftIcon={<Save className="w-3.5 h-3.5" />}
              >
                Salvar Dados do Perfil
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right Columns: Gamer Preferences */}
        <div className="lg:col-span-2 space-y-6">
          <Card glow="blue">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  <Sliders className="w-5 h-5 text-blue-400" />
                  <span>Preferências de Gameplay & IA</span>
                </CardTitle>
                <Badge variant="playing" size="sm">Persistido no Neon</Badge>
              </div>
              <CardDescription>
                Personalize suas plataformas, gêneros prediletos e o rigor do filtro anti-spoiler
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* Preferences Feedback Alert */}
              {prefsMessage && (
                <div
                  className={`p-3 mb-4 rounded-xl text-xs flex items-center gap-2 ${
                    prefsMessage.type === 'success'
                      ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-200'
                      : 'bg-red-950/70 border border-red-700/60 text-red-200'
                  }`}
                >
                  {prefsMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>{prefsMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleSavePreferences} className="space-y-6">
                {/* 1. Spoiler Control Rule */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>Nível Padrão de Controle Anti-Spoiler</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {SPOILER_LEVELS.map((opt) => {
                      const isSelected = spoilerLevel === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSpoilerLevel(opt.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-violet-950/80 border-violet-500 text-white shadow-md shadow-violet-950/50'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-violet-400" />}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-tight">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Favorite Platforms */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Gamepad2 className="w-4 h-4 text-blue-400" />
                    <span>Plataformas Favoritas</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_PLATFORMS.map((platform) => {
                      const isSelected = selectedPlatforms.includes(platform);
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => togglePlatform(platform)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-900/30'
                              : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
                          }`}
                        >
                          {platform}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Favorite Genres */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-violet-400" />
                    <span>Gêneros Favoritos</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_GENRES.map((genre) => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-900/30'
                              : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Language & Theme Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-slate-400" />
                      <span>Idioma Preferido</span>
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-slate-950 text-xs text-white rounded-xl p-2.5 border border-slate-800 focus:outline-none focus:border-violet-500"
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (US)</option>
                      <option value="es-ES">Español</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                      <span>Tema da Interface</span>
                    </label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="w-full bg-slate-950 text-xs text-white rounded-xl p-2.5 border border-slate-800 focus:outline-none focus:border-violet-500"
                    >
                      <option value="dark">Escuro com Brilho Violeta (Padrão)</option>
                      <option value="neon">Neon Cyberpunk</option>
                      <option value="high-contrast">Alto Contraste</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingPrefs}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Salvar Preferências Gamer
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
