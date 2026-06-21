import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Layers, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';

export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaces, currentWorkspace, switchWorkspace, workspacePath } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!currentWorkspace) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-tablet
                   bg-parchment-200 dark:bg-lapis-800 text-lapis-600 dark:text-parchment-200
                   hover:bg-parchment-300 dark:hover:bg-lapis-700 transition-colors text-sm"
      >
        <Layers size={16} className="flex-shrink-0" />
        <div className="flex-1 min-w-0 ltr:text-left rtl:text-right">
          <div className="font-medium truncate">{currentWorkspace.name}</div>
          <div className="text-xs text-lapis-500 dark:text-parchment-400 truncate">{currentWorkspace.key}</div>
        </div>
        <ChevronDown size={16} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-tablet border border-parchment-300 dark:border-lapis-600
                        bg-parchment-50 dark:bg-lapis-900 shadow-tablet overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  switchWorkspace(ws.key);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm transition-colors
                  ${ws.id === currentWorkspace.id
                    ? 'bg-lapis-100 dark:bg-lapis-800 text-lapis-700 dark:text-parchment-100'
                    : 'hover:bg-parchment-200 dark:hover:bg-lapis-800 text-lapis-600 dark:text-parchment-200'
                  }`}
              >
                <div className="font-medium">{ws.name}</div>
                <div className="text-xs opacity-70">{ws.key}</div>
              </button>
            ))}
          </div>
          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(workspacePath('/settings'), { state: { section: 'workspaces' } });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 border-t border-parchment-300 dark:border-lapis-600
                         text-sm text-clay-600 dark:text-clay-400 hover:bg-parchment-200 dark:hover:bg-lapis-800"
            >
              <Plus size={14} />
              {t('workspace.create')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
