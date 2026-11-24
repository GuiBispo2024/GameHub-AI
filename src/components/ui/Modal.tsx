import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const target = dialogRef.current;
      if (!target) return;
      if (target.contains(document.activeElement) && document.activeElement !== target) {
        return;
      }

      const preferredInput = target.querySelector<HTMLElement>(
        '[data-autofocus], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      const bodyFocusable = target.querySelector<HTMLElement>(
        'button:not([data-modal-close]):not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      (preferredInput || bodyFocusable || target).focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={twMerge(
          clsx(
            'relative w-full max-h-[90vh] flex flex-col bg-[var(--bg-surface)] border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/60 p-4 sm:p-6 z-10 text-slate-100 focus:outline-none',
            maxWidths[maxWidth]
          )
        )}
      >
        <div className="flex items-start justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-base sm:text-lg font-bold text-white tracking-tight break-words">
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="text-xs text-slate-400 mt-1 break-words">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            data-modal-close="true"
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-xl p-2 min-w-[40px] min-h-[40px] inline-flex items-center justify-center hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            aria-label="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 overflow-y-auto pr-1 flex-1">{children}</div>
      </div>
    </div>
  );
}
