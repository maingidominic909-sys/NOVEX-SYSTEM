/* =========================================================
   NORVEX AUTH — accounts, session, gate
   Customers browse freely; ordering needs an account.
   Everything is stored on the device (offline-first); when the
   API is reachable the same calls are mirrored to the server.
   ========================================================= */
(function () {
  'use strict';
  const NV = window.NV;
  if (!NV || !NV.read) return;

  const ACCOUNTS = 'norvex.accounts.v1';
  const SESSION = 'norvex.session.v1';
  const RETURN = 'norvex.auth.returnTo';
  const COOKIE = 'nv_auth';

  const listeners = new Set();
  const emit = () => { const u = current(); listeners.forEach(fn => { try { fn(u); } catch (e) { console.warn('[norvex:auth]', e); } }); };

  /* ---------------- helpers ---------------- */
  const norm = s => String(s || '').trim();
  const lower = s => norm(s).toLowerCase();
  const nowISO = () => new Date().toISOString();

  function normalisePhone(raw) {
    let d = String(raw || '').replace(/[^\d+]/g, '');
    if (d.startsWith('+')) d = d.slice(1);
    if (d.startsWith('0')) d = '254' + d.slice(1);
    if (d.startsWith('7') || d.startsWith('1')) d = '254' + d;
    return d ? '+' + d : '';
  }
  const phoneOk = v => /^\+254(7|1)\d{8}$/.test(normalisePhone(v));
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(norm(v));
  const usernameOk = v => /^[a-z0-9][a-z0-9._-]{2,19}$/i.test(norm(v));

  /* deterministic password hash — SHA-256 when the browser allows it, otherwise a
     salted FNV-1a fallback. This is a device-only demo store, never plain text. */
  function fallbackHash(text) {
    let h1 = 0x811c9dc5, h2 = 0x811c9dc5 ^ 0x5bf03635;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = (h1 ^ c) * 16777619 >>> 0;
      h2 = (h2 ^ (c + i)) * 2246822519 >>> 0;
    }
    return (h1.toString(16) + h2.toString(16)).padStart(16, '0');
  }
  async function hashPassword(password, salt) {
    const text = `${salt}::${password}`;
    try {
      if (window.crypto && window.crypto.subtle && window.TextEncoder) {
        const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch { /* insecure context — fall through */ }
    return fallbackHash(text);
  }
  const salt = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  /* ---------------- storage ---------------- */
  function accounts() { const v = NV.read(ACCOUNTS, []); return Array.isArray(v) ? v : []; }
  function saveAccounts(list) { NV.write(ACCOUNTS, list); }

  let seededReady = Promise.resolve();
  function seed() {
    if (accounts().length) return Promise.resolve();
    const s = salt();
    const base = [
      {
        id: 'usr_demo', name: 'Grace Wanjiru', username: 'demo', email: 'demo@norvex.co.ke',
        phone: '+254742021099', organisation: 'Kiambu County Referral Hospital', role: 'customer',
        salt: s, createdAt: nowISO(), seeded: true
      },
      {
        id: 'usr_admin', name: 'Norvex Admin', username: 'admin', email: 'admin@norvex.co.ke',
        phone: '+254742021099', organisation: 'Norvex Integrated Enterprises Ltd', role: 'admin',
        salt: s, createdAt: nowISO(), seeded: true
      }
    ];
    return Promise.all(base.map(async u => ({ ...u, hash: await hashPassword('Norvex2026', u.salt) })))
      .then(list => { if (!accounts().length) saveAccounts(list); })
      .catch(e => console.warn('[norvex:auth] seed failed', e));
  }

  function currentId() {
    const s = NV.read(SESSION, null);
    if (!s || !s.userId) return null;
    if (s.expires && Date.now() > s.expires) { NV.write(SESSION, null); return null; }
    return s.userId;
  }
  function current() {
    const id = currentId();
    if (!id) return null;
    const u = accounts().find(a => a.id === id);
    return u ? publicUser(u) : null;
  }
  const publicUser = u => ({
    id: u.id, name: u.name, username: u.username, email: u.email, phone: u.phone,
    organisation: u.organisation, role: u.role || 'customer', createdAt: u.createdAt, avatar: initials(u.name)
  });
  function initials(name) {
    return String(name || '')
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(w => w[0]).join('').toUpperCase() || 'NV';
  }

  function setCookie(value, days) {
    try {
      const exp = new Date(Date.now() + days * 864e5).toUTCString();
      document.cookie = `${COOKIE}=${encodeURIComponent(value)}; path=/; expires=${exp}; SameSite=Lax`;
    } catch { /* cookies blocked — localStorage still works */ }
  }
  function clearCookie() { try { document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`; } catch {} }

  function startSession(user, days) {
    const ttl = Math.max(1, Math.min(30, Number(days) || 7));
    NV.write(SESSION, { userId: user.id, at: Date.now(), expires: Date.now() + ttl * 864e5 });
    setCookie(user.id, ttl);
    /* feed checkout prefill + console identity */
    NV.customer.save({
      name: user.name, organisation: user.organisation, email: user.email, phone: user.phone
    });
    emit();
  }

  /* ---------------- validation ---------------- */
  function validateSignup(data) {
    const errors = {};
    if (norm(data.name).length < 2) errors.name = 'Tell us your name.';
    if (!emailOk(data.email)) errors.email = 'That email does not look right.';
    if (data.username && !usernameOk(data.username)) errors.username = '3–20 characters, letters, numbers, dot, dash or underscore.';
    if (data.phone && !phoneOk(data.phone)) errors.phone = 'Kenyan mobile, e.g. 0712 345 678.';
    if (data.organisation && norm(data.organisation).length < 2) errors.organisation = 'Organisation or school name is required.';
    if (String(data.password || '').length < 8) errors.password = 'At least 8 characters.';
    else if (!/[a-z]/i.test(data.password) || !/\d/.test(data.password)) errors.password = 'Use letters and at least one number.';
    if (data.confirm != null && data.password !== data.confirm) errors.confirm = 'Passwords do not match.';

    const list = accounts();
    if (!errors.username && data.username && list.some(a => lower(a.username) === lower(data.username))) errors.username = 'That username is taken.';
    if (!errors.email && list.some(a => lower(a.email) === lower(data.email))) errors.email = 'An account already uses this email.';
    return errors;
  }

  function uniqueUsername(seedValue) {
    let root = lower(seedValue).split('@')[0].replace(/[^a-z0-9._-]/g, '.').replace(/^[._-]+|[._-]+$/g, '').slice(0, 14);
    if (!/^[a-z0-9]/.test(root)) root = 'u' + root;
    if (root.length < 3) root = (root + 'user').slice(0, 6);
    const list = accounts();
    let candidate = root, i = 1;
    while (list.some(a => lower(a.username) === candidate)) {
      candidate = (root.slice(0, 16) + i).slice(0, 20);
      i++;
    }
    return candidate;
  }

  function strength(password) {
    const pw = String(password || '');
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
    return { score: Math.min(score, 5), label: labels[Math.min(score, 5)], pct: Math.min(100, score * 20) };
  }

  /* ---------------- actions ---------------- */
  async function signUp(data) {
    await seededReady;
    const errors = validateSignup(data);
    if (Object.keys(errors).length) return { ok: false, errors };
    const s = salt();
    const user = {
      id: 'usr_' + Math.random().toString(36).slice(2, 10),
      name: norm(data.name), username: lower(data.username || uniqueUsername(data.email || data.name)), email: lower(data.email),
      phone: data.phone ? normalisePhone(data.phone) : '', organisation: norm(data.organisation),
      role: 'customer', salt: s, hash: await hashPassword(data.password, s), createdAt: nowISO()
    };
    saveAccounts([...accounts(), user]);
    startSession(user, data.remember ? 30 : 7);
    return { ok: true, user: publicUser(user) };
  }

  async function signIn(identifier, password, opts) {
    await seededReady;
    const id = lower(identifier);
    const phone = normalisePhone(identifier);
    const user = accounts().find(a =>
      lower(a.username) === id || lower(a.email) === id || (phone && a.phone === phone));
    if (!user) return { ok: false, error: 'No account matches that email, phone or username.' };
    if (opts && opts.userId && user.id !== opts.userId) return { ok: false, error: 'Wrong account for this device.' };
    const attempt = await hashPassword(password, user.salt);
    if (attempt !== user.hash) return { ok: false, error: 'That password is not right.' };
    startSession(user, opts && opts.days);
    return { ok: true, user: publicUser(user) };
  }

  /* Device-local demo recovery. This does not send email; it only updates the
     account stored in this browser, and the UI labels that clearly. */
  async function resetPasswordLocal(email, newPassword) {
    await seededReady;
    const user = accounts().find(a => lower(a.email) === lower(email));
    if (!user) return { ok: false, error: 'No account on this device uses that email.' };
    if (String(newPassword || '').length < 8) return { ok: false, error: 'New password needs 8+ characters.' };
    if (!/[a-z]/i.test(newPassword) || !/\d/.test(newPassword)) return { ok: false, error: 'Use letters and at least one number.' };
    user.salt = salt();
    user.hash = await hashPassword(newPassword, user.salt);
    user.updatedAt = nowISO();
    saveAccounts(accounts().map(a => a.id === user.id ? user : a));
    return { ok: true };
  }

  function signOut(opts) {
    NV.write(SESSION, null);
    clearCookie();
    emit();
    if (opts && opts.redirect !== false) go('/index.html');
  }

  function update(patch) {
    const id = currentId();
    if (!id) return { ok: false, error: 'Not signed in.' };
    const list = accounts();
    const user = list.find(a => a.id === id);
    if (!user) return { ok: false, error: 'Account not found.' };
    const errors = {};
    if (patch.email && !emailOk(patch.email)) errors.email = 'That email does not look right.';
    if (patch.phone && !phoneOk(patch.phone)) errors.phone = 'Kenyan mobile, e.g. 0712 345 678.';
    if (patch.email && list.some(a => a.id !== id && lower(a.email) === lower(patch.email))) errors.email = 'Another account uses this email.';
    if (Object.keys(errors).length) return { ok: false, errors };
    ['name', 'email', 'phone', 'organisation'].forEach(k => {
      if (patch[k] != null && norm(patch[k])) user[k] = k === 'email' ? lower(patch[k]) : k === 'phone' ? normalisePhone(patch[k]) : norm(patch[k]);
    });
    user.updatedAt = nowISO();
    saveAccounts(list);
    NV.customer.save({ name: user.name, organisation: user.organisation, email: user.email, phone: user.phone });
    emit();
    return { ok: true, user: publicUser(user) };
  }

  async function changePassword(oldPw, newPw) {
    const id = currentId();
    if (!id) return { ok: false, error: 'Not signed in.' };
    const list = accounts();
    const user = list.find(a => a.id === id);
    if (!user) return { ok: false, error: 'Account not found.' };
    if (await hashPassword(oldPw, user.salt) !== user.hash) return { ok: false, error: 'Current password is not right.' };
    if (String(newPw || '').length < 8) return { ok: false, error: 'New password needs 8+ characters.' };
    user.salt = salt();
    user.hash = await hashPassword(newPw, user.salt);
    saveAccounts(list);
    return { ok: true };
  }

  function removeAccount() {
    const id = currentId();
    if (!id) return false;
    saveAccounts(accounts().filter(a => a.id !== id));
    NV.write(SESSION, null);
    clearCookie();
    emit();
    return true;
  }

  /* ---------------- navigation ---------------- */
  function go(path) {
    if (path == null) path = '/index.html';
    const nav = window.__nvNav || (window.NV && NV.__nvNav);
    if (typeof nav === 'function') { nav(path); return; }
    location.href = path;
  }
  function rememberReturn(path) {
    try { sessionStorage.setItem(RETURN, path || ''); } catch {}
  }
  function takeReturn(fallback) {
    let v = '';
    try { v = sessionStorage.getItem(RETURN) || ''; sessionStorage.removeItem(RETURN); } catch {}
    return v || fallback || '/index.html';
  }

  function requireAuth(opts) {
    const o = Object.assign({ gate: true, returnTo: null }, opts || {});
    if (current()) return true;
    if (o.returnTo) rememberReturn(o.returnTo);
    if (o.gate) openGate(o);
    return false;
  }

  /* ---------------- gate modal ---------------- */
  let gateEl = null;
  function openGate(opts) {
    const o = Object.assign({ title: 'Sign in to place your order', body: 'Your basket is saved. Create an account in under a minute — or sign in if you are already with us.' }, opts || {});
    if (!gateEl) {
      gateEl = document.createElement('div');
      gateEl.className = 'auth-gate';
      gateEl.setAttribute('role', 'dialog');
      gateEl.setAttribute('aria-modal', 'true');
      document.body.appendChild(gateEl);
    }
    gateEl.innerHTML = `
      <div class="auth-gate-card" role="document">
        <button class="auth-gate-x" aria-label="Close">${NV.icon ? NV.icon('close') : '×'}</button>
        <span class="auth-gate-mark">${gateMark()}</span>
        <p class="eyebrow">Trade account</p>
        <h2>${NV.esc(o.title)}</h2>
        <p class="auth-gate-copy">${NV.esc(o.body)}</p>
        <ul class="auth-gate-list">
          <li>${tick()} Saved baskets and order history</li>
          <li>${tick()} 30-day invoice terms on approval</li>
          <li>${tick()} Tier pricing applied automatically</li>
        </ul>
        <div class="auth-gate-actions">
          <button class="btn btn-gold" data-gate="signup">Create account</button>
          <button class="btn btn-ghost" data-gate="signin">Sign in</button>
        </div>
        <p class="auth-gate-foot">Browsing stays open — you only need an account to order.</p>
      </div>`;
    requestAnimationFrame(() => gateEl.classList.add('show'));
    const close = () => { gateEl.classList.remove('show'); };
    gateEl.querySelector('.auth-gate-x').onclick = close;
    gateEl.onclick = e => { if (e.target === gateEl) close(); };
    gateEl.querySelectorAll('[data-gate]').forEach(btn => {
      btn.onclick = () => {
        rememberReturn(o.returnTo || location.hash.replace(/^#\/?/, '/').replace(/^\/(\w)/, '/$1'));
        go('/auth.html?mode=' + (btn.dataset.gate === 'signup' ? 'signup' : 'signin'));
      };
    });
    document.addEventListener('keydown', escClose);
    function escClose(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); } }
    return gateEl;
  }
  function gateMark() {
    const img = document.querySelector('.footer-brand img, .rail-head img');
    return img ? `<img src="${img.getAttribute('src')}" alt="Norvex">` : 'N';
  }
  function tick() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  }

  /* full-page style guard banner for protected screens */
  function pageGuard(opts) {
    const o = Object.assign({
      title: 'Sign in to see this page',
      body: 'Order history and organisation details live inside your trade account. Browsing and the catalogue stay open to everyone.',
      mount: 'main'
    }, opts || {});
    const host = document.querySelector(o.mount) || document.body;
    if (!host || !current()) {
      if (!host || host.querySelector('.auth-guard')) return null;
      const el = document.createElement('div');
      el.className = 'auth-guard';
      el.innerHTML = `
        <div class="auth-guard-body">
          <p class="eyebrow">Trade account</p>
          <h2>${NV.esc(o.title)}</h2>
          <p>${NV.esc(o.body)}</p>
        </div>
        <div class="auth-guard-actions">
          <a class="btn btn-gold btn-sm" href="/auth.html?mode=signin" data-guard="in">Sign in</a>
          <a class="btn btn-ghost btn-sm" href="/auth.html?mode=signup" data-guard="up">Create account</a>
        </div>`;
      host.insertBefore(el, host.firstChild);
      el.querySelectorAll('[data-guard]').forEach(a => {
        a.addEventListener('click', () => rememberReturn(location.pathname === '/' ? '/index.html' : location.pathname.replace(/^\./, '')));
      });
      return el;
    }
    return null;
  }

  /* ---------------- header / rail identity ---------------- */
  function mountIdentity() {
    const user = current();
    document.querySelectorAll('[data-auth="identity"], #authSlot').forEach(el => { el.innerHTML = identityMarkup(user); });
    document.querySelectorAll('[data-auth="account-link"]').forEach(a => {
      a.setAttribute('href', user ? '/account.html' : '/auth.html?mode=signin');
      a.setAttribute('aria-label', user ? `Account — ${user.name}` : 'Sign in');
    });
    document.querySelectorAll('[data-auth="drawer-link"]').forEach(a => {
      a.textContent = user ? `Signed in — ${user.name}` : 'Sign in / create account';
      a.setAttribute('href', user ? '/account.html' : '/auth.html?mode=signin');
    });
    document.querySelectorAll('[data-auth="orders-link"]').forEach(a => {
      a.setAttribute('href', user ? '/orders.html' : '/auth.html?mode=signin');
    });
    /* console rail user footer */
    document.querySelectorAll('#userName').forEach(el => { el.textContent = user ? user.name : 'Sign in'; });
    document.querySelectorAll('#userOrg').forEach(el => { el.textContent = user ? user.organisation : 'Guest visitor'; });
    document.querySelectorAll('#userAvatar').forEach(el => { el.textContent = user ? user.avatar : 'NV'; });
    document.querySelectorAll('.rail-user').forEach(el => {
      el.setAttribute('href', user ? '/account.html' : '/auth.html?mode=signin');
      el.classList.toggle('is-guest', !user);
    });
    document.querySelectorAll('[data-rail-signout]').forEach(btn => {
      btn.hidden = !user;
      if (!btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          signOut({ redirect: false });
          NV.toast('You are signed out. Your basket is still saved.', { title: 'Signed out' });
        });
      }
    });
    document.querySelectorAll('[data-auth-page-signout]').forEach(btn => {
      btn.hidden = !user;
      if (!btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', e => {
          e.preventDefault();
          signOut({ redirect: false });
          NV.toast('You are signed out.', { title: 'Signed out' });
        });
      }
    });
    document.body.classList.toggle('is-authed', !!user);
  }

  function identityMarkup(user) {
    if (!user) {
      return `<div class="auth-entry">
        <a class="btn btn-ghost btn-sm auth-signin" href="/auth.html?mode=signin" data-auth="signin-link">Sign in</a>
        <a class="btn btn-gold btn-sm auth-join" href="/auth.html?mode=signup">Create account</a>
      </div>`;
    }
    return `<div class="auth-user" data-auth-user>
      <button class="auth-user-btn" aria-haspopup="menu" aria-expanded="false">
        <span class="auth-avatar">${NV.esc(user.avatar)}</span>
        <span class="auth-who"><b>${NV.esc(user.name.split(' ')[0])}</b><small>${NV.esc(user.organisation.slice(0, 22))}</small></span>
      </button>
      <div class="auth-menu" role="menu">
        <div class="auth-menu-head">
          <span class="auth-avatar lg">${NV.esc(user.avatar)}</span>
          <div><b>${NV.esc(user.name)}</b><small>${NV.esc(user.email)}</small></div>
        </div>
        <a href="/account.html" role="menuitem">Organisation profile</a>
        <a href="/orders.html" role="menuitem">My orders</a>
        <a href="/basket.html" role="menuitem">Supply basket</a>
        ${user.role === 'admin' ? '<a href="/admin.html" role="menuitem">Operations console</a>' : ''}
        <button type="button" data-auth-signout role="menuitem">Sign out</button>
      </div>
    </div>`;
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('.auth-user-btn');
    if (btn) {
      const host = btn.closest('.auth-user');
      const open = host.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (e.target.closest && e.target.closest('[data-auth-signout]')) {
      signOut({ redirect: true });
      return;
    }
    if (!e.target.closest || !e.target.closest('.auth-user')) {
      document.querySelectorAll('.auth-user.open').forEach(el => {
        el.classList.remove('open');
        const b = el.querySelector('.auth-user-btn');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
    }
  });

  /* ---------------- boot ---------------- */
  seededReady = seed();
  if (currentId() && !NV.read(SESSION, null)) NV.write(SESSION, null);

  window.NV.auth = {
    current, isIn: () => !!current(), require: requireAuth, gate: openGate, pageGuard,
    signUp, signIn, signOut, update, changePassword, resetPasswordLocal, removeAccount,
    validateSignup, strength, normalisePhone, phoneOk, emailOk, usernameOk,
    go, rememberReturn, takeReturn, initials, accounts: () => accounts().map(publicUser),
    onChange(fn) { listeners.add(fn); fn(current()); return () => listeners.delete(fn); },
    refresh: mountIdentity
  };

  const boot = () => { mountIdentity(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('norvex:chrome', boot);
  window.addEventListener('hashchange', () => setTimeout(mountIdentity, 60));
})();
