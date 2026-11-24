import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  GameCover,
  Input,
  Modal,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  ToastProvider,
} from '../src/components/ui';
import { Sidebar } from '../src/components/layout/Sidebar';
import { Header } from '../src/components/layout/Header';
import { AppLayout } from '../src/components/layout/AppLayout';
import { AuthView } from '../src/views/AuthView';
import { DashboardView } from '../src/views/DashboardView';
import { ExploreView } from '../src/views/ExploreView';
import { LibraryView } from '../src/views/LibraryView';
import { JourneysView } from '../src/views/JourneysView';
import { CompanionView } from '../src/views/CompanionView';
import { ProfileView } from '../src/views/ProfileView';
import { getSafeHttpUrl, isSafeHttpUrl } from '../src/utils/url';
import {
  LIBRARY_STATUS_META,
  formatFullDateBR,
  formatHours,
  formatReleaseYear,
  formatShortDateBR,
  getSpoilerLabel,
} from '../src/utils/formatters';
import type { User } from '../src/types';

// Mock AuthContext so views can be rendered deterministically across auth states
const mockAuthState = {
  user: null as User | null,
  isAuthenticated: false,
  isLoading: false,
  error: null as string | null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  updateUserPreferencesState: vi.fn(),
  updateUserProfileState: vi.fn(),
};

vi.mock('../src/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockAuthState,
}));

const sampleUser: User = {
  id: 'usr-123',
  username: 'HunterPrime',
  email: 'hunter@gamehub.dev',
  avatarUrl: 'https://images.igdb.com/igdb/image/upload/t_thumb/avatar.jpg',
  bio: 'Jogador de RPGs e metroidvanias.',
  createdAt: '2026-10-01T12:00:00.000Z',
  preferences: {
    id: 'pref-1',
    userId: 'usr-123',
    theme: 'dark',
    defaultSpoilerLevel: 'CURRENT_CHAPTER',
    preferredPlatforms: ['PC', 'PS5'],
    preferredGenres: ['RPG', 'Metroidvania'],
    language: 'pt-BR',
    overlayEnabled: false,
    overlayHotkey: 'Alt+G',
    notificationsEnabled: true,
  },
};

function renderWithToast(node: React.ReactElement): string {
  return renderToStaticMarkup(<ToastProvider>{node}</ToastProvider>);
}

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('Task 10 — Refinamento UI/UX, Responsividade, Acessibilidade e Integração RAG', () => {
  beforeEach(() => {
    mockAuthState.user = null;
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;
    mockAuthState.error = null;
  });

  describe('1. Segurança de URLs e Formatadores Domínio', () => {
    it('aceita apenas HTTP/HTTPS em isSafeHttpUrl e getSafeHttpUrl', () => {
      expect(isSafeHttpUrl('https://images.igdb.com/cover.jpg')).toBe(true);
      expect(isSafeHttpUrl('http://localhost:3000/guide')).toBe(true);
      expect(getSafeHttpUrl('  https://wiki.example.com/boss  ')).toBe(
        'https://wiki.example.com/boss'
      );

      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
      expect(getSafeHttpUrl('javascript:void(0)')).toBeNull();
      expect(getSafeHttpUrl('')).toBeNull();
      expect(getSafeHttpUrl(null)).toBeNull();
    });

    it('formata horas, anos de lançamento, datas PT-BR e níveis de spoiler corretamente', () => {
      expect(formatHours(12.34)).toBe('12.3h');
      expect(formatHours(null)).toBe('0h');
      expect(formatReleaseYear('2022-02-25T00:00:00.000Z')).toBe('2022');
      expect(formatReleaseYear(null)).toBe('TBA');
      expect(formatShortDateBR('invalid-date')).toBe('—');
      expect(formatFullDateBR(null)).toBe('Não informada');
      expect(getSpoilerLabel('STRICT_NO_SPOILERS')).toBe('Zero Spoilers');
      expect(getSpoilerLabel('CURRENT_CHAPTER')).toBe('Capítulo Atual');
      expect(getSpoilerLabel('MID_GAME_SAFE')).toBe('Até Mid-Game');
      expect(getSpoilerLabel('FULL_UNRESTRICTED')).toBe('Sem Restrições');
      expect(LIBRARY_STATUS_META.PLAYING.label).toBe('Jogando');
      expect(LIBRARY_STATUS_META.COMPLETED.badgeVariant).toBe('completed');
    });
  });

  describe('2. Design System, Tokens CSS, Reduced Motion e Tipografia', () => {
    it('configura lang="pt-BR", data-theme e fontes Plus Jakarta Sans + JetBrains Mono no index.html', () => {
      const html = readProjectFile('index.html');
      expect(html).toContain('lang="pt-BR"');
      expect(html).toContain('data-theme="dark"');
      expect(html).toContain('Plus+Jakarta+Sans');
      expect(html).toContain('JetBrains+Mono');
    });

    it('define tokens semânticos, temas, focus-visible, tabular-nums e prefers-reduced-motion no index.css', () => {
      const css = readProjectFile('src/index.css');
      expect(css).toContain('--bg-canvas');
      expect(css).toContain('--bg-surface');
      expect(css).toContain('--bg-surface-elevated');
      expect(css).toContain('[data-theme="dark"]');
      expect(css).toContain('[data-theme="neon"]');
      expect(css).toContain('[data-theme="high-contrast"]');
      expect(css).toContain(':focus-visible');
      expect(css).toContain('.tabular-nums');
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });
  });

  describe('3. Primitivos de UI e Acessibilidade (WCAG 2.2 AA)', () => {
    it('renderiza Input, Select e Textarea com vínculo label->id, aria-invalid e role="alert"', () => {
      const html = renderToStaticMarkup(
        <div>
          <Input label="Título do Jogo" error="Campo obrigatório" required />
          <Select label="Status" helperText="Escolha um status">
            <option value="PLAYING">Jogando</option>
          </Select>
          <Textarea label="Notas" maxLength={200} showCount value="Teste" onChange={() => {}} />
        </div>
      );

      expect(html).toContain('for="');
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('role="alert"');
      expect(html).toContain('Campo obrigatório');
      expect(html).toContain('Escolha um status');
      expect(html).toContain('5/200');
    });

    it('renderiza Modal e ConfirmDialog com role="dialog", aria-modal e aria-labelledby', () => {
      const html = renderToStaticMarkup(
        <div>
          <Modal isOpen={true} onClose={() => {}} title="Editar Jogo" description="Ajuste os dados">
            <p>Conteúdo interno</p>
          </Modal>
          <ConfirmDialog
            isOpen={true}
            onClose={() => {}}
            onConfirm={() => {}}
            title="Remover título"
            message="Confirma a remoção?"
          />
        </div>
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="');
      expect(html).toContain('aria-describedby="');
      expect(html).toContain('Editar Jogo');
      expect(html).toContain('Remover título');
      expect(html).toContain('data-modal-close="true"');

      const modalSource = readProjectFile('src/components/ui/Modal.tsx');
      expect(modalSource).toContain('}, [isOpen]);');
      expect(modalSource).not.toContain('}, [isOpen, onClose]);');
    });

    it('renderiza Tabs, EmptyState, ErrorState, PageHeader, Card, Badge e Button sem quebras', () => {
      const html = renderToStaticMarkup(
        <div>
          <PageHeader
            title="Minha Biblioteca"
            subtitle="Subtítulo claro"
            badge={<Badge variant="ai">AI</Badge>}
            actions={<Button isLoading>Salvando</Button>}
          />
          <Tabs
            activeId="tab1"
            onChange={() => {}}
            ariaLabel="Abas de teste"
            items={[
              { id: 'tab1', label: 'Aba 1', count: 3 },
              { id: 'tab2', label: 'Aba 2', count: 0 },
            ]}
          />
          <Card>
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent>Corpo</CardContent>
          </Card>
          <EmptyState icon={<span>*</span>} title="Nada aqui" description="Sem itens." />
          <ErrorState message="Falha temporária" onRetry={() => {}} />
        </div>
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('Tentar novamente');
      expect(html).toContain('Nada aqui');
    });

    it('GameCover bloqueia URL insegura e usa referrerPolicy="no-referrer" para URL válida', () => {
      const unsafeHtml = renderToStaticMarkup(
        <GameCover src="javascript:alert(1)" alt="Capa Perigosa" fallbackLabel="Sem capa" />
      );
      expect(unsafeHtml).not.toContain('javascript:');
      expect(unsafeHtml).not.toContain('<img');
      expect(unsafeHtml).toContain('Sem capa');

      const safeHtml = renderToStaticMarkup(
        <GameCover src="https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg" alt="Elden Ring" />
      );
      expect(safeHtml).toContain('<img');
      expect(safeHtml.toLowerCase()).toContain('referrerpolicy="no-referrer"');
      expect(safeHtml).toContain('alt="Elden Ring"');
    });
  });

  describe('4. Navegação, Responsividade Estrutural e Remoção de Simulações', () => {
    it('Sidebar marca aba ativa com aria-current="page" e não exibe Simulador de Overlay ou telemetria fake', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = sampleUser;

      const html = renderToStaticMarkup(
        <Sidebar currentTab="library" onSelectTab={() => {}} isMobileOpen={false} />
      );

      expect(html).toContain('aria-current="page"');
      expect(html).toContain('Minha Biblioteca');
      expect(html).toContain('Game Companion');
      expect(html).not.toContain('Simulador de Overlay');
      expect(html).not.toContain('Express 4');
      expect(html).not.toContain('Prisma v6');
    });

    it('Header exibe avatar seguro do usuário logado e botão mobile com aria-expanded', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = sampleUser;

      const html = renderToStaticMarkup(
        <Header onOpenMobile={() => {}} isMobileOpen={true} onNavigate={() => {}} />
      );

      expect(html).toContain('aria-expanded="true"');
      expect(html).toContain('HunterPrime');
      expect(html).toContain('Sair da conta');
      expect(html).not.toContain('Overlay');
    });

    it('AppLayout inclui skip link, overflow-x-hidden e renderiza Dashboard público sem simulador', () => {
      const html = renderWithToast(<AppLayout />);
      expect(html).toContain('href="#main-content"');
      expect(html).toContain('Pular para o conteúdo principal');
      expect(html).toContain('overflow-x-hidden');
      expect(html).not.toContain('60 FPS');
      expect(html).not.toContain('Simulador de Overlay');
    });
  });

  describe('5. Renderização de Views (Autenticação, Dashboard, Explorar, Biblioteca, Jornadas, Companion, Perfil)', () => {
    it('AuthView renderiza abas Entrar/Criar Conta e campos acessíveis com autoComplete', () => {
      const html = renderWithToast(<AuthView />);
      expect(html).toContain('Entrar');
      expect(html).toContain('Criar Conta');
      expect(html.toLowerCase()).toContain('autocomplete="email"');
      expect(html.toLowerCase()).toContain('autocomplete="current-password"');
    });

    it('DashboardView público e autenticado renderizam sem checklists internos de desenvolvimento', () => {
      const guestHtml = renderWithToast(<DashboardView onNavigate={() => {}} />);
      expect(guestHtml).toContain('Catálogo IGDB em Tempo Real');
      expect(guestHtml).toContain('Biblioteca, Jornadas &amp; Builds');
      expect(guestHtml).toContain('Companion com Filtro Anti-Spoiler');
      expect(guestHtml).not.toContain('Fase 1');

      mockAuthState.isAuthenticated = true;
      mockAuthState.user = sampleUser;
      const authHtml = renderWithToast(<DashboardView onNavigate={() => {}} />);
      expect(authHtml).toContain('Olá, HunterPrime');
      expect(authHtml).toContain('Total na Biblioteca');
      expect(authHtml).toContain('Horas Registradas');
      expect(authHtml).toContain('tabular-nums');
    });

    it('ExploreView renderiza busca, filtro de plataforma, ordenação e filtros de gênero acessíveis', () => {
      const html = renderWithToast(<ExploreView onNavigate={() => {}} />);
      expect(html).toContain('Explorar Catálogo');
      expect(html).toContain('Relevância');
      expect(html).toContain('Maior nota IGDB');
      expect(html).toContain('aria-pressed="true"');
    });

    it('LibraryView renderiza toggle Grid/Lista, abas de status e cards de métricas reais', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = sampleUser;
      const html = renderWithToast(<LibraryView onNavigate={() => {}} />);

      expect(html).toContain('Minha Biblioteca');
      expect(html).toContain('Visualização em grade');
      expect(html).toContain('Visualização em lista');
      expect(html).toContain('Pretendo jogar');
      expect(html).toContain('Concluídos');
    });

    it('JourneysView renderiza skeleton inicial, suporte a builds agnósticas de gênero e ações contextuais', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = sampleUser;
      const html = renderWithToast(
        <JourneysView selectedEntry={null} onSelectEntry={() => {}} onNavigate={() => {}} />
      );
      expect(html).toContain('animate-pulse');

      const journeysSource = readProjectFile('src/views/JourneysView.tsx');
      // Não deve hardcodear templates de Elden Ring nos formulários de build
      expect(journeysSource).not.toContain('Moonveil');
      expect(journeysSource).not.toContain('Carian Regal');
      // Deve manter campos opcionais na timeline e suportar diálogo de confirmação
      expect(journeysSource).toContain('Jornadas de Gameplay');
      expect(journeysSource).toContain('ConfirmDialog');
      expect(journeysSource).toContain('Consultar Companion');
    });

    it('ProfileView renderiza seleção funcional de tema, níveis anti-spoiler e fallback seguro de avatar', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = sampleUser;
      const html = renderWithToast(<ProfileView onNavigate={() => {}} />);

      expect(html).toContain('Perfil &amp; Preferências');
      expect(html).toContain('Tema Visual');
      expect(html).toContain('Zero Spoilers');
      expect(html).toContain('Grafite &amp; Violeta (Padrão)');
      expect(html).toContain('Azul Profundo &amp; Neon');
      expect(html).toContain('Alto Contraste (Acessível)');
      expect(html).not.toContain('LVL 1');
    });

    it('CompanionView renderiza seletor de modo, política anti-spoiler, altura responsiva e composer acessível', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = sampleUser;
      const html = renderWithToast(<CompanionView />);

      expect(html).toContain('Game Companion');
      expect(html).toContain('Gemini + RAG');
      expect(html).toContain('Política Anti-Spoiler Ativa');
      expect(html).toContain('Zero Spoilers');
      expect(html).toContain('Capítulo Atual');
      expect(html).toContain('Até Mid-Game');
      expect(html).toContain('Sem Restrições');
      expect(html).toContain('Enter envia · Shift+Enter quebra linha');
      expect(html).toContain('0/2000');
      expect(html).toContain('h-[calc(100dvh-17rem)]');
    });
  });

  describe('6. Invariantes Visuais de RAG, Citações, Anti-Spoiler e Action Proposals no CompanionView', () => {
    it('implementa citações verificadas com URL sanitizada, aviso anti-spoiler sem vazamento e propostas confirmáveis', () => {
      const src = readProjectFile('src/views/CompanionView.tsx');

      // Proveniência real das respostas
      expect(src).toContain('Baseado em fontes');
      expect(src).toContain('Dados da sua conta');
      expect(src).toContain('Orientação geral');

      // Fontes consultadas + sanitização getSafeHttpUrl + metadados de licença/verificação
      expect(src).toContain('Fontes Consultadas');
      expect(src).toContain('getSafeHttpUrl(ref.sourceUrl)');
      expect(src).toContain('ref.sourceLicense');
      expect(src).toContain('ref.isVerified');

      // Aviso explícito quando trechos forem omitidos por spoiler, sem listar títulos bloqueados
      expect(src).toContain('knowledge?.spoilerRestricted');
      expect(src).toContain('knowledge.blockedChunksCount');
      expect(src).toContain('foi omitido para proteger sua experiência');

      // Reconhecimento explícito de ausência/insuficiência de documentos
      expect(src).toContain("knowledge.evidenceStatus === 'NO_DOCUMENTS'");
      expect(src).toContain("knowledge.evidenceStatus === 'INSUFFICIENT'");

      // Propostas de escrita confirmáveis e preservação de clientRequestId no retry
      expect(src).toContain("proposal.status === 'PENDING'");
      expect(src).toContain('Confirmar');
      expect(src).toContain('Cancelar');
      expect(src).toContain('pendingRetryPayload.clientRequestId');
      expect(src).toContain('Boolean(c && c.id)');
    });
  });
});
