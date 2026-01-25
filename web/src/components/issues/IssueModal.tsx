import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { Markdown } from '../ui/Markdown';
import { CommentSection } from '../comments/CommentSection';
import { ActivityHistory } from '../ui/ActivityHistory';
import { Avatar } from '../ui/Avatar';
import { MentionInput } from '../comments/MentionInput';
import {
	X,
	ArrowRight,
	Edit3,
	Trash2,
	Check,
	Clock,
	User,
	Tag,
	Calendar,
	FileText,
	ChevronDown,
	MessageSquare,
	History
} from 'lucide-react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboard';
import { useWebSocket } from '../../context/WebSocketContext';
import { HotkeyBadge } from '../ui/HotkeyBadge';
import type { Issue, CreateIssueRequest, UpdateIssueRequest, PriorityType, IssueStatusType } from '../../api/issues';
import { Priority, IssueStatus } from '../../api/issues';
import type { User as UserType } from '../../api/users';

// Tab type for Comments/Activity panel
type TabType = 'comments' | 'activity';

// ============================================
// Unified Issue Modal - View & Edit modes
// Seamless transition between viewing and editing
// ============================================

interface IssueModalProps {
	isOpen: boolean;
	issue: Issue | null;  // null = create new
	users: UserType[];
	mode: 'view' | 'edit' | 'create';
	onClose: () => void;
	onSave: (data: CreateIssueRequest | UpdateIssueRequest) => Promise<void>;
	onDelete?: (issue: Issue) => void;
	onModeChange: (mode: 'view' | 'edit') => void;
	isLoading?: boolean;
	defaultTab?: TabType;  // Which tab to show by default (comments or activity)
}

// Priority config (labels will be translated in component)
const priorityStyles: Record<PriorityType, {
	color: string;
	bgColor: string;
	icon: string;
}> = {
	critical: { color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', icon: '🔺' },
	high: { color: 'text-clay-700', bgColor: 'bg-clay-100 border-clay-300', icon: '▲' },
	medium: { color: 'text-gold-700', bgColor: 'bg-gold-100 border-gold-300', icon: '●' },
	low: { color: 'text-lapis-600', bgColor: 'bg-lapis-100 border-lapis-300', icon: '▽' },
};

// Status config (labels will be translated in component)
const statusStyles: Record<IssueStatusType, { color: string; icon: string }> = {
	to_inscribe: { color: 'bg-parchment-200 text-lapis-600 border-parchment-300', icon: '𒀭' },
	carving: { color: 'bg-gold-100 text-gold-700 border-gold-300', icon: '𒁹' },
	baked: { color: 'bg-green-100 text-green-700 border-green-300', icon: '𒂗' },
};

export function IssueModal({
	isOpen,
	issue,
	users,
	mode,
	onClose,
	onSave,
	onDelete,
	onModeChange,
	isLoading,
	defaultTab = 'comments'
}: IssueModalProps) {
	const { t } = useTranslation();
	const { syncVersion } = useWebSocket();
	
	// Form state
	const [title, setTitle] = React.useState('');
	const [description, setDescription] = React.useState('');
	const [priority, setPriority] = React.useState<PriorityType>(Priority.MEDIUM);
	const [status, setStatus] = React.useState<IssueStatusType>(IssueStatus.TO_INSCRIBE);
	const [assigneeId, setAssigneeId] = React.useState<number | null>(null);
	const [dueDate, setDueDate] = React.useState('');
	const [labels, setLabels] = React.useState<string[]>([]);
	const [labelInput, setLabelInput] = React.useState('');
	const [error, setError] = React.useState('');

	// Dropdown states
	const [showStatusDropdown, setShowStatusDropdown] = React.useState(false);
	const [showPriorityDropdown, setShowPriorityDropdown] = React.useState(false);
	const [showAssigneeDropdown, setShowAssigneeDropdown] = React.useState(false);
	
	// Tab state for Comments/Activity panel
	const [activeTab, setActiveTab] = React.useState<TabType>(defaultTab);
	
	// Update active tab when defaultTab prop changes (e.g., from notification navigation)
	React.useEffect(() => {
		setActiveTab(defaultTab);
	}, [defaultTab]);

	const titleInputRef = React.useRef<HTMLInputElement>(null);
	const contentRef = React.useRef<HTMLDivElement>(null);
	const [canScrollDown, setCanScrollDown] = React.useState(false);
	const isEditing = mode === 'edit' || mode === 'create';
	const isCreating = mode === 'create';
	
	// Track if we're in the middle of an edit session (to prevent auto-refresh)
	const [isEditSession, setIsEditSession] = React.useState(false);
	
	// Track the last sync version and the updatedAt when sync was requested
	const lastSyncVersionRef = React.useRef(syncVersion);
	const syncRequestedAtRef = React.useRef<string | null>(null);

	// Helper to load issue data into form
	const loadIssueIntoForm = React.useCallback((issueData: Issue | null) => {
		console.log('[IssueModal] loadIssueIntoForm called with:', issueData?.title, issueData?.updatedAt);
		if (issueData) {
			setTitle(issueData.title);
			setDescription(issueData.description || '');
			setPriority(issueData.priority);
			setStatus(issueData.status);
			setAssigneeId(issueData.assigneeId || null);
			setDueDate(issueData.dueDate?.split('T')[0] || '');
			setLabels(issueData.labels || []);
		} else {
			setTitle('');
			setDescription('');
			setPriority(Priority.MEDIUM);
			setStatus(IssueStatus.TO_INSCRIBE);
			setAssigneeId(null);
			setDueDate('');
			setLabels([]);
		}
		setError('');
		setLabelInput('');
	}, []);

	// Start edit session when entering edit mode
	React.useEffect(() => {
		if (isEditing && !isCreating) {
			setIsEditSession(true);
		}
	}, [isEditing, isCreating]);

	// End edit session when modal closes or switching to view mode
	React.useEffect(() => {
		if (!isOpen || mode === 'view') {
			setIsEditSession(false);
		}
	}, [isOpen, mode]);

	// When syncVersion increases, record the current updatedAt so we know when new data arrives
	React.useEffect(() => {
		if (syncVersion > lastSyncVersionRef.current) {
			console.log('[IssueModal] Sync requested, current updatedAt:', issue?.updatedAt);
			lastSyncVersionRef.current = syncVersion;
			// Store the current updatedAt - we'll load when we see a different one
			syncRequestedAtRef.current = issue?.updatedAt || 'pending';
		}
	}, [syncVersion, issue?.updatedAt]);

	// When issue data changes, check if we should load it
	React.useEffect(() => {
		// Check if we're waiting for fresh data after a sync request
		if (syncRequestedAtRef.current !== null) {
			// Check if we got NEW data (different updatedAt)
			if (issue && issue.updatedAt !== syncRequestedAtRef.current) {
				console.log('[IssueModal] Fresh data arrived (new updatedAt):', issue.updatedAt);
				syncRequestedAtRef.current = null;
				loadIssueIntoForm(issue);
				return;
			}
			// Still waiting for fresh data
			console.log('[IssueModal] Still waiting for fresh data, current:', issue?.updatedAt, 'waiting for change from:', syncRequestedAtRef.current);
			return;
		}
		
		// Don't auto-refresh during edit session
		if (isEditSession) {
			return;
		}
		
		// Load issue data (initial load or view mode updates)
		loadIssueIntoForm(issue);
	}, [issue, isOpen, isEditSession, loadIssueIntoForm]);

	// Focus title when entering edit mode
	React.useEffect(() => {
		if (isEditing && isOpen) {
			setTimeout(() => titleInputRef.current?.focus(), 100);
		}
	}, [isEditing, isOpen]);

	// Check if content is scrollable and update fade indicator
	const checkScrollable = React.useCallback(() => {
		const el = contentRef.current;
		if (el) {
			const hasMoreContent = el.scrollHeight > el.clientHeight;
			const isNotAtBottom = el.scrollTop + el.clientHeight < el.scrollHeight - 10;
			setCanScrollDown(hasMoreContent && isNotAtBottom);
		}
	}, []);

	// Check scrollable state on mount, resize, and content changes
	React.useEffect(() => {
		if (!isOpen) return;
		
		// Initial check with slight delay to ensure content is rendered
		const timeoutId = setTimeout(checkScrollable, 100);
		
		// Re-check on window resize
		window.addEventListener('resize', checkScrollable);
		
		return () => {
			clearTimeout(timeoutId);
			window.removeEventListener('resize', checkScrollable);
		};
	}, [isOpen, checkScrollable, mode, issue]);

	// Helper to close all dropdowns
	const closeAllDropdowns = React.useCallback(() => {
		setShowStatusDropdown(false);
		setShowPriorityDropdown(false);
		setShowAssigneeDropdown(false);
	}, []);

	// Check if any dropdown is open
	const hasOpenDropdown = showStatusDropdown || showPriorityDropdown || showAssigneeDropdown;

	// Close dropdowns when clicking outside
	React.useEffect(() => {
		if (isOpen) {
			document.addEventListener('click', closeAllDropdowns);
			return () => document.removeEventListener('click', closeAllDropdowns);
		}
	}, [isOpen, closeAllDropdowns]);

	// Handle escape key - close dropdowns first, then cancel
	React.useEffect(() => {
		if (!isOpen) return;
		
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (hasOpenDropdown) {
					e.preventDefault();
					e.stopPropagation();
					closeAllDropdowns();
				}
			}
		};
		
		document.addEventListener('keydown', handleKeyDown, true);
		return () => document.removeEventListener('keydown', handleKeyDown, true);
	}, [isOpen, hasOpenDropdown, closeAllDropdowns]);

	// Handle cancel/escape - edit mode goes to view, view/create closes
	const handleCancel = () => {
		// If dropdowns are open, just close them
		if (hasOpenDropdown) {
			closeAllDropdowns();
			return;
		}
		
		if (mode === 'edit') {
			// Reset form to original issue values and go back to view
			if (issue) {
				setTitle(issue.title);
				setDescription(issue.description || '');
				setPriority(issue.priority);
				setStatus(issue.status);
				setAssigneeId(issue.assigneeId || null);
				setDueDate(issue.dueDate?.split('T')[0] || '');
				setLabels(issue.labels || []);
			}
			setError('');
			onModeChange('view');
		} else {
			onClose();
		}
	};

	// Keyboard shortcuts - only active when modal is open
	useKeyboardShortcuts(isOpen ? [
		{ keys: 'Escape', description: 'Close/Cancel', handler: handleCancel, global: true },
		{
			keys: 'Ctrl+Enter',
			description: 'Save',
			handler: () => isEditing && handleSave(),
			global: true
		},
	] : []);

	// Translation helpers for priority and status
	const getPriorityLabel = (p: PriorityType) => t(`issueModal.priorities.${p}`);
	const getStatusLabel = (s: IssueStatusType) => t(`issueModal.statuses.${s}`);

	const handleSave = async () => {
		if (!title.trim()) {
			setError(t('issueModal.titleRequired'));
			titleInputRef.current?.focus();
			return;
		}

		try {
			const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : undefined;

			const data: CreateIssueRequest | UpdateIssueRequest = {
				title: title.trim(),
				description: description.trim() || '',
				priority,
				...(mode !== 'create' && { status }),
				assigneeId: assigneeId || undefined,
				labels,
				dueDate: formattedDueDate,
			};

			await onSave(data);
			if (mode === 'create') {
				onClose();
			} else {
				onModeChange('view');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save');
		}
	};

	const addLabel = () => {
		const label = labelInput.trim().toLowerCase();
		if (label && !labels.includes(label)) {
			setLabels([...labels, label]);
			setLabelInput('');
		}
	};

	const removeLabel = (labelToRemove: string) => {
		setLabels(labels.filter(l => l !== labelToRemove));
	};

	// Helper functions
	const formatDate = (dateStr?: string) => {
		if (!dateStr) return null;
		const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
		return new Date(dateStr).toLocaleDateString(locale, {
			weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
		});
	};

	const formatRelativeTime = (dateStr: string) => {
		const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return t('dates.today');
		if (diffDays === 1) return t('dates.yesterday');
		if (diffDays < 7) return t('dates.daysAgo', { count: diffDays });
		return formatDate(dateStr);
	};

	const isDueOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'baked';
	const selectedAssignee = users.find(u => u.id === assigneeId);
	const priorityStyle = priorityStyles[priority];
	const statusStyle = statusStyles[status];

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 overflow-hidden">
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-lapis-900/60 backdrop-blur-sm animate-fade-in"
				onClick={onClose}
			/>

			{/* Modal - Full screen on mobile, centered with max-height on desktop */}
			<div 
				className="
					relative w-full h-full
					sm:h-[80vh] sm:max-w-4xl sm:rounded-xl
					bg-parchment-50
					shadow-2xl border-0 sm:border border-parchment-300
					flex flex-col
					overflow-hidden
					animate-scale-in
				"
				onClick={(e) => {
					e.stopPropagation();
					closeAllDropdowns();
				}}
			>
				{/* Priority color bar */}
				<div className={`flex-shrink-0 h-1.5 transition-colors duration-200 ${priority === 'critical' ? 'bg-red-500' :
						priority === 'high' ? 'bg-clay-500' :
							priority === 'medium' ? 'bg-gold-500' : 'bg-stone-400'
					}`} />

				{/* Header */}
				<div className="flex-shrink-0 flex items-start justify-between px-6 py-4 border-b border-parchment-200 bg-parchment-100/50">
					<div className="flex-1 pr-4">
						{/* Status & Priority badges */}
						<div className="flex items-center gap-2 mb-3">
							{/* Status dropdown/badge */}
							<div className="relative">
								<button
									onClick={(e) => { 
										e.stopPropagation(); 
										if (isEditing && !isCreating) {
											setShowPriorityDropdown(false);
											setShowAssigneeDropdown(false);
											setShowStatusDropdown(!showStatusDropdown);
										}
									}}
									disabled={!isEditing || isCreating}
									className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                    text-sm font-medium border transition-all
                    ${statusStyle.color}
                    ${isEditing && !isCreating ? 'cursor-pointer hover:ring-2 hover:ring-lapis-300' : ''}
                  `}
								>
									<span>{statusStyle.icon}</span>
									{getStatusLabel(status)}
									{isEditing && !isCreating && <ChevronDown size={14} />}
								</button>
								{showStatusDropdown && (
									<div className="absolute top-full left-0 mt-1 bg-parchment-50 border border-parchment-300 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
										{Object.entries(statusStyles).map(([key, cfg]) => (
											<button
												key={key}
												onClick={() => { setStatus(key as IssueStatusType); setShowStatusDropdown(false); }}
												className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 flex items-center gap-2
                          ${status === key ? 'bg-parchment-200' : ''}`}
											>
												<span>{cfg.icon}</span> {getStatusLabel(key as IssueStatusType)}
											</button>
										))}
									</div>
								)}
							</div>

							{/* Priority dropdown/badge */}
							<div className="relative">
								<button
									onClick={(e) => { 
										e.stopPropagation(); 
										if (isEditing) {
											setShowStatusDropdown(false);
											setShowAssigneeDropdown(false);
											setShowPriorityDropdown(!showPriorityDropdown);
										}
									}}
									disabled={!isEditing}
									className={`
                    inline-flex items-center gap-1 px-2 py-1 rounded-lg
                    text-xs font-semibold border transition-all
                    ${priorityStyle.bgColor} ${priorityStyle.color}
                    ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-lapis-300' : ''}
                  `}
								>
									<span className="text-[10px]">{priorityStyle.icon}</span>
									{getPriorityLabel(priority)}
									{isEditing && <ChevronDown size={12} />}
								</button>
								{showPriorityDropdown && (
									<div className="absolute top-full left-0 mt-1 bg-parchment-50 border border-parchment-300 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
										{Object.entries(priorityStyles).map(([key, cfg]) => (
											<button
												key={key}
												onClick={() => { setPriority(key as PriorityType); setShowPriorityDropdown(false); }}
												className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 flex items-center gap-2
                          ${priority === key ? 'bg-parchment-200' : ''}`}
											>
												<span className={cfg.color}>{cfg.icon}</span> {getPriorityLabel(key as PriorityType)}
											</button>
										))}
									</div>
								)}
							</div>
						</div>

						{/* Title */}
						<div className="min-h-[40px] flex items-center">
							{isEditing ? (
								<input
									ref={titleInputRef}
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder={t('issueModal.titlePlaceholder')}
									className="
                    w-full text-xl font-inscription font-normal text-lapis-700
                    px-2 py-1 rounded-lg leading-normal
                    bg-parchment-100/50 border border-parchment-300
                    outline-none focus:ring-2 focus:ring-gold-400/30
                    placeholder:text-stone-500
                    caret-gold-500
                    transition-colors
                  "
								/>
							) : (
								<h2 className="text-xl font-inscription font-normal text-lapis-700 leading-normal px-2 py-1">
									{title}
								</h2>
							)}
						</div>
					</div>

					{/* Action buttons */}
					<div className="flex items-center gap-1">
						{mode === 'view' && (
							<button
								onClick={() => onModeChange('edit')}
								className="p-2 rounded-lg hover:bg-parchment-200 text-lapis-500 transition-colors"
								title="Edit (e)"
								tabIndex={-1}
							>
								<Edit3 size={18} />
							</button>
						)}
						{/* Delete button - show in view and edit mode (not create) */}
						{onDelete && issue && (
							<button
								onClick={() => onDelete(issue)}
								className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
								title="Delete"
								tabIndex={-1}
							>
								<Trash2 size={18} />
							</button>
						)}
						{/* Close/Back button - shows back arrow in edit mode to indicate returning to view */}
						<button 
							onClick={isEditing ? handleCancel : onClose} 
							className={`p-2 rounded-lg transition-colors ${
								isEditing && !isCreating
									? 'hover:bg-lapis-100 text-lapis-600' 
									: 'hover:bg-parchment-200 text-lapis-500'
							}`}
							title={isEditing ? (isCreating ? t('common.close') : t('common.back')) + " (Esc)" : t('common.close') + " (Esc)"}
							tabIndex={-1}
						>
							{isEditing && !isCreating ? (
								<ArrowRight size={20} className="rtl:rotate-180" />
							) : (
								<X size={20} />
							)}
						</button>
					</div>
				</div>

				{/* Error */}
				{error && (
					<div className="flex-shrink-0 mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
						{error}
					</div>
				)}

				{/* Content - Scrollable area with fade indicator */}
				<div className="relative flex-1 min-h-0">
					<div 
						ref={contentRef}
						onScroll={checkScrollable}
						className="h-full overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-stable scrollbar-thin"
					>
					{/* Description */}
					<div>
						<h3 className="flex items-center gap-2 text-sm font-semibold text-lapis-600 mb-3">
							<FileText size={16} />
							{t('issueModal.description')}
						</h3>
						{isEditing ? (
							<MentionInput
								value={description}
								onChange={setDescription}
								placeholder={t('issueModal.descriptionPlaceholder')}
								rows={4}
								className="
                  w-full min-h-[100px] sm:min-h-[120px] p-3 sm:p-4 rounded-lg 
                  bg-parchment-100/50 text-lapis-700 resize-none
                  border border-parchment-300 
                  outline-none focus:ring-2 focus:ring-gold-400/30 focus:bg-parchment-100
                  placeholder:text-stone-500
                  transition-colors
                "
							/>
						) : description ? (
							<div className="min-h-[80px] sm:min-h-[100px] bg-parchment-100/30 rounded-lg p-3 sm:p-4 prose-mesopotamian">
								<Markdown>{description}</Markdown>
							</div>
						) : (
							<div className="min-h-[80px] sm:min-h-[100px] flex items-center justify-center text-stone-500 italic text-sm bg-parchment-100/30 rounded-lg">
								{t('issueModal.noDescription')}
							</div>
						)}
					</div>

					{/* Details grid - Moved up before labels */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 p-3 sm:p-4 rounded-lg bg-parchment-100/60 border border-parchment-200">
						{/* Assignee */}
						<div>
							<h4 className="flex items-center gap-1.5 text-xs font-semibold text-lapis-500 mb-2">
								<User size={12} />
								{t('issueModal.assignee')}
							</h4>
							<div className="h-10 flex items-center">
								{isEditing ? (
									<div className="relative w-full">
										<button
											onClick={(e) => { 
												e.stopPropagation(); 
												setShowStatusDropdown(false);
												setShowPriorityDropdown(false);
												setShowAssigneeDropdown(!showAssigneeDropdown); 
											}}
											className="
                        w-full h-10 flex items-center gap-2 px-3 rounded-lg text-left
                        border border-parchment-300 bg-parchment-100/50
                        hover:border-lapis-400 hover:bg-parchment-100 transition-colors
                      "
										>
											{selectedAssignee ? (
												<>
													<Avatar 
														name={selectedAssignee.fullName || selectedAssignee.username}
														size="sm"
													/>
													<span className="text-sm text-lapis-700 truncate">{selectedAssignee.fullName || selectedAssignee.username}</span>
												</>
											) : (
												<span className="text-sm text-stone-500">{t('issueModal.unassigned')}</span>
											)}
											<ChevronDown size={14} className="ml-auto text-stone-400 flex-shrink-0" />
										</button>
										{showAssigneeDropdown && (
											<div className="absolute top-full left-0 right-0 mt-1 bg-parchment-50 border border-parchment-300 rounded-lg shadow-lg py-1 z-10 max-h-48 overflow-y-auto">
												<button
													onClick={() => { setAssigneeId(null); setShowAssigneeDropdown(false); }}
													className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 ${!assigneeId ? 'bg-parchment-200' : ''}`}
												>
													<span className="text-stone-500">{t('issueModal.unassigned')}</span>
												</button>
												{users.map((user) => (
													<button
														key={user.id}
														onClick={() => { setAssigneeId(user.id); setShowAssigneeDropdown(false); }}
														className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 flex items-center gap-2
                              ${assigneeId === user.id ? 'bg-parchment-200' : ''}`}
													>
														<Avatar 
															name={user.fullName || user.username}
															size="xs"
														/>
														{user.fullName || user.username}
													</button>
												))}
											</div>
										)}
									</div>
								) : selectedAssignee ? (
									<div className="flex items-center gap-2">
										<Avatar 
											name={selectedAssignee.fullName || selectedAssignee.username}
											size="md"
											className="ring-2 ring-parchment-200"
										/>
										<span className="text-sm text-lapis-700 font-medium">{selectedAssignee.fullName || selectedAssignee.username}</span>
									</div>
								) : (
									<span className="text-sm text-stone-500 italic">{t('issueModal.unassigned')}</span>
								)}
							</div>
						</div>

						{/* Reporter (view only) */}
						<div>
							<h4 className="flex items-center gap-1.5 text-xs font-semibold text-lapis-500 mb-2">
								<User size={12} />
								{t('issueModal.reporter')}
							</h4>
							<div className="h-10 flex items-center">
								{issue?.reporter ? (
									<div className="flex items-center gap-2">
										<Avatar 
											name={issue.reporter.fullName || issue.reporter.username}
											size="md"
											className="ring-2 ring-parchment-200"
										/>
										<span className="text-sm text-lapis-700 font-medium">{issue.reporter.fullName || issue.reporter.username}</span>
									</div>
								) : (
									<span className="text-sm text-stone-500 italic">{isCreating ? t('issueModal.you') : t('issueModal.unknown')}</span>
								)}
							</div>
						</div>

						{/* Due Date */}
						<div>
							<h4 className="flex items-center gap-1.5 text-xs font-semibold text-lapis-500 mb-2">
								<Calendar size={12} />
								{t('issueModal.dueDate')}
							</h4>
							<div className="h-10 flex items-center">
								{isEditing ? (
									<input
										type="date"
										value={dueDate}
										onChange={(e) => setDueDate(e.target.value)}
										className="
                      w-full h-10 px-3 rounded-lg text-sm
                      border border-parchment-300 bg-parchment-100/50 text-lapis-700
                      focus:ring-2 focus:ring-gold-400/30 focus:bg-parchment-100 outline-none transition-all
                    "
									/>
								) : dueDate ? (
									<span className={`text-sm font-medium ${isDueOverdue ? 'text-red-600' : 'text-lapis-700'}`}>
										{formatDate(dueDate)}
										{isDueOverdue && <span className="ltr:ml-2 rtl:mr-2 text-xs text-red-500">({t('issueModal.overdue')})</span>}
									</span>
								) : (
									<span className="text-sm text-stone-500 italic">{t('issueModal.noDueDate')}</span>
								)}
							</div>
						</div>

						{/* Created (view only) */}
						<div>
							<h4 className="flex items-center gap-1.5 text-xs font-semibold text-lapis-500 mb-2">
								<Clock size={12} />
								{t('issueModal.created')}
							</h4>
							<div className="h-10 flex items-center">
								<span 
									className="text-sm text-lapis-700 cursor-default"
									title={issue?.createdAt ? formatDate(issue.createdAt) || '' : ''}
								>
									{issue?.createdAt ? formatRelativeTime(issue.createdAt) : t('issueModal.now')}
								</span>
							</div>
						</div>
					</div>

					{/* Labels */}
					<div>
						<h3 className="flex items-center gap-2 text-sm font-semibold text-lapis-600 mb-3">
							<Tag size={16} />
							{t('issueModal.labels')}
						</h3>
						<div className="flex flex-wrap items-center gap-2">
							{labels.map((label) => (
								<span
									key={label}
									className="
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                    bg-lapis-100 text-lapis-700 border border-lapis-200
                    text-sm font-medium
                  "
								>
									{label}
									{isEditing && (
										<button onClick={() => removeLabel(label)} className="hover:text-red-500">
											<X size={14} />
										</button>
									)}
								</span>
							))}
							{labels.length === 0 && !isEditing && (
								<span className="text-stone-500 italic text-sm">{t('issueModal.noLabels')}</span>
							)}
							{isEditing && (
								<input
									type="text"
									value={labelInput}
									onChange={(e) => setLabelInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											addLabel();
										}
									}}
									placeholder={`+ ${t('issueModal.labels')}`}
									className="
                    px-3 py-1.5 rounded-lg text-sm w-28
                    bg-transparent text-lapis-600
                    outline-none
                    placeholder:text-stone-500
                    focus:bg-parchment-100 focus:w-40
                    transition-all
                  "
								/>
							)}
						</div>
					</div>

					{/* Tabbed Panel for Comments & Activity - only in view mode */}
					{mode === 'view' && issue && (
						<div className="border border-parchment-200 rounded-lg bg-parchment-50 overflow-hidden">
							{/* Tab Header */}
							<div className="flex border-b border-parchment-200 bg-parchment-100/50">
								<button
									onClick={() => setActiveTab('comments')}
									className={`
										flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium
										transition-colors relative
										${activeTab === 'comments' 
											? 'text-lapis-700 bg-parchment-50' 
											: 'text-lapis-500 hover:text-lapis-600 hover:bg-parchment-100'
										}
									`}
								>
									<MessageSquare size={16} />
									{t('issueModal.tabs.comments')}
									{activeTab === 'comments' && (
										<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-lapis-500" />
									)}
								</button>
								<button
									onClick={() => setActiveTab('activity')}
									className={`
										flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium
										transition-colors relative
										${activeTab === 'activity' 
											? 'text-lapis-700 bg-parchment-50' 
											: 'text-lapis-500 hover:text-lapis-600 hover:bg-parchment-100'
										}
									`}
								>
									<History size={16} />
									{t('issueModal.tabs.activity')}
									{activeTab === 'activity' && (
										<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-lapis-500" />
									)}
								</button>
							</div>

							{/* Tab Content */}
							<div className="p-4">
								{activeTab === 'comments' && (
									<CommentSection resourceType="issue" resourceId={issue.id} />
								)}
								{activeTab === 'activity' && (
									<ActivityHistory entityType="issue" entityId={issue.id} />
								)}
							</div>
						</div>
					)}
					</div>

					{/* Scroll fade indicator */}
					{canScrollDown && (
						<div 
							className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-t from-parchment-50 to-transparent"
							aria-hidden="true"
						/>
					)}
				</div>

				{/* Footer */}
				<div className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-parchment-200 bg-parchment-100/80">
					<div className="text-xs text-stone-500 text-center sm:text-left">
						{issue?.updatedAt && !isCreating && (
							<span title={formatDate(issue.updatedAt) || ''}>
								{t('issueModal.lastUpdated')}: {formatRelativeTime(issue.updatedAt)}
							</span>
						)}
					</div>

					<div className="flex items-center justify-center sm:justify-end gap-3">
						{isEditing ? (
							<>
								<button
									onClick={handleCancel}
									className="
                    px-4 py-2 rounded-lg text-sm font-medium
                    text-lapis-600 hover:bg-parchment-200
                    transition-colors
                    flex items-center gap-2
                  "
								>
									{t('common.cancel')}
									<HotkeyBadge keys="Escape" className="hidden sm:inline-flex" />
								</button>
								<button
									onClick={handleSave}
									disabled={isLoading}
									className="
                    px-5 py-2 rounded-lg text-sm font-medium
                    bg-lapis-500 text-parchment-50
                    hover:bg-lapis-600 
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                    flex items-center gap-2
                  "
								>
									{isLoading ? (
										<span className="inline-block w-4 h-4 border-2 border-parchment-200 border-t-transparent rounded-full animate-spin" />
									) : (
										<Check size={16} />
									)}
									{isCreating ? t('issueModal.createInscription') : t('issueModal.saveChanges')}
									<HotkeyBadge keys="Ctrl+Enter" variant="dark" className="hidden sm:inline-flex" />
								</button>
							</>
						) : (
							<p className="text-xs text-stone-500 flex items-center gap-1">
								<span className="hidden sm:inline">{t('issueModal.pressToEdit')} <HotkeyBadge keys="e" /></span>
								<span className="hidden sm:inline">{' '}&bull;{' '}</span>
								<HotkeyBadge keys="Escape" className="hidden sm:inline-flex" />
								<span className="hidden sm:inline">{t('issueModal.toClose')}</span>
								<span className="sm:hidden">{t('issueModal.tapOutsideToClose')}</span>
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
