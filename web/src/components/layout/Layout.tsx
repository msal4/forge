import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
import { HotkeyBadge } from '../ui/HotkeyBadge';

// ============================================
// Main Layout - Sidebar + Content
// ============================================

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const { openCommandPalette } = useKeyboard();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    // Clear session and redirect to login
    document.cookie = 'sarray_session=; Max-Age=0; path=/';
    navigate('/login');
  };
  
  return (
    <div className="min-h-screen bg-parchment-100 flex">
      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-40
          w-64 bg-parchment-50 border-r border-parchment-300
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-parchment-300">
            <h1 className="font-inscription text-xl text-lapis-600 flex items-center gap-2">
              <span className="text-2xl">𒀭</span>
              Sarray Forge
            </h1>
            <p className="text-xs text-lapis-500 mt-1">The Ancient Workshop</p>
          </div>
          
          {/* Command Palette Trigger */}
          <div className="p-3">
            <button
              onClick={openCommandPalette}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-tablet
                         bg-parchment-200 text-lapis-500 text-sm
                         hover:bg-parchment-300 transition-colors"
            >
              <Command size={16} />
              <span className="flex-1 text-left">Command Palette</span>
              <HotkeyBadge keys="Ctrl+k" size="sm" />
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <NavItem to="/" icon={<Home size={18} />} label="Home" shortcut="g+h" end />
            <NavItem to="/issues" icon={<FileText size={18} />} label="The Tablet" subtitle="Issues" shortcut="g+i" />
            <NavItem to="/docs" icon={<BookOpen size={18} />} label="The Library" subtitle="Docs" shortcut="g+d" />
            <NavItem to="/releases" icon={<Package size={18} />} label="The Granary" subtitle="Releases" shortcut="g+r" />
            
            <div className="pt-4 mt-4 border-t border-parchment-300">
              <NavItem to="/settings" icon={<Settings size={18} />} label="Settings" shortcut="g+s" />
            </div>
          </nav>
          
          {/* User & Logout */}
          <div className="p-3 border-t border-parchment-300">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-tablet
                         text-lapis-600 hover:bg-parchment-200 transition-colors"
            >
              <LogOut size={18} />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>
      
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-tablet
                   bg-parchment-50 border border-parchment-300 shadow-tablet"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-lapis-900/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Main Content */}
      <main className="flex-1 min-w-0">
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
