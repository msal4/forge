import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Send, Eye, Edit3, ChevronDown } from 'lucide-react';
import { LoadingIndicator } from '../ui/LoadingIndicator';
import { Markdown } from '../ui/Markdown';
import { HotkeyBadge } from '../ui/HotkeyBadge';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { Avatar } from '../ui/Avatar';
import { commentsApi, type Comment } from '../../api/comments';
import { usersApi } from '../../api/users';
import { useWebSocket } from '../../context/WebSocketContext';
import { MentionInput } from './MentionInput';

// ============================================
// Comment Section Component
// Reusable comment thread for issues, docs, and releases
// ============================================

type ResourceType = 'issue' | 'doc' | 'release';

interface CommentSectionProps {
	resourceType: ResourceType;
	resourceId: number;
}

// Number of comments to show initially
const INITIAL_COMMENTS_SHOWN = 3;

export function CommentSection({ resourceType, resourceId }: CommentSectionProps) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { lastEvent } = useWebSocket();
	const { confirm, DialogComponent } = useConfirmDialog();

	const [newComment, setNewComment] = React.useState('');
	const [isPreview, setIsPreview] = React.useState(false);
	// Track the minimum number of comments to show (increases when user adds comments)
	const [minCommentsToShow, setMinCommentsToShow] = React.useState(INITIAL_COMMENTS_SHOWN);
	const [showAllComments, setShowAllComments] = React.useState(false);

	// Query key based on resource type - memoized to prevent unnecessary re-renders
	const queryKey = React.useMemo(
		() => ['comments', resourceType, resourceId],
		[resourceType, resourceId]
	);

	// Fetch current user
	const { data: currentUser } = useQuery({
		queryKey: ['users', 'me'],
		queryFn: () => usersApi.me(),
	});

	// Fetch all users for @mention linking
	const { data: users = [] } = useQuery({
		queryKey: ['users'],
		queryFn: () => usersApi.list(),
	});

	// Fetch comments
	const { data: comments = [], isLoading } = useQuery({
		queryKey,
		queryFn: () => {
			switch (resourceType) {
				case 'issue':
					return commentsApi.listForIssue(resourceId);
				case 'doc':
					return commentsApi.listForDoc(resourceId);
				case 'release':
					return commentsApi.listForRelease(resourceId);
			}
		},
		enabled: resourceId > 0,
	});

	// Listen for WebSocket events to refetch comments
	// Use a ref to store the last event to avoid re-running effect on each render
	const lastEventRef = React.useRef(lastEvent);
	React.useEffect(() => {
		// Only process if lastEvent actually changed
		if (lastEvent === lastEventRef.current) return;
		lastEventRef.current = lastEvent;

		if (!lastEvent) return;

		if (lastEvent.type === 'comment_created' || lastEvent.type === 'comment_deleted') {
			const data = lastEvent.data as Record<string, number> | undefined;
			// Check if the event is for this resource
			const eventResourceId = data?.issueId || data?.docId || data?.releaseId;
			if (eventResourceId === resourceId) {
				queryClient.invalidateQueries({ queryKey });
			}
		}
	}, [lastEvent, resourceId, queryClient, queryKey]);

	// Create comment mutation
	const createMutation = useMutation({
		mutationFn: (content: string) => {
			switch (resourceType) {
				case 'issue':
					return commentsApi.createForIssue(resourceId, { content });
				case 'doc':
					return commentsApi.createForDoc(resourceId, { content });
				case 'release':
					return commentsApi.createForRelease(resourceId, { content });
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
			setNewComment('');
			setIsPreview(false);
			// Increase minimum shown to include the new comment
			setMinCommentsToShow(prev => prev + 1);
		},
	});

	// Delete comment mutation
	const deleteMutation = useMutation({
		mutationFn: (commentId: number) => {
			switch (resourceType) {
				case 'issue':
					return commentsApi.deleteForIssue(resourceId, commentId);
				case 'doc':
					return commentsApi.deleteForDoc(resourceId, commentId);
				case 'release':
					return commentsApi.deleteForRelease(resourceId, commentId);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
		},
	});

	// Handle delete with confirmation
	const handleDeleteComment = async (comment: Comment) => {
		const confirmed = await confirm({
			title: t('comments.deleteConfirmTitle', 'Delete Comment'),
			message: t('comments.deleteConfirmMessage', 'Are you sure you want to delete this comment?'),
			confirmLabel: t('common.delete'),
			variant: 'danger',
		});

		if (confirmed) {
			deleteMutation.mutate(comment.id);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newComment.trim()) return;
		createMutation.mutate(newComment.trim());
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Ctrl+Enter to submit
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			if (newComment.trim()) {
				createMutation.mutate(newComment.trim());
			}
		}
	};

	// Format relative time with localization
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

	// Calculate which comments to show
	// Show latest comments (at the end of the array since they're sorted ASC)
	const totalComments = comments.length;
	const commentsToShow = Math.max(minCommentsToShow, INITIAL_COMMENTS_SHOWN);
	const hasHiddenComments = totalComments > commentsToShow && !showAllComments;
	const hiddenCount = hasHiddenComments ? totalComments - commentsToShow : 0;
	const visibleComments = hasHiddenComments
		? comments.slice(-commentsToShow)
		: comments;

	return (
		<>
			<div className="space-y-4">
				{/* Comments list */}
				<div className="divide-y divide-parchment-200">
					{isLoading ? (
						<div className="py-8">
							<LoadingIndicator size="md" className="text-lapis-400" />
						</div>
					) : totalComments === 0 ? (
						<div className="text-center py-6 text-stone-500 text-sm italic">
							{t('comments.empty', 'No comments yet. Be the first to add one!')}
						</div>
					) : (
						<>
							{/* Show more button */}
							{hasHiddenComments && (
								<button
									onClick={() => setShowAllComments(true)}
									className="
                    w-full flex items-center justify-center gap-2 py-2 px-3
                    text-sm text-lapis-500 hover:text-lapis-700
                    hover:bg-parchment-100 rounded-lg
                    transition-colors
                  "
								>
									<ChevronDown size={16} />
									{t('comments.showMore', 'Show {{count}} more comments', { count: hiddenCount })}
								</button>
							)}

							{/* Visible comments */}
							{visibleComments.map((comment) => (
								<CommentItem
									key={comment.id}
									comment={comment}
									isOwn={currentUser?.id === comment.authorId}
									onDelete={() => handleDeleteComment(comment)}
									isDeleting={deleteMutation.isPending && deleteMutation.variables === comment.id}
									formatRelativeTime={formatRelativeTime}
									users={users}
								/>
							))}
						</>
					)}
				</div>

				{/* New comment form */}
				<form onSubmit={handleSubmit} className="space-y-2">
					<div className="relative">
						{isPreview ? (
							<div className="min-h-[80px] p-3 rounded-lg bg-parchment-100/50 border border-parchment-300">
								{newComment.trim() ? (
									<Markdown users={users}>{newComment}</Markdown>
								) : (
									<span className="text-stone-500 italic text-sm">
										{t('comments.previewEmpty', 'Nothing to preview')}
									</span>
								)}
							</div>
						) : (
							<MentionInput
								value={newComment}
								onChange={setNewComment}
								onKeyDown={handleKeyDown}
								placeholder={t('comments.placeholder', 'Add a comment... (Markdown supported)')}
								rows={3}
								className="
                  w-full p-3 rounded-lg resize-none
                  bg-parchment-100/50 text-lapis-700
                  border border-parchment-300
                  outline-none focus:ring-2 focus:ring-gold-400/30 focus:bg-parchment-100
                  placeholder:text-stone-500
                  transition-colors
                "
							/>
						)}
					</div>

					{/* Actions */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setIsPreview(!isPreview)}
								className={`
                  flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium
                  transition-colors
                  ${isPreview
										? 'text-lapis-600 bg-lapis-100'
										: 'text-lapis-500 hover:bg-parchment-200'
									}
                `}
							>
								{isPreview ? (
									<>
										<Edit3 size={12} />
										{t('comments.edit', 'Edit')}
									</>
								) : (
									<>
										<Eye size={12} />
										{t('comments.preview', 'Preview')}
									</>
								)}
							</button>
							<span className="text-xs text-stone-500">
								{t('comments.markdownHint', 'Markdown supported')}
							</span>
						</div>

						<button
							type="submit"
							disabled={!newComment.trim() || createMutation.isPending}
							className="
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                bg-lapis-500 text-parchment-50
                hover:bg-lapis-600
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
						>
							{createMutation.isPending ? (
								<LoadingIndicator size="xs" className="text-parchment-200" inline />
							) : (
								<Send size={14} />
							)}
							{t('comments.send', 'Send')}
							<HotkeyBadge keys="Ctrl+Enter" variant="dark" />
						</button>
					</div>
				</form>
			</div>

			{/* Confirm Dialog */}
			{DialogComponent}
		</>
	);
}

// Individual comment item
interface CommentItemProps {
	comment: Comment;
	isOwn: boolean;
	onDelete: () => void;
	isDeleting: boolean;
	formatRelativeTime: (date: string) => string;
	users: Array<{ id: number; username: string }>;
}

function CommentItem({ comment, isOwn, onDelete, isDeleting, formatRelativeTime, users }: CommentItemProps) {
	const authorName = comment.author?.fullName || comment.author?.username || 'Unknown';

	return (
		<div className="group relative py-2 hover:bg-parchment-100/30 transition-colors">
			<div className="flex gap-2">
				{/* Avatar */}
				<div className="flex-shrink-0 pt-0.5">
					<Avatar 
						name={authorName} 
						avatarUrl={comment.author?.avatarUrl}
						username={comment.author?.username}
						size="sm" 
					/>
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					{/* Header inline with content start */}
					<div className="flex items-baseline gap-2 flex-wrap">
						<span className="font-medium text-sm text-lapis-700">
							{authorName}
						</span>
						<span className="text-xs text-stone-400">
							{formatRelativeTime(comment.createdAt)}
						</span>
						{/* Delete button - inline with header */}
						{isOwn && (
							<button
								onClick={onDelete}
								disabled={isDeleting}
								className="
									ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded
									text-xs text-stone-400 
									hover:text-red-600 hover:bg-red-50
									opacity-0 group-hover:opacity-100
									disabled:opacity-50 disabled:cursor-not-allowed
									transition-all
								"
							>
								{isDeleting ? (
									<LoadingIndicator size="xs" className="text-red-400" inline />
								) : (
									<Trash2 size={12} />
								)}
							</button>
						)}
					</div>

					<div className="text-sm text-lapis-600 prose-sm prose-mesopotamian max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
						<Markdown users={users}>{comment.content}</Markdown>
					</div>
				</div>
			</div>
		</div>
	);
}

export default CommentSection;
