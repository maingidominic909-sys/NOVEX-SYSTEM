/* NORVEX v2 — future order planner */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  let cat = null, map = {}, items = [{ id: '', qty: 20 }], sent = false;
  const form = { name: '', organisation: '', email: '', phone: '', deliveryDate: '', deliveryLocation: '', budget: 'KES 100K – 500K', recurrence: 'One-off', notes: '' };

  function optionsHtml(selected) {
    return `<option value="">Choose a catalogue line…</option>` + cat.categories.map(c => {
      const ps = cat.products.filter(p => p.cat === c.id);
      return ps.length ? `<optgroup label="${E(c.name)}">${ps.map(p => `<option value="${E(p.id)}" ${p.id === selected ? 'selected' : ''}>${E(p.name)} — ${E(p.unit)}</option>`).join('')}</optgroup>` : '';
    }).join('');
  }
  const currentItems = () => items.filter(l => l.id && map[l.id]).map(l => {
    const p = map[l.id]; const qty = Math.max(1, parseInt(l.qty, 10) || 1);
    return { id: p.id, name: p.name, unit: p.unit, qty, est: NV.tierPrice(p, qty) * qty };
  });

  function renderItems() {
    const mount = document.getElementById('planItems');
    mount.innerHTML = items.map((l, i) => `
      <div class="qline" data-i="${i}">
        <div class="field">${i === 0 ? '<span class="lbl">Planned item</span>' : ''}
          <select class="select" data-item-id>${optionsHtml(l.id)}</select>
        </div>
        <div class="field">${i === 0 ? '<span class="lbl">Qty / cycle</span>' : ''}
          <input class="input" type="number" min="1" value="${Math.max(1, parseInt(l.qty, 10) || 1)}" data-item-qty aria-label="Quantity per cycle">
        </div>
        <button class="q-remove" data-item-remove aria-label="Remove item" ${items.length === 1 ? 'disabled style="opacity:.35"' : ''}>${NV.icon('trash')}</button>
      </div>`).join('');
    mount.querySelectorAll('.qline').forEach(row => {
      const i = parseInt(row.dataset.i, 10);
      row.querySelector('[data-item-id]').addEventListener('change', e => { items[i].id = e.target.value; renderSummary(); });
      row.querySelector('[data-item-qty]').addEventListener('input', e => { items[i].qty = e.target.value; renderSummary(); });
      row.querySelector('[data-item-remove]').addEventListener('click', () => { if (items.length > 1) { items.splice(i, 1); renderItems(); renderSummary(); } });
    });
  }

  function renderSummary() {
    const ls = currentItems();
    const est = ls.reduce((s, l) => s + l.est, 0);
    document.getElementById('planEstimate').innerHTML = `
      <div class="kpi" style="margin-bottom:14px"><div class="kpi-top"><span class="kpi-label">Estimated value / cycle</span><span class="kpi-ico gold">${NV.icon('chart')}</span></div>
      <div class="kpi-value">${NV.compact(est)}</div><div class="kpi-sub">${ls.length} planned ${ls.length === 1 ? 'line' : 'lines'} · excl. VAT &amp; delivery</div></div>
      <button class="btn btn-gold btn-block btn-lg" id="sendPlan">${NV.icon('calendar')} Reserve this plan</button>
      <p class="hint center mt-1">No payment now — we confirm stock and price before each cycle.</p>`;
    document.getElementById('sendPlan').addEventListener('click', submit);
  }

  function validate() {
    let ok = true;
    [['name', v => v.trim().length > 1], ['organisation', v => v.trim().length > 1],
     ['email', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())],
     ['deliveryDate', v => !!v], ['deliveryLocation', v => v.trim().length > 2]].forEach(([k, test]) => {
      const input = document.querySelector(`#planForm [name="${k}"]`);
      if (!input) return;
      const good = test(String(form[k] || ''));
      input.closest('.field').classList.toggle('bad', !good);
      if (!good) ok = false;
    });
    if (!currentItems().length) { NV.toast('Add at least one planned item.', { type: 'error', title: 'No items' }); ok = false; }
    else if (!ok) NV.toast('Complete the highlighted fields.', { type: 'error', title: 'Almost there' });
    return ok;
  }

  async function submit() {
    if (sent || !validate()) return;
    const btn = document.getElementById('sendPlan');
    btn.disabled = true; btn.innerHTML = 'Reserving…';
    const payload = {
      contact: { name: form.name, organisation: form.organisation, email: form.email, phone: form.phone },
      items: currentItems().map(l => ({ id: l.id, qty: l.qty })),
      deliveryDate: form.deliveryDate, deliveryLocation: form.deliveryLocation,
      budget: form.budget, recurrence: form.recurrence, notes: form.notes
    };
    let rec;
    try { const res = await NV.api('/future-orders', { method: 'POST', body: payload }); rec = res.futureOrder; }
    catch (err) {
      if (err.offline) {
        rec = { ...payload, ref: NV.ref('FO'), createdAt: new Date().toISOString(), status: 'planning' };
        const rows = NV.read('norvex.plans.local.v1', []); rows.unshift(rec); NV.write('norvex.plans.local.v1', rows);
      } else { NV.toast(err.message, { type: 'error', title: 'Not saved' }); btn.disabled = false; renderSummary(); return; }
    }
    sent = true;
    NV.toast(`Plan ${rec.ref} reserved — we'll confirm before the first cycle.`, { title: 'Plan saved' });
    document.getElementById('planDone').classList.remove('hide');
    document.getElementById('planDone').innerHTML = `
      <div class="auth-guard" style="background:var(--green-50);border-color:var(--green-100)">
        <div class="auth-guard-body">
          <p class="eyebrow">Plan reserved</p>
          <h2>${E(rec.ref)} · ${E(form.recurrence)}</h2>
          <p>First delivery ${NV.dateFmt(form.deliveryDate)} to ${E(form.deliveryLocation)}. Our desk will confirm stock and pricing before each cycle.</p>
        </div>
        <div class="auth-guard-actions"><a class="btn btn-primary" href="/desk.html">Back to order desk</a></div>
      </div>`;
    loadPlans();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    btn.disabled = false; btn.innerHTML = `${NV.icon('calendar')} Reserve another plan`;
    sent = false;
  }

  async function loadPlans() {
    const mount = document.getElementById('planList');
    const local = NV.read('norvex.plans.local.v1', []);
    let remote = [];
    try { const res = await NV.api('/future-orders'); remote = res.futureOrders || []; } catch {}
    const email = (NV.auth && NV.auth.current() ? NV.auth.current().email : NV.customer.get().email || '').toLowerCase();
    const seen = new Set();
    let rows = [...local, ...remote].filter(r => r && r.ref && (seen.has(r.ref) ? false : (seen.add(r.ref), true)));
    if (email) rows = rows.filter(r => !r.contact || !r.contact.email || r.contact.email === email);
    rows = rows.slice(0, 8);
    const card = document.getElementById('plansCard');
    if (!rows.length) { card.classList.add('hide'); return; }
    card.classList.remove('hide');
    mount.innerHTML = rows.map(r => `
      <div class="plan-item">
        <div class="spread">
          <b class="serif">${E(r.ref)}</b> ${NV.ui.statusBadge(r.status || 'planning')}
          <div class="small muted mt-1">${(r.items || []).length} lines · ${E(r.recurrence || 'One-off')} · first delivery ${NV.dateFmt(r.deliveryDate)}</div>
          <div class="tiny muted">${E((r.items || []).slice(0, 3).map(i => `${i.qty} × ${i.name || i.id}`).join(', '))}${(r.items || []).length > 3 ? '…' : ''}</div>
        </div>
        <span class="badge gray">${E(r.budget || 'Budget TBC')}</span>
      </div>`).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    cat = await NV.catalog();
    map = await NV.productMap();
    const saved = NV.customer.get();
    const user = NV.auth && NV.auth.current();
    Object.keys(form).forEach(k => { if (saved[k]) form[k] = saved[k]; });
    if (user) { form.name = user.name; form.organisation = user.organisation; form.email = user.email; form.phone = user.phone; }
    document.querySelectorAll('#planForm [name]').forEach(input => {
      if (form[input.name]) input.value = form[input.name];
      input.addEventListener('input', () => { form[input.name] = input.value; input.closest('.field').classList.remove('bad'); });
      input.addEventListener('change', () => { form[input.name] = input.value; });
    });
    const dateInput = document.querySelector('#planForm [name="deliveryDate"]');
    dateInput.min = new Date().toISOString().slice(0, 10);
    renderItems();
    renderSummary();
    document.getElementById('addItem').addEventListener('click', () => { items.push({ id: '', qty: 20 }); renderItems(); renderSummary(); });
    loadPlans();
  });
})();
