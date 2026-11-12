import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Database, Server, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { DatabaseStatus } from '../../types';

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  serverOnline: boolean;
  dbStatus?: DatabaseStatus | null;
  compact?: boolean;
}

export function StatusIndicator({
  serverOnline,
  dbStatus,
  compact = false,
  className,
  ...props
}: StatusIndicatorProps) {
  const isDbConnected = dbStatus?.connected === true;
  const isPending = dbStatus?.status === 'PENDING_CONFIGURATION' || dbStatus?.configured === false;

  if (compact) {
    return (
      <div
        className={twMerge(
          clsx(
            'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border',
            !serverOnline && 'bg-red-950/70 text-red-300 border-red-800/50',
            serverOnline && isDbConnected && 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50',
            serverOnline && !isDbConnected && 'bg-amber-950/70 text-amber-300 border-amber-700/50',
            className
          )
        )}
        {...props}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={clsx(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              !serverOnline ? 'bg-red-400' : isDbConnected ? 'bg-emerald-400' : 'bg-amber-400'
            )}
          />
          <span
            className={clsx(
              'relative inline-flex rounded-full h-2 w-2',
              !serverOnline ? 'bg-red-500' : isDbConnected ? 'bg-emerald-500' : 'bg-amber-500'
            )}
          />
        </span>
        <span>
          {!serverOnline
            ? 'API Offline'
            : isDbConnected
            ? 'PostgreSQL Ativo'
            : 'PostgreSQL Pendente'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={twMerge(
        clsx(
          'p-3 rounded-xl border flex flex-col gap-2 text-xs transition-all',
          !serverOnline
            ? 'bg-red-950/40 border-red-800/40 text-red-200'
            : isDbConnected
            ? 'bg-emerald-950/30 border-emerald-700/40 text-emerald-200'
            : 'bg-amber-950/30 border-amber-700/40 text-amber-200',
          className
        )
      )}
      {...props}
    >
      <div className="flex items-center justify-between font-semibold">
        <span className="flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-blue-400" />
          Backend Express:
        </span>
        <span className="flex items-center gap-1">
          {serverOnline ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-mono">200 OK</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-red-400 font-mono">Desconectado</span>
            </>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between font-semibold">
        <span className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-violet-400" />
          PostgreSQL / Prisma:
        </span>
        <span className="flex items-center gap-1">
          {isDbConnected ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Conectado</span>
            </>
          ) : isPending ? (
            <>
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400">Pendente de URL</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-red-400">Erro de Conexão</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
