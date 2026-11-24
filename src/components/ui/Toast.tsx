import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { clsx } from 'clsx';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
  title?: string;
}

interface ToastContextValue {
  showToast: (toast: { variant?: ToastVariant; title?: string; message: string; durationMs?: number }) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    ({
      variant = 'info',
      title,
      message,
      durationMs = 4500,
    }: {
      variant?: ToastVariant;
      title?: string;
      message: string;
      durationMs?: number;
    }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-3), { id, variant, title, message }]);

      if (durationMs > 0) {
        window.setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-96 pointer-events-none"
      >
        {toasts.map((toast) => {
          const Icon =
            toast.variant === 'success'
              ? CheckCircle2
              : toast.variant === 'error'
                ? AlertCircle
                : toast.variant === 'warning'
                  ? AlertTriangle
                  : Info;

          const styles = {
            success: 'bg-emerald-950/95 border-emerald-500/45 text-emerald-100',
            error: 'bg-rose-950/95 border-rose-500/45 text-rose-100',
            warning: 'bg-amber-950/95 border-amber-500/45 text-amber-100',
            info: 'bg-slate-900/95 border-violet-500/45 text-slate-100',
          }[toast.variant];

          const iconColor = {
            success: 'text-emerald-400',
            error: 'text-rose-400',
            warning: 'text-amber-400',
            info: 'text-violet-400',
          }[toast.variant];

          return (
            <div
              key={toast.id}
              role={toast.variant === 'error' ? 'alert' : 'status'}
              className={clsx(
                'pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl shadow-black/50 backdrop-blur-md text-xs',
                styles
              )}
            >
              <Icon className={clsx('w-4 h-4 shrink-0 mt-0.5', iconColor)} aria-hidden="true" />
              <div className="flex-1 min-w-0 space-y-0.5">
                {toast.title && <div className="font-bold text-white">{toast.title}</div>}
                <div className="leading-relaxed break-words">{toast.message}</div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                aria-label="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
      dismissToast: () => {},
    };
  }
  return ctx;
}
