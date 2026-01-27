import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { HotkeyBadge } from './HotkeyBadge';

// ============================================
// Confirm Dialog Component
// Custom modal to replace native browser confirm()
// ============================================

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  // Handle keyboard shortcuts (Escape to cancel, Enter to confirm)
  // Use a small delay before enabling to prevent the event that opened this dialog from also closing it
  const [isReady, setIsReady] = React.useState(false);
  
  React.useEffect(() => {
    if (!isOpen) {
      setIsReady(false);
      return;
    }
    // Small delay to prevent immediate closure from the same event
    const timer = setTimeout(() => setIsReady(true), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen || !isReady) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onConfirm();
      }
    };

    // Add at capture phase with highest priority
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isReady, onCancel, onConfirm]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      icon: 'bg-gold-100 dark:bg-gold-900/30 text-gold-600 dark:text-gold-400',
      confirmBtn: 'bg-gold-600 hover:bg-gold-700 text-white',
    },
    default: {
      icon: 'bg-lapis-100 dark:bg-lapis-800 text-lapis-600 dark:text-parchment-300',
      confirmBtn: 'bg-lapis-500 hover:bg-lapis-600 text-white',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-lapis-900/60 backdrop-blur-sm animate-fade-in"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {/* Dialog */}
      <div 
        className="
          relative w-full max-w-md
          bg-parchment-50 dark:bg-lapis-900 rounded-xl shadow-2xl
          border border-parchment-300 dark:border-lapis-700
          animate-scale-in
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6">
          <div className={`p-3 rounded-full ${styles.icon}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-inscription text-lapis-700 dark:text-parchment-200">
              {title}
            </h3>
            <p className="mt-2 text-sm text-lapis-600 dark:text-parchment-400">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-parchment-200 dark:hover:bg-lapis-800 text-stone-400 dark:text-parchment-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-parchment-200 dark:border-lapis-700 bg-parchment-100/50 dark:bg-lapis-800/50 rounded-b-xl">
          <button
            onClick={onCancel}
            className="
              px-4 py-2 rounded-lg text-sm font-medium
              text-lapis-600 dark:text-parchment-300 hover:bg-parchment-200 dark:hover:bg-lapis-700
              transition-colors inline-flex items-center gap-2
            "
          >
            {cancelLabel || t('common.cancel')}
            <HotkeyBadge keys="Escape" />
          </button>
          <button
            onClick={onConfirm}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium
              ${styles.confirmBtn}
              transition-colors inline-flex items-center gap-2
            `}
          >
            {confirmLabel || t('common.confirm')}
            <HotkeyBadge keys="Enter" variant="dark" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// useConfirmDialog Hook
// Provides a convenient way to show confirm dialogs
// ============================================

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((confirmed: boolean) => void) | null;
}

export function useConfirmDialog() {
  const [state, setState] = React.useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    resolve: null,
  });

  const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        ...options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    state.resolve?.(true);
    setState(s => ({ ...s, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    state.resolve?.(false);
    setState(s => ({ ...s, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const DialogComponent = React.useMemo(() => {
    return (
      <ConfirmDialog
        isOpen={state.isOpen}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        variant={state.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }, [state, handleConfirm, handleCancel]);

  return { confirm, DialogComponent };
}
