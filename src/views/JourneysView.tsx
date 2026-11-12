import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Swords,
  MapPin,
  Target,
  User,
  Clock,
  CheckCircle2,
  CircleDot,
  Edit3,
  Trash2,
  Shield,
  History,
  Wrench,
  Gamepad2,
  AlertCircle,
  X,
  Compass,
  Code2,
  ListChecks,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { ApiService } from '../services/api';
import {
  GameBuildItem,
  GameplayJourney,
  JourneyStatus,
  LibraryEntry,
  NavTab,
  ProgressLogItem,
} from '../types';

interface JourneysViewProps {
  selectedEntry: LibraryEntry | null;
  onSelectEntry: (entry: LibraryEntry | null) => void;
  onNavigate: (tab: NavTab) => void;
}

interface KeyValueRow {
  key: string;
  value: string;
}

function recordToRows(obj: Record<string, unknown> | undefined): KeyValueRow[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([key, val]) => ({
    key,
    value: typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
      ? String(val)
      : JSON.stringify(val),
  }));
}

function rowsToRecord(rows: KeyValueRow[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    const rawVal = row.value.trim();
    if (rawVal === '') {
      result[k] = '';
    } else if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
      result[k] = Number(rawVal);
    } else if (rawVal === 'true') {
      result[k] = true;
    } else if (rawVal === 'false') {
      result[k] = false;
    } else if (
      (rawVal.startsWith('[') && rawVal.endsWith(']')) ||
      (rawVal.startsWith('{') && rawVal.endsWith('}'))
    ) {
      try {
        result[k] = JSON.parse(rawVal);
      } catch {
        result[k] = rawVal;
      }
    } else {
      result[k] = rawVal;
    }
  }
  return result;
}

function formatJsonValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) return val.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export function JourneysView({ selectedEntry, onSelectEntry, onNavigate }: JourneysViewProps) {
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);

  const [journeys, setJourneys] = useState<GameplayJourney[]>([]);
  const [isLoadingJourneys, setIsLoadingJourneys] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);

  const [progressLogs, setProgressLogs] = useState<ProgressLogItem[]>([]);
  const [builds, setBuilds] = useState<GameBuildItem[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'builds'>('timeline');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Journey Form Modal State
  const [isJourneyModalOpen, setIsJourneyModalOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<GameplayJourney | null>(null);
  const [jName, setJName] = useState('');
  const [jCharName, setJCharName] = useState('');
  const [jCharClass, setJCharClass] = useState('');
  const [jLevel, setJLevel] = useState('');
  const [jArea, setJArea] = useState('');
  const [jObjective, setJObjective] = useState('');
  const [jHours, setJHours] = useState('0');
  const [jStatus, setJStatus] = useState<JourneyStatus>('IN_PROGRESS');
  const [jSetActive, setJSetActive] = useState(false);
  const [jNotes, setJNotes] = useState('');
  const [jFormError, setJFormError] = useState<string | null>(null);
  const [isSavingJourney, setIsSavingJourney] = useState(false);

  // Delete Journey Confirmation
  const [deletingJourney, setDeletingJourney] = useState<GameplayJourney | null>(null);
  const [isDeletingJourney, setIsDeletingJourney] = useState(false);

  // Progress Modal State
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [editingProgress, setEditingProgress] = useState<ProgressLogItem | null>(null);
  const [pArea, setPArea] = useState('');
  const [pQuest, setPQuest] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pPercent, setPPercent] = useState('');
  const [pLevel, setPLevel] = useState('');
  const [pHours, setPHours] = useState('0');
  const [pError, setPError] = useState<string | null>(null);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  const [deletingProgress, setDeletingProgress] = useState<ProgressLogItem | null>(null);
  const [isDeletingProgress, setIsDeletingProgress] = useState(false);

  // Build Modal State
  const [isBuildModalOpen, setIsBuildModalOpen] = useState(false);
  const [editingBuild, setEditingBuild] = useState<GameBuildItem | null>(null);
  const [bName, setBName] = useState('');
  const [bPlaystyle, setBPlaystyle] = useState('');
  const [bDescription, setBDescription] = useState('');
  const [bNotes, setBNotes] = useState('');
  const [bJsonMode, setBJsonMode] = useState(false);
  const [bAttrRows, setBAttrRows] = useState<KeyValueRow[]>([]);
  const [bEquipRows, setBEquipRows] = useState<KeyValueRow[]>([]);
  const [bAttrJson, setBAttrJson] = useState('{}');
  const [bEquipJson, setBEquipJson] = useState('{}');
  const [bError, setBError] = useState<string | null>(null);
  const [isSavingBuild, setIsSavingBuild] = useState(false);

  const [deletingBuild, setDeletingBuild] = useState<GameBuildItem | null>(null);
  const [isDeletingBuild, setIsDeletingBuild] = useState(false);

  const selectedJourney = journeys.find((j) => j.id === selectedJourneyId) || journeys[0] || null;

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  // Load user's library entries so user can switch games inside JourneysView
  const loadLibrary = useCallback(async () => {
    setIsLoadingLibrary(true);
    try {
      const res = await ApiService.getLibrary({ limit: 100, sort: 'recentlyUpdated' });
      setLibraryEntries(res.data);
      if (!selectedEntry && res.data.length > 0) {
        onSelectEntry(res.data[0]);
      }
    } catch (err: any) {
      if (err.status === 401) {
        onNavigate('auth');
        return;
      }
      setError(err.message || 'Erro ao carregar jogos da biblioteca.');
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [selectedEntry, onSelectEntry, onNavigate]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Load journeys for currently selected LibraryEntry
  const loadJourneys = useCallback(async () => {
    if (!selectedEntry) {
      setJourneys([]);
      setSelectedJourneyId(null);
      return;
    }

    setIsLoadingJourneys(true);
    setError(null);
    try {
      const res = await ApiService.getJourneys({ userGameId: selectedEntry.id, limit: 50 });
      setJourneys(res.data);
      setSelectedJourneyId((prev) => {
        if (prev && res.data.some((j) => j.id === prev)) return prev;
        const active = res.data.find((j) => j.isActive);
        return active?.id || res.data[0]?.id || null;
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar jornadas deste jogo.');
    } finally {
      setIsLoadingJourneys(false);
    }
  }, [selectedEntry]);

  useEffect(() => {
    loadJourneys();
  }, [loadJourneys]);

  // Load Progress Logs & Builds for selectedJourney
  const loadJourneyDetails = useCallback(async (journeyId: string | null) => {
    if (!journeyId) {
      setProgressLogs([]);
      setBuilds([]);
      return;
    }

    setIsLoadingDetails(true);
    try {
      const [logsData, buildsData] = await Promise.all([
        ApiService.getJourneyProgress(journeyId),
        ApiService.getJourneyBuilds(journeyId),
      ]);
      setProgressLogs(logsData);
      setBuilds(buildsData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar progresso e builds da jornada.');
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    loadJourneyDetails(selectedJourney?.id || null);
  }, [selectedJourney?.id, loadJourneyDetails]);

  // ---------------------------------------------------------------------------
  // Journey Handlers
  // ---------------------------------------------------------------------------

  const openCreateJourneyModal = () => {
    setEditingJourney(null);
    setJName('');
    setJCharName('');
    setJCharClass('');
    setJLevel('');
    setJArea('');
    setJObjective('');
    setJHours('0');
    setJStatus('IN_PROGRESS');
    setJSetActive(journeys.length === 0);
    setJNotes('');
    setJFormError(null);
    setIsJourneyModalOpen(true);
  };

  const openEditJourneyModal = (journey: GameplayJourney) => {
    setEditingJourney(journey);
    setJName(journey.name);
    setJCharName(journey.characterName || '');
    setJCharClass(journey.characterClass || '');
    setJLevel(journey.currentLevel !== null ? String(journey.currentLevel) : '');
    setJArea(journey.currentArea || '');
    setJObjective(journey.currentObjective || '');
    setJHours(String(journey.playtimeHours ?? 0));
    setJStatus(journey.status);
    setJSetActive(journey.isActive);
    setJNotes(journey.notes || '');
    setJFormError(null);
    setIsJourneyModalOpen(true);
  };

  const handleSaveJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    setJFormError(null);

    if (!jName.trim()) {
      setJFormError('Informe o nome da jornada.');
      return;
    }

    let parsedLevel: number | null = null;
    if (jLevel.trim() !== '') {
      const lvl = Number(jLevel);
      if (!Number.isInteger(lvl) || lvl < 0) {
        setJFormError('O nível deve ser um número inteiro maior ou igual a zero.');
        return;
      }
      parsedLevel = lvl;
    }

    const parsedHours = Number(jHours);
    if (isNaN(parsedHours) || parsedHours < 0) {
      setJFormError('As horas jogadas devem ser um número válido >= 0.');
      return;
    }

    setIsSavingJourney(true);
    try {
      if (editingJourney) {
        const updated = await ApiService.updateJourney(editingJourney.id, {
          name: jName.trim(),
          characterName: jCharName.trim() || null,
          characterClass: jCharClass.trim() || null,
          currentLevel: parsedLevel,
          currentArea: jArea.trim() || null,
          currentObjective: jObjective.trim() || null,
          playtimeHours: parsedHours,
          status: jStatus,
          notes: jNotes.trim() || null,
        });
        setFeedback(`Jornada "${updated.name}" atualizada.`);
      } else {
        const created = await ApiService.createJourney({
          userGameId: selectedEntry.id,
          name: jName.trim(),
          characterName: jCharName.trim() || null,
          characterClass: jCharClass.trim() || null,
          currentLevel: parsedLevel,
          currentArea: jArea.trim() || null,
          currentObjective: jObjective.trim() || null,
          playtimeHours: parsedHours,
          isCompleted: jStatus === 'COMPLETED',
          isActive: jSetActive,
          notes: jNotes.trim() || null,
        });
        setSelectedJourneyId(created.id);
        setFeedback(`Jornada "${created.name}" criada com sucesso.`);
      }

      setIsJourneyModalOpen(false);
      await loadJourneys();
    } catch (err: any) {
      setJFormError(err.message || 'Erro ao salvar jornada.');
    } finally {
      setIsSavingJourney(false);
    }
  };

  const handleActivateJourney = async (journey: GameplayJourney) => {
    try {
      const activated = await ApiService.activateJourney(journey.id);
      setSelectedJourneyId(activated.id);
      setFeedback(`"${activated.name}" agora é a jornada ativa deste jogo.`);
      await loadJourneys();
    } catch (err: any) {
      setError(err.message || 'Erro ao ativar jornada.');
    }
  };

  const handleConfirmDeleteJourney = async () => {
    if (!deletingJourney) return;
    setIsDeletingJourney(true);
    try {
      await ApiService.deleteJourney(deletingJourney.id);
      const removedName = deletingJourney.name;
      setDeletingJourney(null);
      if (selectedJourneyId === deletingJourney.id) {
        setSelectedJourneyId(null);
      }
      setFeedback(`Jornada "${removedName}" e seus registros vinculados foram removidos.`);
      await loadJourneys();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir jornada.');
    } finally {
      setIsDeletingJourney(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Progress Log Handlers
  // ---------------------------------------------------------------------------

  const openCreateProgressModal = () => {
    setEditingProgress(null);
    setPArea(selectedJourney?.currentArea || '');
    setPQuest('');
    setPDescription('');
    setPPercent('');
    setPLevel(selectedJourney?.currentLevel !== null && selectedJourney?.currentLevel !== undefined ? String(selectedJourney.currentLevel) : '');
    setPHours(String(selectedJourney?.playtimeHours ?? 0));
    setPError(null);
    setIsProgressModalOpen(true);
  };

  const openEditProgressModal = (log: ProgressLogItem) => {
    setEditingProgress(log);
    setPArea(log.areaName || '');
    setPQuest(log.questName || '');
    setPDescription(log.description);
    setPPercent(log.completionPercent !== null ? String(log.completionPercent) : '');
    setPLevel(log.playerLevelAtPoint !== null ? String(log.playerLevelAtPoint) : '');
    setPHours(String(log.hoursPlayedAtPoint ?? 0));
    setPError(null);
    setIsProgressModalOpen(true);
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJourney) return;
    setPError(null);

    if (!pDescription.trim()) {
      setPError('Descreva o marco ou evento ocorrido neste checkpoint.');
      return;
    }

    let parsedPercent: number | null = null;
    if (pPercent.trim() !== '') {
      const num = Number(pPercent);
      if (!Number.isInteger(num) || num < 0 || num > 100) {
        setPError('O percentual deve ser um número inteiro de 0 a 100 (ou deixe vazio).');
        return;
      }
      parsedPercent = num;
    }

    let parsedLevel: number | null = null;
    if (pLevel.trim() !== '') {
      const lvl = Number(pLevel);
      if (!Number.isInteger(lvl) || lvl < 0) {
        setPError('O nível deve ser um número inteiro >= 0.');
        return;
      }
      parsedLevel = lvl;
    }

    const parsedHours = Number(pHours);
    if (isNaN(parsedHours) || parsedHours < 0) {
      setPError('As horas devem ser >= 0.');
      return;
    }

    setIsSavingProgress(true);
    try {
      if (editingProgress) {
        await ApiService.updateProgressLog(editingProgress.id, {
          areaName: pArea.trim() || null,
          questName: pQuest.trim() || null,
          description: pDescription.trim(),
          completionPercent: parsedPercent,
          playerLevelAtPoint: parsedLevel,
          hoursPlayedAtPoint: parsedHours,
        });
        setFeedback('Registro de progresso atualizado.');
      } else {
        await ApiService.createProgressLog(selectedJourney.id, {
          areaName: pArea.trim() || null,
          questName: pQuest.trim() || null,
          description: pDescription.trim(),
          completionPercent: parsedPercent,
          playerLevelAtPoint: parsedLevel,
          hoursPlayedAtPoint: parsedHours,
        });
        setFeedback('Novo marco adicionado à linha do tempo.');
      }

      setIsProgressModalOpen(false);
      await Promise.all([loadJourneyDetails(selectedJourney.id), loadJourneys()]);
    } catch (err: any) {
      setPError(err.message || 'Erro ao salvar progresso.');
    } finally {
      setIsSavingProgress(false);
    }
  };

  const handleConfirmDeleteProgress = async () => {
    if (!deletingProgress || !selectedJourney) return;
    setIsDeletingProgress(true);
    try {
      await ApiService.deleteProgressLog(deletingProgress.id);
      setDeletingProgress(null);
      setFeedback('Marco de progresso removido.');
      await Promise.all([loadJourneyDetails(selectedJourney.id), loadJourneys()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir marco de progresso.');
    } finally {
      setIsDeletingProgress(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Build Handlers
  // ---------------------------------------------------------------------------

  const openCreateBuildModal = () => {
    setEditingBuild(null);
    setBName('');
    setBPlaystyle(selectedJourney?.characterClass || '');
    setBDescription('');
    setBNotes('');
    setBJsonMode(false);
    setBAttrRows([{ key: '', value: '' }]);
    setBEquipRows([{ key: '', value: '' }]);
    setBAttrJson('{\n  "Vigor": 40,\n  "Intelligence": 60\n}');
    setBEquipJson('{\n  "weapon": "Cajado Principal"\n}');
    setBError(null);
    setIsBuildModalOpen(true);
  };

  const openEditBuildModal = (build: GameBuildItem) => {
    setEditingBuild(build);
    setBName(build.name);
    setBPlaystyle(build.playstyle || '');
    setBDescription(build.description || '');
    setBNotes(build.notes || '');
    setBJsonMode(false);
    const attrRows = recordToRows(build.attributes);
    const equipRows = recordToRows(build.equipment);
    setBAttrRows(attrRows.length > 0 ? attrRows : [{ key: '', value: '' }]);
    setBEquipRows(equipRows.length > 0 ? equipRows : [{ key: '', value: '' }]);
    setBAttrJson(JSON.stringify(build.attributes || {}, null, 2));
    setBEquipJson(JSON.stringify(build.equipment || {}, null, 2));
    setBError(null);
    setIsBuildModalOpen(true);
  };

  const toggleBuildJsonMode = (toJson: boolean) => {
    if (toJson) {
      setBAttrJson(JSON.stringify(rowsToRecord(bAttrRows), null, 2));
      setBEquipJson(JSON.stringify(rowsToRecord(bEquipRows), null, 2));
      setBJsonMode(true);
    } else {
      try {
        const a = JSON.parse(bAttrJson || '{}');
        const eq = JSON.parse(bEquipJson || '{}');
        const aRows = recordToRows(a);
        const eRows = recordToRows(eq);
        setBAttrRows(aRows.length > 0 ? aRows : [{ key: '', value: '' }]);
        setBEquipRows(eRows.length > 0 ? eRows : [{ key: '', value: '' }]);
        setBError(null);
        setBJsonMode(false);
      } catch {
        setBError('JSON inválido. Corrija a sintaxe antes de voltar para o modo visual.');
      }
    }
  };

  const handleSaveBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJourney) return;
    setBError(null);

    if (!bName.trim()) {
      setBError('Informe o nome da build.');
      return;
    }

    let attributesPayload: Record<string, unknown> = {};
    let equipmentPayload: Record<string, unknown> = {};

    if (bJsonMode) {
      try {
        attributesPayload = JSON.parse(bAttrJson || '{}');
        equipmentPayload = JSON.parse(bEquipJson || '{}');
        if (
          typeof attributesPayload !== 'object' ||
          Array.isArray(attributesPayload) ||
          attributesPayload === null ||
          typeof equipmentPayload !== 'object' ||
          Array.isArray(equipmentPayload) ||
          equipmentPayload === null
        ) {
          setBError('Atributos e equipamentos devem ser objetos JSON ({ ... }).');
          return;
        }
      } catch {
        setBError('JSON inválido nos campos de atributos ou equipamentos.');
        return;
      }
    } else {
      attributesPayload = rowsToRecord(bAttrRows);
      equipmentPayload = rowsToRecord(bEquipRows);
    }

    setIsSavingBuild(true);
    try {
      if (editingBuild) {
        await ApiService.updateBuild(editingBuild.id, {
          name: bName.trim(),
          playstyle: bPlaystyle.trim() || null,
          description: bDescription.trim() || null,
          attributes: attributesPayload,
          equipment: equipmentPayload,
          notes: bNotes.trim() || null,
        });
        setFeedback(`Build "${bName.trim()}" atualizada.`);
      } else {
        await ApiService.createBuild(selectedJourney.id, {
          name: bName.trim(),
          playstyle: bPlaystyle.trim() || null,
          description: bDescription.trim() || null,
          attributes: attributesPayload,
          equipment: equipmentPayload,
          notes: bNotes.trim() || null,
        });
        setFeedback(`Build "${bName.trim()}" salva na jornada.`);
      }

      setIsBuildModalOpen(false);
      await Promise.all([loadJourneyDetails(selectedJourney.id), loadJourneys()]);
    } catch (err: any) {
      setBError(err.message || 'Erro ao salvar build.');
    } finally {
      setIsSavingBuild(false);
    }
  };

  const handleConfirmDeleteBuild = async () => {
    if (!deletingBuild || !selectedJourney) return;
    setIsDeletingBuild(true);
    try {
      await ApiService.deleteBuild(deletingBuild.id);
      setDeletingBuild(null);
      setFeedback('Build removida da jornada.');
      await Promise.all([loadJourneyDetails(selectedJourney.id), loadJourneys()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir build.');
    } finally {
      setIsDeletingBuild(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Empty / Loading States
  // ---------------------------------------------------------------------------

  if (isLoadingLibrary && libraryEntries.length === 0) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 lg:col-span-2 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!isLoadingLibrary && libraryEntries.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-violet-950/80 border border-violet-500/40 flex items-center justify-center mx-auto text-violet-400">
          <Compass className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Adicione um jogo antes de iniciar uma jornada
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Suas jornadas de gameplay, marcos de progresso e builds ficam vinculados aos títulos da sua Biblioteca Pessoal.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" onClick={() => onNavigate('explore')}>
            Explorar Catálogo IGDB
          </Button>
          <Button variant="outline" onClick={() => onNavigate('library')}>
            Ir para Biblioteca
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Game Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => onNavigate('library')}
            className="shrink-0"
          >
            Biblioteca
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              Jornadas de Gameplay
            </h1>
            <p className="text-xs text-slate-400 truncate">
              Acompanhe múltiplas campanhas, marcos cronológicos e builds personalizadas.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <select
            value={selectedEntry?.id || ''}
            onChange={(e) => {
              const found = libraryEntries.find((item) => item.id === e.target.value) || null;
              onSelectEntry(found);
            }}
            aria-label="Selecionar jogo da biblioteca"
            className="bg-slate-950 text-slate-100 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-violet-500 max-w-full sm:max-w-[240px]"
          >
            {libraryEntries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.game.title}
              </option>
            ))}
          </select>

          {selectedEntry && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={openCreateJourneyModal}
            >
              Nova Jornada
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Game Hero Summary */}
      {selectedEntry && (
        <Card glow="violet" className="bg-slate-900/80 border-slate-800 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="w-20 sm:w-24 aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
              {selectedEntry.game.coverUrl ? (
                <img
                  src={selectedEntry.game.coverUrl}
                  alt={selectedEntry.game.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <Gamepad2 className="w-7 h-7" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {selectedEntry.game.title}
                </h2>
                <Badge variant="ai" size="sm">
                  {journeys.length} {journeys.length === 1 ? 'Jornada' : 'Jornadas'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">
                {selectedEntry.game.summary || 'Gerencie suas campanhas, personagens e builds para este título.'}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                <span>{selectedEntry.game.developer || 'Estúdio não informado'}</span>
                <span>{selectedEntry.game.genres.slice(0, 3).join(' · ')}</span>
                <span className="text-blue-300 font-medium">{selectedEntry.hoursPlayed}h na biblioteca</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Journeys Switcher Strip */}
      {isLoadingJourneys ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : journeys.length === 0 ? (
        <div className="py-14 px-6 text-center rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-950/60 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-400">
            <Swords className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-white">Nenhuma jornada criada ainda</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Crie sua primeira jornada para registrar personagem, classe, região atual, objetivo, linha do tempo e builds.
            </p>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreateJourneyModal}>
            Criar Primeira Jornada
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Journey Cards Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {journeys.map((journey) => {
              const isSelected = selectedJourney?.id === journey.id;
              return (
                <div
                  key={journey.id}
                  onClick={() => setSelectedJourneyId(journey.id)}
                  className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-gradient-to-br from-violet-950/50 via-slate-900 to-indigo-950/40 border-violet-500/60 shadow-[0_0_20px_rgba(139,92,246,0.18)]'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {journey.isActive && (
                          <Badge variant="success" size="sm">
                            <CircleDot className="w-3 h-3" />
                            Ativa
                          </Badge>
                        )}
                        <Badge variant={journey.isCompleted ? 'completed' : 'playing'} size="sm">
                          {journey.isCompleted ? 'Concluída' : 'Em andamento'}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                        {journey.playtimeHours}h
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-white line-clamp-1">{journey.name}</h3>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      {journey.characterName && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <User className="w-3.5 h-3.5 text-violet-400" />
                          {journey.characterName}
                        </span>
                      )}
                      {journey.characterClass && (
                        <span className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-blue-400" />
                          {journey.characterClass}
                        </span>
                      )}
                      {journey.currentLevel !== null && (
                        <span className="text-amber-300 font-semibold tabular-nums">
                          Nível {journey.currentLevel}
                        </span>
                      )}
                    </div>

                    {journey.currentArea && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{journey.currentArea}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-800/80">
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {journey.progressLogsCount ?? 0} marcos · {journey.buildsCount ?? 0} builds
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {!journey.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[11px] px-2.5 py-1"
                          onClick={() => handleActivateJourney(journey)}
                        >
                          Ativar
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="p-1.5"
                        title="Editar jornada"
                        onClick={() => openEditJourneyModal(journey)}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:border-rose-500/50"
                        title="Excluir jornada"
                        onClick={() => setDeletingJourney(journey)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Journey Detail + Progress & Builds Workspace */}
          {selectedJourney && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Selected Journey Overview Card */}
              <Card className="lg:col-span-4 bg-slate-900/80 border-slate-800 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      {selectedJourney.isActive && <Badge variant="success" size="sm">Jornada Ativa</Badge>}
                      <Badge variant={selectedJourney.isCompleted ? 'completed' : 'playing'} size="sm">
                        {selectedJourney.isCompleted ? 'Concluída' : 'Em andamento'}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold text-white break-words">{selectedJourney.name}</h3>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                    onClick={() => openEditJourneyModal(selectedJourney)}
                  >
                    Editar
                  </Button>
                </div>

                <div className="space-y-3 text-xs pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-violet-400" /> Personagem
                    </span>
                    <span className="text-slate-100 font-semibold text-right">
                      {selectedJourney.characterName || 'Não definido'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-400" /> Classe / Arquétipo
                    </span>
                    <span className="text-slate-100 font-semibold text-right">
                      {selectedJourney.characterClass || 'Livre / Sem classe'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Nível Atual
                    </span>
                    <span className="text-amber-300 font-bold tabular-nums">
                      {selectedJourney.currentLevel !== null ? selectedJourney.currentLevel : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" /> Tempo Jogado
                    </span>
                    <span className="text-slate-100 font-semibold tabular-nums">
                      {selectedJourney.playtimeHours}h
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Região Atual
                    </span>
                    <p className="text-slate-200 font-medium">
                      {selectedJourney.currentArea || 'Região não informada'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-rose-400" /> Missão / Objetivo Atual
                    </span>
                    <p className="text-slate-200 leading-relaxed">
                      {selectedJourney.currentObjective || 'Nenhum objetivo registrado no momento.'}
                    </p>
                  </div>

                  {selectedJourney.notes && (
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 italic leading-relaxed">
                      &ldquo;{selectedJourney.notes}&rdquo;
                    </div>
                  )}
                </div>

                {!selectedJourney.isActive && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleActivateJourney(selectedJourney)}
                  >
                    Definir como Jornada Ativa
                  </Button>
                )}
              </Card>

              {/* Right Column: Progress Timeline & Builds Tabs */}
              <div className="lg:col-span-8 space-y-4 min-w-0">
                {/* Sub-navigation Tabs + Action CTA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('timeline')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                        activeSubTab === 'timeline'
                          ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/40'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      <History className="w-4 h-4" />
                      <span>Linha do Tempo ({progressLogs.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSubTab('builds')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                        activeSubTab === 'builds'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/40'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      <Wrench className="w-4 h-4" />
                      <span>Builds ({builds.length})</span>
                    </button>
                  </div>

                  {activeSubTab === 'timeline' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={openCreateProgressModal}
                    >
                      Registrar Progresso
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={openCreateBuildModal}
                    >
                      Nova Build
                    </Button>
                  )}
                </div>

                {/* Tab Content */}
                {isLoadingDetails ? (
                  <div className="space-y-3">
                    <Skeleton className="h-28 w-full rounded-2xl" />
                    <Skeleton className="h-28 w-full rounded-2xl" />
                  </div>
                ) : activeSubTab === 'timeline' ? (
                  progressLogs.length === 0 ? (
                    <div className="p-10 text-center rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                      <History className="w-8 h-8 text-slate-500 mx-auto" />
                      <h4 className="text-sm font-bold text-white">Nenhum marco registrado ainda</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Registre chefes derrotados, áreas exploradas ou missões concluídas em ordem cronológica.
                      </p>
                      <Button variant="secondary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreateProgressModal}>
                        Adicionar Primeiro Marco
                      </Button>
                    </div>
                  ) : (
                    <div className="relative pl-6 sm:pl-8 space-y-4 before:content-[''] before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-violet-500/70 before:via-indigo-500/50 before:to-slate-800">
                      {progressLogs.map((log, idx) => (
                        <div key={log.id} className="relative">
                          <span className="absolute -left-[21px] sm:-left-[25px] top-4 w-3.5 h-3.5 rounded-full bg-violet-500 ring-4 ring-slate-950 shadow-[0_0_10px_rgba(139,92,246,0.6)]" />

                          <Card className="bg-slate-900/80 border-slate-800 p-4 space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-violet-950/70 text-violet-300 border border-violet-700/40 tabular-nums">
                                  Marco #{idx + 1}
                                </span>
                                {log.areaName && (
                                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {log.areaName}
                                  </span>
                                )}
                                {log.questName && (
                                  <span className="text-xs font-semibold text-blue-300 flex items-center gap-1">
                                    <Target className="w-3 h-3" /> {log.questName}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-slate-500 tabular-nums">
                                  {new Date(log.createdAt).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openEditProgressModal(log)}
                                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                                  title="Editar registro"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingProgress(log)}
                                  className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/40"
                                  title="Excluir registro"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                              {log.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-400 tabular-nums">
                              {log.playerLevelAtPoint !== null && (
                                <span>Nível: <strong className="text-amber-300">{log.playerLevelAtPoint}</strong></span>
                              )}
                              {log.hoursPlayedAtPoint > 0 && (
                                <span>Horas: <strong className="text-slate-200">{log.hoursPlayedAtPoint}h</strong></span>
                              )}
                              {log.completionPercent !== null && (
                                <div className="flex items-center gap-2 flex-1 min-w-[140px] max-w-xs">
                                  <span>Progresso: <strong className="text-violet-300">{log.completionPercent}%</strong></span>
                                  <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                                      style={{ width: `${log.completionPercent}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </Card>
                        </div>
                      ))}
                    </div>
                  )
                ) : builds.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                    <Wrench className="w-8 h-8 text-slate-500 mx-auto" />
                    <h4 className="text-sm font-bold text-white">Nenhuma build cadastrada nesta jornada</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Salve distribuições de atributos, armas, magias, loadouts ou táticas para qualquer estilo de jogo.
                    </p>
                    <Button variant="secondary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreateBuildModal}>
                      Criar Primeira Build
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {builds.map((build) => {
                      const attrEntries = Object.entries(build.attributes || {});
                      const equipEntries = Object.entries(build.equipment || {});

                      return (
                        <Card key={build.id} glow="blue" className="bg-slate-900/80 border-slate-800 p-4 flex flex-col justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-bold text-base text-white break-words">{build.name}</h4>
                                {build.playstyle && (
                                  <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-700/40">
                                    {build.playstyle}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openEditBuildModal(build)}
                                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                                  title="Editar build"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingBuild(build)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40"
                                  title="Excluir build"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {build.description && (
                              <p className="text-xs text-slate-300 leading-relaxed">{build.description}</p>
                            )}

                            {attrEntries.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Atributos
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {attrEntries.map(([key, val]) => (
                                    <div
                                      key={key}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800/90 flex items-center justify-between gap-2 text-xs"
                                    >
                                      <span className="text-slate-400 truncate">{key}</span>
                                      <span className="text-violet-300 font-bold tabular-nums shrink-0">
                                        {formatJsonValue(val)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {equipEntries.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Equipamentos & Loadout
                                </div>
                                <div className="space-y-1">
                                  {equipEntries.map(([key, val]) => (
                                    <div
                                      key={key}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800/90 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                                    >
                                      <span className="text-slate-400 font-medium">{key}:</span>
                                      <span className="text-blue-200 break-words sm:text-right">
                                        {formatJsonValue(val)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {build.notes && (
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 italic">
                                &ldquo;{build.notes}&rdquo;
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create / Edit Journey */}
      <Modal
        isOpen={isJourneyModalOpen}
        onClose={() => !isSavingJourney && setIsJourneyModalOpen(false)}
        title={editingJourney ? 'Editar Jornada' : 'Nova Jornada de Gameplay'}
        description={selectedEntry?.game.title}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveJourney} className="space-y-4">
          {jFormError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{jFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nome da Jornada *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={jName}
                onChange={(e) => setJName(e.target.value)}
                placeholder="Ex: 1ª Run - Mago Puro, Modo Hardcore, Coop com Amigos..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nome do Personagem
              </label>
              <input
                type="text"
                maxLength={100}
                value={jCharName}
                onChange={(e) => setJCharName(e.target.value)}
                placeholder="Opcional (ex: Aurelia)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Classe / Arquétipo
              </label>
              <input
                type="text"
                maxLength={100}
                value={jCharClass}
                onChange={(e) => setJCharClass(e.target.value)}
                placeholder="Opcional (ex: Samurai, Netrunner)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Nível Atual</label>
              <input
                type="number"
                min={0}
                value={jLevel}
                onChange={(e) => setJLevel(e.target.value)}
                placeholder="Opcional"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Horas na Jornada
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={jHours}
                onChange={(e) => setJHours(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Região Atual</label>
              <input
                type="text"
                maxLength={150}
                value={jArea}
                onChange={(e) => setJArea(e.target.value)}
                placeholder="Ex: Liurnia dos Lagos"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Estado</label>
              <select
                value={jStatus}
                onChange={(e) => setJStatus(e.target.value as JourneyStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="COMPLETED">Concluída</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Missão ou Objetivo Atual
              </label>
              <input
                type="text"
                maxLength={300}
                value={jObjective}
                onChange={(e) => setJObjective(e.target.value)}
                placeholder="Ex: Encontrar a Chave Pedrilhante da Academia"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Notas da Jornada
              </label>
              <textarea
                rows={3}
                maxLength={2000}
                value={jNotes}
                onChange={(e) => setJNotes(e.target.value)}
                placeholder="Regras pessoais, observações ou objetivos de longo prazo..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            {!editingJourney && journeys.length > 0 && (
              <label className="sm:col-span-2 flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={jSetActive}
                  onChange={(e) => setJSetActive(e.target.checked)}
                  className="accent-violet-500 rounded"
                />
                <span>Definir imediatamente como a jornada ativa deste jogo</span>
              </label>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSavingJourney}
              onClick={() => setIsJourneyModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSavingJourney}>
              {editingJourney ? 'Salvar Jornada' : 'Criar Jornada'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Journey Confirmation */}
      <Modal
        isOpen={!!deletingJourney}
        onClose={() => !isDeletingJourney && setDeletingJourney(null)}
        title="Excluir Jornada"
        description="Esta ação é irreversível."
        maxWidth="sm"
      >
        {deletingJourney && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir a jornada{' '}
              <strong className="text-white">{deletingJourney.name}</strong>? Todos os marcos do
              histórico de progresso e builds vinculados a ela também serão removidos.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeletingJourney}
                onClick={() => setDeletingJourney(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isDeletingJourney}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={handleConfirmDeleteJourney}
              >
                Confirmar Exclusão
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Create / Edit Progress Log */}
      <Modal
        isOpen={isProgressModalOpen}
        onClose={() => !isSavingProgress && setIsProgressModalOpen(false)}
        title={editingProgress ? 'Editar Marco de Progresso' : 'Registrar Novo Progresso'}
        description={selectedJourney?.name}
        maxWidth="md"
      >
        <form onSubmit={handleSaveProgress} className="space-y-4">
          {pError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{pError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Região / Área</label>
              <input
                type="text"
                maxLength={150}
                value={pArea}
                onChange={(e) => setPArea(e.target.value)}
                placeholder="Opcional (ex: Castelo Tempesvéu)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Missão / Chefe / Checkpoint
              </label>
              <input
                type="text"
                maxLength={150}
                value={pQuest}
                onChange={(e) => setPQuest(e.target.value)}
                placeholder="Opcional (ex: Derrotei Godrick)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Conclusão (%) — Opcional
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={pPercent}
                onChange={(e) => setPPercent(e.target.value)}
                placeholder="Deixe vazio se não aplicável"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 tabular-nums"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Nível</label>
                <input
                  type="number"
                  min={0}
                  value={pLevel}
                  onChange={(e) => setPLevel(e.target.value)}
                  placeholder="Opcional"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Horas</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={pHours}
                  onChange={(e) => setPHours(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 tabular-nums"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Descrição do Progresso *
              </label>
              <textarea
                rows={4}
                required
                maxLength={2000}
                value={pDescription}
                onChange={(e) => setPDescription(e.target.value)}
                placeholder="Descreva o que foi conquistado, descoberto ou decisões tomadas neste ponto da jornada..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSavingProgress}
              onClick={() => setIsProgressModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSavingProgress}>
              {editingProgress ? 'Salvar Alterações' : 'Registrar Marco'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Progress Confirmation */}
      <Modal
        isOpen={!!deletingProgress}
        onClose={() => !isDeletingProgress && setDeletingProgress(null)}
        title="Excluir Registro de Progresso"
        maxWidth="sm"
      >
        {deletingProgress && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Remover este marco da linha do tempo?
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 line-clamp-3">
              {deletingProgress.description}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeletingProgress}
                onClick={() => setDeletingProgress(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isDeletingProgress}
                onClick={handleConfirmDeleteProgress}
              >
                Excluir
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Create / Edit Build */}
      <Modal
        isOpen={isBuildModalOpen}
        onClose={() => !isSavingBuild && setIsBuildModalOpen(false)}
        title={editingBuild ? 'Editar Build' : 'Criar Build do Personagem'}
        description={selectedJourney?.name}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveBuild} className="space-y-4">
          {bError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{bError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nome da Build *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                placeholder="Ex: Mago Lunar, Netrunner Furtivo"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Estilo de Jogo</label>
              <input
                type="text"
                maxLength={100}
                value={bPlaystyle}
                onChange={(e) => setBPlaystyle(e.target.value)}
                placeholder="Ex: Dano à distância / Bleed"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Descrição</label>
              <input
                type="text"
                maxLength={2000}
                value={bDescription}
                onChange={(e) => setBDescription(e.target.value)}
                placeholder="Resumo da sinergia principal da build..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Toggle Visual Key-Value vs Advanced JSON */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300">
              Atributos e Equipamentos (Estrutura Flexível)
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => bJsonMode && toggleBuildJsonMode(false)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                  !bJsonMode ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" /> Visual
              </button>
              <button
                type="button"
                onClick={() => !bJsonMode && toggleBuildJsonMode(true)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                  bJsonMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" /> JSON
              </button>
            </div>
          </div>

          {!bJsonMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Attributes Key-Value Builder */}
              <div className="space-y-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-300">Atributos / Stats</span>
                  <button
                    type="button"
                    onClick={() => setBAttrRows((r) => [...r, { key: '', value: '' }])}
                    className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {bAttrRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(e) =>
                          setBAttrRows((prev) =>
                            prev.map((item, idx) => (idx === i ? { ...item, key: e.target.value } : item))
                          )
                        }
                        placeholder="Chave (ex: Vigor)"
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                      />
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) =>
                          setBAttrRows((prev) =>
                            prev.map((item, idx) => (idx === i ? { ...item, value: e.target.value } : item))
                          )
                        }
                        placeholder="Valor (ex: 40)"
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setBAttrRows((prev) =>
                            prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [{ key: '', value: '' }]
                          )
                        }
                        className="p-1 text-slate-500 hover:text-rose-400 shrink-0"
                        title="Remover linha"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment Key-Value Builder */}
              <div className="space-y-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300">Equipamentos / Perks</span>
                  <button
                    type="button"
                    onClick={() => setBEquipRows((r) => [...r, { key: '', value: '' }])}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {bEquipRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(e) =>
                          setBEquipRows((prev) =>
                            prev.map((item, idx) => (idx === i ? { ...item, key: e.target.value } : item))
                          )
                        }
                        placeholder="Slot (ex: Arma)"
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) =>
                          setBEquipRows((prev) =>
                            prev.map((item, idx) => (idx === i ? { ...item, value: e.target.value } : item))
                          )
                        }
                        placeholder="Item (ex: Véu da Lua)"
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setBEquipRows((prev) =>
                            prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [{ key: '', value: '' }]
                          )
                        }
                        className="p-1 text-slate-500 hover:text-rose-400 shrink-0"
                        title="Remover linha"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-violet-300 mb-1">
                  attributes (JSON)
                </label>
                <textarea
                  rows={5}
                  value={bAttrJson}
                  onChange={(e) => setBAttrJson(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-300 mb-1">
                  equipment (JSON)
                </label>
                <textarea
                  rows={5}
                  value={bEquipJson}
                  onChange={(e) => setBEquipJson(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Observações / Estratégia
            </label>
            <textarea
              rows={2}
              maxLength={2000}
              value={bNotes}
              onChange={(e) => setBNotes(e.target.value)}
              placeholder="Rotação de habilidades, fraquezas cobertas ou dicas de uso..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSavingBuild}
              onClick={() => setIsBuildModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSavingBuild}>
              {editingBuild ? 'Salvar Build' : 'Criar Build'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Build Confirmation */}
      <Modal
        isOpen={!!deletingBuild}
        onClose={() => !isDeletingBuild && setDeletingBuild(null)}
        title="Excluir Build"
        maxWidth="sm"
      >
        {deletingBuild && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir a build{' '}
              <strong className="text-white">{deletingBuild.name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeletingBuild}
                onClick={() => setDeletingBuild(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isDeletingBuild}
                onClick={handleConfirmDeleteBuild}
              >
                Excluir Build
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
