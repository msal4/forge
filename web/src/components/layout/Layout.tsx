import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Home, 
  FileText, 
  BookOpen, 
  Package, 
  Settings, 
  LogOut,
  Command,
  Menu,
  X
} from 'lucide-react';
import { useKeyboard } from '../../context/KeyboardContext';
import { useAuth } from '../../context/AuthContext';
import { HotkeyBadge } from '../ui/HotkeyBadge';
import { ConnectionStatus } from '../ui/ConnectionStatus';
import { NotificationBell } from '../ui/NotificationBell';
import { Avatar } from '../ui/Avatar';

// ============================================
// Main Layout - Sidebar + Content
// ============================================

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const { openCommandPalette } = useKeyboard();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  
  const handleLogout = async () => {
    await logout();
  };
  
  return (
    <div className="h-screen bg-parchment-100 flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 ltr:left-0 rtl:right-0 z-40
          w-72 bg-parchment-50 ltr:border-r rtl:border-l border-parchment-300
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex-shrink-0
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-parchment-300">
            <h1 className="font-inscription text-xl text-lapis-600 flex items-center gap-2">
              <span className="text-2xl">𒀭</span>
              {t('app.name')}
            </h1>
            <p className="text-xs text-lapis-500 mt-1">{t('app.tagline')}</p>
          </div>
          
          {/* Command Palette Trigger + Notifications */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={openCommandPalette}
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-tablet
                           bg-parchment-200 text-lapis-500 text-sm
                           hover:bg-parchment-300 transition-colors"
              >
                <Command size={16} />
                <span className="flex-1 ltr:text-left rtl:text-right">{t('nav.commandPalette')}</span>
                <HotkeyBadge keys="Ctrl+k" size="sm" />
              </button>
              <NotificationBell />
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
            <NavItem to="/" icon={<Home size={18} />} label={t('nav.home')} shortcut="g+h" end />
            <NavItem to="/issues" icon={<FileText size={18} />} label={t('nav.issues')} subtitle={t('nav.issuesSubtitle')} shortcut="g+i" />
            <NavItem to="/docs" icon={<BookOpen size={18} />} label={t('nav.docs')} subtitle={t('nav.docsSubtitle')} shortcut="g+d" />
            <NavItem to="/releases" icon={<Package size={18} />} label={t('nav.releases')} subtitle={t('nav.releasesSubtitle')} shortcut="g+r" />
            
            <div className="pt-4 mt-4 border-t border-parchment-300">
              <NavItem to="/settings" icon={<Settings size={18} />} label={t('nav.settings')} shortcut="g+s" />
            </div>
          </nav>
          
          {/* User Info & Logout */}
          <div className="p-3 border-t border-parchment-300 space-y-2">
            {/* Connection Status */}
            <div className="flex items-center justify-center">
              <ConnectionStatus />
            </div>
            
            {/* Current User */}
            {user && (
              <div className="flex items-center gap-3 px-3 py-2">
                <Avatar 
                  name={user.fullName || user.username}
                  avatarUrl={user.avatarUrl}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-lapis-600 truncate">
                    {user.fullName || user.username}
                  </div>
                  <div className="text-xs text-stone-500 truncate">
                    {user.email}
                  </div>
                </div>
              </div>
            )}
            
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-tablet
                         text-lapis-600 hover:bg-clay-100 hover:text-clay-700 transition-colors"
            >
              <LogOut size={18} />
              <span className="text-sm font-medium">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </aside>
      
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 ltr:left-4 rtl:right-4 z-50 p-2 rounded-tablet
                   bg-parchment-50 border border-parchment-300 shadow-tablet"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-lapis-900/50 z-30"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      
      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Navigation Item Component
interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  shortcut?: string;
  end?: boolean;
}

function NavItem({ to, icon, label, subtitle, shortcut, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `
        nav-item group
        ${isActive ? 'active' : ''}
      `}
    >
      <span className="text-current">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{label}</div>
        {subtitle && (
          <div className="text-xs opacity-70">{subtitle}</div>
        )}
      </div>
      {shortcut && (
        <HotkeyBadge 
          keys={shortcut} 
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        />
      )}
    </NavLink>
  );
}
