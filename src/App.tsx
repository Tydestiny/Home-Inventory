import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Package, AlertTriangle, CheckCircle, Clock, 
  Plus, Search, Filter, MoreVertical, ShoppingCart,
  Camera, Trash2, Bell, RefreshCw, Download, Settings,
  ExternalLink, Copy, Maximize2, X
} from 'lucide-react';
import { Item, Batch, Category, Location, SmartPreset, LifecycleType, Notification as AppNotification } from './types';
import { SmartScanModal } from './components/SmartScanModal';
import { EditItemModal } from './components/EditItemModal';
import { SettingsModal } from './components/SettingsModal';
import { ProductCard } from './components/ProductCard';
import { NotificationList, Alert } from './components/NotificationList';
import { SmartNumberInputWithSpinners, SmartNotesInput } from './components/FormControls';
import { Language, Currency, formatCurrency } from './i18n';
import { useTranslation } from 'react-i18next';
import { storageService, calculateSmartThreshold } from './services/storage';

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [presets, setPresets] = useState<SmartPreset[]>([]);
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
  const [batchToDeleteConfirm, setBatchToDeleteConfirm] = useState<{ productId: string; batchId: string; batchIndex: number; itemName: string } | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, { timestamp: number, statusKey: string }>>({});
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { t, i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

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
      const items = storageService.getItems();
      const data = storageService.getData();
      
      // Map category and location names to items for easier rendering
      const enrichedItems = items.map(item => ({
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
      fetchData();
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
        // If it's a grouped product, update the first batch as a fallback
        if (item.batches && item.batches.length > 0) {
          storageService.updateBatch(id, item.batches[0].id, { quantity: newQuantity });
        } else {
          storageService.saveItem({ ...item, quantity: newQuantity });
        }
        fetchData();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const updateProduct = async (productId: string, updates: Partial<Item>) => {
    try {
      const updatedProduct = storageService.updateProduct(productId, updates);
      if (updatedProduct) {
        fetchData();
      }
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  const updateBatch = async (productId: string, batchId: string, updates: Partial<Batch>) => {
    try {
      if (updates.quantity === 0) {
        const product = items.find(i => i.id === productId);
        if (product && product.batches) {
          const batchIndex = product.batches.findIndex(b => b.id === batchId);
          if (batchIndex > -1) {
            setBatchToDeleteConfirm({
              productId,
              batchId,
              batchIndex: batchIndex + 1,
              itemName: product.name
            });
            return;
          }
        }
      }

      const updatedProduct = storageService.updateBatch(productId, batchId, updates);
      if (updatedProduct) {
        // Re-fetch or locally update to ensure computed fields are fresh
        fetchData();
      }
    } catch (error) {
      console.error('Error updating batch:', error);
    }
  };

  const deleteBatch = async (productId: string, batchId: string) => {
    try {
      const updatedProduct = storageService.deleteBatch(productId, batchId);
      if (updatedProduct) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting batch:', error);
    }
  };

  const enrichItem = (item: Item) => ({
    ...item,
    category_name: categories.find(c => c.id === item.category_id)?.name || 'Unknown',
    location_name: locations.find(l => l.id === item.location_id)?.name || 'Unknown'
  });

  const handleConfirmReplacement = async (id: string) => {
    try {
      const updatedItem = storageService.performAction(id);
      if (updatedItem) {
        fetchData();
        
        // Clear any alerts for this item since we just took action
        const alertsToDismiss = computedAlerts.filter(a => a.item_id === id);
        const updates: Record<string, { timestamp: number, statusKey: string }> = {};
        alertsToDismiss.forEach(a => {
          updates[a.id] = { timestamp: Date.now(), statusKey: a.statusKey };
        });
        setDismissedAlerts(prev => ({ ...prev, ...updates }));

        if (updatedItem.lifecycle_type === 'perishable' && (updatedItem.total_quantity || 0) > 0) {
          setSelectedItem(updatedItem);
          setToastMessage(t('updateNextUnitPrompt'));
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
        } else {
          setToastMessage(t('actionSuccess'));
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      } else {
        // If updatedItem is null, it means the item was deleted (FIFO quantity reached 0)
        fetchData();
      }
    } catch (error) {
      console.error('Error performing action:', error);
    } finally {
      setConfirmActionItem(null);
    }
  };

  const handleDismissAlert = (alertId: string) => {
    const alert = computedAlerts.find(a => a.id === alertId);
    if (alert) {
      setDismissedAlerts(prev => ({
        ...prev,
        [alertId]: { timestamp: Date.now(), statusKey: alert.statusKey }
      }));
    }
  };

  const handleAddBatch = async (productId: string, batch: Partial<Batch>) => {
    try {
      const product = items.find(i => i.id === productId);
      if (product) {
        const newBatch: Batch = {
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          quantity: batch.quantity || 1,
          added_date: batch.added_date || new Date().toISOString(),
          expiration_date: batch.expiration_date,
          notes: batch.notes
        };
        
        const updatedProduct = {
          ...product,
          batches: [...(product.batches || []), newBatch]
        };
        
        storageService.saveItem(updatedProduct);
        fetchData();
        setToastMessage(t('batchAdded'));
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (error) {
      console.error('Error adding batch:', error);
    }
  };

  const requestAction = (item: Item) => {
    setConfirmActionItem(item);
  };

  const addMultipleItems = async (itemsToAdd: any[]) => {
    try {
      itemsToAdd.forEach(item => storageService.saveItem({
        ...item,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        household_id: 'household-1'
      }));
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
      storageService.saveItem({
        ...newItem,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        household_id: 'household-1'
      });
      fetchData();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const updateItem = async (updatedItem: Item) => {
    try {
      storageService.saveItem(updatedItem);
      fetchData();
      setSelectedItem(null);
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
    
    // Priority 1: Out of Stock (for all types, if quantity is 0)
    if (item.quantity === 0) {
      return {
        label: t('outOfStock'),
        color: 'bg-red-100 text-red-700 border-red-200',
        actionType: 'restock',
        isButton: true,
        statusKey: 'empty'
      };
    }

    // Priority 2: Maintenance/Replacement Due (Cycle overdue)
    if (item.lifecycle_type === 'maintenance' || item.lifecycle_type === 'consumable') {
      if (item.lifecycle_interval_days && item.lifecycle_interval_days > 0) {
        const lastAction = item.last_action_date ? new Date(item.last_action_date) : null;
        if (!lastAction) {
          return {
            label: item.lifecycle_type === 'maintenance' ? t('overdue') : t('replaceNow'),
            color: 'bg-red-100 text-red-700 border-red-200',
            actionType: item.lifecycle_type === 'maintenance' ? 'maintenance' : 'replace',
            isButton: true,
            statusKey: 'action-overdue'
          };
        }

        const nextAction = new Date(lastAction);
        nextAction.setDate(nextAction.getDate() + item.lifecycle_interval_days);
        
        const daysUntilAction = Math.ceil((nextAction.getTime() - now.getTime()) / (1000 * 3600 * 24));
        const warningThreshold = Math.max(7, Math.floor(item.lifecycle_interval_days * 0.1));

        if (daysUntilAction < 0) {
          return {
            label: item.lifecycle_type === 'maintenance' ? t('overdue') : t('replaceNow'),
            color: 'bg-red-100 text-red-700 border-red-200',
            actionType: item.lifecycle_type === 'maintenance' ? 'maintenance' : 'replace',
            isButton: true,
            statusKey: 'action-overdue'
          };
        } else if (daysUntilAction <= warningThreshold) {
          return {
            label: item.lifecycle_type === 'maintenance' ? t('dueSoon') : t('replaceSoon'),
            color: 'bg-orange-100 text-orange-700 border-orange-200',
            actionType: item.lifecycle_type === 'maintenance' ? 'maintenance' : 'replace',
            isButton: true,
            statusKey: 'action-soon'
          };
        }
      }
    }

    // Priority 3: Expiring Soon/Expired (Perishables)
    if (item.lifecycle_type === 'perishable') {
      const expirationDate = item.expiration_date ? new Date(item.expiration_date) : null;
      if (expirationDate) {
        const daysUntilExp = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        const threshold = item.alert_threshold ?? 5;

        if (daysUntilExp < 0) {
          return {
            label: t('expired'),
            color: 'bg-red-100 text-red-700 border-red-200',
            actionType: 'expiring',
            isButton: true,
            statusKey: 'action-overdue'
          };
        } else if (daysUntilExp <= threshold) {
          return {
            label: t('expiringSoon'),
            color: 'bg-amber-100 text-amber-700 border-amber-200',
            actionType: 'expiring',
            isButton: true,
            statusKey: 'action-soon'
          };
        }
      }
    }

    // Priority 4: Low Stock
    if (item.lifecycle_type === 'consumable') {
      const threshold = item.alert_threshold ?? 2;
      if (item.quantity <= threshold) {
        return {
          label: t('lowStock'),
          color: 'bg-amber-100 text-amber-700 border-amber-200',
          actionType: 'restock',
          isButton: true,
          statusKey: 'low'
        };
      }
    }

    // Default: Good/Healthy
    if (item.lifecycle_type === 'maintenance' && (!item.lifecycle_interval_days || item.lifecycle_interval_days === 0)) {
      return {
        label: t('permanent'),
        color: 'bg-zinc-100 text-zinc-600 border-zinc-200',
        actionType: 'none',
        isButton: false,
        statusKey: 'permanent'
      };
    }

    return {
      label: item.lifecycle_type === 'perishable' ? t('fresh') : (item.lifecycle_type === 'maintenance' ? t('healthy') : t('inStock')),
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      actionType: item.lifecycle_type === 'perishable' ? 'fresh' : 'none',
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

  const computedAlerts = React.useMemo(() => {
    const alerts: Alert[] = [];
    const now = new Date();
    now.setHours(0,0,0,0);
    
    items.forEach(item => {
      const status = getItemStatus(item);
      
      if (status.statusKey === 'empty') {
        alerts.push({
          id: `alert-empty-${item.id}`,
          item_id: item.id,
          type: 'stock',
          statusKey: 'empty',
          itemName: item.name,
          quantity: 0,
          threshold: item.alert_threshold || 0
        });
      } else if (status.statusKey === 'low' || status.statusKey === 'critical-restock') {
        alerts.push({
          id: `alert-low-${item.id}`,
          item_id: item.id,
          type: 'stock',
          statusKey: status.statusKey === 'critical-restock' ? 'empty' : 'low',
          itemName: item.name,
          quantity: item.quantity,
          threshold: item.alert_threshold || 0
        });
      } else if (status.statusKey === 'action-overdue' || status.statusKey === 'action-soon') {
        let dateStr = item.next_action_date || item.soonest_expiration_date || '';
        let diffDays = 0;
        if (dateStr) {
          const d = new Date(dateStr);
          d.setHours(0,0,0,0);
          diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 3600 * 24));
        }
        
        alerts.push({
          id: `alert-maint-${item.id}`,
          item_id: item.id,
          type: item.lifecycle_type === 'maintenance' ? 'maintenance' : 'expiry',
          statusKey: status.statusKey,
          itemName: item.name,
          dateStr,
          diffDays,
          statusLabel: status.label
        });
      }
    });
    
    return alerts.filter(a => {
      const dismissed = dismissedAlerts[a.id];
      if (!dismissed) return true;
      const isExpired = (Date.now() - dismissed.timestamp) > 24 * 60 * 60 * 1000;
      const statusChanged = dismissed.statusKey !== a.statusKey;
      return isExpired || statusChanged;
    });
  }, [items, t, dismissedAlerts]);

  const unreadNotifications = computedAlerts;

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
                <NotificationList
                  alerts={computedAlerts}
                  onItemClick={(itemId) => {
                    const item = items.find(i => i.id === itemId);
                    if (item) setSelectedItem(item);
                  }}
                  onAction={(alert) => {
                    handleConfirmReplacement(alert.item_id);
                    setToastMessage(lang === 'zh' ? '已处理' : 'Handled successfully');
                    setShowToast(true);
                    setTimeout(() => setShowToast(false), 3000);
                  }}
                  onDismiss={handleDismissAlert}
                  onClose={() => setShowNotifications(false)}
                />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(item => (
                <ProductCard 
                  key={item.id}
                  item={item}
                  onUpdateBatch={updateBatch}
                  onUpdateProduct={updateProduct}
                  onDeleteBatch={deleteBatch}
                  onAddBatch={handleAddBatch}
                  onEditProduct={setSelectedItem}
                  onDeleteProduct={(item) => setItemToDelete(item.id)}
                  getItemStatus={getItemStatus}
                  onAction={requestAction}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </section>
      </main>

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
          }}
        />
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <AddItemModal 
          categories={categories}
          locations={locations}
          presets={presets}
          lang={lang}
          currency={currency}
          onClose={() => setShowAddModal(false)}
          onAdd={async (newItem: any) => {
            await addItem(newItem);
            setShowAddModal(false);
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
                onClick={() => handleConfirmReplacement(confirmActionItem.id)}
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

      {/* Batch Delete Confirmation Modal */}
      {batchToDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6"
          >
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="font-semibold text-lg text-zinc-900">{lang === 'zh' ? '用完批次' : 'Use Up Batch'}</h2>
            </div>
            <p className="text-zinc-600 text-sm mb-6">
              {lang === 'zh' 
                ? `您确定要用完 ${batchToDeleteConfirm.itemName} 的批次 ${batchToDeleteConfirm.batchIndex} 吗？这将从您的库存中移除该批次。`
                : `Are you sure you want to use up ${batchToDeleteConfirm.itemName} Batch ${batchToDeleteConfirm.batchIndex}? This will remove this batch from your inventory.`}
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setBatchToDeleteConfirm(null)}
                className="h-[42px] px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => {
                  deleteBatch(batchToDeleteConfirm.productId, batchToDeleteConfirm.batchId);
                  setBatchToDeleteConfirm(null);
                }}
                className="h-[42px] px-4 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                {lang === 'zh' ? '确认移除' : 'Confirm Remove'}
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
  const [isThresholdManuallySet, setIsThresholdManuallySet] = useState(false);
  const [hasExpiryDate, setHasExpiryDate] = useState(true);
  const [cachedExpiryDate, setCachedExpiryDate] = useState('');

  // Auto-calculate threshold when expiration date changes
  useEffect(() => {
    if (!isThresholdManuallySet && formData.lifecycle_type === 'perishable' && formData.expiration_date) {
      const newThreshold = calculateSmartThreshold(formData.expiration_date);
      setFormData(prev => ({ ...prev, alert_threshold: newThreshold }));
    }
  }, [formData.expiration_date, formData.lifecycle_type, isThresholdManuallySet]);

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
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 z-10 bg-white/80 backdrop-blur-sm rounded-full p-1"
        >
          <X className="w-5 h-5" />
        </button>
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

          {/* Dynamic Rows based on Lifecycle Type */}
          {formData.lifecycle_type === 'consumable' ? (
            <>
              {/* Consumable Row 1: First Use Date (60%) + Usage Cycle (40%) */}
              <div className="flex gap-3 items-start mb-4">
                <div className="w-3/5 shrink-0">
                  <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">{t('firstUsed')}</label>
                  <input 
                    type="date" 
                    required
                    value={formData.last_action_date}
                    onChange={e => setFormData({...formData, last_action_date: e.target.value})}
                    className="w-full h-[42px] px-2 py-2 text-[13px] sm:text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:p-0"
                  />
                </div>
                <div className="w-2/5 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-zinc-700 truncate">{t('intervalDays')}</label>
                    <input 
                      type="checkbox"
                      checked={formData.is_permanent}
                      onChange={e => setFormData({...formData, is_permanent: e.target.checked})}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 h-[42px]">
                    <div className="flex-1 min-w-0 h-full">
                      <SmartNumberInputWithSpinners
                        min={0}
                        disabled={formData.is_permanent}
                        value={formData.lifecycle_interval_days}
                        onChange={val => setFormData({...formData, lifecycle_interval_days: val})}
                        className="w-full h-full disabled:bg-zinc-100 disabled:text-zinc-400"
                      />
                    </div>
                    <span className="text-sm text-zinc-500 shrink-0 whitespace-nowrap">{t('days')}</span>
                  </div>
                </div>
              </div>

              {/* Consumable Row 2: Expiry Date (60%) + Quantity (40%) */}
              <div className="flex gap-3 items-start mb-4">
                <div className="w-3/5 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-zinc-700 truncate">{t('expDate')}</label>
                    <input 
                      type="checkbox"
                      checked={!hasExpiryDate}
                      onChange={e => {
                        const noExpiry = e.target.checked;
                        setHasExpiryDate(!noExpiry);
                        if (noExpiry) {
                          setCachedExpiryDate(formData.expiration_date);
                          setFormData({...formData, expiration_date: ''});
                        } else {
                          setFormData({...formData, expiration_date: cachedExpiryDate});
                        }
                      }}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
                    />
                  </div>
                  <input 
                    type="date" 
                    disabled={!hasExpiryDate}
                    value={formData.expiration_date}
                    onChange={e => setFormData({...formData, expiration_date: e.target.value})}
                    className="w-full h-[42px] px-2 py-2 text-[13px] sm:text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:opacity-50 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:p-0"
                  />
                </div>
                <div className="w-2/5 shrink-0">
                  <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">{t('quantity')}</label>
                  <div className="flex items-center gap-2 h-[42px]">
                    <div className="flex-1 min-w-0 h-full">
                      <SmartNumberInputWithSpinners
                        value={formData.quantity}
                        onChange={val => setFormData({...formData, quantity: val})}
                        className="w-full h-full"
                      />
                    </div>
                    <span className="text-sm text-zinc-500 shrink-0 whitespace-nowrap">{t('thresholdItems')}</span>
                  </div>
                </div>
              </div>

              {/* Consumable Row 3: Alert Threshold (40%) + Notes (60%) */}
              <div className="flex gap-3 items-start mb-4">
                <div className="w-2/5 shrink-0">
                  <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">{t('alertWhenBelow')}</label>
                  <div className="flex items-center gap-2 h-[42px]">
                    <div className="flex-1 min-w-0 h-full">
                      <SmartNumberInputWithSpinners
                        value={formData.alert_threshold}
                        onChange={val => {
                          setIsThresholdManuallySet(true);
                          setFormData({...formData, alert_threshold: val});
                        }}
                        className="w-full h-full"
                      />
                    </div>
                    <span className="text-sm text-zinc-500 shrink-0 whitespace-nowrap">{t('thresholdItems')}</span>
                  </div>
                </div>
                <div className="w-3/5 shrink-0">
                  <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">{t('notes')}</label>
                  <div className="h-[42px]">
                    <SmartNotesInput
                      value={formData.notes}
                      onChange={val => setFormData({...formData, notes: val})}
                      placeholder={t('notesPlaceholder')}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Row 3: Date (60%) + Quantity/Interval (40%) */}
              <div className="flex gap-3 items-start mb-4">
                {/* Left: Date (60%) */}
                <div className="w-3/5 shrink-0">
                  {formData.lifecycle_type === 'perishable' ? (
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-zinc-700 truncate">{t('expDate')}</label>
                      <input 
                        type="checkbox"
                        checked={!hasExpiryDate}
                        onChange={e => {
                          const noExpiry = e.target.checked;
                          setHasExpiryDate(!noExpiry);
                          if (noExpiry) {
                            setCachedExpiryDate(formData.expiration_date);
                            setFormData({...formData, expiration_date: ''});
                          } else {
                            setFormData({...formData, expiration_date: cachedExpiryDate});
                          }
                        }}
                        className="w-3.5 h-3.5 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">
                      {t('lastMaintained')}
                    </label>
                  )}
                  <input 
                    type="date" 
                    required={formData.lifecycle_type !== 'perishable'}
                    disabled={formData.lifecycle_type === 'perishable' && !hasExpiryDate}
                    value={formData.lifecycle_type === 'perishable' ? formData.expiration_date : formData.last_action_date}
                    onChange={e => {
                      if (formData.lifecycle_type === 'perishable') {
                        setFormData({...formData, expiration_date: e.target.value});
                      } else {
                        setFormData({...formData, last_action_date: e.target.value});
                      }
                    }}
                    className="w-full h-[42px] px-2 py-2 text-[13px] sm:text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:opacity-50 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:p-0"
                  />
                </div>

                {/* Right: Quantity/Interval (40%) */}
                <div className="w-2/5 shrink-0">
                  {formData.lifecycle_type === 'perishable' ? (
                    <>
                      <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">{t('quantity')}</label>
                      <div className="flex items-center gap-2 h-[42px]">
                        <div className="flex-1 min-w-0 h-full">
                          <SmartNumberInputWithSpinners
                            value={formData.quantity}
                            onChange={val => setFormData({...formData, quantity: val})}
                            className="w-full h-full"
                          />
                        </div>
                        <span className="text-sm text-zinc-500 shrink-0 whitespace-nowrap">{t('thresholdItems')}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-zinc-700 truncate">{t('intervalDays')}</label>
                        <div className="flex items-center gap-1">
                           <input 
                              type="checkbox"
                              id="permanentUseAdd"
                              checked={formData.is_permanent}
                              onChange={e => setFormData({...formData, is_permanent: e.target.checked})}
                              className="w-3.5 h-3.5 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
                            />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 h-[42px]">
                        <div className="flex-1 min-w-0 h-full">
                          <SmartNumberInputWithSpinners
                            min={0}
                            disabled={formData.is_permanent}
                            value={formData.lifecycle_interval_days}
                            onChange={val => setFormData({...formData, lifecycle_interval_days: val})}
                            className="w-full h-full disabled:bg-zinc-100 disabled:text-zinc-400"
                          />
                        </div>
                        <span className="text-sm text-zinc-500 shrink-0 whitespace-nowrap">{t('thresholdDays')}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Row 4: Alert Threshold (40%) + Notes (60%) */}
              <div className="flex gap-3 items-start">
                {/* Left: Alert Threshold (40%) */}
                <div className="w-2/5 shrink-0">
                  <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">
                    {formData.lifecycle_type === 'perishable' 
                      ? t('alertWhenDaysLess') 
                      : t('alertBeforeMaintenance')}
                  </label>
                  <div className="flex items-center gap-2 h-[42px]">
                    <div className="flex-1 min-w-0 h-full">
                      <SmartNumberInputWithSpinners
                        value={formData.alert_threshold}
                        onChange={val => {
                          setIsThresholdManuallySet(true);
                          setFormData({...formData, alert_threshold: val});
                        }}
                        className="w-full h-full"
                      />
                    </div>
                    <span className="text-sm text-zinc-500 shrink-0 whitespace-nowrap">
                      {t('thresholdDays')}
                    </span>
                  </div>
                </div>

                {/* Right: Notes (60%) */}
                <div className="w-3/5 shrink-0">
                  <label className="block text-sm font-medium text-zinc-700 mb-1 truncate">{t('notes')}</label>
                  <div className="h-[42px]">
                    <SmartNotesInput
                      value={formData.notes}
                      onChange={val => setFormData({...formData, notes: val})}
                      placeholder={t('notesPlaceholder')}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

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
