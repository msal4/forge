import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Palette, User, Check, AlertCircle, ChevronDown, Send, Link2, Unlink, ExternalLink, Camera, Trash2, Save, Sun, Moon, Monitor } from 'lucide-react';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { usersApi, type TelegramStatus } from '../api/users';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { Avatar } from '../components/ui/Avatar';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';

// ============================================
// Settings Page
// ============================================

export function SettingsPage() {
	const { t, i18n } = useTranslation();
	const { lastEvent } = useWebSocket();
	const { user, refreshUser } = useAuth();
	const { theme, setTheme } = useTheme();

	const currentLanguage = i18n.language;

	// Profile state
	const [fullName, setFullName] = useState(user?.fullName || '');
	const [isEditingName, setIsEditingName] = useState(false);
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [profileError, setProfileError] = useState('');
	const [profileSuccess, setProfileSuccess] = useState('');
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
	const [avatarError, setAvatarError] = useState('');
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Sync fullName with user when user changes
	useEffect(() => {
		if (user?.fullName) {
			setFullName(user.fullName);
		}
	}, [user?.fullName]);

	// Language dropdown state
	const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
	const languageRef = useRef<HTMLDivElement>(null);

	// Password change state
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [passwordError, setPasswordError] = useState('');
	const [passwordSuccess, setPasswordSuccess] = useState('');
	const [isChangingPassword, setIsChangingPassword] = useState(false);

	// Telegram state
	const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
	const [isLoadingTelegram, setIsLoadingTelegram] = useState(true);
	const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
	const [isUnlinkingTelegram, setIsUnlinkingTelegram] = useState(false);
	const [telegramError, setTelegramError] = useState('');

	// Load Telegram status on mount
	const loadTelegramStatus = useCallback(async () => {
		try {
			const status = await usersApi.getTelegramStatus();
			setTelegramStatus(status);
		} catch (err) {
			console.error('Failed to load Telegram status:', err);
		} finally {
			setIsLoadingTelegram(false);
		}
	}, []);

	useEffect(() => {
		loadTelegramStatus();
	}, [loadTelegramStatus]);

	// Listen for WebSocket events (telegram_linked)
	useEffect(() => {
		if (lastEvent?.type === 'telegram_linked') {
			loadTelegramStatus();
		}
	}, [lastEvent, loadTelegramStatus]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (languageRef.current && !languageRef.current.contains(event.target as Node)) {
				setShowLanguageDropdown(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const handleLanguageChange = async (newLang: string) => {
		// Update UI immediately
		i18n.changeLanguage(newLang);
		setShowLanguageDropdown(false);

		// Save to backend (for Telegram notifications etc.)
		try {
			await usersApi.updateLanguage(newLang);
		} catch (err) {
			console.error('Failed to save language preference:', err);
			// Don't revert UI - local language change still works
		}
	};

	const languages = [
		{ code: 'en', label: t('settings.english') },
		{ code: 'ar', label: t('settings.arabic') },
	];

	// Telegram handlers
	const handleLinkTelegram = async () => {
		setTelegramError('');
		setIsLinkingTelegram(true);
		try {
			const { linkUrl } = await usersApi.generateTelegramLink();
			// Open Telegram deep link in new tab
			window.open(linkUrl, '_blank');
		} catch (err) {
			setTelegramError(t('settings.telegramLinkFailed'));
			console.error('Failed to generate Telegram link:', err);
		} finally {
			setIsLinkingTelegram(false);
		}
	};

	// Confirmation dialog for Telegram unlink
	const { confirm, DialogComponent: ConfirmDialogComponent } = useConfirmDialog();

	const handleUnlinkTelegram = async () => {
		const confirmed = await confirm({
			title: t('settings.unlinkTelegramConfirmTitle'),
			message: t('settings.unlinkTelegramConfirmMessage'),
			confirmLabel: t('settings.unlinkTelegram'),
			variant: 'warning',
		});

		if (!confirmed) return;

		setTelegramError('');
		setIsUnlinkingTelegram(true);
		try {
			await usersApi.unlinkTelegram();
			setTelegramStatus(prev => prev ? { ...prev, linked: false, chatId: undefined } : null);
		} catch (err) {
			setTelegramError(t('settings.telegramUnlinkFailed'));
			console.error('Failed to unlink Telegram:', err);
		} finally {
			setIsUnlinkingTelegram(false);
		}
	};

	// Profile handlers
	const handleSaveProfile = async () => {
		if (!fullName.trim()) {
			setProfileError(t('settings.nameRequired'));
			return;
		}

		setProfileError('');
		setProfileSuccess('');
		setIsSavingProfile(true);

		try {
			await usersApi.updateProfile(fullName.trim());
			await refreshUser();
			setProfileSuccess(t('settings.profileUpdated'));
			setIsEditingName(false);
		} catch (err) {
			setProfileError(t('settings.profileUpdateFailed'));
			console.error('Failed to update profile:', err);
		} finally {
			setIsSavingProfile(false);
		}
	};

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			setAvatarError(t('settings.invalidImageType'));
			return;
		}

		// Validate file size (2MB)
		if (file.size > 2 * 1024 * 1024) {
			setAvatarError(t('settings.imageTooLarge'));
			return;
		}

		setAvatarError('');
		setIsUploadingAvatar(true);

		try {
			await usersApi.uploadAvatar(file);
			await refreshUser();
		} catch (err) {
			setAvatarError(t('settings.avatarUploadFailed'));
			console.error('Failed to upload avatar:', err);
		} finally {
			setIsUploadingAvatar(false);
			// Reset file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	const handleDeleteAvatar = async () => {
		setAvatarError('');
		setIsDeletingAvatar(true);

		try {
			await usersApi.deleteAvatar();
			await refreshUser();
		} catch (err) {
			setAvatarError(t('settings.avatarDeleteFailed'));
			console.error('Failed to delete avatar:', err);
		} finally {
			setIsDeletingAvatar(false);
		}
	};

	const handlePasswordChange = async (e: React.FormEvent) => {
		e.preventDefault();
		setPasswordError('');
		setPasswordSuccess('');

		// Validate passwords match
		if (newPassword !== confirmPassword) {
			setPasswordError(t('settings.passwordMismatch'));
			return;
		}

		// Validate minimum length
		if (newPassword.length < 4) {
			setPasswordError(t('settings.passwordTooShort'));
			return;
		}

		setIsChangingPassword(true);

		try {
			await usersApi.changePassword(newPassword);
			setPasswordSuccess(t('settings.passwordChanged'));
			setNewPassword('');
			setConfirmPassword('');
		} catch {
			setPasswordError(t('settings.passwordChangeFailed'));
		} finally {
			setIsChangingPassword(false);
		}
	};

	return (
		<div className="space-y-6 max-w-2xl">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-inscription text-lapis-600 dark:text-parchment-200">
					{t('settings.title')}
				</h1>
				<p className="text-lapis-500 dark:text-parchment-400 text-sm mt-1">
					{t('settings.tagline')}
				</p>
			</div>

			{/* Settings Sections */}
			<div className="space-y-4">
				{/* Profile Section */}
				<div className="tablet-card p-6">
					<div className="flex items-start gap-4">
						<div className="p-3 rounded-tablet bg-lapis-100 dark:bg-lapis-800 text-lapis-600 dark:text-parchment-300">
							<User size={24} />
						</div>
						<div className="flex-1">
							<h2 className="text-lg font-medium text-lapis-700 dark:text-parchment-200">
								{t('settings.profile')}
							</h2>
							<p className="text-sm text-lapis-500 dark:text-parchment-400 mt-1">
								{t('settings.profileDescription')}
							</p>

							<div className="mt-6 flex flex-col sm:flex-row gap-6">
								{/* Avatar Section */}
								<div className="flex flex-col items-center gap-3">
									<div className="relative group">
										{/* Large avatar display */}
										<div className="w-24 h-24 rounded-full overflow-hidden bg-parchment-200 dark:bg-lapis-700">
											{user?.avatarUrl ? (
												<img
													src={user.avatarUrl}
													alt={user.fullName}
													className="w-full h-full object-cover"
												/>
											) : (
												<div className="w-full h-full flex items-center justify-center">
													<Avatar
														name={user?.fullName}
														size="lg"
														className="w-24 h-24 text-3xl"
													/>
												</div>
											)}
										</div>

										{/* Upload overlay */}
										<button
											onClick={() => fileInputRef.current?.click()}
											disabled={isUploadingAvatar}
											className="absolute inset-0 flex items-center justify-center rounded-full
                                 bg-black/50 opacity-0 group-hover:opacity-100
                                 transition-opacity cursor-pointer"
										>
											{isUploadingAvatar ? (
												<LoadingIndicator size="lg" className="text-white" inline />
											) : (
												<Camera size={24} className="text-white" />
											)}
										</button>

										<input
											ref={fileInputRef}
											type="file"
											accept="image/jpeg,image/png,image/webp"
											onChange={handleAvatarUpload}
											className="hidden"
										/>
									</div>

									{/* Remove photo button */}
									{user?.avatarUrl && (
										<button
											onClick={handleDeleteAvatar}
											disabled={isDeletingAvatar}
											className="flex items-center gap-1 text-sm text-clay-600 hover:text-clay-700
                                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
										>
											{isDeletingAvatar ? (
												<LoadingIndicator size="xs" inline />
											) : (
												<Trash2 size={14} />
											)}
											<span>{t('settings.removePhoto')}</span>
										</button>
									)}

									{/* Avatar error */}
									{avatarError && (
										<div className="flex items-center gap-1 text-clay-600 text-xs">
											<AlertCircle size={12} />
											<span>{avatarError}</span>
										</div>
									)}
								</div>

								{/* Name Section */}
								<div className="flex-1 space-y-4">
									<div>
										<label className="block text-sm font-medium text-lapis-600 dark:text-parchment-300 mb-1">
											{t('settings.displayName')}
										</label>
										{isEditingName ? (
											<div className="flex gap-2">
												<input
													type="text"
													value={fullName}
													onChange={(e) => setFullName(e.target.value)}
													className="flex-1 px-4 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600
                                     bg-parchment-100 dark:bg-lapis-800 text-lapis-700 dark:text-parchment-200
                                     focus:ring-2 focus:ring-gold-400/30 dark:focus:ring-gold-500/40 focus:outline-none
                                     transition-colors"
													maxLength={100}
													autoFocus
												/>
												<button
													onClick={handleSaveProfile}
													disabled={isSavingProfile}
													className="px-4 py-2 rounded-tablet bg-lapis-600 dark:bg-gold-600 text-white dark:text-lapis-950
                                     hover:bg-lapis-700 dark:hover:bg-gold-500 disabled:opacity-50 disabled:cursor-not-allowed
                                     transition-colors flex items-center gap-2"
												>
													{isSavingProfile ? (
														<LoadingIndicator size="sm" inline />
													) : (
														<Save size={16} />
													)}
													<span>{t('common.save')}</span>
												</button>
												<button
													onClick={() => {
														setIsEditingName(false);
														setFullName(user?.fullName || '');
														setProfileError('');
													}}
													className="px-4 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600
                                     text-lapis-600 dark:text-parchment-300 hover:bg-parchment-200 dark:hover:bg-lapis-700
                                     transition-colors"
												>
													{t('common.cancel')}
												</button>
											</div>
										) : (
											<div className="flex items-center gap-2">
												<span className="text-lapis-700 dark:text-parchment-200">{user?.fullName}</span>
												<button
													onClick={() => setIsEditingName(true)}
													className="text-sm text-lapis-500 dark:text-parchment-400 hover:text-lapis-600 dark:hover:text-parchment-200 transition-colors"
												>
													{t('common.edit')}
												</button>
											</div>
										)}
									</div>

									<div>
										<label className="block text-sm font-medium text-lapis-600 dark:text-parchment-300 mb-1">
											{t('settings.email')}
										</label>
										<span className="text-lapis-500 dark:text-parchment-400">{user?.email}</span>
									</div>

									<div>
										<label className="block text-sm font-medium text-lapis-600 dark:text-parchment-300 mb-1">
											{t('settings.username')}
										</label>
										<span className="text-lapis-500 dark:text-parchment-400">@{user?.username}</span>
									</div>

									{/* Profile messages */}
									{profileError && (
										<div className="flex items-center gap-2 text-clay-600 dark:text-clay-400 text-sm">
											<AlertCircle size={16} />
											<span>{profileError}</span>
										</div>
									)}
									{profileSuccess && (
										<div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
											<Check size={16} />
											<span>{profileSuccess}</span>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Language Setting */}
				<div className="tablet-card p-6">
					<div className="flex items-start gap-4">
						<div className="p-3 rounded-tablet bg-lapis-100 dark:bg-lapis-800 text-lapis-600 dark:text-parchment-300">
							<Globe size={24} />
						</div>
						<div className="flex-1">
							<h2 className="text-lg font-medium text-lapis-700 dark:text-parchment-200">
								{t('settings.language')}
							</h2>
							<p className="text-sm text-lapis-500 dark:text-parchment-400 mt-1">
								{t('settings.languageDescription')}
							</p>
							<div className="mt-4">
								<div ref={languageRef} className="relative w-full max-w-xs">
									<button
										onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
										className={`
                      w-full h-10 px-4 flex items-center justify-between
                      bg-parchment-100 dark:bg-lapis-800 text-lapis-700 dark:text-parchment-200 text-sm
                      border rounded-tablet
                      transition-all
                      ${showLanguageDropdown
												? 'border-lapis-400 dark:border-gold-500 ring-2 ring-gold-400/30 dark:ring-gold-500/40'
												: 'border-parchment-300 dark:border-lapis-600 hover:border-lapis-300 dark:hover:border-lapis-500'
											}
                    `}
									>
										<span>
											{languages.find(l => l.code === currentLanguage)?.label || currentLanguage}
										</span>
										<ChevronDown
											size={16}
											className={`text-lapis-400 dark:text-parchment-400 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`}
										/>
									</button>

									{showLanguageDropdown && (
										<div className="
                      absolute top-full left-0 right-0 mt-1 z-20
                      bg-parchment-50 dark:bg-lapis-800 border border-parchment-300 dark:border-lapis-600
                      rounded-tablet shadow-tablet dark:shadow-none
                      py-1
                      animate-fade-in
                    ">
											{languages.map(lang => (
												<button
													key={lang.code}
													onClick={() => handleLanguageChange(lang.code)}
													className={`
                            w-full px-4 py-2 text-left text-sm 
                            hover:bg-parchment-200 dark:hover:bg-lapis-700 transition-colors
                            flex items-center justify-between
                            ${currentLanguage === lang.code
															? 'bg-parchment-200 dark:bg-lapis-700 text-lapis-700 dark:text-parchment-200'
															: 'text-lapis-600 dark:text-parchment-300'
														}
                          `}
												>
													<span>{lang.label}</span>
													{currentLanguage === lang.code && (
														<Check size={16} className="text-lapis-600 dark:text-gold-400" />
													)}
												</button>
											))}
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Telegram Notifications */}
				<div className="tablet-card p-6">
					<div className="flex items-start gap-4">
						<div className="p-3 rounded-tablet bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
							<Send size={24} />
						</div>
						<div className="flex-1">
							<h2 className="text-lg font-medium text-lapis-700 dark:text-parchment-200">
								{t('settings.telegram')}
							</h2>
							<p className="text-sm text-lapis-500 dark:text-parchment-400 mt-1">
								{t('settings.telegramDescription')}
							</p>

							<div className="mt-4">
								{isLoadingTelegram ? (
									<div className="flex items-center gap-2 text-lapis-500 dark:text-parchment-400">
										<LoadingIndicator size="sm" inline />
										<span>{t('common.loading')}</span>
									</div>
								) : !telegramStatus?.enabled ? (
									<div className="text-sm text-lapis-500 dark:text-parchment-400 bg-parchment-100 dark:bg-lapis-800 px-4 py-3 rounded-tablet">
										{t('settings.telegramNotConfigured')}
									</div>
								) : telegramStatus?.linked ? (
									<div className="space-y-3">
										<div className="flex items-center gap-2 text-green-600 dark:text-green-400">
											<Check size={16} />
											<span className="text-sm font-medium">{t('settings.telegramLinked')}</span>
											{telegramStatus.chatId && (
												<span className="text-lapis-500 dark:text-parchment-500 text-sm">({telegramStatus.chatId})</span>
											)}
										</div>
										<button
											onClick={handleUnlinkTelegram}
											disabled={isUnlinkingTelegram}
											className="flex items-center gap-2 px-4 py-2 rounded-tablet 
                                 border border-clay-300 dark:border-clay-700 text-clay-600 dark:text-clay-400
                                 hover:bg-clay-50 dark:hover:bg-clay-900/30 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors text-sm"
										>
											{isUnlinkingTelegram ? (
												<LoadingIndicator size="sm" inline />
											) : (
												<Unlink size={16} />
											)}
											<span>{t('settings.unlinkTelegram')}</span>
										</button>
									</div>
								) : (
									<div className="space-y-3">
										<p className="text-sm text-lapis-600 dark:text-parchment-300">
											{t('settings.telegramInstructions')}
										</p>
										<button
											onClick={handleLinkTelegram}
											disabled={isLinkingTelegram}
											className="flex items-center gap-2 px-4 py-2 rounded-tablet 
                                 bg-blue-600 text-white
                                 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors text-sm"
										>
											{isLinkingTelegram ? (
												<LoadingIndicator size="sm" inline />
											) : (
												<>
													<Link2 size={16} />
													<span>{t('settings.linkTelegram')}</span>
													<ExternalLink size={14} />
												</>
											)}
										</button>
									</div>
								)}

								{/* Error Message */}
								{telegramError && (
									<div className="flex items-center gap-2 text-clay-600 dark:text-clay-400 text-sm mt-3">
										<AlertCircle size={16} />
										<span>{telegramError}</span>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Theme Setting */}
				<div className="tablet-card p-6">
					<div className="flex items-start gap-4">
						<div className="p-3 rounded-tablet bg-gold-100 text-gold-600 dark:bg-gold-900/50 dark:text-gold-400">
							<Palette size={24} />
						</div>
						<div className="flex-1">
							<h2 className="text-lg font-medium text-lapis-700 dark:text-parchment-200">
								{t('settings.theme')}
							</h2>
							<p className="text-sm text-lapis-500 dark:text-parchment-400 mt-1">
								{t('settings.themeDescription')}
							</p>

							{/* Theme Toggle Buttons */}
							<div className="mt-4 flex flex-wrap gap-2">
								{([
									{ value: 'light' as ThemeMode, icon: Sun, label: t('settings.themeLight') },
									{ value: 'dark' as ThemeMode, icon: Moon, label: t('settings.themeDark') },
									{ value: 'system' as ThemeMode, icon: Monitor, label: t('settings.themeSystem') },
								]).map(({ value, icon: Icon, label }) => (
									<button
										key={value}
										onClick={() => setTheme(value)}
										className={`
											flex items-center gap-2 px-4 py-2 rounded-tablet text-sm font-medium
											transition-colors
											${theme === value
												? 'bg-lapis-500 text-parchment-100 dark:bg-gold-600 dark:text-lapis-950'
												: 'bg-parchment-200 text-lapis-600 hover:bg-parchment-300 dark:bg-lapis-800 dark:text-parchment-300 dark:hover:bg-lapis-700'
											}
										`}
									>
										<Icon size={16} />
										<span>{label}</span>
									</button>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Account Setting - Change Password */}
				<div className="tablet-card p-6">
					<div className="flex items-start gap-4">
						<div className="p-3 rounded-tablet bg-clay-100 dark:bg-clay-900/50 text-clay-600 dark:text-clay-400">
							<User size={24} />
						</div>
						<div className="flex-1">
							<h2 className="text-lg font-medium text-lapis-700 dark:text-parchment-200">
								{t('settings.changePassword')}
							</h2>
							<p className="text-sm text-lapis-500 dark:text-parchment-400 mt-1">
								{t('settings.changePasswordDescription')}
							</p>

							<form onSubmit={handlePasswordChange} className="mt-4 space-y-4 max-w-sm">
								{/* New Password */}
								<div>
									<label className="block text-sm font-medium text-lapis-600 dark:text-parchment-300 mb-1">
										{t('settings.newPassword')}
									</label>
									<input
										type="password"
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										className="w-full px-4 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600
                               bg-parchment-100 dark:bg-lapis-800 text-lapis-700 dark:text-parchment-200
                               focus:ring-2 focus:ring-gold-400/30 dark:focus:ring-gold-500/40 focus:outline-none
                               transition-colors"
										required
										minLength={4}
									/>
								</div>

								{/* Confirm Password */}
								<div>
									<label className="block text-sm font-medium text-lapis-600 dark:text-parchment-300 mb-1">
										{t('settings.confirmPassword')}
									</label>
									<input
										type="password"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										className="w-full px-4 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600
                               bg-parchment-100 dark:bg-lapis-800 text-lapis-700 dark:text-parchment-200
                               focus:ring-2 focus:ring-gold-400/30 dark:focus:ring-gold-500/40 focus:outline-none
                               transition-colors"
										required
										minLength={4}
									/>
								</div>

								{/* Error Message */}
								{passwordError && (
									<div className="flex items-center gap-2 text-clay-600 dark:text-clay-400 text-sm">
										<AlertCircle size={16} />
										<span>{passwordError}</span>
									</div>
								)}

								{/* Success Message */}
								{passwordSuccess && (
									<div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
										<Check size={16} />
										<span>{passwordSuccess}</span>
									</div>
								)}

								{/* Submit Button */}
								<button
									type="submit"
									disabled={isChangingPassword || !newPassword || !confirmPassword}
									className="px-4 py-2 rounded-tablet bg-lapis-600 dark:bg-gold-600 text-white dark:text-lapis-950 font-medium
                             hover:bg-lapis-700 dark:hover:bg-gold-500 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
								>
									{isChangingPassword ? t('settings.changingPassword') : t('settings.changePassword')}
								</button>
							</form>
						</div>
					</div>
				</div>
			</div>

			{/* Confirmation Dialog */}
			{ConfirmDialogComponent}
		</div>
	);
}
