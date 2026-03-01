import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Package, AlertTriangle, CheckCircle, Clock, 
  Plus, Search, Filter, MoreVertical, ShoppingCart,
  Camera, Trash2, Bell, RefreshCw, Download, Settings
} from 'lucide-react';
import { Item, Category, Location, SmartPreset, LifecycleType } from './types';
import { SmartScanModal } from './components/SmartScanModal';
import { EditItemModal } from './components/EditItemModal';
import { SettingsModal } from './components/SettingsModal';
import { Language, Currency, useTranslation, formatCurrency } from './i18n';

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

  const t = useTranslation(lang);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

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
  const getStatus = (item: Item) => {
    if (item.quantity === 0 && item.lifecycle_type === 'perishable') return 'empty';
    
    if (item.next_action_date) {
      const daysUntilAction = Math.ceil((new Date(item.next_action_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      if (daysUntilAction < 0) return 'action-overdue';
      if (daysUntilAction <= 7) return 'action-soon';
    }
    
    if (item.lifecycle_type === 'perishable' && item.quantity <= 1) return 'low';
    return 'good';
  };

  const stats = {
    total: items.length,
    critical: items.filter(i => ['empty', 'action-overdue'].includes(getStatus(i))).length,
    warning: items.filter(i => ['action-soon', 'low'].includes(getStatus(i))).length,
    healthy: items.filter(i => getStatus(i) === 'good').length,
  };

  const notifications = items.filter(i => {
    const status = getStatus(i);
    return ['empty', 'action-overdue', 'action-soon', 'low'].includes(status);
  });

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
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-zinc-100 py-2 z-30">
                  <div className="px-4 py-2 border-b border-zinc-100 flex justify-between items-center">
                    <h3 className="font-semibold text-sm">{t('smartReminders')}</h3>
                    <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{notifications.length}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-zinc-500">{t('noReminders')}</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="px-4 py-3 hover:bg-zinc-50 border-b border-zinc-50 last:border-0 cursor-pointer" onClick={() => { setSelectedItem(n); setShowNotifications(false); }}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm text-zinc-900">{n.name}</span>
                            <StatusBadge status={getStatus(n)} item={n} lang={lang} />
                          </div>
                          <div className="text-xs text-zinc-500">
                            {n.location_name} • {n.category_name}
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
                      const status = getStatus(item);
                      return (
                        <motion.tr 
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                          onClick={() => setSelectedItem(item)}
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-zinc-900">{item.name}</div>
                            <div className="text-zinc-500 text-xs mt-0.5 capitalize">
                              {t(item.lifecycle_type as any)} • {item.category_name}
                              {item.current_price && ` • ${formatCurrency(item.current_price, currency)}`}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-600">
                            {item.location_name}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={status} item={item} lang={lang} />
                          </td>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            {item.lifecycle_type === 'perishable' ? (
                              <div className="flex items-center justify-end gap-3">
                                <button 
                                  onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                                  className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                                >-</button>
                                <span className="font-mono w-4 text-center">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                                >+</button>
                              </div>
                            ) : (
                              <div className="flex justify-end">
                                <button 
                                  onClick={() => performAction(item.id)}
                                  className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-200"
                                >
                                  {item.lifecycle_type === 'maintenance' ? t('markDone') : t('replaced')}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {item.store_link ? (
                                <a 
                                  href={item.store_link} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="p-1.5 text-zinc-400 hover:text-emerald-600 transition-colors"
                                  title={t('restock')}
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </a>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const searchUrl = lang === 'zh' 
                                      ? `https://s.taobao.com/search?q=${encodeURIComponent(item.name)}`
                                      : `https://www.amazon.com/s?k=${encodeURIComponent(item.name)}`;
                                    window.open(searchUrl, '_blank');
                                  }}
                                  className="p-1.5 text-zinc-400 hover:text-emerald-600 transition-colors"
                                  title={t('searchOnWeb')}
                                >
                                  <Search className="w-4 h-4" />
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
        />
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

function StatusBadge({ status, item, lang }: { status: string, item: Item, lang: Language }) {
  const t = useTranslation(lang);
  if (status === 'empty') {
    return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 border border-red-200">{t('outOfStock')}</span>;
  }
  if (status === 'action-overdue') {
    return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 border border-red-200">
      {item.lifecycle_type === 'maintenance' ? t('maintenanceOverdue') : item.lifecycle_type === 'consumable' ? t('replaceNow') : t('expired')}
    </span>;
  }
  if (status === 'action-soon') {
    return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
      {item.lifecycle_type === 'maintenance' ? t('maintainSoon') : item.lifecycle_type === 'consumable' ? t('replaceSoon') : t('expiringSoon')}
    </span>;
  }
  if (status === 'low') {
    return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">{t('lowStock')}</span>;
  }
  return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">{t('healthy')}</span>;
}

function AddItemModal({ categories, locations, presets, lang, currency, onClose, onAdd }: any) {
  const t = useTranslation(lang);
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

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    if (!presetId) return;
    const preset = presets.find((p: SmartPreset) => p.id === presetId);
    if (preset) {
      setFormData(prev => ({
        ...prev,
        name: preset.name,
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
                  <option key={p.id} value={p.id}>{p.name} ({p.lifecycle_interval_days} {t('days')})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">{t('name')} *</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder={lang === 'zh' ? '例如：牛奶' : 'e.g., Almond Milk'}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('category')}</label>
              <select 
                value={formData.category_id}
                onChange={e => setFormData({...formData, category_id: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              >
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('location')}</label>
              <select 
                value={formData.location_id}
                onChange={e => setFormData({...formData, location_id: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              >
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
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
              <input 
                type="url" 
                value={formData.store_link}
                onChange={e => setFormData({...formData, store_link: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="https://..."
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
