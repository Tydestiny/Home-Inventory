import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Maximize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SmartNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  className?: string;
  unitLabel?: string;
  disabled?: boolean;
}

export function SmartNumberInput({ value, onChange, min = 0, className = '', unitLabel, disabled }: SmartNumberInputProps) {
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valStr = e.target.value;
    
    // Handle empty to zero
    if (valStr === '') {
      onChange(0);
      return;
    }

    // Remove leading zeros if typing non-zero
    if (valStr.length > 1 && valStr.startsWith('0')) {
      valStr = valStr.replace(/^0+/, '');
    }

    const val = parseInt(valStr);
    if (!isNaN(val)) {
      onChange(Math.max(min, val));
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        type="number"
        min={min}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        className={`w-full pl-3 ${unitLabel ? 'pr-10' : 'pr-3'} py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
      />
      {unitLabel && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-medium pointer-events-none">
          {unitLabel}
        </span>
      )}
    </div>
  );
}

// Revised SmartNumberInput to actually show native spinners but avoid overlap
export function SmartNumberInputWithSpinners({ value, onChange, min = 0, className = '', unitLabel, disabled }: SmartNumberInputProps) {
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valStr = e.target.value;
    if (valStr === '') {
      onChange(0);
      return;
    }
    if (valStr.length > 1 && valStr.startsWith('0')) {
      valStr = valStr.replace(/^0+/, '');
    }
    const val = parseInt(valStr);
    if (!isNaN(val)) {
      onChange(Math.max(min, val));
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        type="number"
        min={min}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        className={`w-full pl-3 ${unitLabel ? 'pr-14' : 'pr-3'} py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${className}`}
      />
      {unitLabel && (
        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-medium pointer-events-none z-10">
          {unitLabel}
        </span>
      )}
    </div>
  );
}

interface SmartNotesInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SmartNotesInput({ value, onChange, placeholder, className = '' }: SmartNotesInputProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="relative group">
        <input
          type="text"
          value={value}
          readOnly
          onClick={() => setIsExpanded(true)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer bg-white ${className}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
              title={t('copy')}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpanded(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
                <h3 className="font-semibold text-zinc-900">{t('notes')}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {t('copy')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <textarea
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-64 p-6 text-zinc-700 focus:outline-none resize-none leading-relaxed"
              />
              <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  {t('confirm')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
