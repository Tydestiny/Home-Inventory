import express from 'express';
import { createServer as createViteServer } from 'vite';
import db from './src/db/index.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  const GET_ITEM_QUERY = `
    SELECT items.*, categories.name as category_name, locations.name as location_name
    FROM items
    LEFT JOIN categories ON items.category_id = categories.id
    LEFT JOIN locations ON items.location_id = locations.id
    WHERE items.id = ?
  `;

  // Notifications API
  app.get('/api/notifications', (req, res) => {
    try {
      const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
      res.json(notifications);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.put('/api/notifications/:id/read', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Items API
  app.get('/api/items', (req, res) => {
    try {
      const items = db.prepare(`
        SELECT items.*, categories.name as category_name, locations.name as location_name
        FROM items
        LEFT JOIN categories ON items.category_id = categories.id
        LEFT JOIN locations ON items.location_id = locations.id
        ORDER BY items.updated_at DESC
      `).all();
      res.json(items);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  });

  app.post('/api/items', (req, res) => {
    const {
      name, category_id, location_id, purpose, storage_method,
      quantity, expiration_date, restock_frequency_days,
      alert_threshold, notes, barcode,
      lifecycle_type = 'perishable', lifecycle_interval_days, last_action_date
    } = req.body;

    const id = `item-${Date.now()}`;
    const household_id = 'household-1'; // Default for MVP

    let next_action_date = null;
    if (lifecycle_type === 'perishable' && expiration_date) {
      next_action_date = expiration_date;
    } else if ((lifecycle_type === 'consumable' || lifecycle_type === 'maintenance') && last_action_date && lifecycle_interval_days) {
      const date = new Date(last_action_date);
      date.setDate(date.getDate() + parseInt(lifecycle_interval_days));
      next_action_date = date.toISOString().split('T')[0];
    }

    // Default alert threshold logic
    let finalThreshold = alert_threshold;
    if (finalThreshold === undefined || finalThreshold === null) {
      finalThreshold = lifecycle_type === 'consumable' ? 2 : 5;
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO items (
          id, household_id, location_id, category_id,
          name, purpose, storage_method,
          quantity, expiration_date, restock_frequency_days,
          alert_threshold, notes, barcode,
          lifecycle_type, lifecycle_interval_days, last_action_date, next_action_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id, household_id, location_id, category_id,
        name, purpose, storage_method,
        quantity, expiration_date, restock_frequency_days,
        finalThreshold, notes, barcode,
        lifecycle_type, lifecycle_interval_days, last_action_date, next_action_date
      );

      const newItem = db.prepare(GET_ITEM_QUERY).get(id);
      res.status(201).json(newItem);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create item' });
    }
  });

  app.put('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const { 
      name, category_id, location_id, quantity, alert_threshold, 
      expiration_date, notes, lifecycle_type, 
      lifecycle_interval_days, last_action_date 
    } = req.body;
    
    try {
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
      if (!item) return res.status(404).json({ error: 'Item not found' });

      let next_action_date = item.next_action_date;
      
      // Recalculate next_action_date if lifecycle fields are provided
      if (lifecycle_type === 'perishable' && expiration_date !== undefined) {
        next_action_date = expiration_date;
      } else if ((lifecycle_type === 'consumable' || lifecycle_type === 'maintenance') && last_action_date && lifecycle_interval_days) {
        const date = new Date(last_action_date);
        date.setDate(date.getDate() + parseInt(lifecycle_interval_days));
        next_action_date = date.toISOString().split('T')[0];
      }

      // Build dynamic update query based on provided fields
      const updates = [];
      const values = [];
      
      const addUpdate = (field: string, value: any) => {
        if (value !== undefined) {
          updates.push(`${field} = ?`);
          values.push(value);
        }
      };

      addUpdate('name', name);
      addUpdate('category_id', category_id);
      addUpdate('location_id', location_id);
      addUpdate('quantity', quantity);
      addUpdate('alert_threshold', alert_threshold);
      addUpdate('expiration_date', expiration_date);
      addUpdate('notes', notes);
      addUpdate('lifecycle_type', lifecycle_type);
      addUpdate('lifecycle_interval_days', lifecycle_interval_days);
      addUpdate('last_action_date', last_action_date);
      addUpdate('next_action_date', next_action_date);
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const stmt = db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
      
      const updatedItem = db.prepare(GET_ITEM_QUERY).get(id);
      res.json(updatedItem);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update item' });
    }
  });

  app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete item' });
    }
  });

  app.get('/api/settings', (req, res) => {
    try {
      const settings = db.prepare('SELECT * FROM settings WHERE household_id = ?').get('household-1');
      res.json(settings || { language: 'en', currency: 'USD' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  app.put('/api/settings', (req, res) => {
    const { language, currency } = req.body;
    try {
      db.prepare('UPDATE settings SET language = ?, currency = ? WHERE household_id = ?')
        .run(language, currency, 'household-1');
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  app.post('/api/templates/load', (req, res) => {
    try {
      const household_id = 'household-1';
      const templates = [
        { name: '大米', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, threshold: 5 },
        { name: '生抽', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, threshold: 3 },
        { name: '食用油', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, threshold: 7 },
        { name: '洗脸巾', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 30, qty: 3, threshold: 1 },
        { name: '牙膏', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 60, qty: 2, threshold: 1 },
        { name: '洗发水', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 90, qty: 1, threshold: 1 },
        { name: '空气净化器滤芯', category: 'Home Maintenance', location: 'Living Room', type: 'maintenance', interval: 180, qty: 1, threshold: 0 },
        { name: '电蚊香液', category: 'Home Maintenance', location: 'Living Room', type: 'consumable', interval: 30, qty: 2, threshold: 1 },
        { name: '净水器滤芯', category: 'Home Maintenance', location: 'Kitchen', type: 'maintenance', interval: 180, qty: 1, threshold: 0 },
        { name: '洗洁精', category: 'Cleaning Supplies', location: 'Kitchen', type: 'consumable', interval: 60, qty: 1, threshold: 1 },
        { name: '洗衣液', category: 'Cleaning Supplies', location: 'Laundry Room', type: 'consumable', interval: 60, qty: 1, threshold: 1 },
        { name: '垃圾袋', category: 'Cleaning Supplies', location: 'Kitchen', type: 'consumable', interval: 30, qty: 5, threshold: 2 },
        { name: '卫生纸', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 30, qty: 12, threshold: 4 },
        { name: '盐', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 2, threshold: 3 },
        { name: '醋', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, threshold: 3 },
        { name: '料酒', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, threshold: 3 },
        { name: '沐浴露', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 90, qty: 1, threshold: 1 },
        { name: '洗手液', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 60, qty: 2, threshold: 1 },
        { name: '拖把头', category: 'Cleaning Supplies', location: 'Laundry Room', type: 'maintenance', interval: 90, qty: 1, threshold: 0 },
        { name: '电池', category: 'Home Maintenance', location: 'Living Room', type: 'consumable', interval: 180, qty: 8, threshold: 2 }
      ];

      const categories = db.prepare('SELECT id, name FROM categories').all() as any[];
      const locations = db.prepare('SELECT id, name FROM locations').all() as any[];
      
      const getCatId = (name: string) => categories.find(c => c.name === name)?.id || categories[0]?.id;
      const getLocId = (name: string) => locations.find(l => l.name === name)?.id || locations[0]?.id;

      const stmt = db.prepare(`
        INSERT INTO items (
          id, household_id, location_id, category_id, name, quantity, alert_threshold,
          lifecycle_type, lifecycle_interval_days, last_action_date, next_action_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      db.transaction(() => {
        for (const t of templates) {
          const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const catId = getCatId(t.category);
          const locId = getLocId(t.location);

          let nextDate = null;
          if (t.type !== 'perishable') {
            const d = new Date(today);
            d.setDate(d.getDate() + t.interval);
            nextDate = d.toISOString().split('T')[0];
          } else {
            const d = new Date(today);
            d.setDate(d.getDate() + 7); // expires in 7 days
            nextDate = d.toISOString().split('T')[0];
          }

          stmt.run(id, household_id, locId, catId, t.name, t.qty, t.threshold, t.type, t.interval, todayStr, nextDate);
        }
      })();

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load template' });
    }
  });

  // Reference Data APIs
  app.get('/api/categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM categories').all();
    res.json(categories);
  });

  app.get('/api/locations', (req, res) => {
    const locations = db.prepare('SELECT * FROM locations').all();
    res.json(locations);
  });

  app.get('/api/presets', (req, res) => {
    const presets = db.prepare('SELECT * FROM smart_presets').all();
    res.json(presets);
  });

  app.post('/api/items/:id/action', (req, res) => {
    const { id } = req.params;
    try {
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
      if (!item) return res.status(404).json({ error: 'Item not found' });

      const today = new Date();
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + (item.lifecycle_interval_days || 0));
      
      const lastActionStr = today.toISOString().split('T')[0];
      const nextActionStr = nextDate.toISOString().split('T')[0];

      db.transaction(() => {
        db.prepare('UPDATE items SET last_action_date = ?, next_action_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(lastActionStr, nextActionStr, id);

        if ((item.lifecycle_type === 'consumable' || item.lifecycle_type === 'perishable') && item.quantity > 0) {
          db.prepare('UPDATE items SET quantity = quantity - 1 WHERE id = ?').run(id);
        }
      })();

      const updatedItem = db.prepare(GET_ITEM_QUERY).get(id);
      res.json(updatedItem);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to perform action' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
