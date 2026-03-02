import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';
import zhTranslation from './locales/zh/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      zh: { translation: zhTranslation }
    },
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export type Language = 'en' | 'zh';
export type Currency = 'USD' | 'CNY';

export const formatCurrency = (amount: number, currency: Currency) => {
  if (currency === 'CNY') {
    return `¥${amount.toFixed(2)}`;
  }
  return `$${amount.toFixed(2)}`;
};

export const formatDate = (dateString: string, lang: Language) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (lang === 'zh') {
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default i18n;
