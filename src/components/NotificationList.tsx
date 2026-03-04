import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Check, EyeOff } from 'lucide-react';
import { Item } from '../types';
import { useTranslation } from 'react-i18next';

export interface Alert {
  id: string;
  item_id: string;
  type: 'expiry' | 'stock' | 'maintenance';
  statusKey: 'empty' | 'low' | 'action-overdue' | 'action-soon' | 'critical-restock';
  itemName: string;
  dateStr?: string;
  diffDays?: number;
  quantity?: number;
  threshold?: number;
  statusLabel?: string;
}

interface NotificationListProps {
  alerts: Alert[];
  onItemClick: (itemId: string) => void;
  onAction: (alert: Alert) => void;
  onDismiss: (alertId: string) => void;
  onClose: () => void;
}

function getRelativeTime(dateStr: string, lang: string): string {
  if (!dateStr) return '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 3600 * 24));

  const isZh = lang === 'zh';

  if (diffDays === 0) return isZh ? '今天' : 'Today';
  if (diffDays === 1) return isZh ? '明天' : 'Tomorrow';
  if (diffDays === -1) return isZh ? '昨天' : 'Yesterday';
  
  if (diffDays > 0) {
    return isZh ? `${diffDays}天后` : `In ${diffDays} days`;
  } else {
    return isZh ? `已逾期 ${Math.abs(diffDays)} 天` : `Overdue ${Math.abs(diffDays)} days`;
  }
}

const NotificationItem = ({ alert, onClick, onAction, onDismiss, lang }: { alert: Alert, onClick: () => void, onAction: (e: React.MouseEvent) => void, onDismiss: (e: React.MouseEvent) => void, lang: string, key?: string }) => {
  const isZh = lang === 'zh';
  
  let title = '';
  let subtitle = '';
  let colorClass = '';

  if (alert.type === 'stock') {
    const isOut = alert.statusKey === 'empty';
    title = `${alert.itemName} · ${isOut ? (isZh ? '已缺货' : 'Out of Stock') : (isZh ? '库存不足' : 'Low Stock')}`;
    subtitle = isZh 
      ? `当前剩余: ${alert.quantity} | 预警阈值: ${alert.threshold}`
      : `Left: ${alert.quantity} | Threshold: ${alert.threshold}`;
    colorClass = isOut ? 'text-red-600' : 'text-amber-600';
  } else {
    const isOverdue = alert.statusKey === 'action-overdue';
    const statusText = alert.type === 'maintenance' 
      ? (isOverdue ? (isZh ? '已逾期' : 'Overdue') : (isZh ? '即将到期' : 'Due Soon'))
      : (isOverdue ? (isZh ? '已过期' : 'Expired') : (isZh ? '即将过期' : 'Expiring'));
      
    title = `${alert.itemName} · ${statusText}`;
    const relTime = getRelativeTime(alert.dateStr || '', lang);
    subtitle = isZh 
      ? `日期: ${alert.dateStr} | ${relTime}`
      : `Date: ${alert.dateStr} | ${relTime}`;
    colorClass = isOverdue ? 'text-red-600' : 'text-amber-600';
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="px-4 py-3 hover:bg-zinc-50 border-b border-zinc-50 last:border-0 cursor-pointer transition-colors min-h-[60px] flex items-center justify-between group"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0 pr-2">
        <div className={`font-medium text-sm mb-1 truncate ${colorClass}`}>
          {title}
        </div>
        <div className="text-xs text-zinc-500 truncate">
          {subtitle}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDismiss}
          className="w-[42px] h-[42px] flex items-center justify-center rounded-full bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 transition-colors"
          title={isZh ? '已阅' : 'Dismiss'}
        >
          <EyeOff className="w-5 h-5" />
        </button>
        <button
          onClick={onAction}
          className="w-[42px] h-[42px] flex items-center justify-center rounded-full bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
          title={isZh ? '处理' : 'Resolve'}
        >
          <Check className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};

export const NotificationList = ({ alerts, onItemClick, onAction, onDismiss, onClose }: NotificationListProps) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 z-20 md:hidden" 
        onClick={onClose}
      />
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] md:absolute md:top-auto md:left-auto md:right-0 md:translate-x-0 md:mt-2 md:w-80 bg-white rounded-xl shadow-xl border border-zinc-100 py-2 z-30">
        <div className="px-4 py-3 border-b border-zinc-100 flex justify-between items-center">
          <h3 className="font-semibold text-sm text-zinc-900">{t('smartReminders')}</h3>
          <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">{alerts.length}</span>
        </div>
        <div className="max-h-[60vh] md:max-h-80 overflow-y-auto overflow-x-hidden">
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500 flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-emerald-400 mb-1" />
              {t('noReminders')}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {alerts.map(n => (
                <NotificationItem 
                  key={n.id} 
                  alert={n} 
                  lang={lang}
                  onClick={() => { 
                    onItemClick(n.item_id);
                    onClose(); 
                  }}
                  onAction={(e) => {
                    e.stopPropagation();
                    onAction(n);
                  }}
                  onDismiss={(e) => {
                    e.stopPropagation();
                    onDismiss(n.id);
                  }}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
};
