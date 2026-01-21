import { Link } from 'react-router-dom';
import { FileText, BookOpen, Package, ArrowRight } from 'lucide-react';

// ============================================
// Home Page - Dashboard Overview
// ============================================

export function HomePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-inscription text-lapis-600">
          Welcome to the Forge
        </h1>
        <p className="mt-2 text-lapis-500">
          Where ancient wisdom meets modern development.
        </p>
      </div>
      
      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-3">
        <QuickActionCard
          to="/issues"
          icon={<FileText size={24} />}
          title="The Tablet"
          description="Inscribe and track your tasks on clay tablets"
          color="clay"
          shortcut="g+i"
        />
        <QuickActionCard
          to="/docs"
          icon={<BookOpen size={24} />}
          title="The Library"
          description="Store your knowledge in the great library"
          color="lapis"
          shortcut="g+d"
        />
        <QuickActionCard
          to="/releases"
          icon={<Package size={24} />}
          title="The Granary"
          description="Store and distribute your harvest"
          color="gold"
          shortcut="g+r"
        />
      </div>
      
      {/* Recent Activity */}
      <div className="tablet-card p-6">
        <h2 className="text-xl font-inscription text-lapis-600 mb-4">
          Recent Inscriptions
        </h2>
        <div className="text-center py-8 text-lapis-500">
          <p>No recent activity yet.</p>
          <p className="text-sm mt-2">
            Press <kbd className="px-1.5 py-0.5 bg-parchment-200 rounded text-xs">C</kbd> to create your first issue.
          </p>
        </div>
      </div>
      
      {/* Keyboard Shortcuts Hint */}
      <div className="bg-lapis-500/5 border border-lapis-200 rounded-tablet p-4">
        <h3 className="font-medium text-lapis-600 mb-2">Keyboard Navigation</h3>
        <p className="text-sm text-lapis-500">
          Press <kbd className="px-1.5 py-0.5 bg-parchment-200 rounded text-xs mx-1">Ctrl+K</kbd> 
          to open the command palette, or use 
          <kbd className="px-1.5 py-0.5 bg-parchment-200 rounded text-xs mx-1">?</kbd> 
          to see all shortcuts.
        </p>
      </div>
    </div>
  );
}

// Quick Action Card Component
interface QuickActionCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'lapis' | 'clay' | 'gold';
  shortcut: string;
}

function QuickActionCard({ to, icon, title, description, color, shortcut }: QuickActionCardProps) {
  const colorClasses = {
    lapis: 'border-lapis-300 hover:border-lapis-400',
    clay: 'border-clay-300 hover:border-clay-400',
    gold: 'border-gold-300 hover:border-gold-400',
  };
  
  const iconColors = {
    lapis: 'text-lapis-500',
    clay: 'text-clay-500',
    gold: 'text-gold-600',
  };
  
  return (
    <Link
      to={to}
      className={`
        tablet-card p-6 group
        border-2 ${colorClasses[color]}
        transition-all duration-200
      `}
    >
      <div className={`${iconColors[color]} mb-4`}>
        {icon}
      </div>
      <h3 className="font-inscription text-lg text-lapis-600 mb-2">
        {title}
      </h3>
      <p className="text-sm text-lapis-500 mb-4">
        {description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-lapis-400 group-hover:text-lapis-600 transition-colors flex items-center gap-1">
          Enter <ArrowRight size={14} />
        </span>
        <kbd className="px-1.5 py-0.5 bg-parchment-200 rounded text-xs text-lapis-600">
          {shortcut}
        </kbd>
      </div>
    </Link>
  );
}
