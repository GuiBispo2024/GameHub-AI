import React from 'react';
import { Menu, Search, RefreshCw, Monitor, UserCircle2, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { HealthResponse, NavTab } from '../../types';
import { StatusIndicator } from '../ui/StatusIndicator';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onOpenMobile: () => void;
  health: HealthResponse | null;
  isOnline: boolean;
  onRefreshHealth: () => void;
  isRefreshing: boolean;
  isOverlayMode: boolean;
  onToggleOverlay: () => void;
  onNavigate?: (tab: NavTab) => void;
}

export function Header({
  onOpenMobile,
  health,
  isOnline,
  onRefreshHealth,
  isRefreshing,
  isOverlayMode,
  onToggleOverlay,
  onNavigate,
}: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-xl px-3 sm:px-4 lg:px-8 flex items-center justify-between gap-2">
      {/* Left: Mobile trigger & Search preview */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 max-w-xl">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('explore')}
          className="relative w-full max-w-md hidden sm:flex items-center text-left group cursor-pointer"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-violet-400 transition-colors" />
          <span className="w-full bg-slate-900/80 text-sm text-slate-400 group-hover:text-slate-200 rounded-xl pl-10 pr-16 py-2 border border-slate-800 group-hover:border-violet-500/60 transition-all truncate">
            Explorar jogos no catálogo IGDB...
          </span>
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
            Explorar
          </kbd>
        </button>
      </div>

      {/* Right: Actions and user info */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Backend & DB compact badge */}
        <StatusIndicator
          serverOnline={isOnline}
          dbStatus={health?.database}
          compact
        />

        {/* Refresh button */}
        <button
          onClick={onRefreshHealth}
          disabled={isRefreshing}
          title="Verificar status dos serviços"
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800/80 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-violet-400' : ''}`} />
        </button>

        {/* Overlay toggle button in header */}
        <button
          onClick={onToggleOverlay}
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            isOverlayMode
              ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Overlay: {isOverlayMode ? 'Ativo' : 'Inativo'}</span>
        </button>

        {/* User state / Auth CTA */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800/80">
            <button
              onClick={() => onNavigate && onNavigate('profile')}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity text-left cursor-pointer"
              title="Acessar Meu Perfil"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 p-0.5 shadow-md shadow-violet-900/30">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-bold text-violet-300 text-xs uppercase">
                  {user.username.slice(0, 2)}
                </div>
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{user.username}</span>
                  <span className="text-[10px] px-1 rounded bg-violet-900/60 text-violet-300 border border-violet-700/40">
                    ONLINE
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{user.email}</div>
              </div>
            </button>
            <button
              onClick={logout}
              title="Sair da conta"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors ml-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800/80">
            <button
              onClick={() => onNavigate && onNavigate('auth')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-900/40 transition-all cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Entrar / Cadastrar</span>
              <span className="sm:hidden">Entrar</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
