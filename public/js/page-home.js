/* Home page — department grid, featured products, stars */
(function () {
  const NV = window.NV;

  async function init() {
    const cat = await NV.catalog();
    const catName = id => (cat.categories.find(c => c.id === id) || {}).name || id;

    /* departments */
    const grid = document.getElementById('categoryGrid');
    if (grid) {
      grid.innerHTML = cat.categories.map(c =>
        NV.ui.categoryCard(c, cat.products.filter(p => p.cat === c.id).length)
      ).join('');
      NV.reveal();
    }

    /* hero requisition tiles get real photography */
    document.querySelectorAll('#heroTiles [data-tile]').forEach(tile => {
      const ph = tile.querySelector('.hero-tile-ph');
      if (!ph) return;
      const src = NV.ui.imgSrc(tile.dataset.tile, 'md');
      const tiny = NV.ui.imgSrc(tile.dataset.tile, 'tiny');
      ph.style.backgroundImage = `url('${tiny}')`;
      const img = document.createElement('img');
      img.src = src; img.alt = ''; img.loading = 'eager'; img.decoding = 'async';
      img.onload = () => img.classList.add('is-loaded');
      ph.appendChild(img);
    });

    /* featured products with filter chips */
    const featured = document.getElementById('featuredGrid');
    const picks = cat.products.filter(p => p.featured || p.popular);
    const paint = filter => {
      const list = filter === 'all' ? picks : picks.filter(p => p.cat === filter);
      featured.innerHTML = list.length
        ? list.slice(0, 8).map(p => NV.ui.productCard(p, catName(p.cat))).join('')
        : `<div class="table-empty" style="grid-column:1/-1"><h3>No contract picks in this department yet</h3><p class="small muted">Browse the full catalogue to see every line.</p></div>`;
      NV.ui.bindCards(featured);
    };
    if (featured) {
      featured.innerHTML = NV.ui.skeletons(4);
      paint('all');
      document.querySelectorAll('[data-filter]').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('[data-filter]').forEach(c => c.classList.toggle('on', c === chip));
          paint(chip.dataset.filter);
        });
      });
    }

    /* stars */
    const stars = document.getElementById('stars');
    if (stars) {
      stars.innerHTML = Array.from({ length: 5 }).map(() => `<span style="width:18px">${NV.icon('star')}</span>`).join('');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
