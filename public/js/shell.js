/* =========================================================
   NORVEX v2 SHELL — one chrome for every page
   utility bar · sticky header · catalogue mega-menu ·
   workspace tabs · search overlay · basket drawer ·
   mobile drawer · footer. Replaces the old split chromes.
   ========================================================= */
(function () {
  'use strict';
  const NV = window.NV;
  if (!NV) return;
  const E = NV.esc;

  const PAGE = document.body.dataset.page || 'home';
  const WORKSPACE = ['desk', 'basket', 'checkout', 'orders', 'order', 'plan', 'account', 'admin', 'manage'];
  const NAV = [
    { key: 'home', label: 'Home', href: '/index.html', icon: 'home' },
    { key: 'shop', label: 'Catalogue', href: '/shop.html', icon: 'layers', mega: true },
    { key: 'services', label: 'Services', href: '/services.html', icon: 'handshake' },
    { key: 'plan', label: 'Future orders', href: '/plan.html', icon: 'calendar' },
    { key: 'about', label: 'About', href: '/about.html', icon: 'building' },
    { key: 'contact', label: 'Contact', href: '/contact.html', icon: 'mail' }
  ];
  const ACTIVE = { product: 'shop', order: 'orders', manage: 'admin', quote: '', auth: '' };
  const activeKey = ACTIVE[PAGE] !== undefined ? ACTIVE[PAGE] : PAGE;

  const WTABS = [
    { key: 'desk', label: 'Order desk', href: '/desk.html', icon: 'grid' },
    { key: 'basket', label: 'Basket', href: '/basket.html', icon: 'cart', count: true },
    { key: 'checkout', label: 'Checkout', href: '/checkout.html', icon: 'wallet' },
    { key: 'orders', label: 'Orders', href: '/orders.html', icon: 'receipt' },
    { key: 'plan', label: 'Future plan', href: '/plan.html', icon: 'calendar' },
    { key: 'account', label: 'Account', href: '/account.html', icon: 'user' }
  ];
  const ADMIN_TABS = [
    { key: 'admin', label: 'Operations', href: '/admin.html', icon: 'chart' },
    { key: 'manage', label: 'Catalogue manager', href: '/manage.html', icon: 'settings' }
  ];

  let cat = null;
  const locks = { search: false, cart: false, menu: false };
  const syncLock = () => document.body.classList.toggle('locked', locks.search || locks.cart || locks.menu);

  /* ---------------- header + utility bar ---------------- */
  function buildTop() {
    const mount = document.getElementById('nv-shell-top');
    if (!mount) return;
    const isAdmin = NV.auth && NV.auth.isIn() && NV.auth.current().role === 'admin';
    const wActive = ACTIVE[PAGE] !== undefined && WORKSPACE.includes(PAGE) ? (PAGE === 'order' ? 'orders' : PAGE) : PAGE;

    mount.innerHTML = `
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="util-bar">
      <div class="shell">
        <a href="tel:${NV.CONFIG.phoneRaw}">${NV.icon('phone')} ${E(NV.CONFIG.phone)}</a>
        <span class="util-sep util-hide-md"></span>
        <span class="util-hide-md">${E(NV.CONFIG.hours)}</span>
        <span class="spread"></span>
        <span class="util-gold util-hide-sm">${NV.icon('truck')} Free delivery over ${NV.money(NV.CONFIG.freeDeliveryFrom)}</span>
        <span class="util-sep util-hide-sm"></span>
        <a href="/order.html">${NV.icon('box')} Track order</a>
      </div>
    </div>
    <header class="site-header" id="siteHeader">
      <div class="shell header-main">
        <a class="brand" href="/index.html" aria-label="Norvex home">
          <img src="/img/logo.png" alt="Norvex Integrated Enterprises Ltd" width="164" height="40">
        </a>
        <nav class="main-nav" aria-label="Primary">
          ${NAV.map(n => n.mega
            ? `<button type="button" id="megaBtn" class="${activeKey === n.key ? 'active' : ''}" aria-expanded="false" aria-controls="megaPanel">${n.label} ${NV.icon('chevronD')}</button>`
            : `<a href="${n.href}" class="${activeKey === n.key ? 'active' : ''}">${n.label}</a>`).join('')}
        </nav>
        <div class="header-actions">
          <button class="hicon" id="searchBtn" aria-label="Search catalogue (press /)" title="Search · /">${NV.icon('search')}</button>
          <a class="btn btn-gold btn-sm header-quote" href="/quote.html">${NV.icon('clipboard')} Request quote</a>
          <div id="authSlot"></div>
          <button class="hicon" id="cartBtn" aria-label="Open supply basket" title="Supply basket">
            ${NV.icon('cart')}<span class="count" data-cart-count data-zero="1">0</span>
          </button>
          <button class="hicon nav-burger" id="menuBtn" aria-label="Open menu">${NV.icon('menu')}</button>
        </div>
      </div>
      <div class="mega" id="megaPanel" role="region" aria-label="Catalogue departments">
        <div class="mega-inner">
          <div class="mega-grid" id="megaGrid">
            <div class="skel" style="height:58px"></div><div class="skel" style="height:58px"></div><div class="skel" style="height:58px"></div>
            <div class="skel" style="height:58px"></div><div class="skel" style="height:58px"></div><div class="skel" style="height:58px"></div>
          </div>
          <div class="mega-side">
            <span class="eyebrow" style="margin:0;color:var(--gold-400)">Bulk buyer?</span>
            <h4>Tenders &amp; contract supply</h4>
            <p>Send a multi-line requisition and get a formal quotation with tier pricing within one business day.</p>
            <a class="btn btn-gold btn-sm" href="/quote.html">${NV.icon('clipboard')} Request a quote</a>
            <a class="btn btn-dark btn-sm" href="/plan.html">${NV.icon('calendar')} Plan future orders</a>
          </div>
          <div class="mega-foot">
            <div class="stats" id="megaStats"></div>
            <a class="link-arrow" href="/shop.html">Browse the full catalogue ${NV.icon('arrowR')}</a>
          </div>
        </div>
      </div>
    </header>
    ${WORKSPACE.includes(PAGE) ? `
    <nav class="workspace-tabs" aria-label="Order desk sections">
      <div class="shell">
        ${WTABS.map(t => `
          <a class="wtab ${wActive === t.key ? 'active' : ''}" href="${t.href}">
            ${NV.icon(t.icon)} ${t.label}${t.count ? ' <span class="count" data-cart-count>0</span>' : ''}
          </a>`).join('')}
        ${isAdmin ? `<span class="wtab-sep"></span>` + ADMIN_TABS.map(t => `
          <a class="wtab admin ${wActive === t.key ? 'active' : ''}" href="${t.href}">${NV.icon(t.icon)} ${t.label}</a>`).join('') : ''}
      </div>
    </nav>` : ''}`;

    /* sticky shadow */
    const header = document.getElementById('siteHeader');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.getElementById('searchBtn').addEventListener('click', openSearch);
    document.getElementById('cartBtn').addEventListener('click', openCart);
    document.getElementById('menuBtn').addEventListener('click', openMenu);
    wireMega();
    updateCounts();
  }

  /* ---------------- mega menu ---------------- */
  let megaTimer = null;
  function wireMega() {
    const btn = document.getElementById('megaBtn');
    const panel = document.getElementById('megaPanel');
    if (!btn || !panel) return;
    const open = () => { clearTimeout(megaTimer); panel.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); };
    const close = () => { megaTimer = setTimeout(() => { panel.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }, 140); };
    btn.addEventListener('click', () => panel.classList.contains('open') ? close() : open());
    btn.addEventListener('mouseenter', open);
    btn.addEventListener('mouseleave', close);
    panel.addEventListener('mouseenter', () => clearTimeout(megaTimer));
    panel.addEventListener('mouseleave', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { panel.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        panel.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
      }
    });
  }
  function fillMega() {
    const grid = document.getElementById('megaGrid');
    if (!grid || !cat) return;
    const count = id => cat.products.filter(p => p.cat === id).length;
    grid.innerHTML = cat.categories.map(c => `
      <a class="mega-link" href="/shop.html?cat=${E(c.id)}">
        <span class="mi">${NV.icon(c.icon || NV.catIcon(c.id))}</span>
        <span><b>${E(c.name)}</b><small>${count(c.id)} lines</small></span>
      </a>`).join('');
    const stats = document.getElementById('megaStats');
    if (stats) stats.innerHTML = `<span><b>${cat.products.length}</b> catalogue lines</span><span><b>${cat.categories.length}</b> departments</span><span><b>24–72h</b> Nairobi dispatch</span>`;
  }

  /* ---------------- footer ---------------- */
  function buildFooter() {
    const mount = document.getElementById('nv-shell-bottom');
    if (!mount) return;
    mount.innerHTML = `
    <footer class="site-footer">
      <div class="shell">
        <div class="footer-main">
          <div class="footer-brand">
            <img src="/img/logo-light.png" alt="Norvex Integrated Enterprises Ltd" width="180" height="44">
            <p>Institutional supply, procurement and occupational health &amp; safety — moving what matters across Kenya.</p>
            <div class="footer-social">
              <a href="https://wa.me/${NV.CONFIG.whatsapp}" aria-label="WhatsApp" target="_blank" rel="noopener">${NV.icon('whatsapp')}</a>
              <a href="#" aria-label="LinkedIn">${NV.icon('linkedin')}</a>
              <a href="#" aria-label="Facebook">${NV.icon('facebook')}</a>
              <a href="#" aria-label="Instagram">${NV.icon('instagram')}</a>
            </div>
          </div>
          <div class="footer-col">
            <h4>Catalogue</h4>
            <ul>
              <li><a href="/shop.html">All products</a></li>
              <li><a href="/shop.html?cat=food">Dry food commodities</a></li>
              <li><a href="/shop.html?cat=office">Office &amp; stationery</a></li>
              <li><a href="/shop.html?cat=safety">Safety &amp; PPE</a></li>
              <li><a href="/shop.html?cat=ict">ICT &amp; technology</a></li>
              <li><a href="/shop.html?cat=cleaning">Cleaning &amp; hygiene</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="/about.html">About Norvex</a></li>
              <li><a href="/services.html">Our services</a></li>
              <li><a href="/quote.html">Request a quote</a></li>
              <li><a href="/plan.html">Future orders</a></li>
              <li><a href="/contact.html">Contact us</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Order desk</h4>
            <ul>
              <li><a href="/desk.html">Order desk</a></li>
              <li><a href="/basket.html">Supply basket</a></li>
              <li><a href="/checkout.html">Checkout</a></li>
              <li><a href="/orders.html" data-auth="orders-link">My orders</a></li>
              <li><a href="/account.html" data-auth="account-link">My account</a></li>
              <li><a href="/auth.html?mode=signin" data-auth="drawer-link">Sign in / create account</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Talk to us</h4>
            <ul class="footer-contact">
              <li>${NV.icon('phone')}<span><a href="tel:${NV.CONFIG.phoneRaw}">${E(NV.CONFIG.phone)}</a><br><a href="https://wa.me/${NV.CONFIG.whatsapp}" target="_blank" rel="noopener">WhatsApp sales desk</a></span></li>
              <li>${NV.icon('mail')}<a href="mailto:${NV.CONFIG.email}">${E(NV.CONFIG.email)}</a></li>
              <li>${NV.icon('pin')}<span>Upper Hill, Nairobi, Kenya</span></li>
              <li>${NV.icon('clock')}<span>${E(NV.CONFIG.hours)}<br>Sat 8:00am – 1:00pm</span></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© <span data-year>${new Date().getFullYear()}</span> Norvex Integrated Enterprises Ltd · Nairobi, Kenya</span>
          <div class="footer-pay"><span>M-PESA</span><span>VISA</span><span>MASTERCARD</span><span>BANK / LPO</span></div>
        </div>
      </div>
    </footer>`;
  }

  /* ---------------- overlays host ---------------- */
  function buildOverlays() {
    const host = document.createElement('div');
    host.id = 'nv-overlays';
    host.innerHTML = `
    <div class="overlay" id="nvOverlay"></div>

    <div class="search-overlay" id="searchOverlay" role="dialog" aria-modal="true" aria-label="Search catalogue">
      <div class="search-panel">
        <div class="search-input-row">
          ${NV.icon('search')}
          <input id="searchInput" type="text" placeholder="Search products, departments, SKUs…" autocomplete="off" aria-label="Search">
          <kbd>ESC</kbd>
        </div>
        <div class="search-results" id="searchResults"></div>
        <div class="search-foot">
          <div class="chips" id="searchChips"></div>
        </div>
      </div>
    </div>

    <aside class="drawer cart" id="cartDrawer" role="dialog" aria-modal="true" aria-label="Supply basket">
      <div class="drawer-head">
        <h3>${NV.icon('cart')} Supply basket <span class="badge gold" data-cart-distinct>0 lines</span></h3>
        <button class="drawer-x" data-close="cart" aria-label="Close basket">${NV.icon('close')}</button>
      </div>
      <div class="drawer-body" id="cartBody"></div>
      <div class="drawer-foot" id="cartFoot"></div>
    </aside>

    <aside class="drawer left" id="menuDrawer" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="drawer-head">
        <h3><img src="/img/mark.png" alt="" width="26" height="26" style="border-radius:7px"> Norvex</h3>
        <button class="drawer-x" data-close="menu" aria-label="Close menu">${NV.icon('close')}</button>
      </div>
      <div class="drawer-body" id="menuBody"></div>
    </aside>

    <nav class="bottom-bar" id="bottomBar" aria-label="Quick navigation">
      <a class="btab ${activeKey === 'home' ? 'active' : ''}" href="/index.html">${NV.icon('home')}<span>Home</span></a>
      <a class="btab ${activeKey === 'shop' ? 'active' : ''}" href="/shop.html">${NV.icon('layers')}<span>Shop</span></a>
      <button class="btab" id="bSearch" type="button" aria-label="Search catalogue">${NV.icon('search')}<span>Search</span></button>
      <a class="btab ${activeKey === 'basket' ? 'active' : ''}" href="/basket.html" aria-label="Supply basket">
        ${NV.icon('cart')}<span class="bcount count" data-cart-count data-zero="1">0</span><span>Basket</span>
      </a>
      <button class="btab" id="bMenu" type="button" aria-label="Open menu">${NV.icon('menu')}<span>Menu</span></button>
    </nav>`;
    document.body.appendChild(host);

    document.getElementById('bSearch').addEventListener('click', openSearch);
    document.getElementById('bMenu').addEventListener('click', openMenu);

    document.getElementById('nvOverlay').addEventListener('click', closeAll);
    host.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeAll));

    /* search wiring */
    const input = document.getElementById('searchInput');
    input.addEventListener('input', () => renderSearch(input.value));
    input.addEventListener('keydown', searchKeys);
    document.getElementById('searchOverlay').addEventListener('click', e => {
      if (e.target.id === 'searchOverlay') closeAll();
    });
    document.getElementById('searchChips').innerHTML =
      ['Beans', 'Rice', 'A4 paper', 'Safety boots', 'Laptops'].map(q => `<button class="chip" data-q="${E(q)}">${E(q)}</button>`).join('');
    document.getElementById('searchChips').addEventListener('click', e => {
      const b = e.target.closest('[data-q]');
      if (b) { input.value = b.dataset.q; renderSearch(b.dataset.q); input.focus(); }
    });

    /* global keys */
    document.addEventListener('keydown', e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName || '');
      if (e.key === 'Escape') { closeAll(); return; }
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); return; }
      if (e.key === '/' && !typing && !locks.search) { e.preventDefault(); openSearch(); }
    });
  }

  function openSearch() {
    closeAll();
    locks.search = true; syncLock();
    const ov = document.getElementById('searchOverlay');
    ov.classList.add('open');
    const input = document.getElementById('searchInput');
    input.value = '';
    renderSearch('');
    setTimeout(() => input.focus(), 60);
  }

  let searchHits = [];
  let searchSel = -1;
  function renderSearch(q) {
    const box = document.getElementById('searchResults');
    const query = String(q || '').trim().toLowerCase();
    searchSel = -1;
    if (!cat) { box.innerHTML = '<div class="search-empty">Loading catalogue…</div>'; return; }
    if (!query) {
      searchHits = [];
      box.innerHTML = `
        <p class="search-label">Jump to</p>
        <div class="search-quick">
          <a href="/shop.html">${NV.icon('layers')} Full catalogue</a>
          <a href="/quote.html">${NV.icon('clipboard')} Request a quote</a>
          <a href="/basket.html">${NV.icon('cart')} Supply basket</a>
          <a href="/orders.html">${NV.icon('receipt')} My orders</a>
          <a href="/plan.html">${NV.icon('calendar')} Future orders</a>
          <a href="/desk.html">${NV.icon('grid')} Order desk</a>
        </div>
        <p class="search-label">Popular right now</p>
        ${cat.products.filter(p => p.popular).slice(0, 4).map(p => searchHitHtml(p)).join('')}`;
      return;
    }
    searchHits = cat.products.filter(p =>
      (p.name + ' ' + (p.tags || []).join(' ') + ' ' + p.cat + ' ' + p.id).toLowerCase().includes(query)
    ).slice(0, 8);
    box.innerHTML = searchHits.length
      ? searchHits.map(p => searchHitHtml(p)).join('') +
        `<div class="search-quick" style="grid-template-columns:1fr"><a href="/shop.html?q=${encodeURIComponent(query)}">${NV.icon('arrowR')} See all results in the catalogue</a></div>`
      : `<div class="search-empty">No matches for “${E(query)}”.<br><a class="link-arrow gold" style="margin-top:10px" href="/quote.html">Request a sourcing quote ${NV.icon('arrowR')}</a></div>`;
  }
  function searchHitHtml(p) {
    const catName = (cat.categories.find(c => c.id === p.cat) || {}).name || p.cat;
    const media = p.img ? `<img src="${E(p.img)}" alt="" loading="lazy">` : `<span class="sh-art">${NV.icon(NV.catIcon(p.cat))}</span>`;
    return `<a class="search-hit" href="/product.html?id=${E(p.id)}">${media}
      <span><b>${E(p.name)}</b><small>${E(catName)} · ${E(p.unit)}</small></span>
      <span class="sh-price">${NV.money(p.tiers[0][1])}</span></a>`;
  }
  function searchKeys(e) {
    const hits = Array.from(document.querySelectorAll('#searchResults .search-hit'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hits.length) return;
      searchSel = e.key === 'ArrowDown'
        ? (searchSel + 1) % hits.length
        : (searchSel - 1 + hits.length) % hits.length;
      hits.forEach((h, i) => h.classList.toggle('sel', i === searchSel));
      hits[searchSel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchSel >= 0 && hits[searchSel]) location.href = hits[searchSel].getAttribute('href');
      else if (e.target.value.trim()) location.href = '/shop.html?q=' + encodeURIComponent(e.target.value.trim());
    }
  }

  /* ---------------- basket drawer ---------------- */
  function openCart() {
    closeAll();
    locks.cart = true; syncLock();
    document.getElementById('nvOverlay').classList.add('open');
    document.getElementById('cartDrawer').classList.add('open');
    renderCart();
  }
  async function renderCart() {
    const body = document.getElementById('cartBody');
    const foot = document.getElementById('cartFoot');
    const lines = await NV.basket.lines();
    const distinct = document.querySelector('[data-cart-distinct]');
    if (distinct) distinct.textContent = lines.length + (lines.length === 1 ? ' line' : ' lines');
    if (!lines.length) {
      body.innerHTML = `<div class="cart-empty">${NV.icon('cart')}<h4>Your basket is empty</h4><p class="small">Browse the catalogue and add supply lines — tier pricing applies automatically.</p><a class="btn btn-primary btn-sm" style="margin-top:16px" href="/shop.html">Browse catalogue</a></div>`;
      foot.innerHTML = `<a class="btn btn-ghost btn-block btn-sm" href="/quote.html">${NV.icon('clipboard')} Need a formal quote instead?</a>`;
      return;
    }
    const t = NV.quote(lines);
    const remaining = NV.CONFIG.freeDeliveryFrom - t.subtotal;
    body.innerHTML = `
      <div class="free-ship">
        ${remaining > 0
          ? `${NV.icon('truck')} Add <b>${NV.money(remaining)}</b> more for <b>free Nairobi delivery</b>`
          : `<b>${NV.icon('check')} Free Nairobi delivery unlocked</b>`}
        <div class="progress"><i style="width:${Math.min(100, Math.round(t.subtotal / NV.CONFIG.freeDeliveryFrom * 100))}%"></i></div>
      </div>
      ${lines.map(l => `
      <div class="cart-line" data-id="${E(l.id)}">
        ${l.product.img ? `<img src="${E(l.product.img)}" alt="" loading="lazy">` : `<span class="cl-art">${NV.icon(NV.catIcon(l.cat))}</span>`}
        <div class="spread">
          <b><a href="/product.html?id=${E(l.id)}">${E(l.name)}</a></b>
          <div class="cl-meta">${E(l.unit)} · ${NV.money(l.unitPrice)} each</div>
          <div class="row mt-1">
            <span class="qty sm">
              <button data-step="-1" aria-label="Decrease quantity">${NV.icon('minus')}</button>
              <input type="number" value="${l.qty}" min="1" aria-label="Quantity of ${E(l.name)}">
              <button data-step="1" aria-label="Increase quantity">${NV.icon('plus')}</button>
            </span>
            <span class="cl-price">${NV.money(l.lineTotal)}</span>
          </div>
        </div>
        <button class="cl-x" data-remove aria-label="Remove ${E(l.name)}">${NV.icon('close')}</button>
      </div>`).join('')}`;
    foot.innerHTML = `
      <div class="sum-row" style="margin-bottom:6px"><span>Subtotal</span><span>${NV.money(t.subtotal)}</span></div>
      <div class="sum-row" style="margin-bottom:14px"><span class="muted small">Delivery + VAT calculated at checkout</span></div>
      <button class="btn btn-gold btn-block" id="drawerCheckout">${NV.icon('wallet')} Proceed to checkout</button>
      <a class="btn btn-ghost btn-block btn-sm" style="margin-top:9px" href="/basket.html">Open full basket</a>`;

    body.querySelectorAll('.cart-line').forEach(row => {
      const id = row.dataset.id;
      const input = row.querySelector('input');
      row.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
        const next = Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(b.dataset.step, 10));
        NV.basket.setQty(id, next);
      }));
      input.addEventListener('change', () => NV.basket.setQty(id, Math.max(1, parseInt(input.value, 10) || 1)));
      row.querySelector('[data-remove]').addEventListener('click', () => NV.basket.remove(id));
    });
    document.getElementById('drawerCheckout').addEventListener('click', () => {
      if (NV.auth && !NV.auth.isIn()) {
        closeAll();
        NV.auth.require({ returnTo: '/checkout.html', title: 'Sign in to check out', body: 'Your basket is saved on this device. Sign in or create a trade account to place the order.' });
      } else location.href = '/checkout.html';
    });
  }

  /* ---------------- mobile menu ---------------- */
  function openMenu() {
    closeAll();
    locks.menu = true; syncLock();
    document.getElementById('nvOverlay').classList.add('open');
    document.getElementById('menuDrawer').classList.add('open');
    const user = NV.auth && NV.auth.current();
    const body = document.getElementById('menuBody');
    body.innerHTML = `
      <div class="mnav-section" style="padding-top:4px">
        <button class="btn btn-soft btn-block" id="menuSearchBtn">${NV.icon('search')} Search the catalogue</button>
      </div>
      <div class="mnav-section">
        ${NAV.map(n => `<a class="mnav-link ${activeKey === n.key ? 'active' : ''}" href="${n.href}">${NV.icon(n.icon)} ${n.label} <span class="arrow">${NV.icon('arrowR')}</span></a>`).join('')}
        <a class="mnav-link" href="/quote.html">${NV.icon('clipboard')} Request a quote <span class="arrow">${NV.icon('arrowR')}</span></a>
      </div>
      <div class="mnav-section">
        <p class="mnav-label">Order desk</p>
        <a class="mnav-link" href="/desk.html">${NV.icon('grid')} Order desk</a>
        <a class="mnav-link" href="/basket.html">${NV.icon('cart')} Basket <span class="badge gold" style="margin-left:auto" data-cart-count>0</span></a>
        <a class="mnav-link" href="/orders.html" data-auth="orders-link">${NV.icon('receipt')} My orders</a>
        <a class="mnav-link" href="${user ? '/account.html' : '/auth.html?mode=signin'}">${NV.icon('user')} ${user ? E(user.name) : 'Sign in / create account'}</a>
        ${user && user.role === 'admin' ? `<a class="mnav-link" href="/admin.html">${NV.icon('chart')} Operations console</a>` : ''}
      </div>
      <div class="mnav-section">
        <p class="mnav-label">Departments</p>
        <div class="mnav-depts">
          ${(cat ? cat.categories : []).map(c => `<a href="/shop.html?cat=${E(c.id)}">${NV.icon(c.icon || NV.catIcon(c.id))} ${E(c.name)}</a>`).join('')}
        </div>
      </div>
      <div class="mnav-section">
        <a class="btn btn-gold btn-block" href="tel:${NV.CONFIG.phoneRaw}">${NV.icon('phone')} Call sales desk</a>
      </div>`;
    const msb = document.getElementById('menuSearchBtn');
    if (msb) msb.addEventListener('click', openSearch);
    if (NV.auth) NV.auth.refresh();
  }

  function closeAll() {
    locks.search = locks.cart = locks.menu = false; syncLock();
    document.getElementById('nvOverlay').classList.remove('open');
    document.getElementById('searchOverlay').classList.remove('open');
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('menuDrawer').classList.remove('open');
    const mega = document.getElementById('megaPanel');
    if (mega) mega.classList.remove('open');
    const megaBtn = document.getElementById('megaBtn');
    if (megaBtn) megaBtn.setAttribute('aria-expanded', 'false');
  }

  /* ---------------- live basket counts ---------------- */
  function updateCounts() {
    const n = NV.basket.count();
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = String(n);
      if (el.classList.contains('count')) el.dataset.zero = n === 0 ? '1' : '0';
    });
  }
  document.addEventListener('basket:change', () => {
    updateCounts();
    if (locks.cart) renderCart();
  });

  /* ---------------- boot ---------------- */
  function boot() {
    buildTop();
    buildFooter();
    buildOverlays();
    document.dispatchEvent(new Event('norvex:chrome'));
    NV.reveal();

    NV.catalog().then(c => {
      cat = c;
      fillMega();
      if (locks.search) renderSearch(document.getElementById('searchInput').value);
      if (NV.state.offline) {
        const pill = document.createElement('div');
        pill.className = 'offline-pill';
        pill.innerHTML = `${NV.icon('warning')} Offline preview — data stays on this device`;
        document.body.appendChild(pill);
      }
    }).catch(() => {});

    if (NV.auth) NV.auth.onChange(() => {
      /* admin tabs appear/disappear with role */
      const isAdmin = NV.auth.isIn() && NV.auth.current().role === 'admin';
      const strip = document.querySelector('.workspace-tabs .shell');
      if (!strip) return;
      const hasAdmin = !!strip.querySelector('.wtab.admin');
      if (isAdmin !== hasAdmin) buildTop(), document.dispatchEvent(new Event('norvex:chrome'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NV.shell = { openSearch, openCart, openMenu, closeAll, updateCounts };
})();
