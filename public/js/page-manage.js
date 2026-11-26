/* Console — catalogue manager (add / edit / remove products & departments) */
(function () {
  const NV = window.NV;
  let catalog = null;
  let editingProduct = null;   /* product id or null */
  let editingCategory = null;  /* category id or null */
  let clearing = null;         /* { kind, id, name } */
  let pendingImage = null;     /* data URI being staged */
  let pendingCatImage = null;
  let filter = { q: '', dept: 'all', sort: 'name' };

  const CHANGELOG = 'norvex.catalog.log.v1';
  const money = n => NV.money(Number(n) || 0);
  const thumbOf = p => {
    const img = String(p.img || '');
    if (img.startsWith('data:')) return img;
    const name = (img.split('/').pop() || '').replace(/\.jpg$/, '');
    const reg = window.__NV_IMG || {};
    if (reg[name]) return reg[name].sm || reg[name].md || reg[name].src || '';
    if (img) return img;
    return `/img/products/${name || 'beans'}-sm.jpg`;
  };
  const catOf = id => (catalog.categories.find(c => c.id === id) || { name: 'Unassigned', icon: 'box' });
  const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 28);
  const uid = prefix => prefix + '-' + Math.random().toString(36).slice(2, 8);

  function logChange(text) {
    const rows = NV.read(CHANGELOG, []);
    rows.unshift({ at: new Date().toISOString(), text });
    NV.write(CHANGELOG, rows.slice(0, 12));
  }

  /* ---------------- stats ---------------- */
  function paintStats() {
    const products = catalog.products;
    const prices = products.map(p => p.tiers[0][1]).filter(Boolean);
    const min = Math.min(...prices), max = Math.max(...prices);
    const uploads = products.filter(p => String(p.img || '').startsWith('data:')).length;
    const stats = [
      { label: 'Products live', value: products.length, foot: `${catalog.categories.length} departments` },
      { label: 'Price range', value: `${NV.compact(min)} – ${NV.compact(max)}`, foot: 'Base tier, ex-VAT', accent: true },
      { label: 'Uploaded pictures', value: uploads, foot: uploads ? 'Stored on this device' : 'Using department photography' },
      { label: 'Out of catalogue', value: NV.catalogAdmin.overrides().products.deleted.length, foot: 'Hidden from the shopfront' }
    ];
    document.getElementById('mgStats').innerHTML = stats.map(s => `
      <div class="mg-stat ${s.accent ? 'accent' : ''}">
        <span class="mg-stat-label">${NV.esc(s.label)}</span>
        <b>${NV.esc(String(s.value))}</b>
        <small>${NV.esc(s.foot)}</small>
      </div>`).join('');
  }

  /* ---------------- filters ---------------- */
  function paintDeptFilter() {
    const sel = document.getElementById('mgDept');
    const keep = filter.dept;
    sel.innerHTML = `<option value="all">All departments (${catalog.products.length})</option>` +
      catalog.categories.map(c => {
        const n = catalog.products.filter(p => p.cat === c.id).length;
        return `<option value="${NV.esc(c.id)}">${NV.esc(c.name)} (${n})</option>`;
      }).join('');
    sel.value = catalog.categories.some(c => c.id === keep) ? keep : 'all';
    filter.dept = sel.value;
  }

  function rows() {
    const q = filter.q.trim().toLowerCase();
    let list = catalog.products.filter(p => {
      if (filter.dept !== 'all' && p.cat !== filter.dept) return false;
      if (!q) return true;
      return [p.name, p.id, p.unit, catOf(p.cat).name, (p.tags || []).join(' ')].join(' ').toLowerCase().includes(q);
    });
    const price = p => p.tiers[0][1];
    if (filter.sort === 'price-high') list = list.slice().sort((a, b) => price(b) - price(a));
    else if (filter.sort === 'price-low') list = list.slice().sort((a, b) => price(a) - price(b));
    else if (filter.sort === 'newest') list = list.slice().reverse();
    else list = list.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list;
  }

  /* ---------------- product table ---------------- */
  function paintRows() {
    const list = rows();
    const body = document.getElementById('mgRows');
    const empty = document.getElementById('mgEmpty');
    document.getElementById('mgCount').textContent = `${list.length} of ${catalog.products.length} products`;
    document.getElementById('mgMeta').textContent = `${list.length} shown · editing updates the live shopfront`;

    if (!list.length) { body.innerHTML = ''; empty.classList.remove('hide'); return; }
    empty.classList.add('hide');

    body.innerHTML = list.map(p => {
      const t2 = p.tiers[1] ? p.tiers[1] : null;
      const isNew = String(p.id).startsWith('nvx-new');
      return `<tr data-row="${NV.esc(p.id)}">
        <td class="mg-col-media"><span class="mg-thumb"><img src="${NV.esc(thumbOf(p))}" alt="" loading="lazy"></span></td>
        <td>
          <button class="mg-name" data-edit="${NV.esc(p.id)}">${NV.esc(p.name)}</button>
          <div class="cell-sub mono">${NV.esc(p.id)}${isNew ? ' · new' : ''}${p.featured ? ' · featured' : ''}</div>
        </td>
        <td><span class="mg-dept"><i data-icon="${NV.esc(catOf(p.cat).icon || 'box')}"></i>${NV.esc(catOf(p.cat).name)}</span></td>
        <td class="num">${money(p.tiers[0][1])}<div class="cell-sub">per ${NV.esc(p.unit || 'unit')}</div></td>
        <td class="num">${t2 ? money(t2[1]) + `<div class="cell-sub">from ${t2[0]}</div>` : '<span class="tiny muted">—</span>'}</td>
        <td class="num">${p.moq || 1}</td>
        <td class="actions">
          <button class="mg-icon" data-edit="${NV.esc(p.id)}" aria-label="Edit ${NV.esc(p.name)}"><span data-icon="settings"></span></button>
          <button class="mg-icon danger" data-del="${NV.esc(p.id)}" aria-label="Remove ${NV.esc(p.name)}"><span data-icon="close"></span></button>
        </td>
      </tr>`;
    }).join('');

    body.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });
    body.querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => openProduct(b.dataset.edit); });
    body.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => askRemove('product', b.dataset.del); });
  }

  /* ---------------- departments ---------------- */
  function paintCategories() {
    const host = document.getElementById('mgCats');
    host.innerHTML = catalog.categories.map(c => {
      const n = catalog.products.filter(p => p.cat === c.id).length;
      return `<div class="mg-cat" data-cat="${NV.esc(c.id)}">
        <span class="mg-cat-ico" data-icon="${NV.esc(c.icon || 'box')}"></span>
        <span class="mg-cat-body">
          <b>${NV.esc(c.name)}</b>
          <small>${n} ${n === 1 ? 'product' : 'products'}${n ? '' : ' · empty'}</small>
        </span>
        <button class="mg-icon" data-cat-edit="${NV.esc(c.id)}" aria-label="Edit ${NV.esc(c.name)}"><span data-icon="settings"></span></button>
        <button class="mg-icon danger" data-cat-del="${NV.esc(c.id)}" aria-label="Remove ${NV.esc(c.name)}"><span data-icon="close"></span></button>
      </div>`;
    }).join('') || '<p class="small muted">No departments yet — add the first one.</p>';

    host.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });
    host.querySelectorAll('[data-cat-edit]').forEach(b => { b.onclick = () => openCategory(b.dataset.catEdit); });
    host.querySelectorAll('[data-cat-del]').forEach(b => { b.onclick = () => askRemove('category', b.dataset.catDel); });
  }

  function paintLog() {
    const rows = NV.read(CHANGELOG, []);
    const host = document.getElementById('mgLog');
    if (!rows.length) { host.innerHTML = '<p class="small muted">No edits yet. Changes you make appear here.</p>'; return; }
    host.innerHTML = rows.slice(0, 6).map(r => `
      <div class="mg-log">
        <span class="mg-log-dot"></span>
        <div><b>${NV.esc(r.text)}</b><small>${NV.dateFmt(r.at)}</small></div>
      </div>`).join('');
  }

  function paintAll() {
    paintStats(); paintDeptFilter(); paintRows(); paintCategories(); paintLog();
    document.querySelectorAll('#mgModal [data-icon], #mgConfirm [data-icon], .mg-toolbar [data-icon], #mgStats [data-icon]')
      .forEach(el => { if (!el.firstChild) el.innerHTML = NV.icon(el.dataset.icon); });
  }

  /* ---------------- modal plumbing ---------------- */
  const modal = () => document.getElementById('mgModal');
  function openModal(kind) {
    modal().classList.add('show');
    modal().querySelectorAll('[data-mg]').forEach(el => { el.hidden = el.dataset.mg !== kind; });
    document.getElementById('mgModalEyebrow').textContent = kind === 'product' ? 'Product' : 'Department';
    document.getElementById('mgFormError').classList.remove('show');
    document.body.classList.add('mg-locked');
  }
  function closeModal() {
    modal().classList.remove('show');
    document.body.classList.remove('mg-locked');
    editingProduct = null; editingCategory = null;
    pendingImage = null; pendingCatImage = null;
  }

  function setPreview(kind, src) {
    const img = document.getElementById(kind === 'cat' ? 'mgCatPreviewImg' : 'mgPreviewImg');
    const empty = document.getElementById(kind === 'cat' ? 'mgCatPreviewEmpty' : 'mgPreviewEmpty');
    if (src) { img.src = src; img.hidden = false; empty.style.display = 'none'; }
    else { img.removeAttribute('src'); img.hidden = true; empty.style.display = ''; }
  }

  function paintStockThumbs(kind, deptId) {
    const dept = catalog.categories.find(c => c.id === deptId) || catalog.categories[0];
    const set = catalog.categories.map(c => c).slice(0, 8);
    const host = document.getElementById(kind === 'cat' ? 'mgCatThumbs' : 'mgThumbs');
    host.innerHTML = set.map(c => `
      <button type="button" class="mg-thumb-pick" data-pick="${NV.esc(c.img || '')}" title="${NV.esc(c.name)}">
        <img src="${NV.esc(thumbOf({ img: c.img }))}" alt="" loading="lazy">
      </button>`).join('');
    host.querySelectorAll('[data-pick]').forEach(b => {
      b.onclick = () => {
        const src = b.dataset.pick;
        if (kind === 'cat') { pendingCatImage = src; setPreview('cat', src); }
        else { pendingImage = src; setPreview('product', src); }
      };
    });
  }

  /* ---------------- product editor ---------------- */
  function fillCategorySelects(selected) {
    const formSel = document.getElementById('mgFormCat');
    formSel.innerHTML = catalog.categories.map(c => `<option value="${NV.esc(c.id)}">${NV.esc(c.name)}</option>`).join('');
    if (selected) formSel.value = selected;
  }

  function openProduct(id) {
    const form = document.getElementById('mgForm');
    form.reset();
    editingProduct = id || null;
    const p = id ? catalog.products.find(x => x.id === id) : null;
    document.getElementById('mgModalTitle').textContent = p ? 'Edit product' : 'Add product';
    document.getElementById('mgSave').textContent = p ? 'Save changes' : 'Add product';
    fillCategorySelects(p ? p.cat : (filter.dept !== 'all' ? filter.dept : catalog.categories[0].id));

    if (p) {
      form.name.value = p.name || '';
      form.unit.value = p.unit || '';
      form.moq.value = p.moq || 1;
      form.lead.value = p.lead || '';
      form.desc.value = p.desc || '';
      form.price1.value = p.tiers[0] ? p.tiers[0][1] : '';
      form.qty2.value = p.tiers[1] ? p.tiers[1][0] : '';
      form.price2.value = p.tiers[1] ? p.tiers[1][1] : '';
      form.qty3.value = p.tiers[2] ? p.tiers[2][0] : '';
      form.price3.value = p.tiers[2] ? p.tiers[2][1] : '';
      form.featured.checked = !!p.featured;
      form.popular.checked = !!p.popular;
      pendingImage = p.img || null;
      setPreview('product', p.img && String(p.img).startsWith('data:') ? p.img : null);
    } else {
      form.moq.value = 1;
      pendingImage = null;
      setPreview('product', null);
    }
    paintStockThumbs('product', p ? p.cat : filter.dept);
    openModal('product');
    setTimeout(() => form.name.focus({ preventScroll: true }), 120);
  }

  /* ---------------- department editor ---------------- */
  const ICON_CHOICES = ['box', 'layers', 'grain', 'paper', 'chip', 'chair', 'spray', 'school', 'helm', 'bolt', 'shirt', 'pot', 'print', 'drop', 'leaf', 'cart', 'clipboard', 'shield'];

  function openCategory(id) {
    const form = document.getElementById('mgForm');
    form.reset();
    editingCategory = id || null;
    const c = id ? catalog.categories.find(x => x.id === id) : null;
    document.getElementById('mgModalTitle').textContent = c ? 'Edit department' : 'Add department';
    document.getElementById('mgSave').textContent = c ? 'Save changes' : 'Add department';
    const iconSel = document.getElementById('mgCatIcon');
    iconSel.innerHTML = ICON_CHOICES.map(i => `<option value="${i}">${i}</option>`).join('');
    form.catName.value = c ? c.name : '';
    form.catBlurb.value = c ? (c.blurb || '') : '';
    iconSel.value = c ? (c.icon || 'box') : 'box';
    pendingCatImage = c ? c.img : null;
    setPreview('cat', c ? c.img : null);
    paintStockThumbs('cat');
    openModal('category');
    setTimeout(() => form.catName.focus({ preventScroll: true }), 120);
  }

  /* ---------------- save ---------------- */
  function saveProduct(form) {
    const err = document.getElementById('mgFormError');
    const name = form.name.value.trim();
    const price = Number(form.price1.value);
    const errors = [];
    if (name.length < 2) errors.push('Give the product a name.');
    if (!(price > 0)) errors.push('Set a base price greater than zero.');
    if (!form.cat.value) errors.push('Choose a department.');
    if (errors.length) { err.textContent = errors.join(' '); err.classList.add('show'); return; }

    const tiers = [[1, price]];
    const q2 = Number(form.qty2.value), p2 = Number(form.price2.value);
    const q3 = Number(form.qty3.value), p3 = Number(form.price3.value);
    if (q2 > 1 && p2 > 0) tiers.push([Math.round(q2), p2]);
    if (q3 > 1 && p3 > 0 && (!tiers[1] || q3 > tiers[1][0])) tiers.push([Math.round(q3), p3]);

    const existing = editingProduct ? catalog.products.find(p => p.id === editingProduct) : null;
    const product = {
      id: existing ? existing.id : 'nvx-new-' + Math.random().toString(36).slice(2, 7),
      name,
      cat: form.cat.value,
      unit: form.unit.value.trim() || 'unit',
      moq: Math.max(1, Math.round(Number(form.moq.value) || 1)),
      lead: form.lead.value.trim() || existing && existing.lead || '2–4 days',
      tiers,
      desc: form.desc.value.trim() || (existing ? existing.desc : `Supplied by Norvex for institutions across Kenya.`),
      img: pendingImage || (existing ? existing.img : '') || (catalog.categories.find(c => c.id === form.cat.value) || {}).img || '',
      featured: form.featured.checked,
      popular: form.popular.checked,
      tags: (existing && existing.tags) || name.toLowerCase().split(/\s+/).slice(0, 4)
    };
    NV.catalogAdmin.upsertProduct(product);
    logChange(`${existing ? 'Updated' : 'Added'} ${product.name}`);
    closeModal();
    reload().then(() => NV.toast(`${product.name} ${existing ? 'updated' : 'added to the catalogue'}.`, { title: existing ? 'Saved' : 'Product added' }));
  }

  function saveCategory(form) {
    const err = document.getElementById('mgFormError');
    const name = form.catName.value.trim();
    if (name.length < 2) { err.textContent = 'Give the department a name.'; err.classList.add('show'); return; }
    const existing = editingCategory ? catalog.categories.find(c => c.id === editingCategory) : null;
    if (!existing && catalog.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      err.textContent = 'That department already exists.'; err.classList.add('show'); return;
    }
    const category = {
      id: existing ? existing.id : (slug(name) || uid('dept')),
      name,
      icon: document.getElementById('mgCatIcon').value || 'box',
      blurb: form.catBlurb.value.trim() || 'Supplied on request — ask the desk for a quotation.',
      img: pendingCatImage || (existing ? existing.img : '') || '/img/products/office.jpg'
    };
    NV.catalogAdmin.upsertCategory(category);
    logChange(`${existing ? 'Updated' : 'Added'} department ${category.name}`);
    closeModal();
    reload().then(() => NV.toast(`Department “${category.name}” ${existing ? 'updated' : 'added'}.`, { title: existing ? 'Saved' : 'Department added' }));
  }

  /* ---------------- remove ---------------- */
  function askRemove(kind, id) {
    const isCat = kind === 'category';
    const item = isCat ? catalog.categories.find(c => c.id === id) : catalog.products.find(p => p.id === id);
    if (!item) return;
    clearing = { kind, id, name: item.name };
    document.getElementById('mgConfirmTitle').textContent = isCat ? 'Remove department?' : 'Remove product?';
    const count = isCat ? catalog.products.filter(p => p.cat === id).length : 0;
    document.getElementById('mgConfirmCopy').textContent = isCat
      ? `“${item.name}” and its ${count} product${count === 1 ? '' : 's'} will disappear from the shopfront. You can restore demo data from the toolbar.`
      : `“${item.name}” will disappear from the catalogue and any customer basket.`;
    document.getElementById('mgConfirm').classList.add('show');
    document.body.classList.add('mg-locked');
  }
  function closeConfirm() {
    document.getElementById('mgConfirm').classList.remove('show');
    document.body.classList.remove('mg-locked');
    clearing = null;
  }
  function doRemove() {
    if (!clearing) return;
    if (clearing.kind === 'category') NV.catalogAdmin.removeCategory(clearing.id);
    else NV.catalogAdmin.removeProduct(clearing.id);
    logChange(`Removed ${clearing.kind === 'category' ? 'department' : 'product'} ${clearing.name}`);
    const name = clearing.name;
    closeConfirm();
    reload().then(() => NV.toast(`${name} removed from the shopfront.`, { title: 'Removed' }));
  }

  /* ---------------- data plumbing ---------------- */
  async function reload() {
    catalog = await NV.reloadCatalog();
    paintAll();
    document.querySelectorAll('[data-icon]').forEach(el => { if (!el.firstChild && el.dataset.icon) el.innerHTML = NV.icon(el.dataset.icon); });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[data-icon]').forEach(el => { if (!el.firstChild) el.innerHTML = NV.icon(el.dataset.icon); });
    catalog = await NV.catalog();
    document.querySelectorAll('[data-mg="product"] [data-icon], [data-mg="category"] [data-icon]').forEach(el => { if (!el.firstChild) el.innerHTML = NV.icon(el.dataset.icon); });
    paintAll();

    /* toolbar */
    document.getElementById('mgSearch').addEventListener('input', e => { filter.q = e.target.value; paintRows(); });
    document.getElementById('mgDept').addEventListener('change', e => { filter.dept = e.target.value; paintRows(); });
    document.getElementById('mgSort').addEventListener('change', e => { filter.sort = e.target.value; paintRows(); });
    document.getElementById('mgAddProduct').onclick = () => openProduct(null);
    const add2 = document.getElementById('mgAddProduct2');
    if (add2) add2.onclick = () => openProduct(null);
    document.getElementById('mgAddCat').onclick = () => openCategory(null);

    document.getElementById('mgExport').onclick = () => {
      const data = JSON.stringify(catalog, null, 2);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      a.download = `norvex-catalogue-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      NV.toast('Catalogue exported as JSON.', { title: 'Export ready' });
    };
    document.getElementById('mgReset').onclick = () => {
      NV.catalogAdmin.reset();
      NV.write(CHANGELOG, []);
      reload().then(() => NV.toast('Catalogue restored to the shipped data.', { title: 'Reset' }));
    };

    /* modal events */
    document.getElementById('mgClose').onclick = closeModal;
    document.getElementById('mgCancel').onclick = closeModal;
    modal().addEventListener('click', e => { if (e.target === modal()) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (document.getElementById('mgConfirm').classList.contains('show')) closeConfirm();
      else if (modal().classList.contains('show')) closeModal();
    });

    document.getElementById('mgForm').addEventListener('submit', e => {
      e.preventDefault();
      const kind = modal().querySelector('[data-mg]:not([hidden])').dataset.mg;
      if (kind === 'category') saveCategory(e.target);
      else saveProduct(e.target);
    });

    /* uploads */
    async function handleUpload(file, kind) {
      if (!file) return;
      if (!/^image\//.test(file.type)) { NV.toast('Choose a JPG or PNG picture.', { title: 'Unsupported file', type: 'error' }); return; }
      try {
        const data = await NV.shrinkImage(file, 900);
        if (kind === 'cat') { pendingCatImage = data; setPreview('cat', data); }
        else { pendingImage = data; setPreview('product', data); }
      } catch (err) {
        NV.toast('That picture could not be read.', { title: 'Upload failed', type: 'error' });
      }
    }
    document.getElementById('mgUploadBtn').onclick = () => document.getElementById('mgFile').click();
    document.getElementById('mgFile').addEventListener('change', e => handleUpload(e.target.files[0], 'product'));
    document.getElementById('mgCatUploadBtn').onclick = () => document.getElementById('mgCatFile').click();
    document.getElementById('mgCatFile').addEventListener('change', e => handleUpload(e.target.files[0], 'cat'));
    document.getElementById('mgClearImg').onclick = () => { pendingImage = ''; setPreview('product', null); };

    /* drag & drop onto the preview */
    ['mgPreview', 'mgCatPreview'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop'));
      el.addEventListener('drop', e => {
        e.preventDefault(); el.classList.remove('drop');
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        handleUpload(file, id === 'mgCatPreview' ? 'cat' : 'product');
      });
    });

    /* confirm */
    document.getElementById('mgConfirmNo').onclick = closeConfirm;
    document.getElementById('mgConfirmYes').onclick = doRemove;
    document.getElementById('mgConfirm').addEventListener('click', e => { if (e.target.id === 'mgConfirm') closeConfirm(); });
  });
})();
