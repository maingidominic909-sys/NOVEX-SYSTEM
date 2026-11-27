/* NORVEX v2 — quotation desk (RFQ builder) */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  let cat = null, map = {}, lines = [{ id: '', qty: 10 }], sent = false;

  const contact = { name: '', organisation: '', email: '', phone: '', notes: '' };

  function optionsHtml(selected) {
    return `<option value="">Choose a catalogue line…</option>` + cat.categories.map(c => {
      const items = cat.products.filter(p => p.cat === c.id);
      if (!items.length) return '';
      return `<optgroup label="${E(c.name)}">${items.map(p => `<option value="${E(p.id)}" ${p.id === selected ? 'selected' : ''}>${E(p.name)} — ${E(p.unit)}</option>`).join('')}</optgroup>`;
    }).join('');
  }

  function currentLines() {
    return lines.filter(l => l.id && map[l.id]).map(l => {
      const p = map[l.id];
      const qty = Math.max(1, parseInt(l.qty, 10) || 1);
      const unitPrice = NV.tierPrice(p, qty);
      return { id: p.id, name: p.name, unit: p.unit, cat: p.cat, qty, unitPrice, listPrice: p.tiers[0][1], lineTotal: unitPrice * qty };
    });
  }

  function renderLines() {
    const mount = document.getElementById('quoteLines');
    mount.innerHTML = lines.map((l, i) => {
      const p = map[l.id];
      const qty = Math.max(1, parseInt(l.qty, 10) || 1);
      return `
      <div class="qline" data-i="${i}">
        <div class="field">
          ${i === 0 ? '<span class="lbl">Catalogue line</span>' : ''}
          <select class="select" data-line-id>${optionsHtml(l.id)}</select>
          ${p ? `<span class="q-price">${NV.money(NV.tierPrice(p, qty))} / ${E(p.unit)} at qty ${qty}${p.tiers.length > 1 ? ' · tier pricing applies' : ''}</span>` : ''}
        </div>
        <div class="field">
          ${i === 0 ? '<span class="lbl">Quantity</span>' : ''}
          <input class="input" type="number" min="1" value="${qty}" data-line-qty aria-label="Quantity">
        </div>
        <button class="q-remove" data-line-remove aria-label="Remove line" ${lines.length === 1 ? 'disabled style="opacity:.35"' : ''}>${NV.icon('trash')}</button>
      </div>`;
    }).join('');
    mount.querySelectorAll('.qline').forEach(row => {
      const i = parseInt(row.dataset.i, 10);
      row.querySelector('[data-line-id]').addEventListener('change', e => { lines[i].id = e.target.value; renderLines(); renderSummary(); });
      row.querySelector('[data-line-qty]').addEventListener('input', e => { lines[i].qty = e.target.value; renderSummary(); });
      row.querySelector('[data-line-qty]').addEventListener('change', () => renderLines());
      const rm = row.querySelector('[data-line-remove]');
      rm.addEventListener('click', () => { if (lines.length > 1) { lines.splice(i, 1); renderLines(); renderSummary(); } });
    });
  }

  function renderSummary() {
    const ls = currentLines();
    const t = NV.quote(ls);
    document.getElementById('quoteSummary').innerHTML = `
      <div class="card card-pad summary-card">
        <h3 class="serif" style="font-size:1.15rem;margin-bottom:12px">Indicative estimate</h3>
        ${ls.length ? `
          <div class="col" style="gap:8px;margin-bottom:12px">
            ${ls.map(l => `<div class="sum-row"><span class="clamp-2" style="max-width:190px">${E(l.name)} <span class="muted">× ${l.qty}</span></span><span>${NV.money(l.lineTotal)}</span></div>`).join('')}
          </div>
          <div class="sum-rows">
            <div class="sum-row"><span>Subtotal</span><span>${NV.money(t.subtotal)}</span></div>
            ${t.savings ? `<div class="sum-row save"><span>Tier savings</span><span>− ${NV.money(t.savings)}</span></div>` : ''}
            <div class="sum-row"><span>Delivery est.</span><span>${t.delivery === 0 ? 'FREE' : NV.money(t.delivery)}</span></div>
            <div class="sum-row"><span>VAT 16%</span><span>${NV.money(t.vat)}</span></div>
          </div>
          <div class="sum-total"><span class="bold">Estimate</span><b>${NV.money(t.total)}</b></div>`
        : '<p class="muted small">Pick catalogue lines to see an indicative estimate.</p>'}
        <p class="hint">Final quotation is confirmed by our desk — contract volumes often price better than the calculator.</p>
        <button class="btn btn-gold btn-block btn-lg" id="sendQuote">${NV.icon('send')} Request formal quotation</button>
        <p class="hint center mt-1">Response within one business day.</p>
      </div>`;
    document.getElementById('sendQuote').addEventListener('click', submit);
  }

  function validate() {
    let ok = true;
    [['name', v => v.trim().length > 1], ['organisation', v => v.trim().length > 1],
     ['email', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())], ['phone', v => v.replace(/\D/g, '').length >= 9]].forEach(([k, test]) => {
      const input = document.querySelector(`#quoteContact [name="${k}"]`);
      const good = test(String(contact[k] || ''));
      input.closest('.field').classList.toggle('bad', !good);
      if (!good) ok = false;
    });
    if (!currentLines().length) { NV.toast('Add at least one catalogue line to the request.', { type: 'error', title: 'No lines' }); ok = false; }
    else if (!ok) NV.toast('Complete the highlighted contact fields.', { type: 'error', title: 'Almost there' });
    return ok;
  }

  async function submit() {
    if (sent || !validate()) return;
    const btn = document.getElementById('sendQuote');
    btn.disabled = true; btn.innerHTML = 'Sending…';
    const ls = currentLines();
    const t = NV.quote(ls);
    const payload = {
      type: 'quote', name: contact.name, organisation: contact.organisation, email: contact.email, phone: contact.phone,
      subject: 'Quotation request — ' + ls.length + ' lines',
      message: (contact.notes ? contact.notes + '\n\n' : '') + ls.map(l => `${l.qty} × ${l.name} (${l.unit}) @ ${NV.money(l.unitPrice)} = ${NV.money(l.lineTotal)}`).join('\n') + `\nIndicative total: ${NV.money(t.total)}`,
      items: ls.map(l => ({ id: l.id, name: l.name, unit: l.unit, qty: l.qty }))
    };
    let refNo;
    try { const res = await NV.api('/enquiries', { method: 'POST', body: payload }); refNo = res.enquiry.ref; }
    catch (err) {
      if (err.offline) {
        refNo = NV.ref('ENQ');
        const rows = NV.read('norvex.enquiries.local.v1', []);
        rows.unshift({ ...payload, ref: refNo, createdAt: new Date().toISOString(), status: 'new' });
        NV.write('norvex.enquiries.local.v1', rows);
      } else { NV.toast(err.message, { type: 'error', title: 'Not sent' }); btn.disabled = false; btn.innerHTML = `${NV.icon('send')} Request formal quotation`; return; }
    }
    sent = true;
    document.getElementById('quoteMain').innerHTML = `
      <div class="success-hero">
        <span class="ok">${NV.icon('check')}</span>
        <p class="eyebrow centered">Quotation requested</p>
        <h1>We're pricing your ${ls.length}-line request.</h1>
        <p class="lede" style="margin:0 auto">Our desk replies to ${E(contact.email)} within one business day with a formal quotation.</p>
        <div class="ref-chip">${E(refNo)}</div>
        <div class="row wrap" style="justify-content:center;margin-top:18px">
          <a class="btn btn-gold" href="/shop.html">Keep browsing</a>
          <a class="btn btn-ghost" href="https://wa.me/${NV.CONFIG.whatsapp}?text=${encodeURIComponent('Hello Norvex, following up on quotation ' + refNo)}" target="_blank" rel="noopener">${NV.icon('whatsapp')} Follow up on WhatsApp</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0 });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const u = NV.auth && NV.auth.current();
    if (u && u.role === 'admin') {
      document.getElementById('quoteMain').innerHTML = `<div class="auth-guard"><div class="auth-guard-body"><p class="eyebrow">Admin mode</p><h2>Quotations are a customer feature</h2><p>Admins review and respond to incoming enquiries from the operations console rather than requesting quotes. Buying is disabled for administrator accounts.</p></div><div class="auth-guard-actions"><a class="btn btn-gold" href="/admin.html">${NV.icon('chart')} Open operations console</a><a class="btn btn-ghost" href="/index.html">Back to storefront</a></div></div>`;
      return;
    }
    cat = await NV.catalog();
    map = await NV.productMap();
    const saved = NV.customer.get();
    const user = NV.auth && NV.auth.current();
    Object.keys(contact).forEach(k => { if (saved[k]) contact[k] = saved[k]; });
    if (user) { contact.name = user.name; contact.organisation = user.organisation; contact.email = user.email; contact.phone = user.phone; }
    document.querySelectorAll('#quoteContact [name]').forEach(input => {
      input.value = contact[input.name] || '';
      input.addEventListener('input', () => { contact[input.name] = input.value; input.closest('.field').classList.remove('bad'); });
    });
    /* preselect from ?id= */
    const pre = NV.queryString().get('id');
    if (pre && map[pre]) lines = [{ id: pre, qty: map[pre].moq || 10 }];
    renderLines();
    renderSummary();
    document.getElementById('addLine').addEventListener('click', () => { lines.push({ id: '', qty: 10 }); renderLines(); renderSummary(); });
  });
})();
