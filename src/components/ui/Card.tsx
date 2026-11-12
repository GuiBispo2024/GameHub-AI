import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'none' | 'violet' | 'blue' | 'indigo';
}

export function Card({ className, glow = 'none', children, ...props }: CardProps) {
  const glowStyles = {
    none: '',
    violet: 'hover:shadow-[0_0_25px_rgba(139,92,246,0.25)] border-violet-500/30',
    blue: 'hover:shadow-[0_0_25px_rgba(59,130,246,0.25)] border-blue-500/30',
    indigo: 'hover:shadow-[0_0_25px_rgba(99,102,241,0.25)] border-indigo-500/30',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-800/80 transition-all duration-300 shadow-xl overflow-hidden',
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
    <div className={twMerge(clsx('p-5 border-b border-slate-800/60', className))} {...props}>
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
        clsx('text-lg font-semibold text-white tracking-tight flex items-center gap-2', className)
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
    <p className={twMerge(clsx('text-xs text-slate-400 mt-1', className))} {...props}>
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
    <div className={twMerge(clsx('p-5', className))} {...props}>
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
        clsx('p-5 pt-0 flex items-center justify-between border-t border-slate-800/40 mt-auto', className)
      )}
      {...props}
    >
      {children}
    </div>
  );
}
