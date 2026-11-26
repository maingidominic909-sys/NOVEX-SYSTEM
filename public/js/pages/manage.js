/* NORVEX v2 — catalogue manager (device-local overrides on the live catalogue) */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  let cat = null, tab = 'products', query = '', editing = null, editKind = 'product', imgData = '';

  const ICON_CHOICES = ['grain', 'paper', 'chip', 'chair', 'spray', 'school', 'helm', 'bolt', 'shirt', 'pot', 'print', 'drop', 'leaf', 'box', 'truck', 'shield'];
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  function guard() {
    document.getElementById('manageRoot').innerHTML = `
      <div class="auth-guard">
        <div class="auth-guard-body">
          <p class="eyebrow">Restricted · catalogue</p>
          <h2>Administrator sign-in required</h2>
          <p>The catalogue manager edits prices, tiers, pictures and departments. Sign in with an administrator account.</p>
          <p class="hint mt-1">Demo administrator: <b>admin@norvex.co.ke</b> · <b>Norvex2026</b></p>
        </div>
        <div class="auth-guard-actions"><a class="btn btn-gold" href="/auth.html?mode=signin&next=/manage.html">Sign in as admin</a></div>
      </div>`;
  }

  async function render() {
    const user = NV.auth.current();
    if (!user || user.role !== 'admin') return guard();
    cat = await NV.reloadCatalog();
    const root = document.getElementById('manageRoot');
    const overrides = NV.catalogAdmin.overrides();
    const touched = Object.keys(overrides.products.edited).length + overrides.products.added.length + overrides.products.deleted.length +
      Object.keys(overrides.categories.edited).length + overrides.categories.added.length + overrides.categories.deleted.length;

    root.innerHTML = `
      <div class="row between wrap mb-3">
        <div>
          <p class="eyebrow">Catalogue manager</p>
          <h1 class="serif" style="font-size:1.7rem">${cat.products.length} lines · ${cat.categories.length} departments</h1>
          <p class="hint mt-1">Edits apply instantly on this device (offline-first overrides). ${touched ? `<b>${touched} local change${touched === 1 ? '' : 's'} active.</b>` : 'No local changes yet.'}</p>
        </div>
        <div class="row wrap">
          ${touched ? `<button class="btn btn-danger btn-sm" id="resetOverrides">${NV.icon('refresh')} Reset local changes</button>` : ''}
          <a class="btn btn-ghost btn-sm" href="/admin.html">${NV.icon('chart')} Operations</a>
        </div>
      </div>
      <div class="row wrap mb-3">
        <button class="chip ${tab === 'products' ? 'on' : ''}" data-tab="products">${NV.icon('box')} Products</button>
        <button class="chip ${tab === 'departments' ? 'on' : ''}" data-tab="departments">${NV.icon('grid')} Departments</button>
        <span class="spread"></span>
        ${tab === 'products' ? `
          <div class="input-wrap" style="min-width:220px"><span class="lead">${NV.icon('search')}</span><input class="input" id="manageSearch" placeholder="Search products…" value="${E(query)}" style="padding-top:9px;padding-bottom:9px"></div>
          <button class="btn btn-gold btn-sm" id="addProduct">${NV.icon('plus')} Add product</button>`
        : `<button class="btn btn-gold btn-sm" id="addDept">${NV.icon('plus')} Add department</button>`}
      </div>
      <div id="manageBody"></div>`;

    root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    const reset = document.getElementById('resetOverrides');
    if (reset) reset.addEventListener('click', () => {
      if (confirm('Discard all local catalogue changes and restore the published catalogue?')) {
        NV.catalogAdmin.reset();
        NV.toast('Local changes discarded.', { title: 'Catalogue restored' });
        render();
      }
    });
    if (tab === 'products') renderProducts(); else renderDepts();
  }

  function renderProducts() {
    const body = document.getElementById('manageBody');
    const q = query.toLowerCase();
    const list = cat.products.filter(p => !q || (p.name + ' ' + p.id + ' ' + p.cat).toLowerCase().includes(q));
    body.innerHTML = `
      <div class="table-wrap">
        <table class="table" style="min-width:820px">
          <thead><tr><th></th><th>Product</th><th>Department</th><th>Unit</th><th class="num">MOQ</th><th>Lead</th><th class="num">Price tiers</th><th></th></tr></thead>
          <tbody>
            ${list.map(p => `
              <tr>
                <td>${p.img ? `<img class="manage-thumb" src="${E(p.img)}" alt="">` : `<span class="manage-art">${NV.icon(NV.catIcon(p.cat))}</span>`}</td>
                <td><b>${E(p.name)}</b><br><small class="muted">${E(p.id.toUpperCase())}${p.featured ? ' · featured' : ''}${p.popular ? ' · popular' : ''}</small></td>
                <td>${E(NV.ui.catName(cat, p.cat))}</td>
                <td>${E(p.unit)}</td>
                <td class="num">${p.moq}</td>
                <td class="nowrap">${E(p.lead)}</td>
                <td class="num small">${p.tiers.map(([m, v]) => `${m}+ → ${NV.money(v)}`).join('<br>')}</td>
                <td class="nowrap">
                  <button class="btn btn-ghost btn-sm btn-icon" data-edit="${E(p.id)}" aria-label="Edit ${E(p.name)}">${NV.icon('edit')}</button>
                  <button class="btn btn-danger btn-sm btn-icon" data-del="${E(p.id)}" aria-label="Delete ${E(p.name)}">${NV.icon('trash')}</button>
                </td>
              </tr>`).join('') || '<tr><td colspan="8" class="center muted" style="padding:30px">No products match.</td></tr>'}
          </tbody>
        </table>
      </div>`;
    const search = document.getElementById('manageSearch');
    search.addEventListener('input', () => { query = search.value; renderProducts(); const el = document.getElementById('manageSearch'); el.focus(); });
    document.getElementById('addProduct').addEventListener('click', () => openProductModal(null));
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openProductModal(cat.products.find(p => p.id === b.dataset.edit))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const p = cat.products.find(x => x.id === b.dataset.del);
      if (!p || !confirm(`Delete “${p.name}” from the catalogue on this device?`)) return;
      NV.catalogAdmin.removeProduct(p.id);
      NV.toast(`${p.name} removed.`, { title: 'Deleted' });
      render();
    }));
  }

  function renderDepts() {
    const body = document.getElementById('manageBody');
    const count = id => cat.products.filter(p => p.cat === id).length;
    body.innerHTML = `
      <div class="dept-manage">
        ${cat.categories.map(c => `
          <div class="dept-chip">
            <span class="mi">${NV.icon(c.icon || 'box')}</span>
            <span><b>${E(c.name)}</b><small>${E(c.id)} · ${count(c.id)} lines</small></span>
            <span class="acts">
              <button data-edit-dept="${E(c.id)}" aria-label="Edit ${E(c.name)}">${NV.icon('edit')}</button>
              <button class="del" data-del-dept="${E(c.id)}" aria-label="Delete ${E(c.name)}">${NV.icon('trash')}</button>
            </span>
          </div>`).join('')}
      </div>
      <p class="hint mt-2">Deleting a department also hides its products on this device. Reset local changes to bring everything back.</p>`;
    document.getElementById('addDept').addEventListener('click', () => openDeptModal(null));
    body.querySelectorAll('[data-edit-dept]').forEach(b => b.addEventListener('click', () => openDeptModal(cat.categories.find(c => c.id === b.dataset.editDept))));
    body.querySelectorAll('[data-del-dept]').forEach(b => b.addEventListener('click', () => {
      const c = cat.categories.find(x => x.id === b.dataset.delDept);
      const n = cat.products.filter(p => p.cat === c.id).length;
      if (!confirm(`Delete department “${c.name}”${n ? ` and hide its ${n} products` : ''}?`)) return;
      NV.catalogAdmin.removeCategory(c.id);
      NV.toast(`${c.name} removed.`, { title: 'Deleted' });
      render();
    }));
  }

  /* ---------------- modal host ---------------- */
  function modal(html) {
    let host = document.getElementById('manageModal');
    if (!host) {
      host = document.createElement('div');
      host.id = 'manageModal';
      host.className = 'modal-overlay';
      document.body.appendChild(host);
    }
    host.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    requestAnimationFrame(() => host.classList.add('open'));
    document.body.classList.add('locked');
    const close = () => { host.classList.remove('open'); document.body.classList.remove('locked'); };
    host.addEventListener('click', e => { if (e.target === host) close(); });
    host.querySelectorAll('[data-modal-x]').forEach(b => b.addEventListener('click', close));
    return { host, close };
  }

  function tierRowsHtml(tiers) {
    return tiers.map(([m, v], i) => `
      <div class="tier-edit" data-tier-row>
        <input class="input" type="number" min="1" value="${m}" data-tier-min placeholder="Min qty" aria-label="Minimum quantity">
        <input class="input" type="number" min="1" value="${v}" data-tier-price placeholder="Unit price (KES)" aria-label="Unit price">
        <button class="q-remove" type="button" data-tier-del aria-label="Remove tier" ${tiers.length === 1 ? 'disabled style="opacity:.35"' : ''}>${NV.icon('trash')}</button>
      </div>`).join('');
  }

  function openProductModal(p) {
    editing = p; imgData = p ? (p.img || '') : '';
    const tiers = p ? p.tiers : [[1, 1000]];
    const { host, close } = modal(`
      <div class="modal-head"><h3>${p ? 'Edit product' : 'Add a product'}</h3><button class="drawer-x" data-modal-x aria-label="Close">${NV.icon('close')}</button></div>
      <div class="modal-body">
        <form id="productForm" class="col" style="gap:15px" novalidate>
          <div class="form-grid">
            <div class="field full"><label>Name <span class="req">*</span></label><input class="input" name="name" value="${E(p ? p.name : '')}" placeholder="e.g. Premium Long Grain Rice"><span class="err-msg">Name is required.</span></div>
            <div class="field"><label>SKU / ID</label><input class="input" name="id" value="${E(p ? p.id : '')}" placeholder="auto from name" ${p ? 'disabled' : ''}></div>
            <div class="field"><label>Department <span class="req">*</span></label>
              <select class="select" name="cat">${cat.categories.map(c => `<option value="${E(c.id)}" ${p && p.cat === c.id ? 'selected' : ''}>${E(c.name)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Pack unit <span class="req">*</span></label><input class="input" name="unit" value="${E(p ? p.unit : '')}" placeholder="e.g. 25kg bag"><span class="err-msg">Unit is required.</span></div>
            <div class="field"><label>Minimum order (MOQ)</label><input class="input" name="moq" type="number" min="1" value="${p ? p.moq : 1}"></div>
            <div class="field"><label>Lead time</label><input class="input" name="lead" value="${E(p ? p.lead : '2–4 days')}"></div>
            <div class="field"><label>Tags (comma separated)</label><input class="input" name="tags" value="${E(p ? (p.tags || []).join(', ') : '')}"></div>
            <div class="field full"><label>Description</label><textarea class="textarea" name="desc" style="min-height:80px">${E(p ? p.desc : '')}</textarea></div>
          </div>
          <div class="row wrap">
            <label class="check"><input type="checkbox" name="featured" ${p && p.featured ? 'checked' : ''}> Featured on home</label>
            <label class="check"><input type="checkbox" name="popular" ${p && p.popular ? 'checked' : ''}> Popular line</label>
          </div>
          <div>
            <span class="lbl bold small">Volume price tiers <span class="req">*</span></span>
            <p class="hint mb-1">Unit price drops when quantity reaches each minimum. First row is the list price.</p>
            <div id="tierRows">${tierRowsHtml(tiers)}</div>
            <button class="btn btn-ghost btn-sm" type="button" id="addTier">${NV.icon('plus')} Add tier</button>
          </div>
          <div>
            <span class="lbl bold small">Picture</span>
            <div class="img-drop mt-1" id="imgDrop">
              ${imgData ? `<img src="${E(imgData)}" alt="">` : NV.icon('download')}
              <p>${imgData ? 'Click to replace the picture' : 'Click to upload — resized locally, no server needed'}</p>
            </div>
            <input type="file" id="imgFile" accept="image/*" class="hide">
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-modal-x>Cancel</button>
        <button class="btn btn-gold" id="saveProduct">${NV.icon('check')} ${p ? 'Save changes' : 'Add product'}</button>
      </div>`);

    const f = host.querySelector('#productForm');
    const F = n => f.querySelector(`[name="${n}"]`);
    const rowsHost = host.querySelector('#tierRows');
    const wireTierRows = () => {
      rowsHost.querySelectorAll('[data-tier-del]').forEach(b => b.onclick = () => {
        if (rowsHost.querySelectorAll('[data-tier-row]').length > 1) { b.closest('[data-tier-row]').remove(); wireTierRows(); }
      });
    };
    wireTierRows();
    host.querySelector('#addTier').addEventListener('click', () => {
      const rows = rowsHost.querySelectorAll('[data-tier-row]');
      const last = rows[rows.length - 1];
      const min = parseInt(last.querySelector('[data-tier-min]').value, 10) || 1;
      const price = parseInt(last.querySelector('[data-tier-price]').value, 10) || 1000;
      rowsHost.insertAdjacentHTML('beforeend', tierRowsHtml([[min * 2, Math.max(1, Math.round(price * 0.95))]]));
      wireTierRows();
    });

    const drop = host.querySelector('#imgDrop');
    const file = host.querySelector('#imgFile');
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files || !file.files[0]) return;
      try {
        imgData = await NV.shrinkImage(file.files[0], 900);
        drop.innerHTML = `<img src="${imgData}" alt=""><p>Click to replace the picture</p>`;
      } catch (e) { NV.toast(e.message, { type: 'error', title: 'Image not loaded' }); }
    });

    host.querySelector('#saveProduct').addEventListener('click', () => {
      let ok = true;
      ['name', 'unit'].forEach(n => {
        const el = f.querySelector(`[name="${n}"]`);
        const good = el.value.trim().length > 0;
        el.closest('.field').classList.toggle('bad', !good);
        if (!good) ok = false;
      });
      const tiers = Array.from(rowsHost.querySelectorAll('[data-tier-row]')).map(r => [
        Math.max(1, parseInt(r.querySelector('[data-tier-min]').value, 10) || 1),
        Math.max(1, parseInt(r.querySelector('[data-tier-price]').value, 10) || 1)
      ]).sort((a, b) => a[0] - b[0]);
      if (!ok) { NV.toast('Name and pack unit are required.', { type: 'error', title: 'Check the form' }); return; }
      const id = p ? p.id : (F('id').value.trim() ? slug(F('id').value) : 'nvx-' + slug(F('name').value));
      if (!p && cat.products.some(x => x.id === id)) { NV.toast('That SKU already exists — pick another.', { type: 'error', title: 'Duplicate SKU' }); return; }
      const product = {
        id, name: F('name').value.trim(), cat: F('cat').value, unit: F('unit').value.trim(),
        moq: Math.max(1, parseInt(F('moq').value, 10) || 1), lead: F('lead').value.trim() || '2–4 days',
        tags: F('tags').value.split(',').map(s => s.trim()).filter(Boolean),
        desc: F('desc').value.trim(), featured: F('featured').checked, popular: F('popular').checked,
        tiers, img: imgData || undefined
      };
      NV.catalogAdmin.upsertProduct(product);
      NV.toast(`${product.name} ${p ? 'updated' : 'added'} — live on this device immediately.`, { title: 'Catalogue saved' });
      close();
      render();
    });
  }

  function openDeptModal(c) {
    imgData = c ? (c.img || '') : '';
    const { host, close } = modal(`
      <div class="modal-head"><h3>${c ? 'Edit department' : 'Add a department'}</h3><button class="drawer-x" data-modal-x aria-label="Close">${NV.icon('close')}</button></div>
      <div class="modal-body">
        <form id="deptForm" class="col" style="gap:15px" novalidate>
          <div class="field"><label>Name <span class="req">*</span></label><input class="input" name="name" value="${E(c ? c.name : '')}" placeholder="e.g. Medical Supplies"><span class="err-msg">Name is required.</span></div>
          <div class="form-grid">
            <div class="field"><label>ID</label><input class="input" name="id" value="${E(c ? c.id : '')}" placeholder="auto from name" ${c ? 'disabled' : ''}></div>
            <div class="field"><label>Icon</label>
              <select class="select" name="icon">${ICON_CHOICES.map(i => `<option value="${i}" ${c && c.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select>
            </div>
          </div>
          <div>
            <span class="lbl bold small">Cover picture</span>
            <div class="img-drop mt-1" id="imgDrop">${imgData ? `<img src="${E(imgData)}" alt="">` : NV.icon('download')}<p>${imgData ? 'Click to replace' : 'Click to upload a cover picture'}</p></div>
            <input type="file" id="imgFile" accept="image/*" class="hide">
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-modal-x>Cancel</button>
        <button class="btn btn-gold" id="saveDept">${NV.icon('check')} ${c ? 'Save changes' : 'Add department'}</button>
      </div>`);
    const f = host.querySelector('#deptForm');
    const F = n => f.querySelector(`[name="${n}"]`);
    const drop = host.querySelector('#imgDrop');
    const file = host.querySelector('#imgFile');
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files || !file.files[0]) return;
      try { imgData = await NV.shrinkImage(file.files[0], 900); drop.innerHTML = `<img src="${imgData}" alt=""><p>Click to replace</p>`; }
      catch (e) { NV.toast(e.message, { type: 'error', title: 'Image not loaded' }); }
    });
    host.querySelector('#saveDept').addEventListener('click', () => {
      const name = F('name').value.trim();
      const good = name.length > 1;
      F('name').closest('.field').classList.toggle('bad', !good);
      if (!good) return;
      const id = c ? c.id : (F('id').value.trim() ? slug(F('id').value) : slug(name));
      if (!c && cat.categories.some(x => x.id === id)) { NV.toast('That department ID already exists.', { type: 'error', title: 'Duplicate ID' }); return; }
      NV.catalogAdmin.upsertCategory({ id, name, icon: F('icon').value, img: imgData || undefined });
      NV.toast(`${name} ${c ? 'updated' : 'added'}.`, { title: 'Department saved' });
      close();
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    NV.auth.onChange(render);
  });
})();
