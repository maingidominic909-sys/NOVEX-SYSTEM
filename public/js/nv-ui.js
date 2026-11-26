/* =========================================================
   NORVEX UI KIT v2 — photography-first component renderers
   Every product / department / related tile renders a real
   image with responsive srcset + tiny LQIP blur-up.
   ========================================================= */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  const IMG_BASE = '/img/products/';
  const CAT_IMG = {
    food: 'beans', office: 'office', ict: 'ict', furniture: 'furniture', cleaning: 'cleaning',
    institutional: 'school', safety: 'safety', hardware: 'hardware', textiles: 'textiles',
    catering: 'catering', printing: 'printing', water: 'water', agriculture: 'agriculture'
  };

  /* In the single-file build window.__NV_IMG[name] holds inline data URIs. */
  const REG = () => (typeof window !== 'undefined' && window.__NV_IMG) || null;

  /** department image key for a product ("beans", "safety", …) */
  const isData = v => typeof v === 'string' && v.startsWith('data:');
  function imgName(p) {
    if (p && p.img && isData(p.img)) return p.img;                 /* admin-uploaded picture */
    if (p && p.img) return String(p.img).split('/').pop().replace(/\.jpg$/, '');
    return CAT_IMG[(p && p.cat) || 'food'] || 'beans';
  }
  function imgSrc(name, size) {
    if (isData(name)) return name;
    const reg = REG();
    const key = (reg && reg[name]) || null;
    if (key) return key[size] || key.md || key.sm || key.src || '';
    if (size === 'tiny') return `${IMG_BASE}${name}-tiny.jpg`;
    if (size === 'sm') return `${IMG_BASE}${name}-sm.jpg`;
    if (size === 'md') return `${IMG_BASE}${name}-md.jpg`;
    return `${IMG_BASE}${name}.jpg`;
  }
  function srcsetFor(name, sizes) {
    if (isData(name)) return '';
    const reg = REG();
    const key = (reg && reg[name]) || null;
    if (key && key.set) return key.set;
    if (key && key.md) return `${key.md} 700w`;
    const list = (sizes || ['sm', 'md', 'full']).map(size => `${imgSrc(name, size)} ${size === 'sm' ? 450 : size === 'md' ? 700 : 900}w`);
    return list.join(', ');
  }

  /** Build an <img> block with srcset, LQIP background and lazy loading. */
  function mediaFor(nameOrPath, opts) {
    const o = opts || {};
    if (isData(nameOrPath)) {
      return `<span class="ph ${o.cls || ''}">
        <img src="${nameOrPath}" alt="${E(o.alt || '')}" width="900" height="675" ${o.eager ? 'loading="eager"' : 'loading="lazy" decoding="async"'} onload="this.classList.add('is-loaded')">
      </span>`;
    }
    const name = String(nameOrPath).split('/').pop().replace(/\.jpg$/, '').replace(/-(sm|md|tiny)$/, '');
    const src = imgSrc(name, 'md');
    const bg = imgSrc(name, 'tiny');
    return `<span class="ph ${o.cls || ''}" style="background-image:url('${bg}')">
      <img src="${src}" srcset="${srcsetFor(name)}" sizes="${o.sizes || '(max-width:640px) 92vw, (max-width:1024px) 46vw, 320px'}"
        width="700" height="525" alt="${E(o.alt || '')}" ${o.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" decoding="async"'}
        onload="this.classList.add('is-loaded')">
    </span>`;
  }

  const productImg = p => imgSrc(imgName(p), 'md');
  const productThumb = p => imgSrc(imgName(p), 'sm');

  /* ---------------- product card ---------------- */
  function productCard(p, categoryName) {
    const from = p.tiers[p.tiers.length - 1][1];
    const top = p.tiers[0][1];
    const flag = p.featured ? `<span class="pill pill-gold product-flag">Contract pick</span>`
      : p.popular ? `<span class="pill product-flag">Popular</span>` : '';
    const tiers = p.tiers.length > 1 ? `<span class="per">· ${p.tiers.length - 1} volume break${p.tiers.length > 2 ? 's' : ''}</span>` : '';
    return `
    <article class="product-card" data-product="${E(p.id)}">
      <a href="/product.html?id=${E(p.id)}" class="product-media" aria-label="${E(p.name)}">
        ${flag}
        ${mediaFor(imgName(p), { alt: p.name })}
      </a>
      <button class="product-fav ${NV.favourites.has(p.id) ? 'on' : ''}" data-fav="${E(p.id)}" aria-label="Save ${E(p.name)}" aria-pressed="${NV.favourites.has(p.id)}" type="button">${NV.icon('heart')}</button>
      <div class="product-body">
        <span class="product-sku">${E(categoryName || p.cat)} · ${E(p.id.replace('nvx-', '').toUpperCase())}</span>
        <h3><a href="/product.html?id=${E(p.id)}">${E(p.name)}</a></h3>
        <p class="product-desc">${E(p.desc)}</p>
        <div class="product-price">
          <span class="amt">${NV.money(from)}</span>
          <span class="per">/ ${E(p.unit)}</span>
          ${from !== top ? `<span class="was">${NV.money(top)}</span>${tiers}` : ''}
        </div>
        <div class="product-actions">
          <button class="btn btn-sm" data-add="${E(p.id)}" type="button">${NV.icon('cart')} Add to basket</button>
        </div>
      </div>
    </article>`;
  }

  /* ---------------- compact line card (related, cross-sell) ---------------- */
  function productRow(p, categoryName) {
    return `<a class="line-card" href="/product.html?id=${E(p.id)}">
      ${mediaFor(imgName(p), { alt: p.name, sizes: '96px', cls: 'line-card-ph' })}
      <span class="line-card-body">
        <span class="product-sku">${E(categoryName || p.cat)}</span>
        <b>${E(p.name)}</b>
        <span class="line-card-price">${NV.money(p.tiers[p.tiers.length - 1][1])} <em>/ ${E(p.unit)}</em></span>
      </span>
      <span class="line-card-arrow">${NV.icon('arrowR')}</span>
    </a>`;
  }

  /* ---------------- category card ---------------- */
  function categoryCard(c, count) {
    const name = CAT_IMG[c.id] || 'beans';
    return `<a class="cat-card reveal" href="/shop.html?cat=${E(c.id)}">
      <span class="cat-media">
        ${mediaFor(name, { alt: c.name, sizes: '(max-width:640px) 92vw, 300px' })}
        <span class="cat-icon">${NV.icon(c.icon || NV.catIcon(c.id))}</span>
      </span>
      <span class="cat-body">
        <h3>${E(c.name)}</h3>
        <p>${E(c.blurb || '')}</p>
        <span class="cat-count">${count != null ? count + ' lines · ' : ''}Browse →</span>
      </span>
    </a>`;
  }

  function bindCards(scope) {
    const root = scope || document;
    root.querySelectorAll('[data-add]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        NV.basket.add(btn.dataset.add, 1);
        const original = btn.innerHTML;
        btn.innerHTML = NV.icon('check') + ' Added';
        btn.classList.add('is-disabled');
        setTimeout(() => { btn.innerHTML = original; btn.classList.remove('is-disabled'); }, 1400);
      });
    });
    root.querySelectorAll('[data-fav]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const on = NV.favourites.toggle(btn.dataset.fav);
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', String(on));
      });
    });
  }

  const skeletons = (n = 8) => Array.from({ length: n }).map(() => `
    <div class="card" style="overflow:hidden">
      <div class="skeleton" style="aspect-ratio:4/3;border-radius:0"></div>
      <div style="padding:18px">
        <div class="skeleton" style="height:9px;width:40%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:15px;width:75%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:10px;width:90%;margin-bottom:6px"></div>
        <div class="skeleton" style="height:10px;width:60%;margin-bottom:18px"></div>
        <div class="skeleton" style="height:38px;border-radius:999px"></div>
      </div>
    </div>`).join('');

  NV.ui = { productCard, productRow, categoryCard, bindCards, skeletons, mediaFor, imgName, imgSrc, srcsetFor, productImg, productThumb };
})();
