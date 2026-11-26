/* Quote desk (RFQ) page */
(function () {
  const NV = window.NV;
  let catalog = null;

  document.addEventListener('DOMContentLoaded', async () => {
    catalog = await NV.catalog();
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = NV.icon(el.dataset.icon); });
    NV.reveal();

    const linesHost = document.getElementById('rfqLines');
    const form = document.getElementById('rfqForm');

    const productOptions = (selected) => `<option value="">Select a catalogue item…</option>` +
      catalog.categories.map(c => `<optgroup label="${NV.esc(c.name)}">` +
        catalog.products.filter(p => p.cat === c.id).map(p =>
          `<option value="${p.id}" ${selected === p.id ? 'selected' : ''}>${NV.esc(p.name)}</option>`).join('') +
        `</optgroup>`).join('') +
      `<option value="custom">Other — describe below</option>`;

    function addLine(selected, qty) {
      const row = document.createElement('div');
      row.className = 'rfq-row';
      row.innerHTML = `
        <select class="select" data-item>${productOptions(selected)}</select>
        <input class="input" type="number" min="1" value="${qty || 1}" data-qty aria-label="Quantity">
        <span class="rfq-unit" data-unit>—</span>
        <span class="rfq-total" data-total>—</span>
        <button type="button" class="rfq-del" aria-label="Remove line">${NV.icon('close')}</button>`;
      linesHost.appendChild(row);

      const select = row.querySelector('[data-item]');
      const qtyInput = row.querySelector('[data-qty]');
      row.querySelector('.rfq-del').onclick = () => { row.remove(); recalc(); };

      const paint = () => {
        const p = catalog.products.find(x => x.id === select.value);
        if (!p) { row.querySelector('[data-unit]').textContent = select.value === 'custom' ? '—' : '—'; row.querySelector('[data-total]').textContent = '—'; recalc(); return; }
        const q = Math.max(1, parseInt(qtyInput.value, 10) || 1);
        const price = NV.tierPrice(p, q);
        row.querySelector('[data-unit]').textContent = p.unit;
        row.querySelector('[data-total]').textContent = NV.money(price * q);
        recalc();
      };
      select.onchange = paint;
      qtyInput.oninput = paint;
      paint();
      return row;
    }

    function recalc() {
      const picks = [...linesHost.querySelectorAll('[data-item]')]
        .map(sel => {
          const p = catalog.products.find(x => x.id === sel.value);
          if (!p) return null;
          const q = Math.max(1, parseInt(sel.closest('.rfq-row').querySelector('[data-qty]').value, 10) || 1);
          const unitPrice = NV.tierPrice(p, q);
          return { product: p, qty: q, unitPrice, listPrice: p.tiers[0][1], lineTotal: unitPrice * q };
        }).filter(Boolean);
      const t = NV.quote(picks);
      document.getElementById('sumLines').textContent = picks.length;
      document.getElementById('sumSubtotal').textContent = NV.money(t.subtotal);
      document.getElementById('sumSavings').textContent = NV.money(t.savings);
      document.getElementById('sumTotal').textContent = NV.money(t.subtotal);
    }

    /* seed lines: ?item=id, else basket, else one blank row */
    const preItem = NV.queryString().get('item');
    if (preItem && catalog.products.some(p => p.id === preItem)) addLine(preItem, catalog.products.find(p => p.id === preItem).moq);
    else {
      const basketRows = NV.basket.raw();
      if (basketRows.length) basketRows.slice(0, 8).forEach(r => addLine(r.id, r.qty));
      else addLine();
    }
    document.getElementById('addLine').onclick = () => addLine();

    /* prefill contact */
    const saved = NV.customer.get();
    if (saved.name) form.name.value = saved.name;
    if (saved.organisation) form.organisation.value = saved.organisation;
    if (saved.email) form.email.value = saved.email;
    if (saved.phone) form.phone.value = saved.phone;
    if (saved.address) form.deliveryLocation.value = saved.address;

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
      const hasLine = [...linesHost.querySelectorAll('[data-item]')].some(s => s.value && s.value !== 'custom');
      if (!hasLine) { NV.toast('Add at least one catalogue line to be priced.', { title: 'No items', type: 'error' }); ok = false; }
      return ok;
    };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validate()) return;
      const btn = document.getElementById('rfqSubmit');
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Submitting…';
      btn.classList.add('is-disabled');

      const data = Object.fromEntries(new FormData(form).entries());
      const items = [...linesHost.querySelectorAll('.rfq-row')].map(row => {
        const p = catalog.products.find(x => x.id === row.querySelector('[data-item]').value);
        return p ? { id: p.id, name: p.name, qty: parseInt(row.querySelector('[data-qty]').value, 10) || 1, unit: p.unit } : null;
      }).filter(Boolean);

      const message = [
        `RFQ · ${data.route || 'Quotation request'}`,
        `Required by: ${data.requiredBy || 'flexible'}`,
        `Delivery: ${data.deliveryLocation || 'to be confirmed'}`,
        '',
        ...items.map(i => `• ${i.qty} × ${i.name} (${i.unit})`),
        '',
        data.notes ? `Notes: ${data.notes}` : ''
      ].join('\n');

      const payload = {
        type: 'quote', name: data.name, organisation: data.organisation, email: data.email,
        phone: data.phone, subject: data.route || 'Quotation request', message, items
      };

      try {
        const res = await NV.api('/enquiries', { method: 'POST', body: payload });
        NV.customer.save({ name: data.name, organisation: data.organisation, email: data.email, phone: data.phone, address: data.deliveryLocation });
        form.classList.add('hide');
        document.getElementById('rfqSuccess').classList.remove('hide');
        document.getElementById('rfqRef').textContent = res.enquiry.ref;
        NV.toast('Our desk will issue your quotation within one working day.', { title: 'RFQ submitted' });
      } catch (err) {
        if (err.offline) {
          const localRef = NV.ref('RFQ');
          const queue = NV.read('norvex.enquiries.local.v1', []);
          queue.unshift({ ref: localRef, ...payload, createdAt: new Date().toISOString() });
          NV.write('norvex.enquiries.local.v1', queue);
          form.classList.add('hide');
          document.getElementById('rfqSuccess').classList.remove('hide');
          document.getElementById('rfqRef').textContent = localRef;
          NV.toast('Captured locally — the server is offline in this preview.', { title: 'RFQ captured' });
        } else {
          NV.toast(err.message, { title: 'Could not submit', type: 'error' });
        }
      } finally {
        btn.innerHTML = original;
        btn.classList.remove('is-disabled');
      }
    });

    document.getElementById('rfqAgain').onclick = () => {
      document.getElementById('rfqSuccess').classList.add('hide');
      form.classList.remove('hide');
      form.reset();
      linesHost.innerHTML = '';
      addLine();
    };
  });
})();
