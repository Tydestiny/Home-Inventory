import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Package, AlertTriangle, CheckCircle, Clock, 
  Plus, Search, Filter, MoreVertical, ShoppingCart,
  Camera, Trash2, Bell, RefreshCw, Download, Settings,
  ExternalLink, Copy, Maximize2
} from 'lucide-react';
import { Item, Category, Location, SmartPreset, LifecycleType, Notification as AppNotification } from './types';
import { SmartScanModal } from './components/SmartScanModal';
import { EditItemModal } from './components/EditItemModal';
import { SettingsModal } from './components/SettingsModal';
import { SmartNumberInputWithSpinners, SmartNotesInput } from './components/FormControls';
import { Language, Currency, formatCurrency } from './i18n';
import { useTranslation } from 'react-i18next';

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [presets, setPresets] = useState<SmartPreset[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<LifecycleType | 'all'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [simulatingPrices, setSimulatingPrices] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [confirmActionItem, setConfirmActionItem] = useState<Item | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { t, i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  useEffect(() => {
    fetchData();
    fetchSettings();
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (res.ok) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setLang(data.language);
        setCurrency(data.currency);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, catRes, locRes, presetsRes] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/categories'),
        fetch('/api/locations'),
        fetch('/api/presets')
      ]);
      
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (locRes.ok) setLocations(await locRes.json());
      if (presetsRes.ok) setPresets(await presetsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/items/${itemToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(items.filter(item => item.id !== itemToDelete));
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setItemToDelete(null);
    }
  };

  const updateQuantity = async (id: string, newQuantity: number) => {
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity })
      });
      if (res.ok) {
        setItems(items.map(item => item.id === id ? { ...item, quantity: newQuantity } : item));
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const performAction = async (id: string) => {
    try {
      const res = await fetch(`/api/items/${id}/action`, { method: 'POST' });
      if (res.ok) {
        const updatedItem = await res.json();
        setItems(items.map(item => item.id === id ? updatedItem : item));
        setToastMessage(t('actionSuccess'));
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (error) {
      console.error('Error performing action:', error);
    } finally {
      setConfirmActionItem(null);
    }
  };

  const requestAction = (item: Item) => {
    setConfirmActionItem(item);
  };

  const addMultipleItems = async (itemsToAdd: any[]) => {
    try {
      // We can add them one by one or create a bulk endpoint. 
      // For simplicity, we'll do Promise.all with the existing POST endpoint.
      await Promise.all(itemsToAdd.map(item => 
        fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        })
      ));
      fetchData();
      setShowScanModal(false);
    } catch (error) {
      console.error('Error adding multiple items:', error);
      throw error;
    }
  };

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const res = await fetch('/api/templates/load', { method: 'POST' });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const simulatePrices = async () => {
    setSimulatingPrices(true);
    try {
      const res = await fetch('/api/simulate-prices', { method: 'POST' });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error simulating prices:', error);
    } finally {
      setSimulatingPrices(false);
    }
  };

  // Analytics logic
  const getItemStatus = (item: Item) => {
    const now = new Date();
    
    // 1. Maintenance Logic
    if (item.lifecycle_type === 'maintenance') {
      if (!item.lifecycle_interval_days || item.lifecycle_interval_days === 0) {
        return {
          label: t('permanent'),
          color: 'bg-zinc-100 text-zinc-600 border-zinc-200',
          actionType: 'none',
          isButton: false,
          statusKey: 'permanent'
        };
      }

      const lastMaintenance = item.last_action_date ? new Date(item.last_action_date) : null;
      if (!lastMaintenance) {
         return {
          label: t('overdue'),
          color: 'bg-red-100 text-red-700 border-red-200',
          actionType: 'maintenance',
          isButton: true,
          statusKey: 'action-overdue'
        };
      }

      const nextMaintenance = new Date(lastMaintenance);
      nextMaintenance.setDate(nextMaintenance.getDate() + item.lifecycle_interval_days);
      
      const daysUntilAction = Math.ceil((nextMaintenance.getTime() - now.getTime()) / (1000 * 3600 * 24));
      const warningThreshold = Math.max(7, Math.floor(item.lifecycle_interval_days * 0.1));

      if (daysUntilAction < 0) {
        return {
          label: t('overdue'),
          color: 'bg-red-100 text-red-700 border-red-200',
          actionType: 'maintenance',
          isButton: true,
          statusKey: 'action-overdue'
        };
      } else if (daysUntilAction <= warningThreshold) {
        return {
          label: t('dueSoon'),
          color: 'bg-orange-100 text-orange-700 border-orange-200',
          actionType: 'maintenance',
          isButton: true,
          statusKey: 'action-soon'
        };
      } else {
        return {
          label: t('healthy'),
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          actionType: 'none',
          isButton: false,
          statusKey: 'good'
        };
      }
    }

    // 2. Perishable Logic
    if (item.lifecycle_type === 'perishable') {
      const expirationDate = item.expiration_date ? new Date(item.expiration_date) : null;
      if (!expirationDate) {
        return {
          label: t('fresh'),
          color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          actionType: 'none',
          isButton: false,
          statusKey: 'good'
        };
      }
      const daysUntilExp = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
      const threshold = item.alert_threshold ?? 5;

      if (daysUntilExp < 0) {
        return {
          label: t('expired'),
          color: 'bg-red-100 text-red-700 border-red-200',
          actionType: 'replace',
          isButton: true,
          statusKey: 'action-overdue'
        };
      } else if (daysUntilExp <= threshold) {
        return {
          label: t('expiringSoon'),
          color: 'bg-amber-100 text-amber-700 border-amber-200',
          actionType: 'replace',
          isButton: true,
          statusKey: 'action-soon'
        };
      } else {
        return {
          label: t('fresh'),
          color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          actionType: 'none',
          isButton: false,
          statusKey: 'good'
        };
      }
    }

    // 3. Consumable Logic
    const isOutOfStock = item.quantity === 0;
    const threshold = item.alert_threshold ?? 2;
    const isLowStock = item.quantity <= threshold;

    if (isOutOfStock) {
      return {
        label: t('outOfStock'),
        color: 'bg-red-100 text-red-700 border-red-200',
        actionType: 'restock',
        isButton: true,
        statusKey: 'empty'
      };
    }
    if (isLowStock) {
      return {
        label: t('lowStock'),
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        actionType: 'restock',
        isButton: true,
        statusKey: 'low'
      };
    }
    return {
      label: t('inStock'),
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      actionType: 'none',
      isButton: false,
      statusKey: 'good'
    };
  };

  const stats = {
    total: items.length,
    critical: items.filter(i => {
      const s = getItemStatus(i);
      return ['empty', 'action-overdue', 'critical-restock'].includes(s.statusKey);
    }).length,
    warning: items.filter(i => {
      const s = getItemStatus(i);
      return ['action-soon', 'low'].includes(s.statusKey);
    }).length,
    healthy: items.filter(i => getItemStatus(i).statusKey === 'good').length,
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || item.lifecycle_type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            <h1 className="font-semibold text-lg tracking-tight">{t('appTitle')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors rounded-full hover:bg-zinc-100 relative"
                title={t('smartReminders')}
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-zinc-100 py-2 z-30">
                  <div className="px-4 py-2 border-b border-zinc-100 flex justify-between items-center">
                    <h3 className="font-semibold text-sm">{t('smartReminders')}</h3>
                    <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{unreadNotifications.length}</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-zinc-500">{t('noReminders')}</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`px-4 py-3 hover:bg-zinc-50 border-b border-zinc-50 last:border-0 cursor-pointer ${!n.is_read ? 'bg-emerald-50/30' : ''}`} 
                          onClick={() => { 
                            if (n.item_id) {
                              const item = items.find(i => i.id === n.item_id);
                              if (item) setSelectedItem(item);
                            }
                            markNotificationRead(n.id);
                            setShowNotifications(false); 
                          }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`font-medium text-sm ${!n.is_read ? 'text-emerald-900' : 'text-zinc-900'}`}>{n.title}</span>
                            {!n.is_read && <span className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5"></span>}
                          </div>
                          <div className="text-xs text-zinc-500 leading-relaxed">
                            {n.message}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-2">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setShowScanModal(true)}
              className="p-2 text-zinc-500 hover:text-emerald-600 transition-colors rounded-full hover:bg-emerald-50"
              title={t('smartScan')}
            >
              <Camera className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-zinc-500 hover:text-emerald-600 transition-colors rounded-full hover:bg-emerald-50"
              title={t('settings')}
            >
              <Settings className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('addItem')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Dashboard Stats */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">{t('inventoryHealth')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard 
              title={t('totalItems')} 
              value={stats.total} 
              icon={<Package className="w-5 h-5 text-zinc-400" />} 
              color="border-zinc-200"
            />
            <StatCard 
              title={t('critical')} 
              value={stats.critical} 
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />} 
              color="border-red-200 bg-red-50"
              textColor="text-red-700"
            />
            <StatCard 
              title={t('warning')} 
              value={stats.warning} 
              icon={<Clock className="w-5 h-5 text-amber-500" />} 
              color="border-amber-200 bg-amber-50"
              textColor="text-amber-700"
            />
            <StatCard 
              title={t('healthy')} 
              value={stats.healthy} 
              icon={<CheckCircle className="w-5 h-5 text-emerald-500" />} 
              color="border-emerald-200 bg-emerald-50"
              textColor="text-emerald-700"
            />
          </div>
        </section>

        {/* Filters & Search */}
        <section className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder={t('searchPlaceholder')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors w-full sm:w-auto justify-center"
            >
              <Filter className="w-4 h-4" />
              {filterType === 'all' ? t('allTypes') : t(filterType as any)}
            </button>
            
            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-20">
                <button 
                  onClick={() => { setFilterType('all'); setShowFilterMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm ${filterType === 'all' ? 'bg-zinc-50 font-medium text-emerald-600' : 'text-zinc-600 hover:bg-zinc-50'}`}
                >
                  {t('allTypes')}
                </button>
                <button 
                  onClick={() => { setFilterType('perishable'); setShowFilterMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm ${filterType === 'perishable' ? 'bg-zinc-50 font-medium text-emerald-600' : 'text-zinc-600 hover:bg-zinc-50'}`}
                >
                  {t('perishable')}
                </button>
                <button 
                  onClick={() => { setFilterType('consumable'); setShowFilterMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm ${filterType === 'consumable' ? 'bg-zinc-50 font-medium text-emerald-600' : 'text-zinc-600 hover:bg-zinc-50'}`}
                >
                  {t('consumable')}
                </button>
                <button 
                  onClick={() => { setFilterType('maintenance'); setShowFilterMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm ${filterType === 'maintenance' ? 'bg-zinc-50 font-medium text-emerald-600' : 'text-zinc-600 hover:bg-zinc-50'}`}
                >
                  {t('maintenance')}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Item List */}
        <section>
          {loading ? (
            <div className="text-center py-12 text-zinc-500">{t('loading')}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-zinc-200 border-dashed">
              <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <h3 className="text-zinc-900 font-medium">{t('noItemsFound')}</h3>
              <p className="text-zinc-500 text-sm mt-1 mb-6">{t('tryAdjusting')}</p>
              <button 
                onClick={loadTemplate}
                disabled={loadingTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {loadingTemplate ? t('loading') : t('loadTemplate')}
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-zinc-200 border-dashed">
              <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <h3 className="text-zinc-900 font-medium">{t('noItemsFound')}</h3>
              <p className="text-zinc-500 text-sm mt-1">{t('tryAdjusting')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm table-fixed">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="px-6 py-3 font-medium w-3/12">{t('name')}</th>
                      <th className="px-6 py-3 font-medium w-2/12">{t('location')}</th>
                      <th className="px-6 py-3 font-medium w-2/12">{t('status')}</th>
                      <th className="px-6 py-3 font-medium w-3/12 text-center">{t('quantityControl')}</th>
                      <th className="px-6 py-3 font-medium w-2/12 text-right">{t('action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredItems.map(item => {
                      const statusInfo = getItemStatus(item);
                      return (
                        <motion.tr 
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                          onClick={() => setSelectedItem(item)}
                        >
                          <td className="px-6 py-4 align-middle truncate">
                            <div className="font-medium text-zinc-900 truncate" title={item.name}>{item.name}</div>
                            <div className="text-zinc-500 text-xs mt-0.5 capitalize truncate">
                              {t(item.lifecycle_type as any)} • {t(item.category_name as any)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 align-middle truncate">
                            {t(item.location_name as any)}
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <StatusBadge statusInfo={statusInfo} item={item} lang={lang} onAction={requestAction} />
                          </td>
                          <td className="px-6 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-3">
                              {/* Quantity Controls */}
                              {(item.lifecycle_type === 'perishable' || item.lifecycle_type === 'consumable') ? (
                                <SmartNumberInputWithSpinners
                                  value={item.quantity}
                                  onChange={(val) => updateQuantity(item.id, val)}
                                  className="font-mono w-16 font-medium bg-zinc-50 border border-zinc-200 rounded py-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                              ) : (
                                <span className="text-zinc-400 text-xs">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {/* Action Button (Mark Done / Replaced) */}
                              {item.lifecycle_type !== 'perishable' && (
                                <button 
                                  onClick={() => requestAction(item)}
                                  className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-200 whitespace-nowrap"
                                >
                                  {item.lifecycle_type === 'maintenance' ? t('markDone') : t('replaced')}
                                </button>
                              )}
                              <button 
                                onClick={() => setItemToDelete(item.id)}
                                className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors"
                                title={t('delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Add Item Modal */}
      {showAddModal && (
        <AddItemModal 
          categories={categories}
          locations={locations}
          presets={presets}
          lang={lang}
          currency={currency}
          onClose={() => setShowAddModal(false)}
          onAdd={() => {
            setShowAddModal(false);
            fetchData();
          }}
        />
      )}

      {/* Smart Scan Modal */}
      {showScanModal && (
        <SmartScanModal 
          categories={categories}
          locations={locations}
          presets={presets}
          lang={lang}
          onClose={() => setShowScanModal(false)}
          onAddMultiple={addMultipleItems}
        />
      )}

      {/* Edit Item Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex-1 overflow-y-auto p-6">
              <EditItemModal 
                item={selectedItem}
                categories={categories}
                locations={locations}
                lang={lang}
                currency={currency}
                onClose={() => setSelectedItem(null)}
                onUpdate={(updatedItem) => {
                  setItems(items.map(i => i.id === updatedItem.id ? updatedItem : i));
                  setSelectedItem(null);
                }}
                isEmbedded={true}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          currentLanguage={lang}
          currentCurrency={currency}
          onClose={() => setShowSettings(false)}
          onSave={(l, c) => {
            setLang(l);
            setCurrency(c);
            setShowSettings(false);
          }}
        />
      )}

      {/* Action Confirmation Modal */}
      {confirmActionItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6"
          >
            <div className="flex items-center gap-3 text-emerald-600 mb-4">
              <RefreshCw className="w-6 h-6" />
              <h2 className="font-semibold text-lg text-zinc-900">
                {confirmActionItem.lifecycle_type === 'maintenance' ? t('confirmMaintenance') : t('confirmReplace')}
              </h2>
            </div>
            <p className="text-zinc-600 text-sm mb-6">
              {confirmActionItem.lifecycle_type === 'maintenance' 
                ? t('confirmMaintenanceMsg') 
                : t('confirmReplaceMsg')}
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmActionItem(null)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => performAction(confirmActionItem.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                {t('confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50"
        >
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6"
          >
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="font-semibold text-lg text-zinc-900">{t('deleteItem')}</h2>
            </div>
            <p className="text-zinc-600 text-sm mb-6">
              {t('deleteConfirm')}
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                {t('delete')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color, textColor = "text-zinc-900" }: any) {
  return (
    <div className={`bg-white p-4 rounded-xl border ${color} shadow-sm`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-zinc-500 text-sm font-medium">{title}</h3>
        {icon}
      </div>
      <div className={`text-2xl font-semibold ${textColor}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ statusInfo, item, lang, onAction }: { statusInfo: any, item: Item, lang: Language, onAction: (item: Item) => void }) {
  const { t } = useTranslation();
  
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (statusInfo.actionType === 'restock') {
      if (item.notes) {
        // If it's a URL, open it, otherwise search
        if (item.notes.startsWith('http')) {
          window.open(item.notes, '_blank');
        } else {
          const searchUrl = lang === 'zh' 
            ? `https://s.taobao.com/search?q=${encodeURIComponent(item.name)}`
            : `https://www.amazon.com/s?k=${encodeURIComponent(item.name)}`;
          window.open(searchUrl, '_blank');
        }
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border shadow-sm transition-all whitespace-nowrap ${statusInfo.color} ${statusInfo.isButton ? 'hover:scale-105 active:scale-95' : ''}`}>
      {statusInfo.actionType === 'restock' && <ShoppingCart className="w-3 h-3 mr-1.5" />}
      {statusInfo.actionType === 'replace' && <RefreshCw className="w-3 h-3 mr-1.5" />}
      {statusInfo.actionType === 'maintenance' && <Settings className="w-3 h-3 mr-1.5" />}
      {statusInfo.label}
    </span>
  );

  if (statusInfo.isButton) {
    return (
      <button 
        onClick={handleActionClick}
        className="focus:outline-none"
      >
        {BadgeContent}
      </button>
    );
  }

  return BadgeContent;
}

function AddItemModal({ categories, locations, presets, lang, currency, onClose, onAdd }: any) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    category_id: categories[0]?.id || '',
    location_id: locations[0]?.id || '',
    quantity: 1,
    alert_threshold: 2,
    lifecycle_type: 'perishable' as LifecycleType,
    lifecycle_interval_days: 0,
    last_action_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    notes: '',
    is_permanent: false
  });
  const [saving, setSaving] = useState(false);
  const [cachedInterval, setCachedInterval] = useState(0);

  // Update formData when permanent toggle changes
  useEffect(() => {
    if (formData.is_permanent) {
      setCachedInterval(formData.lifecycle_interval_days);
      setFormData(prev => ({ ...prev, lifecycle_interval_days: 0 }));
    } else {
      if (formData.lifecycle_interval_days === 0 && cachedInterval > 0) {
        setFormData(prev => ({ ...prev, lifecycle_interval_days: cachedInterval }));
      }
    }
  }, [formData.is_permanent]);

  const handleSmartSearch = () => {
    if (!formData.name) return;
    const searchUrl = lang === 'zh' 
      ? `https://s.taobao.com/search?q=${encodeURIComponent(formData.name)}`
      : `https://www.amazon.com/s?k=${encodeURIComponent(formData.name)}`;
    window.open(searchUrl, '_blank');
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    if (!presetId) return;
    const preset = presets.find((p: SmartPreset) => p.id === presetId);
    if (preset) {
      setFormData(prev => ({
        ...prev,
        name: t(preset.name),
        category_id: preset.category_id,
        lifecycle_type: preset.lifecycle_type,
        lifecycle_interval_days: preset.lifecycle_interval_days,
        quantity: preset.lifecycle_type === 'maintenance' ? 1 : prev.quantity
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onAdd();
      }
    } catch (error) {
      console.error('Error adding item:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="font-semibold text-lg">{t('addItem')}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {presets && presets.length > 0 && (
            <div className="mb-4 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('usePreset')}</label>
              <select 
                onChange={handlePresetChange}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white text-sm"
              >
                <option value="">-- {t('selectPreset')} --</option>
                {presets.map((p: SmartPreset) => (
                  <option key={p.id} value={p.id}>{t(p.name)} ({p.lifecycle_interval_days} {t('days')})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">{t('name')} *</label>
            <div className="flex gap-2">
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder={lang === 'zh' ? '例如：牛奶' : 'e.g., Almond Milk'}
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
                {categories.map((c: any) => <option key={c.id} value={c.id}>{t(c.name as any)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('location')}</label>
              <select 
                value={formData.location_id}
                onChange={e => setFormData({...formData, location_id: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              >
                {locations.map((l: any) => <option key={l.id} value={l.id}>{t(l.name as any)}</option>)}
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
                  id="permanentUse"
                  checked={formData.is_permanent}
                  onChange={e => setFormData({...formData, is_permanent: e.target.checked})}
                  className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
                />
                <label htmlFor="permanentUse" className="text-sm font-medium text-zinc-700 select-none">
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

          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? t('loading') : t('addItem')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default App;
