import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { queryKeys } from '../hooks/useApi';

// ============================================
// WebSocket Context - Real-time updates
// ============================================

// WebSocket event types from backend
export interface WSEvent {
  type: string;
  resource: 'issue' | 'doc' | 'release';
  id: number;
  data?: unknown;
  userId: number;
}

// Connection states
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface WebSocketContextValue {
  status: ConnectionStatus;
  // Track what's currently being edited (for conflict detection)
  setEditingItem: (resource: string | null, id: number | null) => void;
  editingResource: string | null;
  editingId: number | null;
  // Conflict state
  hasConflict: boolean;
  conflictEvent: WSEvent | null;
  dismissConflict: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// Hook for consuming WebSocket context
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// Reconnection config
const INITIAL_DELAY = 1000;   // 1 second
const MAX_DELAY = 30000;      // 30 seconds
const BACKOFF_MULTIPLIER = 2;

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [editingResource, setEditingResource] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictEvent, setConflictEvent] = useState<WSEvent | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_DELAY);
  const isUnmountingRef = useRef(false);

  // Set editing item (called by pages when user starts editing)
  const setEditingItem = useCallback((resource: string | null, id: number | null) => {
    setEditingResource(resource);
    setEditingId(id);
    // Clear any existing conflict when starting new edit
    if (resource !== null) {
      setHasConflict(false);
      setConflictEvent(null);
    }
  }, []);

  // Dismiss conflict warning
  const dismissConflict = useCallback(() => {
    setHasConflict(false);
    setConflictEvent(null);
  }, []);

  // Handle incoming WebSocket message
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      // Handle multiple messages separated by newlines (batched by server)
      const messages = event.data.split('\n').filter(Boolean);
      
      for (const msg of messages) {
        const data: WSEvent = JSON.parse(msg);
        
        console.log('[WS] Received:', data.type, data.resource, data.id);

        // Check for conflict (another user edited what we're editing)
        if (
          editingResource === data.resource &&
          editingId === data.id &&
          user?.id !== data.userId &&
          (data.type.includes('updated') || data.type.includes('deleted'))
        ) {
          console.log('[WS] Conflict detected!');
          setHasConflict(true);
          setConflictEvent(data);
        }

        // Invalidate relevant queries based on resource type
        switch (data.resource) {
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
      }
    } catch (err) {
      console.error('[WS] Error parsing message:', err);
    }
  }, [queryClient, editingResource, editingId, user?.id]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!isAuthenticated || isUnmountingRef.current) return;

    // Don't create new connection if one exists and is open or connecting
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        return;
      }
    }

    setStatus('connecting');

    // Determine WebSocket URL
    // In development (Vite on port 3000), connect directly to backend on port 8080
    // In production, use same host
    const isDev = import.meta.env.DEV;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = isDev ? 'localhost:8080' : window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws`;

    console.log('[WS] Connecting to', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmountingRef.current) {
        ws.close(1000, 'Component unmounted during connection');
        return;
      }
      console.log('[WS] Connected');
      setStatus('connected');
      reconnectDelayRef.current = INITIAL_DELAY; // Reset delay on successful connection
    };

    ws.onmessage = handleMessage;

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      wsRef.current = null;
      
      if (isUnmountingRef.current || !isAuthenticated) {
        setStatus('disconnected');
        return;
      }

      // Schedule reconnection with exponential backoff
      setStatus('reconnecting');
      const delay = reconnectDelayRef.current;
      console.log(`[WS] Reconnecting in ${delay}ms...`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(delay * BACKOFF_MULTIPLIER, MAX_DELAY);
        connect();
      }, delay);
    };
  }, [isAuthenticated, handleMessage]);

  // Effect to manage WebSocket connection lifecycle
  useEffect(() => {
    isUnmountingRef.current = false;

    if (isAuthenticated) {
      connect();
    }

    return () => {
      isUnmountingRef.current = true;
      
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, connect]);

  const value: WebSocketContextValue = {
    status,
    setEditingItem,
    editingResource,
    editingId,
    hasConflict,
    conflictEvent,
    dismissConflict,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
