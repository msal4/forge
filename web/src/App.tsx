import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useIsFetching } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AuthProvider, ProtectedRoute, useAuth } from './context/AuthContext';
import { KeyboardProvider } from './context/KeyboardContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { ToastProvider } from './context/ToastContext';
import { CommandMenu } from './components/ui/CommandMenu';
import { Layout } from './components/layout/Layout';
import { ConflictWarning } from './components/ui/ConflictWarning';
import { LoadingIndicator } from './components/ui/LoadingIndicator';
import { notificationsApi } from './api/notifications';

// i18n
import './i18n';

// Pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { IssuesPage } from './pages/IssuesPage';
import { DocsPage } from './pages/DocsPage';
import { ReleasesPage } from './pages/ReleasesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';

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
      
      {/* Protected routes with layout */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/" element={<HomePage />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/issues/:issueId" element={<IssuesPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:docId" element={<DocsPage />} />
        <Route path="/releases" element={<ReleasesPage />} />
        <Route path="/releases/:releaseId" element={<ReleasesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
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
        <AuthProvider>
          <WebSocketProvider>
            <KeyboardProvider>
              <ToastProvider>
                <GlobalLoadingIndicator />
                <CommandMenu />
                <ConflictWarning />
                <NotificationHandler />
                <AppRoutes />
              </ToastProvider>
            </KeyboardProvider>
          </WebSocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
