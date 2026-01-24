import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Palette, User, Check, AlertCircle } from 'lucide-react';
import { usersApi } from '../api/users';

// ============================================
// Settings Page
// ============================================

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  
  const currentLanguage = i18n.language;

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
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
                <select
                  value={currentLanguage}
                  onChange={handleLanguageChange}
                  className="w-full max-w-xs px-4 py-2 rounded-tablet border border-parchment-300 
                             bg-parchment-100 text-lapis-700
                             focus:ring-2 focus:ring-gold-400/30 focus:outline-none
                             transition-colors"
                >
                  <option value="en">{t('settings.english')}</option>
                  <option value="ar">{t('settings.arabic')}</option>
                </select>
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
