/* NORVEX v2 — product detail with live tier pricing */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  let p = null, cat = null, qty = 1;

  function activeTierIndex() {
    let idx = 0;
    p.tiers.forEach(([min], i) => { if (qty >= min) idx = i; });
    return idx;
  }

  function renderPrice() {
    const unit = NV.tierPrice(p, qty);
    const list = p.tiers[0][1];
    const save = Math.round((1 - unit / list) * 100);
    document.getElementById('unitPrice').textContent = NV.money(unit);
    document.getElementById('unitPer').textContent = 'per ' + p.unit + ' · excl. VAT';
    const saveBadge = document.getElementById('saveBadge');
    saveBadge.innerHTML = save > 0 ? `<span class="badge green">${NV.icon('check')} ${save}% bulk saving</span>` : '';
    document.getElementById('lineTotal').innerHTML = `Line total: <b>${NV.money(unit * qty)}</b> <span class="muted small">for ${qty} × ${E(p.unit)}</span>`;
    document.querySelectorAll('#tierTable tr[data-tier]').forEach((tr, i) => tr.classList.toggle('tier-on', i === activeTierIndex()));
    const addBtn = document.getElementById('addBtn');
    addBtn.dataset.qty = String(qty);
    const next = p.tiers.find(([min]) => min > qty);
    const nudge = document.getElementById('tierNudge');
    if (next) {
      const nextPrice = next[1];
      nudge.innerHTML = `${NV.icon('sparkle')} Add <b>&nbsp;${next[0] - qty} more&nbsp;</b> to drop the unit price to <b>&nbsp;${NV.money(nextPrice)}</b>`;
      nudge.classList.remove('hide');
    } else nudge.classList.add('hide');
    const moqNote = document.getElementById('moqNote');
    moqNote.textContent = qty < p.moq ? `Minimum order is ${p.moq} × ${p.unit} — quantity will be raised on add.` : '';
  }

  function setQty(v) {
    qty = Math.max(1, Math.min(999999, parseInt(v, 10) || 1));
    document.getElementById('qtyInput').value = String(qty);
    renderPrice();
  }

  function render() {
    const catLabel = NV.ui.catName(cat, p.cat);
    document.title = p.name + ' — Norvex catalogue';
    document.getElementById('crumbCat').innerHTML = `<a href="/shop.html?cat=${E(p.cat)}">${E(catLabel)}</a>`;
    document.getElementById('crumbName').textContent = p.name;

    document.getElementById('pMedia').innerHTML = p.img
      ? `<img src="${E(p.img)}" alt="${E(p.name)}">`
      : `<span class="art">${NV.icon(NV.catIcon(p.cat))}</span>`;

    document.getElementById('pCat').innerHTML = `<a class="badge gold" href="/shop.html?cat=${E(p.cat)}">${E(catLabel)}</a>
      ${p.popular ? '<span class="badge green">Popular line</span>' : ''} <span class="badge gray">SKU ${E(p.id.toUpperCase())}</span>`;
    document.getElementById('pName').textContent = p.name;
    document.getElementById('pDesc').textContent = p.desc;

    document.getElementById('tierTable').innerHTML = `
      <tr><th>Quantity</th><th class="num">Unit price</th><th class="num">You save</th></tr>
      ${p.tiers.map(([min, price], i) => {
        const nextMin = p.tiers[i + 1] ? p.tiers[i + 1][0] - 1 : null;
        const range = nextMin ? `${min} – ${nextMin}` : `${min}+`;
        const save = Math.round((1 - price / p.tiers[0][1]) * 100);
        return `<tr data-tier="${i}"><td>${range} × ${E(p.unit)}</td><td class="num">${NV.money(price)}</td><td class="num">${save ? save + '%' : '—'}</td></tr>`;
      }).join('')}`;

    document.getElementById('metaGrid').innerHTML = `
      <div class="meta-cell"><small>Pack unit</small><b>${E(p.unit)}</b></div>
      <div class="meta-cell"><small>Min. order</small><b>${p.moq} units</b></div>
      <div class="meta-cell"><small>Lead time</small><b>${E(p.lead)}</b></div>
      <div class="meta-cell"><small>Availability</small><b class="green">In supply</b></div>`;

    document.getElementById('specBody').innerHTML = `<ul>
      <li>${NV.icon('check')} Supplied to specification — institutional grade, verified before dispatch.</li>
      <li>${NV.icon('check')} Volume pricing applies automatically as quantities cross each tier.</li>
      <li>${NV.icon('check')} VAT at 16% is added at checkout; approved accounts can order on LPO.</li>
      <li>${NV.icon('check')} Need a different pack size or spec? <a class="link-arrow gold" href="/quote.html">Ask the sourcing desk ${NV.icon('arrowR')}</a></li>
    </ul>`;
    document.getElementById('deliveryBody').innerHTML = `<ul>
      <li>${NV.icon('truck')} Nairobi Metro delivery ${NV.money(NV.CONFIG.deliveryFee)} — free above ${NV.money(NV.CONFIG.freeDeliveryFrom)}.</li>
      <li>${NV.icon('clock')} Typical lead time for this line: ${E(p.lead)} after order confirmation.</li>
      <li>${NV.icon('box')} Upcountry and cross-county consolidation quoted per order.</li>
      <li>${NV.icon('shield')} Goods inspected against the order sheet before dispatch.</li>
    </ul>`;

    const favBtn = document.getElementById('favBtn');
    const syncFav = () => {
      const on = NV.favourites.has(p.id);
      favBtn.classList.toggle('on', on);
      favBtn.innerHTML = NV.icon('heart');
      favBtn.setAttribute('aria-pressed', String(on));
    };
    favBtn.dataset.fav = p.id;
    syncFav();
    document.addEventListener('click', e => { if (e.target.closest('#favBtn')) setTimeout(syncFav, 30); });

    setQty(p.moq || 1);

    /* related */
    const related = cat.products.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
    const relMount = document.getElementById('relatedGrid');
    const relSection = document.getElementById('relatedSection');
    if (related.length) relMount.innerHTML = related.map(x => NV.ui.productCard(x, cat)).join('');
    else relSection.classList.add('hide');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const id = NV.queryString().get('id');
    cat = await NV.catalog();
    p = cat.products.find(x => x.id === id) || null;
    const mount = document.getElementById('productRoot');
    if (!p) {
      mount.innerHTML = NV.ui.emptyState('That catalogue line was not found', 'It may have been renamed or retired. Browse the catalogue or ask our sourcing desk.', '<a class="btn btn-primary" href="/shop.html">Browse catalogue</a>');
      document.getElementById('relatedSection').classList.add('hide');
      return;
    }
    mount.classList.remove('hide');
    render();

    const input = document.getElementById('qtyInput');
    document.getElementById('qtyMinus').addEventListener('click', () => setQty(Math.max(p.moq || 1, qty - 1)));
    document.getElementById('qtyPlus').addEventListener('click', () => setQty(qty + 1));
    input.addEventListener('change', () => setQty(input.value));
    document.getElementById('addBtn').addEventListener('click', () => { if (qty < p.moq) setQty(p.moq); });
    document.getElementById('buyBtn').addEventListener('click', async () => {
      const map = await NV.productMap();
      const prod = map[p.id];
      NV.basket.add(p.id, Math.max(qty, prod ? prod.moq : qty));
      location.href = '/basket.html';
    });

    document.querySelectorAll('.acc-btn').forEach(btn => btn.addEventListener('click', () => {
      btn.closest('.acc-item').classList.toggle('open');
    }));
    NV.reveal();
  });
})();
