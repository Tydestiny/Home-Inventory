import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Globe, DollarSign } from 'lucide-react';
import { Language, Currency } from '../i18n';
import { useTranslation } from 'react-i18next';

interface SettingsModalProps {
  currentLanguage: Language;
  currentCurrency: Currency;
  onClose: () => void;
  onSave: (lang: Language, curr: Currency) => void;
}

export function SettingsModal({ currentLanguage, currentCurrency, onClose, onSave }: SettingsModalProps) {
  const { t } = useTranslation();
  const [lang, setLang] = useState<Language>(currentLanguage);
  const [curr, setCurr] = useState<Currency>(currentCurrency);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, currency: curr })
      });
      if (res.ok) {
        onSave(lang, curr);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="font-semibold text-lg">{t('settings')}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 mb-3">
              <Globe className="w-4 h-4" /> {t('language')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLang('en')}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  lang === 'en' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLang('zh')}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  lang === 'zh' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                中文 (Chinese)
              </button>
            </div>
          </div>
          
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 mb-3">
              <DollarSign className="w-4 h-4" /> {t('currency')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCurr('USD')}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  curr === 'USD' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                USD ($)
              </button>
              <button
                onClick={() => setCurr('CNY')}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  curr === 'CNY' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                CNY (¥)
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
