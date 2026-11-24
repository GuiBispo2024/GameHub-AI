import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080a12] disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-xl cursor-pointer';

    const variants = {
      primary:
        'bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-violet-950/40 hover:from-violet-500 hover:via-indigo-500 hover:to-blue-500 active:scale-[0.99]',
      secondary:
        'bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 border border-slate-700/70 active:scale-[0.99]',
      outline:
        'bg-slate-950/40 border border-slate-700/80 text-slate-200 hover:bg-slate-800/70 hover:border-violet-500/60 hover:text-white active:scale-[0.99]',
      ghost:
        'bg-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white',
      danger:
        'bg-rose-600/90 hover:bg-rose-500 text-white shadow-md shadow-rose-950/40 active:scale-[0.99]',
    };

    const sizes = {
      sm: 'text-xs px-3 py-2 min-h-[36px] gap-1.5',
      md: 'text-sm px-4 py-2.5 min-h-[40px] gap-2',
      lg: 'text-sm sm:text-base px-5 py-3 min-h-[44px] gap-2',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4 text-current shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && leftIcon && (
          <span className="shrink-0 inline-flex items-center" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {children !== undefined && children !== null && <span>{children}</span>}
        {!isLoading && rightIcon && (
          <span className="shrink-0 inline-flex items-center" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
