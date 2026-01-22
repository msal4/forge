import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  FileText, 
  BookOpen, 
  Package, 
  ArrowRight, 
  Loader2,
  Clock,
  CheckCircle2,
  Circle,
  Hammer,
  Tag,
  User,
  AlertCircle,
} from 'lucide-react';
import { useIssues, useReleases, useDocs } from '../hooks/useApi';
import { IssueStatus, type Issue } from '../api/issues';
import { useAuth } from '../context/AuthContext';

// ============================================
// Home Page - Dashboard Overview
// ============================================

export function HomePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // React Query hooks
  const { data: issues = [], isLoading: issuesLoading, isError: issuesError } = useIssues();
  const { data: releases = [], isLoading: releasesLoading } = useReleases();
  const { data: docs = [], isLoading: docsLoading } = useDocs();

  // Calculate stats
  const stats = React.useMemo(() => {
    const toInscribe = issues.filter(i => i.status === IssueStatus.TO_INSCRIBE).length;
    const carving = issues.filter(i => i.status === IssueStatus.CARVING).length;
    const baked = issues.filter(i => i.status === IssueStatus.BAKED).length;
    const myIssues = issues.filter(i => i.assigneeId === user?.id).length;
    
    return { toInscribe, carving, baked, total: issues.length, myIssues };
  }, [issues, user]);

  // Get recent items (sorted by updatedAt)
  const recentIssues = React.useMemo(() => {
    return [...issues]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [issues]);

  const latestRelease = React.useMemo(() => {
    return [...releases]
      .filter(r => r.publishedAt)
      .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())[0];
  }, [releases]);

  const recentDocs = React.useMemo(() => {
    return [...docs]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);
  }, [docs]);

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return t('dates.justNow');
    if (diffMins < 60) return t('dates.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('dates.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('dates.daysAgo', { count: diffDays });
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-inscription text-lapis-600">
          {t('home.welcome', { name: user?.fullName?.split(' ')[0] || user?.username })}
        </h1>
        <p className="mt-2 text-lapis-500">
          {t('home.tagline')}
        </p>
      </div>

      {/* Error message */}
      {issuesError && (
        <div className="p-4 bg-clay-50 border border-clay-200 rounded-tablet text-clay-700 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>Failed to load some data. Please refresh the page.</span>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={<Circle size={18} />}
          label={t('home.toInscribe')}
          value={stats.toInscribe}
          color="parchment"
          loading={issuesLoading}
        />
        <StatCard
          icon={<Hammer size={18} />}
          label={t('home.carving')}
          value={stats.carving}
          color="clay"
          loading={issuesLoading}
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label={t('home.baked')}
          value={stats.baked}
          color="gold"
          loading={issuesLoading}
        />
        <StatCard
          icon={<User size={18} />}
          label={t('home.assignedToMe')}
          value={stats.myIssues}
          color="lapis"
          loading={issuesLoading}
        />
      </div>
      
      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-3">
        <QuickActionCard
          to="/issues"
          icon={<FileText size={24} />}
          title={t('home.tablet.title')}
          description={t('home.tablet.description')}
          color="clay"
          shortcut="g+i"
        />
        <QuickActionCard
          to="/docs"
          icon={<BookOpen size={24} />}
          title={t('home.library.title')}
          description={t('home.library.description')}
          color="lapis"
          shortcut="g+d"
        />
        <QuickActionCard
          to="/releases"
          icon={<Package size={24} />}
          title={t('home.granary.title')}
          description={t('home.granary.description')}
          color="gold"
          shortcut="g+r"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Inscriptions - Takes 2 columns */}
        <div className="lg:col-span-2 tablet-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-inscription text-lapis-600">
              {t('home.recentInscriptions')}
            </h2>
            <Link 
              to="/issues" 
              className="text-sm text-lapis-500 hover:text-lapis-600 flex items-center gap-1"
            >
              {t('home.viewAll')} <ArrowRight size={14} />
            </Link>
          </div>
          
          {issuesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-lapis-400" size={24} />
            </div>
          ) : recentIssues.length === 0 ? (
            <EmptyState 
              message={t('home.noInscriptions')}
              hint={t('home.createFirstIssue')}
            />
          ) : (
            <div className="space-y-3">
              {recentIssues.map(issue => (
                <IssueRow key={issue.id} issue={issue} formatRelativeTime={formatRelativeTime} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - Latest Release & Recent Docs */}
        <div className="space-y-6">
          {/* Latest Release */}
          <div className="tablet-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-inscription text-lapis-600">
                {t('home.latestRelease')}
              </h2>
              <Link 
                to="/releases" 
                className="text-sm text-lapis-500 hover:text-lapis-600"
              >
                {t('home.allReleases')}
              </Link>
            </div>
            
            {releasesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-lapis-400" size={20} />
              </div>
            ) : latestRelease ? (
              <Link 
                to={`/releases/${latestRelease.id}`}
                className="block group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-tablet bg-gold-100 flex items-center justify-center flex-shrink-0">
                    <Package size={18} className="text-gold-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-lapis-600 group-hover:text-lapis-700">
                        {latestRelease.version}
                      </span>
                    </div>
                    <p className="text-sm text-lapis-700 font-medium truncate">
                      {latestRelease.title}
                    </p>
                    <p className="text-xs text-lapis-400 mt-1">
                      {formatRelativeTime(latestRelease.publishedAt!)}
                    </p>
                  </div>
                </div>
              </Link>
            ) : (
              <EmptyState 
                message={t('home.noReleases')}
                small
              />
            )}
          </div>

          {/* Recent Docs */}
          <div className="tablet-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-inscription text-lapis-600">
                {t('home.recentDocuments')}
              </h2>
              <Link 
                to="/docs" 
                className="text-sm text-lapis-500 hover:text-lapis-600"
              >
                {t('home.libraryLink')}
              </Link>
            </div>
            
            {docsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-lapis-400" size={20} />
              </div>
            ) : recentDocs.length === 0 ? (
              <EmptyState 
                message={t('home.noDocuments')}
                small
              />
            ) : (
              <div className="space-y-2">
                {recentDocs.map(doc => (
                  <Link
                    key={doc.id}
                    to={`/docs/${doc.id}`}
                    className="block p-2 -mx-2 rounded-tablet hover:bg-parchment-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-lapis-400 flex-shrink-0" />
                      <span className="text-sm text-lapis-600 truncate">
                        {doc.title}
                      </span>
                    </div>
                    <p className="text-xs text-lapis-400 mt-0.5 ltr:ml-6 rtl:mr-6">
                      {formatRelativeTime(doc.updatedAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Keyboard Shortcuts Hint */}
      <div className="bg-lapis-500/5 border border-lapis-200 rounded-tablet p-4">
        <h3 className="font-medium text-lapis-600 mb-2">{t('home.keyboardNav')}</h3>
        <p className="text-sm text-lapis-500">
          {t('home.keyboardHint')}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Stat Card Component
// ============================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'lapis' | 'clay' | 'gold' | 'parchment';
  loading?: boolean;
}

function StatCard({ icon, label, value, color, loading }: StatCardProps) {
  const colorClasses = {
    lapis: 'bg-lapis-50 text-lapis-600 border-lapis-200',
    clay: 'bg-clay-50 text-clay-600 border-clay-200',
    gold: 'bg-gold-50 text-gold-700 border-gold-200',
    parchment: 'bg-parchment-100 text-lapis-600 border-parchment-300',
  };

  const iconColors = {
    lapis: 'text-lapis-500',
    clay: 'text-clay-500',
    gold: 'text-gold-600',
    parchment: 'text-lapis-400',
  };

  return (
    <div className={`p-4 rounded-tablet border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={iconColors[color]}>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 flex items-center">
          <Loader2 size={16} className="animate-spin opacity-50" />
        </div>
      ) : (
        <p className="text-2xl font-semibold">{value}</p>
      )}
    </div>
  );
}

// ============================================
// Issue Row Component
// ============================================

interface IssueRowProps {
  issue: Issue;
  formatRelativeTime: (date: string) => string;
}

function IssueRow({ issue, formatRelativeTime }: IssueRowProps) {
  const statusConfig = {
    [IssueStatus.TO_INSCRIBE]: { 
      icon: <Circle size={14} />, 
      color: 'text-lapis-400',
      bg: 'bg-parchment-200',
    },
    [IssueStatus.CARVING]: { 
      icon: <Hammer size={14} />, 
      color: 'text-clay-500',
      bg: 'bg-clay-100',
    },
    [IssueStatus.BAKED]: { 
      icon: <CheckCircle2 size={14} />, 
      color: 'text-gold-600',
      bg: 'bg-gold-100',
    },
  };

  const priorityColors = {
    critical: 'text-red-600',
    high: 'text-clay-600',
    medium: 'text-gold-600',
    low: 'text-lapis-400',
  };

  const config = statusConfig[issue.status];

  return (
    <Link
      to={`/issues/${issue.id}`}
      className="flex items-center gap-3 p-3 -mx-3 rounded-tablet hover:bg-parchment-100 transition-colors group"
    >
      {/* Status icon */}
      <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
        <span className={config.color}>{config.icon}</span>
      </div>

      {/* Issue info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-lapis-700 group-hover:text-lapis-800 truncate">
            {issue.title}
          </span>
          {issue.priority === 'critical' && (
            <span className={`text-xs ${priorityColors.critical}`}>!</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-lapis-400">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatRelativeTime(issue.updatedAt)}
          </span>
          {issue.labels && issue.labels.length > 0 && (
            <span className="flex items-center gap-1">
              <Tag size={10} />
              {issue.labels.slice(0, 2).join(', ')}
              {issue.labels.length > 2 && ` +${issue.labels.length - 2}`}
            </span>
          )}
        </div>
      </div>

      {/* Assignee avatar */}
      {issue.assignee && (
        <div 
          className="w-6 h-6 rounded-full bg-lapis-100 flex items-center justify-center flex-shrink-0"
          title={issue.assignee.fullName || issue.assignee.username}
        >
          <span className="text-[10px] text-lapis-600 font-medium">
            {(issue.assignee.fullName?.[0] || issue.assignee.username[0]).toUpperCase()}
          </span>
        </div>
      )}

      <ArrowRight size={14} className="text-lapis-300 group-hover:text-lapis-500 flex-shrink-0 rtl:rotate-180" />
    </Link>
  );
}

// ============================================
// Quick Action Card Component
// ============================================

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
          Enter <ArrowRight size={14} className="rtl:rotate-180" />
        </span>
        <kbd className="px-1.5 py-0.5 bg-parchment-200 rounded text-xs text-lapis-600">
          {shortcut}
        </kbd>
      </div>
    </Link>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  message: string;
  hint?: string;
  small?: boolean;
}

function EmptyState({ message, hint, small }: EmptyStateProps) {
  return (
    <div className={`text-center ${small ? 'py-4' : 'py-8'} text-lapis-500`}>
      <p className={small ? 'text-sm' : ''}>{message}</p>
      {hint && (
        <p className="text-sm mt-2 text-lapis-400">
          {hint}
        </p>
      )}
    </div>
  );
}
