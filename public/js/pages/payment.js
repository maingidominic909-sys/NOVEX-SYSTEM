/* NORVEX — payments: M-Pesa, card, bank transfer, invoice/LPO */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  const $ = id => document.getElementById(id);
  const q = NV.queryString();
  const ref = q.get('ref') || '';

  const META = {
    mpesa: { icon: 'phone', cls: 'mpesa', name: 'M-Pesa', tag: 'Instant', blurb: 'STK prompt to your phone' },
    card: { icon: 'wallet', cls: 'card', name: 'Card', tag: '3-D Secure', blurb: 'Visa · Mastercard · Amex' },
    bank: { icon: 'building', cls: 'bank', name: 'Bank transfer', tag: '48h hold', blurb: 'Equity Bank · EFT' },
    invoice: { icon: 'receipt', cls: 'invoice', name: 'Invoice / LPO', tag: '30-day terms', blurb: 'Approved accounts' }
  };

  const nameToId = { 'M-Pesa': 'mpesa', 'Card': 'card', 'Bank transfer': 'bank', 'Invoice / LPO': 'invoice' };

  let order = null, bank = null, recent = [];
  let selected = nameToId[NV.read('norvex.paymethod.v1', 'M-Pesa')] || 'mpesa';

  const F = (f, n) => f.querySelector(`[name="${n}"]`);
  const amount = () => order ? order.totals.total : 0;
  const amountField = () => order ? '' : `<div class="field"><label>Amount (KES)</label><input class="input" name="amount" type="number" min="1" placeholder="e.g. 25000" required><span class="err-msg">Enter an amount.</span></div>`;
  const readAmt = f => { if (order) return order.totals.total; const a = F(f, 'amount'); return Math.round(Number(a && a.value) || 0); };
  const badAmount = f => { const a = F(f, 'amount'); if (a) a.closest('.field').classList.add('bad'); };

  function panelHtml() {
    const u = NV.auth && NV.auth.current();
    const phone = u && u.phone ? u.phone : '';
    if (selected === 'mpesa') return `
      <h3>M-Pesa</h3>
      <p class="pp-note">Enter your Safaricom number and we'll send an STK prompt${order ? ` for <b>${NV.money(amount())}</b>` : ''}. Paybill <b class="gold">4168290</b> · account <b>${E(ref || 'your order ref')}</b>.</p>
      <form class="pay-form" id="mpesaForm" novalidate>
        <div class="field"><label>Safaricom number</label><input class="input" name="phone" type="tel" placeholder="0722 000 000" value="${E(phone)}"><span class="err-msg">Enter a valid Safaricom number.</span></div>
        ${amountField()}
        <button class="btn btn-primary" type="submit">${NV.icon('phone')} Send M-Pesa prompt</button>
      </form>`;
    if (selected === 'card') return `
      <h3>Debit / credit card</h3>
      <p class="pp-note">Secured with 3-D Secure. Card details are tokenised — never stored.</p>
      <form class="pay-form" id="cardForm" novalidate>
        <div class="field"><label>Card number</label><input class="input" name="number" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242"><span class="err-msg">Enter a valid card number.</span></div>
        <div class="field"><label>Name on card</label><input class="input" name="name" autocomplete="cc-name" placeholder="Grace Wanjiru"></div>
        <div class="row" style="gap:12px">
          <div class="field" style="flex:1"><label>Expiry</label><input class="input" name="expiry" placeholder="MM/YY" autocomplete="cc-exp"></div>
          <div class="field" style="flex:1"><label>CVV</label><input class="input" name="cvv" inputmode="numeric" placeholder="123" autocomplete="cc-csc"></div>
        </div>
        ${amountField()}
        <button class="btn btn-primary" type="submit">${NV.icon('lock')} Pay ${order ? NV.money(amount()) : 'securely'}</button>
      </form>`;
    if (selected === 'bank') return `
      <h3>Bank transfer</h3>
      <p class="pp-note">Transfer to the account below, then confirm. Funds clear within ${bank && bank.holdHours ? bank.holdHours : 48} hours.</p>
      <div class="pay-bank">
        <div class="pb-row"><span>Bank</span><b>${E(bank ? bank.name : 'Equity Bank Kenya')}</b></div>
        <div class="pb-row"><span>Account name</span><b>${E(bank ? bank.accountName : 'Norvex Integrated Enterprises Ltd')}</b></div>
        <div class="pb-row"><span>Account no.</span><b class="gold">${E(bank ? bank.accountNo : '0170 2918 4473')}</b></div>
        <div class="pb-row"><span>Branch · SWIFT</span><b>${E(bank ? bank.branch : 'Upper Hill')} · ${E(bank ? bank.swift : 'EQBLKENA')}</b></div>
        ${order ? `<div class="pb-row"><span>Amount</span><b>${NV.money(amount())}</b></div>` : ''}
      </div>
      <form class="pay-form" id="bankForm" style="margin-top:16px" novalidate>
        ${amountField()}
        <button class="btn btn-primary" type="submit">${NV.icon('check')} I have transferred</button>
      </form>`;
    return `
      <h3>Invoice / LPO</h3>
      <p class="pp-note">For approved institutions. We issue a 30-day invoice against your LPO; payment follows on agreed terms.</p>
      <form class="pay-form" id="invoiceForm" novalidate>
        <div class="field"><label>LPO / reference number</label><input class="input" name="lpo" placeholder="LPO-2026-001"><span class="err-msg">Enter your LPO reference.</span></div>
        ${amountField()}
        <button class="btn btn-primary" type="submit">${NV.icon('receipt')} Request invoice</button>
      </form>`;
  }

  function render() {
    const root = $('paymentRoot');
    root.innerHTML = `
      <div class="pay-wrap">
        <div class="section-head" style="margin-bottom:18px">
          <div><p class="eyebrow">Secure checkout</p><h1 class="h-section">Payment</h1></div>
          <a class="link-arrow" href="/orders.html">${NV.icon('receipt')} My orders</a>
        </div>
        ${order ? `
          <div class="pay-due">
            <div><div class="pd-label">${order.paid ? 'Paid in full' : 'Amount due'}</div><div class="pd-amount">${NV.money(order.totals.total)}</div><div class="pd-ref">${E(order.ref)} · ${E(order.customer ? order.customer.organisation : '')}${order.paid && order.payment ? ` · ${E(order.payment.method)}` : ''}</div></div>
            <span class="badge ${order.paid ? 'green' : 'gold'}">${order.paid ? 'Paid' : E(order.status)}</span>
          </div>` : `
          <div class="pay-due">
            <div><div class="pd-label">Pay for an order</div><div class="pd-amount">Choose a method</div><div class="pd-ref">Enter an amount below, or open an order from your history to pay its exact total.</div></div>
            ${NV.icon('wallet')}
          </div>`}
        <div class="pay-methods">
          ${Object.entries(META).map(([id, m]) => `
            <button class="pay-method ${selected === id ? 'on' : ''}" type="button" data-method="${id}" aria-pressed="${selected === id}">
              <span class="pm-tag">${m.tag}</span>
              <span class="pm-ico ${m.cls}">${NV.paymentMark(id)}</span>
              <b>${m.name}</b><small>${m.blurb}</small>
            </button>`).join('')}
        </div>
        <div class="pay-panel" id="payPanel">${panelHtml()}</div>
        ${!order && recent.length ? `
          <div class="card" style="margin-top:20px">
            <div class="card-head"><h3>Recent orders</h3></div>
            <div class="card-body" style="padding-top:8px">
              ${recent.slice(0, 5).map(o => `<div class="fav-row"><span class="manage-art">${NV.icon('receipt')}</span><div class="spread"><b>${E(o.ref)}</b><small>${E(o.customer ? o.customer.organisation : '')} · ${NV.money(o.totals ? o.totals.total : 0)}</small></div><a class="btn btn-soft btn-sm" href="/payment.html?ref=${encodeURIComponent(o.ref)}">Pay</a></div>`).join('')}
            </div>
          </div>` : ''}
      </div>`;
    wire();
  }

  async function markPaid(receipt) {
    if (!ref) return;
    const method = META[selected].name;
    const amt = order ? order.totals.total : 0;
    const payment = { method, receipt: receipt || '', amount: amt };
    try { const r = await NV.api('/orders/' + encodeURIComponent(ref), { method: 'PATCH', body: { paid: true, payment } }); if (r.order) order = r.order; } catch {}
    try {
      const rows = NV.read('norvex.orders.local.v1', []);
      const i = rows.findIndex(o => o.ref === ref);
      if (i >= 0) { rows[i] = { ...rows[i], paid: true, paidAt: new Date().toISOString(), payment }; NV.write('norvex.orders.local.v1', rows); }
    } catch {}
  }

  function success(title, code, note) {
    NV.write('norvex.paymethod.v1', META[selected].name);
    if (ref) markPaid(code);
    $('payPanel').innerHTML = `
      <div class="pay-success">
        <span class="ok">${NV.icon('check')}</span>
        <h3>${E(title)}</h3>
        ${ref ? `<p class="pp-note" style="margin:6px auto 0"><b class="gold">${E(ref)}</b> marked as paid.</p>` : ''}
        <p class="pp-note" style="margin:8px auto 0;max-width:46ch">${E(note)}</p>
        ${code ? `<div class="pay-receipt">${NV.icon('receipt')} ${E(code)} <button class="btn btn-ghost btn-sm" id="copyReceipt" aria-label="Copy receipt">${NV.icon('clipboard')}</button></div>` : ''}
        <div class="row wrap" style="justify-content:center;margin-top:16px">
          ${ref ? `<a class="btn btn-gold" href="/order.html?ref=${encodeURIComponent(ref)}">${NV.icon('truck')} Track order</a>` : ''}
          <a class="btn btn-ghost" href="/account.html">${NV.icon('user')} My account</a>
          <a class="btn btn-ghost" href="/shop.html">Continue shopping</a>
        </div>
      </div>`;
    const cp = $('copyReceipt');
    if (cp) cp.addEventListener('click', () => { NV.copy(code); NV.toast('Receipt copied.', { ms: 1600 }); });
    window.scrollTo({ top: 0 });
  }

  function wire() {
    document.querySelectorAll('[data-method]').forEach(b => b.addEventListener('click', () => {
      selected = b.dataset.method;
      NV.write('norvex.paymethod.v1', META[selected].name);
      render();
    }));

    const mp = $('mpesaForm');
    if (mp) mp.addEventListener('submit', async e => {
      e.preventDefault();
      const amt = readAmt(mp);
      if (!amt) { badAmount(mp); return; }
      const btn = mp.querySelector('button'); btn.disabled = true;
      try {
        const r = await NV.api('/payments/mpesa/stk', { method: 'POST', body: { phone: F(mp, 'phone').value, amount: amt } });
        success('M-Pesa prompt sent', r.receipt, `Confirm the prompt on ${E(r.phone)} for ${NV.money(amt)}. ${E(r.note || '')}`);
      } catch (err) { NV.toast(err.message || 'Could not send prompt', { type: 'error', title: 'M-Pesa' }); btn.disabled = false; }
    });

    const cf = $('cardForm');
    if (cf) cf.addEventListener('submit', async e => {
      e.preventDefault();
      const amt = readAmt(cf);
      if (!amt) { badAmount(cf); return; }
      const btn = cf.querySelector('button'); btn.disabled = true;
      try {
        const r = await NV.api('/payments/card', { method: 'POST', body: { number: F(cf, 'number').value, amount: amt } });
        success('Card authorised', r.token, `${E(r.brand || 'Card')} ending ${E(r.last4 || '')} · ${NV.money(amt)}. ${E(r.note || '')}`);
      } catch (err) { NV.toast(err.message || 'Card declined', { type: 'error', title: 'Card' }); btn.disabled = false; }
    });

    const bf = $('bankForm');
    if (bf) bf.addEventListener('submit', e => {
      e.preventDefault();
      const amt = readAmt(bf);
      if (!amt) { badAmount(bf); return; }
      success('Transfer recorded', 'EFT-' + Date.now().toString(36).toUpperCase(), `We'll match your ${NV.money(amt)} transfer and confirm within 48 hours.`);
    });

    const inf = $('invoiceForm');
    if (inf) inf.addEventListener('submit', e => {
      e.preventDefault();
      const lpo = F(inf, 'lpo');
      if (!lpo.value.trim()) { lpo.closest('.field').classList.add('bad'); return; }
      const amt = readAmt(inf);
      success('Invoice requested', 'INV-' + Date.now().toString(36).toUpperCase(), `A 30-day invoice${amt ? ` for ${NV.money(amt)}` : ''} against ${E(lpo.value)} will be issued after account approval.`);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const u = NV.auth && NV.auth.current();
    if (u && u.role === 'admin') {
      $('paymentRoot').innerHTML = `<div class="auth-guard"><div class="auth-guard-body"><p class="eyebrow">Admin mode</p><h2>Admins don't make payments</h2><p>Payment records and reconciliation live in the operations console. Customer checkout and paying are disabled for administrator accounts.</p></div><div class="auth-guard-actions"><a class="btn btn-gold" href="/admin.html">${NV.icon('chart')} Open operations console</a><a class="btn btn-ghost" href="/index.html">Back to storefront</a></div></div>`;
      return;
    }
    try { const m = await NV.api('/payments/methods'); bank = (m.methods || []).find(x => x.id === 'bank') || null; if (bank) bank = { ...bank, ...(bank.bank || {}) }; } catch {}
    if (ref) {
      try { const r = await NV.api('/orders/' + encodeURIComponent(ref)); order = r.order || null; } catch {}
    } else {
      const u = NV.auth && NV.auth.current();
      if (u) { try { const r = await NV.api('/orders?email=' + encodeURIComponent(u.email)); recent = r.orders || []; } catch {} }
    }
    render();
  });
})();
