import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ExternalLink, Search, Link, Copy, Maximize2 } from 'lucide-react';
import { Item, Category, Location, LifecycleType } from '../types';
import { Language, Currency } from '../i18n';
import { useTranslation } from 'react-i18next';
import { SmartNumberInputWithSpinners, SmartNotesInput } from './FormControls';

interface EditItemModalProps {
  item: Item;
  categories: Category[];
  locations: Location[];
  lang: Language;
  currency: Currency;
  onClose: () => void;
  onUpdate: (updatedItem: Item) => void;
  isEmbedded?: boolean;
}

export function EditItemModal({ item, categories, locations, lang, currency, onClose, onUpdate, isEmbedded }: EditItemModalProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: item.name,
    category_id: item.category_id,
    location_id: item.location_id,
    quantity: item.quantity,
    alert_threshold: item.alert_threshold || (item.lifecycle_type === 'consumable' ? 2 : 5),
    lifecycle_type: item.lifecycle_type as LifecycleType,
    lifecycle_interval_days: item.lifecycle_interval_days || 0,
    last_action_date: item.last_action_date || '',
    expiration_date: item.expiration_date || '',
    notes: item.notes || '',
    is_permanent: item.lifecycle_interval_days === 0
  });
  const [saving, setSaving] = useState(false);
  const [cachedInterval, setCachedInterval] = useState(item.lifecycle_interval_days || 0);

  // Update formData when permanent toggle changes
  React.useEffect(() => {
    if (formData.is_permanent) {
      if (formData.lifecycle_interval_days > 0) {
        setCachedInterval(formData.lifecycle_interval_days);
      }
      setFormData(prev => ({ ...prev, lifecycle_interval_days: 0 }));
    } else {
      if (formData.lifecycle_interval_days === 0 && cachedInterval > 0) {
        setFormData(prev => ({ ...prev, lifecycle_interval_days: cachedInterval }));
      }
    }
  }, [formData.is_permanent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onUpdate(await res.json());
      }
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSmartSearch = () => {
    if (!formData.name) return;
    const searchUrl = lang === 'zh' 
      ? `https://s.taobao.com/search?q=${encodeURIComponent(formData.name)}`
      : `https://www.amazon.com/s?k=${encodeURIComponent(formData.name)}`;
    window.open(searchUrl, '_blank');
  };

  const content = (
    <>
      <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center shrink-0">
        <h2 className="font-semibold text-lg">{t('editItem')}</h2>
        {!isEmbedded && (
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">{t('name')} *</label>
          <div className="flex gap-2">
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleSmartSearch}
              className="flex items-center justify-center px-3 bg-zinc-50 text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors shrink-0"
              title={t('searchOnWeb')}
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">{t('category')}</label>
            <select 
              value={formData.category_id}
              onChange={e => setFormData({...formData, category_id: e.target.value})}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
            >
              {categories.map(c => <option key={c.id} value={c.id}>{t(c.name as any)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">{t('location')}</label>
            <select 
              value={formData.location_id}
              onChange={e => setFormData({...formData, location_id: e.target.value})}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
            >
              {locations.map(l => <option key={l.id} value={l.id}>{t(l.name as any)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">{t('lifecycleType')}</label>
          <div className="grid grid-cols-3 gap-2">
            {(['perishable', 'consumable', 'maintenance'] as LifecycleType[]).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({...formData, lifecycle_type: type})}
                className={`px-3 py-2 text-sm rounded-lg border capitalize transition-colors ${
                  formData.lifecycle_type === type 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {t(type as any)}
              </button>
            ))}
          </div>
        </div>

        {formData.lifecycle_type === 'perishable' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('quantity')}</label>
              <SmartNumberInputWithSpinners
                value={formData.quantity}
                onChange={val => setFormData({...formData, quantity: val})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('expDate')}</label>
              <input 
                type="date" 
                value={formData.expiration_date}
                onChange={e => setFormData({...formData, expiration_date: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="permanentUseEdit"
                checked={formData.is_permanent}
                onChange={e => setFormData({...formData, is_permanent: e.target.checked})}
                className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
              />
              <label htmlFor="permanentUseEdit" className="text-sm font-medium text-zinc-700 select-none">
                {t('permanentUse')}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{t('intervalDays')}</label>
                <SmartNumberInputWithSpinners
                  min={0}
                  disabled={formData.is_permanent}
                  value={formData.lifecycle_interval_days}
                  onChange={val => setFormData({...formData, lifecycle_interval_days: val})}
                  className="disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {formData.lifecycle_type === 'consumable' ? t('firstUsed') : t('lastMaintained')}
                </label>
                <input 
                  type="date" 
                  required
                  value={formData.last_action_date}
                  onChange={e => setFormData({...formData, last_action_date: e.target.value})}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {formData.lifecycle_type === 'perishable' ? t('alertWhenDaysLess') : t('alertWhenBelow')}
            </label>
            <SmartNumberInputWithSpinners
              value={formData.alert_threshold}
              onChange={val => setFormData({...formData, alert_threshold: val})}
              unitLabel={formData.lifecycle_type === 'perishable' ? t('thresholdDays') : t('thresholdItems')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">{t('notes')}</label>
            <SmartNotesInput
              value={formData.notes}
              onChange={val => setFormData({...formData, notes: val})}
              placeholder={t('notesPlaceholder')}
            />
          </div>
        </div>
      </form>
      <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3 shrink-0">
        <button 
          type="button" 
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
        >
          {t('cancel')}
        </button>
        <button 
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? t('loading') : t('saveChanges')}
        </button>
      </div>
    </>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
      >
        {content}
      </motion.div>
    </div>
  );
}
