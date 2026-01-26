import { useTranslation } from 'react-i18next';
import { Wifi, WifiOff } from 'lucide-react';
import { LoadingIndicator } from './LoadingIndicator';
import { useWebSocket, type ConnectionStatus as ConnectionStatusType } from '../../context/WebSocketContext';

// ============================================
// Connection Status Indicator
// Subtle dot that shows real-time connection status
// Always visible - minimal when connected, prominent when not
// ============================================

export function ConnectionStatus() {
  const { t } = useTranslation();
  const { status } = useWebSocket();
  const isConnected = status === 'connected';

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
          icon: <LoadingIndicator size="xs" inline />,
          color: 'bg-gold-500',
          textColor: 'text-gold-600',
          label: t('ws.connecting'),
        };
      case 'reconnecting':
        return {
          icon: <LoadingIndicator size="xs" inline />,
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
      {/* Dot - always shown, no pulse when connected for subtlety */}
      <span className={`w-2 h-2 rounded-full ${config.color} ${!isConnected ? 'animate-pulse' : ''}`} />
      {/* Icon - hidden when connected for minimal footprint */}
      {!isConnected && (
        <span className="hidden sm:inline">{config.icon}</span>
      )}
    </div>
  );
}
