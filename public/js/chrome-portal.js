/* =========================================================
   LAYOUT A CHROME — "The Portal" v3
   Desktop / tablet  : floating glass SIDEBAR + slim topbar
   Phone             : floating PILL NAV at the bottom
   Shared            : search overlay · basket drawer · mega footer
   ========================================================= */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  const NAV = [
    { key: 'home', label: 'Home', href: '/index.html', icon: 'home' },
    { key: 'shop', label: 'Catalogue', href: '/shop.html', icon: 'layers', depts: true },
    { key: 'services', label: 'Services', href: '/services.html', icon: 'handshake' },
    { key: 'plan', label: 'Future order', href: '/plan.html', icon: 'calendar' },
    { key: 'about', label: 'About', href: '/about.html', icon: 'building' },
    { key: 'contact', label: 'Contact', href: '/contact.html', icon: 'mail' }
  ];
  const PILL = [
    { key: 'home', label: 'Home', href: '/index.html', icon: 'home' },
    { key: 'shop', label: 'Shop', href: '/shop.html', icon: 'layers' },
    { key: 'search', label: 'Search', action: 'search', icon: 'search' },
    { key: 'basket', label: 'Basket', href: '/basket.html', action: 'cart', icon: 'cart', count: true },
    { key: 'menu', label: 'Menu', action: 'menu', icon: 'grid' }
  ];

  const cls = (active, key) => (active === key ? 'active' : '');
  const count = (cat, id) => cat.products.filter(p => p.cat === id).length;
  const catImg = (cat, id) => {
    const c = cat.categories.find(x => x.id === id) || {};
    return c.img || `/img/products/${id === 'institutional' ? 'school' : id}.jpg`;
  };

  async function buildHeader() {
    const mount = document.getElementById('nv-header');
    if (!mount || mount.dataset.built === '1') return;
    mount.dataset.built = '1';
    const active = document.body.dataset.page || 'home';
    const cat = await NV.catalog();
    const dept = cat.categories.find(c => c.id === (NV.queryString().get('cat') || '')) || cat.categories[0];

    mount.innerHTML = `
    <!-- ================= FLOATING SIDEBAR (web) ================= -->
    <aside class="side-rail" id="sideRail" aria-label="Primary navigation">
      <div class="rail-top">
        <a href="/index.html" class="rail-brand" aria-label="Norvex home">
          <img src="/img/logo.png" alt="Norvex Integrated Enterprises Ltd" width="160" height="38">
        </a>
        <button class="rail-collapse" id="sideRailToggle" aria-label="Collapse navigation" title="Collapse">
          ${NV.icon('arrowL')}
        </button>
      </div>

      <button class="rail-search" data-nav-action="search">
        ${NV.icon('search')}<span>Search catalogue</span><kbd>/</kbd>
      </button>

      <nav class="rail-nav" aria-label="Sections">
        ${NAV.map(item => item.depts ? `
          <div class="rail-group" data-rail-group="catalogue">
            <button class="rail-item rail-group-btn ${cls(active, item.key)}" aria-expanded="false" aria-controls="railDepts">
              <span class="rail-ico">${NV.icon(item.icon)}</span>
              <span class="rail-label">${item.label}</span>
              <span class="rail-caret"></span>
            </button>
            <div class="rail-sub" id="railDepts">
              <a class="rail-sublink" href="/shop.html" style="font-weight:650">All ${cat.products.length} catalogue lines</a>
              <div class="rail-depts">
                ${cat.categories.map(c => `
                  <a class="rail-dept" href="/shop.html?cat=${E(c.id)}">
                    <span class="rail-dept-ico">${NV.icon(c.icon)}</span>
                    <span>${E(c.name)}</span>
                    <b>${count(cat, c.id)}</b>
                  </a>`).join('')}
              </div>
            </div>
          </div>` : `
          <a class="rail-item ${cls(active, item.key)}" href="${item.href}">
            <span class="rail-ico">${NV.icon(item.icon)}</span>
            <span class="rail-label">${item.label}</span>
          </a>`).join('')}
      </nav>

      <div class="rail-promo">
        ${NV.ui.mediaFor(NV.ui.imgName({ img: catImg(cat, dept.id), cat: dept.id }), { alt: dept.name, sizes: '220px', cls: 'rail-promo-ph' })}
        <div class="rail-promo-body">
          <small>Department of the month</small>
          <b>${E(dept.name)}</b>
          <a href="/shop.html?cat=${E(dept.id)}">${count(cat, dept.id)} lines ${NV.icon('arrowR')}</a>
        </div>
      </div>

      <div class="rail-foot">
        <a class="rail-quote" href="/quote.html">${NV.icon('clipboard')} Request a quote</a>
        <div class="rail-meta">
          <a href="/basket.html" data-nav-action="cart">${NV.icon('cart')} Basket <b data-count>0</b></a>
          <a href="tel:${NV.CONFIG.phoneRaw}">${NV.icon('phone')} Call</a>
        </div>
      </div>
    </aside>

    <!-- ================= SLIM TOPBAR ================= -->
    <div class="portal-topbar" id="portalHeader">
      <div class="topbar-inner">
        <a href="/index.html" class="topbar-brand" aria-label="Norvex home">
          <img src="/img/logo.png" alt="Norvex" width="132" height="32">
        </a>

        <button class="topbar-search" data-nav-action="search">
          ${NV.icon('search')}
          <span>Search beans, A4 paper, safety boots…</span>
          <kbd>/</kbd>
        </button>

        <div class="topbar-actions">
          <a href="/orders.html" class="topbar-ghost hide-sm" data-auth="orders-link">Track order</a>
          <span class="auth-slot hide-sm" data-auth="identity" id="authSlot"></span>
          <a href="/account.html" class="icon-btn auth-mobile-icon" aria-label="Account" data-auth="account-link">${NV.icon('user')}</a>
          <a href="/basket.html" class="icon-btn topbar-basket" data-nav-action="cart" aria-label="Supply basket">
            ${NV.icon('cart')}<span class="cart-count" id="cartCount">0</span>
          </a>
          <a href="/quote.html" class="btn btn-gold btn-sm topbar-quote">Request quote</a>
        </div>
      </div>
    </div>

    <!-- ================= FLOATING PILL NAV (phone) ================= -->
    <nav class="pill-nav" id="pillNav" aria-label="Quick navigation">
      ${PILL.map(p => p.href && !p.action ? `
        <a class="pill-item ${cls(active, p.key)}" href="${p.href}">
          ${NV.icon(p.icon)}<span>${p.label}</span>
        </a>` : p.action === 'cart' ? `
        <a class="pill-item" href="/basket.html" data-nav-action="cart" aria-label="Supply basket">
          ${NV.icon(p.icon)}<span>${p.label}</span><b class="pill-count" data-count>0</b>
        </a>` : `
        <button class="pill-item" data-nav-action="${p.action}" aria-label="${p.label}">
          ${NV.icon(p.icon)}<span>${p.label}</span>
        </button>`).join('')}
    </nav>

    <!-- ================= MOBILE DRAWER ================= -->
    <div class="drawer-backdrop" id="drawerBackdrop"></div>
    <aside class="drawer nav-drawer" id="mobileDrawer" aria-label="Menu">
      <div class="drawer-head">
        <img src="/img/logo.png" alt="Norvex" width="150" height="36">
        <button class="icon-btn" data-nav-close="menu" aria-label="Close menu">${NV.icon('close')}</button>
      </div>
      <div class="drawer-body">
        ${NAV.map(n => `<a class="drawer-link" href="${n.href}">${NV.icon(n.icon)} <span class="dl-label">${n.label}</span> <span class="arrow">${NV.icon('arrowR')}</span></a>`).join('')}
        <p class="label-xs" style="margin:24px 0 10px">Departments</p>
        <div class="drawer-cats">
          ${cat.categories.map(c => `<a href="/shop.html?cat=${E(c.id)}">${NV.icon(c.icon)} <span>${E(c.name)}</span></a>`).join('')}
        </div>
      </div>
      <div class="drawer-foot">
        <a href="/basket.html" class="btn btn-ghost btn-block">Supply basket (<span data-count>0</span>)</a>
        <a href="tel:${NV.CONFIG.phoneRaw}" class="btn btn-gold btn-block">${NV.icon('phone')} Call sales desk</a>
      </div>
    </aside>

    <!-- ================= SEARCH OVERLAY ================= -->
    <div class="search-panel" id="searchPanel" role="dialog" aria-modal="true" aria-label="Search catalogue">
      <div class="search-box">
        <form id="searchForm" autocomplete="off" role="search">
          ${NV.icon('search')}
          <input type="search" id="searchInput" placeholder="Search beans, A4 paper, safety boots…" aria-label="Search products">
          <button type="button" class="icon-btn" data-nav-close="search" aria-label="Close search">${NV.icon('close')}</button>
        </form>
        <div class="search-results" id="searchResults">
          <div class="search-empty">Type to search ${cat.products.length} catalogue lines…</div>
        </div>
        <div class="search-suggest">
          <span class="tiny muted" style="align-self:center;margin-right:4px">Popular:</span>
          ${['Beans', 'Maize', 'A4 copy paper', 'Safety boots', 'Bottled water', 'Office chairs'].map(t => `<button type="button" data-q="${t}">${t}</button>`).join('')}
        </div>
      </div>
    </div>

    <!-- ================= BASKET DRAWER ================= -->
    <div class="drawer-backdrop" id="cartBackdrop"></div>
    <aside class="drawer cart-drawer" id="cartDrawer" aria-label="Supply basket">
      <div class="drawer-head">
        <h3 style="font-family:var(--font-sans);font-size:1rem;font-weight:650;letter-spacing:0">Supply basket</h3>
        <button class="icon-btn" data-nav-close="cart" aria-label="Close basket">${NV.icon('close')}</button>
      </div>
      <div class="drawer-body" id="cartBody"></div>
      <div class="cart-foot" id="cartFoot"></div>
    </aside>`;

    wireHeader(cat);
  }

  function wireHeader(cat) {
    const header = document.getElementById('portalHeader');
    const rail = document.getElementById('sideRail');

    /* ---- basket badges ---- */
    const bump = n => {
      document.querySelectorAll('#cartCount, [data-count]').forEach(el => {
        if (el.id === 'cartCount') { el.textContent = n; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
        else el.textContent = n;
      });
    };
    bump(NV.basket.count());
    document.addEventListener('basket:change', e => {
      bump(e.detail.count);
      const cart = document.getElementById('cartDrawer');
      if (cart && cart.classList.contains('open')) renderCart();
    });

    /* ---- sticky topbar shadow ---- */
    const onScroll = () => header && header.classList.toggle('is-stuck', window.scrollY > 6);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

    /* ---- sidebar: collapse + expandable catalogue ---- */
    const savedCollapsed = NV.read('norvex.siderail.collapsed', false);
    if (savedCollapsed) document.body.classList.add('rail-mini');
    const railToggle = document.getElementById('sideRailToggle');
    if (railToggle) railToggle.addEventListener('click', () => {
      const mini = document.body.classList.toggle('rail-mini');
      NV.write('norvex.siderail.collapsed', mini);
    });

    document.querySelectorAll('[data-rail-group]').forEach(group => {
      const btn = group.querySelector('.rail-group-btn');
      const key = 'norvex.railgroup.' + group.dataset.railGroup;
      if (NV.read(key, true)) { group.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      btn.addEventListener('click', () => {
        const open = group.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
        NV.write(key, open);
      });
    });

    /* ---- drawers / overlay plumbing ---- */
    const drawer = document.getElementById('mobileDrawer');
    const dBack = document.getElementById('drawerBackdrop');
    const panel = document.getElementById('searchPanel');
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    const cart = document.getElementById('cartDrawer');
    const cBack = document.getElementById('cartBackdrop');

    const lock = on => { document.body.style.overflow = on ? 'hidden' : ''; document.body.classList.toggle('drawer-open', on); };
    const openDrawer = () => { drawer.classList.add('open'); dBack.classList.add('open'); lock(true); };
    const closeDrawer = () => { drawer.classList.remove('open'); dBack.classList.remove('open'); lock(false); };
    const openSearch = () => { panel.classList.add('open'); if (input) setTimeout(() => input.focus(), 40); };
    const closeSearch = () => panel.classList.remove('open');
    const openCart = () => { cart.classList.add('open'); cBack.classList.add('open'); renderCart(); };
    const closeCart = () => { cart.classList.remove('open'); cBack.classList.remove('open'); };

    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDrawer));
    if (!dBack.dataset.bound) { dBack.dataset.bound = '1'; dBack.addEventListener('click', closeDrawer); }
    if (!cBack.dataset.bound) { cBack.dataset.bound = '1'; cBack.addEventListener('click', closeCart); }
    if (!panel.dataset.bound) { panel.dataset.bound = '1'; panel.addEventListener('click', e => { if (e.target === panel) closeSearch(); }); }

    /* one delegated listener for every trigger — survives router re-renders */
    if (!document.body.dataset.portalWired) {
      document.body.dataset.portalWired = '1';
      document.addEventListener('click', e => {
        const open = e.target.closest('[data-nav-action]');
        if (open) {
          const a = open.dataset.navAction;
          if (a === 'cart') { e.preventDefault(); e.stopPropagation(); window.__nvOpenCart(); }
          if (a === 'search') { e.preventDefault(); window.__nvOpenSearch(); }
          if (a === 'menu') { e.preventDefault(); window.__nvOpenDrawer(); }
          return;
        }
        const close = e.target.closest('[data-nav-close]');
        if (close) {
          const a = close.dataset.navClose;
          if (a === 'cart') window.__nvCloseCart();
          if (a === 'search') window.__nvCloseSearch();
          if (a === 'menu') window.__nvCloseDrawer();
        }
      }, true);
    }
    window.__nvOpenCart = openCart; window.__nvCloseCart = closeCart;
    window.__nvOpenSearch = openSearch; window.__nvCloseSearch = closeSearch;
    window.__nvOpenDrawer = openDrawer; window.__nvCloseDrawer = closeDrawer;

    document.addEventListener('keydown', e => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openSearch(); }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape') { closeSearch(); closeDrawer(); closeCart(); }
    });

    /* ---- live search ---- */
    let timer;
    const runSearch = q => {
      const query = q.trim().toLowerCase();
      if (!query) { results.innerHTML = `<div class="search-empty">Type to search ${cat.products.length} catalogue lines…</div>`; return; }
      const hits = cat.products.filter(p => (p.name + ' ' + p.tags.join(' ') + ' ' + p.desc + ' ' + p.cat).toLowerCase().includes(query)).slice(0, 7);
      results.innerHTML = hits.length ? hits.map(p => `
        <a class="search-hit" href="/product.html?id=${p.id}">
          <img src="${NV.ui.productThumb(p)}" alt="" width="46" height="46" loading="lazy" decoding="async">
          <span><b style="display:block;font-size:.9rem;font-weight:650">${E(p.name)}</b>
          <small class="muted">${E((cat.categories.find(c => c.id === p.cat) || {}).name || p.cat)} · ${E(p.unit)}</small></span>
          <span class="hit-meta">from ${NV.money(p.from)}</span>
        </a>`).join('') : `<div class="search-empty">No matches for “${E(q)}”. <a href="/quote.html" style="color:var(--gold-600);font-weight:600">Request a sourcing quote →</a></div>`;
    };
    input.addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => runSearch(e.target.value), 110); });
    document.getElementById('searchForm').addEventListener('submit', e => {
      e.preventDefault();
      const to = '/shop.html?q=' + encodeURIComponent(input.value);
      NV.__nvNav ? NV.__nvNav(to) : (location.href = to);
      closeSearch();
    });
    panel.querySelectorAll('.search-suggest button').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.q; runSearch(b.dataset.q); input.focus(); }));

    /* ---- basket drawer ---- */
    async function renderCart() {
      const body = document.getElementById('cartBody');
      const foot = document.getElementById('cartFoot');
      const lines = await NV.basket.lines();
      if (!lines.length) {
        body.innerHTML = `<div class="empty-basket">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--green-50);display:grid;place-items:center;margin:0 auto 16px;color:var(--green-700);border:1px solid var(--green-100)">${NV.icon('cart')}</div>
          <h4 style="font-family:var(--font-serif);font-size:1.25rem;margin-bottom:6px">Your basket is empty</h4>
          <p class="small muted">Add catalogue lines and we'll apply volume pricing automatically.</p>
          <a href="/shop.html" class="btn btn-ghost btn-sm" style="margin-top:18px">Browse catalogue</a>
        </div>`;
        foot.innerHTML = '';
        return;
      }
      body.innerHTML = lines.map(l => `
        <div class="cart-line">
          ${NV.ui.mediaFor(NV.ui.imgName(l), { alt: l.name, sizes: '64px', cls: 'order-line-ph' })}
          <div>
            <h4><a href="/product.html?id=${l.id}">${E(l.name)}</a></h4>
            <div class="line-meta">${NV.money(l.unitPrice)} / ${E(l.unit)}</div>
            <div class="row" style="margin-top:8px;gap:10px">
              <div class="qty">
                <button data-dec="${l.id}" aria-label="Decrease">−</button>
                <input type="number" value="${l.qty}" min="1" data-qty="${l.id}" aria-label="Quantity">
                <button data-inc="${l.id}" aria-label="Increase">+</button>
              </div>
              <button class="tiny" data-del="${l.id}" style="border:0;background:none;color:var(--muted);text-decoration:underline">Remove</button>
            </div>
          </div>
          <div style="text-align:right;font-weight:650;font-size:.875rem;white-space:nowrap;color:var(--green-900)">${NV.money(l.lineTotal)}</div>
        </div>`).join('');
      const t = NV.quote(lines);
      foot.innerHTML = `
        <div class="cart-total-row"><span>Subtotal</span><span>${NV.money(t.subtotal)}</span></div>
        ${t.savings > 0 ? `<div class="cart-total-row" style="color:var(--success)"><span>Volume savings</span><span>−${NV.money(t.savings)}</span></div>` : ''}
        <div class="cart-total-row"><span>Delivery</span><span>${t.delivery ? NV.money(t.delivery) : 'Free'}</span></div>
        <div class="cart-total-row"><span>VAT (16%)</span><span>${NV.money(t.vat)}</span></div>
        <div class="cart-total-row grand"><span>Estimated total</span><span>${NV.money(t.total)}</span></div>
        <div style="display:grid;gap:8px;margin-top:16px">
          <a href="/checkout.html" class="btn btn-gold btn-block">Proceed to checkout</a>
          <a href="/basket.html" class="btn btn-ghost btn-block btn-sm">Open order desk</a>
        </div>
        <p class="tiny muted" style="margin-top:10px">Pay by M-Pesa, bank transfer or card. A formal quotation follows confirmation.</p>`;

      body.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => NV.basket.add(b.dataset.inc, 1));
      body.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => NV.basket.setQty(b.dataset.dec, NV.basket.qtyOf(b.dataset.dec) - 1));
      body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { NV.basket.remove(b.dataset.del); renderCart(); NV.toast('Item removed from basket', { title: 'Basket updated' }); });
      body.querySelectorAll('[data-qty]').forEach(i => i.onchange = () => NV.basket.setQty(i.dataset.qty, parseInt(i.value, 10) || 1));
    }
  }

  /* ---------------- footer ---------------- */
  function buildFooter() {
    const mount = document.getElementById('nv-footer');
    if (!mount || mount.dataset.built === '1') return;
    mount.dataset.built = '1';
    mount.innerHTML = `
    <footer class="portal-footer">
      <div class="shell">
        <div class="footer-top">
          <div class="footer-brand">
            <img src="/img/logo-light.png" alt="Norvex Integrated Enterprises Ltd" width="196" height="66">
            <p>Moving what matters, delivering excellence. Dry commodities, institutional supplies and occupational safety for organisations across Kenya — quoted in under 24 hours.</p>
            <div class="footer-socials">
              <a href="#" aria-label="LinkedIn">${NV.icon('linkedin')}</a>
              <a href="#" aria-label="Facebook">${NV.icon('facebook')}</a>
              <a href="#" aria-label="Instagram">${NV.icon('instagram')}</a>
              <a href="https://wa.me/${NV.CONFIG.whatsapp}" aria-label="WhatsApp">${NV.icon('whatsapp')}</a>
            </div>
          </div>
          <div class="footer-col">
            <h4>Shop</h4>
            <a href="/shop.html?cat=food">Dry food commodities</a>
            <a href="/shop.html?cat=office">Office &amp; stationery</a>
            <a href="/shop.html?cat=safety">Safety &amp; PPE</a>
            <a href="/shop.html?cat=ict">ICT &amp; technology</a>
            <a href="/shop.html">Full catalogue</a>
          </div>
          <div class="footer-col">
            <h4>Company</h4>
            <a href="/about.html">About Norvex</a>
            <a href="/services.html">Services</a>
            <a href="/plan.html">Future orders</a>
            <a href="/contact.html">Contact</a>
            <a href="/quote.html">Request a quote</a>
          </div>
          <div class="footer-col">
            <h4>Order desk</h4>
            <a href="/basket.html">Supply basket</a>
            <a href="/checkout.html">Checkout</a>
            <a href="/orders.html">Order history</a>
            <a href="/account.html" data-auth="account-link">Account</a>
            <a href="/auth.html?mode=signin" class="drawer-auth" data-auth="drawer-link">Sign in / create account</a>
            <a href="/admin.html">Operations console</a>
          </div>
          <div class="footer-col">
            <h4>Talk to a buyer</h4>
            <p>${NV.CONFIG.location}</p>
            <a href="tel:${NV.CONFIG.phoneRaw}">${NV.CONFIG.phone}</a>
            <a href="mailto:${NV.CONFIG.email}">${NV.CONFIG.email}</a>
            <p class="tiny" style="color:#7f948b">${NV.CONFIG.hours}</p>
            <form class="newsletter" id="newsletterForm">
              <input type="email" placeholder="Email for tender alerts" aria-label="Email address" required>
              <button type="submit">Join</button>
            </form>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} Norvex Integrated Enterprises Ltd · Nairobi, Kenya</span>
          <div class="pay">
            <span>M-PESA</span><span>BANK TRANSFER</span><span>VISA · MASTERCARD</span><span>LPO · 30-DAY INVOICE</span>
            <a href="#" style="margin-left:8px">Privacy</a><a href="#" data-cookie-open>Cookies</a>
          </div>
        </div>
      </div>
    </footer>`;

    const form = document.getElementById('newsletterForm');
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      NV.toast('You are on the list. Tender and stock alerts will arrive at that address.', { title: 'Subscribed' });
      form.reset();
    });
  }

  window.NVPortal = {
    async init() {
      await buildHeader();
      buildFooter();
      window.NVCookies && NVCookies.mount();
      NV.reveal();
    }
  };
  document.addEventListener('DOMContentLoaded', () => window.NVPortal.init());
})();
