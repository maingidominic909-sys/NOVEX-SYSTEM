/* NORVEX v2 — supply basket */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  function goCheckout() {
    if (NV.auth && !NV.auth.isIn()) {
      NV.auth.require({ returnTo: '/checkout.html', title: 'Sign in to check out', body: 'Your basket is saved. Sign in or create a trade account to place this order.' });
    } else location.href = '/checkout.html';
  }

  /* sticky total + checkout CTA above the phone bottom bar */
  function renderCheckoutBar(total) {
    let bar = document.getElementById('checkoutBar');
    if (total == null) {
      if (bar) bar.remove();
      document.body.classList.remove('has-checkoutbar');
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'checkoutBar';
      bar.className = 'checkout-bar';
      document.body.appendChild(bar);
    }
    document.body.classList.add('has-checkoutbar');
    bar.innerHTML = `
      <div class="cb-total"><small>Total · VAT incl.</small><b>${NV.money(total)}</b></div>
      <button class="btn btn-gold" id="barCheckout" type="button">Checkout ${NV.icon('arrowR')}</button>`;
    document.getElementById('barCheckout').addEventListener('click', goCheckout);
  }

  async function render() {
    const u = NV.auth && NV.auth.current();
    if (u && u.role === 'admin') {
      renderCheckoutBar(null);
      document.getElementById('basketRoot').classList.add('hide');
      const empty = document.getElementById('basketEmpty');
      empty.classList.remove('hide');
      empty.innerHTML = `<div class="auth-guard"><div class="auth-guard-body"><p class="eyebrow">Admin mode</p><h2>Admins don't place orders</h2><p>You manage every order from the operations console — advance status, handle enquiries and control the catalogue. Buying is disabled for administrator accounts.</p></div><div class="auth-guard-actions"><a class="btn btn-gold" href="/admin.html">${NV.icon('chart')} Open operations console</a><a class="btn btn-ghost" href="/index.html">Back to storefront</a></div></div>`;
      return;
    }
    const lines = await NV.basket.lines();
    const root = document.getElementById('basketRoot');
    const empty = document.getElementById('basketEmpty');
    if (!lines.length) {
      renderCheckoutBar(null);
      root.classList.add('hide');
      empty.classList.remove('hide');
      empty.innerHTML = NV.ui.emptyState(
        'Your supply basket is empty',
        'Add lines from the catalogue — volume pricing kicks in automatically as quantities grow.',
        '<a class="btn btn-primary" href="/shop.html">Browse the catalogue</a> <a class="btn btn-ghost" href="/quote.html" style="margin-left:8px">Request a quote</a>'
      );
      return;
    }
    empty.classList.add('hide');
    root.classList.remove('hide');
    const t = NV.quote(lines);

    document.getElementById('basketLines').innerHTML = `
      <div class="card-head">
        <h3>${lines.length} supply ${lines.length === 1 ? 'line' : 'lines'}</h3>
        <button class="btn btn-ghost btn-sm" id="clearBasket">${NV.icon('trash')} Clear basket</button>
      </div>
      ${lines.map(l => {
        const next = l.product.tiers.find(([min]) => min > l.qty);
        return `
        <div class="bline" data-id="${E(l.id)}">
          ${l.product.img ? `<img src="${E(l.product.img)}" alt="">` : `<span class="bl-art">${NV.icon(NV.catIcon(l.cat))}</span>`}
          <div>
            <b><a href="/product.html?id=${E(l.id)}">${E(l.name)}</a></b>
            <div class="bl-meta">${E(l.unit)} · MOQ ${l.moq} · lead ${E(l.lead)}</div>
            <div class="bl-unit"><b>${NV.money(l.unitPrice)}</b> <span class="muted small">each${l.unitPrice < l.listPrice ? ` · was ${NV.money(l.listPrice)}` : ''}</span></div>
            ${next ? `<span class="bl-nudge">${NV.icon('sparkle')} +${next[0] - l.qty} more → ${NV.money(next[1])} each</span>` : ''}
          </div>
          <div class="bl-right">
            <span class="qty">
              <button data-step="-1" aria-label="Decrease">${NV.icon('minus')}</button>
              <input type="number" value="${l.qty}" min="1" aria-label="Quantity of ${E(l.name)}">
              <button data-step="1" aria-label="Increase">${NV.icon('plus')}</button>
            </span>
            <span class="bl-total">${NV.money(l.lineTotal)}</span>
            <button class="bl-remove" data-remove>${NV.icon('trash')} Remove</button>
          </div>
        </div>`;
      }).join('')}`;

    const remaining = NV.CONFIG.freeDeliveryFrom - t.subtotal;
    document.getElementById('basketSummary').innerHTML = `
      <div class="card card-pad summary-card">
        <h3 class="serif" style="font-size:1.2rem;margin-bottom:14px">Order summary</h3>
        <div class="free-ship">
          ${remaining > 0
            ? `${NV.icon('truck')} <b>${NV.money(remaining)}</b> away from free Nairobi delivery`
            : `<b>${NV.icon('check')} Free Nairobi delivery unlocked</b>`}
          <div class="progress"><i style="width:${Math.min(100, Math.round(t.subtotal / NV.CONFIG.freeDeliveryFrom * 100))}%"></i></div>
        </div>
        <div class="sum-rows">
          <div class="sum-row"><span>Subtotal</span><span>${NV.money(t.subtotal)}</span></div>
          ${t.savings > 0 ? `<div class="sum-row save"><span>Tier savings</span><span>− ${NV.money(t.savings)}</span></div>` : ''}
          <div class="sum-row ${t.delivery === 0 ? 'free' : ''}"><span>Delivery (Nairobi)</span><span>${t.delivery === 0 ? 'FREE' : NV.money(t.delivery)}</span></div>
          <div class="sum-row"><span>VAT 16%</span><span>${NV.money(t.vat)}</span></div>
        </div>
        <div class="sum-total"><span class="bold">Estimated total</span><span><b>${NV.money(t.total)}</b><br><small>VAT inclusive</small></span></div>
        <button class="btn btn-gold btn-block btn-lg" id="checkoutBtn">${NV.icon('wallet')} Proceed to checkout</button>
        <a class="btn btn-ghost btn-block btn-sm" style="margin-top:10px" href="/shop.html">${NV.icon('arrowL')} Continue shopping</a>
        <a class="btn btn-soft btn-block btn-sm" style="margin-top:10px" id="waOrder" target="_blank" rel="noopener">${NV.icon('whatsapp')} Order via WhatsApp</a>
        <p class="hint mt-2 center">Tier pricing is confirmed server-side at checkout.</p>
      </div>`;

    renderCheckoutBar(t.total);
    document.getElementById('waOrder').href = NV.basket.whatsappText(lines);
    document.getElementById('clearBasket').addEventListener('click', () => {
      if (confirm('Remove all lines from the basket?')) { NV.basket.clear(); NV.toast('Basket cleared.', { title: 'Done' }); }
    });
    document.getElementById('checkoutBtn').addEventListener('click', goCheckout);
    document.querySelectorAll('#basketLines .bline').forEach(row => {
      const id = row.dataset.id;
      const input = row.querySelector('input');
      row.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
        NV.basket.setQty(id, Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(b.dataset.step, 10)));
      }));
      input.addEventListener('change', () => NV.basket.setQty(id, Math.max(1, parseInt(input.value, 10) || 1)));
      row.querySelector('[data-remove]').addEventListener('click', () => NV.basket.remove(id));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    document.addEventListener('basket:change', render);
  });
})();
