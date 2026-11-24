import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Compass,
  Library,
  Bot,
  User,
  Gamepad2,
  Swords,
  ChevronRight,
  LogIn,
  LogOut,
  X,
  FileText,
} from 'lucide-react';
import { NavTab } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isMobileOpen || !onCloseMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Início',
      icon: <LayoutDashboard className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'explore',
      label: 'Explorar Catálogo',
      icon: <Compass className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'library',
      label: 'Minha Biblioteca',
      icon: <Library className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'journeys',
      label: 'Jornadas',
      icon: <Swords className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'companion',
      label: 'Game Companion',
      icon: <Bot className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'profile',
      label: 'Perfil & Ajustes',
      icon: <User className="w-5 h-5" aria-hidden="true" />,
    },
  ];

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const handleLogout = async () => {
    await logout();
    if (onCloseMobile) onCloseMobile();
    onSelectTab('dashboard');
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/75 z-40 lg:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navegação lateral"
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-[var(--bg-canvas)]/95 border-r border-slate-800/80 backdrop-blur-xl flex flex-col transition-transform duration-200 ease-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => handleTabClick('dashboard')}
            className="flex items-center gap-3 text-left cursor-pointer rounded-xl p-1 -ml-1"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-md shadow-violet-900/40 shrink-0">
              <Gamepad2 className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">GameHub</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-md font-bold bg-violet-600/25 text-violet-200 border border-violet-500/35">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Biblioteca & Companion</p>
            </div>
          </button>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar menu de navegação"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="p-4 flex-1 space-y-1 overflow-y-auto" aria-label="Menu principal">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Navegação
          </div>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleTabClick(item.id)}
                className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors group cursor-pointer ${
                  isActive
                    ? 'bg-violet-600/15 text-white border border-violet-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/70 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className={
                      isActive ? 'text-violet-400' : 'text-slate-400 group-hover:text-violet-300'
                    }
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>

                {isActive && (
                  <ChevronRight className="w-4 h-4 text-violet-400 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}

          {!isAuthenticated && (
            <div className="pt-3 mt-3 border-t border-slate-800/70">
              <button
                type="button"
                aria-current={currentTab === 'auth' ? 'page' : undefined}
                onClick={() => handleTabClick('auth')}
                className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  currentTab === 'auth'
                    ? 'bg-violet-600 text-white'
                    : 'bg-violet-950/50 text-violet-200 border border-violet-500/35 hover:bg-violet-900/50'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>Entrar ou Criar Conta</span>
                </span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-2 shrink-0">
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[40px] flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900/70 border border-slate-800/80 transition-colors"
            title="Abrir documentação da API REST (OpenAPI)"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Documentação da API</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">OpenAPI</span>
          </a>

          {isAuthenticated && user && (
            <div className="lg:hidden pt-1">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-500/25 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Sair da conta ({user.username})</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
