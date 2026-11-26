/* Console — order history */
(function () {
  const NV = window.NV;
  let all = [];
  let status = 'all';
  let query = '';

  const badge = s => `<span class="badge-status" data-status="${NV.esc(s)}">${NV.esc(s)}</span>`;

  function paint() {
    const rows = all.filter(o =>
      (status === 'all' || o.status === status) &&
      (!query || (o.ref + ' ' + o.items.map(i => i.name).join(' ') + ' ' + (o.customer?.organisation || '')).toLowerCase().includes(query.toLowerCase())));

    const body = document.getElementById('historyBody');
    const empty = document.getElementById('historyEmpty');
    const table = document.getElementById('historyTable');

    document.getElementById('historyMeta').textContent = `${rows.length} of ${all.length} orders`;

    if (!rows.length) {
      table.classList.add('hide');
      empty.classList.remove('hide');
    } else {
      table.classList.remove('hide');
      empty.classList.add('hide');
      body.innerHTML = rows.map(o => `
        <tr>
          <td><a class="cell-main mono" href="/order.html?ref=${encodeURIComponent(o.ref)}">${NV.esc(o.ref)}</a><div class="cell-sub">${o.items.length} line${o.items.length === 1 ? '' : 's'}</div></td>
          <td>${NV.dateFmt(o.createdAt)}<div class="cell-sub">${NV.timeFmt(o.createdAt)}</div></td>
          <td class="cell-sub" style="max-width:220px">${NV.esc(o.items.slice(0, 2).map(i => i.name).join(', '))}${o.items.length > 2 ? ' +' + (o.items.length - 2) : ''}</td>
          <td class="num">${NV.money(o.totals.total)}</td>
          <td>${badge(o.status)}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" data-reorder="${NV.esc(o.ref)}">Reorder</button>
            <a class="btn btn-sm" href="/order.html?ref=${encodeURIComponent(o.ref)}">Open</a>
          </td>
        </tr>`).join('');
      body.querySelectorAll('[data-reorder]').forEach(btn => btn.onclick = () => {
        const order = all.find(o => o.ref === btn.dataset.reorder);
        order.items.forEach(i => NV.basket.add(i.id, i.qty));
        NV.toast(`${order.items.length} lines added to your basket.`, { title: 'Ready to reorder' });
        setTimeout(() => location.href = '/basket.html', 700);
      });
    }

    /* KPIs */
    const total = all.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totals.total, 0);
    const open = all.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
    const units = all.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
    document.getElementById('historyKpis').innerHTML = `
      <div class="kpi accent"><div class="kpi-label">Lifetime value</div><div class="kpi-value">${NV.money(total)}</div><div class="kpi-foot">${all.length} orders placed</div></div>
      <div class="kpi"><div class="kpi-label">Open orders</div><div class="kpi-value">${open}</div><div class="kpi-foot">In progress with the desk</div></div>
      <div class="kpi"><div class="kpi-label">Units procured</div><div class="kpi-value">${units}</div><div class="kpi-foot">Across all lines</div></div>
      <div class="kpi"><div class="kpi-label">Average order</div><div class="kpi-value">${all.length ? NV.money(Math.round(total / all.length)) : NV.money(0)}</div><div class="kpi-foot">Per confirmed order</div></div>`;

    /* reorder favourites */
    const counts = {};
    all.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + i.qty));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const block = document.getElementById('reorderBlock');
    block.innerHTML = top.length
      ? top.map(([name, qty]) => `<div class="row-between" style="padding:8px 0;border-bottom:1px solid #f0f2ee"><span>${NV.esc(name)}</span><span class="tiny muted">${qty} units</span></div>`).join('')
      : `<p class="small muted">Your most-ordered lines will appear here once you've placed a few orders.</p>`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (NV.auth && !NV.auth.isIn()) NV.auth.pageGuard({ title: 'Sign in to see your orders', body: 'Your order history, delivery notes and re-order shortcuts live inside your trade account.' });

    document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = NV.icon(el.dataset.icon));

    const local = NV.read('norvex.orders.local.v1', []);
    let remote = [];
    try {
      const saved = NV.customer.get();
      const qs = new URLSearchParams();
      if (saved.email) qs.set('email', saved.email);
      else if (saved.organisation) qs.set('org', saved.organisation);
      const res = await NV.api('/orders' + (qs.toString() ? '?' + qs : ''));
      remote = res.orders || [];
    } catch { /* offline — local only */ }

    const seen = new Set();
    all = [...local, ...remote].filter(o => seen.has(o.ref) ? false : (seen.add(o.ref), true))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    paint();

    document.querySelectorAll('#statusSeg button').forEach(btn => btn.onclick = () => {
      document.querySelectorAll('#statusSeg button').forEach(b => b.classList.toggle('on', b === btn));
      status = btn.dataset.status;
      paint();
    });
    document.getElementById('historySearch').addEventListener('input', e => { query = e.target.value; paint(); });

    document.getElementById('exportCsv').onclick = () => {
      if (!all.length) { NV.toast('There are no orders to export yet.', { title: 'Nothing to export', type: 'error' }); return; }
      const head = ['Reference', 'Date', 'Lines', 'Units', 'Total', 'Status', 'Organisation'];
      const rows = all.map(o => [o.ref, new Date(o.createdAt).toISOString().slice(0, 10), o.items.length,
        o.items.reduce((s, i) => s + i.qty, 0), o.totals.total, o.status, o.customer.organisation]);
      const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `norvex-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      NV.toast('Order history exported as CSV.', { title: 'Export ready' });
    };
  });
})();
