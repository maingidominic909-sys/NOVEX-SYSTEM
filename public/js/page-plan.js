/* Console — future order planner */
(function () {
  const NV = window.NV;
  let catalog = null;
  const linesHost = () => document.getElementById('planLines');

  document.addEventListener('DOMContentLoaded', async () => {
    catalog = await NV.catalog();
    document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = NV.icon(el.dataset.icon));

    const form = document.getElementById('planForm');

    const options = () => `<option value="">Select item…</option>` +
      catalog.categories.map(c => `<optgroup label="${NV.esc(c.name)}">` +
        catalog.products.filter(p => p.cat === c.id).map(p =>
          `<option value="${p.id}">${NV.esc(p.name)}</option>`).join('') + `</optgroup>`).join('');

    function addRow(selected, qty) {
      const row = document.createElement('div');
      row.className = 'plan-row';
      row.innerHTML = `
        <select class="select" data-item>${options()}</select>
        <input class="input" type="number" min="1" value="${qty || 1}" data-qty aria-label="Quantity">
        <span class="unit" data-unit>—</span>
        <button type="button" class="kill" aria-label="Remove line">${NV.icon('close')}</button>`;
      linesHost().appendChild(row);
      const sel = row.querySelector('[data-item]');
      if (selected) sel.value = selected;
      const paintUnit = () => {
        const p = catalog.products.find(x => x.id === sel.value);
        row.querySelector('[data-unit]').textContent = p ? p.unit : '—';
        estimate();
      };
      sel.onchange = paintUnit;
      row.querySelector('[data-qty]').oninput = estimate;
      row.querySelector('.kill').onclick = () => { row.remove(); estimate(); };
      paintUnit();
    }

    function estimate() {
      const picks = [...linesHost().querySelectorAll('.plan-row')].map(row => {
        const p = catalog.products.find(x => x.id === row.querySelector('[data-item]').value);
        if (!p) return null;
        const q = Math.max(1, parseInt(row.querySelector('[data-qty]').value, 10) || 1);
        return { qty: q, lineTotal: NV.tierPrice(p, q) * q };
      }).filter(Boolean);
      document.getElementById('planEstValue').textContent = NV.money(picks.reduce((s, l) => s + l.lineTotal, 0));
    }

    /* seed from basket or one blank row */
    const basketRows = NV.basket.raw();
    if (basketRows.length) basketRows.slice(0, 6).forEach(r => addRow(r.id, r.qty));
    else addRow();

    document.getElementById('addPlanLine').onclick = () => addRow();

    /* prefill */
    const saved = NV.customer.get();
    ['name', 'organisation', 'email', 'phone'].forEach(k => { if (saved[k]) form[k].value = saved[k]; });
    if (saved.address) form.deliveryLocation.value = saved.address;
    const inTwoWeeks = new Date(Date.now() + 21 * 864e5);
    form.deliveryDate.value = inTwoWeeks.toISOString().slice(0, 10);

    form.querySelectorAll('.input, .select, .textarea').forEach(el => el.addEventListener('input', () => el.closest('.field')?.classList.remove('has-error')));

    const validate = () => {
      let ok = true;
      form.querySelectorAll('[required]').forEach(input => {
        const field = input.closest('.field') || input.parentElement;
        const empty = input.type === 'checkbox' ? !input.checked : !String(input.value).trim();
        const badEmail = input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value);
        const invalid = empty || badEmail;
        if (field.classList.contains('field')) field.classList.toggle('has-error', invalid);
        if (invalid) ok = false;
      });
      const hasLine = [...linesHost().querySelectorAll('[data-item]')].some(s => s.value);
      if (!hasLine) { NV.toast('Add at least one item to your plan.', { title: 'No items', type: 'error' }); ok = false; }
      return ok;
    };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validate()) return;
      const btn = document.getElementById('planSubmit');
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Submitting plan…';
      btn.classList.add('is-disabled');

      const data = Object.fromEntries(new FormData(form).entries());
      const items = [...linesHost().querySelectorAll('.plan-row')].map(row => {
        const p = catalog.products.find(x => x.id === row.querySelector('[data-item]').value);
        return p ? { id: p.id, qty: parseInt(row.querySelector('[data-qty]').value, 10) || 1, unit: p.unit } : null;
      }).filter(Boolean);

      const payload = {
        contact: { name: data.name, email: data.email, phone: data.phone, organisation: data.organisation },
        deliveryDate: data.deliveryDate,
        deliveryLocation: data.deliveryLocation,
        recurrence: data.recurrence,
        budget: data.budget,
        notes: [data.notes, data.reference ? `Ref: ${data.reference}` : ''].filter(Boolean).join(' · '),
        items
      };

      try {
        const res = await NV.api('/future-orders', { method: 'POST', body: payload });
        NV.customer.save({ name: data.name, organisation: data.organisation, email: data.email, phone: data.phone, address: data.deliveryLocation });
        form.classList.add('hide');
        document.getElementById('planSuccess').classList.remove('hide');
        document.getElementById('planRef').textContent = res.futureOrder.ref;
        NV.toast('Our desk will confirm availability and reserved pricing.', { title: 'Plan submitted' });
      } catch (err) {
        if (err.offline) {
          const localRef = NV.ref('FO');
          const rows = NV.read('norvex.futureOrders.local.v1', []);
          rows.unshift({ ref: localRef, ...payload, createdAt: new Date().toISOString(), status: 'planning' });
          NV.write('norvex.futureOrders.local.v1', rows);
          form.classList.add('hide');
          document.getElementById('planSuccess').classList.remove('hide');
          document.getElementById('planRef').textContent = localRef;
          NV.toast('Saved locally — the API is offline in this preview.', { title: 'Plan captured' });
        } else {
          NV.toast(err.message, { title: 'Could not submit', type: 'error' });
        }
      } finally {
        btn.innerHTML = original;
        btn.classList.remove('is-disabled');
      }
    });

    document.getElementById('planAgain').onclick = () => {
      document.getElementById('planSuccess').classList.add('hide');
      form.classList.remove('hide');
      form.reset();
      linesHost().innerHTML = '';
      addRow();
      estimate();
    };
  });
})();
