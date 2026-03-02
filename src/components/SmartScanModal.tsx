/// <reference types="vite/client" />
import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Camera, Upload, X, Check, Loader2, AlertCircle, Clipboard } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { Category, Location, LifecycleType, SmartPreset } from '../types';
import { Language } from '../i18n';
import { useTranslation } from 'react-i18next';

interface SmartScanModalProps {
  categories: Category[];
  locations: Location[];
  presets: SmartPreset[];
  lang: Language;
  onClose: () => void;
  onAddMultiple: (items: any[]) => Promise<void>;
}

export function SmartScanModal({ categories, locations, presets, lang, onClose, onAddMultiple }: SmartScanModalProps) {
  const { t } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
      analyzeImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        if (item.types.some(type => type.startsWith('image/'))) {
          const blob = await item.getType(item.types.find(type => type.startsWith('image/'))!);
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setImage(base64);
            analyzeImage(base64);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      setError(lang === 'zh' ? '剪贴板中未找到图片。' : 'No image found in clipboard.');
    } catch (err) {
      console.error('Error reading clipboard:', err);
      setError(lang === 'zh' ? '无法读取剪贴板。请检查权限。' : 'Failed to read clipboard. Please check permissions.');
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      // Remove data:image/jpeg;base64, prefix
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.split(';')[0].split(':')[1];

      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            },
            {
              text: `Analyze this image (could be a receipt, pantry shelf, or product). Extract all identifiable household items, groceries, or supplies.
              IMPORTANT: The 'name' MUST be in ${lang === 'zh' ? 'Chinese' : 'English'} ONLY. DO NOT include bilingual names or translations (e.g., use '大米' not '大米 (Rice)').
              For each item, provide:
              - name: A clean, concise product name in ${lang === 'zh' ? 'Chinese' : 'English'}.
              - category_id: Best matching category ID from this list: ${categories.map(c => `${c.id} (${c.name})`).join(', ')}. If unsure, pick the closest one.
              - quantity: Estimated quantity (default 1).
              - alert_threshold: Sensible default alert threshold (e.g., 2 for quantity, 5 for days).
              - lifecycle_type: 'perishable' (food/medicine), 'consumable' (sponges, batteries), or 'maintenance' (tasks).
              - lifecycle_interval_days: If consumable/maintenance, estimate the replacement/maintenance interval in days (e.g., 14 for sponge, 90 for toothbrush). 0 if perishable.
              `
            }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                category_id: { type: Type.STRING },
                quantity: { type: Type.INTEGER },
                alert_threshold: { type: Type.INTEGER },
                lifecycle_type: { type: Type.STRING },
                lifecycle_interval_days: { type: Type.INTEGER }
              },
              required: ['name', 'category_id', 'quantity', 'alert_threshold', 'lifecycle_type', 'lifecycle_interval_days']
            }
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        // Add default location and dates to each item
        const defaultLocation = locations[0]?.id || '';
        const enrichedItems = parsed.map((item: any) => ({
          ...item,
          location_id: defaultLocation,
          last_action_date: new Date().toISOString().split('T')[0],
          expiration_date: ''
        }));
        setExtractedItems(enrichedItems);
      }
    } catch (err) {
      console.error('Error analyzing image:', err);
      setError(lang === 'zh' ? '分析图片失败。请重试或手动添加物品。' : 'Failed to analyze image. Please try again or add items manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onAddMultiple(extractedItems);
    } catch (err) {
      console.error('Error saving items:', err);
      setError(lang === 'zh' ? '保存物品失败。' : 'Failed to save items.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateExtractedItem = (index: number, field: string, value: any) => {
    const newItems = [...extractedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setExtractedItems(newItems);
  };

  const removeExtractedItem = (index: number) => {
    setExtractedItems(extractedItems.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center shrink-0">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-600" />
            {t('smartScan')}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {!image ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <Camera className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-zinc-900 font-medium mb-1">{t('takePhotoOrUpload')}</h3>
              <p className="text-zinc-500 text-sm text-center mb-6 max-w-sm">
                {t('snapPicture')}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  {t('openCamera')}
                </button>
                <button 
                  onClick={handlePaste}
                  className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg font-medium text-sm hover:bg-zinc-200 transition-colors flex items-center gap-2"
                >
                  <Clipboard className="w-4 h-4" />
                  {t('pasteImage')}
                </button>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Image Preview */}
              <div className="relative h-48 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200">
                <img src={image} alt={lang === 'zh' ? '已扫描的图片' : 'Scanned'} className="w-full h-full object-contain" />
                <button 
                  onClick={() => { setImage(null); setExtractedItems([]); setError(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 backdrop-blur-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status/Error */}
              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
                  <p className="text-sm font-medium">{t('analyzingImage')}</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Results */}
              {!isAnalyzing && extractedItems.length > 0 && (
                <div>
                  <h3 className="font-medium text-zinc-900 mb-3 flex items-center justify-between">
                    <span>{t('foundItems').replace('{count}', extractedItems.length.toString())}</span>
                    <span className="text-xs font-normal text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">{t('reviewBeforeSaving')}</span>
                  </h3>
                  <div className="space-y-3">
                    {extractedItems.map((item, idx) => (
                      <div key={idx} className="p-4 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-3 relative group">
                        <button 
                          onClick={() => removeExtractedItem(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-600 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t('name')}</label>
                            <input 
                              type="text" 
                              value={item.name} 
                              onChange={(e) => updateExtractedItem(idx, 'name', e.target.value)}
                              className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-zinc-500 mb-1">{t('category')}</label>
                              <select 
                                value={item.category_id}
                                onChange={(e) => updateExtractedItem(idx, 'category_id', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                              >
                                {categories.map(c => <option key={c.id} value={c.id}>{t(c.name as any)}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-500 mb-1">{t('quantity')}</label>
                              <input 
                                type="number" 
                                min="1"
                                value={item.quantity} 
                                onChange={(e) => updateExtractedItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t('type')}</label>
                            <select 
                              value={item.lifecycle_type}
                              onChange={(e) => updateExtractedItem(idx, 'lifecycle_type', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 capitalize"
                            >
                              <option value="perishable">{t('perishable')}</option>
                              <option value="consumable">{t('consumable')}</option>
                              <option value="maintenance">{t('maintenance')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t('alertThreshold')}</label>
                            <input 
                              type="number" 
                              min="0"
                              value={item.alert_threshold} 
                              onChange={(e) => updateExtractedItem(idx, 'alert_threshold', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t('location')}</label>
                            <select 
                              value={item.location_id}
                              onChange={(e) => updateExtractedItem(idx, 'location_id', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            >
                              {locations.map(l => <option key={l.id} value={l.id}>{t(l.name as any)}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || isAnalyzing || extractedItems.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t('saving')}</>
            ) : (
              <><Check className="w-4 h-4" /> {t('saveItems').replace('{count}', extractedItems.length.toString())}</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
