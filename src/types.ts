export type LifecycleType = 'perishable' | 'consumable' | 'maintenance';

export interface Item {
  id: string;
  household_id: string;
  location_id: string;
  category_id: string;
  name: string;
  purpose?: string;
  storage_method?: string;
  quantity: number;
  
  // Lifecycle fields
  lifecycle_type: LifecycleType;
  lifecycle_interval_days?: number;
  last_action_date?: string;
  next_action_date?: string;
  expiration_date?: string; // Legacy/Perishable specific
  
  restock_frequency_days?: number;
  historical_price?: number;
  current_price?: number;
  store_link?: string;
  barcode?: string;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  category_name?: string;
  location_name?: string;
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
