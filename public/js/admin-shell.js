/* =========================================================
   NORVEX OPERATIONS CONSOLE — admin-only chrome.
   Deliberately distinct from the client storefront: a dark
   control-room sidebar (desktop) / top bar + tab strip (phone),
   admin navigation and identity. No shopping pill, no mega menu.
   ========================================================= */
(function () {
  'use strict';
  const NV = window.NV;
  if (!NV) return;
  const E = NV.esc;
  const PAGE = document.body.dataset.page; /* admin | manage */

  const NAV = [
    { key: 'overview', label: 'Overview', href: '/admin.html', icon: 'chart' },
    { key: 'orders', label: 'Order pipeline', href: '/admin.html#orders', icon: 'receipt' },
    { key: 'catalogue', label: 'Catalogue', href: '/manage.html', icon: 'settings' },
    { key: 'enquiries', label: 'Enquiries', href: '/admin.html#enquiries', icon: 'mail' },
    { key: 'plans', label: 'Future plans', href: '/admin.html#plans', icon: 'calendar' },
    { key: 'payments', label: 'Payments', href: '/admin.html#payments', icon: 'wallet' }
  ];

  function activeKey() {
    if (PAGE === 'manage') return 'catalogue';
    const h = (location.hash || '').replace('#', '');
    return ['orders', 'enquiries', 'plans', 'payments'].includes(h) ? h : 'overview';
  }
  function navLinks(cls) {
    const a = activeKey();
    return NAV.map(n => `<a class="${cls} ${a === n.key ? 'active' : ''}" href="${n.href}">${NV.icon(n.icon)}<span>${n.label}</span></a>`).join('');
  }
  function identity() {
    const u = NV.auth && NV.auth.current();
    if (!u) return `<span class="cs-avatar">NV</span><span class="cs-who"><b>Administrator</b><small>Sign in required</small></span>`;
    return `<span class="cs-avatar">${E(u.avatar || NV.auth.initials(u.name))}</span><span class="cs-who"><b>${E(u.name)}</b><small>${u.role === 'admin' ? 'Administrator' : E(u.organisation || '')}</small></span>`;
  }

  function build() {
    const mount = document.getElementById('consoleTop');
    if (!mount) return;
    mount.innerHTML = `
      <aside class="console-side" aria-label="Console navigation">
        <a class="cs-brand" href="/admin.html">
          <img src="/img/mark.png" alt="">
          <span><b>Norvex</b><small>Operations console</small></span>
        </a>
        <nav class="cs-nav" aria-label="Console sections">${navLinks('cs-link')}</nav>
        <div class="cs-foot">
          <a class="cs-link ghost" href="/index.html">${NV.icon('home')}<span>View storefront</span></a>
          <button class="cs-link ghost console-theme" type="button">${NV.icon('moon')}<span>Day / night</span></button>
          <div class="cs-user">${identity()}</div>
          <button class="cs-signout" type="button" data-auth-signout>${NV.icon('arrowL')} Sign out</button>
        </div>
      </aside>
      <header class="console-top">
        <a class="ct-brand" href="/admin.html"><img src="/img/mark.png" alt=""><b>Operations console</b></a>
        <div class="ct-actions">
          <button class="ct-icon console-theme" type="button" aria-label="Day / night theme">${NV.icon('moon')}</button>
          <a class="ct-icon" href="/index.html" aria-label="View storefront">${NV.icon('home')}</a>
          <a class="ct-icon" href="/account.html" aria-label="Account">${NV.icon('user')}</a>
        </div>
      </header>
      <nav class="console-tabs" aria-label="Console sections">${navLinks('ctab')}</nav>`;
    document.body.classList.add('console-body');
  }

  function paintConsoleTheme() {
    const dark = NV.theme.get() === 'dark';
    document.querySelectorAll('.console-theme').forEach(b => {
      const svg = NV.icon(dark ? 'moon' : 'sun');
      const span = b.querySelector('span');
      b.innerHTML = span ? `${svg}<span>Day / night</span>` : svg;
    });
  }

  function boot() {
    build();
    paintConsoleTheme();
    document.querySelectorAll('.console-theme').forEach(b => b.addEventListener('click', () => { NV.theme.toggle(); paintConsoleTheme(); }));
    document.addEventListener('norvex:theme', paintConsoleTheme);
    if (NV.auth) NV.auth.onChange(() => {
      const u = document.querySelector('.cs-user');
      if (u) u.innerHTML = identity();
    });
    window.addEventListener('hashchange', build);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NV.adminShell = { build };
})();
