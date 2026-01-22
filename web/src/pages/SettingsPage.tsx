import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Palette, User } from 'lucide-react';

// ============================================
// Settings Page
// ============================================

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  
  const currentLanguage = i18n.language;

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
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
                             focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
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

        {/* Account Setting (Coming Soon) */}
        <div className="tablet-card p-6 opacity-60">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-tablet bg-clay-100 text-clay-600">
              <User size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-medium text-lapis-700">
                {t('settings.account')}
              </h2>
              <p className="text-sm text-lapis-500 mt-1">
                {t('settings.accountDescription')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
