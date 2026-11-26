/* Console — supply basket workspace */
(function () {
  const NV = window.NV;

  document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });
    await NV.catalog();
    const ctxEl = document.getElementById('ctxRef');
    if (ctxEl) ctxEl.textContent = 'Basket ' + NV.ref('BSK').split('-').slice(1).join('-');
    render();
    if (!bound) { document.addEventListener('basket:change', render); bound = true; }

    /* account state above the checkout button */
    function paintBasketAuth() {
      const host = document.getElementById('basketAuth');
      if (!host || !NV.auth) return;
      const user = NV.auth.current();
      host.className = 'basket-auth ' + (user ? 'is-in' : 'is-out');
      host.innerHTML = user
        ? `<span class="basket-auth-who"><b>${NV.esc(user.name)}</b> · ${NV.esc(user.organisation)}</span>
           <a href="/account.html" class="basket-auth-link">My account</a>
           <button type="button" class="basket-auth-link strong" data-basket-signout>Sign out</button>`
        : `<span>You need an account to place this order.</span>
           <a href="/auth.html?mode=signin" class="basket-auth-link">Sign in</a>
           <a href="/auth.html?mode=signup" class="basket-auth-link strong">Create account</a>`;
      const out = host.querySelector('[data-basket-signout]');
      if (out) out.onclick = () => { NV.auth.signOut({ redirect: false }); NV.toast('Signed out — your basket is saved.', { title: 'Signed out' }); };
    }
    paintBasketAuth();
    NV.auth && NV.auth.onChange(paintBasketAuth);
  });

  let bound = false;
  async function render() {
    /* the page may have been swapped by the router — drop the stale binding */
    if (!document.getElementById('basketTable')) {
      document.removeEventListener('basket:change', render);
      bound = false;
      return;
    }
    const lines = await NV.basket.lines();
    const body = document.getElementById('basketBody');
    const empty = document.getElementById('basketEmpty');
    const table = document.getElementById('basketTable');
    const foot = document.getElementById('basketFoot');
    const catNames = (await NV.catalog()).categories;

    (document.getElementById('lineCount') || {}).textContent = `${lines.length} line${lines.length === 1 ? '' : 's'} · ${NV.basket.count()} units`;
    (document.getElementById('clearBasket') || {}).disabled = !lines.length;
    (document.getElementById('checkoutBtn') || {}).classList.toggle('is-disabled', !lines.length);

    if (!lines.length) {
      table.classList.add('hide'); empty.classList.remove('hide'); foot.classList.add('hide');
      document.getElementById('summaryLines').innerHTML = `<div class="srow"><span>No items yet</span><span class="val">—</span></div>`;
      (document.getElementById('freeDeliveryBar') || {}).style.width = '0%';
      (document.getElementById('freeDeliveryPct') || {}).textContent = '0%';
      (document.getElementById('freeDeliveryLabel') || {}).textContent = 'Spend KES 150,000 to unlock free delivery';
      return;
    }

    table.classList.remove('hide'); empty.classList.add('hide'); foot.classList.remove('hide');

    body.innerHTML = lines.map(l => {
      const catName = (catNames.find(c => c.id === l.cat) || {}).name || l.cat;
      const nextTier = l.product.tiers.find(t => t[0] > l.qty);
      const nudge = nextTier
        ? `<span class="tiny" style="color:var(--gold-600)">+${nextTier[0] - l.qty} more → ${NV.money(nextTier[1])}/unit</span>`
        : `<span class="tiny" style="color:var(--success)">Best rate applied</span>`;
      return `<tr data-id="${l.id}">
        <td>
          <div class="media-cell">
            <span class="cart-table-media" style="width:52px;height:52px;padding:0;overflow:hidden;border-radius:8px;background:var(--sand)">
              <img src="${NV.ui.productThumb(l)}" alt="" width="52" height="52" loading="lazy" decoding="async" style="width:52px;height:52px;object-fit:cover">
            </span>
            <div>
              <a class="cell-main" href="/product.html?id=${l.id}">${NV.esc(l.name)}</a>
              <div class="cell-sub">${NV.esc(catName)} · ${NV.esc(l.unit)} · MOQ ${l.moq}</div>
              ${nudge}
            </div>
          </div>
        </td>
        <td data-label="Unit price"><span class="mobile-label">Unit price</span>${NV.money(l.unitPrice)}<div class="cell-sub">${l.listPrice > l.unitPrice ? `<s>${NV.money(l.listPrice)}</s>` : ''}</div></td>
        <td data-label="Qty">
          <span class="mobile-label">Qty</span>
          <div class="qty">
            <button data-dec="${l.id}" aria-label="Decrease">−</button>
            <input type="number" value="${l.qty}" min="1" data-qty="${l.id}" aria-label="Quantity for ${NV.esc(l.name)}">
            <button data-inc="${l.id}" aria-label="Increase">+</button>
          </div>
        </td>
        <td class="num" data-label="Line total"><span class="mobile-label">Line total</span>${NV.money(l.lineTotal)}</td>
        <td class="actions"><button class="icon-btn" data-del="${l.id}" aria-label="Remove ${NV.esc(l.name)}" style="width:32px;height:32px;color:var(--muted)">${NV.icon('trash')}</button></td>
      </tr>`;
    }).join('');

    body.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => NV.basket.add(b.dataset.inc, 1));
    body.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => NV.basket.setQty(b.dataset.dec, NV.basket.qtyOf(b.dataset.dec) - 1));
    body.querySelectorAll('[data-qty]').forEach(i => i.onchange = () => NV.basket.setQty(i.dataset.qty, parseInt(i.value, 10) || 1));
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { NV.basket.remove(b.dataset.del); NV.toast('Line removed', { title: 'Basket updated' }); });

    /* summary */
    const t = NV.quote(lines);
    document.getElementById('summaryLines').innerHTML = `
      <div class="srow"><span>Items (${NV.basket.count()})</span><span class="val">${NV.money(t.subtotal)}</span></div>
      ${t.savings > 0 ? `<div class="srow discount"><span>Volume savings</span><span class="val">−${NV.money(t.savings)}</span></div>` : ''}
      <div class="srow"><span>Delivery (Nairobi Metro)</span><span class="val">${t.delivery ? NV.money(t.delivery) : 'Free'}</span></div>
      <div class="srow"><span>VAT (16%)</span><span class="val">${NV.money(t.vat)}</span></div>
      <div class="srow total"><span>Estimated total</span><span class="val">${NV.money(t.total)}</span></div>`;

    const pct = Math.min(100, Math.round((t.subtotal / NV.CONFIG.freeDeliveryFrom) * 100));
    (document.getElementById('freeDeliveryBar') || {}).style.width = pct + '%';
    (document.getElementById('freeDeliveryPct') || {}).textContent = pct + '%';
    (document.getElementById('freeDeliveryLabel') || {}).textContent = t.delivery
      ? `Add ${NV.money(NV.CONFIG.freeDeliveryFrom - t.subtotal)} more for free delivery`
      : 'Free delivery unlocked ✓';
  }

  document.getElementById('clearBasket').onclick = () => {
    if (!NV.basket.count()) return;
    if (confirm('Clear every line from your supply basket?')) { NV.basket.clear(); NV.toast('Basket cleared', { title: 'Done' }); }
  };

  document.getElementById('whatsappBtn').onclick = async () => {
    const lines = await NV.basket.lines();
    if (!lines.length) { NV.toast('Add items before sending a list.', { title: 'Basket empty', type: 'error' }); return; }
    window.open(NV.basket.whatsappText(lines), '_blank');
  };
})();
