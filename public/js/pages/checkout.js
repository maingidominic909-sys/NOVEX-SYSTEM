/* NORVEX v2 — 3-step checkout with server pricing + offline fallback */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  let lines = [], step = 1, placing = false;
  const data = {
    name: '', organisation: '', email: '', phone: '',
    address: '', town: 'Nairobi', county: 'Nairobi', notes: '',
    deliveryMethod: 'Standard delivery', payment: 'M-Pesa'
  };

  const DELIVERY = [
    { id: 'Standard delivery', name: 'Standard delivery', desc: 'Next business day · Nairobi Metro', fee: 'KES 4,500 · free over 150K' },
    { id: 'Express delivery', name: 'Express (same day)', desc: 'Order before 11am · Nairobi Metro', fee: '+ KES 2,500' },
    { id: 'Pickup', name: 'Collect at depot', desc: 'Upper Hill, Nairobi · ready in 24h', fee: 'Free' }
  ];
  const PAYMENTS = [
    { id: 'M-Pesa', name: 'M-Pesa Paybill', desc: 'Paybill 4168290 · account = order reference', icon: 'phone' },
    { id: 'Bank transfer', name: 'Bank transfer', desc: 'Equity Bank · details on the order sheet', icon: 'building' },
    { id: 'Card', name: 'Debit / credit card', desc: 'Visa · Mastercard · 3-D Secure', icon: 'wallet' },
    { id: 'Invoice / LPO', name: 'Invoice / LPO', desc: '30-day terms for approved accounts', icon: 'receipt' }
  ];

  function totals() {
    const t = NV.quote(lines);
    let delivery = t.delivery;
    if (/express/i.test(data.deliveryMethod)) delivery += 2500;
    if (/pickup/i.test(data.deliveryMethod)) delivery = 0;
    const vat = Math.round((t.subtotal + delivery) * NV.CONFIG.vatRate);
    return { ...t, delivery, vat, total: t.subtotal + delivery + vat };
  }

  function renderSummary() {
    const t = totals();
    const mount = document.getElementById('coSummary');
    mount.innerHTML = `
      <div class="card card-pad summary-card">
        <h3 class="serif" style="font-size:1.15rem;margin-bottom:12px">Your order</h3>
        <div class="col" style="gap:9px;margin-bottom:14px">
          ${lines.map(l => `<div class="sum-row"><span class="clamp-2" style="max-width:200px">${E(l.name)} <span class="muted">× ${l.qty}</span></span><span>${NV.money(l.lineTotal)}</span></div>`).join('')}
        </div>
        <div class="sum-rows">
          <div class="sum-row"><span>Subtotal</span><span>${NV.money(t.subtotal)}</span></div>
          ${t.savings ? `<div class="sum-row save"><span>Tier savings</span><span>− ${NV.money(t.savings)}</span></div>` : ''}
          <div class="sum-row ${t.delivery === 0 ? 'free' : ''}"><span>Delivery</span><span>${t.delivery === 0 ? 'FREE' : NV.money(t.delivery)}</span></div>
          <div class="sum-row"><span>VAT 16%</span><span>${NV.money(t.vat)}</span></div>
        </div>
        <div class="sum-total"><span class="bold">Total</span><span><b>${NV.money(t.total)}</b><br><small>VAT inclusive</small></span></div>
        <p class="hint">${NV.icon('shield')} Prices are re-verified against the live catalogue when you place the order.</p>
      </div>`;
  }

  function renderSteps() {
    document.querySelectorAll('.step-pill').forEach(el => {
      const n = parseInt(el.dataset.step, 10);
      el.classList.toggle('on', n === step);
      el.classList.toggle('done', n < step);
      el.querySelector('.n').innerHTML = n < step ? NV.icon('check') : String(n);
    });
    document.querySelectorAll('.co-panel').forEach(el => el.classList.toggle('on', parseInt(el.dataset.panel, 10) === step));
    if (step === 3) renderReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindFields() {
    document.querySelectorAll('#checkoutForm [name]').forEach(input => {
      if (data[input.name] != null && input.type !== 'radio') input.value = data[input.name];
      input.addEventListener('input', () => {
        data[input.name] = input.value;
        input.closest('.field').classList.remove('bad');
      });
    });
    const del = document.getElementById('deliveryOptions');
    del.innerHTML = DELIVERY.map(d => `
      <label class="pay-opt ${data.deliveryMethod === d.id ? 'on' : ''}">
        <input type="radio" name="deliveryMethod" value="${E(d.id)}" ${data.deliveryMethod === d.id ? 'checked' : ''}>
        <span><b>${E(d.name)}</b><small>${E(d.desc)}<br><b class="gold">${E(d.fee)}</b></small></span>
      </label>`).join('');
    const pay = document.getElementById('paymentOptions');
    pay.innerHTML = PAYMENTS.map(p => `
      <label class="pay-opt ${data.payment === p.id ? 'on' : ''}">
        <input type="radio" name="payment" value="${E(p.id)}" ${data.payment === p.id ? 'checked' : ''}>
        <span><b>${NV.icon(p.icon)} ${E(p.name)}</b><small>${E(p.desc)}</small></span>
      </label>`).join('');
    document.querySelectorAll('input[name="deliveryMethod"],input[name="payment"]').forEach(r => r.addEventListener('change', () => {
      data[r.name] = r.value;
      document.querySelectorAll(`input[name="${r.name}"]`).forEach(x => x.closest('.pay-opt').classList.toggle('on', x.checked));
      renderSummary();
    }));
  }

  function validate(fields) {
    let ok = true;
    fields.forEach(name => {
      const input = document.querySelector(`#checkoutForm [name="${name}"]`);
      if (!input) return;
      const field = input.closest('.field');
      let good = String(data[name] || '').trim().length > 0;
      if (name === 'email') good = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(data.email || '').trim());
      if (name === 'phone') good = String(data.phone || '').replace(/\D/g, '').length >= 9;
      field.classList.toggle('bad', !good);
      if (!good) ok = false;
    });
    if (!ok) NV.toast('Please complete the highlighted fields.', { type: 'error', title: 'Almost there' });
    return ok;
  }

  function renderReview() {
    const t = totals();
    document.getElementById('reviewBlocks').innerHTML = `
      <div class="review-block">
        <h4>Organisation <button type="button" data-goto="1">Edit</button></h4>
        <p><b>${E(data.organisation)}</b> · ${E(data.name)}<br>${E(data.email)} · ${E(data.phone)}</p>
      </div>
      <div class="review-block">
        <h4>Delivery &amp; payment <button type="button" data-goto="2">Edit</button></h4>
        <p>${E(data.address)}, ${E(data.town)}${data.county ? ', ' + E(data.county) : ''}<br>
        ${E(data.deliveryMethod)} · ${E(data.payment)}${data.notes ? `<br><span class="muted">“${E(data.notes)}”</span>` : ''}</p>
      </div>
      <div class="table-wrap" style="margin-bottom:14px">
        <table class="table">
          <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
          <tbody>${lines.map(l => `<tr><td><b>${E(l.name)}</b><br><small class="muted">${E(l.unit)}</small></td><td class="num">${l.qty}</td><td class="num">${NV.money(l.unitPrice)}</td><td class="num">${NV.money(l.lineTotal)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <p class="hint">By placing this order you accept Norvex supply terms. ${data.payment === 'Invoice / LPO' ? 'Invoice terms apply after account approval.' : 'Payment instructions follow on the order sheet.'}</p>`;
    document.querySelectorAll('#reviewBlocks [data-goto]').forEach(b => b.addEventListener('click', () => { step = parseInt(b.dataset.goto, 10); renderSteps(); }));
    document.getElementById('placeBtn').innerHTML = `${NV.icon('check')} Place order · ${NV.money(t.total)}`;
  }

  function localOrder() {
    const t = totals();
    const now = new Date().toISOString();
    return {
      ref: NV.ref('NVX'), createdAt: now, status: 'received',
      statusHistory: [{ status: 'received', at: now, note: 'Captured in offline preview mode — will sync when the API is reachable' }],
      customer: { name: data.name, email: data.email.toLowerCase(), phone: data.phone, organisation: data.organisation, address: data.address, town: data.town, county: data.county, notes: data.notes, payment: data.payment },
      delivery: { method: data.deliveryMethod, window: /express/i.test(data.deliveryMethod) ? 'Same day' : 'Next business day', zone: 'Nairobi Metro (Zone A)' },
      items: lines.map(l => ({ id: l.id, sku: l.id.toUpperCase(), name: l.name, unit: l.unit, cat: l.cat, qty: l.qty, unitPrice: l.unitPrice, listPrice: l.listPrice, lineTotal: l.lineTotal })),
      totals: { subtotal: t.subtotal, delivery: t.delivery, vat: t.vat, total: t.total, savings: t.savings, currency: 'KES' },
      source: 'offline-preview'
    };
  }

  async function placeOrder() {
    if (placing) return;
    if (NV.auth && !NV.auth.isIn()) {
      NV.auth.require({ returnTo: '/checkout.html', title: 'Sign in to place your order', body: 'One last step — sign in or create a trade account so this order lives in your history.' });
      return;
    }
    placing = true;
    const btn = document.getElementById('placeBtn');
    btn.disabled = true;
    btn.innerHTML = 'Placing order…';
    let order = null, offline = false;
    try {
      const res = await NV.api('/orders', {
        method: 'POST',
        body: {
          customer: { name: data.name, organisation: data.organisation, email: data.email, phone: data.phone, address: data.address, town: data.town, county: data.county, notes: data.notes, payment: data.payment },
          items: lines.map(l => ({ id: l.id, qty: l.qty })),
          deliveryMethod: data.deliveryMethod,
          deliveryWindow: /express/i.test(data.deliveryMethod) ? 'Same day' : 'Next business day',
          source: 'web-v2'
        }
      });
      order = res.order;
    } catch (err) {
      if (err.offline) { order = localOrder(); offline = true; const rows = NV.read('norvex.orders.local.v1', []); rows.unshift(order); NV.write('norvex.orders.local.v1', rows); }
      else {
        NV.toast(err.message || 'Could not place the order.', { type: 'error', title: 'Order not placed' });
        placing = false; btn.disabled = false; renderReview();
        return;
      }
    }
    NV.customer.save({ name: data.name, organisation: data.organisation, email: data.email, phone: data.phone, address: data.address, town: data.town, county: data.county });
    NV.basket.clear();
    document.getElementById('checkoutMain').classList.add('hide');
    const s = document.getElementById('checkoutSuccess');
    s.classList.remove('hide');
    s.innerHTML = `
      <div class="success-hero">
        <span class="ok">${NV.icon('check')}</span>
        <p class="eyebrow centered">Order received</p>
        <h1>Thank you, ${E(data.name.split(' ')[0] || 'friend')} — we're on it.</h1>
        <p class="lede" style="margin:0 auto">${E(data.organisation)} will receive confirmation on ${E(data.email)}. Our desk confirms availability within business hours.</p>
        <div class="ref-chip">${E(order.ref)} <button id="copyRef" aria-label="Copy reference">${NV.icon('clipboard')}</button></div>
        ${offline ? '<p class="hint">Offline preview — this order is saved on this device and will appear in your order history.</p>' : ''}
        <div class="card card-pad" style="max-width:460px;margin:16px auto;text-align:left">
          <b class="small">Next step · payment</b>
          <p class="small muted mt-1">Complete your order securely with M-Pesa, card, bank transfer or invoice/LPO — amount <b>${NV.money(order.totals.total)}</b>.</p>
        </div>
        <div class="row wrap" style="justify-content:center;margin-top:20px">
          <a class="btn btn-gold" href="/payment.html?ref=${encodeURIComponent(order.ref)}">${NV.icon('wallet')} Proceed to payment</a>
          <a class="btn btn-ghost" href="/order.html?ref=${encodeURIComponent(order.ref)}">${NV.icon('truck')} Track order</a>
          <a class="btn btn-ghost" href="/orders.html">${NV.icon('receipt')} Order history</a>
        </div>
      </div>`;
    document.getElementById('copyRef').addEventListener('click', () => { NV.copy(order.ref); NV.toast('Reference copied.', { ms: 1800 }); });
    window.scrollTo({ top: 0 });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    lines = await NV.basket.lines();
    const empty = document.getElementById('checkoutEmpty');
    if (!lines.length) {
      document.getElementById('checkoutMain').classList.add('hide');
      empty.classList.remove('hide');
      empty.innerHTML = NV.ui.emptyState('Nothing to check out yet', 'Your basket is empty. Add supply lines first — it takes under a minute.', '<a class="btn btn-primary" href="/shop.html">Browse catalogue</a>');
      return;
    }
    /* prefill from saved customer / signed-in identity */
    const saved = NV.customer.get();
    Object.keys(data).forEach(k => { if (saved[k]) data[k] = saved[k]; });
    const user = NV.auth && NV.auth.current();
    if (user) { data.name = user.name; data.organisation = user.organisation; data.email = user.email; data.phone = user.phone; }
    if (NV.auth && !NV.auth.isIn()) {
      NV.auth.pageGuard({ mount: '#checkoutGuard', title: 'Sign in to complete checkout', body: 'You can fill the steps now — placing the order needs a trade account so it lands in your history.' });
    }
    bindFields();
    renderSummary();
    renderSteps();

    document.getElementById('next1').addEventListener('click', () => { if (validate(['name', 'organisation', 'email', 'phone'])) { step = 2; renderSteps(); } });
    document.getElementById('next2').addEventListener('click', () => { if (validate(['address', 'town'])) { step = 3; renderSteps(); } });
    document.getElementById('back2').addEventListener('click', () => { step = 1; renderSteps(); });
    document.getElementById('back3').addEventListener('click', () => { step = 2; renderSteps(); });
    document.getElementById('placeBtn').addEventListener('click', placeOrder);
    document.addEventListener('basket:change', async () => {
      lines = await NV.basket.lines();
      if (!lines.length && !document.getElementById('checkoutSuccess').classList.contains('hide')) return;
      if (!lines.length) location.href = '/basket.html';
      else renderSummary();
    });
  });
})();
