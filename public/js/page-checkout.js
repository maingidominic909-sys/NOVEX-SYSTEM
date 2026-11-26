/* Console — checkout wizard (organisation → delivery → payment → review) */
(function () {
  const NV = window.NV;
  const PS = window.NVPay;
  let lines = [];
  let step = 1;
  let payMethod = 'mpesa';

  const form = () => document.getElementById('checkoutForm');

  function setStep(n) {
    step = n;
    document.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('hide', Number(p.dataset.panel) !== n));
    document.querySelectorAll('#wizSteps .wstep').forEach(el => {
      const i = Number(el.dataset.step);
      el.classList.toggle('on', i === n);
      el.classList.toggle('done', i < n);
    });
    if (n === 3) paintPayment();
    if (n === 4) paintReview();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  }

  function validatePanel(n) {
    const panel = document.querySelector(`[data-panel="${n}"]`);
    if (!panel) return true;
    let ok = true;
    panel.querySelectorAll('[required]').forEach(input => {
      const field = input.closest('.field') || input.parentElement;
      const empty = input.type === 'checkbox' ? !input.checked : !String(input.value).trim();
      const badEmail = input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value);
      if (empty || badEmail) ok = false;
      if (field.classList.contains('field')) field.classList.toggle('has-error', empty || badEmail);
    });
    if (ok && n === 3 && PS) {
      const res = PS.validate(payMethod, document.getElementById('payFields'));
      if (!res.ok) {
        ok = false;
        NV.toast(res.errors[0].message, { title: 'Check your payment details', type: 'error' });
      }
    }
    if (ok && n === 4 && !document.getElementById('termsCheck').checked) {
      NV.toast('Please accept the confirmation statement to place the order.', { title: 'One more tick', type: 'error' });
      ok = false;
    }
    if (!ok && !(n === 4 && !document.getElementById('termsCheck').checked)) {
      NV.toast('Please complete the highlighted fields before continuing.', { title: 'Missing details', type: 'error' });
    }
    return ok;
  }

  function deliveryFee() {
    const method = form().querySelector('input[name="deliveryMethod"]:checked')?.value || 'Standard delivery';
    const sub = lines.reduce((s, l) => s + l.lineTotal, 0);
    if (method === 'Collect from hub') return 0;
    if (method === 'Express (same-day)') return 2500;
    if (method === 'Upcountry consignment') return 6500;
    return sub >= NV.CONFIG.freeDeliveryFrom ? 0 : NV.CONFIG.deliveryFee;
  }

  function totals() {
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const savings = lines.reduce((s, l) => s + (l.listPrice - l.unitPrice) * l.qty, 0);
    const delivery = deliveryFee();
    const vat = Math.round((subtotal + delivery) * NV.CONFIG.vatRate);
    return { subtotal, delivery, vat, savings, total: subtotal + delivery + vat };
  }

  function paintSummary() {
    const t = totals();
    document.getElementById('summaryItems').innerHTML = lines.map(l => `
      <div style="display:flex;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line-soft)">
        <span class="cart-thumb" style="width:40px;height:40px;overflow:hidden;border-radius:8px;display:block;position:static">
          <img src="${NV.ui.productThumb(l)}" alt="" width="40" height="40" loading="lazy" style="width:40px;height:40px;object-fit:cover;border-radius:8px">
        </span>
        <div style="min-width:0">
          <div style="font-size:.84rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${NV.esc(l.name)}</div>
          <div class="tiny muted">${l.qty} × ${NV.esc(l.unit)}</div>
        </div>
        <div style="margin-left:auto;font-size:.82rem;font-weight:600;white-space:nowrap">${NV.money(l.lineTotal)}</div>
      </div>`).join('') || `<p class="small muted" style="padding:16px 0">Your basket is empty.</p>`;

    document.getElementById('summaryTotals').innerHTML = `
      <div class="srow"><span>Subtotal</span><span class="val">${NV.money(t.subtotal)}</span></div>
      ${t.savings > 0 ? `<div class="srow discount"><span>Volume savings</span><span class="val">−${NV.money(t.savings)}</span></div>` : ''}
      <div class="srow"><span>Delivery</span><span class="val">${t.delivery ? NV.money(t.delivery) : 'Free'}</span></div>
      <div class="srow"><span>VAT (16%)</span><span class="val">${NV.money(t.vat)}</span></div>
      <div class="srow total"><span>Total</span><span class="val">${NV.money(t.total)}</span></div>
      <div class="pay-badges" style="padding:14px 0 0;justify-content:flex-start">
        ${PS.METHODS.map(m => `<span class="lm" title="${m.name}">${PS.LOGO[m.logo]}</span>`).join('')}
      </div>`;

    const std = document.getElementById('priceStandard');
    if (std) std.textContent = t.subtotal >= NV.CONFIG.freeDeliveryFrom ? 'Free' : NV.money(NV.CONFIG.deliveryFee);
    return t;
  }

  function paintPayment() {
    const wrap = document.getElementById('paySelector');
    const fields = document.getElementById('payFields');
    if (!wrap || wrap.dataset.built === '1') return;
    wrap.dataset.built = '1';
    wrap.innerHTML = PS.selector(payMethod);
    fields.innerHTML = PS.METHODS.map(m => PS.fields(m.id, { total: totals().total, ref: 'your order number' })).join('');
    PS.paintPanels(fields, payMethod);
    PS.wire(document.getElementById('checkoutForm'), id => {
      payMethod = id;
      const phone = document.querySelector('[name="mpesaPhone"]');
      if (phone && !phone.value) { const saved = NV.customer.get(); if (saved.phone) phone.value = saved.phone; }
    });
    const phone = document.querySelector('[name="mpesaPhone"]');
    const saved = NV.customer.get();
    if (phone && !phone.value && saved.phone) phone.value = saved.phone;
    paintSummary();
  }

  function paintReview() {
    document.getElementById('reviewItems').innerHTML = `
      <table class="data" style="font-size:.84rem">
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
        <tbody>${lines.map(l => `<tr>
          <td class="cell-main">${NV.esc(l.name)}<div class="cell-sub">${NV.esc(l.unit)}</div></td>
          <td class="num">${l.qty}</td>
          <td class="num">${NV.money(l.unitPrice)}</td>
          <td class="num">${NV.money(l.lineTotal)}</td></tr>`).join('')}
        </tbody>
      </table>`;

    const f = form();
    const town = f.town.value || 'Nairobi';
    document.getElementById('reviewDelivery').innerHTML =
      `${NV.esc(f.address.value || '—')}<br>${NV.esc(town)}, ${NV.esc(f.county.value || '—')}<br>
       ${NV.esc(f.deliveryMethod.value)} · ${NV.esc(f.deliveryWindow.value)}
       ${f.requiredDate.value ? `<br>Preferred: ${NV.esc(f.requiredDate.value)}` : ''}`;
    document.getElementById('reviewContact').innerHTML =
      `${NV.esc(f.name.value)}<br>${NV.esc(f.organisation.value)}<br>${NV.esc(f.email.value)}<br>${NV.esc(f.phone.value)}`;

    const cap = PS.capture(payMethod, document.getElementById('payFields'));
    const m = PS.method(payMethod);
    document.getElementById('reviewPayLogo').innerHTML = PS.LOGO[m.logo];
    document.getElementById('reviewPayName').textContent = m.name;
    document.getElementById('reviewPayNote').textContent = m.note;

    const rows = [];
    if (payMethod === 'mpesa') {
      rows.push(['Paybill', PS.BUSINESS.paybill]);
      rows.push(['Account', 'Your order number (issued on confirmation)']);
      rows.push(['Till (Buy Goods)', PS.BUSINESS.till]);
      if (cap.phoneMasked) rows.push(['Prompt to', cap.phoneMasked]);
    } else if (payMethod === 'bank') {
      rows.push(['Bank', PS.BUSINESS.bank.name]);
      rows.push(['Account name', PS.BUSINESS.bank.accountName]);
      rows.push(['Account no.', PS.BUSINESS.bank.accountNo]);
      rows.push(['Your reference', cap.reference || '—']);
    } else if (payMethod === 'card') {
      rows.push(['Card', `${cap.brand || 'Card'} ending ${cap.last4 || '····'}`]);
      rows.push(['Expiry', cap.expiry || '—']);
      rows.push(['Security', '3-D Secure tokenised']);
    } else {
      rows.push(['Terms', '30 days from delivery']);
      rows.push(['LPO', cap.lpo || 'To follow']);
    }
    rows.push(['Amount', NV.money(totals().total)]);
    document.getElementById('reviewPayBody').innerHTML = `<div class="pay-details">${rows.map(([k, v]) => `<div><span>${k}</span><b>${NV.esc(v)}</b></div>`).join('')}</div>`;
    paintSummary();
  }

  /* ---------- account gate: an order needs a signed-in customer ---------- */
  function prefillFromAccount() {
    const user = NV.auth && NV.auth.current();
    if (!user) return;
    const f = form();
    if (!f) return;
    const set = (name, value) => { const el = f.querySelector(`[name="${name}"]`); if (el && !el.value && value) el.value = value; };
    set('name', user.name);
    set('organisation', user.organisation);
    set('email', user.email);
    set('phone', user.phone.replace(/^\+254/, '0'));
    paintAccountChip(user);
  }

  function paintAccountChip(user) {
    const host = document.getElementById('checkoutAccount');
    if (!host) return;
    host.className = 'co-account ' + (user ? 'is-in' : 'is-out');
    host.innerHTML = user
      ? `<span class="co-account-avatar">${NV.esc(user.avatar)}</span>
         <span class="co-account-body"><b>${NV.esc(user.name)}</b><small>${NV.esc(user.organisation)} · ${NV.esc(user.email)}</small></span>
         <button type="button" class="co-account-btn" id="coSignOut">Sign out</button>`
      : `<span class="co-account-avatar">?</span>
         <span class="co-account-body"><b>You are checking out as a guest</b><small>Sign in or create an account to place this order.</small></span>
         <button type="button" class="co-account-btn gold" id="coSignIn">Sign in</button>`;
    const out = document.getElementById('coSignOut');
    if (out) out.onclick = () => { NV.auth.signOut({ redirect: false }); paintAccountChip(null); NV.toast('Signed out — your basket is saved.', { title: 'Signed out' }); };
    const signIn = document.getElementById('coSignIn');
    if (signIn) signIn.onclick = () => {
      NV.auth.rememberReturn('/checkout.html');
      NV.auth.gate({ title: 'Sign in to place your order', body: 'Your basket is saved on this device. Create a trade account in under a minute or sign in to continue.' });
    };
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = NV.icon(el.dataset.icon));
    paintAccountChip(NV.auth ? NV.auth.current() : null);
    if (NV.auth) NV.auth.onChange(user => paintAccountChip(user));
    lines = await NV.basket.lines();

    if (!document.getElementById('checkoutForm')) return;

    if (!lines.length) {
      document.querySelector('.layout-2col').innerHTML = `
        <div class="panel" style="grid-column:1/-1">
          <div class="empty-state">
            <div class="icon-wrap" data-icon="cart"></div>
            <h3>There is nothing to check out</h3>
            <p>Your supply basket is empty. Add a few catalogue lines and come back.</p>
            <a href="/shop.html" class="btn btn-gold">Browse catalogue</a>
          </div>
        </div>`;
      const wiz = document.getElementById('wizSteps');
      if (wiz) wiz.classList.add('hide');
      return;
    }

    const saved = NV.customer.get();
    const f = form();
    ['name', 'organisation', 'email', 'phone', 'address', 'town', 'county'].forEach(k => { if (saved[k] && f[k]) f[k].value = saved[k]; });

    paintSummary();

    f.querySelectorAll('.input, .select, .textarea').forEach(el => el.addEventListener('input', () => el.closest('.field')?.classList.remove('has-error')));
    f.querySelectorAll('input[name="deliveryMethod"]').forEach(r => r.addEventListener('change', paintSummary));

    document.querySelectorAll('[data-next]').forEach(btn => btn.onclick = () => {
      const current = Number(btn.closest('[data-panel]').dataset.panel);
      if (validatePanel(current)) setStep(Number(btn.dataset.next));
    });
    document.querySelectorAll('[data-prev]').forEach(btn => btn.onclick = () => setStep(Number(btn.dataset.prev)));
    const editPayment = document.getElementById('editPayment');
    if (editPayment) editPayment.addEventListener('click', e => { e.preventDefault(); setStep(3); });

    f.addEventListener('submit', async e => {
      e.preventDefault();
      if (NV.auth && !NV.auth.isIn()) {
        NV.auth.rememberReturn('/checkout.html');
        NV.auth.gate({ title: 'One step left — sign in to confirm', body: 'Your details and basket are ready. Sign in or create an account and we will bring you straight back to this review step.' });
        return;
      }
      if (!validatePanel(3) || !validatePanel(4)) { if (!validatePanel(3)) setStep(3); return; }

      const btn = document.getElementById('placeOrder');
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Placing order…';
      btn.classList.add('is-disabled');

      const data = Object.fromEntries(new FormData(f).entries());
      const payment = PS.capture(payMethod, document.getElementById('payFields'));
      const t = totals();

      const payload = {
        customer: {
          name: data.name, organisation: data.organisation, email: data.email, phone: data.phone,
          address: data.address, town: data.town, county: data.county,
          notes: [data.notes, data.lpo ? `LPO: ${data.lpo}` : '', data.department ? `Dept: ${data.department}` : ''].filter(Boolean).join(' · '),
          payment: payment.label, paymentMethod: payment.method, paymentDetail: PS.summary(payment)
        },
        payment,
        deliveryMethod: data.deliveryMethod,
        deliveryWindow: data.deliveryWindow,
        requiredDate: data.requiredDate,
        items: lines.map(l => ({ id: l.id, qty: l.qty })),
        source: 'web-checkout'
      };

      if (payment.method === 'card') {
        try { await NV.api('/payments/card', { method: 'POST', body: { token: payment.token, amount: t.total } }); } catch (err) {}
      }

      try {
        const res = await NV.api('/orders', { method: 'POST', body: payload });
        NV.customer.save({ name: data.name, organisation: data.organisation, email: data.email, phone: data.phone, address: data.address, town: data.town, county: data.county });
        NV.basket.clear();
        NV.__nvNav ? NV.__nvNav(`/order.html?ref=${encodeURIComponent(res.order.ref)}&new=1`) : (location.href = `/order.html?ref=${encodeURIComponent(res.order.ref)}&new=1`);
      } catch (err) {
        if (err.offline) {
          const order = {
            ref: NV.ref('NVX'), createdAt: new Date().toISOString(), status: 'received',
            statusHistory: [{ status: 'received', at: new Date().toISOString(), note: 'Captured in offline preview mode' }],
            customer: payload.customer,
            payment,
            delivery: { method: data.deliveryMethod, window: data.deliveryWindow, zone: 'Nairobi Metro' },
            items: lines.map(l => ({ id: l.id, sku: l.id.toUpperCase(), name: l.name, unit: l.unit, cat: l.cat, qty: l.qty, unitPrice: l.unitPrice, listPrice: l.listPrice, lineTotal: l.lineTotal })),
            totals: t,
            source: 'offline-preview'
          };
          const rows = NV.read('norvex.orders.local.v1', []);
          rows.unshift(order);
          NV.write('norvex.orders.local.v1', rows);
          NV.basket.clear();
          NV.toast(`Order captured — pay by ${PS.method(payment.method).name}.`, { title: 'Order placed' });
          setTimeout(() => {
            const to = `/order.html?ref=${encodeURIComponent(order.ref)}&new=1`;
            NV.__nvNav ? NV.__nvNav(to) : (location.href = to);
          }, 500);
        } else {
          NV.toast(err.message, { title: 'Order not placed', type: 'error' });
          btn.innerHTML = original;
          btn.classList.remove('is-disabled');
        }
      }
    });

    setStep(1);
  });
})();
