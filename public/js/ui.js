/* NORVEX v2 UI — shared product cards, binders, small helpers */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  const catName = (cat, id) => ((cat && cat.categories.find(c => c.id === id)) || {}).name || id;

  const thumb = (p, cls) => p.img
    ? `<img class="${cls || ''}" src="${E(p.img)}" alt="${E(p.name)}" loading="lazy">`
    : `<span class="${cls || 'art'}">${NV.icon(NV.catIcon(p.cat))}</span>`;

  function productCard(p, cat) {
    const from = p.tiers[p.tiers.length - 1][1];
    const list = p.tiers[0][1];
    const fav = NV.favourites.has(p.id);
    return `
    <article class="pcard" data-pid="${E(p.id)}">
      <a class="pc-media" href="/product.html?id=${E(p.id)}" aria-label="${E(p.name)}">
        ${p.img ? `<img src="${E(p.img)}" alt="${E(p.name)}" loading="lazy">` : `<span class="art">${NV.icon(NV.catIcon(p.cat))}</span>`}
        <span class="pc-flag">
          ${p.tiers.length > 1 ? `<span class="badge gold pc-disc">-${Math.round((1 - from / list) * 100)}%</span>` : ''}
          ${p.featured ? '<span class="badge green">Featured</span>' : ''}
        </span>
      </a>
      <button class="pc-fav ${fav ? 'on' : ''}" data-fav="${E(p.id)}" aria-label="Save ${E(p.name)} for later" aria-pressed="${fav}">${NV.icon('heart')}</button>
      <div class="pc-body">
        <span class="pc-cat">${E(catName(cat, p.cat))}</span>
        <h3 class="pc-name clamp-2"><a href="/product.html?id=${E(p.id)}">${E(p.name)}</a></h3>
        <p class="pc-meta">${E(p.unit)} · MOQ ${p.moq} · ${E(p.lead)}</p>
        <div class="pc-price">
          <b>${NV.money(list)}</b><small>/ ${E(p.unit)}</small>
          ${p.tiers.length > 1 ? `<span class="pc-tier">from ${NV.money(from)} in bulk</span>` : ''}
        </div>
        <div class="pc-actions">
          <button class="btn btn-primary btn-sm" data-add="${E(p.id)}">${NV.icon('cart')} Add</button>
          <a class="btn btn-ghost btn-sm btn-icon" href="/product.html?id=${E(p.id)}" aria-label="View ${E(p.name)}">${NV.icon('arrowR')}</a>
        </div>
      </div>
    </article>`;
  }

  const skeletonCards = n => Array.from({ length: n || 8 }, () => `
    <div class="pcard"><div class="skel" style="aspect-ratio:4/3;border-radius:0"></div>
    <div class="pc-body"><div class="skel" style="height:12px;width:40%"></div><div class="skel" style="height:16px"></div><div class="skel" style="height:12px;width:70%"></div><div class="skel" style="height:34px;margin-top:8px"></div></div></div>`).join('');

  /* global delegation: add-to-basket + favourites */
  document.addEventListener('click', async e => {
    const add = e.target.closest && e.target.closest('[data-add]');
    if (add) {
      const u = NV.auth && NV.auth.current();
      if (u && u.role === 'admin') { NV.toast('Admin accounts manage orders from the console — buying is disabled.', { title: 'Admin mode', type: 'error' }); return; }
      const id = add.dataset.add;
      const map = await NV.productMap();
      const p = map[id];
      if (!p) return;
      const qty = Math.max(1, parseInt(add.dataset.qty, 10) || p.moq || 1);
      NV.basket.add(id, qty);
      NV.toast(`${qty} × ${p.name} (${p.unit}) added to your basket.`, { title: 'Added to basket' });
      const old = add.innerHTML;
      add.innerHTML = `${NV.icon('check')} Added`;
      add.disabled = true;
      setTimeout(() => { add.innerHTML = old; add.disabled = false; }, 1300);
      return;
    }
    const fav = e.target.closest && e.target.closest('[data-fav]');
    if (fav) {
      const u = NV.auth && NV.auth.current();
      if (u && u.role === 'admin') { NV.toast('Favourites are a customer feature — disabled for admins.', { title: 'Admin mode', type: 'error' }); return; }
      const on = NV.favourites.toggle(fav.dataset.fav);
      fav.classList.toggle('on', on);
      fav.setAttribute('aria-pressed', String(on));
      NV.toast(on ? 'Saved to your favourites.' : 'Removed from favourites.', { title: on ? 'Saved' : 'Removed', ms: 2200 });
    }
  });

  const emptyState = (title, body, cta) => `
    <div class="shop-empty">
      ${NV.icon('box')}
      <h3 class="serif" style="font-size:1.3rem;margin-bottom:8px">${E(title)}</h3>
      <p class="muted" style="max-width:44ch;margin:0 auto 20px">${E(body)}</p>
      ${cta || ''}
    </div>`;

  const statusBadge = s => {
    const map = {
      received: ['blue', 'Received'], confirmed: ['gold', 'Confirmed'], sourcing: ['amber', 'Sourcing'],
      dispatched: ['violet', 'Dispatched'], delivered: ['green', 'Delivered'], cancelled: ['red', 'Cancelled'],
      planning: ['amber', 'Planning'], new: ['gold', 'New'], reviewed: ['blue', 'Reviewed'], closed: ['gray', 'Closed']
    };
    const [cls, label] = map[s] || ['gray', s];
    return `<span class="badge ${cls} dot">${E(label)}</span>`;
  };

  NV.ui = { productCard, skeletonCards, thumb, catName, emptyState, statusBadge };
})();
