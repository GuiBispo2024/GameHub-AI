import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  Gamepad2,
  LogOut,
  Save,
  Sliders,
  Check,
  Languages,
  Layers,
  Palette,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api';
import { FriendlySpoilerLevel, NavTab } from '../types';
import { getSafeHttpUrl } from '../utils/url';
import { formatShortDateBR } from '../utils/formatters';

interface ProfileViewProps {
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
  {
    id: 'NONE',
    label: 'Zero Spoilers',
    desc: 'Apenas mecânicas básicas e tutoriais. Nenhuma revelação de enredo.',
  },
  {
    id: 'LIGHT',
    label: 'Spoilers Leves',
    desc: 'Respeita o capítulo atual da jornada sem adiantar reviravoltas.',
  },
  {
    id: 'ALL',
    label: 'Spoilers Liberados',
    desc: 'Acesso completo a lore, chefes secretos e desfechos.',
  },
];

export function ProfileView({ onNavigate }: ProfileViewProps) {
  const { user, isAuthenticated, logout, updateUserProfileState, updateUserPreferencesState } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [spoilerLevel, setSpoilerLevel] = useState<FriendlySpoilerLevel>('LIGHT');
  const [language, setLanguage] = useState('pt-BR');
  const [theme, setTheme] = useState('dark');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [prefsMessage, setPrefsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatarUrl || '');
      setAvatarError(false);

      if (user.preferences) {
        setSelectedPlatforms(user.preferences.preferredPlatforms || ['PC']);
        setSelectedGenres(user.preferences.preferredGenres || ['RPG']);
        setSpoilerLevel(user.preferences.spoilerLevelFriendly || 'LIGHT');
        setLanguage(user.preferences.language || 'pt-BR');
        setTheme(user.preferences.theme || 'dark');
      }
    }
  }, [user]);

  const handleThemeSelect = (nextTheme: string) => {
    setTheme(nextTheme);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme =
        nextTheme === 'neon' || nextTheme === 'high-contrast' ? nextTheme : 'dark';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    const trimmedAvatar = avatarUrl.trim();
    if (trimmedAvatar && !getSafeHttpUrl(trimmedAvatar)) {
      setProfileMessage({
        type: 'error',
        text: 'Informe uma URL válida iniciada por http:// ou https:// para o avatar.',
      });
      return;
    }

    try {
      setIsSavingProfile(true);
      const updated = await ApiService.updateProfile({
        username: username.trim(),
        bio: bio.trim() || null,
        avatarUrl: trimmedAvatar || null,
      });
      updateUserProfileState(updated);
      setAvatarError(false);
      setProfileMessage({ type: 'success', text: 'Perfil atualizado com sucesso.' });
      showToast({ variant: 'success', message: 'Perfil atualizado.' });
    } catch (err: any) {
      const msg = err.message || 'Erro ao atualizar perfil.';
      setProfileMessage({ type: 'error', text: msg });
      showToast({ variant: 'error', message: msg });
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
      setPrefsMessage({ type: 'success', text: 'Preferências salvas com sucesso.' });
      showToast({ variant: 'success', message: 'Preferências salvas.' });
    } catch (err: any) {
      const msg = err.message || 'Erro ao salvar preferências.';
      setPrefsMessage({ type: 'error', text: msg });
      showToast({ variant: 'error', message: msg });
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
    showToast({ variant: 'info', message: 'Você saiu da sua conta.' });
    if (onNavigate) onNavigate('dashboard');
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-lg mx-auto py-10 sm:py-16">
        <EmptyState
          icon={<Key className="w-7 h-7" />}
          title="Acesso ao Perfil Gamer"
          description="Entre ou crie uma conta para editar sua identidade gamer, plataformas favoritas e nível de proteção contra spoilers."
          action={
            <Button variant="primary" onClick={() => onNavigate && onNavigate('auth')}>
              Entrar ou Cadastrar
            </Button>
          }
          secondaryAction={
            <Button variant="outline" onClick={() => onNavigate && onNavigate('dashboard')}>
              Voltar ao Início
            </Button>
          }
        />
      </div>
    );
  }

  const safeAvatarPreview = getSafeHttpUrl(user?.avatarUrl);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Perfil & Preferências"
        subtitle="Personalize seus dados de jogador, plataformas, gêneros favoritos e política anti-spoiler."
        badge={<Badge variant="ai" size="sm">Conta Conectada</Badge>}
        actions={
          <Button
            variant="danger"
            size="sm"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={handleLogout}
          >
            Encerrar Sessão
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Identity */}
        <Card glow="violet">
          <CardHeader>
            <CardTitle>
              <UserIcon className="w-5 h-5 text-violet-400" aria-hidden="true" />
              <span>Identidade Gamer</span>
            </CardTitle>
            <CardDescription>Informações visíveis da sua conta</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="text-center space-y-2.5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-500 p-0.5 shadow-lg shadow-violet-950/50 mx-auto overflow-hidden">
                {safeAvatarPreview && !avatarError ? (
                  <img
                    src={safeAvatarPreview}
                    alt={user?.username || 'Avatar do usuário'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-full h-full object-cover rounded-[14px]"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                    <UserIcon className="w-9 h-9 text-violet-300" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div>
                <h2 className="font-bold text-lg text-white">{user?.username}</h2>
                <p className="text-xs text-slate-400 font-mono break-all">{user?.email}</p>
                <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                  Membro desde {formatShortDateBR(user?.createdAt)}
                </p>
              </div>
            </div>

            {profileMessage && (
              <div
                role={profileMessage.type === 'error' ? 'alert' : 'status'}
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  profileMessage.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                }`}
              >
                {profileMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                )}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-2 border-t border-slate-800">
              <Input
                label="Gamer Tag (Nome de usuário)"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Seu nome gamer"
                required
              />

              <Textarea
                label="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={300}
                showCount
                placeholder="Compartilhe seu estilo de jogo e franquias favoritas..."
              />

              <Input
                label="URL do Avatar"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://exemplo.com/avatar.jpg"
                helperText="Opcional. Deve iniciar com https:// ou http://."
              />

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                isLoading={isSavingProfile}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Salvar Perfil
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right Columns: Preferences */}
        <div className="lg:col-span-2">
          <Card glow="blue">
            <CardHeader>
              <CardTitle>
                <Sliders className="w-5 h-5 text-blue-400" aria-hidden="true" />
                <span>Preferências de Gameplay & IA</span>
              </CardTitle>
              <CardDescription>
                Essas configurações orientam recomendações e o filtro anti-spoiler padrão do Game Companion.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {prefsMessage && (
                <div
                  role={prefsMessage.type === 'error' ? 'alert' : 'status'}
                  className={`p-3 mb-4 rounded-xl border text-xs flex items-center gap-2 ${
                    prefsMessage.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {prefsMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                  )}
                  <span>{prefsMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleSavePreferences} className="space-y-6">
                <fieldset className="space-y-2.5">
                  <legend className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    <span>Nível Padrão Anti-Spoiler</span>
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {SPOILER_LEVELS.map((opt) => {
                      const isSelected = spoilerLevel === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSpoilerLevel(opt.id)}
                          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-violet-950/70 border-violet-400 text-white'
                              : 'bg-[var(--bg-inset)] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold">{opt.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-violet-300 shrink-0" aria-hidden="true" />}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2.5">
                  <legend className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Gamepad2 className="w-4 h-4 text-blue-400" aria-hidden="true" />
                    <span>Plataformas Favoritas</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_PLATFORMS.map((platform) => {
                      const isSelected = selectedPlatforms.includes(platform);
                      return (
                        <button
                          key={platform}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => togglePlatform(platform)}
                          className={`px-3 py-2 min-h-[36px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-400'
                              : 'bg-[var(--bg-inset)] text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          {platform}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2.5">
                  <legend className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-violet-400" aria-hidden="true" />
                    <span>Gêneros Favoritos</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_GENRES.map((genre) => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => toggleGenre(genre)}
                          className={`px-3 py-2 min-h-[36px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-violet-600 text-white border-violet-400'
                              : 'bg-[var(--bg-inset)] text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                  <Select
                    label="Idioma da Interface"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español</option>
                  </Select>

                  <Select
                    label="Tema Visual"
                    value={theme}
                    onChange={(e) => handleThemeSelect(e.target.value)}
                  >
                    <option value="dark">Grafite & Violeta (Padrão)</option>
                    <option value="neon">Azul Profundo & Neon</option>
                    <option value="high-contrast">Alto Contraste (Acessível)</option>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
                    <Languages className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                    <span>As alterações de tema aplicam imediatamente na visualização.</span>
                  </span>
                </div>

                <div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingPrefs}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Salvar Preferências
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
