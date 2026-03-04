import React, { useRef, useState, useEffect } from 'react';
import { Item, Batch } from '../types';
import { useTranslation } from 'react-i18next';
import { Trash2, Calendar, Edit3, Settings, RefreshCw, ShoppingCart, AlertCircle, Plus, CheckCircle, Clock } from 'lucide-react';
import { AddBatchModal } from './AddBatchModal';
import { SmartNumberInputWithSpinners } from './FormControls';
import { formatDate } from '../i18n';

interface ProductCardProps {
  item: Item;
  onUpdateBatch: (productId: string, batchId: string, updates: Partial<Batch>) => void | Promise<void>;
  onUpdateProduct: (productId: string, updates: Partial<Item>) => void | Promise<void>;
  onDeleteBatch: (productId: string, batchId: string) => void | Promise<void>;
  onAddBatch: (productId: string, batch: Partial<Batch>) => void | Promise<void>;
  onEditProduct: (item: Item) => void;
  onDeleteProduct: (item: Item) => void;
  getItemStatus: (item: Item) => any;
  onAction: (item: Item) => void;
  lang: string;
  key?: any;
}

export function ProductCard({ 
  item, 
  onUpdateBatch, 
  onUpdateProduct,
  onDeleteBatch, 
  onAddBatch,
  onEditProduct,
  onDeleteProduct,
  getItemStatus,
  onAction,
  lang 
}: ProductCardProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const statusInfo = getItemStatus(item);

  const totalPages = 1 + (item.batches?.length || 0);

  // Handle scroll to update pagination indicator
  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const width = scrollRef.current.clientWidth;
      if (width > 0) {
        const newPage = Math.round(scrollLeft / width);
        if (newPage !== currentPage) {
          setCurrentPage(newPage);
        }
      }
    }
  };

  const scrollToPage = (pageIndex: number) => {
    if (scrollRef.current) {
      const width = scrollRef.current.clientWidth;
      const targetPage = Math.max(0, Math.min(pageIndex, totalPages - 1));
      scrollRef.current.scrollTo({ left: width * targetPage, behavior: 'smooth' });
    }
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (statusInfo.actionType === 'restock') {
      if (item.notes && item.notes.startsWith('http')) {
        window.open(item.notes, '_blank');
      } else {
        const searchUrl = lang === 'zh' 
          ? `https://s.taobao.com/search?q=${encodeURIComponent(item.name)}`
          : `https://www.amazon.com/s?k=${encodeURIComponent(item.name)}`;
        window.open(searchUrl, '_blank');
      }
    } else if (statusInfo.actionType === 'maintenance' || statusInfo.actionType === 'replace') {
      onAction(item);
    }
  };

  const BadgeContent = (
    <span 
      onClick={statusInfo.isButton ? handleActionClick : undefined}
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border shadow-sm transition-all whitespace-nowrap ${statusInfo.color} ${statusInfo.isButton ? 'hover:scale-105 active:scale-95 cursor-pointer' : ''}`}
    >
      {statusInfo.actionType === 'restock' && <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />}
      {statusInfo.actionType === 'replace' && <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
      {statusInfo.actionType === 'maintenance' && <Settings className="w-3.5 h-3.5 mr-1.5" />}
      {statusInfo.actionType === 'fresh' && <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
      {statusInfo.actionType === 'expiring' && <Clock className="w-3.5 h-3.5 mr-1.5" />}
      {statusInfo.label}
    </span>
  );

  // Dynamic Date Calculation
  let nextActionDateStr = '';
  let nextActionLabel = '';
  let daysUntil = null;
  const now = new Date();
  now.setHours(0,0,0,0);

  if (item.lifecycle_type === 'consumable' || item.lifecycle_type === 'maintenance') {
    nextActionDateStr = item.next_action_date || '';
    nextActionLabel = item.lifecycle_type === 'consumable' ? t('nextReplacement') : t('nextMaintenance');
  } else {
    nextActionDateStr = item.soonest_expiration_date || '';
    nextActionLabel = t('nextExpiry');
  }

  if (nextActionDateStr) {
    const d = new Date(nextActionDateStr);
    d.setHours(0,0,0,0);
    daysUntil = Math.ceil((d.getTime() - now.getTime()) / (1000 * 3600 * 24));
  }
  
  const isUrgent = daysUntil !== null && daysUntil <= 3;

  // Additional Expiry Date for Consumables
  const consumableExpiryDateStr = item.lifecycle_type === 'consumable' ? item.soonest_expiration_date : null;
  let consumableExpiryDaysUntil = null;
  if (consumableExpiryDateStr) {
    const d = new Date(consumableExpiryDateStr);
    d.setHours(0,0,0,0);
    consumableExpiryDaysUntil = Math.ceil((d.getTime() - now.getTime()) / (1000 * 3600 * 24));
  }
  const isConsumableExpiryUrgent = consumableExpiryDaysUntil !== null && consumableExpiryDaysUntil <= 3;

  const renderDots = () => {
    if (totalPages <= 1) return null;
    
    const isFirst = currentPage === 0;
    const isLast = currentPage === totalPages - 1;
    const isMiddle = !isFirst && !isLast;

    if (isFirst) {
      return (
        <>
          <div className="h-1.5 w-4 bg-zinc-800 rounded-full transition-all duration-300" />
          <div className="h-1.5 w-1.5 bg-zinc-300 rounded-full transition-all duration-300" />
        </>
      );
    }
    
    if (isLast) {
      return (
        <>
          <div className="h-1.5 w-1.5 bg-zinc-300 rounded-full transition-all duration-300" />
          <div className="h-1.5 w-4 bg-zinc-800 rounded-full transition-all duration-300" />
        </>
      );
    }

    // Middle
    return (
      <>
        <div className="h-1.5 w-1.5 bg-zinc-300 rounded-full transition-all duration-300" />
        <div className="h-1.5 w-4 bg-zinc-800 rounded-full transition-all duration-300" />
        <div className="h-1.5 w-1.5 bg-zinc-300 rounded-full transition-all duration-300" />
      </>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-zinc-100 overflow-hidden relative flex flex-col transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
      {/* Add Batch Modal */}
      {showAddBatchModal && (
        <AddBatchModal 
          item={item} 
          onClose={() => setShowAddBatchModal(false)}
          onAdd={onAddBatch}
        />
      )}

      {/* Carousel Container */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* PAGE 1: Summary Dashboard */}
        <div className="w-full shrink-0 snap-center p-6 pb-8 flex flex-col min-h-[200px]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold text-zinc-900 tracking-tight">{item.name}</h3>
                {(item.total_quantity ?? item.quantity) === 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-md">
                    {t('outOfStock')}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-500 mt-0.5">
                {t(item.category_name as any)} • {t(item.location_name as any)}
              </p>
            </div>
            {BadgeContent}
          </div>

          {/* Centered Next Action Row */}
          {nextActionDateStr && (
            <div className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl mb-2 transition-colors ${
              isUrgent 
                ? 'bg-red-50 text-red-700 border border-red-100' 
                : 'bg-zinc-50 text-zinc-700 border border-zinc-100'
            }`}>
              {isUrgent ? <AlertCircle className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {nextActionLabel}: {formatDate(nextActionDateStr, lang as any)}
              </span>
              {isUrgent && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-md ml-1 shadow-sm">
                  {t('timeToChange')}
                </span>
              )}
            </div>
          )}

          {/* Nearest Expiry for Consumables */}
          {consumableExpiryDateStr && (
            <div className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl mb-2 transition-colors ${
              isConsumableExpiryUrgent 
                ? 'bg-red-50 text-red-700 border border-red-100' 
                : 'bg-zinc-50 text-zinc-700 border border-zinc-100'
            }`}>
              {isConsumableExpiryUrgent ? <AlertCircle className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {t('nextExpiry')}: {formatDate(consumableExpiryDateStr, lang as any)}
              </span>
              {isConsumableExpiryUrgent && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-md ml-1 shadow-sm">
                  {t('expiringSoon')}
                </span>
              )}
            </div>
          )}

          <div className="flex-1 flex items-end justify-between mt-2">
            <div className="space-y-1">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{t('totalQuantity')}</p>
              <div className="text-2xl font-medium text-zinc-900">
                {item.total_quantity ?? item.quantity}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setShowAddBatchModal(true)} 
                className="w-[42px] h-[42px] flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" 
                title={t('addBatchTitle')}
              >
                <Plus className="w-5 h-5" />
              </button>
              <button 
                onClick={() => onEditProduct(item)} 
                className="w-[42px] h-[42px] flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors" 
                title={t('editItem')}
              >
                <Edit3 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => onDeleteProduct(item)} 
                className="w-[42px] h-[42px] flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" 
                title={t('deleteItem')}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* PAGES 2 to n+1: Batch Details */}
        {item.batches?.map((batch, index) => (
          <div key={batch.id} className="w-full shrink-0 snap-center bg-white p-6 pb-8 flex flex-col min-h-[200px] border-l border-zinc-100">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl h-[42px] px-2 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-2">{t('batch')}</span>
                <input 
                  type="text"
                  inputMode="numeric"
                  defaultValue={index + 1}
                  key={`input-${currentPage}-${index}`} // Force re-render on page change to reset value if edited but not submitted
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt(e.currentTarget.value);
                      if (!isNaN(val) && val >= 1 && val <= (item.batches?.length || 0)) {
                        scrollToPage(val);
                      } else {
                        e.currentTarget.value = String(index + 1);
                      }
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.currentTarget.value);
                    if (!isNaN(val) && val >= 1 && val <= (item.batches?.length || 0)) {
                      scrollToPage(val);
                    } else {
                      e.currentTarget.value = String(index + 1);
                    }
                  }}
                  className="w-10 h-8 text-center text-sm font-bold text-zinc-900 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <span className="text-xs font-semibold text-zinc-400 ml-2">/ {item.batches?.length}</span>
              </div>
              <button 
                onClick={() => setBatchToDelete(batch.id)}
                className="w-[42px] h-[42px] flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors -mr-2"
                title={t('delete')}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4">
              {/* Left Column: Dates */}
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">{t('expirationDate')}</p>
                  <div className="relative w-full h-[42px]">
                    {!batch.expiration_date && (
                      <div className="absolute inset-0 flex items-center px-3 text-sm text-zinc-400 bg-zinc-50/50 rounded-xl pointer-events-none">
                        -
                      </div>
                    )}
                    <input 
                      type="date"
                      defaultValue={batch.expiration_date ? new Date(batch.expiration_date).toISOString().split('T')[0] : ''}
                      onChange={(e) => onUpdateBatch(item.id, batch.id, { expiration_date: e.target.value })}
                      className={`w-full h-full px-3 text-sm rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${batch.expiration_date ? 'text-zinc-900 bg-zinc-50 border border-zinc-200' : 'text-transparent bg-transparent border-transparent focus:text-zinc-900 focus:bg-zinc-50 focus:border-zinc-200 relative z-10'}`}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
                    {t('addedDate')}
                  </p>
                  <div className="w-full h-[42px] px-3 text-sm text-zinc-900 bg-zinc-50/50 border border-transparent rounded-xl flex items-center">
                    {formatDate(batch.added_date, lang as any)}
                  </div>
                </div>
              </div>

              {/* Right Column: Quantity & Notes */}
              <div className="flex flex-col items-end justify-between">
                <div className="w-full max-w-[110px]">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 text-right font-semibold">{t('quantity')}</p>
                  <SmartNumberInputWithSpinners
                    value={batch.quantity}
                    onChange={(val) => {
                      onUpdateBatch(item.id, batch.id, { quantity: val });
                      if (val === 0 && index < (item.batches?.length || 0) - 1) {
                        setTimeout(() => scrollToPage(index + 2), 300);
                      }
                    }}
                    className="w-full h-[42px] text-lg font-semibold text-center bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                {batch.notes && (
                  <p className="text-xs text-zinc-400 italic truncate max-w-full mt-3" title={batch.notes}>
                    {batch.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Smart 3-Dot Indicator */}
      {totalPages > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center gap-1.5 pointer-events-none">
          {renderDots()}
        </div>
      )}
      {/* Batch Deletion Confirmation Modal */}
      {batchToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">
              {lang === 'zh' ? '删除批次' : 'Delete Batch'}
            </h3>
            <p className="text-sm text-zinc-600 mb-6">
              {lang === 'zh' 
                ? `确定要删除 ${item.name} 的这个批次吗？此操作无法撤销。` 
                : `Are you sure you want to remove this batch of ${item.name}? This action cannot be undone.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setBatchToDelete(null)}
                className="flex-1 h-[42px] bg-zinc-100 text-zinc-700 font-medium rounded-xl hover:bg-zinc-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  if (batchToDelete) {
                    onDeleteBatch(item.id, batchToDelete);
                    setBatchToDelete(null);
                    // If deleting the last page, move back one page
                    if (currentPage >= (item.batches?.length || 0) - 1 && currentPage > 0) {
                      scrollToPage(currentPage - 1);
                    }
                  }
                }}
                className="flex-1 h-[42px] bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
