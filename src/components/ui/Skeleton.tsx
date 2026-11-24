import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={twMerge(
        clsx(
          'animate-pulse rounded-xl bg-slate-800/65 border border-slate-700/30',
          className
        )
      )}
      {...props}
    />
  );
}
