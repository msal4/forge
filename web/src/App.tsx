import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './context/AuthContext';
import { KeyboardProvider } from './context/KeyboardContext';
import { CommandMenu } from './components/ui/CommandMenu';
import { Layout } from './components/layout/Layout';

// Pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { IssuesPage } from './pages/IssuesPage';
import { DocsPage } from './pages/DocsPage';
import { ReleasesPage } from './pages/ReleasesPage';

// ============================================
// Sarray Forge - Main Application
// ============================================

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
        <Route path="/issues/*" element={<IssuesPage />} />
        <Route path="/docs/*" element={<DocsPage />} />
        <Route path="/releases/*" element={<ReleasesPage />} />
      </Route>
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <KeyboardProvider>
          <CommandMenu />
          <AppRoutes />
        </KeyboardProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
