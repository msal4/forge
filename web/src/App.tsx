import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useIsFetching } from '@tanstack/react-query';
import { AuthProvider, ProtectedRoute } from './context/AuthContext';
import { KeyboardProvider } from './context/KeyboardContext';
import { CommandMenu } from './components/ui/CommandMenu';
import { Layout } from './components/layout/Layout';
import { Loader2 } from 'lucide-react';

// Pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { IssuesPage } from './pages/IssuesPage';
import { DocsPage } from './pages/DocsPage';
import { ReleasesPage } from './pages/ReleasesPage';

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
  
  if (!isFetching) return null;
  
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-parchment-50 border border-parchment-300 rounded-tablet shadow-tablet">
      <Loader2 size={16} className="animate-spin text-lapis-500" />
      <span className="text-sm text-lapis-600">Loading...</span>
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
