/* Console — order desk overview */
(function () {
  const NV = window.NV;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = NV.icon(el.dataset.icon));
    await NV.catalog();

    document.getElementById('greeting').textContent = greeting;
    const saved = NV.customer.get();
    if (saved.name) document.getElementById('whoName').textContent = saved.name;
    else if (saved.organisation) document.getElementById('whoName').textContent = saved.organisation;

    await paintOrders(saved);
    await paintBasket();
    paintKpis(saved);
  });

  async function getOrders(saved) {
    const local = NV.read('norvex.orders.local.v1', []);
    let remote = [];
    try {
      const qs = new URLSearchParams();
      if (saved.email) qs.set('email', saved.email);
      else if (saved.organisation) qs.set('org', saved.organisation);
      remote = (await NV.api('/orders' + (qs.toString() ? '?' + qs : ''))).orders || [];
    } catch {}
    const seen = new Set();
    return [...local, ...remote].filter(o => (seen.has(o.ref) ? false : (seen.add(o.ref), true)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function paintOrders(saved) {
    const orders = await getOrders(saved);
    const body = document.getElementById('recentOrders');
    const empty = document.getElementById('recentEmpty');
    if (!orders.length) { body.innerHTML = ''; empty.classList.remove('hide'); return; }
    empty.classList.add('hide');
    body.innerHTML = orders.slice(0, 5).map(o => `
      <tr>
        <td><a class="cell-main mono" href="/order.html?ref=${encodeURIComponent(o.ref)}">${NV.esc(o.ref)}</a><div class="cell-sub">${o.items.length} lines · ${o.customer.organisation}</div></td>
        <td class="cell-sub">${NV.dateFmt(o.createdAt)}</td>
        <td class="num">${NV.money(o.totals.total)}</td>
        <td><span class="badge-status" data-status="${NV.esc(o.status)}">${NV.esc(o.status)}</span></td>
      </tr>`).join('');
    window.__orders = orders;
  }

  async function paintBasket() {
    const lines = await NV.basket.lines();
    const body = document.getElementById('deskBasket');
    const empty = document.getElementById('basketEmptyDesk');
    const foot = document.getElementById('basketTotals');
    if (!lines.length) {
      body.innerHTML = ''; empty.classList.remove('hide');
      foot.innerHTML = `<span class="tiny muted">No items in basket</span>`;
      return;
    }
    empty.classList.add('hide');
    body.innerHTML = lines.slice(0, 5).map(l => `
      <tr>
        <td class="cell-main" style="font-size:.84rem">${NV.esc(l.name)}<div class="cell-sub">${NV.esc(l.unit)}</div></td>
        <td class="num">${l.qty}</td>
        <td class="num">${NV.money(l.lineTotal)}</td>
      </tr>`).join('');
    const t = NV.quote(lines);
    foot.innerHTML = `<span class="tiny muted">${lines.length} lines · ${NV.basket.count()} units</span>
      <a href="/checkout.html" class="btn btn-gold btn-sm">Checkout ${NV.money(t.total)}</a>`;
  }

  async function paintKpis(saved) {
    const orders = window.__orders || [];
    const total = orders.reduce((s, o) => s + o.totals.total, 0);
    const open = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
    const lines = await NV.basket.lines();
    const basketValue = NV.quote(lines).subtotal;

    document.getElementById('deskKpis').innerHTML = `
      <div class="kpi accent">
        <div class="kpi-label">Basket value</div>
        <div class="kpi-value">${NV.money(basketValue)}</div>
        <div class="kpi-foot">${NV.basket.count()} units across ${lines.length} lines</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Open orders</div>
        <div class="kpi-value">${open}</div>
        <div class="kpi-foot">In progress with the desk</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Lifetime value</div>
        <div class="kpi-value">${NV.money(total)}</div>
        <div class="kpi-foot">${orders.length} orders placed</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Account terms</div>
        <div class="kpi-value" style="font-size:1.25rem">${saved.organisation ? 'Trade account' : 'Not set up'}</div>
        <div class="kpi-foot">${saved.organisation ? NV.esc(saved.organisation) : 'Add organisation details'}</div>
      </div>`;

    /* spend bars by category */
    const byCat = {};
    orders.forEach(o => o.items.forEach(i => { byCat[i.cat] = (byCat[i.cat] || 0) + i.lineTotal; }));
    const cat = await NV.catalog();
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const max = entries.length ? entries[0][1] : 1;
    document.getElementById('spendBars').innerHTML = entries.length ? entries.map(([id, value]) => {
      const name = (cat.categories.find(c => c.id === id) || {}).name || id;
      return `<div>
        <div class="row-between tiny" style="margin-bottom:4px"><span>${NV.esc(name)}</span><span class="mono">${NV.money(value)}</span></div>
        <div class="delivery-progress" style="margin:0"><i style="width:${Math.round((value / max) * 100)}%"></i></div>
      </div>`;
    }).join('') : `<p class="small muted">Your category spend will appear once orders are placed.</p>`;
  }
})();
