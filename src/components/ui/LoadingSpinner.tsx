import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({
  label = 'Carregando...',
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={twMerge(clsx('inline-flex items-center gap-2 text-slate-300', className))}
    >
      <Loader2 className={clsx('animate-spin text-violet-400 shrink-0', sizes[size])} aria-hidden="true" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
