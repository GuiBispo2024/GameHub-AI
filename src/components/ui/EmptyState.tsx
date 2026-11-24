import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'py-12 px-6 text-center rounded-2xl bg-[var(--bg-surface)]/75 border border-slate-800/80 space-y-4',
          className
        )
      )}
    >
      <div
        className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto text-violet-300"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="max-w-md mx-auto space-y-1.5">
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{description}</p>
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {secondaryAction}
          {action}
        </div>
      )}
    </div>
  );
}
