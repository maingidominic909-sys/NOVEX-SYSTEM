/* NORVEX v2 — operations console */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  const FLOW = ['received', 'confirmed', 'sourcing', 'dispatched', 'delivered'];
  const COLORS = { received: '#2c5f88', confirmed: '#c9a24a', sourcing: '#96691d', dispatched: '#5b5390', delivered: '#177350', cancelled: '#b23a30' };

  function guard() {
    document.getElementById('adminRoot').innerHTML = `
      <div class="auth-guard">
        <div class="auth-guard-body">
          <p class="eyebrow">Restricted · operations</p>
          <h2>Administrator sign-in required</h2>
          <p>The operations console shows revenue, the order pipeline and enquiries. Sign in with an administrator account to continue.</p>
          <p class="hint mt-1">Demo administrator: <b>admin@norvex.co.ke</b> · <b>Norvex2026</b></p>
        </div>
        <div class="auth-guard-actions">
          <a class="btn btn-gold" href="/auth.html?mode=signin&next=/admin.html">Sign in as admin</a>
          <a class="btn btn-ghost" href="/index.html">Back to storefront</a>
        </div>
      </div>`;
  }

  async function loadData() {
    try {
      const [summary, ordersRes] = await Promise.all([NV.api('/admin/summary'), NV.api('/orders')]);
      return { summary, orders: ordersRes.orders || [], offline: false };
    } catch {
      const orders = NV.read('norvex.orders.local.v1', []);
      const enquiries = NV.read('norvex.enquiries.local.v1', []);
      const plans = NV.read('norvex.plans.local.v1', []);
      const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totals ? o.totals.total : 0), 0);
      const byStatus = {};
      orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
      const skus = {};
      orders.forEach(o => o.items.forEach(i => { skus[i.name] = (skus[i.name] || 0) + i.qty; }));
      return {
        offline: true, orders,
        summary: {
          kpis: { orders: orders.length, revenue, openOrders: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length, futureOrders: plans.length, enquiries: enquiries.length, avgOrderValue: orders.length ? Math.round(revenue / orders.length) : 0 },
          byStatus,
          topItems: Object.entries(skus).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty })),
          recentEnquiries: enquiries.slice(0, 6)
        }
      };
    }
  }

  function barChart(orders) {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const total = orders.filter(o => String(o.createdAt).slice(0, 10) === key && o.status !== 'cancelled')
        .reduce((s, o) => s + (o.totals ? o.totals.total : 0), 0);
      days.push({ label: d.toLocaleDateString('en-GB', { day: 'numeric' }), total });
    }
    const max = Math.max(1, ...days.map(d => d.total));
    return `<div class="bar-chart">${days.map(d => `
      <div class="bar" title="${NV.money(d.total)}"><i style="height:${Math.max(3, Math.round(d.total / max * 100))}%"></i><small>${d.label}</small></div>`).join('')}</div>`;
  }

  function donut(byStatus) {
    const entries = Object.entries(byStatus).filter(([, n]) => n > 0);
    const total = entries.reduce((s, [, n]) => s + n, 0);
    if (!total) return '<p class="muted small">No orders yet — the status mix appears after the first order.</p>';
    const R = 48, C = 2 * Math.PI * R;
    let offset = 0;
    const arcs = entries.map(([s, n]) => {
      const frac = n / total;
      const el = `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${COLORS[s] || '#999'}" stroke-width="17" stroke-dasharray="${frac * C} ${C}" stroke-dashoffset="${-offset * C}" transform="rotate(-90 66 66)"/>`;
      offset += frac;
      return el;
    }).join('');
    return `<div class="donut-wrap">
      <svg class="donut" viewBox="0 0 132 132">${arcs}<text x="66" y="62" text-anchor="middle" font-size="22" font-weight="700" fill="#152420" font-family="Georgia,serif">${total}</text><text x="66" y="80" text-anchor="middle" font-size="10" fill="#69796f">orders</text></svg>
      <ul class="legend">${entries.map(([s, n]) => `<li><span class="dot" style="background:${COLORS[s] || '#999'}"></span>${E(s)}<b>${n}</b></li>`).join('')}</ul>
    </div>`;
  }

  async function render() {
    const user = NV.auth.current();
    if (!user || user.role !== 'admin') return guard();
    const root = document.getElementById('adminRoot');
    root.innerHTML = '<div class="kpi-grid mb-3">' + Array.from({ length: 6 }, () => '<div class="skel" style="height:110px"></div>').join('') + '</div><div class="skel" style="height:260px"></div>';
    const { summary, orders, offline } = await loadData();
    const k = summary.kpis;
    const maxQty = Math.max(1, ...(summary.topItems || []).map(t => t.qty));

    root.innerHTML = `
      ${offline ? '<div class="auth-guard" style="background:var(--amber-50);border-color:#ecd9ac;margin-bottom:20px"><div class="auth-guard-body"><h2 style="font-size:1.05rem">Offline preview</h2><p class="small">Showing orders captured on this device. Live figures return when the API is reachable.</p></div></div>' : ''}
      <div class="row between wrap mb-3">
        <div>
          <p class="eyebrow">Operations console</p>
          <h1 class="serif" style="font-size:1.7rem">Business at a glance</h1>
        </div>
        <div class="row wrap">
          <a class="btn btn-ghost btn-sm" href="/manage.html">${NV.icon('settings')} Catalogue manager</a>
          <button class="btn btn-primary btn-sm" id="refreshAdmin">${NV.icon('refresh')} Refresh</button>
        </div>
      </div>
      <div class="kpi-grid mb-3">
        <div class="kpi"><div class="kpi-top"><span class="kpi-label">Revenue</span><span class="kpi-ico gold">${NV.icon('wallet')}</span></div><div class="kpi-value">${NV.compact(k.revenue)}</div><div class="kpi-sub">VAT incl · excl. cancelled</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-label">Orders</span><span class="kpi-ico">${NV.icon('receipt')}</span></div><div class="kpi-value">${k.orders}</div><div class="kpi-sub">all time</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-label">Open orders</span><span class="kpi-ico">${NV.icon('truck')}</span></div><div class="kpi-value">${k.openOrders}</div><div class="kpi-sub">need action</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-label">Avg order</span><span class="kpi-ico gold">${NV.icon('chart')}</span></div><div class="kpi-value">${NV.compact(k.avgOrderValue)}</div><div class="kpi-sub">per placed order</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-label">Future plans</span><span class="kpi-ico">${NV.icon('calendar')}</span></div><div class="kpi-value">${k.futureOrders}</div><div class="kpi-sub">reserved cycles</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-label">New enquiries</span><span class="kpi-ico gold">${NV.icon('mail')}</span></div><div class="kpi-value">${k.enquiries}</div><div class="kpi-sub">awaiting reply</div></div>
      </div>

      <div class="admin-charts mb-3">
        <div class="chart-box">
          <h3>Revenue · last 14 days</h3>
          <p class="sub">Placed order value per day (VAT inclusive)</p>
          ${barChart(orders)}
        </div>
        <div class="chart-box">
          <h3>Status mix</h3>
          <p class="sub">Where orders sit in the pipeline</p>
          ${donut(summary.byStatus || {})}
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-head"><h3>Order pipeline</h3><span class="small muted">${orders.length} orders · advance status inline</span></div>
        <div class="table-wrap" style="border:0;border-radius:0">
          <table class="table">
            <thead><tr><th>Reference</th><th>Date</th><th>Organisation</th><th class="num">Lines</th><th class="num">Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${orders.slice(0, 15).map(o => `
                <tr data-ref="${E(o.ref)}">
                  <td><b class="serif">${E(o.ref)}</b></td>
                  <td class="nowrap">${NV.dateFmt(o.createdAt)}</td>
                  <td>${E(o.customer ? o.customer.organisation : '—')}</td>
                  <td class="num">${o.items.length}</td>
                  <td class="num">${NV.money(o.totals ? o.totals.total : 0)}</td>
                  <td>
                    <select class="select status-select" data-status-ref="${E(o.ref)}" aria-label="Status for ${E(o.ref)}">
                      ${[...FLOW, 'cancelled'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
                    </select>
                  </td>
                  <td><a class="btn btn-ghost btn-sm" href="/order.html?ref=${encodeURIComponent(o.ref)}">View</a></td>
                </tr>`).join('') || '<tr><td colspan="7" class="muted center" style="padding:30px">No orders yet. Place one from the storefront to see the pipeline.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><h3>Top moving lines</h3></div>
          <div class="card-body">
            ${(summary.topItems || []).map((t, i) => `
              <div class="topline">
                <span class="rank">${i + 1}</span>
                <span class="tl-name">${E(t.name)}</span>
                <span class="tl-bar progress green"><i style="width:${Math.round(t.qty / maxQty * 100)}%"></i></span>
                <span class="tl-qty">${t.qty} units</span>
              </div>`).join('') || '<p class="muted small">Order data will rank your best movers here.</p>'}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Latest enquiries</h3><a class="btn btn-ghost btn-sm" href="/contact.html">Contact form</a></div>
          <div class="card-body" style="padding-top:6px">
            ${(summary.recentEnquiries || []).map(q => `
              <div class="enq-item">
                <div class="enq-top"><b>${E(q.name)}</b>${NV.ui.statusBadge(q.status || 'new')}<span class="badge gray">${E(q.type || 'general')}</span></div>
                <p class="enq-msg">${E(q.message)}</p>
                <p class="enq-meta">${E(q.organisation || '')} · ${E(q.email)} · ${NV.dateFmt(q.createdAt)} · ${E(q.ref)}</p>
              </div>`).join('') || '<p class="muted small" style="padding:12px 0">No enquiries yet — quote requests and contact messages land here.</p>'}
          </div>
        </div>
      </div>`;

    document.getElementById('refreshAdmin').addEventListener('click', render);
    document.querySelectorAll('[data-status-ref]').forEach(sel => sel.addEventListener('change', async () => {
      const ref = sel.dataset.statusRef;
      const status = sel.value;
      sel.disabled = true;
      try {
        await NV.api('/orders/' + encodeURIComponent(ref), { method: 'PATCH', body: { status, note: 'Advanced from the operations console' } });
        NV.toast(`${ref} → ${status}. The buyer's timeline is updated.`, { title: 'Status advanced' });
      } catch (err) {
        if (err.offline) {
          const rows = NV.read('norvex.orders.local.v1', []);
          const o = rows.find(x => x.ref === ref);
          if (o) {
            o.status = status;
            o.statusHistory = [...(o.statusHistory || []), { status, at: new Date().toISOString(), note: 'Advanced offline' }];
            NV.write('norvex.orders.local.v1', rows);
            NV.toast(`${ref} → ${status} (offline).`, { title: 'Status advanced' });
          }
        } else {
          NV.toast(err.message, { type: 'error', title: 'Not updated' });
          render();
        }
      }
      sel.disabled = false;
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    NV.auth.onChange(render);
  });
})();
