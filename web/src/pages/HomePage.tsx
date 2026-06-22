import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { 
  FileText, 
  BookOpen, 
  Package, 
  ArrowRight, 
  Clock,
  CheckCircle2,
  Circle,
  Hammer,
  Tag,
  AlertCircle,
  User,
} from 'lucide-react';
import { useIssues, useReleases, useDocs } from '../hooks/useApi';
import { IssueStatus, type Issue } from '../api/issues';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { Avatar } from '../components/ui/Avatar';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';

// ============================================
// Home Page - Dashboard Overview
// ============================================

export function HomePage() {
  const { user } = useAuth();
  const { workspacePath } = useWorkspace();
  const { t } = useTranslation();

  const randomWisdom = React.useMemo(() => {
    const wisdoms = t('home.wisdoms', { returnObjects: true }) as string[];
    return wisdoms[Math.floor(Math.random() * wisdoms.length)];
  }, [t]);

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
    if (releases.length === 0) return null;
    return [...releases]
      .sort((a, b) => {
        const dateA = a.publishedAt || a.createdAt;
        const dateB = b.publishedAt || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })[0];
  }, [releases]);

  const recentDocs = React.useMemo(() => {
    return [...docs]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);
  }, [docs]);

  // Format full date for tooltips
  const formatFullDate = (dateString: string): string => {
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

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
    if (diffDays === 1) return t('dates.yesterday');
    if (diffDays < 7) return t('dates.daysAgo', { count: diffDays });
    
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    return date.toLocaleDateString(locale, { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-inscription text-lapis-600 dark:text-parchment-200">
          {t('home.welcome', { name: user?.fullName?.split(' ')[0] || user?.username })}
        </h1>
        <p className="mt-2 text-lapis-500 dark:text-parchment-400 italic">
          "{randomWisdom}"
        </p>
      </div>

      {/* Error message */}
      {issuesError && (
        <div className="p-4 bg-clay-50 dark:bg-clay-900/30 border border-clay-200 dark:border-clay-700 rounded-tablet text-clay-700 dark:text-clay-300 flex items-center gap-3">
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
          to={workspacePath('/issues')}
          icon={<FileText size={24} />}
          title={t('home.tablet.title')}
          description={t('home.tablet.description')}
          color="clay"
          shortcut="g+i"
        />
        <QuickActionCard
          to={workspacePath('/docs')}
          icon={<BookOpen size={24} />}
          title={t('home.library.title')}
          description={t('home.library.description')}
          color="lapis"
          shortcut="g+d"
        />
        <QuickActionCard
          to={workspacePath('/releases')}
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
            <h2 className="text-xl font-inscription text-lapis-600 dark:text-parchment-200">
              {t('home.recentInscriptions')}
            </h2>
            <Link 
              to={workspacePath('/issues')} 
              className="text-sm text-lapis-500 dark:text-parchment-400 hover:text-lapis-600 dark:hover:text-parchment-200 flex items-center gap-1"
            >
              {t('home.viewAll')} <ArrowRight size={14} className="rtl:rotate-180" />
            </Link>
          </div>
          
          {issuesLoading ? (
            <div className="py-8">
              <LoadingIndicator size="lg" className="text-stone-400" />
            </div>
          ) : recentIssues.length === 0 ? (
            <EmptyState 
              message={t('home.noInscriptions')}
              hint={t('home.createFirstIssue')}
            />
          ) : (
            <div className="space-y-3">
              {recentIssues.map(issue => (
                <IssueRow key={issue.id} issue={issue} formatRelativeTime={formatRelativeTime} formatFullDate={formatFullDate} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - Latest Release & Recent Docs */}
        <div className="space-y-6">
          {/* Latest Release */}
          <div className="tablet-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-inscription text-lapis-600 dark:text-parchment-200">
                {t('home.latestRelease')}
              </h2>
              <Link 
                to={workspacePath('/releases')} 
                className="text-sm text-lapis-500 dark:text-parchment-400 hover:text-lapis-600 dark:hover:text-parchment-200"
              >
                {t('home.allReleases')}
              </Link>
            </div>
            
            {releasesLoading ? (
              <div className="py-4">
                <LoadingIndicator size="md" className="text-stone-400" />
              </div>
            ) : latestRelease ? (
              <Link 
                to={`/releases/${latestRelease.id}`}
                className="block group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-tablet bg-gold-100 dark:bg-gold-900/50 flex items-center justify-center flex-shrink-0">
                    <Package size={18} className="text-gold-600 dark:text-gold-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-lapis-600 dark:text-parchment-200 group-hover:text-lapis-700 dark:group-hover:text-parchment-100">
                        {latestRelease.version}
                      </span>
                    </div>
                    <p className="text-sm text-lapis-700 dark:text-parchment-300 font-medium truncate">
                      {latestRelease.title}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-parchment-500 mt-1" title={formatFullDate(latestRelease.publishedAt || latestRelease.createdAt)}>
                      {formatRelativeTime(latestRelease.publishedAt || latestRelease.createdAt)}
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
              <h2 className="text-lg font-inscription text-lapis-600 dark:text-parchment-200">
                {t('home.recentDocuments')}
              </h2>
              <Link 
                to={workspacePath('/docs')} 
                className="text-sm text-lapis-500 dark:text-parchment-400 hover:text-lapis-600 dark:hover:text-parchment-200"
              >
                {t('home.libraryLink')}
              </Link>
            </div>
            
            {docsLoading ? (
              <div className="py-4">
                <LoadingIndicator size="md" className="text-stone-400" />
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
                    className="block p-2 -mx-2 rounded-tablet hover:bg-parchment-100 dark:hover:bg-lapis-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-stone-400 dark:text-parchment-500 flex-shrink-0" />
                      <span className="text-sm text-lapis-600 dark:text-parchment-300 truncate">
                        {doc.title}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-parchment-500 mt-0.5 ltr:ml-6 rtl:mr-6" title={formatFullDate(doc.updatedAt)}>
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
      <div className="bg-lapis-500/5 dark:bg-lapis-800/50 border border-lapis-200 dark:border-lapis-700 rounded-tablet p-4">
        <h3 className="font-medium text-lapis-600 dark:text-parchment-200 mb-2">{t('home.keyboardNav')}</h3>
        <p className="text-sm text-lapis-500 dark:text-parchment-400">
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
    lapis: 'bg-lapis-50 dark:bg-lapis-900/50 text-lapis-600 dark:text-parchment-200 border-lapis-200 dark:border-lapis-700',
    clay: 'bg-clay-50 dark:bg-clay-900/30 text-clay-600 dark:text-clay-300 border-clay-200 dark:border-clay-800',
    gold: 'bg-gold-50 dark:bg-gold-900/30 text-gold-700 dark:text-gold-300 border-gold-200 dark:border-gold-800',
    parchment: 'bg-parchment-100 dark:bg-lapis-800 text-lapis-600 dark:text-parchment-200 border-parchment-300 dark:border-lapis-700',
  };

  const iconColors = {
    lapis: 'text-lapis-500 dark:text-lapis-400',
    clay: 'text-clay-500 dark:text-clay-400',
    gold: 'text-gold-600 dark:text-gold-400',
    parchment: 'text-stone-500 dark:text-parchment-400',
  };

  return (
    <div className={`p-4 rounded-tablet border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={iconColors[color]}>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 flex items-center">
          <LoadingIndicator size="sm" className="opacity-50" inline />
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
  formatFullDate: (date: string) => string;
}

function IssueRow({ issue, formatRelativeTime, formatFullDate }: IssueRowProps) {
  const statusConfig = {
    [IssueStatus.TO_INSCRIBE]: { 
      icon: <Circle size={14} />, 
      color: 'text-stone-500 dark:text-parchment-400',
      bg: 'bg-parchment-200 dark:bg-lapis-700',
    },
    [IssueStatus.CARVING]: { 
      icon: <Hammer size={14} />, 
      color: 'text-clay-500 dark:text-clay-400',
      bg: 'bg-clay-100 dark:bg-clay-900/50',
    },
    [IssueStatus.BAKED]: { 
      icon: <CheckCircle2 size={14} />, 
      color: 'text-gold-600 dark:text-gold-400',
      bg: 'bg-gold-100 dark:bg-gold-900/50',
    },
  };

  const priorityColors = {
    critical: 'text-red-600 dark:text-red-400',
    high: 'text-clay-600 dark:text-clay-400',
    medium: 'text-gold-600 dark:text-gold-400',
    low: 'text-stone-500 dark:text-parchment-500',
  };

  const config = statusConfig[issue.status];

  return (
    <Link
      to={`/issues/${issue.id}`}
      className="flex items-center gap-3 p-3 -mx-3 rounded-tablet hover:bg-parchment-100 dark:hover:bg-lapis-800 transition-colors group"
    >
      {/* Status icon */}
      <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
        <span className={config.color}>{config.icon}</span>
      </div>

      {/* Issue info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-lapis-700 dark:text-parchment-200 group-hover:text-lapis-800 dark:group-hover:text-parchment-100 truncate">
            {issue.title}
          </span>
          {issue.priority === 'critical' && (
            <span className={`text-xs ${priorityColors.critical}`}>!</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500 dark:text-parchment-500">
          <span className="flex items-center gap-1" title={formatFullDate(issue.updatedAt)}>
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
        <div title={issue.assignee.fullName || issue.assignee.username}>
          <Avatar 
            name={issue.assignee.fullName || issue.assignee.username}
            size="sm"
            variant="solid"
          />
        </div>
      )}

      <ArrowRight size={14} className="text-stone-400 dark:text-parchment-500 group-hover:text-lapis-500 dark:group-hover:text-parchment-300 flex-shrink-0 rtl:rotate-180" />
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
  const { t } = useTranslation();
  const colorClasses = {
    lapis: 'border-lapis-300 dark:border-lapis-600 hover:border-lapis-400 dark:hover:border-lapis-500',
    clay: 'border-clay-300 dark:border-clay-700 hover:border-clay-400 dark:hover:border-clay-600',
    gold: 'border-gold-300 dark:border-gold-700 hover:border-gold-400 dark:hover:border-gold-600',
  };
  
  const iconColors = {
    lapis: 'text-lapis-500 dark:text-lapis-400',
    clay: 'text-clay-500 dark:text-clay-400',
    gold: 'text-gold-600 dark:text-gold-400',
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
      <h3 className="font-inscription text-lg text-lapis-600 dark:text-parchment-200 mb-2">
        {title}
      </h3>
      <p className="text-sm text-lapis-500 dark:text-parchment-400 mb-4">
        {description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500 dark:text-parchment-500 group-hover:text-lapis-600 dark:group-hover:text-parchment-300 transition-colors flex items-center gap-1">
          {t('home.enter')} <ArrowRight size={14} className="rtl:rotate-180" />
        </span>
        <kbd className="px-1.5 py-0.5 bg-parchment-200 dark:bg-lapis-700 rounded text-xs text-lapis-600 dark:text-parchment-300">
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
    <div className={`text-center ${small ? 'py-4' : 'py-8'} text-lapis-500 dark:text-parchment-400`}>
      <p className={small ? 'text-sm' : ''}>{message}</p>
      {hint && (
        <p className="text-sm mt-2 text-stone-500 dark:text-parchment-500">
          {hint}
        </p>
      )}
    </div>
  );
}
