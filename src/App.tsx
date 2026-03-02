import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Package, AlertTriangle, CheckCircle, Clock, 
  Plus, Search, Filter, MoreVertical, ShoppingCart,
  Camera, Trash2, Bell, RefreshCw, Download, Settings,
  ExternalLink
} from 'lucide-react';
import { Item, Category, Location, SmartPreset, LifecycleType, Notification as AppNotification, PriceHistory } from './types';
import { SmartScanModal } from './components/SmartScanModal';
import { EditItemModal } from './components/EditItemModal';
import { SettingsModal } from './components/SettingsModal';
import PriceTrendChart from './components/PriceTrendChart';
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
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
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

  const { t, i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  useEffect(() => {
    fetchData();
    fetchSettings();
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      fetchPriceHistory(selectedItem.id);
    } else {
      setPriceHistory([]);
    }
  }, [selectedItem]);

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

  const fetchPriceHistory = async (itemId: string) => {
    try {
      const res = await fetch(`/api/items/${itemId}/price-history`);
      if (res.ok) {
        setPriceHistory(await res.json());
      }
    } catch (error) {
      console.error('Error fetching price history:', error);
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
      }
    } catch (error) {
      console.error('Error performing action:', error);
    }
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
    const actionDate = item.next_action_date ? new Date(item.next_action_date) : null;
    const daysUntilAction = actionDate ? Math.ceil((actionDate.getTime() - now.getTime()) / (1000 * 3600 * 24)) : null;

    const isLowStock = item.quantity <= 1;
    const isOutOfStock = item.quantity === 0;
    const isOverdue = daysUntilAction !== null && daysUntilAction < 0;
    const isSoon = daysUntilAction !== null && daysUntilAction <= 7;

    // Priority 1: Overdue / Expired (Usage Trigger)
    if (isOverdue) {
      return {
        label: item.lifecycle_type === 'maintenance' ? t('maintenanceOverdue') : item.lifecycle_type === 'consumable' ? t('timeToReplace') : t('expired'),
        color: 'bg-red-100 text-red-700 border-red-200',
        actionType: item.lifecycle_type === 'maintenance' ? 'maintenance' : 'replace',
        isButton: false,
        statusKey: 'action-overdue'
      };
    }

    // Priority 2: Critical Restock (Price Intelligence + Low Stock)
    if (isLowStock && item.is_all_time_low) {
      return {
        label: t('restockNow'),
        color: 'bg-red-600 text-white border-red-700 animate-pulse',
        actionType: 'restock',
        isButton: true,
        statusKey: 'critical-restock'
      };
    }

    // Priority 3: Out of Stock
    if (isOutOfStock) {
      return {
        label: t('outOfStock'),
        color: 'bg-red-100 text-red-700 border-red-200',
        actionType: 'restock',
        isButton: true,
        statusKey: 'empty'
      };
    }

    // Priority 4: Usage Trigger Soon
    if (isSoon) {
      return {
        label: item.lifecycle_type === 'maintenance' ? t('maintainSoon') : item.lifecycle_type === 'consumable' ? t('replaceSoon') : t('expiringSoon'),
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        actionType: item.lifecycle_type === 'maintenance' ? 'maintenance' : 'replace',
        isButton: false,
        statusKey: 'action-soon'
      };
    }

    // Priority 5: Low Stock
    if (isLowStock) {
      return {
        label: t('restockSoon'),
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        actionType: 'restock',
        isButton: true,
        statusKey: 'low'
      };
    }

    return {
      label: t('healthy'),
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
              onClick={simulatePrices}
              disabled={simulatingPrices}
              className="p-2 text-zinc-500 hover:text-emerald-600 transition-colors rounded-full hover:bg-emerald-50 disabled:opacity-50"
              title={t('simulatePrices')}
            >
              <RefreshCw className={`w-5 h-5 ${simulatingPrices ? 'animate-spin' : ''}`} />
            </button>

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
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">{t('name')}</th>
                      <th className="px-6 py-3 font-medium">{t('location')}</th>
                      <th className="px-6 py-3 font-medium">{t('status')}</th>
                      <th className="px-6 py-3 font-medium text-right">{t('action')}</th>
                      <th className="px-6 py-3 font-medium"></th>
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
                          <td className="px-6 py-4 align-middle">
                            <div className="font-medium text-zinc-900">{item.name}</div>
                            <div className="text-zinc-500 text-xs mt-0.5 capitalize">
                              {t(item.lifecycle_type as any)} • {t(item.category_name as any)}
                              {item.current_price && ` • ${formatCurrency(item.current_price, currency)}`}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 align-middle">
                            {t(item.location_name as any)}
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <StatusBadge statusInfo={statusInfo} item={item} lang={lang} />
                          </td>
                          <td className="px-6 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-6">
                              {/* Quantity Controls */}
                              {(item.lifecycle_type === 'perishable' || item.lifecycle_type === 'consumable') && (
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors border border-zinc-200"
                                  >-</button>
                                  <span className="font-mono w-4 text-center font-medium">{item.quantity}</span>
                                  <button 
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors border border-zinc-200"
                                  >+</button>
                                </div>
                              )}

                              {/* Action Button (Mark Done / Replaced) */}
                              {item.lifecycle_type !== 'perishable' && (
                                <button 
                                  onClick={() => performAction(item.id)}
                                  className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-200 whitespace-nowrap"
                                >
                                  {item.lifecycle_type === 'maintenance' ? t('markDone') : t('replaced')}
                                </button>
                              )}

                              {/* Action Icons */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.store_link) {
                                      window.open(item.store_link, '_blank');
                                    } else {
                                      const searchUrl = lang === 'zh' 
                                        ? `https://s.taobao.com/search?q=${encodeURIComponent(item.name)}`
                                        : `https://www.amazon.com/s?k=${encodeURIComponent(item.name)}`;
                                      window.open(searchUrl, '_blank');
                                    }
                                  }}
                                  className="p-1.5 text-zinc-400 hover:text-emerald-600 transition-colors"
                                  title={item.store_link ? t('restock') : t('searchOnWeb')}
                                >
                                  {item.store_link ? <ShoppingCart className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                                </button>
                                <button 
                                  onClick={() => setItemToDelete(item.id)}
                                  className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors"
                                  title={t('delete')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4"></td>
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
            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
          >
            <div className="flex-1 overflow-y-auto p-6 border-b md:border-b-0 md:border-r border-zinc-100">
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
            <div className="w-full md:w-80 p-6 bg-zinc-50 overflow-y-auto">
              <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" />
                {t('priceIntelligence')}
              </h3>
              
              <div className="space-y-6">
                <div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{t('priceTrend')}</div>
                  <PriceTrendChart data={priceHistory} currency={currency} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                    <div className="text-[10px] text-zinc-500 uppercase mb-1">{t('allTimeLow')}</div>
                    <div className="text-sm font-semibold text-emerald-600">
                      {priceHistory.length > 0 
                        ? formatCurrency(Math.min(...priceHistory.map(h => h.price)), currency)
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                    <div className="text-[10px] text-zinc-500 uppercase mb-1">{t('avgPrice')}</div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {priceHistory.length > 0 
                        ? formatCurrency(priceHistory.reduce((acc, curr) => acc + curr.price, 0) / priceHistory.length, currency)
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                {selectedItem.store_link && (
                  <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">{t('source')}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-700">
                        {selectedItem.store_link.includes('taobao.com') ? 'Taobao' : 
                         selectedItem.store_link.includes('jd.com') ? 'JD.com' : 
                         selectedItem.store_link.includes('amazon.com') ? 'Amazon' : 'Web'}
                      </span>
                      <a 
                        href={selectedItem.store_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
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

function StatusBadge({ statusInfo, item, lang }: { statusInfo: any, item: Item, lang: Language }) {
  const { t } = useTranslation();
  
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (statusInfo.actionType === 'restock') {
      if (item.store_link) {
        window.open(item.store_link, '_blank');
      } else {
        const searchUrl = lang === 'zh' 
          ? `https://s.taobao.com/search?q=${encodeURIComponent(item.name)}`
          : `https://www.amazon.com/s?k=${encodeURIComponent(item.name)}`;
        window.open(searchUrl, '_blank');
      }
    }
  };

  const BadgeContent = (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border shadow-sm transition-all ${statusInfo.color} ${statusInfo.isButton ? 'hover:scale-105 active:scale-95' : ''}`}>
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
    lifecycle_type: 'perishable' as LifecycleType,
    lifecycle_interval_days: 0,
    last_action_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    store_link: '',
    current_price: ''
  });
  const [saving, setSaving] = useState(false);

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
                <input 
                  type="number" 
                  min="0"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{t('intervalDays')}</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={formData.lifecycle_interval_days}
                  onChange={e => setFormData({...formData, lifecycle_interval_days: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('currentPrice')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                  {currency === 'CNY' ? '¥' : '$'}
                </span>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={formData.current_price}
                  onChange={e => setFormData({...formData, current_price: e.target.value})}
                  className="w-full pl-7 pr-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('storeLink')}</label>
              <div className="flex gap-2">
                <input 
                  type="url" 
                  value={formData.store_link}
                  onChange={e => setFormData({...formData, store_link: e.target.value})}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="https://..."
                />
                {formData.store_link && (
                  <a 
                    href={formData.store_link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center px-3 bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200 transition-colors shrink-0"
                    title={t('restock')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
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
