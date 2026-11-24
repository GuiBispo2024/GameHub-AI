import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'wishlist'
    | 'playing'
    | 'completed'
    | 'backlog'
    | 'paused'
    | 'on_hold'
    | 'dropped'
    | 'ai'
    | 'warning'
    | 'success'
    | 'danger'
    | 'info';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-slate-800/90 text-slate-200 border-slate-700/80',
    wishlist: 'bg-sky-950/75 text-sky-200 border-sky-500/35',
    playing: 'bg-emerald-950/75 text-emerald-200 border-emerald-500/35',
    completed: 'bg-indigo-950/75 text-indigo-200 border-indigo-500/35',
    backlog: 'bg-amber-950/75 text-amber-200 border-amber-500/35',
    paused: 'bg-purple-950/75 text-purple-200 border-purple-500/35',
    on_hold: 'bg-purple-950/75 text-purple-200 border-purple-500/35',
    dropped: 'bg-rose-950/75 text-rose-200 border-rose-500/35',
    ai: 'bg-violet-950/80 text-violet-200 border-violet-500/40',
    warning: 'bg-amber-950/80 text-amber-200 border-amber-500/40',
    success: 'bg-emerald-950/80 text-emerald-200 border-emerald-500/40',
    danger: 'bg-rose-950/80 text-rose-200 border-rose-500/40',
    info: 'bg-blue-950/80 text-blue-200 border-blue-500/40',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 font-semibold',
    md: 'text-xs px-2.5 py-0.5 font-semibold',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 rounded-lg border whitespace-nowrap transition-colors',
          variants[variant],
          sizes[size],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
}
