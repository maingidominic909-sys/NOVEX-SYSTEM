/* NORVEX v2 — home page */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  document.addEventListener('DOMContentLoaded', async () => {
    /* hero search */
    const heroForm = document.getElementById('heroSearch');
    if (heroForm) heroForm.addEventListener('submit', e => {
      e.preventDefault();
      const q = heroForm.querySelector('input').value.trim();
      location.href = '/shop.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });

    const cat = await NV.catalog();

    /* departments */
    const deptMount = document.getElementById('deptGrid');
    if (deptMount) {
      const count = id => cat.products.filter(p => p.cat === id).length;
      deptMount.innerHTML = cat.categories.map(c => `
        <a class="dept-card reveal" href="/shop.html?cat=${E(c.id)}">
          <span class="dc-img"><img src="${E(c.img || '/img/products/' + (c.id === 'institutional' ? 'school' : c.id) + '.jpg')}" alt="${E(c.name)}" loading="lazy"></span>
          <span class="dc-body">
            <span class="dc-ico">${NV.icon(c.icon || NV.catIcon(c.id))}</span>
            <span><b>${E(c.name)}</b><small>${count(c.id)} lines</small></span>
            <span class="dc-arrow">${NV.icon('arrowR')}</span>
          </span>
        </a>`).join('');
    }

    /* featured products */
    const featMount = document.getElementById('featuredGrid');
    if (featMount) {
      const featured = cat.products.filter(p => p.featured).slice(0, 8);
      const fill = featured.length >= 8 ? featured : [...featured, ...cat.products.filter(p => !p.featured).slice(0, 8 - featured.length)];
      featMount.innerHTML = fill.map(p => NV.ui.productCard(p, cat)).join('');
    }

    /* hero stats */
    const lines = document.getElementById('statLines');
    if (lines) lines.textContent = cat.products.length + '+';
    const depts = document.getElementById('statDepts');
    if (depts) depts.textContent = String(cat.categories.length);

    NV.reveal();
  });
})();
