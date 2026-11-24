import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  variant?: 'pills' | 'underline';
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  activeId,
  onChange,
  ariaLabel = 'Abas de navegação',
  variant = 'pills',
  className,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={twMerge(
        clsx(
          'flex items-center gap-1.5 overflow-x-auto scrollbar-none',
          variant === 'underline' && 'border-b border-slate-800 pb-1',
          className
        )
      )}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
              variant === 'pills' &&
                (isActive
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-950/40'
                  : 'bg-[var(--bg-inset)] text-slate-300 border border-slate-800 hover:text-white hover:border-slate-700'),
              variant === 'underline' &&
                (isActive
                  ? 'bg-violet-950/60 text-violet-200 border border-violet-500/40'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 border border-transparent')
            )}
          >
            {item.icon && (
              <span className="shrink-0 inline-flex items-center" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={clsx(
                  'text-[11px] tabular-nums',
                  isActive ? 'text-violet-100/90' : 'text-slate-500'
                )}
              >
                ({item.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
