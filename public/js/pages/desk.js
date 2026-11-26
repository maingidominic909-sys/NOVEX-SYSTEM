/* NORVEX v2 — order desk landing */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  async function render() {
    const user = NV.auth && NV.auth.current();
    const lines = await NV.basket.lines();
    const t = NV.quote(lines);
    const local = NV.read('norvex.orders.local.v1', []);
    let remote = [];
    if (user) { try { const res = await NV.api('/orders?email=' + encodeURIComponent(user.email)); remote = res.orders || []; } catch {} }
    const seen = new Set();
    const orders = [...local, ...remote]
      .filter(o => o && o.ref && (seen.has(o.ref) ? false : (seen.add(o.ref), true)))
      .filter(o => !user || !o.customer || !o.customer.email || o.customer.email === user.email)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const open = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
    const spend = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totals ? o.totals.total : 0), 0);

    const hello = document.getElementById('deskHello');
    hello.textContent = user ? `Karibu, ${user.name.split(' ')[0]}.` : 'Your order desk.';
    document.getElementById('deskSub').textContent = user
      ? `${user.organisation} — everything you need to raise, track and repeat supply orders.`
      : 'Raise, track and repeat supply orders. Sign in to keep history across visits — browsing stays open.';
    const authCta = document.getElementById('deskAuthCta');
    authCta.innerHTML = user
      ? `<a class="btn btn-gold" href="/shop.html">${NV.icon('plus')} New order</a>
         <a class="btn btn-dark" href="/orders.html">${NV.icon('receipt')} My orders</a>
         <a class="btn btn-dark" href="/plan.html">${NV.icon('calendar')} Plan ahead</a>`
      : `<a class="btn btn-gold" href="/auth.html?mode=signin">${NV.icon('user')} Sign in</a>
         <a class="btn btn-dark" href="/auth.html?mode=signup">Create trade account</a>
         <a class="btn btn-dark" href="/shop.html">${NV.icon('layers')} Browse catalogue</a>`;

    document.getElementById('deskKpis').innerHTML = `
      <div class="kpi"><div class="kpi-top"><span class="kpi-label">Basket</span><span class="kpi-ico gold">${NV.icon('cart')}</span></div><div class="kpi-value">${NV.compact(t.subtotal)}</div><div class="kpi-sub">${lines.length} ${lines.length === 1 ? 'line' : 'lines'} ready</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-label">Open orders</span><span class="kpi-ico">${NV.icon('truck')}</span></div><div class="kpi-value">${open.length}</div><div class="kpi-sub">in the pipeline</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-label">Lifetime spend</span><span class="kpi-ico">${NV.icon('wallet')}</span></div><div class="kpi-value">${NV.compact(spend)}</div><div class="kpi-sub">${orders.length} orders total</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-label">Favourites</span><span class="kpi-ico gold">${NV.icon('heart')}</span></div><div class="kpi-value">${NV.favourites.all().length}</div><div class="kpi-sub">saved for re-order</div></div>`;

    const quick = [
      ['layers', 'Catalogue', '45+ lines, 13 departments', '/shop.html'],
      ['cart', 'Supply basket', 'Review lines & tier nudges', '/basket.html'],
      ['wallet', 'Checkout', '3 steps to a placed order', '/checkout.html'],
      ['receipt', 'Order history', 'Track, export, reorder', '/orders.html'],
      ['truck', 'Track my order', 'Live status by reference', '/order.html'],
      ['clipboard', 'Quote desk', 'Formal multi-line RFQ', '/quote.html'],
      ['calendar', 'Future planner', 'Recurring supply cycles', '/plan.html']
    ];
    if (user && user.role === 'admin') quick.push(['chart', 'Operations', 'Revenue & pipeline console', '/admin.html'], ['settings', 'Catalogue manager', 'Prices, pictures, departments', '/manage.html']);
    document.getElementById('deskQuick').innerHTML = quick.map(([icon, title, sub, href]) => `
      <a class="quick-card" href="${href}"><span class="qi">${NV.icon(icon)}</span><b>${title}</b><small>${sub}</small></a>`).join('');

    const recent = document.getElementById('deskRecent');
    recent.innerHTML = orders.slice(0, 4).map(o => `
      <div class="order-card">
        <div><div class="oc-ref">${E(o.ref)}</div><div class="oc-date">${NV.dateFmt(o.createdAt)}</div></div>
        ${NV.ui.statusBadge(o.status)}
        <div class="oc-items">${o.items.length} lines</div>
        <div class="oc-total">${NV.money(o.totals ? o.totals.total : 0)}</div>
        <a class="btn btn-ghost btn-sm" href="/order.html?ref=${encodeURIComponent(o.ref)}">Track ${NV.icon('arrowR')}</a>
      </div>`).join('') ||
      `<div class="card-body"><p class="muted small">No orders yet — your first order will appear here with live tracking. ${user ? '' : '<a class="link-arrow gold" href="/auth.html?mode=signin">Sign in to keep history ' + NV.icon('arrowR') + '</a>'}</p></div>`;

    const cat = await NV.catalog();
    document.getElementById('deskPopular').innerHTML = cat.products.filter(p => p.popular).slice(0, 4).map(p => NV.ui.productCard(p, cat)).join('');
    NV.reveal();
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    document.addEventListener('basket:change', render);
    NV.auth.onChange(render);
  });
})();
