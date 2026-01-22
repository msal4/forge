import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useIsFetching } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AuthProvider, ProtectedRoute } from './context/AuthContext';
import { KeyboardProvider } from './context/KeyboardContext';
import { CommandMenu } from './components/ui/CommandMenu';
import { Layout } from './components/layout/Layout';

// i18n
import './i18n';

// Pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { IssuesPage } from './pages/IssuesPage';
import { DocsPage } from './pages/DocsPage';
import { ReleasesPage } from './pages/ReleasesPage';
import { SettingsPage } from './pages/SettingsPage';

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
      <span className="text-lg animate-pulse">𒀭</span>
      <span className="text-sm text-lapis-600 font-inscription">{t('common.loading')}</span>
    </div>
  );
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
          <KeyboardProvider>
            <GlobalLoadingIndicator />
            <CommandMenu />
            <AppRoutes />
          </KeyboardProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
