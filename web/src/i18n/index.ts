import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import ar from './ar';

// Get saved language from localStorage, or detect from browser, or default to English
const getInitialLanguage = (): string => {
  if (typeof window === 'undefined') return 'en';
  
  // Check localStorage first
  const saved = localStorage.getItem('language');
  if (saved) return saved;
  
  // Auto-detect from browser locale
  const browserLang = navigator.language.split('-')[0]; // e.g., 'ar-IQ' -> 'ar'
  if (browserLang === 'ar') return 'ar';
  
  return 'en';
};

const savedLanguage = getInitialLanguage();

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
