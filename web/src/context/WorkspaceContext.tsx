import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi, type Workspace } from '../api/workspaces';
import { setApiWorkspaceId, getApiWorkspaceId } from '../api/client';
import { useAuth } from './AuthContext';

const LAST_WORKSPACE_KEY = 'sarray-forge:last-workspace';

function parseWorkspaceKeyFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/w\/([^/]+)/);
  return match?.[1];
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  workspaceKey: string | undefined;
  workspacePath: (subpath?: string) => string;
  switchWorkspace: (key: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

export function useOptionalWorkspace() {
  return useContext(WorkspaceContext);
}

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const workspaceKey = parseWorkspaceKeyFromPath(location.pathname);

  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.list(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const currentWorkspace = useMemo(() => {
    if (workspaceKey) {
      return workspaces.find(
        (ws) => ws.key.toLowerCase() === workspaceKey.toLowerCase()
      ) ?? null;
    }
    const fallbackKey = localStorage.getItem(LAST_WORKSPACE_KEY);
    if (fallbackKey) {
      return workspaces.find(
        (ws) => ws.key.toLowerCase() === fallbackKey.toLowerCase()
      ) ?? null;
    }
    return workspaces[0] ?? null;
  }, [workspaces, workspaceKey]);

  const workspaceId = currentWorkspace?.id ?? null;
  if (getApiWorkspaceId() !== workspaceId) {
    setApiWorkspaceId(workspaceId);
  }

  useEffect(() => {
    return () => setApiWorkspaceId(null);
  }, []);

  useEffect(() => {
    if (currentWorkspace && workspaceKey) {
      localStorage.setItem(LAST_WORKSPACE_KEY, currentWorkspace.key);
    }
  }, [currentWorkspace, workspaceKey]);

  const workspacePath = useCallback(
    (subpath = '') => {
      const key = currentWorkspace?.key ?? workspaces[0]?.key ?? 'FORGE';
      const normalized = subpath.startsWith('/') ? subpath : subpath ? `/${subpath}` : '';
      return `/w/${key}${normalized}`;
    },
    [currentWorkspace, workspaces]
  );

  const switchWorkspace = useCallback(
    (key: string) => {
      const suffix = location.pathname.replace(/^\/w\/[^/]+/, '') || '/';
      navigate(`/w/${key}${suffix === '/' ? '' : suffix}${location.search}`);
    },
    [location.pathname, location.search, navigate]
  );

  // Redirect when URL workspace is invalid
  useEffect(() => {
    if (authLoading || workspacesLoading || !isAuthenticated) return;
    if (!workspaceKey) return;
    if (workspaces.length === 0) return;

    if (!currentWorkspace) {
      const fallback =
        localStorage.getItem(LAST_WORKSPACE_KEY) ??
        workspaces[0]?.key ??
        'FORGE';
      const suffix = location.pathname.replace(/^\/w\/[^/]+/, '') || '';
      navigate(`/w/${fallback}${suffix}${location.search}`, { replace: true });
    }
  }, [
    authLoading,
    workspacesLoading,
    isAuthenticated,
    workspaceKey,
    currentWorkspace,
    workspaces,
    location.pathname,
    location.search,
    navigate,
  ]);

  const value = useMemo(
    () => ({
      workspaces,
      currentWorkspace,
      isLoading: authLoading || workspacesLoading,
      workspaceKey,
      workspacePath,
      switchWorkspace,
    }),
    [
      workspaces,
      currentWorkspace,
      authLoading,
      workspacesLoading,
      workspaceKey,
      workspacePath,
      switchWorkspace,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function getLastWorkspaceKey(): string | null {
  return localStorage.getItem(LAST_WORKSPACE_KEY);
}

export function WorkspaceRootRedirect() {
  const { workspaces, isLoading } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;
    const fallback =
      getLastWorkspaceKey() ??
      workspaces[0]?.key ??
      'FORGE';
    const path = location.pathname === '/' ? '' : location.pathname;
    navigate(`/w/${fallback}${path}${location.search}`, { replace: true });
  }, [isLoading, workspaces, navigate, location.pathname, location.search]);

  return null;
}
