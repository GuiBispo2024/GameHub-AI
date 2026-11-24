import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = 'Não foi possível carregar os dados',
  message,
  onRetry,
  retryLabel = 'Tentar novamente',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={twMerge(
        clsx(
          'p-5 rounded-2xl bg-rose-950/35 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
          className
        )
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-rose-100">{title}</h3>
          <p className="text-xs text-rose-200/85 mt-0.5 leading-relaxed break-words">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          className="shrink-0 border-rose-400/40 text-rose-100 hover:bg-rose-900/40"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
