import { LibraryStatus, SpoilerLevel } from '../types';

export const LIBRARY_STATUS_META: Record<
  LibraryStatus,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeVariant: 'wishlist' | 'backlog' | 'playing' | 'completed' | 'paused' | 'dropped';
  }
> = {
  PLAYING: {
    label: 'Jogando',
    shortLabel: 'Jogando',
    description: 'Em andamento no momento',
    badgeVariant: 'playing',
  },
  BACKLOG: {
    label: 'Pretendo jogar',
    shortLabel: 'Backlog',
    description: 'Salvar na fila para jogar em breve',
    badgeVariant: 'backlog',
  },
  COMPLETED: {
    label: 'Concluído',
    shortLabel: 'Concluído',
    description: 'Campanha finalizada ou zerado',
    badgeVariant: 'completed',
  },
  WISHLIST: {
    label: 'Desejado',
    shortLabel: 'Desejado',
    description: 'Lista de desejos / interesse futuro',
    badgeVariant: 'wishlist',
  },
  PAUSED: {
    label: 'Pausado',
    shortLabel: 'Pausado',
    description: 'Interrompido temporariamente',
    badgeVariant: 'paused',
  },
  DROPPED: {
    label: 'Abandonado',
    shortLabel: 'Abandonado',
    description: 'Não pretende continuar',
    badgeVariant: 'dropped',
  },
};

export function formatReleaseYear(dateStr?: string | null): string {
  if (!dateStr) return 'TBA';
  const year = new Date(dateStr).getFullYear();
  return Number.isNaN(year) ? 'TBA' : String(year);
}

export function formatFullDateBR(dateStr?: string | null): string {
  if (!dateStr) return 'Não informada';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatShortDateBR(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function formatHours(hours?: number | null): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '0h';
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

export function getSpoilerLabel(level: SpoilerLevel): string {
  switch (level) {
    case 'STRICT_NO_SPOILERS':
      return 'Zero Spoilers';
    case 'CURRENT_CHAPTER':
      return 'Capítulo Atual';
    case 'MID_GAME_SAFE':
      return 'Até Mid-Game';
    case 'FULL_UNRESTRICTED':
      return 'Sem Restrições';
    default:
      return 'Capítulo Atual';
  }
}
