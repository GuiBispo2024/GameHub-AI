import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ id, label, error, helperText, className, containerClassName, children, required, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const messageId = `${selectId}-message`;
    const hasMessage = Boolean(error || helperText);

    return (
      <div className={twMerge('w-full space-y-1.5', containerClassName)}>
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-slate-200">
            {label}
            {required && <span className="text-rose-400 ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={hasMessage ? messageId : undefined}
            className={twMerge(
              clsx(
                'w-full min-h-[42px] appearance-none bg-[var(--bg-inset)] text-slate-100 rounded-xl border border-slate-700/80 pl-3.5 pr-9 py-2 text-sm transition-colors duration-150',
                'focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                error && 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/25',
                className
              )
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3"
            aria-hidden="true"
          />
        </div>
        {error && (
          <p id={messageId} role="alert" className="text-xs text-rose-300">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={messageId} className="text-xs text-slate-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
