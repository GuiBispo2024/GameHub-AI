import React, { Suspense, lazy, useState, useCallback } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NavTab, LibraryEntry } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

const DashboardView = lazy(() =>
  import('../../views/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const ExploreView = lazy(() =>
  import('../../views/ExploreView').then((m) => ({ default: m.ExploreView }))
);
const LibraryView = lazy(() =>
  import('../../views/LibraryView').then((m) => ({ default: m.LibraryView }))
);
const JourneysView = lazy(() =>
  import('../../views/JourneysView').then((m) => ({ default: m.JourneysView }))
);
const CompanionView = lazy(() =>
  import('../../views/CompanionView').then((m) => ({ default: m.CompanionView }))
);
const ProfileView = lazy(() =>
  import('../../views/ProfileView').then((m) => ({ default: m.ProfileView }))
);
const AuthView = lazy(() =>
  import('../../views/AuthView').then((m) => ({ default: m.AuthView }))
);

function ViewLoadingFallback() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto" aria-busy="true" aria-label="Carregando conteúdo">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

export function AppLayout() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedJourneyEntry, setSelectedJourneyEntry] = useState<LibraryEntry | null>(null);
  const [companionSeedContext, setCompanionSeedContext] = useState<{
    gameId?: string | null;
    journeyId?: string | null;
    nonce: number;
  } | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const handleOpenCompanion = useCallback(
    (context?: { gameId?: string | null; journeyId?: string | null }) => {
      setCompanionSeedContext({
        gameId: context?.gameId ?? null,
        journeyId: context?.journeyId ?? null,
        nonce: Date.now(),
      });
      setCurrentTab('companion');
    },
    []
  );

  const handleOpenJourneysForEntry = useCallback((entry: LibraryEntry | null) => {
    setSelectedJourneyEntry(entry);
    setCurrentTab('journeys');
  }, []);

  const renderProtectedGate = (title: string, description: string) => (
    <div className="max-w-lg mx-auto py-10 sm:py-16">
      <EmptyState
        icon={<Lock className="w-7 h-7" />}
        title={title}
        description={description}
        action={
          <Button
            variant="primary"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => setCurrentTab('auth')}
          >
            Entrar ou Criar Conta
          </Button>
        }
        secondaryAction={
          <Button variant="outline" onClick={() => setCurrentTab('explore')}>
            Explorar Catálogo
          </Button>
        }
      />
    </div>
  );

  const renderActiveView = () => {
    if (isAuthLoading && ['library', 'journeys', 'companion'].includes(currentTab)) {
      return <ViewLoadingFallback />;
    }

    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigate={setCurrentTab}
            onManageJourneys={handleOpenJourneysForEntry}
            onOpenCompanion={handleOpenCompanion}
          />
        );
      case 'explore':
        return (
          <ExploreView
            onNavigate={setCurrentTab}
            onOpenCompanion={handleOpenCompanion}
          />
        );
      case 'library':
        if (!isAuthenticated) {
          return renderProtectedGate(
            'Biblioteca Pessoal Protegida',
            'Acesse sua conta para acompanhar jogos, notas pessoais, horas jogadas e progresso salvo.'
          );
        }
        return (
          <LibraryView
            onNavigate={setCurrentTab}
            onManageJourneys={handleOpenJourneysForEntry}
            onOpenCompanion={handleOpenCompanion}
          />
        );
      case 'journeys':
        if (!isAuthenticated) {
          return renderProtectedGate(
            'Jornadas de Gameplay Protegidas',
            'Acesse sua conta para acompanhar campanhas individuais, linha do tempo e builds personalizadas.'
          );
        }
        return (
          <JourneysView
            selectedEntry={selectedJourneyEntry}
            onSelectEntry={setSelectedJourneyEntry}
            onNavigate={setCurrentTab}
            onOpenCompanion={handleOpenCompanion}
          />
        );
      case 'companion':
        if (!isAuthenticated) {
          return renderProtectedGate(
            'Game Companion Restrito',
            'O assistente utiliza o histórico de conversas, jornadas e preferências anti-spoiler da sua conta.'
          );
        }
        return <CompanionView seedContext={companionSeedContext} />;
      case 'profile':
        return <ProfileView onNavigate={setCurrentTab} />;
      case 'auth':
        return <AuthView onSuccessNavigate={setCurrentTab} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-slate-100 flex relative overflow-x-hidden gaming-ambient-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-violet-600 focus:text-white focus:text-xs focus:font-bold"
      >
        Pular para o conteúdo principal
      </a>

      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 lg:pl-72 flex flex-col min-h-screen">
        <Header
          onOpenMobile={() => setIsMobileOpen(true)}
          isMobileOpen={isMobileOpen}
          onNavigate={setCurrentTab}
        />

        <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 focus:outline-none">
          <Suspense fallback={<ViewLoadingFallback />}>
            {renderActiveView()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
