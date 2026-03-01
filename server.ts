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
      current_price, store_link, barcode,
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

    try {
      const stmt = db.prepare(`
        INSERT INTO items (
          id, household_id, location_id, category_id,
          name, purpose, storage_method,
          quantity, expiration_date, restock_frequency_days,
          current_price, store_link, barcode,
          lifecycle_type, lifecycle_interval_days, last_action_date, next_action_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id, household_id, location_id, category_id,
        name, purpose, storage_method,
        quantity, expiration_date, restock_frequency_days,
        current_price, store_link, barcode,
        lifecycle_type, lifecycle_interval_days, last_action_date, next_action_date
      );

      if (current_price !== undefined && current_price !== null) {
        db.prepare('INSERT INTO price_history (id, item_id, price) VALUES (?, ?, ?)')
          .run(`ph-${Date.now()}`, id, current_price);
      }
      
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
      name, category_id, location_id, quantity, current_price, 
      expiration_date, store_link, lifecycle_type, 
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
      addUpdate('current_price', current_price);
      addUpdate('expiration_date', expiration_date);
      addUpdate('store_link', store_link);
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

      if (current_price !== undefined && current_price !== item.current_price) {
        db.prepare('INSERT INTO price_history (id, item_id, price) VALUES (?, ?, ?)')
          .run(`ph-${Date.now()}`, id, current_price);
      }
      
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

  app.get('/api/items/:id/price-history', (req, res) => {
    const { id } = req.params;
    try {
      const history = db.prepare('SELECT * FROM price_history WHERE item_id = ? ORDER BY recorded_at ASC').all(id);
      res.json(history);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch price history' });
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

  app.post('/api/simulate-prices', (req, res) => {
    try {
      const items = db.prepare('SELECT id, current_price FROM items WHERE current_price IS NOT NULL AND current_price > 0').all() as any[];
      const updateStmt = db.prepare('UPDATE items SET current_price = ? WHERE id = ?');
      
      db.transaction(() => {
        for (const item of items) {
          // Fluctuate price by +/- 5%
          const change = 1 + (Math.random() * 0.1 - 0.05);
          const newPrice = (item.current_price * change).toFixed(2);
          updateStmt.run(newPrice, item.id);
          db.prepare('INSERT INTO price_history (id, item_id, price) VALUES (?, ?, ?)')
            .run(`ph-${Date.now()}-${Math.random()}`, item.id, newPrice);
        }
      })();
      
      res.json({ success: true, count: items.length });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to simulate prices' });
    }
  });

  app.post('/api/templates/load', (req, res) => {
    try {
      const household_id = 'household-1';
      const templates = [
        { name: '大米 (Rice)', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, price: 59.90 },
        { name: '生抽 (Soy Sauce)', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, price: 15.50 },
        { name: '食用油 (Cooking Oil)', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, price: 89.90 },
        { name: '洗脸巾 (Facial Towels)', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 30, qty: 3, price: 19.90 },
        { name: '牙膏 (Toothpaste)', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 60, qty: 2, price: 25.00 },
        { name: '洗发水 (Shampoo)', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 90, qty: 1, price: 45.00 },
        { name: '空气净化器滤芯 (Air Purifier Filter)', category: 'Home Maintenance', location: 'Living Room', type: 'maintenance', interval: 180, qty: 1, price: 199.00 },
        { name: '电蚊香液 (Mosquito Repellent)', category: 'Home Maintenance', location: 'Living Room', type: 'consumable', interval: 30, qty: 2, price: 29.90 },
        { name: '净水器滤芯 (Water Filter)', category: 'Home Maintenance', location: 'Kitchen', type: 'maintenance', interval: 180, qty: 1, price: 299.00 },
        { name: '洗洁精 (Dish Soap)', category: 'Cleaning Supplies', location: 'Kitchen', type: 'consumable', interval: 60, qty: 1, price: 12.90 },
        { name: '洗衣液 (Laundry Detergent)', category: 'Cleaning Supplies', location: 'Laundry Room', type: 'consumable', interval: 60, qty: 1, price: 49.90 },
        { name: '垃圾袋 (Trash Bags)', category: 'Cleaning Supplies', location: 'Kitchen', type: 'consumable', interval: 30, qty: 5, price: 9.90 },
        { name: '卫生纸 (Toilet Paper)', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 30, qty: 12, price: 35.90 },
        { name: '盐 (Salt)', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 2, price: 3.50 },
        { name: '醋 (Vinegar)', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, price: 12.00 },
        { name: '料酒 (Cooking Wine)', category: 'Groceries', location: 'Kitchen', type: 'perishable', interval: 0, qty: 1, price: 9.90 },
        { name: '沐浴露 (Body Wash)', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 90, qty: 1, price: 39.90 },
        { name: '洗手液 (Hand Soap)', category: 'Toiletries', location: 'Bathroom', type: 'consumable', interval: 60, qty: 2, price: 15.90 },
        { name: '拖把头 (Mop Head)', category: 'Cleaning Supplies', location: 'Laundry Room', type: 'maintenance', interval: 90, qty: 1, price: 25.00 },
        { name: '电池 (Batteries AA)', category: 'Home Maintenance', location: 'Living Room', type: 'consumable', interval: 180, qty: 8, price: 19.90 }
      ];

      const categories = db.prepare('SELECT id, name FROM categories').all() as any[];
      const locations = db.prepare('SELECT id, name FROM locations').all() as any[];
      
      const getCatId = (name: string) => categories.find(c => c.name === name)?.id || categories[0]?.id;
      const getLocId = (name: string) => locations.find(l => l.name === name)?.id || locations[0]?.id;

      const stmt = db.prepare(`
        INSERT INTO items (
          id, household_id, location_id, category_id, name, quantity, current_price,
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

          stmt.run(id, household_id, locId, catId, t.name, t.qty, t.price, t.type, t.interval, todayStr, nextDate);
          db.prepare('INSERT INTO price_history (id, item_id, price) VALUES (?, ?, ?)')
            .run(`ph-${Date.now()}-${Math.random()}`, id, t.price);
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

      if (item.lifecycle_type === 'perishable') {
        return res.status(400).json({ error: 'Cannot perform action on perishable item' });
      }

      const today = new Date();
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + (item.lifecycle_interval_days || 0));
      
      const lastActionStr = today.toISOString().split('T')[0];
      const nextActionStr = nextDate.toISOString().split('T')[0];

      db.prepare('UPDATE items SET last_action_date = ?, next_action_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(lastActionStr, nextActionStr, id);

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
