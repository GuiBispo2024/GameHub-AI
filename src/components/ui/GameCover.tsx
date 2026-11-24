import React, { useState, useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getSafeHttpUrl } from '../../utils/url';

export interface GameCoverProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackLabel?: string;
  iconSize?: 'sm' | 'md' | 'lg';
}

export function GameCover({
  src,
  alt,
  className,
  imgClassName,
  fallbackLabel,
  iconSize = 'md',
}: GameCoverProps) {
  const safeSrc = getSafeHttpUrl(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [safeSrc]);

  const iconDims = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-11 h-11',
  }[iconSize];

  return (
    <div
      className={twMerge(
        clsx(
          'relative overflow-hidden bg-[var(--bg-inset)] flex items-center justify-center',
          className
        )
      )}
    >
      {safeSrc && !hasError ? (
        <img
          src={safeSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setHasError(true)}
          className={twMerge(clsx('w-full h-full object-cover', imgClassName))}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gradient-to-br from-slate-900 via-slate-950 to-violet-950/30 text-slate-500 text-center gap-1.5">
          <Gamepad2 className={iconDims} aria-hidden="true" />
          {fallbackLabel && (
            <span className="text-[11px] font-medium text-slate-400 leading-tight px-1">
              {fallbackLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
