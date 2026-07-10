const express = require('express');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BASE_DATA_PATH = path.join(__dirname, 'may_2026_data.json');
const STORED_SALES_DIR = path.join(__dirname, 'data');
const STORED_SALES_PATH = path.join(STORED_SALES_DIR, 'sales_stored.json');
const STORED_PURCHASES_PATH = path.join(STORED_SALES_DIR, 'purchases_stored.json');

// Ensure storage directory exists
if (!fs.existsSync(STORED_SALES_DIR)) {
  fs.mkdirSync(STORED_SALES_DIR, { recursive: true });
}

// Ensure stored files exist
if (!fs.existsSync(STORED_SALES_PATH)) {
  fs.writeFileSync(STORED_SALES_PATH, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(STORED_PURCHASES_PATH)) {
  fs.writeFileSync(STORED_PURCHASES_PATH, JSON.stringify([], null, 2), 'utf8');
}

const MONGODB_URI = process.env.MONGODB_URI;
let db = null;
let client = null;

if (MONGODB_URI) {
  MongoClient.connect(MONGODB_URI)
    .then(conn => {
      client = conn;
      db = conn.db();
      console.log('Successfully connected to MongoDB Atlas');
    })
    .catch(err => {
      console.error('Failed to connect to MongoDB Atlas:', err);
    });
} else {
  console.log('MONGODB_URI not set. Falling back to local JSON file storage.');
}

// Helper to read initial + stored data (async to support MongoDB)
async function getCombinedData() {
  let baseData = { purchases: [], sales: [] };
  try {
    if (fs.existsSync(BASE_DATA_PATH)) {
      baseData = JSON.parse(fs.readFileSync(BASE_DATA_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading baseline data:', err);
  }

  let storedSales = [];
  let storedPurchases = [];

  if (db) {
    try {
      storedSales = await db.collection('sales').find({}).project({ _id: 0 }).toArray();
      storedPurchases = await db.collection('purchases').find({}).project({ _id: 0 }).toArray();
    } catch (err) {
      console.error('Error reading from MongoDB:', err);
    }
  } else {
    try {
      if (fs.existsSync(STORED_SALES_PATH)) {
        storedSales = JSON.parse(fs.readFileSync(STORED_SALES_PATH, 'utf8'));
      }
    } catch (err) {
      console.error('Error reading stored sales:', err);
    }

    try {
      if (fs.existsSync(STORED_PURCHASES_PATH)) {
        storedPurchases = JSON.parse(fs.readFileSync(STORED_PURCHASES_PATH, 'utf8'));
      }
    } catch (err) {
      console.error('Error reading stored purchases:', err);
    }
  }

  // Combine sales and purchases
  return {
    purchases: [...(baseData.purchases || []), ...storedPurchases],
    sales: [...(baseData.sales || []), ...storedSales]
  };
}

// API: Get combined data
app.get('/api/data', async (req, res) => {
  try {
    const data = await getCombinedData();
    res.json(data);
  } catch (err) {
    console.error('Error in /api/data:', err);
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

// API: Get historical data (FY 2025-2026)
app.get('/api/historical', (req, res) => {
  try {
    const historicalPath = path.join(__dirname, 'data_2025_2026.json');
    if (fs.existsSync(historicalPath)) {
      const data = JSON.parse(fs.readFileSync(historicalPath, 'utf8'));
      res.json(data);
    } else {
      res.status(404).json({ error: 'Historical data file not found' });
    }
  } catch (err) {
    console.error('Error reading historical data:', err);
    res.status(500).json({ error: 'Failed to read historical data' });
  }
});

// API: Post new sale
app.post('/api/sales', async (req, res) => {
  const { Customer, Date: dateStr, Net_Amount, Customer_Type } = req.body;

  if (!Customer || !dateStr || isNaN(Net_Amount) || Net_Amount <= 0) {
    return res.status(400).json({ error: 'Invalid customer, date, or sale amount.' });
  }

  const combinedData = await getCombinedData();
  
  // Find highest voucher code (e.g. GS438) and increment it
  let maxVoucherNum = 438; // Default fallback
  combinedData.sales.forEach(sale => {
    if (sale.Voucher && typeof sale.Voucher === 'string' && sale.Voucher.startsWith('GS')) {
      const num = parseInt(sale.Voucher.replace('GS', ''), 10);
      if (!isNaN(num) && num > maxVoucherNum) {
        maxVoucherNum = num;
      }
    }
  });
  const newVoucher = `GS${maxVoucherNum + 1}`;

  // Determine season based on target month
  const dateObj = new Date(dateStr);
  const monthIndex = dateObj.getMonth();
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let monthStr = req.body.Month;
  if (!monthStr && !isNaN(dateObj.getTime())) {
    monthStr = `${monthNames[monthIndex]} ${dateObj.getFullYear()}`;
  }

  const targetMonthName = monthStr ? monthStr.split(' ')[0] : 'June';
  const targetMonthIdx = monthNames.indexOf(targetMonthName);

  let season = 'Summer (Low Demand)';
  if (targetMonthIdx >= 5 && targetMonthIdx <= 9) {
    season = 'Kharif (High Demand)';
  } else if (targetMonthIdx === 10 || targetMonthIdx === 11 || targetMonthIdx === 0 || targetMonthIdx === 1) {
    season = 'Rabi (Moderate Demand)';
  } else {
    season = 'Summer (Low Demand)';
  }

  const newSale = {
    Customer,
    Date: dateStr,
    Voucher: newVoucher,
    Net_Amount: parseFloat(Net_Amount),
    Month: monthStr,
    Season: season,
    Customer_Type: Customer_Type || 'Retailer/Wholesaler'
  };

  try {
    if (db) {
      await db.collection('sales').insertOne(newSale);
    } else {
      const storedSales = JSON.parse(fs.readFileSync(STORED_SALES_PATH, 'utf8'));
      storedSales.push(newSale);
      fs.writeFileSync(STORED_SALES_PATH, JSON.stringify(storedSales, null, 2), 'utf8');
    }
    res.status(201).json(newSale);
  } catch (err) {
    console.error('Error saving new sale:', err);
    res.status(500).json({ error: 'Failed to save sale on server.' });
  }
});

// API: Post new purchase
app.post('/api/purchases', async (req, res) => {
  const { Supplier, Date: dateStr, Invoice, Net_Amount, Type, Month } = req.body;

  if (!Supplier || !dateStr || !Invoice || isNaN(Net_Amount) || Net_Amount <= 0) {
    return res.status(400).json({ error: 'Invalid supplier, date, invoice, or purchase amount.' });
  }

  const combinedData = await getCombinedData();
  
  // Find highest voucher code (e.g. GP11) and increment it
  let maxVoucherNum = 11; // Default fallback for GP
  combinedData.purchases.forEach(pur => {
    if (pur.Voucher && typeof pur.Voucher === 'string' && pur.Voucher.startsWith('GP')) {
      const num = parseInt(pur.Voucher.replace('GP', ''), 10);
      if (!isNaN(num) && num > maxVoucherNum) {
        maxVoucherNum = num;
      }
    }
  });
  const newVoucher = `GP${maxVoucherNum + 1}`;

  // Determine season based on target month
  const dateObj = new Date(dateStr);
  const monthIndex = dateObj.getMonth();
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let monthStr = Month;
  if (!monthStr && !isNaN(dateObj.getTime())) {
    monthStr = `${monthNames[monthIndex]} ${dateObj.getFullYear()}`;
  }

  const targetMonthName = monthStr ? monthStr.split(' ')[0] : 'June';
  const targetMonthIdx = monthNames.indexOf(targetMonthName);

  let season = 'Summer (Low Demand)';
  if (targetMonthIdx >= 5 && targetMonthIdx <= 9) {
    season = 'Kharif (High Demand)';
  } else if (targetMonthIdx === 10 || targetMonthIdx === 11 || targetMonthIdx === 0 || targetMonthIdx === 1) {
    season = 'Rabi (Moderate Demand)';
  } else {
    season = 'Summer (Low Demand)';
  }

  const newPurchase = {
    Supplier,
    Date: dateStr,
    Voucher: newVoucher,
    Invoice,
    Net_Amount: parseFloat(Net_Amount),
    Type: Type || 'Within State',
    Month: monthStr,
    Season: season
  };

  try {
    if (db) {
      await db.collection('purchases').insertOne(newPurchase);
    } else {
      const storedPurchases = JSON.parse(fs.readFileSync(STORED_PURCHASES_PATH, 'utf8'));
      storedPurchases.push(newPurchase);
      fs.writeFileSync(STORED_PURCHASES_PATH, JSON.stringify(storedPurchases, null, 2), 'utf8');
    }
    res.status(201).json(newPurchase);
  } catch (err) {
    console.error('Error saving new purchase:', err);
    res.status(500).json({ error: 'Failed to save purchase on server.' });
  }
});

// API: Delete a sale by Voucher code
app.delete('/api/sales/:voucher', async (req, res) => {
  const { voucher } = req.params;
  try {
    if (db) {
      const result = await db.collection('sales').deleteOne({ Voucher: voucher });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Sale record not found.' });
      }
    } else {
      const storedSales = JSON.parse(fs.readFileSync(STORED_SALES_PATH, 'utf8'));
      const index = storedSales.findIndex(s => s.Voucher === voucher);
      if (index === -1) {
        return res.status(404).json({ error: 'Sale record not found.' });
      }
      storedSales.splice(index, 1);
      fs.writeFileSync(STORED_SALES_PATH, JSON.stringify(storedSales, null, 2), 'utf8');
    }
    res.json({ message: 'Sale deleted successfully.' });
  } catch (err) {
    console.error('Error deleting sale:', err);
    res.status(500).json({ error: 'Failed to delete sale on server.' });
  }
});

// API: Delete a purchase by Voucher code
app.delete('/api/purchases/:voucher', async (req, res) => {
  const { voucher } = req.params;
  try {
    if (db) {
      const result = await db.collection('purchases').deleteOne({ Voucher: voucher });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Purchase record not found.' });
      }
    } else {
      const storedPurchases = JSON.parse(fs.readFileSync(STORED_PURCHASES_PATH, 'utf8'));
      const index = storedPurchases.findIndex(p => p.Voucher === voucher);
      if (index === -1) {
        return res.status(404).json({ error: 'Purchase record not found.' });
      }
      storedPurchases.splice(index, 1);
      fs.writeFileSync(STORED_PURCHASES_PATH, JSON.stringify(storedPurchases, null, 2), 'utf8');
    }
    res.json({ message: 'Purchase deleted successfully.' });
  } catch (err) {
    console.error('Error deleting purchase:', err);
    res.status(500).json({ error: 'Failed to delete purchase on server.' });
  }
});

// Serve frontend fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
