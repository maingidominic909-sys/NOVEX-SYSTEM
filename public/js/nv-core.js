/* =========================================================
   NORVEX CORE — shared runtime for every page
   • formatting • icons • API client (with offline fallback)
   • supply-basket store • tiered pricing engine • toasts
   ========================================================= */
(function (global) {
  'use strict';

  const CONFIG = {
    name: 'Norvex Integrated Enterprises Ltd',
    phone: '+254 742 021 099',
    phoneRaw: '+254742021099',
    whatsapp: '254742021099',
    email: 'info@norvex.co.ke',
    location: 'Nairobi, Kenya',
    hours: 'Mon–Fri · 8:00am – 5:30pm',
    currency: 'KES',
    freeDeliveryFrom: 150000,
    deliveryFee: 4500,
    vatRate: 0.16,
    basketKey: 'norvex.basket.v1',
    favKey: 'norvex.favourites.v1',
    customerKey: 'norvex.customer.v1',
    ordersKey: 'norvex.orders.local.v1'
  };

  /* ---------------- formatting ---------------- */
  const money = (n, opts) => {
    const value = Number(n) || 0;
    return 'KES ' + value.toLocaleString('en-KE', { maximumFractionDigits: 0, minimumFractionDigits: 0, ...(opts || {}) });
  };
  const compact = n => {
    const v = Number(n) || 0;
    if (v >= 1e6) return 'KES ' + (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1e3) return 'KES ' + (v / 1e3).toFixed(0) + 'K';
    return money(v);
  };
  const dateFmt = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const timeFmt = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- icons (inline SVG, currentColor) ---------------- */
  const P = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${d}</svg>`;
  const ICONS = {
    grain: P('<path d="M12 21V9"/><path d="M12 9c0-2 1-4 3-5 1 3 0 5-3 5Z"/><path d="M12 9c0-2-1-4-3-5-1 3 0 5 3 5Z"/><path d="M12 14c0-2 1.4-3.6 3.4-4.2-.2 2.6-1.4 4-3.4 4.2Z"/><path d="M12 14c0-2-1.4-3.6-3.4-4.2.2 2.6 1.4 4 3.4 4.2Z"/><path d="M9 21h6"/>'),
    paper: P('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 16h5"/>'),
    chip: P('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>'),
    chair: P('<path d="M7 4h10v9H7z"/><path d="M5 13h14v4H5z"/><path d="M8 17v4M16 17v4"/>'),
    spray: P('<path d="M9 8h6v12H9z"/><path d="M10 8V5h4v3"/><path d="M16 6h3M16 9h2M17 12h2"/><path d="M12 12v4"/>'),
    school: P('<path d="M3 9.5 12 5l9 4.5-9 4.5z"/><path d="M7 12v5c0 1.7 2.2 3 5 3s5-1.3 5-3v-5"/><path d="M21 9.5V15"/>'),
    helm: P('<path d="M4 13a8 8 0 0 1 16 0"/><path d="M2 13h20v3H2z"/><path d="M9 13V6a3 3 0 0 1 6 0v7"/>'),
    bolt: P('<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>'),
    shirt: P('<path d="M8 4 4 6l2 5 2-1v10h8V10l2 1 2-5-4-2-4 3z"/>'),
    pot: P('<path d="M5 9h14v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M3 11h2M19 11h2"/><path d="M9 6c0-1 1-1.5 1-2.5M14 6c0-1 1-1.5 1-2.5"/>'),
    print: P('<path d="M7 8V4h10v4"/><rect x="4" y="8" width="16" height="8" rx="2"/><path d="M7 16h10v4H7z"/>'),
    drop: P('<path d="M12 3s6 6.3 6 10.2A6 6 0 0 1 6 13.2C6 9.3 12 3 12 3Z"/>'),
    leaf: P('<path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z"/><path d="M9 15c2-3 4-5 7-6.5"/>'),
    cart: P('<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 10.4A2 2 0 0 0 9.4 16h8.2a2 2 0 0 0 2-1.6L21 8H6"/>'),
    search: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    phone: P('<path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a3 3 0 0 1-3 3A16 16 0 0 1 3 6a3 3 0 0 1 3-3Z"/>'),
    mail: P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    pin: P('<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>'),
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a9.9 9.9 0 0 0-8.4 15.1L2 22.5l5.5-1.6A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 0 1 6.9 12.4l-.3.5.7 2.4-2.5-.7-.5.3a8.1 8.1 0 1 1-4.3-14.9Zm-3.1 4c-.2 0-.5.1-.7.4-.3.3-.8.9-.8 1.9s.8 2 .9 2.2c.1.2 1.5 2.4 3.7 3.3 1.9.8 2.3.6 2.7.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3l-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-.9-.3-1.7-1.1-.7-.6-1.1-1.3-1.2-1.5-.1-.2 0-.3.1-.4l.4-.5c.1-.2.2-.3.2-.4 0-.2 0-.3-.1-.4l-.6-1.4c-.1-.4-.3-.4-.4-.4h-.5Z"/></svg>',
    check: P('<path d="m4 12 5 5L20 6"/>'),
    arrowR: P('<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>'),
    arrowL: P('<path d="M20 12H5"/><path d="m11 18-6-6 6-6"/>'),
    chevronD: P('<path d="m6 9 6 6 6-6"/>'),
    close: P('<path d="M6 6l12 12M18 6 6 18"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    minus: P('<path d="M5 12h14"/>'),
    user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>'),
    truck: P('<path d="M3 7h10v9H3z"/><path d="M13 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17" cy="18" r="1.7"/>'),
    shield: P('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
    clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/></svg>',
    box: P('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'),
    layers: P('<path d="m12 3 9 4.5-9 4.5L3 7.5z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>'),
    file: P('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>'),
    clipboard: P('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>'),
    chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    settings: P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4 12H1M23 12h-3M5.6 5.6 7.7 7.7M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'),
    home: P('<path d="m3 11 9-8 9 8"/><path d="M6 10v10h12V10"/>'),
    menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    grid: P('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    list: P('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    heart: P('<path d="M12 20s-8-4.7-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.3-8 10-8 10Z"/>'),
    building: P('<path d="M4 21V6l8-3v18"/><path d="M12 21h8V10l-4-2"/><path d="M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2"/>'),
    handshake: P('<path d="m3 12 4-4 4 3 3-3 4 4"/><path d="M7 8v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8"/>'),
    globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18Z"/>'),
    calendar: P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>'),
    filter: P('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
    logout: P('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
    lock: P('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    sparkle: P('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.5 6.5 2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5"/>'),
    download: P('<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>'),
    print2: P('<path d="M7 8V4h10v4"/><rect x="4" y="8" width="16" height="8" rx="2"/><path d="M7 16h10v4H7z"/>'),
    edit: P('<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="m14 6 4 4"/>'),
    trash: P('<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>'),
    eye: P('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
    send: P('<path d="M21 3 3 10l7 3 3 7z"/>'),
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5ZM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95 4.02 0 4.76 2.5 4.76 5.76V21H18.5v-5.6c0-1.34-.03-3.06-1.9-3.06-1.9 0-2.2 1.45-2.2 2.96V21H10z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.8-.1-1.6-.15-2.4-.15-2.4 0-4 1.45-4 4.1v2.35H7.6V13h2.7v8z"/></svg>',
    instagram: P('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>'),
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3.2l-7 8 7.3 10h-5.6l-4.4-6-5 6H3l7.3-8.6L3.3 3h5.7l4 5.5z"/></svg>',
    bell: P('<path d="M18 15V10a6 6 0 1 0-12 0v5l-2 3h16z"/><path d="M10 21h4"/>'),
    warning: P('<path d="M12 4 2 20h20z"/><path d="M12 10v5M12 17h.01"/>'),
    info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    receipt: P('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    wallet: P('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14.5" r="1"/>'),
    refresh: P('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>'),
    logoutAlt: P('<path d="M9 4H5v16h4"/><path d="M15 8l4 4-4 4M8 12h11"/>'),
    sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: P('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>')
  };
  function paymentMark(id) {
    if (id === 'mpesa') return '<img src="https://upload.wikimedia.org/wikipedia/commons/1/15/M-PESA_LOGO-01.svg" alt="M-PESA logo" loading="lazy" decoding="async">';
    if (id === 'card') return '<span class="pm-card-brands" role="img" aria-label="Visa, Mastercard and American Express"><img src="https://cdn.simpleicons.org/visa/1434CB" alt="Visa"><img src="https://cdn.simpleicons.org/mastercard/EB001B" alt="Mastercard"><img src="https://cdn.simpleicons.org/americanexpress/016FD0" alt="American Express"></span>';
    if (id === 'bank') return '<span class="pm-equity" role="img" aria-label="Equity Bank-style mark"><svg viewBox="0 0 48 40" aria-hidden="true"><path d="M5 17 24 4l19 13v4H5zM9 22h30v4H9zm4 6h22v3H13z" fill="#a42a29"/><path d="M8 35h32" stroke="#a42a29" stroke-width="3" stroke-linecap="round"/></svg><b>EQUITY</b></span>';
    if (id === 'invoice') return '<svg class="pm-invoice-mark" viewBox="0 0 48 48" role="img" aria-label="Invoice document"><path d="M12 4h17l8 8v31H12z" fill="#fff" stroke="#5b5390" stroke-width="2.5"/><path d="M29 4v9h8M18 21h13M18 27h13M18 33h8m1 5 3 3 6-7" fill="none" stroke="#5b5390" stroke-width="2.5" stroke-linecap="round"/></svg>';
    return '';
  }
  const icon = (name, cls) => {
    const svg = ICONS[name] || ICONS.box;
    return cls ? svg.replace('<svg ', `<svg class="${cls}" `) : svg;
  };

  /* abstract media art patterns */
  const patterns = [
    '<circle cx="150" cy="150" r="98" fill="none" stroke="currentColor" stroke-opacity=".16" stroke-width="1.5"/><circle cx="150" cy="150" r="64" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="1.5"/>',
    '<path d="M0 210c60 0 60-120 120-120s60 120 120 120 60-120 120-120" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="1.5"/>',
    '<g fill="currentColor" fill-opacity=".13"><circle cx="60" cy="70" r="3"/><circle cx="100" cy="70" r="3"/><circle cx="140" cy="70" r="3"/><circle cx="180" cy="70" r="3"/><circle cx="220" cy="70" r="3"/><circle cx="60" cy="110" r="3"/><circle cx="100" cy="110" r="3"/><circle cx="140" cy="110" r="3"/><circle cx="180" cy="110" r="3"/><circle cx="220" cy="110" r="3"/></g>',
    '<rect x="52" y="52" width="196" height="196" rx="26" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="1.5"/><rect x="86" y="86" width="128" height="128" rx="18" fill="none" stroke="currentColor" stroke-opacity=".1" stroke-width="1.5"/>'
  ];
  function productArt(product, size) {
    const seed = (product.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const pat = patterns[seed % patterns.length];
    const initial = (product.name || '?').replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase();
    const rot = (seed % 30) - 15;
    return `<svg viewBox="0 0 300 300" width="${size || '100%'}" aria-hidden="true" style="color:#0b3d2c">
      ${pat}
      <text x="252" y="252" text-anchor="end" font-family="Georgia, serif" font-size="150"
            fill="#0b3d2c" fill-opacity=".055" font-weight="700">${initial}</text>
      <circle cx="150" cy="150" r="56" fill="#0b3d2c" fill-opacity=".05"/>
      <circle cx="150" cy="150" r="56" fill="none" stroke="#0b3d2c" stroke-opacity=".16" stroke-width="1" stroke-dasharray="3 5" transform="rotate(${rot} 150 150)"/>
      <g transform="translate(120 120) scale(2.5)" color="#0b3d2c" opacity=".9">${icon(catIcon(product.cat)).replace('<svg ', '<svg width="24" height="24" ')}</g>
    </svg>`;
  }
  const CAT_ICON = { food: 'grain', office: 'paper', ict: 'chip', furniture: 'chair', cleaning: 'spray', institutional: 'school', safety: 'helm', hardware: 'bolt', textiles: 'shirt', catering: 'pot', printing: 'print', water: 'drop', agriculture: 'leaf' };
  const catIcon = cat => CAT_ICON[cat] || 'box';

  /* ---------------- storage ---------------- */
  /* Storage that works everywhere: localStorage when the origin allows it
     (http/https), otherwise an in-memory store so the single-file build and
     sandboxed previews keep baskets, accounts and orders for the session. */
  const mem = new Map();
  let lsOk = null;
  function storageOk() {
    if (lsOk !== null) return lsOk;
    try {
      const probe = '__nv_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      lsOk = true;
    } catch { lsOk = false; }
    return lsOk;
  }
  const read = (key, fallback) => {
    if (storageOk()) {
      try {
        const raw = localStorage.getItem(key);
        if (raw != null) { const v = JSON.parse(raw); return v === null ? fallback : v; }
      } catch { /* fall through to memory */ }
    }
    return mem.has(key) ? mem.get(key) : fallback;
  };
  const write = (key, value) => {
    mem.set(key, value);
    if (!storageOk()) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  /* ---------------- API ---------------- */
  const state = { offline: false, catalog: null };

  async function api(path, options) {
    const opts = Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {});
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    try {
      const res = await fetch('/api' + path, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const err = new Error(data.error || (data.errors && data.errors.join(', ')) || 'Request failed'); err.data = data; err.status = res.status; throw err; }
      return data;
    } catch (err) {
      if (err.status) throw err;
      state.offline = true;
      throw Object.assign(new Error('offline'), { offline: true });
    }
  }

  /* ---- catalogue overrides written by the admin console ---- */
  const OVERRIDES = 'norvex.catalog.overrides.v1';
  const emptyOverrides = () => ({ categories: { added: [], edited: {}, deleted: [] }, products: { added: [], edited: {}, deleted: [] } });

  function readOverrides() {
    const raw = read(OVERRIDES, null);
    const base = emptyOverrides();
    if (!raw || typeof raw !== 'object') return base;
    ['categories', 'products'].forEach(k => {
      const o = raw[k] || {};
      base[k].added = Array.isArray(o.added) ? o.added : [];
      base[k].edited = o.edited && typeof o.edited === 'object' ? o.edited : {};
      base[k].deleted = Array.isArray(o.deleted) ? o.deleted : [];
    });
    return base;
  }

  function applyOverrides(cat) {
    const o = readOverrides();
    const pick = (list, side) => {
      const byId = new Map(list.map(x => [x.id, { ...x }]));
      o[side].deleted.forEach(id => byId.delete(id));
      Object.entries(o[side].edited).forEach(([id, patch]) => {
        if (byId.has(id)) byId.set(id, { ...byId.get(id), ...patch, id });
      });
      o[side].added.forEach(item => { if (item && item.id && !byId.has(item.id)) byId.set(item.id, { ...item }); });
      return [...byId.values()];
    };
    const categories = pick(cat.categories || [], 'categories');
    const products = pick(cat.products || [], 'products');
    const catIds = new Set(categories.map(c => c.id));
    return {
      ...cat,
      categories,
      products: products
        .filter(p => catIds.has(p.cat))
        .map(p => ({ ...p, from: (p.tiers && p.tiers.length ? p.tiers[p.tiers.length - 1][1] : 0) }))
    };
  }

  async function catalog() {
    if (state.catalog) return state.catalog;
    state.base = state.base || { products: new Set(), categories: new Set() };
    try {
      const data = await api('/catalog');
      state.catalog = data;
    } catch {
      const snap = global.NORVEX_CATALOG || { categories: [], products: [], currency: 'KES' };
      state.catalog = JSON.parse(JSON.stringify(snap));
    }
    (state.catalog.products || []).forEach(p => state.base.products.add(p.id));
    (state.catalog.categories || []).forEach(c => state.base.categories.add(c.id));
    state.catalog = applyOverrides(state.catalog);
    return state.catalog;
  }

  function reloadCatalog() { state.catalog = null; return catalog(); }

  const catalogAdmin = {
    overrides: readOverrides,
    save(raw) { write(OVERRIDES, raw); state.catalog = null; },
    reset() { write(OVERRIDES, emptyOverrides()); state.catalog = null; },
    upsertProduct(product) {
      const o = readOverrides();
      const id = product.id;
      const base = (state.base && state.base.products) || new Set();
      if (base.has(id)) {
        o.products.edited[id] = { ...(o.products.edited[id] || {}), ...product };
        o.products.added = o.products.added.filter(p => p.id !== id);
      } else {
        const exists = o.products.added.some(p => p.id === id);
        o.products.added = exists
          ? o.products.added.map(p => (p.id === id ? { ...p, ...product } : p))
          : [...o.products.added, product];
      }
      write(OVERRIDES, o); state.catalog = null;
    },
    removeProduct(id) {
      const o = readOverrides();
      o.products.added = o.products.added.filter(p => p.id !== id);
      delete o.products.edited[id];
      const inBase = !!(global.NORVEX_CATALOG && global.NORVEX_CATALOG.products.some(p => p.id === id));
      if (inBase && !o.products.deleted.includes(id)) o.products.deleted.push(id);
      write(OVERRIDES, o); state.catalog = null;
    },
    upsertCategory(category) {
      const o = readOverrides();
      const id = category.id;
      const base = (state.base && state.base.categories) || new Set();
      if (base.has(id)) {
        o.categories.edited[id] = { ...(o.categories.edited[id] || {}), ...category };
        o.categories.added = o.categories.added.filter(c => c.id !== id);
      } else {
        const exists = o.categories.added.some(c => c.id === id);
        o.categories.added = exists
          ? o.categories.added.map(c => (c.id === id ? { ...c, ...category } : c))
          : [...o.categories.added, category];
      }
      write(OVERRIDES, o); state.catalog = null;
    },
    removeCategory(id) {
      const o = readOverrides();
      o.categories.added = o.categories.added.filter(c => c.id !== id);
      delete o.categories.edited[id];
      const inBase = !!(global.NORVEX_CATALOG && global.NORVEX_CATALOG.categories.some(c => c.id === id));
      if (inBase && !o.categories.deleted.includes(id)) o.categories.deleted.push(id);
      write(OVERRIDES, o); state.catalog = null;
    }
  };

  /* downscale an uploaded picture to a lightweight data URI */
  function shrinkImage(file, maxSize) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = maxSize || 900;
        let w = img.naturalWidth, h = img.naturalHeight;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        try { resolve(canvas.toDataURL('image/jpeg', 0.82)); } catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
      img.src = url;
    });
  }
  const productMap = async () => { const c = await catalog(); return Object.fromEntries(c.products.map(p => [p.id, p])); };

  /* ---------------- pricing ---------------- */
  const tierPrice = (product, qty) => {
    if (!product) return 0;
    let price = product.tiers[0][1];
    for (const [min, value] of product.tiers) if (qty >= min) price = value;
    return price;
  };
  function quote(lines) {
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const savings = lines.reduce((s, l) => s + (l.listPrice - l.unitPrice) * l.qty, 0);
    const delivery = lines.length === 0 ? 0 : subtotal >= CONFIG.freeDeliveryFrom ? 0 : CONFIG.deliveryFee;
    const vat = Math.round((subtotal + delivery) * CONFIG.vatRate);
    return { subtotal, savings, delivery, vat, total: subtotal + delivery + vat };
  }

  /* ---------------- basket ---------------- */
  const basket = {
    raw() {
      const rows = read(CONFIG.basketKey, []);
      return Array.isArray(rows) ? rows.filter(r => r && r.id).map(r => ({ id: r.id, qty: Math.max(1, parseInt(r.qty, 10) || 1) })) : [];
    },
    save(rows) { write(CONFIG.basketKey, rows); document.dispatchEvent(new CustomEvent('basket:change', { detail: { count: basket.count() } })); },
    count() { return basket.raw().reduce((s, r) => s + r.qty, 0); },
    distinct() { return basket.raw().length; },
    has(id) { return basket.raw().some(r => r.id === id); },
    qtyOf(id) { const row = basket.raw().find(r => r.id === id); return row ? row.qty : 0; },
    add(id, qty = 1) {
      const rows = basket.raw();
      const existing = rows.find(r => r.id === id);
      if (existing) existing.qty += qty; else rows.push({ id, qty });
      basket.save(rows);
      return basket.count();
    },
    setQty(id, qty) {
      let rows = basket.raw();
      const row = rows.find(r => r.id === id);
      if (!row) return;
      if (qty <= 0) rows = rows.filter(r => r.id !== id); else row.qty = Math.min(999999, qty);
      basket.save(rows);
    },
    remove(id) { basket.save(basket.raw().filter(r => r.id !== id)); },
    clear() { basket.save([]); },
    async lines() {
      const map = await productMap();
      return basket.raw().map(row => {
        const p = map[row.id];
        if (!p) return null;
        const unitPrice = tierPrice(p, row.qty);
        return { id: p.id, product: p, name: p.name, unit: p.unit, cat: p.cat, qty: row.qty, unitPrice, listPrice: p.tiers[0][1], lineTotal: unitPrice * row.qty, moq: p.moq, lead: p.lead };
      }).filter(Boolean);
    },
    async totals() { return quote(await basket.lines()); },
    whatsappText(lines) {
      const t = quote(lines);
      const body = [
        '*NORVEX SUPPLY REQUEST*',
        '',
        ...lines.map(l => `• ${l.name} — ${l.qty} x ${l.unit} @ ${money(l.unitPrice)} = ${money(l.lineTotal)}`),
        '',
        `Subtotal: ${money(t.subtotal)}`,
        `Delivery: ${t.delivery ? money(t.delivery) : 'Free'}`,
        `VAT (16%): ${money(t.vat)}`,
        `*Estimated total: ${money(t.total)}*`,
        '',
        'Please confirm availability and pricing.'
      ].join('\n');
      return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(body)}`;
    }
  };

  /* ---------------- favourites ---------------- */
  const favourites = {
    all() { const v = read(CONFIG.favKey, []); return Array.isArray(v) ? v : []; },
    has(id) { return favourites.all().includes(id); },
    toggle(id) {
      const list = favourites.all();
      const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
      write(CONFIG.favKey, next);
      return next.includes(id);
    }
  };

  /* ---------------- customer (checkout memory) ---------------- */
  const customer = {
    get() { return read(CONFIG.customerKey, {}); },
    save(data) { write(CONFIG.customerKey, Object.assign(customer.get(), data || {})); }
  };

  /* ---------------- toasts ---------------- */
  function toast(message, opts) {
    const o = Object.assign({ title: '', type: 'success', ms: 4200 }, opts || {});
    let stack = document.querySelector('.toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; document.body.appendChild(stack); }
    const el = document.createElement('div');
    el.className = 'toast' + (o.type === 'error' ? ' toast-error' : '');
    el.innerHTML = `<div><strong>${esc(o.title || (o.type === 'error' ? 'Something went wrong' : 'Done'))}</strong><span>${esc(message)}</span></div><button class="toast-x" aria-label="Dismiss">×</button>`;
    stack.appendChild(el);
    while (stack.children.length > 3) stack.firstElementChild.remove();
    const kill = () => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 220); };
    el.querySelector('.toast-x').addEventListener('click', kill);
    setTimeout(kill, o.ms);
  }

  /* ---------------- misc ---------------- */
  function reveal() {
    const els = Array.from(document.querySelectorAll('.reveal:not(.in)'));
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }

    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { threshold: .08, rootMargin: '0px 0px -30px 0px' });
    els.forEach(e => io.observe(e));

    /* safety net: never leave content invisible (fast scrolls, print, odd viewports) */
    setTimeout(() => els.forEach(e => { if (!e.classList.contains('in')) e.classList.add('in'); }), 2600);
  }

  function queryString() { return new URLSearchParams(location.search); }

  function copy(text) {
    if (navigator.clipboard) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }

  function ref(prefix) {
    const d = new Date();
    return `${prefix}-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
  }

  /* ---------------- PWA + small niceties ---------------- */
  function boot() {
    theme.apply(theme.get());
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.appendChild(link);

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    /* keep the year fresh anywhere it's printed */
    document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ---------------- export ---------------- */
  /* ---------------- day / night theme ---------------- */
  const THEME_KEY = 'norvex.theme.v1';
  const theme = {
    get() { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'day'; } catch (e) { return 'day'; } },
    apply(t) {
      const dark = t === 'dark';
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'day');
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'day'); } catch (e) {}
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#0b0f0d' : '#0b3d2c');
      document.querySelectorAll('img[data-logo]').forEach(img => {
        img.src = dark ? img.dataset.logoDark : img.dataset.logoLight;
      });
      document.dispatchEvent(new CustomEvent('norvex:theme', { detail: { theme: dark ? 'dark' : 'day' } }));
    },
    toggle() { const next = theme.get() === 'dark' ? 'day' : 'dark'; theme.apply(next); return next; }
  };

  global.NV = {
    CONFIG, money, compact, dateFmt, timeFmt, esc, icon, paymentMark, productArt, catIcon,
    api, catalog, productMap, tierPrice, quote, basket, favourites, customer,
    toast, reveal, queryString, copy, ref, read, write, state, storageOk,
    reloadCatalog, catalogAdmin, shrinkImage, theme
  };
})(window);
