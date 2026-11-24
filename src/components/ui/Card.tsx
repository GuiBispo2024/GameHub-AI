import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'none' | 'violet' | 'blue' | 'indigo';
}

export function Card({ className, glow = 'none', children, ...props }: CardProps) {
  const glowStyles = {
    none: 'border-slate-800/80',
    violet: 'border-slate-800/80 hover:border-violet-500/40',
    blue: 'border-slate-800/80 hover:border-blue-500/40',
    indigo: 'border-slate-800/80 hover:border-indigo-500/40',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'bg-[var(--bg-surface)]/95 rounded-2xl border transition-colors duration-200 shadow-lg shadow-black/25 overflow-hidden',
          glowStyles[glow],
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx('p-4 sm:p-5 border-b border-slate-800/70', className))} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={twMerge(
        clsx('text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2', className)
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={twMerge(clsx('text-xs text-slate-400 mt-1 leading-relaxed', className))} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx('p-4 sm:p-5', className))} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx('p-4 sm:p-5 pt-3 flex items-center justify-between border-t border-slate-800/60 mt-auto', className)
      )}
      {...props}
    >
      {children}
    </div>
  );
}
