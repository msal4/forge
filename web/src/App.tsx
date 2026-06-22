import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useIsFetching } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AuthProvider, ProtectedRoute, useAuth } from './context/AuthContext';
import { WorkspaceProvider, WorkspaceRootRedirect } from './context/WorkspaceContext';
import { KeyboardProvider } from './context/KeyboardContext';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { CommandMenu } from './components/ui/CommandMenu';
import { Layout } from './components/layout/Layout';
import { ConflictWarning } from './components/ui/ConflictWarning';
import { LoadingIndicator } from './components/ui/LoadingIndicator';
import { ChatPanel } from './components/chat';
import { notificationsApi } from './api/notifications';

// i18n
import './i18n';

// Pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { InvitePage } from './pages/InvitePage';
import { IssuesPage } from './pages/IssuesPage';
import { DocsPage } from './pages/DocsPage';
import { ReleasesPage } from './pages/ReleasesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { DebugPage } from './pages/DebugPage';
import { LegacyPathRedirect } from './components/routing/LegacyPathRedirect';

// ============================================
// Sarray Forge - Main Application
// ============================================

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Global loading indicator
function GlobalLoadingIndicator() {
  const isFetching = useIsFetching();
  const { t } = useTranslation();
  
  if (!isFetching) return null;
  
  return (
    <div className="fixed top-4 ltr:right-4 rtl:left-4 z-50 flex items-center gap-2 px-3 py-2 bg-parchment-50 border border-parchment-300 rounded-tablet shadow-tablet">
      <LoadingIndicator size="md" inline />
      <span className="text-sm text-lapis-600 font-inscription">{t('common.loading')}</span>
    </div>
  );
}

// Wrapper that provides WebSocket send function to ChatProvider
function ChatProviderWithWebSocket({ children }: { children: React.ReactNode }) {
  const { sendMessage } = useWebSocket();
  return (
    <ChatProvider sendWebSocketMessage={sendMessage}>
      <ChatBridge />
      {children}
    </ChatProvider>
  );
}

// Bridge between Chat and WebSocket contexts
function ChatBridge() {
  const { setChatHandlers, onlineUsers } = useWebSocket();
  const { handleIncomingMessage, handleChatError, setOnlineUsers } = useChat();

  useEffect(() => {
    // Register chat handlers with WebSocket
    setChatHandlers({
      onChatMessage: handleIncomingMessage,
      onChatError: handleChatError,
      onPresenceUpdate: setOnlineUsers,
    });

    // Cleanup on unmount
    return () => {
      setChatHandlers(null);
    };
  }, [setChatHandlers, handleIncomingMessage, handleChatError, setOnlineUsers]);

  // Sync online users when they change
  useEffect(() => {
    setOnlineUsers(onlineUsers);
  }, [onlineUsers, setOnlineUsers]);

  return null;
}

// Handle ?notif= query param to mark notifications as read
// This runs globally so clicking Telegram links auto-marks the notification
function NotificationHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const notifId = searchParams.get('notif');
    if (notifId && user) {
      const id = parseInt(notifId, 10);
      if (!isNaN(id)) {
        // Mark notification as read
        notificationsApi.markRead(id).catch((err) => {
          console.error('Failed to mark notification as read:', err);
        });
        
        // Remove the notif param from URL (keep other params)
        searchParams.delete('notif');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [location.pathname, searchParams, setSearchParams, user]);

  return null;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />

      {/* Legacy redirects */}
      <Route path="/" element={<WorkspaceRootRedirect />} />
      <Route path="/issues/*" element={<LegacyPathRedirect />} />
      <Route path="/docs/*" element={<LegacyPathRedirect />} />
      <Route path="/releases/*" element={<LegacyPathRedirect />} />
      <Route path="/settings" element={<LegacyPathRedirect />} />
      <Route path="/debug" element={<LegacyPathRedirect />} />

      {/* Protected routes with layout */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/w/:workspaceKey" element={<HomePage />} />
        <Route path="/w/:workspaceKey/issues" element={<IssuesPage />} />
        <Route path="/w/:workspaceKey/issues/:issueId" element={<IssuesPage />} />
        <Route path="/w/:workspaceKey/docs" element={<DocsPage />} />
        <Route path="/w/:workspaceKey/docs/:docId" element={<DocsPage />} />
        <Route path="/w/:workspaceKey/releases" element={<ReleasesPage />} />
        <Route path="/w/:workspaceKey/releases/:releaseId" element={<ReleasesPage />} />
        <Route path="/w/:workspaceKey/settings" element={<SettingsPage />} />
        <Route path="/w/:workspaceKey/debug" element={<DebugPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <WebSocketProvider>
                <KeyboardProvider>
                  <ToastProvider>
                    <ChatProviderWithWebSocket>
                      <GlobalLoadingIndicator />
                      <CommandMenu />
                      <ConflictWarning />
                      <NotificationHandler />
                      <ChatPanel />
                      <AppRoutes />
                    </ChatProviderWithWebSocket>
                  </ToastProvider>
                </KeyboardProvider>
              </WebSocketProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
