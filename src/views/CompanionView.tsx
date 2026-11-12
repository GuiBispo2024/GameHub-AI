import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Send,
  History,
  Gamepad2,
  Sword,
  Compass,
  AlertTriangle,
  ChevronDown,
  Info,
  Layers,
  Flame,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SpoilerLevel } from '../types';

export function CompanionView() {
  const [selectedGame, setSelectedGame] = useState('Elden Ring');
  const [spoilerLevel, setSpoilerLevel] = useState<SpoilerLevel>('CURRENT_CHAPTER');
  const [inputMessage, setInputMessage] = useState('');

  const spoilerOptions: { id: SpoilerLevel; label: string; desc: string; icon: any }[] = [
    {
      id: 'STRICT_NO_SPOILERS',
      label: 'Zero Spoilers',
      desc: 'Apenas mecânicas de combate, controles e dicas de sobrevivência.',
      icon: ShieldCheck,
    },
    {
      id: 'CURRENT_CHAPTER',
      label: 'Capítulo Atual',
      desc: 'Respeita o progresso informado. Nenhuma revelação de eventos futuros.',
      icon: ShieldAlert,
    },
    {
      id: 'MID_GAME_SAFE',
      label: 'Até Mid-Game',
      desc: 'Permite lore e itens intermediários, bloqueando o endgame.',
      icon: Flame,
    },
    {
      id: 'FULL_UNRESTRICTED',
      label: 'Sem Restrições',
      desc: 'Acesso irrestrito a todos os finais, lore profunda e chefes secretos.',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Game Companion AI</h1>
            <Badge variant="ai">Gemini 2.5 Engine</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Assistente inteligente gamer com chat contextualizado, estratégias de build e controle rigoroso de spoilers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="default">Agente Inteligente (Fase 3)</Badge>
        </div>
      </div>

      {/* Notice info banner */}
      <div className="p-4 rounded-2xl bg-violet-950/30 border border-violet-500/30 flex items-start gap-3 text-xs text-violet-200">
        <Info className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-sm text-violet-300">
            Estrutura da Arquitetura do Companion Concluída
          </div>
          <p className="text-slate-300 leading-relaxed">
            As rotas de backend <code className="bg-slate-900 px-1 py-0.5 rounded text-violet-300 font-mono">/api/companion/*</code> e os modelos do Prisma (<code className="bg-slate-900 px-1 py-0.5 rounded text-violet-300 font-mono">CompanionSession</code> e <code className="bg-slate-900 px-1 py-0.5 rounded text-violet-300 font-mono">CompanionMessage</code>) já estão implementados no código.
            A conexão com a API do Gemini será ativada no módulo dedicado de IA, mantendo a chave exclusivamente protegida no servidor.
          </p>
        </div>
      </div>

      {/* Configuration bar: Game selector & Spoiler Control */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Game Selector */}
        <Card className="p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
            <Gamepad2 className="w-4 h-4 text-violet-400" />
            <span>Jogo em Foco para o Chat:</span>
          </div>
          <select
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
            className="w-full bg-slate-950 text-sm text-white rounded-xl p-2.5 border border-slate-800 focus:outline-none focus:border-violet-500"
          >
            <option value="Elden Ring">Elden Ring (Progresso: 68%)</option>
            <option value="Baldur's Gate 3">Baldur's Gate 3 (Progresso: 42%)</option>
            <option value="Cyberpunk 2077">Cyberpunk 2077 (Progresso: 100%)</option>
            <option value="The Witcher 3">The Witcher 3 (Progresso: 15%)</option>
          </select>
        </Card>

        {/* Spoiler Controller Selector */}
        <Card className="p-4 md:col-span-2 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Controle Anti-Spoiler:</span>
            </span>
            <span className="text-[11px] text-violet-400 font-medium">Configuração Ativa</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {spoilerOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = spoilerLevel === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSpoilerLevel(opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-violet-950/80 border-violet-500 text-white shadow-md shadow-violet-950/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-violet-400' : 'text-slate-500'}`} />
                    {isSelected && <Check className="w-3.5 h-3.5 text-violet-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Main Chat Interface Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sessions Sidebar */}
        <Card className="hidden lg:block lg:col-span-1 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 pb-2 border-b border-slate-800">
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" />
              Histórico de Sessões
            </span>
            <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">3</span>
          </div>

          <div className="space-y-1.5">
            {[
              { title: 'Build de Sangramento & Arcano', date: 'Hoje, 14:20', active: true },
              { title: 'Fraquezas de Malenia', date: 'Ontem', active: false },
              { title: 'Rota de Minas de Pedras de Forja', date: '3 dias atrás', active: false },
            ].map((s, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                  s.active
                    ? 'bg-violet-950/60 text-violet-200 border border-violet-700/40'
                    : 'bg-slate-950/40 text-slate-400 hover:bg-slate-900/60'
                }`}
              >
                <div className="font-semibold truncate">{s.title}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.date}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Chat Conversation Area */}
        <Card glow="violet" className="lg:col-span-3 flex flex-col h-[520px]">
          {/* Chat Header */}
          <CardHeader className="p-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-violet-900/40">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Companion: {selectedGame}</span>
                  <Badge variant="ai" size="sm">Gemini AI</Badge>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Modo de proteção: {spoilerOptions.find((s) => s.id === spoilerLevel)?.label}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                Contexto: Montanha dos Gigantes
              </span>
            </div>
          </CardHeader>

          {/* Messages list preview */}
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {/* System initial message */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">GameHub Companion Inicializado:</span>
                <p className="mt-0.5 text-slate-400">
                  Estou contextualizado com o seu progresso em <strong>{selectedGame}</strong>.
                  O filtro anti-spoiler está definido para não revelar nada além do seu capítulo atual.
                  Como posso ajudar na sua gameplay hoje?
                </p>
              </div>
            </div>

            {/* Example User Message */}
            <div className="flex justify-end">
              <div className="max-w-md p-3.5 rounded-2xl rounded-tr-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs shadow-md">
                Qual é a melhor distribuição de atributos para uma build de Rios de Sangue (Rivers of Blood) no nível 110?
              </div>
            </div>

            {/* Example AI Message */}
            <div className="flex justify-start">
              <div className="max-w-lg p-3.5 rounded-2xl rounded-tl-sm bg-slate-950/90 border border-violet-500/20 text-slate-200 text-xs space-y-2 shadow-lg">
                <div className="flex items-center gap-1.5 text-violet-400 font-bold text-[11px]">
                  <Bot className="w-3.5 h-3.5" />
                  <span>Game Companion (Gemini AI Preview)</span>
                </div>
                <p>
                  Para o nível 110 com a <strong>Rios de Sangue</strong>, a escala primária é Arcano (para o acúmulo de hemorragia e dano de fogo) e Destreza.
                </p>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
                  <div>• Vigor: 45 (essencial para as Montanhas)</div>
                  <div>• Mente: 20 (para a Cinza de Guerra Lâmina Cadáver)</div>
                  <div>• Fortitude: 22 (armadura média e roll leve)</div>
                  <div>• Força: 12 (requisito da arma)</div>
                  <div>• Destreza: 35 (escala física)</div>
                  <div>• Arcano: 45 (soft cap de sangramento)</div>
                </div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verificado: Sem spoilers da campanha ou chefes finais.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Pergunte sobre builds, atributos, fraquezas de chefes ou rotas..."
                className="flex-1 bg-slate-900 text-sm text-slate-100 placeholder:text-slate-500 rounded-xl px-4 py-2.5 border border-slate-800 focus:outline-none focus:border-violet-500 transition-all"
              />
              <Button
                variant="primary"
                size="md"
                leftIcon={<Send className="w-4 h-4" />}
                disabled={!inputMessage.trim()}
              >
                Enviar
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
