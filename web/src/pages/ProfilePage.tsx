import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  Mail,
  Calendar,
  FileText,
  Package,
  MessageSquare,
  History,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { usersApi, type UserComment } from '../api/users';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Issue } from '../api/issues';
import type { Doc } from '../api/docs';
import type { Release } from '../api/releases';
import type { ActivityLog } from '../api/activity';
import { getAvatarColorScheme, getInitials } from '../utils/avatarColors';
import { useAuth } from '../context/AuthContext';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';

// ============================================
// Profile Page - View user profiles
// ============================================

type ProfileTab = 'issues' | 'docs' | 'releases' | 'comments' | 'activity';

export function ProfilePage() {
  const { t } = useTranslation();
  const { username } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const { workspacePath } = useWorkspace();

  // Get tab from URL or default to 'issues'
  const tabFromUrl = searchParams.get('tab') as ProfileTab | null;
  const validTabs: ProfileTab[] = ['issues', 'docs', 'releases', 'comments', 'activity'];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'issues';

  // Active tab
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  // Sync tab changes to URL
  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // Update tab if URL changes externally
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Fetch profile by username
  const {
    data: profile,
    isLoading: isLoadingProfile,
    isError: isProfileError,
  } = useQuery({
    queryKey: ['user-profile', username],
    queryFn: () => usersApi.getProfile(username!),
    enabled: !!username,
  });

  const isOwnProfile = currentUser?.username === username;
  const userId = profile?.id;

  // Fetch issues by username
  const { data: issues = [], isLoading: isLoadingIssues } = useQuery({
    queryKey: ['user-issues', username],
    queryFn: () => usersApi.getUserIssues(username!),
    enabled: !!username && activeTab === 'issues',
  });

  // Fetch docs by username
  const { data: docs = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['user-docs', username],
    queryFn: () => usersApi.getUserDocs(username!),
    enabled: !!username && activeTab === 'docs',
  });

  // Fetch releases by username
  const { data: releases = [], isLoading: isLoadingReleases } = useQuery({
    queryKey: ['user-releases', username],
    queryFn: () => usersApi.getUserReleases(username!),
    enabled: !!username && activeTab === 'releases',
  });

  // Fetch comments by username
  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ['user-comments', username],
    queryFn: () => usersApi.getUserComments(username!),
    enabled: !!username && activeTab === 'comments',
  });

  // Fetch activity with infinite scroll
  const {
    data: activityData,
    isLoading: isLoadingActivity,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['user-activity', username],
    queryFn: ({ pageParam = 0 }) => usersApi.getUserActivity(username!, { limit: 20, offset: pageParam }),
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage.hasMore) return undefined;
      return pages.length * 20;
    },
    enabled: !!username && activeTab === 'activity',
    initialPageParam: 0,
  });

  const activities = activityData?.pages.flatMap((p) => p.activities) ?? [];

  if (!username) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-lapis-500">{t('profile.invalidUser')}</p>
      </div>
    );
  }

  if (isLoadingProfile) {
    return (
      <div className="h-64">
        <LoadingIndicator size="xl" />
      </div>
    );
  }

  if (isProfileError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-clay-500" />
        <p className="text-lapis-600">{t('profile.notFound')}</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-lapis-500 hover:text-lapis-600"
        >
          <ArrowLeft size={16} />
          <span>{t('common.goBack')}</span>
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const tabs: { key: ProfileTab; label: string; count: number }[] = [
    { key: 'issues', label: t('profile.issues'), count: profile.stats.issuesAssigned + profile.stats.issuesReported },
    { key: 'docs', label: t('profile.docs'), count: profile.stats.docsAuthored },
    { key: 'releases', label: t('profile.releases'), count: profile.stats.releases },
    { key: 'comments', label: t('profile.comments'), count: profile.stats.comments },
    { key: 'activity', label: t('profile.activity'), count: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-lapis-500 dark:text-parchment-400 hover:text-lapis-600 dark:hover:text-parchment-200 transition-colors"
      >
        <ArrowLeft size={16} />
        <span>{t('common.goBack')}</span>
      </button>

      {/* Profile Header */}
      <div className="tablet-card p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.fullName}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className={`w-24 h-24 rounded-full ${getAvatarColorScheme(profile.fullName).gradient} flex items-center justify-center`}>
                <span className="text-white font-semibold text-3xl">
                  {getInitials(profile.fullName)}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-inscription text-lapis-700 dark:text-parchment-200">{profile.fullName}</h1>
            <p className="text-lapis-500 dark:text-parchment-400 mt-1">@{profile.username}</p>

            <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-4 text-sm text-lapis-500 dark:text-parchment-400">
              <div className="flex items-center gap-1">
                <Mail size={14} />
                <span>{profile.email}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                <span>
                  {t('profile.memberSince', {
                    date: new Date(profile.createdAt).toLocaleDateString(
                      i18n.language === 'ar' ? 'ar-SA' : 'en-US',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    ),
                  })}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-6 mt-4">
              <div className="text-center">
                <div className="text-xl font-semibold text-lapis-700 dark:text-parchment-200">
                  {profile.stats.issuesAssigned}
                </div>
                <div className="text-xs text-lapis-500 dark:text-parchment-400">{t('profile.assigned')}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-lapis-700 dark:text-parchment-200">
                  {profile.stats.issuesReported}
                </div>
                <div className="text-xs text-lapis-500 dark:text-parchment-400">{t('profile.reported')}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-lapis-700 dark:text-parchment-200">
                  {profile.stats.docsAuthored}
                </div>
                <div className="text-xs text-lapis-500 dark:text-parchment-400">{t('profile.docsCount')}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-lapis-700 dark:text-parchment-200">
                  {profile.stats.releases}
                </div>
                <div className="text-xs text-lapis-500 dark:text-parchment-400">{t('profile.releasesCount')}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-lapis-700 dark:text-parchment-200">
                  {profile.stats.comments}
                </div>
                <div className="text-xs text-lapis-500 dark:text-parchment-400">{t('profile.commentsCount')}</div>
              </div>
            </div>

            {/* Edit profile link for own profile */}
            {isOwnProfile && (
              <Link
                to={workspacePath('/settings')}
                className="inline-flex items-center gap-1 mt-4 text-sm text-lapis-500 dark:text-parchment-400 hover:text-lapis-600 dark:hover:text-parchment-200 transition-colors"
              >
                <span>{t('profile.editProfile')}</span>
                <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-parchment-300 dark:border-lapis-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                ${activeTab === tab.key
                  ? 'border-lapis-500 dark:border-gold-500 text-lapis-700 dark:text-parchment-200'
                  : 'border-transparent text-lapis-500 dark:text-parchment-400 hover:text-lapis-600 dark:hover:text-parchment-300 hover:border-parchment-400 dark:hover:border-lapis-600'
                }
              `}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-parchment-200 dark:bg-lapis-700 text-lapis-600 dark:text-parchment-300">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'issues' && userId && (
          <IssuesTab issues={issues} isLoading={isLoadingIssues} userId={userId} />
        )}
        {activeTab === 'docs' && (
          <DocsTab docs={docs} isLoading={isLoadingDocs} />
        )}
        {activeTab === 'releases' && (
          <ReleasesTab releases={releases} isLoading={isLoadingReleases} />
        )}
        {activeTab === 'comments' && (
          <CommentsTab comments={comments} isLoading={isLoadingComments} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab
            activities={activities}
            isLoading={isLoadingActivity}
            hasMore={!!hasNextPage}
            isFetchingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// Tab Components
// ============================================

function IssuesTab({ issues, isLoading, userId }: { issues: Issue[]; isLoading: boolean; userId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-32">
        <LoadingIndicator size="lg" />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="text-center py-12 text-lapis-500 dark:text-parchment-400">
        {t('profile.noIssues')}
      </div>
    );
  }

  // Split into assigned and reported
  const assigned = issues.filter((i) => i.assigneeId === userId);
  const reported = issues.filter((i) => i.reporterId === userId && i.assigneeId !== userId);

  const statusColors: Record<string, string> = {
    to_inscribe: 'bg-parchment-200 text-lapis-600',
    carving: 'bg-gold-100 text-gold-700',
    baked: 'bg-green-100 text-green-700',
  };

  const IssueCard = ({ issue }: { issue: Issue }) => (
    <button
      onClick={() => navigate(`/issues/${issue.id}`)}
      className="w-full tablet-card p-4 text-left hover:border-lapis-300 dark:hover:border-lapis-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-lapis-700 dark:text-parchment-200 truncate">{issue.title}</h4>
          <p className="text-xs text-lapis-500 dark:text-parchment-400 mt-1 line-clamp-2">{issue.description}</p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full ${statusColors[issue.status] || ''}`}>
          {t(`issues.status.${issue.status}`)}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-lapis-400 dark:text-parchment-500">
        <span>{new Date(issue.updatedAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        {issue.labels?.length > 0 && (
          <span>{issue.labels.slice(0, 2).join(', ')}</span>
        )}
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      {assigned.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-lapis-600 dark:text-parchment-300 mb-3">
            {t('profile.assignedIssues')} ({assigned.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assigned.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {reported.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-lapis-600 dark:text-parchment-300 mb-3">
            {t('profile.reportedIssues')} ({reported.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reported.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocsTab({ docs, isLoading }: { docs: Doc[]; isLoading: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-32">
        <LoadingIndicator size="lg" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-12 text-lapis-500 dark:text-parchment-400">
        {t('profile.noDocs')}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {docs.map((doc) => (
        <button
          key={doc.id}
          onClick={() => navigate(`/docs/${doc.id}`)}
          className="tablet-card p-4 text-left hover:border-lapis-300 dark:hover:border-lapis-600 transition-colors"
        >
          <div className="flex items-start gap-3">
            <FileText size={20} className="shrink-0 text-lapis-400 dark:text-parchment-500 mt-0.5" />
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-lapis-700 dark:text-parchment-200 truncate">{doc.title}</h4>
              <p className="text-xs text-lapis-500 dark:text-parchment-400 mt-1 line-clamp-2">
                {doc.content?.slice(0, 100)}...
              </p>
              <p className="text-xs text-lapis-400 dark:text-parchment-500 mt-2">
                {new Date(doc.updatedAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ReleasesTab({ releases, isLoading }: { releases: Release[]; isLoading: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-32">
        <LoadingIndicator size="lg" />
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div className="text-center py-12 text-lapis-500 dark:text-parchment-400">
        {t('profile.noReleases')}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {releases.map((release) => (
        <button
          key={release.id}
          onClick={() => navigate(`/releases/${release.id}`)}
          className="tablet-card p-4 text-left hover:border-lapis-300 dark:hover:border-lapis-600 transition-colors"
        >
          <div className="flex items-start gap-3">
            <Package size={20} className="shrink-0 text-gold-500 dark:text-gold-400 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-lapis-700 dark:text-parchment-200">{release.version}</span>
                <span className="text-xs text-lapis-500 dark:text-parchment-400">{release.title}</span>
              </div>
              <p className="text-xs text-lapis-500 dark:text-parchment-400 mt-1 line-clamp-2">
                {release.description?.slice(0, 80)}...
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-lapis-400 dark:text-parchment-500">
                <span>{new Date(release.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {release.files?.length > 0 && (
                  <span>{release.files.length} {t('releases.files')}</span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function CommentsTab({ comments, isLoading }: { comments: UserComment[]; isLoading: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-32">
        <LoadingIndicator size="lg" />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-12 text-lapis-500 dark:text-parchment-400">
        {t('profile.noComments')}
      </div>
    );
  }

  const getEntityPath = (c: UserComment) => {
    switch (c.entityType) {
      case 'issue':
        return `/issues/${c.entityId}?tab=comments`;
      case 'doc':
        return `/docs/${c.entityId}?tab=comments`;
      case 'release':
        return `/releases/${c.entityId}`;
      default:
        return '#';
    }
  };

  const entityIcons: Record<string, React.ReactNode> = {
    issue: <FileText size={14} className="text-lapis-400 dark:text-parchment-500" />,
    doc: <FileText size={14} className="text-lapis-400 dark:text-parchment-500" />,
    release: <Package size={14} className="text-gold-500 dark:text-gold-400" />,
  };

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <button
          key={`${comment.entityType}-${comment.id}`}
          onClick={() => navigate(getEntityPath(comment))}
          className="w-full tablet-card p-4 text-left hover:border-lapis-300 dark:hover:border-lapis-600 transition-colors"
        >
          <div className="flex items-start gap-3">
            <MessageSquare size={16} className="shrink-0 text-lapis-400 dark:text-parchment-500 mt-1" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-lapis-700 dark:text-parchment-200 line-clamp-2">{comment.content}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-lapis-400 dark:text-parchment-500">
                {entityIcons[comment.entityType]}
                <span className="truncate">{comment.entityTitle}</span>
                <span className="shrink-0">
                  {new Date(comment.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ActivityTab({
  activities,
  isLoading,
  hasMore,
  isFetchingMore,
  onLoadMore,
}: {
  activities: ActivityLog[];
  isLoading: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-32">
        <LoadingIndicator size="lg" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-lapis-500 dark:text-parchment-400">
        {t('profile.noActivity')}
      </div>
    );
  }

  const getEntityPath = (a: ActivityLog) => {
    switch (a.entityType) {
      case 'issue':
        return `/issues/${a.entityId}`;
      case 'doc':
        return `/docs/${a.entityId}`;
      case 'release':
        return `/releases/${a.entityId}`;
      default:
        return '#';
    }
  };

  const getActionLabel = (action: string) => {
    const parts = action.split('.');
    if (parts.length === 2) {
      return t(`activity.${parts[0]}.${parts[1]}`, { defaultValue: action });
    }
    return action;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    return date.toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <button
          key={activity.id}
          onClick={() => navigate(getEntityPath(activity))}
          className="w-full tablet-card p-4 text-left hover:border-lapis-300 dark:hover:border-lapis-600 transition-colors"
        >
          <div className="flex items-start gap-3">
            <History size={16} className="shrink-0 text-lapis-400 dark:text-parchment-500 mt-1" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-lapis-700 dark:text-parchment-200">
                {getActionLabel(activity.action)}
              </p>
              {activity.entityTitle && (
                <p className="text-sm text-lapis-500 dark:text-parchment-400 truncate mt-0.5">
                  {activity.entityTitle}
                </p>
              )}
              <p className="text-xs text-lapis-400 dark:text-parchment-500 mt-1">
                {formatDate(activity.createdAt)}
              </p>
            </div>
          </div>
        </button>
      ))}

      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={isFetchingMore}
            className="px-4 py-2 text-sm text-lapis-600 dark:text-parchment-400 hover:text-lapis-700 dark:hover:text-parchment-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetchingMore ? (
              <LoadingIndicator size="sm" inline className="mr-2" />
            ) : null}
            {t('common.loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
