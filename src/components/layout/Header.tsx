import React from 'react';
import { Menu, Search, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { NavTab } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { getSafeHttpUrl } from '../../utils/url';

interface HeaderProps {
  onOpenMobile: () => void;
  isMobileOpen: boolean;
  onNavigate: (tab: NavTab) => void;
}

export function Header({ onOpenMobile, isMobileOpen, onNavigate }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const safeAvatarUrl = getSafeHttpUrl(user?.avatarUrl);

  return (
    <header className="sticky top-0 z-30 h-16 bg-[var(--bg-canvas)]/85 border-b border-slate-800/80 backdrop-blur-xl px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 max-w-xl">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-expanded={isMobileOpen}
          aria-label="Abrir menu de navegação"
          className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 shrink-0 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('explore')}
          className="relative w-full max-w-md hidden sm:flex items-center text-left group cursor-pointer rounded-xl"
        >
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-violet-400 transition-colors"
            aria-hidden="true"
          />
          <span className="w-full bg-[var(--bg-surface)] text-sm text-slate-400 group-hover:text-slate-200 rounded-xl pl-10 pr-20 py-2.5 border border-slate-800 group-hover:border-violet-500/50 transition-colors truncate">
            Buscar jogos no catálogo IGDB...
          </span>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/70">
            Explorar
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="flex items-center gap-2.5 px-2 py-1.5 min-h-[44px] rounded-xl hover:bg-slate-900/80 transition-colors text-left cursor-pointer"
              aria-label={`Acessar perfil de ${user.username}`}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 p-0.5 shrink-0 overflow-hidden">
                {safeAvatarUrl ? (
                  <img
                    src={safeAvatarUrl}
                    alt={user.username}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-[10px]"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-bold text-violet-200 text-xs uppercase">
                    {user.username ? user.username.slice(0, 2) : <UserIcon className="w-4 h-4" />}
                  </div>
                )}
              </div>
              <div className="hidden sm:block text-left min-w-0">
                <div className="text-xs font-bold text-white truncate max-w-[140px]">
                  {user.username}
                </div>
                <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                  {user.email}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={logout}
              aria-label="Sair da conta"
              title="Sair da conta"
              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-950/35 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('auth')}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-950/40 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Entrar / Cadastrar</span>
            <span className="sm:hidden">Entrar</span>
          </button>
        )}
      </div>
    </header>
  );
}
