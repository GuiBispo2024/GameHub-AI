import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'wishlist' | 'playing' | 'completed' | 'backlog' | 'paused' | 'on_hold' | 'dropped' | 'ai' | 'warning' | 'success';
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
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    wishlist: 'bg-sky-950/70 text-sky-300 border-sky-500/40',
    playing: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
    completed: 'bg-indigo-950/70 text-indigo-300 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]',
    backlog: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
    paused: 'bg-purple-950/70 text-purple-300 border-purple-500/40',
    on_hold: 'bg-purple-950/70 text-purple-300 border-purple-500/40',
    dropped: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
    ai: 'bg-gradient-to-r from-violet-950/90 to-blue-950/90 text-violet-300 border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.25)]',
    warning: 'bg-yellow-950/80 text-yellow-300 border-yellow-500/50',
    success: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 font-medium tracking-wide',
    md: 'text-xs px-2.5 py-1 font-semibold tracking-wide',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 rounded-full border uppercase transition-colors',
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
