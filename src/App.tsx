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
import { storageService } from './services/storage';

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
      const data = storageService.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      storageService.markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = storageService.getSettings();
      setLang(data.language as Language);
      setCurrency(data.currency as Currency);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = storageService.getData();
      
      // Map category and location names to items for easier rendering
      const enrichedItems = data.items.map(item => ({
        ...item,
        category_name: data.categories.find(c => c.id === item.category_id)?.name || 'Unknown',
        location_name: data.locations.find(l => l.id === item.location_id)?.name || 'Unknown'
      }));

      setItems(enrichedItems);
      setCategories(data.categories);
      setLocations(data.locations);
      setPresets(data.presets);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      storageService.deleteItem(itemToDelete);
      setItems(items.filter(item => item.id !== itemToDelete));
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setItemToDelete(null);
    }
  };

  const updateQuantity = async (id: string, newQuantity: number) => {
    try {
      const item = items.find(i => i.id === id);
      if (item) {
        const updatedItem = { ...item, quantity: newQuantity };
        storageService.saveItem(updatedItem);
        // No need to enrich here as it's already enriched in state
        setItems(items.map(i => i.id === id ? updatedItem : i));
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const enrichItem = (item: Item) => ({
    ...item,
    category_name: categories.find(c => c.id === item.category_id)?.name || 'Unknown',
    location_name: locations.find(l => l.id === item.location_id)?.name || 'Unknown'
  });

  const performAction = async (id: string) => {
    try {
      const updatedItem = storageService.performAction(id);
      if (updatedItem) {
        setItems(items.map(item => item.id === id ? enrichItem(updatedItem) : item));
        setToastMessage(t('actionSuccess'));
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        fetchNotifications();
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
      const savedItems = itemsToAdd.map(item => storageService.saveItem({
        ...item,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        household_id: 'household-1'
      }));
      setItems([...items, ...savedItems.map(enrichItem)]);
      setShowScanModal(false);
      fetchNotifications();
    } catch (error) {
      console.error('Error adding multiple items:', error);
      throw error;
    }
  };

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      storageService.loadStarterTemplate();
      fetchData();
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const saveSettings = async (newLang: Language, newCurr: Currency) => {
    try {
      storageService.saveSettings({ language: newLang, currency: newCurr });
      setLang(newLang);
      setCurrency(newCurr);
      setShowSettings(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const addItem = async (newItem: any) => {
    try {
      const item = storageService.saveItem({
        ...newItem,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        household_id: 'household-1'
      });
      setItems([...items, enrichItem(item)]);
      setShowAddModal(false);
      fetchNotifications();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const updateItem = async (updatedItem: Item) => {
    try {
      storageService.saveItem(updatedItem);
      setItems(items.map(i => i.id === updatedItem.id ? enrichItem(updatedItem) : i));
      setSelectedItem(null);
      fetchNotifications();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const simulatePrices = async () => {
    setSimulatingPrices(true);
    try {
      // Client-side simulation: just wait a bit and show a message
      await new Promise(resolve => setTimeout(resolve, 1500));
      setToastMessage(t('actionSuccess'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
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
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm table-fixed">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                      <tr>
                        <th className="px-6 py-3 font-medium w-3/12 text-left">{t('name')}</th>
                        <th className="px-6 py-3 font-medium w-2/12 text-center">{t('location')}</th>
                        <th className="px-6 py-3 font-medium w-2/12 text-center">{t('status')}</th>
                        <th className="px-6 py-3 font-medium w-3/12 text-center">{t('quantityControl')}</th>
                        <th className="px-6 py-3 font-medium w-2/12 text-center">{t('action')}</th>
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
                              <div className="font-medium text-zinc-900 break-words" title={item.name}>{item.name}</div>
                              <div className="text-zinc-500 text-xs mt-0.5 capitalize">
                                {t(item.lifecycle_type as any)} • {t(item.category_name as any)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-zinc-600 align-middle text-center">
                              {t(item.location_name as any)}
                            </td>
                            <td className="px-6 py-4 align-middle text-center">
                              <div className="flex justify-center">
                                <StatusBadge statusInfo={statusInfo} item={item} lang={lang} onAction={requestAction} />
                              </div>
                            </td>
                            <td className="px-6 py-4 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center">
                                {(item.lifecycle_type === 'perishable' || item.lifecycle_type === 'consumable') ? (
                                  <SmartNumberInputWithSpinners
                                    value={item.quantity}
                                    onChange={(val) => updateQuantity(item.id, val)}
                                    className="font-mono w-20 font-medium bg-zinc-50 border border-zinc-200 rounded py-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center"
                                  />
                                ) : (
                                  <span className="text-zinc-400 text-xs">-</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
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

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredItems.map(item => {
                  const statusInfo = getItemStatus(item);
                  return (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden"
                      onClick={() => setSelectedItem(item)}
                    >
                      {/* Card Header */}
                      <div className="p-4 border-b border-zinc-100">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h3 className="font-semibold text-zinc-900 text-base break-words">{item.name}</h3>
                            <p className="text-zinc-500 text-xs mt-1">
                              {t(item.category_name as any)} • {t(item.location_name as any)}
                            </p>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setItemToDelete(item.id); }}
                            className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 flex items-center justify-between bg-zinc-50/30">
                        <StatusBadge statusInfo={statusInfo} item={item} lang={lang} onAction={requestAction} />
                        
                        <div onClick={(e) => e.stopPropagation()}>
                          {(item.lifecycle_type === 'perishable' || item.lifecycle_type === 'consumable') ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{t('quantity')}</span>
                              <SmartNumberInputWithSpinners
                                value={item.quantity}
                                onChange={(val) => updateQuantity(item.id, val)}
                                className="font-mono w-20 font-medium bg-white border border-zinc-200 rounded py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center"
                              />
                            </div>
                          ) : (
                            <span className="text-zinc-400 text-xs italic">{t(item.lifecycle_type as any)}</span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer / Actions */}
                      {item.lifecycle_type !== 'perishable' && (
                        <div className="p-3 border-t border-zinc-100 bg-white" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => requestAction(item)}
                            className="w-full py-2.5 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-200 transition-all active:scale-[0.98]"
                          >
                            {item.lifecycle_type === 'maintenance' ? t('markDone') : t('replaced')}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </>
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
          onAdd={addItem}
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
                onUpdate={updateItem}
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
          onSave={saveSettings}
          onDataImported={() => {
            setShowSettings(false);
            fetchData();
            fetchSettings();
            fetchNotifications();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
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
        <form onSubmit={handleSubmit} className="p-6 sm:px-8 space-y-4 max-h-[80vh] overflow-y-auto">
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

          {/* Top Row: Date (60%) + Alert Days (40%) */}
          <div className="flex gap-3 items-start">
            {/* 左侧：日期框占 60% */}
            <div className="w-[60%] shrink-0">
              <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">
                {formData.lifecycle_type === 'perishable' ? t('expDate') : 
                formData.lifecycle_type === 'consumable' ? t('firstUsed') : t('lastMaintained')}
              </label>
              <input 
                type="date" 
                required={formData.lifecycle_type !== 'perishable'}
                value={formData.lifecycle_type === 'perishable' ? formData.expiration_date : formData.last_action_date}
                onChange={e => {
                  if (formData.lifecycle_type === 'perishable') {
                    setFormData({...formData, expiration_date: e.target.value});
                  } else {
                    setFormData({...formData, last_action_date: e.target.value});
                  }
                }}
                // 这里的 h-[42px] 强制高度与右侧 SmartNumberInput 保持物理一致
                className="w-full h-[42px] px-2 py-2 text-[13px] sm:text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:p-0"
              />
            </div>

            {/* 右侧：预警天数占 40% */}
            <div className="w-[40%] shrink-0">
              <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">
                {formData.lifecycle_type === 'perishable' 
                  ? t('alertWhenDaysLess') 
                  : formData.lifecycle_type === 'maintenance' 
                    ? t('alertBeforeMaintenance') 
                    : t('alertWhenBelow')}
              </label>
              <div className="flex items-center gap-1.5 h-[42px]">
                <div className="flex-1 min-w-0">
                  <SmartNumberInputWithSpinners
                    value={formData.alert_threshold}
                    onChange={val => setFormData({...formData, alert_threshold: val})}
                    // 确保内部输入框高度充满 42px
                    className="w-full h-full"
                  />
                </div>
                {/* 单位文字：确保不折行，位置微调 */}
                <span className="text-xs text-zinc-500 shrink-0 whitespace-nowrap">
                  {formData.lifecycle_type === 'consumable' ? t('thresholdItems') : t('thresholdDays')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {formData.lifecycle_type === 'perishable' ? (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{t('quantity')}</label>
                <SmartNumberInputWithSpinners
                  value={formData.quantity}
                  onChange={val => setFormData({...formData, quantity: val})}
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-zinc-700">{t('intervalDays')}</label>
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="checkbox"
                      id="permanentUseAdd"
                      checked={formData.is_permanent}
                      onChange={e => setFormData({...formData, is_permanent: e.target.checked})}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
                    />
                    <label htmlFor="permanentUseAdd" className="text-xs text-zinc-500 select-none">
                      {t('permanentUse')}
                    </label>
                  </div>
                </div>
                <SmartNumberInputWithSpinners
                  min={0}
                  disabled={formData.is_permanent}
                  value={formData.lifecycle_interval_days}
                  onChange={val => setFormData({...formData, lifecycle_interval_days: val})}
                  className="disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </div>
            )}
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
