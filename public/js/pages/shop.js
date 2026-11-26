/* NORVEX v2 — catalogue / shop */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  const PER_PAGE = 12;

  let cat = null;
  const state = { q: '', cat: 'all', band: 'all', moq: 'all', lead: 'all', sort: 'popular', page: 1 };

  const BANDS = {
    all: () => true,
    'under-5k': p => p.tiers[0][1] < 5000,
    '5k-20k': p => p.tiers[0][1] >= 5000 && p.tiers[0][1] <= 20000,
    '20k-100k': p => p.tiers[0][1] > 20000 && p.tiers[0][1] <= 100000,
    'over-100k': p => p.tiers[0][1] > 100000
  };
  const BAND_LABEL = { 'under-5k': 'Under KES 5,000', '5k-20k': 'KES 5,000 – 20,000', '20k-100k': 'KES 20,000 – 100,000', 'over-100k': 'Over KES 100,000' };
  const leadDays = p => { const m = String(p.lead || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : 14; };

  function readUrl() {
    const q = NV.queryString();
    state.q = q.get('q') || '';
    state.cat = q.get('cat') || 'all';
    state.band = q.get('band') || 'all';
    state.moq = q.get('moq') || 'all';
    state.lead = q.get('lead') || 'all';
    state.sort = q.get('sort') || 'popular';
    state.page = Math.max(1, parseInt(q.get('page'), 10) || 1);
  }
  function writeUrl() {
    const q = new URLSearchParams();
    if (state.q) q.set('q', state.q);
    if (state.cat !== 'all') q.set('cat', state.cat);
    if (state.band !== 'all') q.set('band', state.band);
    if (state.moq !== 'all') q.set('moq', state.moq);
    if (state.lead !== 'all') q.set('lead', state.lead);
    if (state.sort !== 'popular') q.set('sort', state.sort);
    if (state.page > 1) q.set('page', String(state.page));
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
  }

  function filtered() {
    let list = cat.products.slice();
    if (state.cat !== 'all') list = list.filter(p => p.cat === state.cat);
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter(p => (p.name + ' ' + (p.tags || []).join(' ') + ' ' + p.desc + ' ' + p.id).toLowerCase().includes(q));
    }
    list = list.filter(BANDS[state.band] || BANDS.all);
    if (state.moq !== 'all') list = list.filter(p => p.moq <= parseInt(state.moq, 10));
    if (state.lead === 'fast') list = list.filter(p => leadDays(p) <= 4);
    if (state.lead === 'week') list = list.filter(p => leadDays(p) <= 7);
    switch (state.sort) {
      case 'price-asc': list.sort((a, b) => a.tiers[0][1] - b.tiers[0][1]); break;
      case 'price-desc': list.sort((a, b) => b.tiers[0][1] - a.tiers[0][1]); break;
      case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: list.sort((a, b) => (b.popular ? 2 : 0) + (b.featured ? 1 : 0) - ((a.popular ? 2 : 0) + (a.featured ? 1 : 0)));
    }
    return list;
  }

  function renderSide() {
    const mount = document.getElementById('shopSide');
    const count = id => cat.products.filter(p => p.cat === id).length;
    mount.innerHTML = `
      <div class="filter-card">
        <h4>Department</h4>
        <div class="filter-list" id="catFilters">
          <label><input type="checkbox" data-cat="all" ${state.cat === 'all' ? 'checked' : ''}> All departments <span class="n">${cat.products.length}</span></label>
          ${cat.categories.map(c => `<label><input type="checkbox" data-cat="${E(c.id)}" ${state.cat === c.id ? 'checked' : ''}> ${E(c.name)} <span class="n">${count(c.id)}</span></label>`).join('')}
        </div>
      </div>
      <div class="filter-card">
        <h4>Unit price</h4>
        <div class="filter-list">
          ${Object.keys(BANDS).map(b => `<label><input type="radio" name="band" data-band="${b}" ${state.band === b ? 'checked' : ''}> ${b === 'all' ? 'Any price' : BAND_LABEL[b]}</label>`).join('')}
        </div>
      </div>
      <div class="filter-card">
        <h4>Minimum order</h4>
        <div class="filter-list">
          <label><input type="radio" name="moq" data-moq="all" ${state.moq === 'all' ? 'checked' : ''}> Any MOQ</label>
          <label><input type="radio" name="moq" data-moq="5" ${state.moq === '5' ? 'checked' : ''}> MOQ of 5 or less</label>
          <label><input type="radio" name="moq" data-moq="10" ${state.moq === '10' ? 'checked' : ''}> MOQ of 10 or less</label>
          <label><input type="radio" name="moq" data-moq="20" ${state.moq === '20' ? 'checked' : ''}> MOQ of 20 or less</label>
        </div>
      </div>
      <div class="filter-card">
        <h4>Dispatch speed</h4>
        <div class="filter-list">
          <label><input type="radio" name="lead" data-lead="all" ${state.lead === 'all' ? 'checked' : ''}> Any lead time</label>
          <label><input type="radio" name="lead" data-lead="fast" ${state.lead === 'fast' ? 'checked' : ''}> Fast · within 4 days</label>
          <label><input type="radio" name="lead" data-lead="week" ${state.lead === 'week' ? 'checked' : ''}> Within a week</label>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" id="clearFilters">${NV.icon('refresh')} Clear all filters</button>`;

    mount.querySelectorAll('[data-cat]').forEach(cb => cb.addEventListener('change', () => {
      state.cat = cb.dataset.cat; state.page = 1; render();
    }));
    ['band', 'moq', 'lead'].forEach(key => {
      mount.querySelectorAll(`[data-${key}]`).forEach(r => r.addEventListener('change', () => {
        state[key] = r.dataset[key]; state.page = 1; render();
      }));
    });
    document.getElementById('clearFilters').addEventListener('click', () => {
      Object.assign(state, { q: '', cat: 'all', band: 'all', moq: 'all', lead: 'all', sort: 'popular', page: 1 });
      document.getElementById('shopSearch').value = '';
      document.getElementById('shopSort').value = 'popular';
      render();
    });
  }

  function renderChips() {
    const mount = document.getElementById('activeChips');
    const chips = [];
    if (state.q) chips.push(['q', `“${state.q}”`]);
    if (state.cat !== 'all') chips.push(['cat', NV.ui.catName(cat, state.cat)]);
    if (state.band !== 'all') chips.push(['band', BAND_LABEL[state.band]]);
    if (state.moq !== 'all') chips.push(['moq', `MOQ ≤ ${state.moq}`]);
    if (state.lead !== 'all') chips.push(['lead', state.lead === 'fast' ? '≤ 4 days' : '≤ 7 days']);
    mount.innerHTML = chips.map(([k, label]) =>
      `<button class="chip on" data-clear="${k}">${E(label)} <span class="x">${NV.icon('close')}</span></button>`).join('');
    mount.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.clear;
      state[k] = k === 'q' ? '' : 'all';
      if (k === 'q') document.getElementById('shopSearch').value = '';
      state.page = 1; render();
    }));
  }

  function render() {
    writeUrl();
    renderSide();
    renderChips();
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    state.page = Math.min(state.page, pages);
    const slice = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);

    document.getElementById('shopCount').innerHTML = `<b>${list.length}</b> ${list.length === 1 ? 'line' : 'lines'}${state.cat !== 'all' ? ' in ' + E(NV.ui.catName(cat, state.cat)) : ''}`;
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = slice.length
      ? slice.map(p => NV.ui.productCard(p, cat)).join('')
      : NV.ui.emptyState('Nothing matches those filters', 'Try widening the price band or clearing the search — or ask us to source it for you.', '<a class="btn btn-gold" href="/quote.html">Request a sourcing quote</a>');

    const pager = document.getElementById('shopPager');
    if (pages <= 1) { pager.innerHTML = ''; }
    else {
      let html = `<button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}" aria-label="Previous page">${NV.icon('arrowL')}</button>`;
      for (let i = 1; i <= pages; i++) {
        if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - state.page) > 1) {
          if (i === 3 || i === pages - 2) html += '<button disabled>…</button>';
          continue;
        }
        html += `<button class="${i === state.page ? 'on' : ''}" data-page="${i}">${i}</button>`;
      }
      html += `<button ${state.page === pages ? 'disabled' : ''} data-page="${state.page + 1}" aria-label="Next page">${NV.icon('arrowR')}</button>`;
      pager.innerHTML = html;
      pager.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
        state.page = parseInt(b.dataset.page, 10);
        render();
        document.getElementById('shopTop').scrollIntoView({ behavior: 'smooth' });
      }));
    }
    const heading = document.getElementById('shopTitle');
    if (heading) heading.textContent = state.cat !== 'all' ? NV.ui.catName(cat, state.cat) : 'Full catalogue';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    readUrl();
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = NV.ui.skeletonCards(8);
    cat = await NV.catalog();

    const search = document.getElementById('shopSearch');
    search.value = state.q;
    let t = null;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = search.value.trim(); state.page = 1; render(); }, 220);
    });
    const sort = document.getElementById('shopSort');
    sort.value = state.sort;
    sort.addEventListener('change', () => { state.sort = sort.value; state.page = 1; render(); });
    document.getElementById('filtersToggle').addEventListener('click', () => {
      document.getElementById('shopSide').classList.toggle('open');
    });
    render();
    NV.reveal();
  });
})();
