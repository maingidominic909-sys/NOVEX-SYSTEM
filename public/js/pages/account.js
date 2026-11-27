/* NORVEX v2 — account: modern vertical profile + settings layout + avatar picker */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  const AVATARS = ['🦁','🐘','🦒','🐆','🦅','🌿','🌍','⭐','🔥','💼','📦','🚚','🚛','🏢','🏬','🎯','🌱','🌾','⚡','🛡'];

  function guard() {
    document.getElementById('accountRoot').innerHTML = `
      <div class="auth-guard">
        <div class="auth-guard-body">
          <p class="eyebrow">Trade account</p>
          <h2>Sign in to manage your organisation</h2>
          <p>Profile details, security and favourites live inside your trade account. It takes under a minute to create one.</p>
        </div>
        <div class="auth-guard-actions">
          <a class="btn btn-gold" href="/auth.html?mode=signin" onclick="NV.auth.rememberReturn('/account.html')">Sign in</a>
          <a class="btn btn-ghost" href="/auth.html?mode=signup">Create account</a>
        </div>
      </div>`;
  }

  async function render() {
    const user = NV.auth.current();
    if (!user) return guard();
    const root = document.getElementById('accountRoot');
    const isAdmin = user.role === 'admin';

    let orders = [];
    const local = NV.read('norvex.orders.local.v1', []).filter(o => o.customer && o.customer.email === user.email);
    try { const res = await NV.api('/orders?email=' + encodeURIComponent(user.email)); orders = res.orders || []; } catch {}
    const seen = new Set();
    orders = [...local, ...orders].filter(o => seen.has(o.ref) ? false : (seen.add(o.ref), true));
    const spend = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totals ? o.totals.total : 0), 0);

    const favIds = NV.favourites.all();
    const map = await NV.productMap();
    const favs = favIds.map(id => map[id]).filter(Boolean);
    const payMethod = NV.read('norvex.paymethod.v1', 'M-Pesa');

    root.innerHTML = `
      <div class="account-stack">
        <div class="card acct-profile">
          <span class="auth-avatar" id="heroAvatar">${E(user.avatar)}</span>
          <h1>${E(user.name)}</h1>
          <div class="ph-org">${E(user.organisation || 'Add your organisation')} · ${E(user.email)}</div>
          <div class="acct-badges"><span class="badge ${isAdmin ? 'gold' : 'green'}">${isAdmin ? 'Administrator' : 'Trade account'}</span><span class="tiny muted">Member since ${NV.dateFmt(user.createdAt)}</span></div>
          <div class="acct-actions">
            <button class="btn btn-soft btn-block" id="changeAvatar">${NV.icon('user')} Change avatar</button>
            ${isAdmin ? `<a class="btn btn-soft btn-block" href="/admin.html">${NV.icon('chart')} Operations console</a>` : ''}
            <button class="btn btn-ghost btn-block" id="signOutBtn">${NV.icon('logout')} Sign out</button>
          </div>
        </div>

        <div class="card" id="avatarCard" style="display:none">
          <div class="card-head"><h3>Choose your avatar</h3><button class="btn btn-ghost btn-sm" id="closeAvatar">Done</button></div>
          <div class="card-body"><div class="avatar-picker">${AVATARS.map(a => `<button class="av-opt ${a === user.avatar ? 'on' : ''}" type="button" data-av="${a}" aria-label="Choose avatar">${a}</button>`).join('')}</div></div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Overview</h3></div>
          <div class="card-body acct-stats">
            <a class="acct-stat-row" href="/orders.html"><span class="as-ico">${NV.icon('receipt')}</span><span class="as-label">Orders</span><b class="as-val">${orders.length}</b><span class="as-arrow">${NV.icon('arrowR')}</span></a>
            <div class="acct-stat-row"><span class="as-ico gold">${NV.icon('wallet')}</span><span class="as-label">Lifetime spend</span><b class="as-val">${NV.compact(spend)}</b></div>
            ${isAdmin ? '' : `<div class="acct-stat-row"><span class="as-ico">${NV.icon('heart')}</span><span class="as-label">Favourites</span><b class="as-val">${favs.length}</b></div>`}
            ${isAdmin ? '' : `<a class="acct-stat-row" href="/basket.html"><span class="as-ico gold">${NV.icon('cart')}</span><span class="as-label">Basket</span><b class="as-val" data-cart-count>${NV.basket.count()}</b><span class="as-arrow">${NV.icon('arrowR')}</span></a>`}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Organisation details</h3></div>
          <div class="card-body">
            <form id="profileForm" class="col" style="gap:14px" novalidate>
              <div class="field"><label>Full name</label><input class="input" name="name" value="${E(user.name)}"><span class="err-msg">Required.</span></div>
              <div class="field"><label>Organisation</label><input class="input" name="organisation" value="${E(user.organisation)}"><span class="err-msg">Required.</span></div>
              <div class="field"><label>Email</label><input class="input" name="email" type="email" value="${E(user.email)}"><span class="err-msg">Enter a valid email.</span></div>
              <div class="field"><label>Phone</label><input class="input" name="phone" type="tel" value="${E(user.phone)}"><span class="err-msg">Kenyan mobile, e.g. 0712 345 678.</span></div>
              <button class="btn btn-primary btn-block" type="submit">${NV.icon('check')} Save changes</button>
            </form>
          </div>
        </div>

        <div class="card" id="payCard">
          <div class="card-head"><h3>Payment</h3></div>
          <div class="card-body acct-pay">
            <span class="pm-ico mpesa">${NV.icon('phone')}</span>
            <div class="ap-text"><b>Default method · ${E(payMethod)}</b><small>M-Pesa, card, bank transfer or invoice/LPO — choose at checkout or on the payments page.</small></div>
            <a class="btn btn-soft btn-block" href="/payment.html">${NV.icon('wallet')} Open payments</a>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Security</h3></div>
          <div class="card-body">
            <form id="pwForm" class="col" style="gap:14px" novalidate>
              <div class="field"><label>Current password</label><input class="input" name="old" type="password" autocomplete="current-password"><span class="err-msg">Required.</span></div>
              <div class="field"><label>New password</label><input class="input" name="next" type="password" autocomplete="new-password"><span class="err-msg">8+ characters with a number.</span></div>
              <button class="btn btn-ghost btn-block" type="submit">${NV.icon('lock')} Change password</button>
            </form>
          </div>
        </div>

        <div class="card" id="favCard">
          <div class="card-head"><h3>Favourites</h3><a class="btn btn-ghost btn-sm" href="/shop.html">Browse more</a></div>
          <div class="card-body">
            ${favs.length ? `<div class="acct-favs">${favs.slice(0, 6).map(p => `
              <div class="acct-fav">
                ${p.img ? `<img src="${E(p.img)}" alt="">` : `<span class="acct-fav-art">${NV.icon(NV.catIcon(p.cat))}</span>`}
                <b><a href="/product.html?id=${E(p.id)}">${E(p.name)}</a></b>
                <small>${E(p.unit)} · ${NV.money(p.tiers[0][1])}</small>
                <button class="btn btn-soft btn-sm btn-block" data-add="${E(p.id)}">${NV.icon('cart')} Add to basket</button>
              </div>`).join('')}</div>`
            : '<p class="muted small" style="padding:10px 0">Tap the heart on any catalogue line to keep it here for quick re-ordering.</p>'}
          </div>
        </div>

        <div class="card" style="border-color:#f0d4d1">
          <div class="card-head" style="border-color:#f0d4d1"><h3 class="red">Danger zone</h3></div>
          <div class="card-body">
            <p class="small muted mb-2">Remove this account and its session from this device. Order records held by Norvex are not affected.</p>
            <button class="btn btn-danger btn-block" id="deleteAccount">${NV.icon('trash')} Delete my account</button>
          </div>
        </div>
      </div>`;

    if (isAdmin) {
      const pc = document.getElementById('payCard'); if (pc) pc.remove();
      const fc = document.getElementById('favCard'); if (fc) fc.remove();
    }

    const avatarCard = document.getElementById('avatarCard');
    document.getElementById('changeAvatar').addEventListener('click', () => {
      avatarCard.style.display = avatarCard.style.display === 'none' ? '' : 'none';
      if (avatarCard.style.display !== 'none') avatarCard.scrollIntoView({ block: 'nearest' });
    });
    document.getElementById('closeAvatar').addEventListener('click', () => { avatarCard.style.display = 'none'; });
    document.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => {
      const res = NV.auth.update({ avatar: b.dataset.av });
      if (res.ok) NV.toast('Avatar updated.', { title: 'Saved' });
    }));

    document.getElementById('signOutBtn').addEventListener('click', () => {
      NV.auth.signOut({ redirect: false });
      NV.toast('You are signed out. Your basket is still saved.', { title: 'Signed out' });
    });
    document.getElementById('profileForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const F = n => f.querySelector(`[name="${n}"]`);
      const patch = { name: F('name').value, organisation: F('organisation').value, email: F('email').value, phone: F('phone').value };
      const res = NV.auth.update(patch);
      f.querySelectorAll('.field').forEach(el => el.classList.remove('bad'));
      if (!res.ok) {
        Object.keys(res.errors || {}).forEach(k => { const el = f.querySelector(`[name="${k}"]`); if (el) el.closest('.field').classList.add('bad'); });
        NV.toast('Check the highlighted fields.', { type: 'error', title: 'Not saved' });
      } else NV.toast('Organisation details updated.', { title: 'Saved' });
    });
    document.getElementById('pwForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      f.querySelectorAll('.field').forEach(el => el.classList.remove('bad'));
      const old = f.querySelector('[name="old"]'), next = f.querySelector('[name="next"]');
      if (!old.value) { old.closest('.field').classList.add('bad'); return; }
      if (String(next.value).length < 8 || !/\d/.test(next.value)) { next.closest('.field').classList.add('bad'); return; }
      const res = await NV.auth.changePassword(old.value, next.value);
      if (!res.ok) { old.closest('.field').classList.add('bad'); NV.toast(res.error, { type: 'error', title: 'Not changed' }); }
      else { f.reset(); NV.toast('Password changed.', { title: 'Security' }); }
    });
    document.getElementById('deleteAccount').addEventListener('click', () => {
      if (!confirm('Delete this account from this device? This cannot be undone.')) return;
      NV.auth.removeAccount();
      NV.toast('Account removed from this device.', { title: 'Deleted' });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    NV.auth.onChange(render);
  });
})();
