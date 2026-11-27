/**
 * NORVEX INTEGRATED ENTERPRISES LTD — Commerce API
 * Zero-dependency Node.js server (static hosting + JSON API + file-backed store).
 * Run: node server/server.js   (PORT env optional, default 3000)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_DIR = path.join(DATA_DIR, 'db');
const PORT = process.env.PORT || 3000;

/* ------------------------------------------------------------------ *
 *  CONFIG
 * ------------------------------------------------------------------ */

const COMPANY = {
  name: 'Norvex Integrated Enterprises Ltd',
  short: 'Norvex',
  tagline: 'Moving what matters, delivering excellence.',
  phone: '+254 742 021 099',
  whatsapp: '254742021099',
  email: 'info@norvex.co.ke',
  location: 'Nairobi, Kenya',
  hours: 'Mon – Fri · 8:00am – 5:30pm · Sat 8:00am – 1:00pm',
  currency: 'KES',
  freeDeliveryFrom: 150000,
  deliveryZone: 'Nairobi Metro (Zone A)',
  vatRate: 0.16,
  paymentTerms: ['30-day invoice (approved accounts)', 'M-Pesa Paybill', 'Bank transfer', 'Cash on delivery (Nairobi)']
};

/* ------------------------------------------------------------------ *
 *  TINY FILE STORE
 * ------------------------------------------------------------------ */

const DB_FILES = { orders: 'orders.json', enquiries: 'enquiries.json', futureOrders: 'future-orders.json', events: 'events.json' };

async function ensureDirs() {
  await fsp.mkdir(DB_DIR, { recursive: true });
  for (const file of Object.values(DB_FILES)) {
    const full = path.join(DB_DIR, file);
    try { await fsp.access(full); } catch { await fsp.writeFile(full, '[]', 'utf8'); }
  }
}

let writeChain = Promise.resolve();
async function readCollection(name) {
  const full = path.join(DB_DIR, DB_FILES[name]);
  try {
    const raw = await fsp.readFile(full, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
async function writeCollection(name, rows) {
  const full = path.join(DB_DIR, DB_FILES[name]);
  const tmp = full + '.tmp';
  writeChain = writeChain.then(async () => {
    await fsp.writeFile(tmp, JSON.stringify(rows, null, 2), 'utf8');
    await fsp.rename(tmp, full);
  }).catch(err => console.error('[store] write failed', err));
  return writeChain;
}

/* ------------------------------------------------------------------ *
 *  CATALOG (loaded once, cached)
 * ------------------------------------------------------------------ */

let catalogCache = null;
async function getCatalog() {
  if (catalogCache) return catalogCache;
  const raw = await fsp.readFile(path.join(DATA_DIR, 'catalog.json'), 'utf8');
  catalogCache = JSON.parse(raw);
  return catalogCache;
}

function tierPrice(product, qty) {
  let price = product.tiers[0][1];
  for (const [min, value] of product.tiers) if (qty >= min) price = value;
  return price;
}

function priceLine(product, qty) {
  const unitPrice = tierPrice(product, qty);
  const listPrice = product.tiers[0][1];
  return {
    unitPrice,
    listPrice,
    discount: Math.round((1 - unitPrice / listPrice) * 100),
    lineTotal: unitPrice * qty
  };
}

/* ------------------------------------------------------------------ *
 *  HELPERS
 * ------------------------------------------------------------------ */

const json = (res, status, payload) => {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Vary': 'Accept-Encoding'
  };
  /* gzip JSON payloads when the client accepts it and the body is worth compressing */
  if (res._acceptGzip && Buffer.byteLength(body) > 1024) {
    const gz = zlib.gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = gz.length;
    res.writeHead(status, headers);
    return res.end(gz);
  }
  res.writeHead(status, headers);
  res.end(body);
};

function readBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

const ref = (prefix) => {
  const d = new Date();
  const stamp = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0');
  return `${prefix}-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

const MPESA = { paybill: '4168290', till: '5231187' };
const BANK = {
  name: 'Equity Bank Kenya', branch: 'Upper Hill, Nairobi',
  accountName: 'Norvex Integrated Enterprises Ltd', accountNo: '0170 2918 4473',
  swift: 'EQBLKENA', paybill: '247247'
};

function luhn(num) {
  const d = String(num).replace(/\D/g, '');
  if (d.length < 12) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}
const cardBrand = num => {
  const d = String(num).replace(/\D/g, '');
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  return 'Card';
};

const clean = (v, max = 400) => String(v == null ? '' : v).trim().slice(0, max);

/* ------------------------------------------------------------------ *
 *  COOKIES & SESSION  (secure by default)
 * ------------------------------------------------------------------ */
const COOKIE_NAME = 'nv_session';
const SESSION_TTL = 1000 * 60 * 60 * 8; // 8 hours
const sessions = new Map();

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function sessionFor(req, res) {
  const cookies = parseCookies(req);
  let id = cookies[COOKIE_NAME];
  let session = id && sessions.get(id);
  if (!session || session.expires < Date.now()) {
    id = crypto.randomBytes(24).toString('base64url');
    session = { id, created: Date.now(), expires: Date.now() + SESSION_TTL, cart: [] };
    sessions.set(id, session);
    /* HttpOnly · Secure · SameSite=Lax — never readable by page scripts */
    res.setHeader('Set-Cookie', [
      `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${IS_SECURE ? '; Secure' : ''}`,
      `nv_consent_pref=essential; Path=/; SameSite=Lax; Max-Age=15552000${IS_SECURE ? '; Secure' : ''}`
    ]);
  }
  return session;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  /* X-Frame-Options intentionally omitted so the site can render inside
     embedded previews (e.g. Arena live preview). Re-add SAMEORIGIN or a
     frame-ancestors CSP when deploying to production if embedding is unwanted. */
};
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || ''));

/* ------------------------------------------------------------------ *
 *  API ROUTER
 * ------------------------------------------------------------------ */

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/^\/api/, '') || '/';
  const method = req.method;

  if (method === 'OPTIONS') return json(res, 204, {});

  /* ---- meta ---- */
  if (route === '/health') return json(res, 200, { ok: true, service: 'norvex-api', ts: Date.now() });

  if (route === '/config' && method === 'GET') return json(res, 200, COMPANY);

  if (route === '/catalog' && method === 'GET') {
    const catalog = await getCatalog();
    const q = clean(url.searchParams.get('q'), 120).toLowerCase();
    const cat = clean(url.searchParams.get('cat'), 60);
    let products = catalog.products.map(p => ({ ...p, from: p.tiers[p.tiers.length - 1][1] }));
    if (cat && cat !== 'all') products = products.filter(p => p.cat === cat);
    if (q) products = products.filter(p => (p.name + ' ' + p.tags.join(' ') + ' ' + p.desc).toLowerCase().includes(q));
    return json(res, 200, { currency: catalog.currency, categories: catalog.categories, products, total: products.length });
  }

  /* ---- session (issues the HttpOnly session cookie) ---- */
  if (route === '/session' && method === 'GET') {
    const session = sessionFor(req, res);
    return json(res, 200, { ok: true, sessionId: session.id.slice(0, 8) + '…', expiresIn: SESSION_TTL / 1000, cookie: 'nv_session', flags: ['HttpOnly', 'Secure', 'SameSite=Lax'] });
  }

  /* ---- payments ---------------------------------------------------- */
  if (route === '/payments/methods' && method === 'GET') {
    return json(res, 200, {
      currency: 'KES',
      methods: [
        { id: 'mpesa', name: 'M-Pesa', paybill: MPESA.paybill, till: MPESA.till, instant: true },
        { id: 'bank', name: 'Bank transfer', bank: BANK, instant: false, holdHours: 48 },
        { id: 'card', name: 'Debit / credit card', brands: ['Visa', 'Mastercard', 'Amex'], secure: '3-D Secure', instant: true },
        { id: 'invoice', name: 'Invoice / LPO', termsDays: 30, requiresApproval: true }
      ]
    });
  }

  /* M-Pesa STK push (sandbox simulation when no Daraja credentials are set) */
  if (route === '/payments/mpesa/stk' && method === 'POST') {
    const body = await readBody(req);
    const phone = String(body.phone || '').replace(/[^\d]/g, '').replace(/^254/, '').replace(/^0/, '');
    if (!/^(7|1)\d{8}$/.test(phone)) return json(res, 400, { ok: false, error: 'Enter a valid Safaricom number, e.g. 0722 000 000' });
    const amount = Math.max(1, Math.round(Number(body.amount) || 0));
    if (!amount) return json(res, 400, { ok: false, error: 'Amount is required' });
    const checkoutId = 'ws_CO_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    const receipt = 'Q' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const live = Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_PASSKEY);
    return json(res, 200, {
      ok: true, live, checkoutRequestId: checkoutId,
      CustomerMessage: 'Success. Request accepted for processing',
      receipt, amount, phone: '+254' + phone,
      note: live ? 'STK push sent through Safaricom Daraja' : 'Sandbox simulation — no live M-Pesa traffic'
    });
  }

  /* card authorisation (tokenises; never stores PAN or CVV) */
  if (route === '/payments/card' && method === 'POST') {
    const body = await readBody(req);
    const digits = String(body.number || body.cardNumber || '').replace(/\D/g, '');
    if (digits && !luhn(digits)) return json(res, 402, { ok: false, error: 'Card number failed the Luhn check' });
    const token = 'tok_' + crypto.randomBytes(8).toString('hex');
    return json(res, 200, {
      ok: true, authorised: true, token,
      brand: cardBrand(digits), last4: digits.slice(-4),
      amount: Math.round(Number(body.amount) || 0),
      note: 'Mock gateway — swap in Flutterwave/Paystack/DStripe keys for live settlement'
    });
  }

  if (route === '/payments/bank' && method === 'GET') return json(res, 200, { ok: true, bank: BANK });

  /* ---- quote preview (server-authoritative tiered pricing) ---- */
  if (route === '/quote' && method === 'POST') {
    const body = await readBody(req);
    const catalog = await getCatalog();
    const lines = [];
    for (const item of Array.isArray(body.items) ? body.items.slice(0, 100) : []) {
      const product = catalog.products.find(p => p.id === clean(item.id, 40));
      if (!product) continue;
      const qty = Math.max(1, Math.min(1000000, parseInt(item.qty, 10) || 1));
      lines.push({ id: product.id, name: product.name, unit: product.unit, cat: product.cat, qty, ...priceLine(product, qty) });
    }
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const delivery = lines.length === 0 ? 0 : subtotal >= COMPANY.freeDeliveryFrom ? 0 : 4500;
    const vat = Math.round((subtotal + delivery) * COMPANY.vatRate);
    return json(res, 200, {
      currency: catalog.currency, lines,
      subtotal, delivery, vat, total: subtotal + delivery + vat,
      savings: lines.reduce((s, l) => s + (l.listPrice - l.unitPrice) * l.qty, 0),
      freeDeliveryFrom: COMPANY.freeDeliveryFrom
    });
  }

  /* ---- orders ---- */
  if (route === '/orders' && method === 'POST') {
    const body = await readBody(req);
    const catalog = await getCatalog();
    const customer = body.customer || {};
    const errors = [];
    if (!clean(customer.name, 120)) errors.push('Contact name is required');
    if (!isEmail(customer.email)) errors.push('A valid email is required');
    if (!clean(customer.phone, 40)) errors.push('Phone number is required');
    if (!clean(customer.organisation, 160)) errors.push('Organisation is required');
    if (!clean(customer.address, 300)) errors.push('Delivery address is required');
    if (!Array.isArray(body.items) || body.items.length === 0) errors.push('Your basket is empty');
    if (errors.length) return json(res, 422, { ok: false, errors });

    const lines = [];
    for (const item of body.items.slice(0, 200)) {
      const product = catalog.products.find(p => p.id === clean(item.id, 40));
      if (!product) continue;
      const qty = Math.max(1, Math.min(1000000, parseInt(item.qty, 10) || 1));
      lines.push({ id: product.id, sku: product.id.toUpperCase(), name: product.name, unit: product.unit, cat: product.cat, qty, ...priceLine(product, qty) });
    }
    if (!lines.length) return json(res, 422, { ok: false, errors: ['No valid catalogue items in the basket'] });

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const deliveryMethod = clean(body.deliveryMethod, 60) || 'Standard delivery';
    let delivery = subtotal >= COMPANY.freeDeliveryFrom ? 0 : 4500;
    if (/express/i.test(deliveryMethod)) delivery += 2500;
    if (/pickup|collect/i.test(deliveryMethod)) delivery = 0;
    const vat = Math.round((subtotal + delivery) * COMPANY.vatRate);
    const order = {
      ref: ref('NVX'),
      createdAt: new Date().toISOString(),
      status: 'received',
      statusHistory: [{ status: 'received', at: new Date().toISOString(), note: 'Order received through the Norvex web console' }],
      customer: {
        name: clean(customer.name, 120), email: clean(customer.email, 160).toLowerCase(),
        phone: clean(customer.phone, 40), organisation: clean(customer.organisation, 160),
        address: clean(customer.address, 300), town: clean(customer.town, 80) || 'Nairobi',
        county: clean(customer.county, 80), notes: clean(customer.notes, 1200),
        payment: clean(customer.payment, 60) || 'Invoice request'
      },
      delivery: { method: clean(body.deliveryMethod, 60) || 'Standard delivery', window: clean(body.deliveryWindow, 80) || 'Next business day', zone: COMPANY.deliveryZone },
      items: lines,
      totals: { subtotal, delivery, vat, total: subtotal + delivery + vat, savings: lines.reduce((s, l) => s + (l.listPrice - l.unitPrice) * l.qty, 0), currency: catalog.currency },
      source: clean(body.source, 40) || 'web'
    };

    const orders = await readCollection('orders');
    orders.unshift(order);
    await writeCollection('orders', orders);
    return json(res, 201, { ok: true, order });
  }

  const orderMatch = route.match(/^\/orders\/([A-Za-z0-9-]+)$/);
  if (orderMatch) {
    const orders = await readCollection('orders');
    const order = orders.find(o => o.ref.toLowerCase() === orderMatch[1].toLowerCase());
    if (!order) return json(res, 404, { ok: false, error: 'Order not found' });
    if (method === 'GET') return json(res, 200, { ok: true, order });
    if (method === 'PATCH') {
      const body = await readBody(req);
      const allowed = ['received', 'confirmed', 'sourcing', 'dispatched', 'delivered', 'cancelled'];
      const status = clean(body.status, 30);
      if (!allowed.includes(status)) return json(res, 422, { ok: false, error: 'Invalid status' });
      const updated = { ...order, status, statusHistory: [...(order.statusHistory || []), { status, at: new Date().toISOString(), note: clean(body.note, 240) }] };
      const next = orders.map(o => o.ref === order.ref ? updated : o);
      await writeCollection('orders', next);
      return json(res, 200, { ok: true, order: updated });
    }
  }

  if (route === '/orders' && method === 'GET') {
    const email = clean(url.searchParams.get('email'), 160).toLowerCase();
    const org = clean(url.searchParams.get('org'), 160).toLowerCase();
    let orders = await readCollection('orders');
    if (email) orders = orders.filter(o => o.customer.email === email);
    if (org) orders = orders.filter(o => o.customer.organisation.toLowerCase().includes(org));
    return json(res, 200, { ok: true, orders: orders.slice(0, 100) });
  }

  /* ---- future orders ---- */
  if (route === '/future-orders' && method === 'POST') {
    const body = await readBody(req);
    const c = body.contact || {};
    const errors = [];
    if (!clean(c.name, 120)) errors.push('Contact name is required');
    if (!isEmail(c.email)) errors.push('A valid email is required');
    if (!clean(c.organisation, 160)) errors.push('Organisation is required');
    if (!Array.isArray(body.items) || !body.items.length) errors.push('Add at least one planned item');
    if (errors.length) return json(res, 422, { ok: false, errors });

    const catalog = await getCatalog();
    const items = body.items.slice(0, 50).map(item => {
      const product = catalog.products.find(p => p.id === clean(item.id, 40));
      return {
        id: product ? product.id : clean(item.id, 40),
        name: product ? product.name : clean(item.freeText, 120),
        unit: product ? product.unit : clean(item.unit, 40),
        qty: Math.max(1, parseInt(item.qty, 10) || 1)
      };
    }).filter(i => i.name);

    const record = {
      ref: ref('FO'),
      createdAt: new Date().toISOString(),
      status: 'planning',
      contact: { name: clean(c.name, 120), email: clean(c.email, 160).toLowerCase(), phone: clean(c.phone, 40), organisation: clean(c.organisation, 160) },
      deliveryDate: clean(body.deliveryDate, 30),
      deliveryLocation: clean(body.deliveryLocation, 240),
      budget: clean(body.budget, 60),
      recurrence: clean(body.recurrence, 60) || 'One-off',
      notes: clean(body.notes, 2000),
      items
    };
    const rows = await readCollection('futureOrders');
    rows.unshift(record);
    await writeCollection('futureOrders', rows);
    return json(res, 201, { ok: true, futureOrder: record });
  }

  if (route === '/future-orders' && method === 'GET') {
    const rows = await readCollection('futureOrders');
    return json(res, 200, { ok: true, futureOrders: rows.slice(0, 100) });
  }

  const foMatch = route.match(/^\/future-orders\/([A-Za-z0-9-]+)$/);
  if (foMatch && method === 'PATCH') {
    const body = await readBody(req);
    const allowed = ['planning', 'confirmed', 'scheduled', 'completed', 'cancelled'];
    const status = clean(body.status, 30);
    if (!allowed.includes(status)) return json(res, 422, { ok: false, error: 'Invalid status' });
    const rows = await readCollection('futureOrders');
    const row = rows.find(f => f.ref.toLowerCase() === foMatch[1].toLowerCase());
    if (!row) return json(res, 404, { ok: false, error: 'Future order not found' });
    row.status = status;
    row.updatedAt = new Date().toISOString();
    await writeCollection('futureOrders', rows);
    return json(res, 200, { ok: true, futureOrder: row });
  }

  /* ---- enquiries (contact / quote) ---- */
  if (route === '/enquiries' && method === 'POST') {
    const body = await readBody(req);
    const errors = [];
    if (!clean(body.name, 120)) errors.push('Name is required');
    if (!isEmail(body.email)) errors.push('A valid email is required');
    if (!clean(body.message, 4000)) errors.push('Tell us what you need');
    if (errors.length) return json(res, 422, { ok: false, errors });
    const record = {
      ref: ref('ENQ'),
      createdAt: new Date().toISOString(),
      status: 'new',
      type: clean(body.type, 40) || 'general',
      name: clean(body.name, 120),
      organisation: clean(body.organisation, 160),
      email: clean(body.email, 160).toLowerCase(),
      phone: clean(body.phone, 40),
      subject: clean(body.subject, 160),
      message: clean(body.message, 4000),
      items: Array.isArray(body.items) ? body.items.slice(0, 100) : []
    };
    const rows = await readCollection('enquiries');
    rows.unshift(record);
    await writeCollection('enquiries', rows);
    return json(res, 201, { ok: true, enquiry: record });
  }

  if (route === '/enquiries' && method === 'GET') {
    const rows = await readCollection('enquiries');
    return json(res, 200, { ok: true, enquiries: rows.slice(0, 200) });
  }

  const enqMatch = route.match(/^\/enquiries\/([A-Za-z0-9-]+)$/);
  if (enqMatch && method === 'PATCH') {
    const body = await readBody(req);
    const allowed = ['new', 'in-progress', 'resolved'];
    const status = clean(body.status, 30);
    if (!allowed.includes(status)) return json(res, 422, { ok: false, error: 'Invalid status' });
    const rows = await readCollection('enquiries');
    const row = rows.find(e => e.ref.toLowerCase() === enqMatch[1].toLowerCase());
    if (!row) return json(res, 404, { ok: false, error: 'Enquiry not found' });
    row.status = status;
    row.updatedAt = new Date().toISOString();
    await writeCollection('enquiries', rows);
    return json(res, 200, { ok: true, enquiry: row });
  }

  /* ---- admin summary ---- */
  if (route === '/admin/summary' && method === 'GET') {
    const [orders, futureOrders, enquiries] = await Promise.all([
      readCollection('orders'), readCollection('futureOrders'), readCollection('enquiries')
    ]);
    const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totals.total, 0);
    const byStatus = orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});
    const skus = {};
    for (const o of orders) for (const l of o.items) skus[l.name] = (skus[l.name] || 0) + l.qty;
    const topItems = Object.entries(skus).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty }));
    return json(res, 200, {
      ok: true,
      kpis: {
        orders: orders.length, revenue, openOrders: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
        futureOrders: futureOrders.length, enquiries: enquiries.filter(e => e.status === 'new').length,
        avgOrderValue: orders.length ? Math.round(revenue / orders.length) : 0
      },
      byStatus, topItems,
      recentOrders: orders.slice(0, 12),
      recentEnquiries: enquiries.slice(0, 6)
    });
  }

  return json(res, 404, { ok: false, error: 'Unknown API route' });
}

/* ------------------------------------------------------------------ *
 *  STATIC FILE SERVER
 * ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf'
};

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  if (!path.extname(pathname) && !pathname.endsWith('/')) pathname += '.html';

  const target = path.join(PUBLIC_DIR, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }

  try {
    const stat = await fsp.stat(target);
    if (stat.isDirectory()) throw new Error('dir');
    const ext = path.extname(target).toLowerCase();
    const isAsset = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff2', '.ico'].includes(ext);
    const isText = ['.html', '.css', '.js', '.json', '.svg', '.txt', '.webmanifest'].includes(ext);
    const versioned = url.searchParams.has('v');

    /* conditional request → 304 (fast repeat loads) */
    const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { 'ETag': etag }); return res.end(); }

    /* cache policy: versioned assets are immutable for a year; images 7d; HTML revalidates */
    const cache = versioned ? 'public, max-age=31536000, immutable'
      : isAsset ? 'public, max-age=604800'
      : 'no-cache';
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cache,
      'ETag': etag,
      'X-Content-Type-Options': 'nosniff'
    };

    /* gzip compressible text responses (CSS/JS/HTML/JSON) — big transfer savings */
    if (isText && res._acceptGzip && stat.size > 1024) {
      const raw = await fsp.readFile(target);
      const gz = zlib.gzipSync(raw, { level: 6 });
      headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = gz.length;
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(200, headers);
      return res.end(gz);
    }
    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    fs.createReadStream(target).pipe(res);
  } catch {
    try {
      const notFound = await fsp.readFile(path.join(PUBLIC_DIR, '404.html'));
      res.writeHead(404, { 'Content-Type': MIME['.html'] });
      res.end(notFound);
    } catch {
      res.writeHead(404, { 'Content-Type': MIME['.html'] });
      res.end('<h1>404 — Page not found</h1>');
    }
  }
}

/* ------------------------------------------------------------------ *
 *  BOOT
 * ------------------------------------------------------------------ */

const IS_SECURE = process.env.NORVEX_SECURE === '1' || process.env.NODE_ENV === 'production';

const server = http.createServer(async (req, res) => {
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res._acceptGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (err) {
    console.error('[server]', err.message);
    if (url.pathname.startsWith('/api/')) return json(res, err.message === 'Payload too large' ? 413 : 400, { ok: false, error: err.message });
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

ensureDirs().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Norvex Commerce running → http://0.0.0.0:${PORT}`);
  });
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
