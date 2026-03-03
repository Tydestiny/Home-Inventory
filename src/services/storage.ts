import { Item, Category, Location, SmartPreset, Notification, LifecycleType } from '../types';

const STORAGE_KEY = 'home_inventory_data';
const SETTINGS_KEY = 'home_inventory_settings';

interface StorageData {
  items: Item[];
  categories: Category[];
  locations: Location[];
  presets: SmartPreset[];
  notifications: Notification[];
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Groceries' },
  { id: 'cat-2', name: 'Cleaning Supplies' },
  { id: 'cat-3', name: 'Toiletries' },
  { id: 'cat-4', name: 'Medicine' },
  { id: 'cat-5', name: 'Home Maintenance' }
];

const DEFAULT_LOCATIONS: Location[] = [
  { id: 'loc-1', household_id: 'household-1', name: 'Kitchen Pantry' },
  { id: 'loc-2', household_id: 'household-1', name: 'Fridge' },
  { id: 'loc-3', household_id: 'household-1', name: 'Master Bathroom' },
  { id: 'loc-4', household_id: 'household-1', name: 'Laundry Room' },
  { id: 'loc-5', household_id: 'household-1', name: 'Utility Closet' },
  { id: 'loc-6', household_id: 'household-1', name: 'Bedroom' },
  { id: 'loc-7', household_id: 'household-1', name: 'Wardrobe' }
];

const DEFAULT_PRESETS: SmartPreset[] = [
  { id: 'p-1', name: 'Toothbrush', category_id: 'cat-3', lifecycle_type: 'consumable', lifecycle_interval_days: 90 },
  { id: 'p-2', name: 'Kitchen Sponge', category_id: 'cat-2', lifecycle_type: 'consumable', lifecycle_interval_days: 14 },
  { id: 'p-3', name: 'Water Filter', category_id: 'cat-1', lifecycle_type: 'consumable', lifecycle_interval_days: 60 },
  { id: 'p-4', name: 'Wash Bedsheets', category_id: 'cat-5', lifecycle_type: 'maintenance', lifecycle_interval_days: 14 },
  { id: 'p-5', name: 'Clean AC Filter', category_id: 'cat-5', lifecycle_type: 'maintenance', lifecycle_interval_days: 180 },
  { id: 'p-6', name: 'Replace Smoke Alarm Batteries', category_id: 'cat-5', lifecycle_type: 'maintenance', lifecycle_interval_days: 365 },
  { id: 'p-7', name: 'Bath Towel', category_id: 'cat-3', lifecycle_type: 'consumable', lifecycle_interval_days: 365 },
];

export const storageService = {
  getData(): StorageData {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const initialData: StorageData = {
        items: [],
        categories: DEFAULT_CATEGORIES,
        locations: DEFAULT_LOCATIONS,
        presets: DEFAULT_PRESETS,
        notifications: []
      };
      this.saveData(initialData);
      return initialData;
    }
    return JSON.parse(stored);
  },

  saveData(data: StorageData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  getSettings() {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return { language: 'en', currency: 'USD' };
    }
    return JSON.parse(stored);
  },

  saveSettings(settings: { language: string, currency: string }) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  getItems(): Item[] {
    return this.getData().items;
  },

  saveItem(item: Item) {
    const data = this.getData();
    const index = data.items.findIndex(i => i.id === item.id);
    if (index > -1) {
      data.items[index] = { ...item, updated_at: new Date().toISOString() };
    } else {
      data.items.push({ ...item, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    this.saveData(data);
    this.refreshNotifications();
    return item;
  },

  deleteItem(id: string) {
    const data = this.getData();
    data.items = data.items.filter(i => i.id !== id);
    data.notifications = data.notifications.filter(n => n.item_id !== id);
    this.saveData(data);
  },

  performAction(id: string): Item | null {
    const data = this.getData();
    const item = data.items.find(i => i.id === id);
    if (!item) return null;

    const today = new Date();
    item.last_action_date = today.toISOString().split('T')[0];
    
    if (item.lifecycle_type !== 'perishable' && item.lifecycle_interval_days) {
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + item.lifecycle_interval_days);
      item.next_action_date = nextDate.toISOString().split('T')[0];
    }
    
    item.updated_at = today.toISOString();
    this.saveData(data);
    this.refreshNotifications();
    return item;
  },

  getNotifications(): Notification[] {
    return this.getData().notifications;
  },

  markNotificationRead(id: string) {
    const data = this.getData();
    const notification = data.notifications.find(n => n.id === id);
    if (notification) {
      notification.is_read = 1;
      this.saveData(data);
    }
  },

  refreshNotifications() {
    const data = this.getData();
    const items = data.items;
    const newNotifications: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    items.forEach(item => {
      // Threshold Alert (Consumables)
      if (item.lifecycle_type === 'consumable' && item.quantity <= (item.alert_threshold || 0)) {
        const existing = data.notifications.find(n => n.item_id === item.id && n.type === 'low_stock' && !n.is_read);
        if (!existing) {
          newNotifications.push({
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            item_id: item.id,
            type: 'low_stock',
            title: 'Low Stock Alert',
            message: `${item.name} is running low (${item.quantity} left).`,
            is_read: 0,
            created_at: new Date().toISOString()
          });
        }
      }

      // Expiring Soon (Perishables)
      if (item.lifecycle_type === 'perishable' && item.expiration_date) {
        const expDate = new Date(item.expiration_date);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= (item.alert_threshold || 5)) {
          const existing = data.notifications.find(n => n.item_id === item.id && n.type === 'threshold_alert' && !n.is_read);
          if (!existing) {
            newNotifications.push({
              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              item_id: item.id,
              type: 'threshold_alert',
              title: 'Expiring Soon',
              message: `${item.name} will expire in ${diffDays} days.`,
              is_read: 0,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      // Action Overdue (Maintenance)
      if (item.lifecycle_type === 'maintenance' && item.next_action_date) {
        const nextDate = new Date(item.next_action_date);
        if (nextDate < today) {
          const existing = data.notifications.find(n => n.item_id === item.id && n.type === 'action_overdue' && !n.is_read);
          if (!existing) {
            newNotifications.push({
              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              item_id: item.id,
              type: 'action_overdue',
              title: 'Maintenance Overdue',
              message: `${item.name} requires maintenance.`,
              is_read: 0,
              created_at: new Date().toISOString()
            });
          }
        }
      }
    });

    data.notifications = [...data.notifications, ...newNotifications];
    this.saveData(data);
  },

  loadStarterTemplate() {
    const data = this.getData();
    const household_id = 'household-1';
    const templates = [
      { name: '大米', category: 'Groceries', location: 'Kitchen Pantry', type: 'perishable', interval: 0, qty: 1, threshold: 5 },
      { name: '生抽', category: 'Groceries', location: 'Kitchen Pantry', type: 'perishable', interval: 0, qty: 1, threshold: 3 },
      { name: '洗脸巾', category: 'Toiletries', location: 'Master Bathroom', type: 'consumable', interval: 30, qty: 3, threshold: 1 },
      { name: '牙膏', category: 'Toiletries', location: 'Master Bathroom', type: 'consumable', interval: 60, qty: 2, threshold: 1 },
      { name: '空气净化器滤芯', category: 'Home Maintenance', location: 'Utility Closet', type: 'maintenance', interval: 180, qty: 1, threshold: 0 },
      { name: '洗衣液', category: 'Cleaning Supplies', location: 'Laundry Room', type: 'consumable', interval: 60, qty: 1, threshold: 1 },
      { name: '垃圾袋', category: 'Cleaning Supplies', location: 'Kitchen Pantry', type: 'consumable', interval: 30, qty: 5, threshold: 2 },
      { name: '卫生纸', category: 'Toiletries', location: 'Master Bathroom', type: 'consumable', interval: 30, qty: 12, threshold: 4 },
      { name: '沐浴露', category: 'Toiletries', location: 'Master Bathroom', type: 'consumable', interval: 90, qty: 1, threshold: 1 },
      { name: '拖把头', category: 'Cleaning Supplies', location: 'Laundry Room', type: 'maintenance', interval: 90, qty: 1, threshold: 0 },
      { name: '电池', category: 'Home Maintenance', location: 'Utility Closet', type: 'consumable', interval: 180, qty: 8, threshold: 2 }
    ];

    const getCatId = (name: string) => data.categories.find(c => c.name === name)?.id || data.categories[0]?.id;
    const getLocId = (name: string) => data.locations.find(l => l.name === name)?.id || data.locations[0]?.id;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    templates.forEach(t => {
      const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const catId = getCatId(t.category);
      const locId = getLocId(t.location);

      let nextDate = undefined;
      let expDate = undefined;
      
      if (t.type !== 'perishable') {
        const d = new Date(today);
        d.setDate(d.getDate() + t.interval);
        nextDate = d.toISOString().split('T')[0];
      } else {
        const d = new Date(today);
        d.setDate(d.getDate() + 7); // expires in 7 days
        expDate = d.toISOString().split('T')[0];
      }

      data.items.push({
        id,
        household_id,
        location_id: locId,
        category_id: catId,
        name: t.name,
        quantity: t.qty,
        alert_threshold: t.threshold,
        lifecycle_type: t.type as LifecycleType,
        lifecycle_interval_days: t.interval,
        last_action_date: todayStr,
        next_action_date: nextDate,
        expiration_date: expDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });

    this.saveData(data);
    this.refreshNotifications();
  },

  exportData() {
    const data = {
      inventory: this.getData(),
      settings: this.getSettings(),
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `home-inventory-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importData(jsonData: string): boolean {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.inventory && parsed.settings) {
        this.saveData(parsed.inventory);
        this.saveSettings(parsed.settings);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  }
};
