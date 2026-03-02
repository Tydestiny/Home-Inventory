import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'inventory.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS households (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS household_members (
    household_id TEXT REFERENCES households(id),
    user_id TEXT REFERENCES users(id),
    role TEXT DEFAULT 'member',
    PRIMARY KEY (household_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    household_id TEXT REFERENCES households(id),
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS smart_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id),
    lifecycle_type TEXT NOT NULL,
    lifecycle_interval_days INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    household_id TEXT REFERENCES households(id),
    location_id TEXT REFERENCES locations(id),
    category_id TEXT REFERENCES categories(id),
    
    name TEXT NOT NULL,
    purpose TEXT,
    storage_method TEXT,
    
    quantity INTEGER DEFAULT 1,
    
    -- Universal Lifecycle Policy
    lifecycle_type TEXT DEFAULT 'perishable',
    lifecycle_interval_days INTEGER,
    last_action_date DATETIME,
    next_action_date DATETIME,
    expiration_date DATE, -- Legacy/Perishable specific
    
    restock_frequency_days INTEGER,
    
    historical_price REAL,
    current_price REAL,
    store_link TEXT,
    barcode TEXT,
    is_all_time_low INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    source_platform TEXT DEFAULT 'Manual',
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    household_id TEXT PRIMARY KEY REFERENCES households(id),
    language TEXT DEFAULT 'en',
    currency TEXT DEFAULT 'USD'
  );
`);

// Add columns if they don't exist (Migration for existing MVP DB)
try {
  db.exec('ALTER TABLE items ADD COLUMN lifecycle_type TEXT DEFAULT "perishable"');
  db.exec('ALTER TABLE items ADD COLUMN lifecycle_interval_days INTEGER');
  db.exec('ALTER TABLE items ADD COLUMN last_action_date DATETIME');
  db.exec('ALTER TABLE items ADD COLUMN next_action_date DATETIME');
} catch (e) {}

try {
  db.exec('ALTER TABLE items ADD COLUMN is_all_time_low INTEGER DEFAULT 0');
} catch (e) {}

try {
  db.exec('ALTER TABLE price_history ADD COLUMN currency TEXT DEFAULT "USD"');
  db.exec('ALTER TABLE price_history ADD COLUMN source_platform TEXT DEFAULT "Manual"');
} catch (e) {}

// Cleanup bilingual names (Migration for existing items with "Name (Translation)")
try {
  // Handles "Name (Translation)", "Name(Translation)", "Name（Translation）"
  db.exec(`
    UPDATE items 
    SET name = TRIM(
      CASE 
        WHEN INSTR(name, '(') > 0 THEN SUBSTR(name, 1, INSTR(name, '(') - 1)
        WHEN INSTR(name, '（') > 0 THEN SUBSTR(name, 1, INSTR(name, '（') - 1)
        ELSE name
      END
    )
    WHERE name LIKE '%(%)' OR name LIKE '%（%）'
  `);
} catch (e) {
  console.error('Failed to cleanup bilingual names:', e);
}

// Ensure settings exist for household-1
try {
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings WHERE household_id = ?').get('household-1') as { count: number };
  if (settingsCount.count === 0) {
    db.prepare('INSERT INTO settings (household_id, language, currency) VALUES (?, ?, ?)').run('household-1', 'en', 'USD');
  }
} catch (e) {
  console.error(e);
}

// Seed default data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const userId = 'user-1';
  const householdId = 'household-1';
  
  db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)').run(userId, 'Default User', 'user@example.com');
  db.prepare('INSERT INTO households (id, name) VALUES (?, ?)').run(householdId, 'My Home');
  db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId, 'admin');
  db.prepare('INSERT INTO settings (household_id, language, currency) VALUES (?, ?, ?)').run(householdId, 'en', 'USD');

  // Seed categories
  const categories = ['Groceries', 'Cleaning Supplies', 'Toiletries', 'Medicine', 'Home Maintenance'];
  const insertCategory = db.prepare('INSERT INTO categories (id, name) VALUES (?, ?)');
  categories.forEach((cat, index) => {
    insertCategory.run(`cat-${index + 1}`, cat);
  });

  // Seed locations
  const locations = ['Kitchen Pantry', 'Fridge', 'Master Bathroom', 'Laundry Room', 'Utility Closet', 'Bedroom', 'Wardrobe', 'Storage Room'];
  const insertLocation = db.prepare('INSERT INTO locations (id, household_id, name) VALUES (?, ?, ?)');
  locations.forEach((loc, index) => {
    insertLocation.run(`loc-${index + 1}`, householdId, loc);
  });
}

// Seed Smart Presets if empty
const presetCount = db.prepare('SELECT COUNT(*) as count FROM smart_presets').get() as { count: number };
if (presetCount.count === 0) {
  const presets = [
    { id: 'p-1', name: 'Toothbrush', category_id: 'cat-3', type: 'consumable', days: 90 },
    { id: 'p-2', name: 'Kitchen Sponge', category_id: 'cat-2', type: 'consumable', days: 14 },
    { id: 'p-3', name: 'Water Filter', category_id: 'cat-1', type: 'consumable', days: 60 },
    { id: 'p-4', name: 'Wash Bedsheets', category_id: 'cat-5', type: 'maintenance', days: 14 },
    { id: 'p-5', name: 'Clean AC Filter', category_id: 'cat-5', type: 'maintenance', days: 180 },
    { id: 'p-6', name: 'Replace Smoke Alarm Batteries', category_id: 'cat-5', type: 'maintenance', days: 365 },
    { id: 'p-7', name: 'Bath Towel', category_id: 'cat-3', type: 'consumable', days: 365 },
  ];
  const insertPreset = db.prepare('INSERT INTO smart_presets (id, name, category_id, lifecycle_type, lifecycle_interval_days) VALUES (?, ?, ?, ?, ?)');
  presets.forEach(p => {
    insertPreset.run(p.id, p.name, p.category_id, p.type, p.days);
  });
}

export default db;
