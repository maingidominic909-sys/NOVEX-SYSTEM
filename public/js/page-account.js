/* Console — organisation profile */
(function () {
  const NV = window.NV;
  let catalog = null;

  document.addEventListener('DOMContentLoaded', async () => {
    if (NV.auth && !NV.auth.isIn()) NV.auth.pageGuard({ title: 'Sign in to manage your organisation', body: 'Addresses, contacts and saved lines are tied to your trade account — sign in to load them.' });

    catalog = await NV.catalog();
    document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = NV.icon(el.dataset.icon));

    /* tabs */
    document.querySelectorAll('#acctTabs button').forEach(btn => btn.onclick = () => {
      document.querySelectorAll('#acctTabs button').forEach(b => b.classList.toggle('on', b === btn));
      document.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('hide', p.dataset.panel !== btn.dataset.tab));
    });

    const saved = NV.customer.get();
    const profileForm = document.getElementById('profileForm');
    const addressForm = document.getElementById('addressForm');

    ['organisation', 'website', 'name', 'title', 'email', 'phone', 'industry', 'payment'].forEach(k => {
      if (saved[k] != null && profileForm[k]) profileForm[k].value = saved[k];
    });
    ['address', 'town', 'county', 'receiving', 'instructions'].forEach(k => {
      if (saved[k] != null && addressForm[k]) addressForm[k].value = saved[k];
    });

    profileForm.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(profileForm).entries());
      NV.customer.save(data);
      document.getElementById('savedAt').textContent = 'Saved just now';
      paintAside();
      NV.toast('Profile saved — it will prefill checkout and quotations.', { title: 'Saved' });
    });

    addressForm.addEventListener('submit', e => {
      e.preventDefault();
      NV.customer.save(Object.fromEntries(new FormData(addressForm).entries()));
      NV.toast('Delivery details saved.', { title: 'Saved' });
    });

    /* preferences */
    const prefs = NV.read('norvex.prefs', { alerts: true, compact: false, quoteAll: false });
    document.getElementById('prefAlerts').checked = prefs.alerts;
    document.getElementById('prefCompact').checked = prefs.compact;
    document.getElementById('prefQuoteAll').checked = prefs.quoteAll;
    const savePrefs = () => NV.write('norvex.prefs', {
      alerts: document.getElementById('prefAlerts').checked,
      compact: document.getElementById('prefCompact').checked,
      quoteAll: document.getElementById('prefQuoteAll').checked
    });
    ['prefAlerts', 'prefCompact', 'prefQuoteAll'].forEach(id => document.getElementById(id).onchange = () => { savePrefs(); NV.toast('Preference updated', { title: 'Saved' }); });

    /* saved lines */
    const favs = NV.favourites.all();
    const body = document.getElementById('savedBody');
    const empty = document.getElementById('savedEmpty');
    document.getElementById('savedCount').textContent = `${favs.length} item${favs.length === 1 ? '' : 's'}`;
    if (!favs.length) { body.innerHTML = ''; empty.classList.remove('hide'); }
    else {
      body.innerHTML = favs.map(id => {
        const p = catalog.products.find(x => x.id === id);
        if (!p) return '';
        return `<tr>
          <td class="cell-main">${NV.esc(p.name)}<div class="cell-sub">${NV.esc(p.unit)} · MOQ ${p.moq}</div></td>
          <td class="num">${NV.money(p.from)}</td>
          <td class="actions">
            <button class="btn btn-sm" data-addfav="${p.id}">Add to basket</button>
            <button class="btn btn-ghost btn-sm" data-unfav="${p.id}">Remove</button>
          </td></tr>`;
      }).join('');
      body.querySelectorAll('[data-addfav]').forEach(b => b.onclick = () => { NV.basket.add(b.dataset.addfav, 1); NV.toast('Added to basket', { title: 'Done' }); });
      body.querySelectorAll('[data-unfav]').forEach(b => b.onclick = () => { NV.favourites.toggle(b.dataset.unfav); location.reload(); });
    }

    /* device data */
    document.getElementById('clearBasketData').onclick = () => { NV.basket.clear(); NV.toast('Basket cleared', { title: 'Done' }); };
    document.getElementById('clearSaved').onclick = () => { NV.write(NV.CONFIG.favKey, []); NV.toast('Saved lines cleared', { title: 'Done' }); setTimeout(() => location.reload(), 500); };
    document.getElementById('clearAll').onclick = () => {
      if (!confirm('Reset all locally stored Norvex data (basket, saved lines, profile)?')) return;
      [NV.CONFIG.basketKey, NV.CONFIG.favKey, NV.CONFIG.customerKey, NV.CONFIG.ordersKey].forEach(k => localStorage.removeItem(k));
      NV.toast('Device data reset', { title: 'Done' });
      setTimeout(() => location.reload(), 600);
    };

    paintAside();
    await paintAccountStats();
  });

  function paintAside() {
    const s = NV.customer.get();
    document.getElementById('acctOrg').textContent = s.organisation || 'Your organisation';
    document.getElementById('acctName').textContent = s.name || 'Add your details';
    document.getElementById('acctTerms').textContent = s.payment || 'Invoice request';
    document.getElementById('acctAvatar').textContent = (s.organisation || 'NV').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  async function paintAccountStats() {
    const local = NV.read('norvex.orders.local.v1', []);
    let remote = [];
    try {
      const s = NV.customer.get();
      const qs = new URLSearchParams();
      if (s.email) qs.set('email', s.email);
      remote = (await NV.api('/orders' + (qs.toString() ? '?' + qs : ''))).orders || [];
    } catch {}
    const seen = new Set();
    const orders = [...local, ...remote].filter(o => (seen.has(o.ref) ? false : (seen.add(o.ref), true)));
    document.getElementById('acctOrders').textContent = orders.length;
    document.getElementById('acctValue').textContent = NV.money(orders.reduce((sum, o) => sum + o.totals.total, 0));
  }
})();
