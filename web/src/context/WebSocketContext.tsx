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
  // Conflict state - when another user modifies the item being edited
  hasConflict: boolean;
  conflictEvent: WSEvent | null;
  dismissConflict: () => void;
  // Sync function - manually refresh the item being edited
  syncEditingItem: () => void;
  // Sync version - increments when user chooses to sync, forms can watch this to reload
  syncVersion: number;
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
  const [syncVersion, setSyncVersion] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_DELAY);
  const isUnmountingRef = useRef(false);
  
  // Use refs for values that change but shouldn't trigger reconnection
  const editingResourceRef = useRef(editingResource);
  const editingIdRef = useRef(editingId);
  const userIdRef = useRef(user?.id);
  
  // Keep refs in sync with state
  useEffect(() => { editingResourceRef.current = editingResource; }, [editingResource]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

  // Set editing item (called by pages when user starts editing)
  const setEditingItem = useCallback((resource: string | null, id: number | null) => {
    console.log('[WS] setEditingItem called:', { resource, id });
    setEditingResource(resource);
    setEditingId(id);
    // Also update refs immediately (don't wait for useEffect)
    editingResourceRef.current = resource;
    editingIdRef.current = id;
    // Clear any existing conflict when changing edit state
    setHasConflict(false);
    setConflictEvent(null);
  }, []);

  // Dismiss conflict warning
  const dismissConflict = useCallback(() => {
    setHasConflict(false);
    setConflictEvent(null);
  }, []);

  // Sync/refresh the item being edited (user chose to load latest changes)
  const syncEditingItem = useCallback(() => {
    if (editingResourceRef.current && editingIdRef.current) {
      const resource = editingResourceRef.current;
      const id = editingIdRef.current;
      
      // Invalidate the specific item's query to refetch
      switch (resource) {
        case 'issue':
          queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(id) });
          break;
        case 'doc':
          queryClient.invalidateQueries({ queryKey: queryKeys.docs.detail(id) });
          break;
        case 'release':
          queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(id) });
          break;
      }
    }
    // Increment sync version so forms know to reload their state
    setSyncVersion(v => v + 1);
    setHasConflict(false);
    setConflictEvent(null);
  }, [queryClient]);

  // Handle incoming WebSocket message - use refs to avoid recreating
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      // Handle multiple messages separated by newlines (batched by server)
      const messages = event.data.split('\n').filter(Boolean);
      
      for (const msg of messages) {
        const data: WSEvent = JSON.parse(msg);
        
        console.log('[WS] Received:', data.type, data.resource, data.id, 'from user:', data.userId);
        console.log('[WS] Current editing state:', {
          editingResource: editingResourceRef.current,
          editingId: editingIdRef.current,
          currentUserId: userIdRef.current
        });

        // Check if this affects the item being edited by the current user
        const isEditingThisItem = 
          editingResourceRef.current === data.resource &&
          editingIdRef.current === data.id;
        
        const isFromAnotherUser = userIdRef.current !== data.userId;

        console.log('[WS] Check:', { isEditingThisItem, isFromAnotherUser, eventType: data.type });

        // If another user modified the item we're editing, show conflict warning
        if (isEditingThisItem && isFromAnotherUser && 
            (data.type.includes('updated') || data.type.includes('deleted'))) {
          console.log('[WS] CONFLICT DETECTED - showing warning');
          setHasConflict(true);
          setConflictEvent(data);
          // Don't auto-refresh - let user decide to sync or keep their changes
          // But still update the list view
        } else {
          console.log('[WS] No conflict - reasons:', {
            notEditingThisItem: !isEditingThisItem,
            isOwnChange: !isFromAnotherUser,
            notUpdateOrDelete: !(data.type.includes('updated') || data.type.includes('deleted'))
          });
        }

        // Invalidate queries based on resource type
        // Skip the detail query for the item being edited to preserve user's work
        switch (data.resource) {
          case 'issue':
            // Always refresh the list
            queryClient.invalidateQueries({ queryKey: queryKeys.issues.list() });
            // Only refresh detail if not currently editing this item
            if (!isEditingThisItem) {
              queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(data.id) });
            }
            break;
          case 'doc':
            queryClient.invalidateQueries({ queryKey: queryKeys.docs.list() });
            if (!isEditingThisItem) {
              queryClient.invalidateQueries({ queryKey: queryKeys.docs.detail(data.id) });
            }
            break;
          case 'release':
            queryClient.invalidateQueries({ queryKey: queryKeys.releases.list() });
            if (!isEditingThisItem) {
              queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(data.id) });
            }
            break;
        }
      }
    } catch (err) {
      console.error('[WS] Error parsing message:', err);
    }
  }, [queryClient]); // Only depends on queryClient which is stable

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

    // Determine WebSocket URL - always use same host (Vite proxy handles dev)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

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
    syncEditingItem,
    syncVersion,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
