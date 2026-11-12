import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NavTab, LibraryEntry } from '../../types';
import { useHealth } from '../../hooks/useHealth';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardView } from '../../views/DashboardView';
import { ExploreView } from '../../views/ExploreView';
import { LibraryView } from '../../views/LibraryView';
import { JourneysView } from '../../views/JourneysView';
import { CompanionView } from '../../views/CompanionView';
import { ProfileView } from '../../views/ProfileView';
import { AuthView } from '../../views/AuthView';
import { MonitorPlay, X, Bot, ShieldAlert, Sparkles, Lock, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';

export function AppLayout() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedJourneyEntry, setSelectedJourneyEntry] = useState<LibraryEntry | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isOverlayMode, setIsOverlayMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { health, isLoading, isOnline, refresh } = useHealth();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView
            health={health}
            isLoading={isLoading || isRefreshing}
            isOnline={isOnline}
            onRefresh={handleRefresh}
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        );
      case 'explore':
        return <ExploreView onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'library':
        if (!isAuthenticated) {
          return (
            <div className="max-w-xl mx-auto py-16 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-violet-950/80 border border-violet-500/40 flex items-center justify-center mx-auto text-violet-400 shadow-xl shadow-violet-950/50">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Biblioteca Pessoal Protegida</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Para gerenciar sua coleção pessoal, salvar horas jogadas e registrar progresso no PostgreSQL, acesse sua conta gamer.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="primary"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => setCurrentTab('auth')}
                >
                  Entrar ou Cadastrar
                </Button>
              </div>
            </div>
          );
        }
        return (
          <LibraryView
            onNavigate={(tab) => setCurrentTab(tab)}
            onManageJourneys={(entry) => {
              setSelectedJourneyEntry(entry);
              setCurrentTab('journeys');
            }}
            health={health}
          />
        );
      case 'journeys':
        if (!isAuthenticated) {
          return (
            <div className="max-w-xl mx-auto py-16 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-violet-950/80 border border-violet-500/40 flex items-center justify-center mx-auto text-violet-400 shadow-xl shadow-violet-950/50">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Jornadas de Gameplay Protegidas</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Acesse sua conta para acompanhar campanhas individuais, marcos de progresso e builds personalizadas.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="primary"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => setCurrentTab('auth')}
                >
                  Entrar ou Cadastrar
                </Button>
              </div>
            </div>
          );
        }
        return (
          <JourneysView
            selectedEntry={selectedJourneyEntry}
            onSelectEntry={setSelectedJourneyEntry}
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        );
      case 'companion':
        if (!isAuthenticated) {
          return (
            <div className="max-w-xl mx-auto py-16 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-400 shadow-xl shadow-indigo-950/50">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Game Companion AI Restrito</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  O assistente inteligente armazena histórico de sessões e mensagens privadas vinculadas à sua conta de usuário.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="primary"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => setCurrentTab('auth')}
                >
                  Entrar ou Cadastrar
                </Button>
              </div>
            </div>
          );
        }
        return <CompanionView />;
      case 'profile':
        return <ProfileView health={health} onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'auth':
        return <AuthView onSuccessNavigate={(tab) => setCurrentTab(tab)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#080a12] text-slate-100 flex relative overflow-x-hidden gaming-ambient-bg">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        health={health}
        isOnline={isOnline}
        isOverlayMode={isOverlayMode}
        onToggleOverlay={() => setIsOverlayMode(!isOverlayMode)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 lg:pl-72 flex flex-col min-h-screen transition-all">
        {/* Header Bar */}
        <Header
          onOpenMobile={() => setIsMobileOpen(true)}
          health={health}
          isOnline={isOnline}
          onRefreshHealth={handleRefresh}
          isRefreshing={isRefreshing}
          isOverlayMode={isOverlayMode}
          onToggleOverlay={() => setIsOverlayMode(!isOverlayMode)}
          onNavigate={(tab) => setCurrentTab(tab)}
        />

        {/* Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {renderActiveView()}
        </main>

        {/* Desktop Overlay Simulation Widget (Activates when isOverlayMode is toggled) */}
        {isOverlayMode && (
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 rounded-2xl bg-slate-950/90 border border-blue-500/60 shadow-[0_0_30px_rgba(59,130,246,0.35)] backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-5">
            <div className="p-3 bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 border-b border-blue-800/60 flex items-center justify-between text-xs font-bold text-blue-200">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-blue-400" />
                <span>Simulador de Overlay Desktop</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500 text-white">
                  Em Jogo
                </span>
              </div>
              <button
                onClick={() => setIsOverlayMode(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Jogo Detectado: <strong>Elden Ring</strong></span>
                <span className="text-emerald-400 font-mono">60 FPS</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 text-violet-400 font-bold text-[11px]">
                  <Bot className="w-3.5 h-3.5" />
                  <span>Dica Rápida do Companion:</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Você está próximo da Arena de Malenia. Equipe itens de resistência à Podridão Escarlate e prepare a Lágrima Imitadora.
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Atalho: <strong>Alt + G</strong> para fechar</span>
                <span className="text-blue-400 font-mono">REST API Ready</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
