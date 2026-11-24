import React, { useId } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      className,
      containerClassName,
      leftIcon,
      rightIcon,
      error,
      helperText,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const messageId = `${inputId}-message`;
    const hasMessage = Boolean(error || helperText);

    return (
      <div className={twMerge('w-full space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-200"
          >
            {label}
            {required && <span className="text-rose-400 ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div
              className="absolute left-3.5 flex items-center pointer-events-none text-slate-400"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={hasMessage ? messageId : undefined}
            className={twMerge(
              clsx(
                'w-full min-h-[42px] bg-[var(--bg-inset)] text-slate-100 placeholder:text-slate-500 rounded-xl border border-slate-700/80 px-3.5 py-2 text-sm transition-colors duration-150',
                'focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                error && 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/25',
                className
              )
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
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

Input.displayName = 'Input';
