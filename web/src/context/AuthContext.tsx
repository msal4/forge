import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';

// ============================================
// Auth Context - Global authentication state
// ============================================

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextValue {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionToken: string | null;
  
  // Actions
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Hook for consuming auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for requiring authentication - redirects to login if not authenticated
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Save the attempted URL for redirecting after login
      navigate('/login', { 
        replace: true, 
        state: { from: location.pathname } 
      });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  return { isAuthenticated, isLoading };
}

// Provider component
interface AuthProviderProps {
  children: React.ReactNode;
}

// Session token storage key
const TOKEN_KEY = 'sarray_token';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem(TOKEN_KEY);
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is authenticated on mount
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Login function
  const login = useCallback(async (username: string, password: string) => {
    let response: Response;
    
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
    } catch (err) {
      // Network error - backend might not be running
      throw new Error('Unable to connect to server. Please try again.');
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid response from server');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    setUser(data.user);
    
    // Store session token for WebSocket auth
    if (data.token) {
      setSessionToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
    }

    // Redirect to the page they tried to visit, or home
    const from = (location.state as { from?: string })?.from || '/';
    navigate(from, { replace: true });
  }, [navigate, location]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors - we're logging out anyway
    }

    setUser(null);
    setSessionToken(null);
    localStorage.removeItem(TOKEN_KEY);
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    sessionToken,
    login,
    logout,
    refreshUser,
  }), [user, isLoading, sessionToken, login, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================
// Protected Route Component
// ============================================

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useRequireAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-parchment-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lapis-500/10 mb-4">
            <LoadingIndicator size="xl" inline />
          </div>
          <p className="text-lapis-500 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, useRequireAuth will redirect
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
