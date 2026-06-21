import { Navigate, useLocation } from 'react-router-dom';
import { getLastWorkspaceKey } from '../../context/WorkspaceContext';

export function LegacyPathRedirect() {
  const location = useLocation();
  const fallback = getLastWorkspaceKey() ?? 'FORGE';
  const target = `/w/${fallback}${location.pathname}${location.search}`;
  return <Navigate to={target} replace />;
}
