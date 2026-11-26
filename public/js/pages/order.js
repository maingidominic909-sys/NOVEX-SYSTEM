/* NORVEX v2 — single order tracking + printable sheet */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  const FLOW = ['received', 'confirmed', 'sourcing', 'dispatched', 'delivered'];
  const LABEL = { received: 'Order received', confirmed: 'Confirmed by desk', sourcing: 'Sourcing & packing', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled' };

  async function findOrder(ref) {
    const local = NV.read('norvex.orders.local.v1', []);
    const hit = local.find(o => o.ref.toLowerCase() === ref.toLowerCase());
    if (hit) return hit;
    try { const res = await NV.api('/orders/' + encodeURIComponent(ref)); return res.order; }
    catch { return null; }
  }

  function trackForm(msg) {
    return `
      <div class="card card-pad" style="max-width:560px;margin:0 auto">
        <p class="eyebrow">Track an order</p>
        <h2 class="serif" style="font-size:1.5rem;margin-bottom:8px">Where is my supply?</h2>
        <p class="muted small mb-2">${E(msg || 'Enter the order reference from your confirmation — it looks like NVX-2611-A1B2C3.')}</p>
        <form class="track-form" id="trackForm">
          <input class="input" name="ref" placeholder="NVX-…" required aria-label="Order reference">
          <button class="btn btn-gold" type="submit">${NV.icon('search')} Track</button>
        </form>
        <p class="hint mt-2">Signed in? Find every reference in <a class="link-arrow gold" href="/orders.html">your order history ${NV.icon('arrowR')}</a></p>
      </div>`;
  }

  function timeline(o) {
    if (o.status === 'cancelled') {
      const hist = o.statusHistory || [];
      return `<div class="timeline">${hist.map(h => `
        <div class="tl-step ${h.status === 'cancelled' ? 'cancelled' : 'done'}">
          <h4>${E(LABEL[h.status] || h.status)}</h4>
          <span class="tl-time">${NV.dateFmt(h.at)} · ${NV.timeFmt(h.at)}</span>
          ${h.note ? `<p class="tl-note">${E(h.note)}</p>` : ''}
        </div>`).join('')}</div>`;
    }
    const idx = FLOW.indexOf(o.status);
    const histAt = s => { const h = (o.statusHistory || []).find(x => x.status === s); return h ? h : null; };
    return `<div class="timeline">${FLOW.map((s, i) => {
      const h = histAt(s);
      const cls = i < idx ? 'done' : i === idx ? 'now' : 'pending';
      return `<div class="tl-step ${cls}">
        <h4>${E(LABEL[s])}</h4>
        ${h ? `<span class="tl-time">${NV.dateFmt(h.at)} · ${NV.timeFmt(h.at)}</span>${h.note ? `<p class="tl-note">${E(h.note)}</p>` : ''}` : '<span class="tl-time">Pending</span>'}
      </div>`;
    }).join('')}</div>`;
  }

  function render(o) {
    document.title = o.ref + ' — Norvex order tracking';
    const c = o.customer || {}, d = o.delivery || {}, t = o.totals || {};
    const root = document.getElementById('orderRoot');
    root.innerHTML = `
      <div class="order-head">
        <div>
          <p class="eyebrow">Order sheet</p>
          <h1>${E(o.ref)}</h1>
          <div class="row wrap mt-1">${NV.ui.statusBadge(o.status)}<span class="muted small">Placed ${NV.dateFmt(o.createdAt)} at ${NV.timeFmt(o.createdAt)}${o.source === 'offline-preview' ? ' · offline preview' : ''}</span></div>
        </div>
        <div class="row wrap no-print">
          <button class="btn btn-ghost btn-sm" id="copyRef">${NV.icon('clipboard')} Copy ref</button>
          <button class="btn btn-ghost btn-sm" id="printBtn">${NV.icon('print2')} Print sheet</button>
          <button class="btn btn-gold btn-sm" id="reorderBtn">${NV.icon('refresh')} Reorder</button>
        </div>
      </div>
      <div class="order-layout">
        <div class="col" style="gap:20px">
          <div class="card card-pad">
            <h3 style="font-size:1rem;margin-bottom:18px">Progress</h3>
            ${timeline(o)}
          </div>
          <div class="card card-pad no-print">
            <h3 style="font-size:1rem;margin-bottom:10px">Need help with this order?</h3>
            <p class="small muted mb-2">Quote reference <b>${E(o.ref)}</b> and our desk will pick it up immediately.</p>
            <div class="col" style="gap:8px">
              <a class="btn btn-soft btn-sm" href="tel:${NV.CONFIG.phoneRaw}">${NV.icon('phone')} ${E(NV.CONFIG.phone)}</a>
              <a class="btn btn-soft btn-sm" target="_blank" rel="noopener" href="https://wa.me/${NV.CONFIG.whatsapp}?text=${encodeURIComponent('Hello Norvex, I need help with order ' + o.ref)}">${NV.icon('whatsapp')} WhatsApp the desk</a>
            </div>
          </div>
        </div>
        <div class="col" style="gap:20px">
          <div class="card card-pad">
            <h3 style="font-size:1rem;margin-bottom:16px">Details</h3>
            <div class="detail-list">
              <div class="dl-row">${NV.icon('building')}<span><small>Organisation</small><b>${E(c.organisation || '—')}</b> · ${E(c.name || '')}</span></div>
              <div class="dl-row">${NV.icon('mail')}<span><small>Contact</small><b>${E(c.email || '—')}</b> · ${E(c.phone || '')}</span></div>
              <div class="dl-row">${NV.icon('pin')}<span><small>Deliver to</small><b>${E(c.address || '—')}</b>${c.town ? ', ' + E(c.town) : ''}${c.county ? ', ' + E(c.county) : ''}</span></div>
              <div class="dl-row">${NV.icon('truck')}<span><small>Delivery method</small><b>${E(d.method || 'Standard delivery')}</b> · ${E(d.window || 'Next business day')}</span></div>
              <div class="dl-row">${NV.icon('wallet')}<span><small>Payment</small><b>${E(c.payment || 'Invoice request')}</b></span></div>
              ${c.notes ? `<div class="dl-row">${NV.icon('file')}<span><small>Notes</small>${E(c.notes)}</span></div>` : ''}
            </div>
            ${/mpesa|m-pesa/i.test(c.payment || '') ? `<div class="free-ship mt-2" style="margin-bottom:0">${NV.icon('phone')} M-Pesa Paybill <b>4168290</b> · Account <b>${E(o.ref)}</b> · Amount <b>${NV.money(t.total || 0)}</b></div>` : ''}
          </div>
          <div class="card">
            <div class="card-head"><h3>Items · ${o.items.length} ${o.items.length === 1 ? 'line' : 'lines'}</h3></div>
            <div class="table-wrap" style="border:0;border-radius:0">
              <table class="table">
                <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Total</th></tr></thead>
                <tbody>
                  ${o.items.map(i => `<tr><td><b>${E(i.name)}</b><br><small class="muted">${E(i.sku || i.id)} · ${E(i.unit)}</small></td><td class="num">${i.qty}</td><td class="num">${NV.money(i.unitPrice)}</td><td class="num">${NV.money(i.lineTotal)}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
            <div class="card-body" style="border-top:1px solid var(--line)">
              <div class="sum-rows" style="max-width:340px;margin-left:auto">
                <div class="sum-row"><span>Subtotal</span><span>${NV.money(t.subtotal || 0)}</span></div>
                ${(t.savings || 0) > 0 ? `<div class="sum-row save"><span>Tier savings</span><span>− ${NV.money(t.savings)}</span></div>` : ''}
                <div class="sum-row ${(t.delivery || 0) === 0 ? 'free' : ''}"><span>Delivery</span><span>${(t.delivery || 0) === 0 ? 'FREE' : NV.money(t.delivery)}</span></div>
                <div class="sum-row"><span>VAT 16%</span><span>${NV.money(t.vat || 0)}</span></div>
              </div>
              <div class="sum-total" style="max-width:340px;margin-left:auto;margin-bottom:0"><span class="bold">Total</span><b>${NV.money(t.total || 0)}</b></div>
            </div>
          </div>
          <p class="tiny muted">Norvex Integrated Enterprises Ltd · Upper Hill, Nairobi · ${E(NV.CONFIG.phone)} · ${E(NV.CONFIG.email)} — this sheet is a supply confirmation, not a tax invoice.</p>
        </div>
      </div>`;

    document.getElementById('copyRef').addEventListener('click', () => { NV.copy(o.ref); NV.toast('Reference copied.', { ms: 1600 }); });
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('reorderBtn').addEventListener('click', () => {
      o.items.forEach(i => NV.basket.add(i.id, i.qty));
      NV.toast('All lines added back to your basket.', { title: 'Reordered' });
      setTimeout(() => location.href = '/basket.html', 600);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const root = document.getElementById('orderRoot');
    const ref = (NV.queryString().get('ref') || '').trim();
    const wireForm = () => {
      const form = document.getElementById('trackForm');
      if (form) form.addEventListener('submit', e => {
        e.preventDefault();
        const v = form.querySelector('input').value.trim();
        if (v) location.href = '/order.html?ref=' + encodeURIComponent(v);
      });
    };
    if (!ref) { root.innerHTML = trackForm(); wireForm(); return; }
    root.innerHTML = '<div class="skel" style="height:120px;margin-bottom:20px"></div><div class="skel" style="height:340px"></div>';
    const order = await findOrder(ref);
    if (!order) { root.innerHTML = trackForm(`We couldn't find “${ref}”. Check the reference and try again.`); wireForm(); return; }
    render(order);
  });
})();
