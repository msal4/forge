import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import ar from './ar';

// Get saved language from localStorage or default to English
const savedLanguage = typeof window !== 'undefined' 
  ? localStorage.getItem('language') || 'en'
  : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

// Update document direction when language changes
i18n.on('languageChanged', (lng) => {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
  localStorage.setItem('language', lng);
});

// Set initial direction
if (typeof window !== 'undefined') {
  const dir = savedLanguage === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = savedLanguage;
}

export default i18n;
