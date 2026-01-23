import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useWebSocket, type ConnectionStatus as ConnectionStatusType } from '../../context/WebSocketContext';

// ============================================
// Connection Status Indicator
// Subtle dot that shows real-time connection status
// ============================================

export function ConnectionStatus() {
  const { t } = useTranslation();
  const { status } = useWebSocket();
  const [visible, setVisible] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Show indicator briefly on connection, hide after stable connection
  useEffect(() => {
    // Clear any existing timeout
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }

    if (status === 'connected') {
      // Show briefly then hide
      setVisible(true);
      const timeout = setTimeout(() => setVisible(false), 3000);
      setHideTimeout(timeout);
    } else if (status === 'reconnecting' || status === 'connecting') {
      // Always show when reconnecting
      setVisible(true);
    } else if (status === 'disconnected') {
      // Show disconnected state
      setVisible(true);
    }

    return () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, [status]);

  // Don't render if hidden
  if (!visible) return null;

  const getStatusConfig = (s: ConnectionStatusType) => {
    switch (s) {
      case 'connected':
        return {
          icon: <Wifi size={12} />,
          color: 'bg-green-500',
          textColor: 'text-green-600',
          label: t('ws.connected'),
        };
      case 'connecting':
        return {
          icon: <Loader2 size={12} className="animate-spin" />,
          color: 'bg-gold-500',
          textColor: 'text-gold-600',
          label: t('ws.connecting'),
        };
      case 'reconnecting':
        return {
          icon: <Loader2 size={12} className="animate-spin" />,
          color: 'bg-gold-500',
          textColor: 'text-gold-600',
          label: t('ws.reconnecting'),
        };
      case 'disconnected':
        return {
          icon: <WifiOff size={12} />,
          color: 'bg-red-500',
          textColor: 'text-red-600',
          label: t('ws.disconnected'),
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div 
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-full
        text-xs font-medium
        transition-all duration-300
        ${config.textColor} bg-parchment-100/80
      `}
      title={config.label}
    >
      <span className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />
      <span className="hidden sm:inline">{config.icon}</span>
    </div>
  );
}
