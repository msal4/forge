import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Palette, User, Check, AlertCircle, ChevronDown, Send, Link2, Unlink, Loader2, ExternalLink } from 'lucide-react';
import { usersApi, type TelegramStatus } from '../api/users';
import { useWebSocket } from '../context/WebSocketContext';

// ============================================
// Settings Page
// ============================================

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { lastEvent } = useWebSocket();
  
  const currentLanguage = i18n.language;

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

  const handleLanguageChange = (newLang: string) => {
    i18n.changeLanguage(newLang);
    setShowLanguageDropdown(false);
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

  const handleUnlinkTelegram = async () => {
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
        <h1 className="text-2xl font-inscription text-lapis-600">
          {t('settings.title')}
        </h1>
        <p className="text-lapis-500 text-sm mt-1">
          {t('settings.tagline')}
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Language Setting */}
        <div className="tablet-card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-tablet bg-lapis-100 text-lapis-600">
              <Globe size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-medium text-lapis-700">
                {t('settings.language')}
              </h2>
              <p className="text-sm text-lapis-500 mt-1">
                {t('settings.languageDescription')}
              </p>
              <div className="mt-4">
                <div ref={languageRef} className="relative w-full max-w-xs">
                  <button
                    onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                    className={`
                      w-full h-10 px-4 flex items-center justify-between
                      bg-parchment-100 text-lapis-700 text-sm
                      border rounded-tablet
                      transition-all
                      ${showLanguageDropdown
                        ? 'border-lapis-400 ring-2 ring-gold-400/30'
                        : 'border-parchment-300 hover:border-lapis-300'
                      }
                    `}
                  >
                    <span>
                      {languages.find(l => l.code === currentLanguage)?.label || currentLanguage}
                    </span>
                    <ChevronDown 
                      size={16} 
                      className={`text-lapis-400 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} 
                    />
                  </button>

                  {showLanguageDropdown && (
                    <div className="
                      absolute top-full left-0 right-0 mt-1 z-20
                      bg-parchment-50 border border-parchment-300 
                      rounded-tablet shadow-tablet
                      py-1
                      animate-fade-in
                    ">
                      {languages.map(lang => (
                        <button
                          key={lang.code}
                          onClick={() => handleLanguageChange(lang.code)}
                          className={`
                            w-full px-4 py-2 text-left text-sm 
                            hover:bg-parchment-200 transition-colors
                            flex items-center justify-between
                            ${currentLanguage === lang.code 
                              ? 'bg-parchment-200 text-lapis-700' 
                              : 'text-lapis-600'
                            }
                          `}
                        >
                          <span>{lang.label}</span>
                          {currentLanguage === lang.code && (
                            <Check size={16} className="text-lapis-600" />
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
            <div className="p-3 rounded-tablet bg-blue-100 text-blue-600">
              <Send size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-medium text-lapis-700">
                {t('settings.telegram')}
              </h2>
              <p className="text-sm text-lapis-500 mt-1">
                {t('settings.telegramDescription')}
              </p>

              <div className="mt-4">
                {isLoadingTelegram ? (
                  <div className="flex items-center gap-2 text-lapis-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t('common.loading')}</span>
                  </div>
                ) : !telegramStatus?.enabled ? (
                  <div className="text-sm text-lapis-500 bg-parchment-100 px-4 py-3 rounded-tablet">
                    {t('settings.telegramNotConfigured')}
                  </div>
                ) : telegramStatus?.linked ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <Check size={16} />
                      <span className="text-sm font-medium">{t('settings.telegramLinked')}</span>
                      {telegramStatus.chatId && (
                        <span className="text-lapis-500 text-sm">({telegramStatus.chatId})</span>
                      )}
                    </div>
                    <button
                      onClick={handleUnlinkTelegram}
                      disabled={isUnlinkingTelegram}
                      className="flex items-center gap-2 px-4 py-2 rounded-tablet 
                                 border border-clay-300 text-clay-600
                                 hover:bg-clay-50 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors text-sm"
                    >
                      {isUnlinkingTelegram ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Unlink size={16} />
                      )}
                      <span>{t('settings.unlinkTelegram')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-lapis-600">
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
                        <Loader2 size={16} className="animate-spin" />
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
                  <div className="flex items-center gap-2 text-clay-600 text-sm mt-3">
                    <AlertCircle size={16} />
                    <span>{telegramError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Theme Setting (Coming Soon) */}
        <div className="tablet-card p-6 opacity-60">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-tablet bg-gold-100 text-gold-600">
              <Palette size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-medium text-lapis-700">
                {t('settings.theme')}
              </h2>
              <p className="text-sm text-lapis-500 mt-1">
                {t('settings.themeDescription')}
              </p>
            </div>
          </div>
        </div>

        {/* Account Setting - Change Password */}
        <div className="tablet-card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-tablet bg-clay-100 text-clay-600">
              <User size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-medium text-lapis-700">
                {t('settings.changePassword')}
              </h2>
              <p className="text-sm text-lapis-500 mt-1">
                {t('settings.changePasswordDescription')}
              </p>
              
              <form onSubmit={handlePasswordChange} className="mt-4 space-y-4 max-w-sm">
                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-lapis-600 mb-1">
                    {t('settings.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-tablet border border-parchment-300 
                               bg-parchment-100 text-lapis-700
                               focus:ring-2 focus:ring-gold-400/30 focus:outline-none
                               transition-colors"
                    required
                    minLength={4}
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-lapis-600 mb-1">
                    {t('settings.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-tablet border border-parchment-300 
                               bg-parchment-100 text-lapis-700
                               focus:ring-2 focus:ring-gold-400/30 focus:outline-none
                               transition-colors"
                    required
                    minLength={4}
                  />
                </div>

                {/* Error Message */}
                {passwordError && (
                  <div className="flex items-center gap-2 text-clay-600 text-sm">
                    <AlertCircle size={16} />
                    <span>{passwordError}</span>
                  </div>
                )}

                {/* Success Message */}
                {passwordSuccess && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <Check size={16} />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                  className="px-4 py-2 rounded-tablet bg-lapis-600 text-white font-medium
                             hover:bg-lapis-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                >
                  {isChangingPassword ? t('settings.changingPassword') : t('settings.changePassword')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
