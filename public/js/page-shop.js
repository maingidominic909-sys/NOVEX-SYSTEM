/* Catalogue / shop page — filtering, search, sort, pagination */
(function () {
  const NV = window.NV;
  const PER_PAGE = 12;

  const S = { q: '', cats: new Set(), band: 'all', featured: false, lowMoq: false, fast: false, sort: 'relevance', page: 1, catalog: null };

  const bandMatch = (price, band) => {
    if (band === 'all') return true;
    const [lo, hi] = band.split('-').map(Number);
    return price >= lo && price <= hi;
  };

  function filtered() {
    const { products, categories } = S.catalog;
    const q = S.q.trim().toLowerCase();
    let list = products.slice();
    if (q) list = list.filter(p => (p.name + ' ' + p.tags.join(' ') + ' ' + p.desc + ' ' + p.cat).toLowerCase().includes(q));
    if (S.cats.size) list = list.filter(p => S.cats.has(p.cat));
    if (S.band !== 'all') list = list.filter(p => bandMatch(p.tiers[0][1], S.band));
    if (S.featured) list = list.filter(p => p.featured);
    if (S.lowMoq) list = list.filter(p => p.moq <= 10);
    if (S.fast) list = list.filter(p => /[1-3]\s*[–-]\s*[1-3]\s*day/.test(p.lead) || /1\s*[–-]\s*[23]\s*day/.test(p.lead));
    switch (S.sort) {
      case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'price-asc': list.sort((a, b) => a.tiers[0][1] - b.tiers[0][1]); break;
      case 'price-desc': list.sort((a, b) => b.tiers[0][1] - a.tiers[0][1]); break;
      case 'moq': list.sort((a, b) => a.moq - b.moq); break;
      default:
        list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
    }
    return list;
  }

  function render() {
    const { categories } = S.catalog;
    const catName = id => (categories.find(c => c.id === id) || {}).name || id;
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    S.page = Math.min(S.page, pages);
    const slice = list.slice((S.page - 1) * PER_PAGE, S.page * PER_PAGE);

    const grid = document.getElementById('shopGrid');
    grid.innerHTML = slice.length ? slice.map(p => NV.ui.productCard(p, catName(p.cat))).join('')
      : `<div class="table-empty" style="grid-column:1/-1">${NV.icon('search')}<h3>No lines match those filters</h3><p class="small muted">Try clearing a filter, or <a href="/quote.html" style="color:var(--gold-600)">send us the specification</a> and we'll source it.</p></div>`;
    NV.ui.bindCards(grid);

    document.getElementById('resultCount').textContent = `${list.length} line${list.length === 1 ? '' : 's'}`;

    /* active filter chips */
    const active = [];
    if (S.q) active.push({ label: `“${S.q}”`, clear: () => { S.q = ''; document.getElementById('shopSearch').value = ''; } });
    S.cats.forEach(id => active.push({ label: catName(id), clear: () => S.cats.delete(id) }));
    if (S.band !== 'all') active.push({ label: 'Price band', clear: () => { S.band = 'all'; document.querySelector('input[name=band][value=all]').checked = true; } });
    if (S.featured) active.push({ label: 'Contract picks', clear: () => { S.featured = false; document.getElementById('optFeatured').checked = false; } });
    if (S.lowMoq) active.push({ label: 'Low MOQ', clear: () => { S.lowMoq = false; document.getElementById('optMoq').checked = false; } });
    if (S.fast) active.push({ label: 'Fast dispatch', clear: () => { S.fast = false; document.getElementById('optFast').checked = false; } });

    const af = document.getElementById('activeFilters');
    af.innerHTML = active.length ? active.map((a, i) => `<span class="active-filter">${NV.esc(a.label)}<button data-clear="${i}" aria-label="Remove filter">×</button></span>`).join('') + `<button class="chip" id="clearAllChips" type="button">Clear all</button>` : '';
    af.querySelectorAll('[data-clear]').forEach(btn => btn.onclick = () => { active[Number(btn.dataset.clear)].clear(); S.page = 1; render(); });
    const clearAll = document.getElementById('clearAllChips');
    if (clearAll) clearAll.onclick = resetAll;

    /* pagination */
    const pag = document.getElementById('pagination');
    if (pages > 1) {
      pag.innerHTML = `
        <button data-page="prev" ${S.page === 1 ? 'disabled' : ''}>←</button>
        ${Array.from({ length: pages }).map((_, i) => `<button class="${S.page === i + 1 ? 'on' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('')}
        <button data-page="next" ${S.page === pages ? 'disabled' : ''}>→</button>`;
      pag.querySelectorAll('button[data-page]').forEach(b => b.onclick = () => {
        const v = b.dataset.page;
        S.page = v === 'prev' ? Math.max(1, S.page - 1) : v === 'next' ? Math.min(pages, S.page + 1) : Number(v);
        render();
        document.getElementById('shopGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else pag.innerHTML = '';

    syncUrl();
  }

  function syncUrl() {
    const u = new URLSearchParams();
    if (S.q) u.set('q', S.q);
    if (S.cats.size === 1) u.set('cat', [...S.cats][0]);
    if (S.sort !== 'relevance') u.set('sort', S.sort);
    history.replaceState(null, '', u.toString() ? '?' + u.toString() : location.pathname);
  }

  function resetAll() {
    S.q = ''; S.cats.clear(); S.band = 'all'; S.featured = false; S.lowMoq = false; S.fast = false; S.sort = 'relevance'; S.page = 1;
    document.getElementById('shopSearch').value = '';
    document.getElementById('sortBy').value = 'relevance';
    document.querySelector('input[name=band][value=all]').checked = true;
    ['optFeatured', 'optMoq', 'optFast'].forEach(id => document.getElementById(id).checked = false);
    renderCatFilters();
    render();
  }

  function renderCatFilters() {
    const { categories, products } = S.catalog;
    const host = document.getElementById('catFilters');
    host.innerHTML = categories.map(c => `
      <label class="filter-opt">
        <input type="checkbox" value="${c.id}" ${S.cats.has(c.id) ? 'checked' : ''}>
        ${NV.esc(c.name)}<span class="count">${products.filter(p => p.cat === c.id).length}</span>
      </label>`).join('');
    host.querySelectorAll('input').forEach(i => i.onchange = () => {
      i.checked ? S.cats.add(i.value) : S.cats.delete(i.value);
      S.page = 1; render();
    });
  }

  async function init() {
    S.catalog = await NV.catalog();
    document.querySelectorAll('[data-icon="search"]').forEach(el => el.innerHTML = NV.icon('search'));
    const docTitle = document.querySelector('#shopSearch');
    if (docTitle) docTitle.placeholder = `Search ${S.catalog.products.length} lines — try “beans” or “A4”`;

    /* deep links */
    const params = NV.queryString();
    if (params.get('q')) { S.q = params.get('q'); }
    if (params.get('cat')) { params.get('cat').split(',').forEach(c => S.cats.add(c)); }
    if (params.get('sort')) S.sort = params.get('sort');
    document.getElementById('shopSearch').value = S.q;
    document.getElementById('sortBy').value = S.sort;

    renderCatFilters();
    render();

    /* toolbar wiring */
    let t;
    document.getElementById('shopSearch').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { S.q = e.target.value; S.page = 1; render(); }, 160);
    });
    document.getElementById('sortBy').addEventListener('change', e => { S.sort = e.target.value; render(); });
    document.querySelectorAll('input[name=band]').forEach(r => r.onchange = () => { S.band = r.value; S.page = 1; render(); });
    document.getElementById('optFeatured').onchange = e => { S.featured = e.target.checked; S.page = 1; render(); };
    document.getElementById('optMoq').onchange = e => { S.lowMoq = e.target.checked; S.page = 1; render(); };
    document.getElementById('optFast').onchange = e => { S.fast = e.target.checked; S.page = 1; render(); };
    document.getElementById('clearFilters').onclick = resetAll;

    /* mobile filter drawer */
    const filters = document.getElementById('filters');
    const toggle = document.getElementById('filterToggle');
    const syncToggle = () => { toggle.textContent = filters.classList.contains('collapsed') ? 'Show' : 'Hide'; };
    if (window.matchMedia('(min-width: 901px)').matches) filters.classList.remove('collapsed');
    syncToggle();
    toggle.onclick = () => { filters.classList.toggle('collapsed'); syncToggle(); };

    /* header search may add ?q= later */
    NV.reveal();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
