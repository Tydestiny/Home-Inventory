export type LifecycleType = 'perishable' | 'consumable' | 'maintenance';

export interface Batch {
  id: string;
  quantity: number;
  expiration_date?: string;
  added_date: string;
  notes?: string;
}

export interface Item {
  id: string;
  household_id: string;
  location_id: string;
  category_id: string;
  name: string;
  purpose?: string;
  storage_method?: string;
  
  // Legacy fields (kept for backward compatibility during migration)
  quantity?: number;
  expiration_date?: string;
  notes?: string;
  
  // Lifecycle fields
  lifecycle_type: LifecycleType;
  lifecycle_interval_days?: number;
  last_action_date?: string;
  next_action_date?: string;
  first_use_date?: string;
  last_replaced_date?: string; // Moved here
  
  restock_frequency_days?: number;
  alert_threshold?: number; // Quantity for consumables, days for perishables
  barcode?: string;
  created_at: string;
  updated_at: string;
  
  // New Smart Carousel fields
  batches: Batch[];
  
  // Computed fields (for UI)
  total_quantity?: number;
  soonest_expiration_date?: string | null;

  // Joined fields
  category_name?: string;
  location_name?: string;
}

export interface Notification {
  id: string;
  item_id?: string;
  type: 'threshold_alert' | 'low_stock' | 'action_overdue';
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Location {
  id: string;
  household_id: string;
  name: string;
}

export interface SmartPreset {
  id: string;
  name: string;
  category_id: string;
  lifecycle_type: LifecycleType;
  lifecycle_interval_days: number;
}
