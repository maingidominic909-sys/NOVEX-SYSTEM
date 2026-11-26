/* Console — operations dashboard */
(function () {
  const NV = window.NV;
  const FLOW = ['received', 'confirmed', 'sourcing', 'dispatched', 'delivered'];
  let orders = [];
  let futureOrders = [];
  let enquiries = [];
  let statusFilter = 'all';

  const badge = s => `<span class="badge-status" data-status="${NV.esc(s)}">${NV.esc(s)}</span>`;

  function localOrders() { return NV.read('norvex.orders.local.v1', []); }
  function localFuture() { return NV.read('norvex.futureOrders.local.v1', []); }
  function localEnquiries() { return NV.read('norvex.enquiries.local.v1', []); }

  async function load() {
    let summary = null;
    try { summary = await NV.api('/admin/summary'); } catch {}

    if (summary) {
      orders = summary.recentOrders || [];
      /* full list for table */
      try { const all = await NV.api('/orders'); if (all.orders) orders = all.orders; } catch {}
      try { const f = await NV.api('/future-orders'); futureOrders = f.futureOrders || []; } catch {}
      enquiries = summary.recentEnquiries || [];
    }
    /* merge local (offline preview) records */
    const seen = new Set(orders.map(o => o.ref));
    orders = [...localOrders().filter(o => !seen.has(o.ref)), ...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const fseen = new Set(futureOrders.map(f => f.ref));
    futureOrders = [...localFuture().filter(f => !fseen.has(f.ref)), ...futureOrders];
    if (!enquiries.length) enquiries = localEnquiries().slice(0, 6);
    /* demo book so the desk is never a blank dashboard on first open */
    const sSeen = new Set(orders.map(o => o.ref));
    orders = [...orders, ...seedOrders().filter(o => !sSeen.has(o.ref))]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!futureOrders.length) futureOrders = demoFuture();
    if (!enquiries.length) enquiries = demoEnquiries();
    return summary;
  }

  function paintKpis(summary) {
    const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totals.total, 0);
    const open = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
    const avg = orders.length ? Math.round(revenue / orders.length) : 0;
    document.getElementById('opsKpis').innerHTML = `
      <div class="kpi accent"><div class="kpi-label">Revenue booked</div><div class="kpi-value">${NV.money(revenue)}</div><div class="kpi-foot">${orders.length} orders · avg ${NV.money(avg)}</div></div>
      <div class="kpi"><div class="kpi-label">Open orders</div><div class="kpi-value">${open}</div><div class="kpi-foot">Awaiting confirmation or dispatch</div></div>
      <div class="kpi"><div class="kpi-label">Future orders</div><div class="kpi-value">${futureOrders.length}</div><div class="kpi-foot">In the planning pipeline</div></div>
      <div class="kpi"><div class="kpi-label">Enquiries</div><div class="kpi-value">${enquiries.length}</div><div class="kpi-foot">Quotes &amp; questions to answer</div></div>`;

    document.getElementById('enqCount').textContent = `${enquiries.length} new`;
  }

  function paintOrders() {
    const rows = orders.filter(o => statusFilter === 'all' || o.status === statusFilter);
    const body = document.getElementById('opsOrders');
    const empty = document.getElementById('opsEmpty');
    document.getElementById('opsMeta').textContent = `${rows.length} of ${orders.length} orders`;

    if (!rows.length) { body.innerHTML = ''; empty.classList.remove('hide'); return; }
    empty.classList.add('hide');
    body.innerHTML = rows.map(o => {
      const idx = FLOW.indexOf(o.status);
      const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
      return `<tr>
        <td><a class="cell-main mono nw" href="/order.html?ref=${encodeURIComponent(o.ref)}">${NV.esc(o.ref)}</a>
          <div class="cell-sub">${o.items.length} ${o.items.length === 1 ? 'line' : 'lines'} · ${NV.dateFmt(o.createdAt)}${o.source === 'seed' ? ' · demo' : ''}</div></td>
        <td>${NV.esc(o.customer.organisation)}<div class="cell-sub">${NV.esc(o.customer.name)}</div></td>
        <td class="num nw">${NV.money(o.totals.total)}</td>
        <td>${badge(o.status)}</td>
        <td class="actions">${next ? `<button class="btn btn-sm" data-advance="${NV.esc(o.ref)}" data-next="${next}">→ ${next}</button>` : `<span class="tiny muted">done</span>`}</td>
      </tr>`;
    }).join('');

    body.querySelectorAll('[data-advance]').forEach(btn => btn.onclick = async () => {
      const ref = btn.dataset.advance;
      const next = btn.dataset.next;
      btn.classList.add('is-disabled');
      btn.innerHTML = '<span class="spinner spinner-dark"></span>';
      try {
        await NV.api('/orders/' + encodeURIComponent(ref), { method: 'PATCH', body: { status: next, note: 'Updated from operations console' } });
        NV.toast(`${ref} advanced to ${next}.`, { title: 'Status updated' });
        await refresh();
      } catch {
        /* offline: update local copy */
        const local = localOrders();
        const hit = local.find(o => o.ref === ref);
        if (hit) {
          hit.status = next;
          hit.statusHistory = [...(hit.statusHistory || []), { status: next, at: new Date().toISOString(), note: 'Updated locally (offline)' }];
          NV.write('norvex.orders.local.v1', local);
        }
        const seedRow = seedOrders().find(o => o.ref === ref);
        if (seedRow) seedRow.status = next;
        const row = orders.find(o => o.ref === ref);
        if (row) {
          row.status = next;
          row.statusHistory = [...(row.statusHistory || []), { status: next, at: new Date().toISOString(), note: 'Updated locally (offline)' }];
        }
        NV.toast(`${ref} advanced to ${next} (local only).`, { title: 'Status updated' });
        paintOrders(); paintKpis();
      }
    });
  }

  function paintFuture() {
    const body = document.getElementById('opsFuture');
    const empty = document.getElementById('futureEmpty');
    if (!futureOrders.length) { body.innerHTML = ''; empty.classList.remove('hide'); return; }
    empty.classList.add('hide');
    body.innerHTML = futureOrders.slice(0, 8).map(f => `
      <tr>
        <td class="cell-main mono">${NV.esc(f.ref)}</td>
        <td>${NV.esc(f.contact?.organisation || '—')}<div class="cell-sub">${NV.esc(f.contact?.name || '')}</div></td>
        <td>${NV.dateFmt(f.deliveryDate)}</td>
        <td class="num">${f.items?.length || 0}</td>
        <td class="cell-sub">${NV.esc(f.recurrence || 'One-off')}</td>
      </tr>`).join('');
  }

  function paintEnquiries() {
    const host = document.getElementById('opsEnquiries');
    if (!enquiries.length) { host.innerHTML = `<p class="small muted">No enquiries in the queue.</p>`; return; }
    host.innerHTML = enquiries.slice(0, 5).map(e => `
      <div style="padding-bottom:12px;border-bottom:1px solid #f0f2ee">
        <div class="row-between" style="margin-bottom:2px">
          <strong style="font-size:.86rem">${NV.esc(e.organisation || e.name || 'Enquiry')}</strong>
          <span class="tiny muted mono">${NV.esc(e.ref || '')}</span>
        </div>
        <div class="tiny muted" style="margin-bottom:6px">${NV.esc(e.subject || e.type || 'General')} · ${NV.dateFmt(e.createdAt)}</div>
        <div class="small" style="color:var(--ink-soft);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${NV.esc(e.message || '')}</div>
      </div>`).join('');
  }

  function paintTop() {
    const counts = {};
    orders.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + i.qty));
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = entries.length ? entries[0][1] : 1;
    document.getElementById('opsTop').innerHTML = entries.length ? entries.map(([name, qty]) => `
      <div>
        <div class="row-between tiny" style="margin-bottom:4px"><span>${NV.esc(name)}</span><span class="mono">${qty}</span></div>
        <div class="delivery-progress" style="margin:0"><i style="width:${Math.round((qty / max) * 100)}%"></i></div>
      </div>`).join('') : `<p class="small muted">No order lines yet.</p>`;
  }

  function paintMix() {
    const mix = {};
    orders.forEach(o => mix[o.status] = (mix[o.status] || 0) + 1);
    const entries = Object.entries(mix);
    document.getElementById('opsStatusMix').innerHTML = entries.length ? entries.map(([s, n]) => `
      <div class="row-between"><span>${badge(s)}</span><span class="small mono">${n}</span></div>`).join('')
      : `<p class="small muted">Nothing in the pipeline.</p>`;
  }


  /* =========================================================
     ANALYTICS — money, profit, pending, trends
     Rebuilt from the order book; a deterministic seed book is
     merged in so the desk sees a populated dashboard offline.
     ========================================================= */
  const COST_RATIO = { food: 0.78, office: 0.66, ict: 0.82, furniture: 0.72, cleaning: 0.63, institutional: 0.7,
    safety: 0.69, hardware: 0.74, textiles: 0.71, catering: 0.68, printing: 0.62, water: 0.6, agriculture: 0.76 };
  const BUYERS = [
    ['Kiambu County Referral Hospital', 'Grace Wanjiru', 'Kiambu'],
    ['Brookside Academy', 'Peter Otieno', 'Nairobi'],
    ['Mwangaza NGO', 'Amina Hassan', 'Machakos'],
    ['Kenya Highlands University', 'Dr. Joseph Kimani', 'Nyeri'],
    ['County Government of Kajiado', 'Mary Sankale', 'Kajiado'],
    ['Sanaa Group Ltd', 'Brian Mwangi', 'Nairobi'],
    ['Nairobi Water Trust', 'Faith Njeri', 'Nairobi'],
    ['Tumaini Childrens Home', 'Sister Anne', 'Kiambu'],
    ['Rift Valley Technical College', 'Dennis Kiprop', 'Nakuru'],
    ['Afya Bora Clinic', 'Dr. Lilian Achieng', 'Kisumu']
  ];
  const PAY_KINDS = ['mpesa', 'mpesa', 'mpesa', 'mpesa', 'mpesa', 'bank', 'bank', 'card', 'invoice', 'invoice'];

  /* tiny deterministic PRNG so the seed book never changes between reloads */
  function rng(seed) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  }

  let seedEnquiries = null;
  let seedFuture = null;
  function demoEnquiries() {
    if (seedEnquiries) return seedEnquiries;
    const r = rng(771144);
    const rows = [
      ['Kiambu County Referral Hospital', 'Grace Wanjiru', 'Tender: surgical consumables Q1', 'We need a formal quotation for the attached bill of quantities, delivery to Thika. Please confirm lead times.'],
      ['Brookside Academy', 'Peter Otieno', 'Term 1 dry food restock', 'Looking for monthly supply of maize flour, rice and cooking oil for 620 learners. What are your tier prices?'],
      ['Mwangaza NGO', 'Amina Hassan', 'ICT lab for Machakos school', 'Quoting 20 laptops, 1 projector and networking. Do you handle installation and warranty?'],
      ['Sanaa Group Ltd', 'Brian Mwangi', 'Safety gear — 120 staff', 'Need hi-vis vests, helmets and boots. Can you deliver to Ruiru before Friday?']
    ];
    seedEnquiries = rows.map((r0, i) => ({
      ref: 'ENQ-2611-' + (48210 + i * 7),
      organisation: r0[0], name: r0[1], subject: r0[2], message: r0[3],
      type: 'quotation',
      createdAt: new Date(Date.now() - (1 + i * 2) * 86400000 - Math.floor(r() * 6) * 3600000).toISOString()
    }));
    return seedEnquiries;
  }
  function demoFuture() {
    if (seedFuture) return seedFuture;
    seedFuture = [
      { ref: 'FO-2611-30712', contact: { organisation: 'Kenya Highlands University', name: 'Dr. Joseph Kimani' }, deliveryDate: new Date(Date.now() + 12 * 86400000).toISOString(), items: [1, 2, 3, 4], recurrence: 'Monthly' },
      { ref: 'FO-2611-30713', contact: { organisation: 'Tumaini Childrens Home', name: 'Sister Anne' }, deliveryDate: new Date(Date.now() + 26 * 86400000).toISOString(), items: [1, 2], recurrence: 'Quarterly' },
      { ref: 'FO-2611-30714', contact: { organisation: 'Afya Bora Clinic', name: 'Dr. Lilian Achieng' }, deliveryDate: new Date(Date.now() + 41 * 86400000).toISOString(), items: [1, 2, 3], recurrence: 'One-off' }
    ];
    return seedFuture;
  }

  let seeded = null;
  function seedOrders() {
    if (seeded) return seeded;
    const cat = NV.state.catalog || window.NORVEX_CATALOG;
    const products = cat.products;
    const rand = rng(20261116);
    const out = [];
    const today = new Date();
    for (let i = 0; i < 34; i++) {
      const daysAgo = Math.floor(rand() * 84);
      const created = new Date(today.getTime() - daysAgo * 86400000 - Math.floor(rand() * 8) * 3600000);
      const buyer = BUYERS[Math.floor(rand() * BUYERS.length)];
      const lines = [];
      const nLines = 1 + Math.floor(rand() * 4);
      for (let k = 0; k < nLines; k++) {
        const p = products[Math.floor(rand() * products.length)];
        if (lines.some(l => l.id === p.id)) continue;
        const qty = Math.max(p.moq, Math.floor(p.moq * (1 + rand() * 14)));
        const unitPrice = NV.tierPrice(p, qty);
        lines.push({ id: p.id, name: p.name, unit: p.unit, cat: p.cat, qty, unitPrice,
          listPrice: p.tiers[0][1], lineTotal: unitPrice * qty });
      }
      const q = NV.quote(lines);
      const flow = ['received', 'confirmed', 'sourcing', 'dispatched', 'delivered'];
      const stage = daysAgo > 10 ? 4 : daysAgo > 5 ? 3 : daysAgo > 2 ? 2 : Math.floor(rand() * 3);
      const payKind = PAY_KINDS[Math.floor(rand() * PAY_KINDS.length)];
      const settled = payKind === 'invoice' ? rand() > 0.62 : rand() > 0.28;
      out.push({
        ref: 'NVX-' + String(created.getFullYear()).slice(2) + String(created.getMonth() + 1).padStart(2, '0') + '-' +
          Math.floor(rand() * 0xffffff).toString(16).toUpperCase().padStart(6, '0'),
        createdAt: created.toISOString(),
        status: flow[stage],
        statusHistory: [{ status: flow[stage], at: created.toISOString(), note: 'Seeded history' }],
        customer: { organisation: buyer[0], name: buyer[1], town: buyer[2], county: buyer[2],
          email: buyer[1].toLowerCase().replace(/[^a-z]+/g, '.') + '@example.co.ke', phone: '+2547' + Math.floor(10000000 + rand() * 89999999),
          payment: payKind, address: buyer[2] + ' Main Road' },
        payment: { method: payKind, label: payKind === 'mpesa' ? 'M-Pesa' : payKind === 'bank' ? 'Bank transfer' : payKind === 'card' ? 'Card' : 'Invoice',
          status: settled ? 'paid' : 'pending', settledAt: settled ? new Date(created.getTime() + 86400000 * (1 + rand() * 4)).toISOString() : null },
        delivery: { method: 'Standard delivery', window: 'Morning (8:00 – 12:00)', zone: buyer[2] },
        items: lines,
        totals: q,
        source: 'seed'
      });
    }
    seeded = out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return seeded;
  }

  function book() {
    return orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const costOf = (o) => o.items.reduce((s, i) => s + i.lineTotal * (COST_RATIO[i.cat] || 0.72), 0);
  const isPaid = o => !!(o.payment && o.payment.status === 'paid');

  function paintMoney() {
    const all = book();
    const live = all.filter(o => o.status !== 'cancelled');
    const revenue = live.reduce((s, o) => s + o.totals.total, 0);
    const cost = live.reduce((s, o) => s + costOf(o), 0);
    const profit = revenue - cost;
    const margin = revenue ? Math.round((profit / revenue) * 1000) / 10 : 0;
    const pending = live.filter(o => !isPaid(o));
    const pendingValue = pending.reduce((s, o) => s + o.totals.total, 0);
    const openOrders = live.filter(o => !['delivered', 'cancelled'].includes(o.status));
    const openValue = openOrders.reduce((s, o) => s + o.totals.total, 0);
    const avg = live.length ? Math.round(revenue / live.length) : 0;
    const paidValue = revenue - pendingValue;

    /* 8-point weekly revenue sparkline */
    const weeks = 8;
    const buckets = Array(weeks).fill(0);
    const now = Date.now();
    live.forEach(o => {
      const w = Math.floor((now - new Date(o.createdAt).getTime()) / (7 * 86400000));
      if (w >= 0 && w < weeks) buckets[weeks - 1 - w] += o.totals.total;
    });

    const K = [
      { label: 'Revenue booked', value: NV.money(revenue), foot: `${live.length} orders · avg ${NV.money(avg)}`, accent: true, spark: buckets },
      { label: 'Gross profit', value: NV.money(profit), foot: `After KES ${Math.round(cost).toLocaleString('en-KE')} cost of goods`, spark: buckets.map(b => b * (profit / (revenue || 1))) },
      { label: 'Gross margin', value: margin + '%', foot: 'Blended across departments' },
      { label: 'Money in', value: NV.money(paidValue), foot: `${live.filter(isPaid).length} settled orders`, spark: buckets },
      { label: 'Pending payments', value: NV.money(pendingValue), foot: `${pending.length} awaiting settlement`, warn: true },
      { label: 'Orders pending', value: String(openOrders.length), foot: `${NV.money(openValue)} not yet delivered`, warn: openOrders.length > 0 }
    ];

    document.getElementById('opsKpis').innerHTML = K.map(k => `
      <div class="kpi ${k.accent ? 'accent' : ''} ${k.warn ? 'warn' : ''}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        ${k.spark ? NVCharts.spark(k.spark, { color: k.accent ? '#dfbf74' : '#17694a' }) : ''}
        <div class="kpi-foot">${k.foot}</div>
      </div>`).join('');
  }

  let trendRange = 8;
  function paintCharts() {
    const all = book().filter(o => o.status !== 'cancelled');
    const C = window.NVCharts;

    /* --- revenue vs profit trend --- */
    const buckets = trendRange;
    const step = buckets > 12 ? 7 * 4 : 7;              // 6-month view groups into 4-week blocks
    const labels = [];
    const rev = Array(buckets).fill(0), prof = Array(buckets).fill(0);
    const now = Date.now();
    all.forEach(o => {
      const idx = buckets - 1 - Math.floor((now - new Date(o.createdAt).getTime()) / (step * 86400000));
      if (idx < 0 || idx >= buckets) return;
      rev[idx] += o.totals.total;
      prof[idx] += o.totals.total - costOf(o);
    });
    for (let i = 0; i < buckets; i++) {
      const d = new Date(now - (buckets - 1 - i) * step * 86400000);
      labels.push(buckets > 12 ? 'W' + (i + 1) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
    }
    C.area(document.getElementById('chartTrend'), {
      height: 230, labels,
      series: [{ name: 'Revenue', values: rev, color: '#17694a' }, { name: 'Gross profit', values: prof, color: '#c9a24a' }],
      note: 'VAT inclusive · profit after cost of goods · current week in progress'
    });

    /* --- profit by department --- */
    const byCat = {};
    all.forEach(o => o.items.forEach(i => {
      const c = byCat[i.cat] || (byCat[i.cat] = { rev: 0, cost: 0 });
      c.rev += i.lineTotal; c.cost += i.lineTotal * (COST_RATIO[i.cat] || 0.72);
    }));
    const catName = id => (NV.state.catalog?.categories.find(c => c.id === id) || {}).name || id;
    const shortName = n => n.split(/&|\s/).filter(Boolean).slice(0, 2).join(' ');
    const deptAll = Object.entries(byCat).map(([id, v]) => ({ label: catName(id), short: shortName(catName(id)), value: v.rev, id }))
      .sort((a, b) => b.value - a.value);
    const deptItems = deptAll.slice(0, 6);
    const tail = deptAll.slice(6).reduce((sum, d) => sum + d.value, 0);
    if (tail > 0) deptItems.push({ label: `Other departments (${deptAll.length - 6})`, short: `Other (${deptAll.length - 6})`, value: tail, color: '#8a978f' });
    C.donut(document.getElementById('chartDepts'), { items: deptItems, centerLabel: 'REVENUE' });

    /* --- payment mix --- */
    const pay = { mpesa: 0, bank: 0, card: 0, invoice: 0 };
    all.forEach(o => { const m = (o.payment && o.payment.method) || 'invoice'; pay[m] = (pay[m] || 0) + o.totals.total; });
    C.bars(document.getElementById('chartPayments'), {
      items: [
        { label: 'M-Pesa', value: pay.mpesa, color: '#2ea94f' },
        { label: 'Bank transfer', value: pay.bank, color: '#0b3d2c' },
        { label: 'Card', value: pay.card, color: '#c9a24a' },
        { label: 'Invoice / LPO', value: pay.invoice, color: '#2f5f8a' }
      ]
    });

    /* --- funnel --- */
    const flow = ['received', 'confirmed', 'sourcing', 'dispatched', 'delivered'];
    C.funnel(document.getElementById('chartFunnel'), {
      items: flow.map((s, i) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        value: all.filter(o => flow.indexOf(o.status) >= i).length || 0,
        color: ['#40597a', '#2f5f8a', '#c9a24a', '#4b46a8', '#1c7a4b'][i]
      }))
    });

    /* --- receivables ageing --- */
    const ages = { '0–30 days': 0, '31–60 days': 0, '61+ days': 0 };
    const pend = all.filter(o => !isPaid(o));
    pend.forEach(o => {
      const d = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 86400000);
      if (d <= 30) ages['0–30 days'] += o.totals.total;
      else if (d <= 60) ages['31–60 days'] += o.totals.total;
      else ages['61+ days'] += o.totals.total;
    });
    C.bars(document.getElementById('chartAgeing'), {
      items: Object.entries(ages).map(([label, value], i) => ({ label, value, color: ['#1c7a4b', '#c9a24a', '#b3261e'][i] }))
    });
    const totalPend = pend.reduce((s, o) => s + o.totals.total, 0);
    const overdue = pend.filter(o => (Date.now() - new Date(o.createdAt)) > 45 * 86400000).reduce((s, o) => s + o.totals.total, 0);
    document.getElementById('ageingMeta').innerHTML = `
      <span class="tiny muted">${pend.length} invoices open</span>
      <strong>${NV.money(totalPend)}</strong>
      <span class="tiny" style="color:${overdue ? 'var(--danger)' : 'var(--success)'}">${NV.money(overdue)} over 45 days</span>`;

    /* --- profit table --- */
    const rows = Object.entries(byCat).map(([id, v]) => ({ id, ...v, profit: v.rev - v.cost }))
      .sort((a, b) => b.profit - a.profit);
    document.getElementById('profitRows').innerHTML = rows.map(r => `
      <tr>
        <td class="cell-main">${NV.esc(catName(r.id))}</td>
        <td class="num" data-label="Revenue">${NV.money(r.rev)}</td>
        <td class="num" data-label="Cost">${NV.money(r.cost)}</td>
        <td class="num" data-label="Gross profit" style="color:var(--success);font-weight:650">${NV.money(r.profit)}</td>
        <td class="num" data-label="Margin">${Math.round((r.profit / (r.rev || 1)) * 100)}%</td>
      </tr>`).join('') || `<tr><td colspan="5" class="muted small">No settled lines yet.</td></tr>`;

    /* --- top buyers --- */
    const buyers = {};
    all.forEach(o => { const k = o.customer.organisation; buyers[k] = (buyers[k] || 0) + o.totals.total; });
    C.bars(document.getElementById('chartBuyers'), {
      items: Object.entries(buyers).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }))
    });
  }

  async function refresh() {
    const summary = await load();
    paintKpis(summary);
    paintMoney();
    paintCharts();
    paintOrders();
    paintFuture();
    paintEnquiries();
    paintTop();
    paintMix();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = NV.icon(el.dataset.icon));
    await NV.catalog();
    await refresh();

    document.querySelectorAll('#opsSeg button').forEach(btn => btn.onclick = () => {
      document.querySelectorAll('#opsSeg button').forEach(b => b.classList.toggle('on', b === btn));
      statusFilter = btn.dataset.status;
      paintOrders();
    });

    document.querySelectorAll('#trendSeg button').forEach(btn => btn.onclick = () => {
      document.querySelectorAll('#trendSeg button').forEach(b => b.classList.toggle('on', b === btn));
      trendRange = Number(btn.dataset.range);
      paintCharts();
    });

    document.getElementById('refreshBtn').onclick = async () => {
      await refresh();
      NV.toast('Dashboard refreshed.', { title: 'Up to date' });
    };

    document.getElementById('exportBtn').onclick = () => {
      if (!orders.length) { NV.toast('No orders to export yet.', { title: 'Nothing to export', type: 'error' }); return; }
      const head = ['Reference', 'Date', 'Organisation', 'Contact', 'Lines', 'Total', 'Status'];
      const rows = orders.map(o => [o.ref, new Date(o.createdAt).toISOString().slice(0, 10), o.customer.organisation, o.customer.name, o.items.length, o.totals.total, o.status]);
      const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `norvex-ops-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      NV.toast('Operations export downloaded.', { title: 'Export ready' });
    };
  });
})();
