/* =========================================================
   LAYOUT B CHROME — "The Ops Console"
   Injects the app shell: dark vertical rail with collapsible
   groups, contextual command bar and a quiet workspace footer.
   ========================================================= */
(function () {
  'use strict';
  const NV = window.NV;

  const GROUPS = [
    {
      label: 'Ordering', links: [
        { key: 'desk', label: 'Order desk', href: '/desk.html', icon: 'grid' },
        { key: 'basket', label: 'Supply basket', href: '/basket.html', icon: 'cart', badge: 'basket' },
        { key: 'checkout', label: 'Checkout', href: '/checkout.html', icon: 'wallet' }
      ]
    },
    {
      label: 'Procurement', links: [
        { key: 'shop', label: 'Catalogue', href: '/shop.html', icon: 'layers' },
        { key: 'plan', label: 'Future order planner', href: '/plan.html', icon: 'calendar' },
        { key: 'quote', label: 'Request a quote', href: '/quote.html', icon: 'clipboard' }
      ]
    },
    {
      label: 'Records', links: [
        { key: 'orders', label: 'Order history', href: '/orders.html', icon: 'receipt' },
        { key: 'order', label: 'Track shipment', href: '/order.html', icon: 'truck' },
        { key: 'account', label: 'Organisation profile', href: '/account.html', icon: 'building' }
      ]
    },
    {
      label: 'Operations', links: [
        { key: 'admin', label: 'Operations dashboard', href: '/admin.html', icon: 'chart' },
        { key: 'contact', label: 'Support', href: '/contact.html', icon: 'handshake' }
      ]
    }
  ];

  const QUICK = [
    { label: 'Browse the full catalogue', href: '/shop.html', icon: 'layers', hint: 'Catalogue' },
    { label: 'Review supply basket', href: '/basket.html', icon: 'cart', hint: 'Ordering' },
    { label: 'Continue to checkout', href: '/checkout.html', icon: 'wallet', hint: 'Ordering' },
    { label: 'Plan a future order', href: '/plan.html', icon: 'calendar', hint: 'Procurement' },
    { label: 'Submit an RFQ', href: '/quote.html', icon: 'clipboard', hint: 'Procurement' },
    { label: 'Track an existing order', href: '/order.html', icon: 'truck', hint: 'Records' },
    { label: 'Order history', href: '/orders.html', icon: 'receipt', hint: 'Records' },
    { label: 'Operations dashboard', href: '/admin.html', icon: 'chart', hint: 'Operations' },
    { label: 'Back to storefront', href: '/index.html', icon: 'home', hint: 'Portal' }
  ];

  function buildRail(active) {
    const savedCollapsed = NV.read('norvex.rail.collapsed', false);
    if (savedCollapsed) document.querySelector('.console').classList.add('rail-collapsed');

    return `
    <aside class="rail" aria-label="Console navigation">
      <div class="rail-head">
        <a href="/desk.html" style="display:flex;align-items:center;gap:10px">
          <img src="/img/mark-light.png" alt="Norvex">
          <span><span class="rail-brand">NORVEX</span><span class="rail-sub">Order desk</span></span>
        </a>
      </div>

      <div class="rail-org">
        <span class="org-mark" id="orgMark">N</span>
        <span class="org-meta">
          <b id="orgName">Your organisation</b>
          <small id="orgTier">Trade account</small>
        </span>
      </div>

      <div class="rail-scroll">
        ${GROUPS.map(g => `
          <div class="rail-group">
            <button class="rail-group-head" aria-expanded="true">${g.label}<span class="caret"></span></button>
            <div class="rail-links">
              ${g.links.map(l => `
                <a class="rail-link ${active === l.key ? 'active' : ''}" href="${l.href}" ${active === l.key ? 'aria-current="page"' : ''}>
                  ${NV.icon(l.icon)}<span class="label">${l.label}</span>
                  ${l.badge === 'basket' ? `<span class="rail-badge hot" data-count>0</span>` : ''}
                </a>`).join('')}
            </div>
          </div>`).join('')}

        <div class="rail-group">
          <button class="rail-group-head" aria-expanded="true">Portal<span class="caret"></span></button>
          <div class="rail-links">
            <a class="rail-link" href="/index.html">${NV.icon('home')}<span class="label">Storefront home</span></a>
            <a class="rail-link" href="/about.html">${NV.icon('building')}<span class="label">About Norvex</span></a>
            <a class="rail-link" href="/services.html">${NV.icon('layers')}<span class="label">Services</span></a>
          </div>
        </div>
      </div>

      <div class="rail-foot">
        <a class="rail-user" href="/account.html">
          <span class="avatar" id="userAvatar">NV</span>
          <span class="who"><b id="userName">Procurement lead</b><small id="userOrg">Trade account</small></span>
          <span class="rail-user-signout" data-rail-signout title="Sign out" aria-label="Sign out" role="button" hidden>${NV.icon('logout')}</span>
        </a>
        <button class="rail-collapse-btn" id="railCollapse">
          ${NV.icon('arrowL')}<span>Collapse rail</span>
        </button>
      </div>
    </aside>`;
  }

  function buildCmdbar() {
    const crumb = (document.body.dataset.crumb || 'Order desk').split('|');
    return `
    <header class="cmdbar">
      <button class="icon-btn rail-toggle" id="railToggle" aria-label="Open navigation">${NV.icon('menu')}</button>
      <nav class="cmd-crumbs" aria-label="Breadcrumb">
        <a href="/desk.html">Norvex</a>
        <span class="sep">/</span>
        ${crumb.length > 1 ? `<a href="${document.body.dataset.crumbHref || '/desk.html'}">${crumb[0]}</a><span class="sep">/</span>` : ''}
        <span class="now">${crumb[crumb.length - 1]}</span>
      </nav>
      <button class="cmd-search" id="cmdkOpen" aria-label="Search and jump to">
        ${NV.icon('search')}<span class="label">Search or jump to…</span>
        <span class="kbd"><span class="kbd">Ctrl</span><span class="kbd">K</span></span>
      </button>
      <div class="cmd-actions">
        <a class="icon-btn" href="/shop.html" aria-label="Catalogue" title="Catalogue">${NV.icon('layers')}</a>
        <button class="icon-btn" id="notifBtn" aria-label="Notifications" style="position:relative">
          ${NV.icon('bell')}
          <span style="position:absolute;top:8px;right:9px;width:7px;height:7px;border-radius:50%;background:var(--gold-500)"></span>
        </button>
        <div class="cmd-divider"></div>
        <a href="/basket.html" class="icon-btn" aria-label="Supply basket" style="position:relative">
          ${NV.icon('cart')}
          <span class="cart-count" data-count style="position:absolute;top:0;right:-2px">0</span>
        </a>
        <span class="auth-slot console-auth" data-auth="identity"></span>
        <a href="/shop.html" class="btn btn-gold btn-sm no-print" style="margin-left:6px">${NV.icon('plus')} New order</a>
      </div>
    </header>

    <div class="cmdk" id="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="cmdk-box">
        <div class="cmdk-input">
          ${NV.icon('search')}
          <input id="cmdkInput" type="text" placeholder="Search pages, tools and catalogue…" autocomplete="off" aria-label="Search">
          <span class="kbd">ESC</span>
        </div>
        <div class="cmdk-list" id="cmdkList"></div>
        <div class="cmdk-foot">
          <span><span class="kbd">↑</span><span class="kbd">↓</span> navigate</span>
          <span><span class="kbd">↵</span> open</span>
          <a href="/index.html" style="margin-left:auto">Storefront →</a>
        </div>
      </div>
    </div>`;
  }


  /* ================= ADMIN — expandable navigation ================= */
  const ADMIN_TREE = [
    {
      key: 'overview', label: 'Overview', icon: 'chart', href: '/admin.html',
      children: [
        { label: 'KPIs & revenue', href: '/admin.html', icon: 'chart' },
        { label: 'Status mix', href: '/admin.html#mix', icon: 'layers' },
        { label: 'Top moving lines', href: '/admin.html#top', icon: 'star' }
      ]
    },
    {
      key: 'orders', label: 'Orders', icon: 'receipt',
      children: [
        { label: 'All orders', href: '/admin.html#orders', icon: 'list' },
        { label: 'Advance status', href: '/admin.html#orders', icon: 'refresh' },
        { label: 'Export to CSV', href: '/admin.html#orders', icon: 'download', action: 'export' }
      ]
    },
    {
      key: 'pipeline', label: 'Future orders', icon: 'calendar',
      children: [
        { label: 'Delivery pipeline', href: '/admin.html#pipeline', icon: 'truck' },
        { label: 'Plan a requirement', href: '/plan.html', icon: 'plus' }
      ]
    },
    {
      key: 'enquiries', label: 'Enquiries & quotes', icon: 'clipboard',
      children: [
        { label: 'Open enquiries', href: '/admin.html#enquiries', icon: 'mail' },
        { label: 'Quote desk', href: '/quote.html', icon: 'clipboard' }
      ]
    },
    {
      key: 'catalogue', label: 'Catalogue', icon: 'layers',
      children: [
        { label: 'Manage products', href: '/manage.html', icon: 'box' },
        { label: 'Manage departments', href: '/manage.html#categories', icon: 'layers' },
        { label: 'Browse catalogue', href: '/shop.html', icon: 'grid' },
        { label: 'Supply basket', href: '/basket.html', icon: 'cart' },
        { label: 'Organisation profile', href: '/account.html', icon: 'building' }
      ]
    }
  ];

  function buildAdminRail() {
    return `
    <aside class="rail admin-rail" aria-label="Admin navigation">
      <div class="rail-head">
        <a href="/desk.html" style="display:flex;align-items:center;gap:10px">
          <img src="/img/mark-light.png" alt="Norvex">
          <span><span class="rail-brand">NORVEX</span><span class="rail-sub">Admin console</span></span>
        </a>
        <button class="admin-rail-close" id="adminRailClose" aria-label="Close navigation">${NV.icon('close')}</button>
      </div>

      <div class="admin-pill"><span class="status-dot" style="color:#7fc79f"></span> Live · ${NV.dateFmt(new Date().toISOString())}</div>

      <div class="rail-scroll">
        <nav class="admin-tree" aria-label="Admin sections">
          ${ADMIN_TREE.map(node => `
            <div class="admin-node" data-admin-node="${node.key}">
              <button class="admin-node-head" aria-expanded="false">
                <span class="admin-node-ico">${NV.icon(node.icon)}</span>
                <span class="admin-node-label">${node.label}</span>
                <span class="admin-chev"></span>
              </button>
              <div class="admin-node-body">
                ${node.children.map(c => `
                  <a class="admin-leaf" href="${c.href}" ${c.action ? `data-admin-action="${c.action}"` : ''}>
                    <span class="admin-leaf-ico">${NV.icon(c.icon)}</span>${c.label}
                  </a>`).join('')}
              </div>
            </div>`).join('')}
        </nav>

        <div class="rail-group">
          <button class="rail-group-head" aria-expanded="true">Switch workspace<span class="caret"></span></button>
          <div class="rail-links">
            <a class="rail-link" href="/desk.html">${NV.icon('grid')}<span class="label">Order desk</span></a>
            <a class="rail-link" href="/index.html">${NV.icon('home')}<span class="label">Storefront</span></a>
          </div>
        </div>
      </div>

      <div class="rail-foot">
        <a class="rail-user" href="/account.html">
          <span class="avatar" id="userAvatar">NV</span>
          <span class="who"><b id="userName">Procurement lead</b><small id="userOrg">Trade account</small></span>
          <span class="rail-user-signout" data-rail-signout title="Sign out" aria-label="Sign out" role="button" hidden>${NV.icon('logout')}</span>
        </a>
      </div>
    </aside>
    <div class="mobile-nav-backdrop" aria-hidden="true"></div>`;
  }

  function buildAdminBar() {
    const crumb = (document.body.dataset.crumb || 'Operations|Dashboard').split('|');
    return `
    <header class="cmdbar admin-bar">
      <button class="icon-btn rail-toggle" id="railToggle" aria-label="Open navigation">${NV.icon('menu')}</button>
      <nav class="cmd-crumbs" aria-label="Breadcrumb">
        <a href="/desk.html">Norvex</a><span class="sep">/</span>
        <a href="/admin.html">${crumb[0]}</a><span class="sep">/</span>
        <span class="now">${crumb[crumb.length - 1]}</span>
      </nav>
      <div class="admin-tree-inline" id="adminTreeInline" aria-label="Sections"></div>
      <div class="cmd-actions">
        <button class="icon-btn" id="cmdkOpen" aria-label="Search and jump to">${NV.icon('search')}</button>
        <a href="/basket.html" class="icon-btn" aria-label="Supply basket" style="position:relative">
          ${NV.icon('cart')}<span class="cart-count" data-count style="position:absolute;top:0;right:-2px">0</span>
        </a>
        <span class="auth-slot console-auth" data-auth="identity"></span>
        <a href="/shop.html" class="btn btn-gold btn-sm no-print" style="margin-left:6px">${NV.icon('plus')} New order</a>
      </div>
    </header>`;
  }


  /* ================= CONSOLE — floating pill nav (phones) ================= */
  function buildConsolePill(active) {
    const items = [
      { key: 'desk', label: 'Desk', href: '/desk.html', icon: 'grid' },
      { key: 'shop', label: 'Shop', href: '/shop.html', icon: 'layers' },
      { key: 'basket', label: 'Basket', href: '/basket.html', icon: 'cart', count: true },
      { key: 'checkout', label: 'Pay', href: '/checkout.html', icon: 'wallet' },
      { key: 'menu', label: 'Menu', icon: 'menu', action: 'menu' }
    ];
    return `
    <nav class="pill-nav console-pill" aria-label="Quick navigation">
      ${items.map(i => i.action ? `
        <button class="pill-item" data-console-action="${i.action}" aria-label="${i.label}">
          ${NV.icon(i.icon)}<span>${i.label}</span>
        </button>` : `
        <a class="pill-item ${active === i.key ? 'active' : ''}" href="${i.href}">
          ${NV.icon(i.icon)}<span>${i.label}</span>${i.count ? '<b class="pill-count" data-count>0</b>' : ''}
        </a>`).join('')}
    </nav>`;
  }
  function wireAdminNav() {
    const rail = document.querySelector('.admin-rail');
    const store = key => 'norvex.admin.node.' + key;

    /* restore / persist which branches are open */
    document.querySelectorAll('.admin-node').forEach(node => {
      const key = node.dataset.adminNode;
      const btn = node.querySelector('.admin-node-head');
      const open = NV.read(store(key), key === 'overview');
      node.classList.toggle('open', !!open);
      btn.setAttribute('aria-expanded', String(!!open));
      btn.addEventListener('click', () => {
        const next = !node.classList.contains('open');
        node.classList.toggle('open', next);
        btn.setAttribute('aria-expanded', String(next));
        NV.write(store(key), next);
      });
    });

    /* inline dropdown in the command bar (desktop) */
    const inline = document.getElementById('adminTreeInline');
    if (inline) {
      inline.innerHTML = ADMIN_TREE.map(node => `
        <div class="aitem" data-inline-node>
          <button class="aitem-btn" aria-expanded="false">
            ${NV.icon(node.icon)}<span>${node.label}</span><span class="admin-chev"></span>
          </button>
          <div class="aitem-menu">
            ${node.children.map(c => `<a href="${c.href}" ${c.action ? `data-admin-action="${c.action}"` : ''}>${NV.icon(c.icon)}${c.label}</a>`).join('')}
          </div>
        </div>`).join('');

      inline.querySelectorAll('[data-inline-node]').forEach(item => {
        const btn = item.querySelector('.aitem-btn');
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const open = !item.classList.contains('open');
          inline.querySelectorAll('[data-inline-node]').forEach(i => { i.classList.remove('open'); i.querySelector('.aitem-btn').setAttribute('aria-expanded', 'false'); });
          item.classList.toggle('open', open);
          btn.setAttribute('aria-expanded', String(open));
        });
        item.addEventListener('mouseenter', () => { if (matchMedia('(hover:hover)').matches) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); } });
        item.addEventListener('mouseleave', () => { if (matchMedia('(hover:hover)').matches) { item.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
      });
      document.addEventListener('click', () => inline.querySelectorAll('[data-inline-node]').forEach(i => { i.classList.remove('open'); i.querySelector('.aitem-btn').setAttribute('aria-expanded', 'false'); }));
    }

    /* close button on the mobile rail */
    const closeBtn = document.getElementById('adminRailClose');
    if (closeBtn) closeBtn.addEventListener('click', () => document.querySelector('.console').classList.remove('rail-open'));

    /* export shortcut */
    document.querySelectorAll('[data-admin-action="export"]').forEach(el => el.addEventListener('click', e => {
      const btn = document.getElementById('exportBtn');
      if (btn) { e.preventDefault(); btn.click(); }
    }));
  }

  function wireConsole() {
    const root = document.querySelector('.console');

    /* mobile rail toggle — wired first, never skipped */
    const railToggleEl = document.getElementById('railToggle');
    if (railToggleEl && !railToggleEl.dataset.bound) {
      railToggleEl.dataset.bound = '1';
      railToggleEl.addEventListener('click', () => root.classList.toggle('rail-open'));
    }
    document.querySelector('.mobile-nav-backdrop')?.addEventListener('click', () => root.classList.remove('rail-open'));
    const railCollapse = document.getElementById('railCollapse');
    if (railCollapse) railCollapse.addEventListener('click', () => {
      root.classList.toggle('rail-collapsed');
      NV.write('norvex.rail.collapsed', root.classList.contains('rail-collapsed'));
    });

    document.querySelectorAll('.rail-group-head').forEach(head => {
      head.addEventListener('click', () => {
        const group = head.closest('.rail-group');
        group.classList.toggle('closed');
        head.setAttribute('aria-expanded', String(!group.classList.contains('closed')));
      });
    });

    const overlay = document.getElementById('cmdk');
    const input = document.getElementById('cmdkInput');
    const list = document.getElementById('cmdkList');
    if (!overlay || !input || !list) {
      /* admin bar has no command palette — finish the remaining wiring below */
      finishConsoleWiring(root);
      return;
    }
    let items = [], cursor = 0;

    const renderList = (q = '') => {
      const query = q.trim().toLowerCase();
      items = QUICK.filter(i => !query || (i.label + ' ' + i.hint).toLowerCase().includes(query));
      if (!items.length) { list.innerHTML = `<div class="cmdk-empty">No destinations match “${NV.esc(q)}”. Try “basket”, “quote” or “catalogue”.</div>`; return; }
      cursor = 0;
      list.innerHTML = items.map((i, idx) => `
        <a class="cmdk-row ${idx === 0 ? 'on' : ''}" href="${i.href}" data-idx="${idx}">
          <span class="cmdk-ico">${NV.icon(i.icon)}</span>
          <span>${i.label}</span>
          <span class="cmdk-hint">${i.hint}</span>
        </a>`).join('');
      bindRows();
    };
    const bindRows = () => {
      list.querySelectorAll('.cmdk-row').forEach(row => {
        row.addEventListener('mouseenter', () => { cursor = Number(row.dataset.idx); paint(); });
      });
    };
    const paint = () => list.querySelectorAll('.cmdk-row').forEach((r, i) => r.classList.toggle('on', i === cursor));

    const openCmd = () => { overlay.classList.add('open'); input.value = ''; renderList(); setTimeout(() => input.focus(), 30); };
    const closeCmd = () => overlay.classList.remove('open');

    const cmdkOpenEl = document.getElementById('cmdkOpen');
    if (cmdkOpenEl) cmdkOpenEl.addEventListener('click', openCmd);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeCmd(); });
    input.addEventListener('input', e => renderList(e.target.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(items.length - 1, cursor + 1); paint(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(0, cursor - 1); paint(); }
      if (e.key === 'Enter' && items[cursor]) { location.href = items[cursor].href; }
    });
    document.addEventListener('keydown', e => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); overlay.classList.contains('open') ? closeCmd() : openCmd(); }
      if (e.key === 'Escape') closeCmd();
    });

    /* mobile rail */


    finishConsoleWiring(root);
  }

  function finishConsoleWiring(root) {
    document.getElementById('notifBtn')?.addEventListener('click', () => NV.toast('No new alerts. Delivery updates will appear here.', { title: 'Notifications' }));

    /* live basket badges */
    const paintCounts = n => document.querySelectorAll('[data-count]').forEach(el => el.textContent = n);
    paintCounts(NV.basket.count());
    document.addEventListener('basket:change', e => {
      paintCounts(e.detail.count);
      document.querySelectorAll('.cart-count[data-count]').forEach(el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
    });

    /* org identity from saved profile */
    const c = NV.customer.get();
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
    if (c.organisation) {
      set('orgName', c.organisation);
      set('userOrg', c.organisation);
      set('orgMark', c.organisation.trim().charAt(0).toUpperCase());
    }
    if (c.name) {
      set('userName', c.name);
      set('userAvatar', c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase());
    }
  }

  window.NVConsole = {
    init() {
      const active = document.body.dataset.page || '';
      const isAdmin = document.body.classList.contains('admin-shell') || active === 'admin';
      const railMount = document.getElementById('nv-rail');
      const cmdMount = document.getElementById('nv-cmdbar');

      if (railMount && railMount.dataset.built !== '1') {
        railMount.dataset.built = '1';
        railMount.outerHTML = isAdmin ? buildAdminRail() : buildRail(active);
      }
      if (cmdMount && cmdMount.dataset.built !== '1') {
        cmdMount.dataset.built = '1';
        cmdMount.outerHTML = isAdmin ? buildAdminBar() : buildCmdbar();
      }
      if ((railMount || cmdMount) && !window.__consoleWired) {
        window.__consoleWired = true;
        if (isAdmin) wireAdminNav();
        wireConsole();
        if (!document.querySelector('.console-pill')) {
          const wrap = document.createElement('div');
          wrap.innerHTML = buildConsolePill(active);
          document.body.appendChild(wrap.firstElementChild);
        }
        const cPillMenu = document.querySelector('[data-console-action="menu"]');
        if (cPillMenu && !cPillMenu.dataset.bound) {
          cPillMenu.dataset.bound = '1';
          cPillMenu.addEventListener('click', () => document.querySelector('.console').classList.toggle('rail-open'));
        }
        window.NVCookies && window.NVCookies.mount();
        NV.reveal();
        document.dispatchEvent(new CustomEvent('norvex:chrome'));
      }
    }
  };
  document.addEventListener('DOMContentLoaded', () => window.NVConsole.init());
})();
