import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Item, Batch } from '../types';
import { useTranslation } from 'react-i18next';
import { SmartNumberInputWithSpinners } from './FormControls';

interface AddBatchModalProps {
  item: Item;
  onClose: () => void;
  onAdd: (productId: string, batch: Partial<Batch>) => void;
}

export const AddBatchModal = ({ item, onClose, onAdd }: AddBatchModalProps) => {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [expiryDate, setExpiryDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center shrink-0">
          <h2 className="font-semibold text-lg text-zinc-900">
            {t('addBatchTitle')} - {item.name}
          </h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">{t('quantity')}</label>
            <SmartNumberInputWithSpinners
              value={quantity}
              onChange={setQuantity}
              className="w-full h-[42px] text-lg font-semibold text-center bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          {(item.lifecycle_type === 'perishable' || item.lifecycle_type === 'consumable') && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                {t('expiryDate')}
              </label>
              <input 
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-[42px] px-3 text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="h-[42px] px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={() => {
              const batch: Partial<Batch> = {
                quantity,
                added_date: new Date().toISOString(),
              };
              if (item.lifecycle_type === 'perishable' || item.lifecycle_type === 'consumable') {
                batch.expiration_date = expiryDate;
              }
              onAdd(item.id, batch);
              onClose();
            }}
            className="h-[42px] px-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            {t('confirm')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
