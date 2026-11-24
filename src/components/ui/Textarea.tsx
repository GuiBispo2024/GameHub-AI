import React, { useId } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      showCount = false,
      maxLength,
      value,
      className,
      containerClassName,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const messageId = `${textareaId}-message`;
    const hasMessage = Boolean(error || helperText);
    const currentLen = typeof value === 'string' ? value.length : 0;

    return (
      <div className={twMerge('w-full space-y-1.5', containerClassName)}>
        {(label || (showCount && maxLength !== undefined)) && (
          <div className="flex items-center justify-between gap-2">
            {label ? (
              <label htmlFor={textareaId} className="block text-xs font-semibold text-slate-200">
                {label}
                {required && <span className="text-rose-400 ml-0.5" aria-hidden="true">*</span>}
              </label>
            ) : (
              <span />
            )}
            {showCount && maxLength !== undefined && (
              <span className="text-[11px] text-slate-400 tabular-nums">
                {currentLen}/{maxLength}
              </span>
            )}
          </div>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          maxLength={maxLength}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          className={twMerge(
            clsx(
              'w-full bg-[var(--bg-inset)] text-slate-100 placeholder:text-slate-500 rounded-xl border border-slate-700/80 px-3.5 py-2.5 text-sm transition-colors duration-150 resize-none',
              'focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/25',
              className
            )
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
