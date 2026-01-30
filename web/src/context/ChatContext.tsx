import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import type { OnlineUser } from './WebSocketContext';

// ============================================
// Chat Context - Ephemeral team & DM chat
// ============================================

// Chat message from WebSocket
export interface ChatMessage {
  id: string;
  room: string;
  from: ChatUser;
  content: string;
  timestamp: number;
}

export interface ChatUser {
  id: number;
  username: string;
  fullName: string;
}

// Room types
export type RoomType = 'team' | 'dm';

export interface ChatRoom {
  id: string;           // 'team' or 'dm:{id1}:{id2}'
  type: RoomType;
  name: string;         // 'Team' or user's name
  userId?: number;      // For DM: the other user's ID
  unreadCount: number;
}

interface ChatContextValue {
  // State
  messages: Record<string, ChatMessage[]>; // keyed by room ID
  rooms: ChatRoom[];
  activeRoom: string | null;
  isPanelOpen: boolean;
  onlineUsers: OnlineUser[];

  // Actions
  sendMessage: (content: string) => void;
  switchRoom: (roomId: string) => void;
  openDM: (userId: number, username: string, fullName: string) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  markRoomRead: (roomId: string) => void;
  
  // For receiving messages from WebSocket
  handleIncomingMessage: (message: ChatMessage) => void;
  handleChatError: (error: { code: string; message: string }) => void;
  setOnlineUsers: (users: OnlineUser[]) => void;
  
  // Unread state
  totalUnreadCount: number;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// Hook for consuming chat context
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

// Shared AudioContext (lazy-initialized on first user interaction)
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

// Two-tone notification chime
const playNotificationSound = async () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;

    // First tone — higher pitch
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 880;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone — lower pitch, slightly delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 660;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.3);
  } catch {
    // Audio not supported or blocked
  }
};

// Generate DM room ID (always sorted for consistency)
export function getDMRoomId(userId1: number, userId2: number): string {
  const sorted = [userId1, userId2].sort((a, b) => a - b);
  return `dm:${sorted[0]}:${sorted[1]}`;
}

// Parse DM room to get user IDs
export function parseDMRoom(roomId: string): [number, number] | null {
  if (!roomId.startsWith('dm:')) return null;
  const parts = roomId.split(':');
  if (parts.length !== 3) return null;
  const id1 = parseInt(parts[1], 10);
  const id2 = parseInt(parts[2], 10);
  if (isNaN(id1) || isNaN(id2)) return null;
  return [id1, id2];
}

interface ChatProviderProps {
  children: React.ReactNode;
  sendWebSocketMessage: (message: unknown) => void;
}

export function ChatProvider({ children, sendWebSocketMessage }: ChatProviderProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [dmRooms, setDmRooms] = useState<Map<string, { userId: number; username: string; fullName: string }>>(new Map());
  const [activeRoom, setActiveRoom] = useState<string | null>('team');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Ref to track panel state for notifications
  const isPanelOpenRef = useRef(isPanelOpen);
  const activeRoomRef = useRef(activeRoom);
  
  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen;
  }, [isPanelOpen]);
  
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  // Build rooms list
  const rooms = useMemo((): ChatRoom[] => {
    const roomList: ChatRoom[] = [
      {
        id: 'team',
        type: 'team',
        name: t('chat.teamChat'),
        unreadCount: unreadCounts['team'] || 0,
      },
    ];
    
    // Add DM rooms
    dmRooms.forEach((dmInfo, roomId) => {
      roomList.push({
        id: roomId,
        type: 'dm',
        name: dmInfo.fullName || dmInfo.username,
        userId: dmInfo.userId,
        unreadCount: unreadCounts[roomId] || 0,
      });
    });
    
    return roomList;
  }, [dmRooms, unreadCounts, t]);

  // Total unread count
  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  // Send message
  const sendMessage = useCallback((content: string) => {
    if (!activeRoom || !content.trim() || !user) return;
    
    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    sendWebSocketMessage({
      type: 'chat_message',
      id: messageId,
      room: activeRoom,
      content: content.trim(),
    });
  }, [activeRoom, user, sendWebSocketMessage]);

  // Switch room
  const switchRoom = useCallback((roomId: string) => {
    setActiveRoom(roomId);
  }, []);

  // Open DM with a user
  const openDM = useCallback((userId: number, username: string, fullName: string) => {
    if (!user) return;
    
    const roomId = getDMRoomId(user.id, userId);
    
    // Add DM room if it doesn't exist
    setDmRooms(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(roomId)) {
        newMap.set(roomId, { userId, username, fullName });
      }
      return newMap;
    });
    
    // Switch to the DM room and open panel
    setActiveRoom(roomId);
    setIsPanelOpen(true);
  }, [user]);

  // Handle incoming message from WebSocket
  const handleIncomingMessage = useCallback((message: ChatMessage) => {
    // Add message to the room (deduplicate by ID)
    setMessages(prev => {
      const roomMessages = prev[message.room] || [];
      if (roomMessages.some(m => m.id === message.id)) {
        return prev; // Already have this message
      }
      return { ...prev, [message.room]: [...roomMessages, message] };
    });
    
    // If it's a DM, ensure the room exists
    if (message.room.startsWith('dm:') && user) {
      const ids = parseDMRoom(message.room);
      if (ids) {
        const otherUserId = ids[0] === user.id ? ids[1] : ids[0];
        // Use sender info if it's from the other user
        if (message.from.id === otherUserId) {
          setDmRooms(prev => {
            const newMap = new Map(prev);
            if (!newMap.has(message.room)) {
              newMap.set(message.room, {
                userId: message.from.id,
                username: message.from.username,
                fullName: message.from.fullName,
              });
            }
            return newMap;
          });
        }
      }
    }
    
    // Handle notifications for messages from others
    const isFromSelf = message.from.id === user?.id;
    if (!isFromSelf) {
      const isActiveRoom = activeRoomRef.current === message.room;
      const panelOpen = isPanelOpenRef.current;
      
      // Increment unread count if not viewing this room
      if (!panelOpen || !isActiveRoom) {
        setUnreadCounts(prev => ({
          ...prev,
          [message.room]: (prev[message.room] || 0) + 1,
        }));
        
        // Play sound
        playNotificationSound();
        
        // Show toast
        const senderName = message.from.fullName || message.from.username;
        const preview = message.content.length > 50 
          ? message.content.slice(0, 50) + '...' 
          : message.content;
        showToast(`${senderName}: ${preview}`, 'info');
      }
    }
  }, [user, showToast]);

  // Handle chat errors
  const handleChatError = useCallback((error: { code: string; message: string }) => {
    if (error.code === 'rate_limit') {
      showToast(t('chat.rateLimitError'), 'error');
    } else {
      showToast(error.message, 'error');
    }
  }, [showToast, t]);

  // Toggle panel
  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev);
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // Mark a room's messages as read (called when user scrolls to bottom)
  const markRoomRead = useCallback((roomId: string) => {
    setUnreadCounts(prev => {
      if (!prev[roomId]) return prev;
      return { ...prev, [roomId]: 0 };
    });
  }, []);

  const value: ChatContextValue = {
    messages,
    rooms,
    activeRoom,
    isPanelOpen,
    onlineUsers,
    sendMessage,
    switchRoom,
    openDM,
    togglePanel,
    openPanel,
    closePanel,
    markRoomRead,
    handleIncomingMessage,
    handleChatError,
    setOnlineUsers,
    totalUnreadCount,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
