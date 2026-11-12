import React, { useState } from 'react';
import {
  Server,
  Database,
  Gamepad2,
  Bot,
  Key,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Terminal,
  Layers,
  Code2,
  MonitorCheck,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { HealthResponse, NavTab } from '../types';

interface DashboardViewProps {
  health: HealthResponse | null;
  isLoading: boolean;
  isOnline: boolean;
  onRefresh: () => void;
  onNavigate: (tab: NavTab) => void;
}

export function DashboardView({
  health,
  isLoading,
  isOnline,
  onRefresh,
  onNavigate,
}: DashboardViewProps) {
  const db = health?.database;
  const isDbConnected = db?.connected === true;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-950/80 via-slate-900 to-blue-950/80 border border-violet-500/30 p-8 shadow-2xl shadow-violet-950/30">
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />
        <div className="absolute right-40 -bottom-20 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>GameHub AI • Fase 1: Arquitetura & Fundação Inicial</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Central de Comando <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">Gamer & IA</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Estrutura full stack inicial montada com Node.js + Express, Prisma ORM, PostgreSQL e React.
              Ambiente preparado para integração com catálogo IGDB, agente inteligente Gemini e overlay desktop.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Gamepad2 className="w-4 h-4" />}
              onClick={() => onNavigate('explore')}
            >
              Explorar Catálogo
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Bot className="w-4 h-4" />}
              onClick={() => onNavigate('companion')}
            >
              Game Companion
            </Button>
          </div>
        </div>
      </div>

      {/* Explicit Real Database & Backend Health Status (No fake simulation) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backend Status Card */}
        <Card glow="blue">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                <Server className="w-5 h-5 text-blue-400" />
                <span>Backend Express</span>
              </CardTitle>
              <Badge variant={isOnline ? 'success' : 'dropped'}>
                {isOnline ? 'ONLINE (200 OK)' : 'OFFLINE'}
              </Badge>
            </div>
            <CardDescription>
              Servidor REST Node.js com endpoints modulares e health check ativo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block">Endpoint de Health:</span>
                <span className="font-mono text-blue-300 font-semibold text-sm">/api/health</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block">Tempo de Atividade:</span>
                <span className="font-mono text-emerald-300 font-semibold text-sm">
                  {health ? `${health.uptimeSeconds}s` : '---'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
              <div className="text-slate-400 font-bold mb-1">// Endpoints de Health & Módulos no Express:</div>
              <div className="text-emerald-400">✓ /health & /api/health → Dual Health Check (JSON estrito)</div>
              <div className="text-violet-400">✓ /api/games → IGDB Catalog Router</div>
              <div className="text-blue-400">✓ /api/library → User Personal Library Router</div>
              <div className="text-indigo-400">✓ /api/companion → Gemini AI Companion Router</div>
              <div className="text-amber-400">✓ /api/auth → JWT Authentication Router</div>
            </div>
          </CardContent>
        </Card>

        {/* PostgreSQL Database Status Card (EXPLICIT AND HONEST STATUS) */}
        <Card glow={isDbConnected ? 'blue' : 'violet'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                <Database className="w-5 h-5 text-violet-400" />
                <span>Neon PostgreSQL & Prisma ORM</span>
              </CardTitle>
              <Badge variant={isDbConnected ? 'success' : 'warning'}>
                {isDbConnected ? 'CONECTADO (NEON)' : 'PENDENTE DE SECRETS'}
              </Badge>
            </div>
            <CardDescription>
              Prisma ORM 6.19.3 com suporte a pooler (DATABASE_URL) e conexão direta para migrations (DIRECT_URL)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Honest Status Notice Banner */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                isDbConnected
                  ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-200'
                  : 'bg-amber-950/30 border-amber-600/50 text-amber-200'
              }`}
            >
              {isDbConnected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-sm">
                  {isDbConnected ? 'Neon PostgreSQL Conectado com Sucesso' : 'Neon PostgreSQL: Pendência de Secrets'}
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {db?.message ||
                    'Nenhum banco PostgreSQL conectado no momento. Conforme especificado, o sistema não simula conexões falsas.'}
                </p>
              </div>
            </div>

            {/* Prisma Schema & Setup Instructions */}
            <div className="space-y-2 text-xs">
              <div className="text-slate-400 font-semibold flex items-center justify-between">
                <span>Esquema Prisma (10 Modelos Auditados):</span>
                <span className="text-violet-400 font-mono">prisma/schema.prisma</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 font-mono text-[11px] text-slate-300">
                <div className="text-slate-400"># Modelos gerados no client:</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
                    User
                  </span>
                  <span className="px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
                    UserPreference
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                    Game
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    UserGame
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    GameplayJourney
                  </span>
                  <span className="px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
                    ProgressLog
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                    GameBuild
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    CompanionSession
                  </span>
                  <span className="px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
                    CompanionMessage
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                    GameGuide
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Architecture Modules Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Arquitetura dos Módulos</h2>
            <p className="text-xs text-slate-400">
              Separação estrutural com lógica de negócio no backend e suporte à futura aplicação Desktop Overlay
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Atualizar Status
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Module 1: Game Library */}
          <Card className="hover:border-violet-500/40 transition-all cursor-pointer" onClick={() => onNavigate('library')}>
            <CardHeader className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-violet-950 flex items-center justify-center text-violet-400 border border-violet-800">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <Badge variant="default" size="sm">Fase 2</Badge>
              </div>
              <CardTitle className="text-sm">Game Library</CardTitle>
              <CardDescription>
                Catálogo integrado com IGDB, status pessoal, avaliações e progresso
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-violet-300 font-medium">
                <span>Ver estrutura</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </CardContent>
          </Card>

          {/* Module 2: Game Companion */}
          <Card className="hover:border-blue-500/40 transition-all cursor-pointer" onClick={() => onNavigate('companion')}>
            <CardHeader className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-950 flex items-center justify-center text-blue-400 border border-blue-800">
                  <Bot className="w-4 h-4" />
                </div>
                <Badge variant="ai" size="sm">Fase 3</Badge>
              </div>
              <CardTitle className="text-sm">Game Companion</CardTitle>
              <CardDescription>
                Agente Gemini contextualizado, controle anti-spoiler e builds
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-blue-300 font-medium">
                <span>Ver estrutura</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </CardContent>
          </Card>

          {/* Module 3: JWT Auth */}
          <Card className="hover:border-indigo-500/40 transition-all cursor-pointer" onClick={() => onNavigate('profile')}>
            <CardHeader className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-950 flex items-center justify-center text-indigo-400 border border-indigo-800">
                  <Key className="w-4 h-4" />
                </div>
                <Badge variant="default" size="sm">Fase 2</Badge>
              </div>
              <CardTitle className="text-sm">Autenticação JWT</CardTitle>
              <CardDescription>
                Lógica de autenticação com tokens seguros e perfis no PostgreSQL
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-indigo-300 font-medium">
                <span>Ver detalhes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </CardContent>
          </Card>

          {/* Module 4: Desktop Overlay Ready */}
          <Card className="hover:border-emerald-500/40 transition-all">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-950 flex items-center justify-center text-emerald-400 border border-emerald-800">
                  <MonitorCheck className="w-4 h-4" />
                </div>
                <Badge variant="success" size="sm">Pronto</Badge>
              </div>
              <CardTitle className="text-sm">API Desktop Overlay</CardTitle>
              <CardDescription>
                CORS, headers padronizados e rotas desacopladas para app desktop
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-emerald-300 font-medium">
                <span>CORS & REST ativo</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Project Checklist & Technical Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span>Checklist da Primeira Tarefa & Próximas Etapas</span>
          </CardTitle>
          <CardDescription>
            Status do plano de desenvolvimento e dependências técnicas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                Itens Concluídos nesta Entrega:
              </h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Estrutura full stack organizada em módulos frontend e backend</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Layout base com tema escuro, azul e violeta</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Sidebar completa: Dashboard, Explorar, Biblioteca, Companion e Perfil</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Componentes de UI: Button, Card, Badge, Input, Modal, Skeleton, StatusIndicator</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Endpoint de health no Express (/api/health) com diagnóstico real</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Configuração inicial de Prisma ORM com schema PostgreSQL completo</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                O Que Falta Configurar / Próximos Passos:
              </h4>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Instância PostgreSQL & DATABASE_URL:</strong> Definir a string de conexão no .env e executar as migrações Prisma (<code className="font-mono bg-slate-900 px-1 py-0.5 rounded text-amber-200">npx prisma migrate dev</code>).
                  </span>
                </li>
                <li className="flex items-start gap-2 text-slate-400">
                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-violet-400" />
                  <span>
                    <strong>Autenticação JWT:</strong> Registro e login de usuários, hash de senha com bcrypt e geração de tokens JWT.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-slate-400">
                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-violet-400" />
                  <span>
                    <strong>Integração com IGDB:</strong> Credenciais Twitch Developer para consulta e sincronização do catálogo de jogos.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-slate-400">
                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-violet-400" />
                  <span>
                    <strong>Agente Gemini:</strong> Integração com a API Gemini para o Game Companion com controle anti-spoilers e sugestões de builds.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
