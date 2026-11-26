/* Console — order tracking & confirmation */
(function () {
  const NV = window.NV;
  const STAGES = [
    { key: 'received', label: 'Order received', note: 'Logged by the Norvex desk' },
    { key: 'confirmed', label: 'Confirmed & quotation issued', note: 'Availability and pricing confirmed with you' },
    { key: 'sourcing', label: 'Sourcing & assembly', note: 'Items picked and quality checked' },
    { key: 'dispatched', label: 'Dispatched', note: 'On the way with delivery note' },
    { key: 'delivered', label: 'Delivered', note: 'Signed for at your premises' }
  ];

  let current = null;

  async function load(ref) {
    /* local queue first (offline preview orders), then API */
    const local = NV.read('norvex.orders.local.v1', []);
    const localHit = local.find(o => o.ref.toLowerCase() === ref.toLowerCase());
    if (localHit) return localHit;
    const res = await NV.api('/orders/' + encodeURIComponent(ref));
    return res.order;
  }

  function stageIndex(status) {
    if (status === 'cancelled') return -1;
    const i = STAGES.findIndex(s => s.key === status);
    return i < 0 ? 0 : i;
  }

  function paint(order) {
    current = order;
    document.getElementById('lookupView').classList.add('hide');
    document.getElementById('notFoundView').classList.add('hide');
    document.getElementById('orderView').classList.remove('hide');

    document.title = `${order.ref} — Norvex order`;
    document.getElementById('orderRef').textContent = order.ref;
    document.getElementById('placedAt').textContent = `Placed ${NV.dateFmt(order.createdAt)} · ${NV.timeFmt(order.createdAt)}`;
    const pill = document.getElementById('statusPill');
    pill.textContent = order.status;
    pill.className = 'pill';
    pill.style.background = { received: '#eef2f7', confirmed: '#eaf3fb', sourcing: '#f7eed8', dispatched: '#eef0fd', delivered: '#e6f4ec', cancelled: '#fbebea' }[order.status] || '#eef2f7';
    pill.style.color = { received: '#40597a', confirmed: '#2f5f8a', sourcing: '#a8802c', dispatched: '#4b46a8', delivered: '#1f7a4d', cancelled: '#b3261e' }[order.status] || '#40597a';

    const units = order.items.reduce((s, l) => s + l.qty, 0);
    document.getElementById('orderSummary').textContent = `${order.items.length} line${order.items.length === 1 ? '' : 's'} · ${units} units · ${order.customer.organisation}`;
    document.getElementById('lineMeta').textContent = `${order.items.length} lines`;
    document.getElementById('orderTotalFoot').textContent = NV.money(order.totals.total);

    /* items */
    document.getElementById('orderItems').innerHTML = order.items.map(l => `
      <tr>
        <td class="cell-main">${NV.esc(l.name)}<div class="cell-sub">${NV.esc(l.unit)} · ${NV.esc(l.sku || l.id)}</div></td>
        <td class="num">${l.qty}</td>
        <td class="num">${NV.money(l.unitPrice)}</td>
        <td class="num">${NV.money(l.lineTotal)}</td>
      </tr>`).join('');

    /* totals */
    document.getElementById('orderTotals').innerHTML = `
      <div class="srow"><span>Subtotal</span><span class="val">${NV.money(order.totals.subtotal)}</span></div>
      ${order.totals.savings ? `<div class="srow discount"><span>Volume savings</span><span class="val">−${NV.money(order.totals.savings)}</span></div>` : ''}
      <div class="srow"><span>Delivery</span><span class="val">${order.totals.delivery ? NV.money(order.totals.delivery) : 'Free'}</span></div>
      <div class="srow"><span>VAT (16%)</span><span class="val">${NV.money(order.totals.vat)}</span></div>
      <div class="srow total"><span>Total</span><span class="val">${NV.money(order.totals.total)}</span></div>`;

    /* timeline */
    const idx = stageIndex(order.status);
    const history = order.statusHistory || [];
    document.getElementById('orderTimeline').innerHTML = STAGES.map((s, i) => {
      const state = order.status === 'cancelled' ? (i === 0 ? 'done' : '') : i < idx ? 'done' : i === idx ? 'current' : '';
      const entry = history.find(h => h.status === s.key);
      return `<div class="tl-item ${state}">
        <span class="tl-dot">${state === 'done' ? '✓' : ''}</span>
        <div class="tl-body">
          <b>${s.label}</b>
          <small>${entry ? `${NV.dateFmt(entry.at)} · ${NV.timeFmt(entry.at)}${entry.note ? ' · ' + NV.esc(entry.note) : ''}` : s.note}</small>
        </div>
      </div>`;
    }).join('') + (order.status === 'cancelled' ? `<div class="tl-item done"><span class="tl-dot">✕</span><div class="tl-body"><b>Cancelled</b><small>This order was cancelled. Contact the desk if this is unexpected.</small></div></div>` : '');

    /* delivery + customer */
    document.getElementById('deliveryBlock').innerHTML = `
      <div class="stack-sm">
        <div><span class="label-xs" style="margin:0 0 4px">Address</span><div>${NV.esc(order.customer.address)}<br>${NV.esc(order.customer.town || '')}${order.customer.county ? ', ' + NV.esc(order.customer.county) : ''}</div></div>
        <div><span class="label-xs" style="margin:0 0 4px">Method</span><div>${NV.esc(order.delivery?.method || 'Standard delivery')} · ${NV.esc(order.delivery?.window || 'Business hours')}</div></div>
        <div><span class="label-xs" style="margin:0 0 4px">Zone</span><div>${NV.esc(order.delivery?.zone || 'Nairobi Metro')}</div></div>
        <div><span class="label-xs" style="margin:0 0 4px">Payment</span><div>${NV.esc(order.customer.payment || 'Invoice request')}</div></div>
      </div>`;

    /* payment instructions */
    const paymentBlock = document.getElementById('paymentBlock');
    if (paymentBlock) {
      const PS = window.NVPay;
      const pay = order.payment || {};
      const methodId = pay.method || (String(order.customer.payment || '').toLowerCase().includes('m-pesa') ? 'mpesa'
        : String(order.customer.payment || '').toLowerCase().includes('bank') ? 'bank'
        : String(order.customer.payment || '').toLowerCase().includes('card') ? 'card' : 'invoice');
      const m = PS ? PS.method(methodId) : { name: order.customer.payment || 'Invoice', logo: 'invoice', note: '' };
      const ref = order.ref;
      let body = '';
      if (methodId === 'mpesa') {
        body = `<div class="pay-details">
          <div><span>Paybill</span><b>${PS ? PS.BUSINESS.paybill : '4168290'}</b></div>
          <div><span>Account</span><b>${NV.esc(ref)}</b></div>
          <div><span>Till (Buy Goods)</span><b>${PS ? PS.BUSINESS.till : '5231187'}</b></div>
          <div><span>Amount</span><b>${NV.money(order.totals.total)}</b></div>
        </div>
        <p class="tiny muted" style="margin-top:10px">Use the order number as the account so your payment matches automatically${pay.phoneMasked ? ` · prompt sent to ${NV.esc(pay.phoneMasked)}` : ''}.</p>`;
      } else if (methodId === 'bank') {
        const b = PS ? PS.BUSINESS.bank : {};
        body = `<div class="pay-details">
          <div><span>Bank</span><b>${NV.esc(b.name || 'Equity Bank Kenya')}</b></div>
          <div><span>Account name</span><b>${NV.esc(b.accountName || 'Norvex Integrated Enterprises Ltd')}</b></div>
          <div><span>Account no.</span><b>${NV.esc(b.accountNo || '0170 2918 4473')}</b></div>
          <div><span>Reference</span><b>${NV.esc(pay.reference || ref)}</b></div>
          <div><span>Amount</span><b>${NV.money(order.totals.total)}</b></div>
        </div>
        <p class="tiny muted" style="margin-top:10px">Quote <b>${NV.esc(pay.reference || ref)}</b> on the transfer. Your order is held 48 hours while funds clear.</p>`;
      } else if (methodId === 'card') {
        body = `<div class="pay-details">
          <div><span>Card</span><b>${NV.esc(pay.brand || 'Card')} ending ${NV.esc(pay.last4 || '····')}</b></div>
          <div><span>Status</span><b>Authorised</b></div>
          <div><span>Amount</span><b>${NV.money(order.totals.total)}</b></div>
        </div>
        <p class="tiny muted" style="margin-top:10px">Tokenised securely — the full card number is never stored.</p>`;
      } else {
        body = `<div class="pay-details">
          <div><span>Terms</span><b>30 days from delivery</b></div>
          <div><span>LPO / requisition</span><b>${NV.esc(pay.lpo || order.customer.notes || 'To follow')}</b></div>
          <div><span>Amount</span><b>${NV.money(order.totals.total)}</b></div>
        </div>
        <p class="tiny muted" style="margin-top:10px">Our accounts desk emails the pro-forma invoice and credit terms.</p>`;
      }
      paymentBlock.innerHTML = `
        <div class="pay-confirm-head" style="margin:-18px -20px 14px;border-radius:0">
          <span class="lm" style="width:44px;height:30px;border-radius:6px;overflow:hidden;flex:none">${PS ? PS.LOGO[m.logo] : ''}</span>
          <span><b>${NV.esc(m.name)}</b><small>${NV.esc(pay.note || m.note || '')}</small></span>
        </div>
        ${body}`;
    }

    document.getElementById('customerBlock').innerHTML = `
      <div class="stack-sm">
        <div><span class="label-xs" style="margin:0 0 4px">Organisation</span><div>${NV.esc(order.customer.organisation)}</div></div>
        <div><span class="label-xs" style="margin:0 0 4px">Contact</span><div>${NV.esc(order.customer.name)}</div></div>
        <div><span class="label-xs" style="margin:0 0 4px">Email</span><div><a href="mailto:${NV.esc(order.customer.email)}" style="color:var(--green-800)">${NV.esc(order.customer.email)}</a></div></div>
        <div><span class="label-xs" style="margin:0 0 4px">Phone</span><div>${NV.esc(order.customer.phone)}</div></div>
        ${order.customer.notes ? `<div><span class="label-xs" style="margin:0 0 4px">Notes</span><div class="muted">${NV.esc(order.customer.notes)}</div></div>` : ''}
      </div>`;

    /* print sheet */
    document.getElementById('orderSheet').innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:14px">
        <div>
          <strong style="font-family:var(--font-serif);font-size:1.1rem;letter-spacing:.1em;color:var(--green-900)">NORVEX</strong>
          <div class="tiny muted">Integrated Enterprises Ltd<br>Nairobi, Kenya · ${NV.CONFIG.phone}<br>${NV.CONFIG.email}</div>
        </div>
        <div style="text-align:right">
          <div class="label-xs" style="margin:0 0 2px">Order reference</div>
          <div class="mono" style="font-size:.95rem;color:var(--green-900)">${order.ref}</div>
          <div class="tiny muted">${NV.dateFmt(order.createdAt)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px">
        <div><div class="label-xs" style="margin:0 0 2px">Bill to</div><div>${NV.esc(order.customer.organisation)}<br><span class="muted">${NV.esc(order.customer.name)} · ${NV.esc(order.customer.phone)}</span></div></div>
        <div><div class="label-xs" style="margin:0 0 2px">Deliver to</div><div>${NV.esc(order.customer.address)}<br><span class="muted">${NV.esc(order.customer.town || 'Nairobi')}</span></div></div>
      </div>
      <table class="data" style="font-size:.82rem">
        <thead><tr><th>Ref</th><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
        <tbody>${order.items.map(l => `<tr>
          <td class="mono tiny">${NV.esc(l.sku || l.id)}</td>
          <td>${NV.esc(l.name)}<div class="cell-sub">${NV.esc(l.unit)}</div></td>
          <td class="num">${l.qty}</td>
          <td class="num">${NV.money(l.unitPrice)}</td>
          <td class="num">${NV.money(l.lineTotal)}</td></tr>`).join('')}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <table style="font-size:.84rem">
          <tr><td style="padding:3px 18px 3px 0;color:var(--muted)">Subtotal</td><td style="text-align:right">${NV.money(order.totals.subtotal)}</td></tr>
          <tr><td style="padding:3px 18px 3px 0;color:var(--muted)">Delivery</td><td style="text-align:right">${order.totals.delivery ? NV.money(order.totals.delivery) : 'Free'}</td></tr>
          <tr><td style="padding:3px 18px 3px 0;color:var(--muted)">VAT 16%</td><td style="text-align:right">${NV.money(order.totals.vat)}</td></tr>
          <tr><td style="padding:6px 18px 0 0;font-weight:700;border-top:1px solid var(--line)">Total</td><td style="text-align:right;font-weight:700;border-top:1px solid var(--line);padding-top:6px">${NV.money(order.totals.total)}</td></tr>
        </table>
      </div>
      <p class="tiny muted" style="margin-top:14px">This is a system-generated order record. A formal quotation, delivery note and invoice are issued by the Norvex desk.</p>`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = NV.icon(el.dataset.icon));
    const params = NV.queryString();
    const ref = params.get('ref');

    if (!ref) {
      document.getElementById('lookupView').classList.remove('hide');
      document.getElementById('lookupForm').addEventListener('submit', async e => {
        e.preventDefault();
        const value = e.target.ref.value.trim();
        if (!value) return;
        try {
          paint(await load(value));
        } catch {
          document.getElementById('notFoundView').classList.remove('hide');
        }
      });
      return;
    }

    try {
      const order = await load(ref);
      paint(order);
      if (params.get('new')) {
        document.getElementById('newOrderBanner').classList.remove('hide');
        NV.toast('Keep this reference for tracking and quotation follow-up.', { title: 'Order placed' });
      }
    } catch {
      document.getElementById('notFoundView').classList.remove('hide');
    }

    document.getElementById('copyRef').addEventListener('click', () => {
      NV.copy(current ? current.ref : ref);
      NV.toast('Reference copied to clipboard.', { title: 'Copied' });
    });
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('reorderBtn').addEventListener('click', () => {
      if (!current) return;
      current.items.forEach(l => NV.basket.add(l.id, l.qty));
      NV.toast(`${current.items.length} lines added back to your supply basket.`, { title: 'Ready to reorder' });
      setTimeout(() => location.href = '/basket.html', 700);
    });
    document.getElementById('reorderBtn').classList.toggle('hide', !current);
  });
})();
