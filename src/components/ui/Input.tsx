import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightIcon, error, helperText, disabled, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={twMerge(
              clsx(
                'w-full bg-slate-900/90 text-slate-100 placeholder:text-slate-500 rounded-xl border border-slate-700/80 px-4 py-2.5 text-sm transition-all duration-200',
                'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
                className
              )
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-400 pl-1">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-400 pl-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
