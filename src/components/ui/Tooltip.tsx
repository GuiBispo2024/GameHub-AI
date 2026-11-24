import React, { useId, useState } from 'react';
import { clsx } from 'clsx';

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom';
  className?: string;
}

export function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={clsx('relative inline-flex items-center', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {React.cloneElement(children, {
        'aria-describedby': visible ? tooltipId : undefined,
      } as React.HTMLAttributes<HTMLElement>)}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={clsx(
            'pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-medium text-slate-100 whitespace-nowrap shadow-xl',
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
