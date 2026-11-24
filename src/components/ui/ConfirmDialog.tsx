import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
  error?: string | null;
  extraContent?: React.ReactNode;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  error,
  extraContent,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) onClose();
      }}
      title={title}
      description={description}
      maxWidth="sm"
    >
      <div className="space-y-4">
        <div className="text-sm text-slate-300 leading-relaxed">{message}</div>

        {extraContent}

        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant}
            size="sm"
            isLoading={isLoading}
            leftIcon={variant === 'danger' ? <Trash2 className="w-3.5 h-3.5" /> : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
