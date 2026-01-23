import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
	X,
	ArrowLeft,
	Edit3,
	Trash2,
	Check,
	Clock,
	User,
	Tag,
	Calendar,
	FileText,
	ChevronDown
} from 'lucide-react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboard';
import { HotkeyBadge } from '../ui/HotkeyBadge';
import type { Issue, CreateIssueRequest, UpdateIssueRequest, PriorityType, IssueStatusType } from '../../api/issues';
import { Priority, IssueStatus } from '../../api/issues';
import type { User as UserType } from '../../api/users';

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
	isLoading
}: IssueModalProps) {
	const { t } = useTranslation();
	
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

	const titleInputRef = React.useRef<HTMLInputElement>(null);
	const isEditing = mode === 'edit' || mode === 'create';
	const isCreating = mode === 'create';

	// Populate form from issue
	React.useEffect(() => {
		if (issue) {
			setTitle(issue.title);
			setDescription(issue.description || '');
			setPriority(issue.priority);
			setStatus(issue.status);
			setAssigneeId(issue.assigneeId || null);
			setDueDate(issue.dueDate?.split('T')[0] || '');
			setLabels(issue.labels || []);
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
	}, [issue, isOpen]);

	// Focus title when entering edit mode
	React.useEffect(() => {
		if (isEditing && isOpen) {
			setTimeout(() => titleInputRef.current?.focus(), 100);
		}
	}, [isEditing, isOpen]);

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
		<div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 pb-8 overflow-y-auto overflow-x-hidden">
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-lapis-900/60 backdrop-blur-sm animate-fade-in"
				onClick={onClose}
			/>

			{/* Modal */}
			<div 
				className="
					relative w-full max-w-2xl
					bg-parchment-50
					rounded-xl shadow-2xl border border-parchment-300
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
				<div className={`h-1.5 transition-colors duration-200 ${priority === 'critical' ? 'bg-red-500' :
						priority === 'high' ? 'bg-clay-500' :
							priority === 'medium' ? 'bg-gold-500' : 'bg-lapis-400'
					}`} />

				{/* Header */}
				<div className="flex items-start justify-between px-6 py-4 border-b border-parchment-200 bg-parchment-100/50">
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
						<div className="min-h-[32px] flex items-center">
							{isEditing ? (
								<input
									ref={titleInputRef}
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder={t('issueModal.titlePlaceholder')}
									className="
                    w-full text-xl font-inscription font-normal text-lapis-700
                    bg-transparent
                    border-none outline-none ring-0
                    focus:border-none focus:outline-none focus:ring-0
                    placeholder:text-lapis-400
                    caret-lapis-500
                  "
									style={{ boxShadow: 'none' }}
								/>
							) : (
								<h2 className="text-xl font-inscription font-normal text-lapis-700 leading-tight">
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
						>
							{isEditing && !isCreating ? (
								<ArrowLeft size={20} className="rtl:rotate-180" />
							) : (
								<X size={20} />
							)}
						</button>
					</div>
				</div>

				{/* Error */}
				{error && (
					<div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
						{error}
					</div>
				)}

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-stable scrollbar-thin">
					{/* Description */}
					<div>
						<h3 className="flex items-center gap-2 text-sm font-semibold text-lapis-600 mb-3">
							<FileText size={16} />
							{t('issueModal.description')}
						</h3>
						{isEditing ? (
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder={t('issueModal.descriptionPlaceholder')}
								rows={4}
								className="
                  w-full min-h-[120px] p-4 rounded-lg 
                  bg-parchment-100/50 text-lapis-700 resize-none
                  border border-parchment-300 
                  outline-none focus:border-lapis-400 focus:bg-parchment-100
                  placeholder:text-lapis-400
                  transition-colors
                "
							/>
						) : description ? (
							<div className="min-h-[120px] bg-parchment-100/30 rounded-lg p-4 prose-mesopotamian">
								<ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
							</div>
						) : (
							<div className="min-h-[120px] flex items-center justify-center text-lapis-400 italic text-sm bg-parchment-100/30 rounded-lg">
								{t('issueModal.noDescription')}
							</div>
						)}
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
								<span className="text-lapis-400 italic text-sm">{t('issueModal.noLabels')}</span>
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
                    placeholder:text-lapis-400
                    focus:bg-parchment-100 focus:w-40
                    transition-all
                  "
								/>
							)}
						</div>
					</div>

					{/* Details grid */}
					<div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 rounded-lg bg-parchment-100/60 border border-parchment-200">
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
													<div className="w-6 h-6 rounded-full bg-gradient-to-br from-lapis-400 to-lapis-600 flex items-center justify-center flex-shrink-0">
														<span className="text-[10px] text-parchment-100 font-semibold">
															{(selectedAssignee.fullName?.[0] || selectedAssignee.username[0]).toUpperCase()}
														</span>
													</div>
													<span className="text-sm text-lapis-700 truncate">{selectedAssignee.fullName || selectedAssignee.username}</span>
												</>
											) : (
												<span className="text-sm text-lapis-400">{t('issueModal.unassigned')}</span>
											)}
											<ChevronDown size={14} className="ml-auto text-lapis-400 flex-shrink-0" />
										</button>
										{showAssigneeDropdown && (
											<div className="absolute top-full left-0 right-0 mt-1 bg-parchment-50 border border-parchment-300 rounded-lg shadow-lg py-1 z-10 max-h-48 overflow-y-auto">
												<button
													onClick={() => { setAssigneeId(null); setShowAssigneeDropdown(false); }}
													className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 ${!assigneeId ? 'bg-parchment-200' : ''}`}
												>
													<span className="text-lapis-400">{t('issueModal.unassigned')}</span>
												</button>
												{users.map((user) => (
													<button
														key={user.id}
														onClick={() => { setAssigneeId(user.id); setShowAssigneeDropdown(false); }}
														className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 flex items-center gap-2
                              ${assigneeId === user.id ? 'bg-parchment-200' : ''}`}
													>
														<div className="w-5 h-5 rounded-full bg-gradient-to-br from-lapis-400 to-lapis-600 flex items-center justify-center">
															<span className="text-[9px] text-parchment-100 font-semibold">
																{(user.fullName?.[0] || user.username[0]).toUpperCase()}
															</span>
														</div>
														{user.fullName || user.username}
													</button>
												))}
											</div>
										)}
									</div>
								) : selectedAssignee ? (
									<div className="flex items-center gap-2">
										<div className="w-7 h-7 rounded-full bg-gradient-to-br from-lapis-400 to-lapis-600 flex items-center justify-center ring-2 ring-parchment-200">
											<span className="text-xs text-parchment-100 font-semibold">
												{(selectedAssignee.fullName?.[0] || selectedAssignee.username[0]).toUpperCase()}
											</span>
										</div>
										<span className="text-sm text-lapis-700 font-medium">{selectedAssignee.fullName || selectedAssignee.username}</span>
									</div>
								) : (
									<span className="text-sm text-lapis-400 italic">{t('issueModal.unassigned')}</span>
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
										<div className="w-7 h-7 rounded-full bg-gradient-to-br from-clay-400 to-clay-600 flex items-center justify-center ring-2 ring-parchment-200">
											<span className="text-xs text-parchment-100 font-semibold">
												{(issue.reporter.fullName?.[0] || issue.reporter.username[0]).toUpperCase()}
											</span>
										</div>
										<span className="text-sm text-lapis-700 font-medium">{issue.reporter.fullName || issue.reporter.username}</span>
									</div>
								) : (
									<span className="text-sm text-lapis-400 italic">{isCreating ? t('issueModal.you') : t('issueModal.unknown')}</span>
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
                      focus:border-lapis-400 focus:bg-parchment-100 outline-none transition-all
                    "
									/>
								) : dueDate ? (
									<span className={`text-sm font-medium ${isDueOverdue ? 'text-red-600' : 'text-lapis-700'}`}>
										{formatDate(dueDate)}
										{isDueOverdue && <span className="ltr:ml-2 rtl:mr-2 text-xs text-red-500">({t('issueModal.overdue')})</span>}
									</span>
								) : (
									<span className="text-sm text-lapis-400 italic">{t('issueModal.noDueDate')}</span>
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
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between px-6 py-4 border-t border-parchment-200 bg-parchment-100/80">
					<div className="text-xs text-lapis-400">
						{issue?.updatedAt && !isCreating && (
							<span title={formatDate(issue.updatedAt) || ''}>
								{t('issueModal.lastUpdated')}: {formatRelativeTime(issue.updatedAt)}
							</span>
						)}
					</div>

					<div className="flex items-center gap-3">
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
									<HotkeyBadge keys="Escape" />
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
									<HotkeyBadge keys="Ctrl+Enter" variant="dark" />
								</button>
							</>
						) : (
							<p className="text-xs text-lapis-400 flex items-center gap-1">
								{t('issueModal.pressToEdit')} <HotkeyBadge keys="e" />
								{' '}&bull;{' '}
								<HotkeyBadge keys="Escape" /> {t('issueModal.toClose')}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
