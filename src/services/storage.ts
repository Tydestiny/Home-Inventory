import { Item, Batch, Category, Location, SmartPreset, Notification, LifecycleType } from '../types';

const STORAGE_KEY = 'home_inventory_data';
const SETTINGS_KEY = 'home_inventory_settings';
const AI_CONFIG_KEY = 'home_inventory_ai_config';

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

export function calculateSmartThreshold(expirationDate: string): number {
  if (!expirationDate) return 14;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(expirationDate);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
  
  if (diffDays < 30) return 3;
  if (diffDays <= 180) return 14;
  return 30;
}

export const storageService = {
  initializeSmartBatchSystem() {
    const data = this.getData();
    let migrated = false;

    // Aggressive grouping by trimmed, lowercase name
    const groupedProducts = new Map<string, Item>();

    data.items.forEach(item => {
      const normalizedName = item.name.trim().toLowerCase();
      
      // If item already has batches, we still want to check if it can be merged with others of the same name
      const existingProduct = groupedProducts.get(normalizedName);

      if (existingProduct) {
        migrated = true;
        // Merge batches
        const batchesToMerge = item.batches || [{
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          quantity: item.quantity ?? 1,
          expiration_date: item.expiration_date,
          added_date: item.created_at || new Date().toISOString(),
          notes: item.notes
        }];
        
        existingProduct.batches.push(...batchesToMerge);
        // Update product metadata if necessary (keep the oldest created_at)
        if (new Date(item.created_at) < new Date(existingProduct.created_at)) {
          existingProduct.created_at = item.created_at;
        }
      } else {
        if (!item.batches) {
          migrated = true;
          item.batches = [{
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            quantity: item.quantity ?? 1,
            expiration_date: item.expiration_date,
            added_date: item.created_at || new Date().toISOString(),
            notes: item.notes
          }];
          // Remove legacy fields to clean up
          delete item.quantity;
          delete item.expiration_date;
          delete item.notes;
        }
        groupedProducts.set(normalizedName, item);
      }
    });

    if (migrated) {
      data.items = Array.from(groupedProducts.values());
      this.saveData(data);
    }
  },

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

  getAIConfig() {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    if (!stored) {
      return {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1'
      };
    }
    return JSON.parse(stored);
  },

  saveAIConfig(config: any) {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  },

  getItems(): Item[] {
    this.initializeSmartBatchSystem();
    const items = this.getData().items;
    
    // Compute total_quantity and soonest_expiration_date on the fly
    return items.map(item => {
      if (!item.batches) return item;
      
      // Sort batches by expiration date (earliest first)
      const sortedBatches = [...item.batches].sort((a, b) => {
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
      });

      const total_quantity = sortedBatches.reduce((sum, b) => sum + b.quantity, 0);
      const soonest_expiration_date = sortedBatches.find(b => b.expiration_date)?.expiration_date || null;

      return {
        ...item,
        batches: sortedBatches,
        total_quantity,
        soonest_expiration_date,
        // Sync legacy quantity for backward compatibility during transition
        quantity: total_quantity,
        expiration_date: soonest_expiration_date || undefined
      };
    });
  },

  saveItem(item: Item) {
    const data = this.getData();
    const normalizedName = item.name.trim().toLowerCase();
    
    // Check if a product with this name already exists (excluding current item if editing)
    const existingIndex = data.items.findIndex(i => 
      i.name.trim().toLowerCase() === normalizedName && i.id !== item.id
    );

    if (existingIndex > -1) {
      // Merge into existing product
      const existingProduct = data.items[existingIndex];
      
      // If the item being saved is a "new" item (no batches yet or different ID), append its batches
      if (item.batches && item.id !== existingProduct.id) {
        existingProduct.batches.push(...item.batches);
      } else if (!item.batches) {
        // Legacy add or simple add
        existingProduct.batches.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          quantity: item.quantity ?? 1,
          expiration_date: item.expiration_date,
          added_date: new Date().toISOString(),
          notes: item.notes
        });
      }
      
      existingProduct.updated_at = new Date().toISOString();
      // If we were editing an item and changed its name to an existing one, delete the old ID entry
      data.items = data.items.filter(i => i.id !== item.id || i.id === existingProduct.id);
    } else {
      // Normal save or update
      const index = data.items.findIndex(i => i.id === item.id);
      if (index > -1) {
        data.items[index] = { ...item, updated_at: new Date().toISOString() };
      } else {
        // New product
        if (!item.batches) {
          item.batches = [{
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            quantity: item.quantity ?? 1,
            expiration_date: item.expiration_date,
            added_date: new Date().toISOString(),
            notes: item.notes
          }];
        }
        data.items.push({ ...item, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
    }

    this.saveData(data);
    this.refreshNotifications();
    
    // Return the product that was actually saved/merged
    const finalName = item.name.trim().toLowerCase();
    return data.items.find(i => i.name.trim().toLowerCase() === finalName) || item;
  },

  updateProduct(productId: string, updates: Partial<Item>) {
    const data = this.getData();
    const productIndex = data.items.findIndex(i => i.id === productId);
    if (productIndex > -1) {
      data.items[productIndex] = { ...data.items[productIndex], ...updates, updated_at: new Date().toISOString() };
      
      // Reactive logic for consumables: update next_action_date if last_replaced_date changes
      if (data.items[productIndex].lifecycle_type === 'consumable' && updates.last_replaced_date && data.items[productIndex].lifecycle_interval_days) {
        const lastReplaced = new Date(updates.last_replaced_date);
        const nextAction = new Date(lastReplaced);
        nextAction.setDate(nextAction.getDate() + data.items[productIndex].lifecycle_interval_days!);
        data.items[productIndex].next_action_date = nextAction.toISOString();
      }

      this.saveData(data);
      this.refreshNotifications();
      return data.items[productIndex];
    }
    return null;
  },

  updateBatch(productId: string, batchId: string, updates: Partial<Batch>) {
    const data = this.getData();
    const product = data.items.find(i => i.id === productId);
    if (product && product.batches) {
      const batchIndex = product.batches.findIndex(b => b.id === batchId);
      if (batchIndex > -1) {
        let newBatch = { ...product.batches[batchIndex], ...updates };
        
        product.batches[batchIndex] = newBatch;
        product.updated_at = new Date().toISOString();
        this.saveData(data);
        this.refreshNotifications();
        return product;
      }
    }
    return null;
  },

  deleteBatch(productId: string, batchId: string) {
    const data = this.getData();
    const product = data.items.find(i => i.id === productId);
    if (product && product.batches) {
      product.batches = product.batches.filter(b => b.id !== batchId);
      
      // Removed: If no batches left, delete the product
      
      product.updated_at = new Date().toISOString();
      this.saveData(data);
      this.refreshNotifications();
      return product;
    }
    return null;
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
    
    // If consumable, update last_replaced_date
    if (item.lifecycle_type === 'consumable') {
      item.last_replaced_date = today.toISOString().split('T')[0];
    }
    
    // Decrement quantity from the soonest expiring batch
    if ((item.lifecycle_type === 'consumable' || item.lifecycle_type === 'perishable') && item.batches) {
      // Sort batches to find the one to decrement
      const sortedBatches = [...item.batches].sort((a, b) => {
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
      });

      const batchToUpdate = sortedBatches.find(b => b.quantity > 0);
      if (batchToUpdate) {
        const realBatchIndex = item.batches.findIndex(b => b.id === batchToUpdate.id);
        if (realBatchIndex > -1) {
          item.batches[realBatchIndex].quantity -= 1;
          if (item.batches[realBatchIndex].quantity <= 0) {
            item.batches.splice(realBatchIndex, 1);
          }
        }
      }
    }
    
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
      if (item.lifecycle_type === 'consumable' && (item.total_quantity || 0) <= (item.alert_threshold || 0)) {
        const existing = data.notifications.find(n => n.item_id === item.id && n.type === 'low_stock' && !n.is_read);
        if (!existing) {
          newNotifications.push({
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            item_id: item.id,
            type: 'low_stock',
            title: 'Low Stock Alert',
            message: `${item.name} Low Stock: Left ${item.total_quantity || 0} | Threshold: ${item.alert_threshold || 0}`,
            is_read: 0,
            created_at: new Date().toISOString()
          });
        }
      }

      // Replacement Alert (Consumables)
      if (item.lifecycle_type === 'consumable' && item.last_replaced_date && item.lifecycle_interval_days) {
        const lastReplaced = new Date(item.last_replaced_date);
        const nextAction = new Date(lastReplaced);
        nextAction.setDate(nextAction.getDate() + item.lifecycle_interval_days);
        
        if (nextAction < today) {
          const existing = data.notifications.find(n => n.item_id === item.id && n.type === 'action_overdue' && !n.is_read);
          if (!existing) {
            const diffDays = Math.ceil((today.getTime() - nextAction.getTime()) / (1000 * 60 * 60 * 24));
            newNotifications.push({
              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              item_id: item.id,
              type: 'action_overdue',
              title: 'Time to Replace',
              message: `${item.name} Time to Replace: ${nextAction.toISOString().split('T')[0]} | Overdue ${diffDays} day${diffDays === 1 ? '' : 's'}`,
              is_read: 0,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      // Expiring Soon (Perishables)
      if (item.lifecycle_type === 'perishable' && item.expiration_date) {
        const expDate = new Date(item.expiration_date);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= (item.alert_threshold || 5)) {
          const existing = data.notifications.find(n => n.item_id === item.id && n.type === 'threshold_alert' && !n.is_read);
          if (!existing) {
            const status = diffDays < 0 ? 'Expired' : 'Expiring';
            const daysText = diffDays < 0 ? `Overdue ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}` : `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
            newNotifications.push({
              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              item_id: item.id,
              type: 'threshold_alert',
              title: 'Expiring Soon',
              message: `${item.name} ${status}: ${item.expiration_date} | ${daysText}`,
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
            const diffDays = Math.ceil((today.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
            newNotifications.push({
              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              item_id: item.id,
              type: 'action_overdue',
              title: 'Maintenance Overdue',
              message: `${item.name} Overdue: ${item.next_action_date} | Overdue ${diffDays} day${diffDays === 1 ? '' : 's'}`,
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
      aiConfig: this.getAIConfig(),
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
        if (parsed.aiConfig) {
          this.saveAIConfig(parsed.aiConfig);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  }
};
