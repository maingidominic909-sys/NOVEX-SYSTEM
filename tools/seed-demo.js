/* NORVEX v2 — seed realistic demo records so the console and demo account
   have history to explore. Prices come from data/catalog.json (same tier
   engine as the server). Run: node tools/seed-demo.js [--force] */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB = path.join(ROOT, 'data', 'db');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
const force = process.argv.includes('--force');

const tierPrice = (p, qty) => { let v = p.tiers[0][1]; for (const [min, price] of p.tiers) if (qty >= min) v = price; return v; };
const P = id => catalog.products.find(p => p.id === id);
const daysAgo = (n, h = 9, m = 30) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, m, 0, 0); return d.toISOString(); };
const hoursAfter = (iso, h) => new Date(new Date(iso).getTime() + h * 3600e3).toISOString();

function order(ref, created, status, customer, items, deliveryMethod, payment, historyNotes) {
  const lines = items.map(([id, qty]) => {
    const p = P(id);
    const unitPrice = tierPrice(p, qty);
    return { id, sku: id.toUpperCase(), name: p.name, unit: p.unit, cat: p.cat, qty, unitPrice, listPrice: p.tiers[0][1], discount: Math.round((1 - unitPrice / p.tiers[0][1]) * 100), lineTotal: unitPrice * qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  let delivery = subtotal >= 150000 ? 0 : 4500;
  if (/express/i.test(deliveryMethod)) delivery += 2500;
  const vat = Math.round((subtotal + delivery) * 0.16);
  const flow = ['received', 'confirmed', 'sourcing', 'dispatched', 'delivered'];
  const upto = flow.indexOf(status);
  const gaps = [0, 3, 20, 44, 70];
  const statusHistory = flow.slice(0, upto + 1).map((s, i) => ({
    status: s, at: hoursAfter(created, gaps[i]),
    note: (historyNotes && historyNotes[s]) || {
      received: 'Order received through the Norvex web console',
      confirmed: 'Availability and tier pricing confirmed by the desk',
      sourcing: 'Goods sourced and packed against the order sheet',
      dispatched: 'Loaded for delivery — driver assigned',
      delivered: 'Delivered and signed for at the receiving store'
    }[s]
  }));
  return {
    ref, createdAt: created, status, statusHistory, customer,
    delivery: { method: deliveryMethod, window: /express/i.test(deliveryMethod) ? 'Same day' : 'Next business day', zone: 'Nairobi Metro (Zone A)' },
    items: lines,
    totals: { subtotal, delivery, vat, total: subtotal + delivery + vat, savings: lines.reduce((s, l) => s + (l.listPrice - l.unitPrice) * l.qty, 0), currency: 'KES' },
    source: 'demo-seed'
  };
}

const DEMO = { name: 'Grace Wanjiru', email: 'demo@norvex.co.ke', phone: '+254742021099', organisation: 'Kiambu County Referral Hospital', address: 'Hospital Road, Kiambu Town', town: 'Kiambu', county: 'Kiambu', notes: 'Deliver to the main store, gate B.', payment: 'Invoice / LPO' };

const orders = [
  order('NVX-2611-K4F2A8', daysAgo(10), 'delivered', { ...DEMO }, [['nvx-fd-001', 40], ['nvx-fd-012', 20], ['nvx-fd-011', 20]], 'Standard delivery', 'Invoice / LPO'),
  order('NVX-2611-M9C31B', daysAgo(7, 11), 'delivered',
    { name: 'James Mwangi', email: 'bursar@brookside.ac.ke', phone: '+254722114455', organisation: 'Brookside Academy', address: 'Limuru Road, Campus Store', town: 'Limuru', county: 'Kiambu', notes: 'Term 3 stationery allocation.', payment: 'M-Pesa' },
    [['nvx-of-001', 200], ['nvx-in-001', 50], ['nvx-of-002', 25]], 'Standard delivery', 'M-Pesa'),
  order('NVX-2611-P2D77E', daysAgo(4, 14), 'dispatched', { ...DEMO, notes: 'Site store, Thika Road works.', payment: 'Bank transfer' },
    [['nvx-sf-002', 25], ['nvx-sf-001', 50], ['nvx-sf-004', 10], ['nvx-sf-003', 50]], 'Standard delivery', 'Bank transfer'),
  order('NVX-2611-R8B52C', daysAgo(2, 10), 'sourcing', { ...DEMO },
    [['nvx-fd-012', 50], ['nvx-fd-001', 20], ['nvx-wt-001', 50]], 'Standard delivery', 'Invoice / LPO'),
  order('NVX-2611-T5E90D', daysAgo(0, 8, 45), 'received',
    { name: 'Amina Noor', email: 'ops@mwangaza.org', phone: '+254733998877', organisation: 'Mwangaza NGO', address: 'Ngong Lane, Kilimani', town: 'Nairobi', county: 'Nairobi', notes: 'ICT refresh for the new field office.', payment: 'Card' },
    [['nvx-it-001', 5], ['nvx-it-002', 2], ['nvx-it-004', 4]], 'Express delivery', 'Card'),
  order('NVX-2611-W1A46F', daysAgo(0, 12, 10), 'received', { ...DEMO, payment: 'M-Pesa' },
    [['nvx-of-001', 50], ['nvx-of-004', 10]], 'Standard delivery', 'M-Pesa')
];

const enquiries = [
  {
    ref: 'ENQ-2611-Q7D21C', createdAt: daysAgo(1, 15), status: 'new', type: 'quote',
    name: 'Peter Kariuki', organisation: 'County Government of Kajiado', email: 'supply@kajiado.go.ke', phone: '+254720556644',
    subject: 'Quotation request — 4 lines', message: 'Please quote for the quarterly health-facilities replenishment:\n60 × Safety Boots (pair)\n40 × First Aid Kits (kit)\n120 × Hygiene Supplies (carton)\n30 × Cleaning Chemicals (20L jerrycan)\nDelivery to Kajiado town stores. LPO will follow.',
    items: [{ id: 'nvx-sf-002', name: 'Safety Boots', unit: 'pair', qty: 60 }, { id: 'nvx-sf-004', name: 'First Aid Kits', unit: 'kit', qty: 40 }, { id: 'nvx-cl-003', name: 'Hygiene Supplies', unit: 'carton', qty: 120 }, { id: 'nvx-cl-001', name: 'Cleaning Chemicals', unit: '20L jerrycan', qty: 30 }]
  },
  {
    ref: 'ENQ-2611-H3B88A', createdAt: daysAgo(3, 9), status: 'new', type: 'general',
    name: 'Dr. Faith Otieno', organisation: 'Afya Bora Clinic', email: 'admin@afyabora.co.ke', phone: '+254711223344',
    subject: 'Custom sourcing', message: 'Do you source examination couches and medical-grade screening curtains? We are opening a second branch in Ruiru next month and need a consolidated quotation with delivery.',
    items: []
  }
];

const futureOrders = [
  {
    ref: 'FO-2611-C6E41D', createdAt: daysAgo(5, 13), status: 'planning',
    contact: { name: DEMO.name, email: DEMO.email, phone: DEMO.phone, organisation: DEMO.organisation },
    deliveryDate: new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10),
    deliveryLocation: 'Main store, gate B — Kiambu Town', budget: 'KES 100K – 500K', recurrence: 'Monthly',
    notes: 'Standing monthly feeding-programme cycle. Confirm stock a week before each delivery.',
    items: [
      { id: 'nvx-fd-001', name: 'Beans', unit: '50kg bag', qty: 30 },
      { id: 'nvx-fd-012', name: 'Rice', unit: '25kg bag', qty: 40 },
      { id: 'nvx-fd-011', name: 'Maize Grain', unit: '90kg bag', qty: 25 }
    ]
  }
];

function writeIfEmpty(file, rows) {
  const full = path.join(DB, file);
  const existing = fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf8') || '[]') : [];
  if (existing.length && !force) { console.log(`skip ${file} (${existing.length} records exist — use --force to replace)`); return; }
  fs.writeFileSync(full, JSON.stringify(rows, null, 2));
  console.log(`seeded ${file}: ${rows.length} records`);
}

fs.mkdirSync(DB, { recursive: true });
if (force) {
  fs.writeFileSync(path.join(DB, 'orders.json'), '[]');
  fs.writeFileSync(path.join(DB, 'enquiries.json'), '[]');
  fs.writeFileSync(path.join(DB, 'future-orders.json'), '[]');
}
writeIfEmpty('orders.json', orders);
writeIfEmpty('enquiries.json', enquiries);
writeIfEmpty('future-orders.json', futureOrders);
console.log('Demo data ready. Sign in as demo@norvex.co.ke / Norvex2026 to see the buyer side, admin@norvex.co.ke for operations.');
