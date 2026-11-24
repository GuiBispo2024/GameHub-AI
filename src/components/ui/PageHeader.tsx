import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  backAction?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  backAction,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={twMerge(
        clsx('flex flex-col md:flex-row md:items-center justify-between gap-4', className)
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        {backAction && <div className="shrink-0">{backAction}</div>}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
