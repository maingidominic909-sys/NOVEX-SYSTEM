/* NORVEX v2 — order history */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  let all = [], filter = 'all', query = '';

  async function load() {
    const user = NV.auth.current();
    const local = NV.read('norvex.orders.local.v1', []);
    let remote = [];
    if (user) {
      try { const res = await NV.api('/orders?email=' + encodeURIComponent(user.email)); remote = res.orders || []; }
      catch { /* offline — local only */ }
    }
    const seen = new Set();
    all = [...local, ...remote]
      .filter(o => o && o.ref && (seen.has(o.ref) ? false : (seen.add(o.ref), true)))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    /* show orders belonging to this account (local queue may hold others) */
    if (user) all = all.filter(o => !o.customer || !o.customer.email || o.customer.email === user.email);
  }

  function render() {
    const root = document.getElementById('ordersRoot');
    const user = NV.auth.current();
    if (!user) {
      root.innerHTML = `
        <div class="auth-guard">
          <div class="auth-guard-body">
            <p class="eyebrow">Trade account</p>
            <h2>Sign in to see your orders</h2>
            <p>Order history, re-ordering and delivery tracking live inside your trade account. Browsing the catalogue stays open to everyone.</p>
          </div>
          <div class="auth-guard-actions">
            <a class="btn btn-gold" href="/auth.html?mode=signin" onclick="NV.auth.rememberReturn('/orders.html')">Sign in</a>
            <a class="btn btn-ghost" href="/auth.html?mode=signup">Create account</a>
          </div>
        </div>`;
      return;
    }

    const spend = all.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totals ? o.totals.total : 0), 0);
    const open = all.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
    const list = all.filter(o => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (!query) return true;
      const hay = (o.ref + ' ' + (o.customer ? o.customer.organisation : '') + ' ' + o.items.map(i => i.name).join(' ')).toLowerCase();
      return hay.includes(query);
    });
    const statuses = ['all', 'received', 'confirmed', 'sourcing', 'dispatched', 'delivered', 'cancelled'];
    const labels = { all: 'All', received: 'Received', confirmed: 'Confirmed', sourcing: 'Sourcing', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled' };

    root.innerHTML = `
      <div class="kpi-grid mb-3">
        <div class="kpi"><div class="kpi-top"><span class="kpi-label">Total orders</span><span class="kpi-ico">${NV.icon('receipt')}</span></div><div class="kpi-value">${all.length}</div><div class="kpi-sub">across this account</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-label">Lifetime spend</span><span class="kpi-ico gold">${NV.icon('wallet')}</span></div><div class="kpi-value">${NV.compact(spend)}</div><div class="kpi-sub">VAT inclusive, excl. cancelled</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-label">Open orders</span><span class="kpi-ico">${NV.icon('truck')}</span></div><div class="kpi-value">${open}</div><div class="kpi-sub">in the pipeline right now</div></div>
      </div>
      <div class="card">
        <div class="card-head" style="flex-wrap:wrap">
          <h3>Order history</h3>
          <div class="row wrap">
            <div class="input-wrap" style="min-width:210px"><span class="lead">${NV.icon('search')}</span><input class="input" id="orderSearch" placeholder="Search ref, item…" value="${E(query)}" style="padding-top:9px;padding-bottom:9px"></div>
            <button class="btn btn-ghost btn-sm" id="csvBtn">${NV.icon('download')} CSV</button>
            <a class="btn btn-gold btn-sm" href="/shop.html">${NV.icon('plus')} New order</a>
          </div>
        </div>
        <div class="card-body" style="padding-top:14px;padding-bottom:0">
          <div class="row wrap" id="statusChips" style="gap:8px">
            ${statuses.map(s => `<button class="chip ${filter === s ? 'on' : ''}" data-status="${s}">${labels[s]}${s !== 'all' ? ` · ${all.filter(o => o.status === s).length}` : ''}</button>`).join('')}
          </div>
        </div>
        <div id="orderList" style="margin-top:8px">
          ${list.length ? list.map(o => `
            <div class="order-card">
              <div>
                <div class="oc-ref">${E(o.ref)}</div>
                <div class="oc-date">${NV.dateFmt(o.createdAt)} · ${NV.timeFmt(o.createdAt)}</div>
              </div>
              ${NV.ui.statusBadge(o.status)}
              <div class="oc-items clamp-2">${o.items.length} ${o.items.length === 1 ? 'line' : 'lines'} — ${E(o.items.slice(0, 3).map(i => i.name).join(', '))}${o.items.length > 3 ? '…' : ''}</div>
              <div class="oc-total">${NV.money(o.totals ? o.totals.total : 0)}</div>
              <div class="oc-actions">
                <button class="btn btn-ghost btn-sm" data-reorder="${E(o.ref)}">${NV.icon('refresh')} Reorder</button>
                <a class="btn btn-primary btn-sm" href="/order.html?ref=${encodeURIComponent(o.ref)}">View ${NV.icon('arrowR')}</a>
              </div>
            </div>`).join('')
          : NV.ui.emptyState(all.length ? 'No orders match' : 'No orders yet', all.length ? 'Try another status or clear the search.' : 'When you place your first order it will appear here with live tracking.', all.length ? '' : '<a class="btn btn-primary" href="/shop.html">Start an order</a>')}
        </div>
      </div>`;

    document.getElementById('orderSearch').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); render(); const el = document.getElementById('orderSearch'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
    document.querySelectorAll('#statusChips [data-status]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.status; render(); }));
    document.getElementById('csvBtn').addEventListener('click', exportCsv);
    document.querySelectorAll('[data-reorder]').forEach(b => b.addEventListener('click', () => {
      const o = all.find(x => x.ref === b.dataset.reorder);
      if (!o) return;
      o.items.forEach(i => NV.basket.add(i.id, i.qty));
      NV.toast(`${o.items.length} lines from ${o.ref} added to your basket.`, { title: 'Reordered' });
      setTimeout(() => location.href = '/basket.html', 600);
    }));
  }

  function exportCsv() {
    const rows = [['Reference', 'Date', 'Status', 'Organisation', 'Lines', 'Subtotal', 'Delivery', 'VAT', 'Total']];
    all.forEach(o => rows.push([o.ref, o.createdAt, o.status, o.customer ? o.customer.organisation : '', o.items.length,
      o.totals ? o.totals.subtotal : 0, o.totals ? o.totals.delivery : 0, o.totals ? o.totals.vat : 0, o.totals ? o.totals.total : 0]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'norvex-orders.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    NV.toast('Order history exported.', { title: 'CSV ready' });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await load();
    render();
    NV.auth.onChange(async () => { await load(); render(); });
  });
})();
