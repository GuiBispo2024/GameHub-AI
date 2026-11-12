import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Library,
  Bot,
  User,
  Gamepad2,
  Sparkles,
  Layers,
  MonitorPlay,
  ChevronRight,
  Database,
  LogIn,
  LogOut,
  X,
  FileText,
} from 'lucide-react';
import { NavTab, HealthResponse } from '../../types';
import { StatusIndicator } from '../ui/StatusIndicator';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  health: HealthResponse | null;
  isOnline: boolean;
  isOverlayMode: boolean;
  onToggleOverlay: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  health,
  isOnline,
  isOverlayMode,
  onToggleOverlay,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'explore',
      label: 'Explorar',
      icon: <Compass className="w-5 h-5" />,
      badge: 'IGDB',
    },
    {
      id: 'library',
      label: 'Minha Biblioteca',
      icon: <Library className="w-5 h-5" />,
    },
    {
      id: 'journeys',
      label: 'Jornadas',
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      id: 'companion',
      label: 'Companion',
      icon: <Bot className="w-5 h-5" />,
      badge: 'AI',
    },
    {
      id: 'profile',
      label: 'Perfil',
      icon: <User className="w-5 h-5" />,
    },
  ];

  const { user, isAuthenticated, logout } = useAuth();

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-slate-950/90 border-r border-violet-900/20 backdrop-blur-xl flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-600/30 border border-violet-400/30">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-white">GameHub</span>
                <span className="text-xs px-1.5 py-0.5 rounded font-black bg-gradient-to-r from-violet-500 to-blue-500 text-white">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Plataforma & Companion</p>
            </div>
          </div>

          {/* Mobile close button */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation items */}
        <div className="p-4 flex-1 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navegação Principal
          </div>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-950/70 to-indigo-950/70 text-violet-200 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`transition-colors duration-200 ${
                      isActive ? 'text-violet-400' : 'text-slate-400 group-hover:text-violet-400'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        item.badge === 'AI'
                          ? 'bg-violet-900/50 text-violet-300 border border-violet-600/40'
                          : 'bg-blue-900/50 text-blue-300 border border-blue-600/40'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-4 h-4 text-violet-400" />}
                </div>
              </button>
            );
          })}

          {!isAuthenticated && (
            <button
              onClick={() => handleTabClick('auth')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'auth'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]'
                  : 'bg-violet-950/40 text-violet-300 border border-violet-800/40 hover:bg-violet-900/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LogIn className="w-4 h-4 text-violet-400" />
                <span>Entrar / Cadastrar</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Desktop Overlay Feature Toggle */}
          <div className="pt-4 mt-4 border-t border-slate-800/60">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Ambiente Desktop
            </div>
            <button
              onClick={onToggleOverlay}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                isOverlayMode
                  ? 'bg-blue-950/60 text-blue-200 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                  : 'bg-slate-900/40 text-slate-300 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MonitorPlay className={`w-4 h-4 ${isOverlayMode ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>Simulador de Overlay</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  isOverlayMode ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isOverlayMode ? 'ATIVO' : 'OFF'}
              </span>
            </button>
          </div>

          {/* OpenAPI Technical Documentation Link */}
          <div className="pt-3">
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 border border-slate-800/60 transition-all cursor-pointer group"
              title="Abrir documentação interativa Swagger/OpenAPI"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                <span>Documentação API</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/40 font-mono">
                OpenAPI
              </span>
            </a>
          </div>
        </div>

        {/* Bottom Health & Database Status Card */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-3">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-violet-400" />
            <span>Infraestrutura do Servidor</span>
          </div>

          <StatusIndicator
            serverOnline={isOnline}
            dbStatus={health?.database || null}
          />

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
            <span>GameHub API: Express 4</span>
            <span className="font-mono">Prisma v6</span>
          </div>
        </div>
      </aside>
    </>
  );
}
