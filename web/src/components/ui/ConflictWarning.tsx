
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/useApi';

// ============================================
// Conflict Warning Modal
// Shows when another user modifies something you're editing
// ============================================

interface ConflictWarningProps {
  onReload?: () => void;
}

export function ConflictWarning({ onReload }: ConflictWarningProps) {
  const { t } = useTranslation();
  const { hasConflict, conflictEvent, dismissConflict } = useWebSocket();
  const queryClient = useQueryClient();

  if (!hasConflict || !conflictEvent) return null;

  const handleReload = () => {
    // Refresh the relevant data
    switch (conflictEvent.resource) {
      case 'issue':
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.all });
        break;
      case 'doc':
        queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
        break;
      case 'release':
        queryClient.invalidateQueries({ queryKey: queryKeys.releases.all });
        break;
    }
    dismissConflict();
    onReload?.();
  };

  const isDeleted = conflictEvent.type.includes('deleted');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-lapis-900/50 backdrop-blur-sm"
        onClick={dismissConflict}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-parchment-50 rounded-tablet shadow-tablet border border-gold-300 overflow-hidden">
        {/* Warning header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gold-100 border-b border-gold-200">
          <div className="p-2 bg-gold-200 rounded-full">
            <AlertTriangle size={20} className="text-gold-700" />
          </div>
          <div>
            <h3 className="font-inscription text-lapis-600">
              {isDeleted ? t('conflict.deletedTitle') : t('conflict.title')}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-lapis-600">
            {isDeleted 
              ? t('conflict.deletedMessage')
              : t('conflict.message')
            }
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-parchment-100 border-t border-parchment-200">
          <button
            onClick={dismissConflict}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-lapis-600 
                       hover:bg-parchment-200 rounded-tablet transition-colors"
          >
            <X size={16} />
            {t('conflict.keepEditing')}
          </button>
          <button
            onClick={handleReload}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium 
                       bg-lapis-500 text-parchment-100 hover:bg-lapis-600 
                       rounded-tablet transition-colors"
          >
            <RefreshCw size={16} />
            {t('conflict.reload')}
          </button>
        </div>
      </div>
    </div>
  );
}
