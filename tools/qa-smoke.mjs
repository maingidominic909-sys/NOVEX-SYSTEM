/* NORVEX v2 QA — loads every page in jsdom, executes the real scripts against
   the running server, and simulates key user flows. Run: node tools/qa-smoke.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';

const BASE = 'http://localhost:3000';
const results = [];
let failures = 0;

/* page-script crashes inside async handlers surface as node-level events — record, don't crash */
let currentPage = '(boot)';
process.on('uncaughtException', e => { failures++; results.push(`FAIL  uncaught on ${currentPage} → ${e.message}`); });
process.on('unhandledRejection', e => { failures++; results.push(`FAIL  unhandled rejection on ${currentPage} → ${e && e.message || e}`); });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function loadPage(path, { seed = {}, wait = 1300 } = {}) {
  currentPage = path;
  const errors = [];
  const navs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const msg = String(e.message || e);
    if (msg.includes('Not implemented: navigation')) {
      const m = msg.match(/\(except hash changes\)\s*(.*)$/s);
      navs.push(msg);
      return;
    }
    if (msg.includes('Could not parse CSS stylesheet')) return; // modern CSS — fine in real browsers
    if (msg.includes('Not implemented: window.scrollTo')) return;
    errors.push(msg + (e.detail ? ` :: ${e.detail && e.detail.message || e.detail}` : ''));
  });
  const dom = await JSDOM.fromURL(BASE + path, {
    resources: 'usable',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (input, init) => fetch(new URL(typeof input === 'string' ? input : input.url, BASE), init);
      window.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = () => {};
      window.addEventListener('error', e => errors.push('window.onerror: ' + (e.error && e.error.stack || e.message)));
      for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  });
  await sleep(wait);
  return { dom, window: dom.window, doc: dom.window.document, errors, navs, close: () => dom.window.close() };
}

function check(name, cond, detail = '') {
  const ok = !!cond;
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? '  → ' + detail : ''}`);
  return ok;
}

const session = id => ({ 'norvex.session.v1': { userId: id, at: Date.now(), expires: Date.now() + 864e5 } });
const setInput = (window, el, value) => {
  el.value = value;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
};

const catalog = await (await fetch(BASE + '/api/catalog')).json();
const p1 = catalog.products[0], p2 = catalog.products[1];

/* ---------- 1. every page boots cleanly with shell + footer ---------- */
const pages = [
  ['/', 'home'], ['/shop.html', 'shop'], ['/product.html?id=' + p1.id, 'product'],
  ['/services.html', 'services'], ['/about.html', 'about'], ['/contact.html', 'contact'],
  ['/quote.html', 'quote'], ['/desk.html', 'desk'], ['/basket.html', 'basket'],
  ['/checkout.html', 'checkout'], ['/orders.html', 'orders'], ['/order.html', 'order'],
  ['/plan.html', 'plan'], ['/account.html', 'account'], ['/admin.html', 'admin'],
  ['/manage.html', 'manage'], ['/payment.html', 'payment'], ['/auth.html', 'auth'], ['/404.html', '404']
];
for (const [path, key] of pages) {
  const { doc, errors, close } = await loadPage(path);
  const shellOk = key === 'auth' ? !!doc.querySelector('.auth-shell')
    : (key === 'admin' || key === 'manage') ? !!doc.querySelector('.console-side')
    : !!doc.querySelector('.site-header .main-nav, .site-header .nav-burger');
  const footOk = (key === 'auth' || key === 'admin' || key === 'manage') ? true : !!doc.querySelector('.site-footer');
  check(`boot ${key}`, errors.length === 0, errors.slice(0, 2).join(' | '));
  check(`shell ${key}`, shellOk && footOk);
  close();
}

/* ---------- 2. home: add to basket ---------- */
{
  const { window, doc, errors, close } = await loadPage('/');
  const btn = doc.querySelector('[data-add]');
  const clicked = catalog.products.find(p => p.id === btn.dataset.add) || p1;
  btn.click();
  await sleep(400);
  check('home: add-to-basket updates count', window.NV.basket.count() >= clicked.moq, `count=${window.NV.basket.count()}`);
  check('home: departments rendered', doc.querySelectorAll('#deptGrid .dept-card').length === catalog.categories.length);
  check('home: featured rendered', doc.querySelectorAll('#featuredGrid .pcard').length >= 8);
  check('home: no errors after interaction', errors.length === 0, errors[0]);
  close();
}

/* ---------- 2b. home redesign: ticker, moving offers, deals, logistics ---------- */
{
  const { window, doc, errors, navs, close } = await loadPage('/');
  check('home: live ticker items', doc.querySelectorAll('#liveTicker .lt-item').length >= 7);
  check('home: ticker loop halves', doc.querySelectorAll('#liveTicker .lt-half').length === 2);
  check('home: offer carousel has 3 slides', doc.querySelectorAll('#ocTrack .oc-slide').length === 3);
  check('home: carousel dots built', doc.querySelectorAll('#ocDots .oc-dot').length === 3);
  doc.getElementById('ocNext').click();
  await sleep(60);
  check('home: carousel next advances', doc.getElementById('ocTrack').style.transform.includes('-100%'), doc.getElementById('ocTrack').style.transform);
  check('home: carousel dot follows slide', doc.querySelectorAll('#ocDots .oc-dot')[1].classList.contains('on'));
  doc.getElementById('ocPrev').click();
  await sleep(60);
  check('home: carousel prev returns', doc.getElementById('ocTrack').style.transform.includes('0%'), doc.getElementById('ocTrack').style.transform);
  check('home: deals rail rendered', doc.querySelectorAll('#dealRail .pcard').length >= 6);
  check('home: deal countdown ticking', /\d+d \d{2}h \d{2}m/.test(doc.getElementById('dealCountdown').textContent), doc.getElementById('dealCountdown').textContent);
  const saversTab = doc.querySelector('.ptab[data-tab="savers"]');
  saversTab.click();
  await sleep(60);
  check('home: trending tab switches', saversTab.classList.contains('on') && doc.querySelectorAll('#featuredGrid .pcard').length === 8);
  check('home: logistics milestones', doc.querySelectorAll('.route-steps .rs').length === 5);
  check('home: desk feed items', doc.querySelectorAll('#deskFeedList .df-item').length === 3);
  const restored = doc.querySelector('.hero-restore');
  check('home: classic hero restored below offers', !!restored && restored.querySelector('h1').textContent.includes('Reliable supply'));
  check('home: hero search + stats + ticket back', !!doc.getElementById('heroSearch') && doc.querySelectorAll('.hero-restore .hero-stats > div').length === 4 && !!doc.querySelector('.hero-restore .hero-ticket'));
  check('home: offers come before classic hero', doc.getElementById('offerCarousel').compareDocumentPosition(restored) & 4);
  check('home: departments are a scroll rail', !!doc.getElementById('deptNext') && !!doc.getElementById('deptPrev'));
  check('home: compact flow strip', doc.querySelectorAll('.flow-strip .fs-step').length === 4);
  check('home: quick module tiles', doc.querySelectorAll('.module-row .module-tile').length === 3);
  check('home: long marketing blocks removed', doc.querySelectorAll('.quote-card, .steps-grid, .service-card').length === 0);
  check('home: compact page (max 9 sections)', doc.querySelectorAll('#main > section').length <= 9, String(doc.querySelectorAll('#main > section').length));
  const tf = doc.getElementById('trackForm');
  tf.querySelector('input').value = 'NVX-2611-P2D77E';
  tf.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(80);
  check('home: track form navigates to order page', navs.length >= 1, navs.join('|'));
  check('home: redesign no errors', errors.length === 0, errors[0]);
  close();
}

/* ---------- 3. shop: search + filters ---------- */
{
  const { window, doc, errors, close } = await loadPage('/shop.html');
  check('shop: first page has 12 cards', doc.querySelectorAll('#shopGrid .pcard').length === 12);
  setInput(window, doc.getElementById('shopSearch'), 'rice');
  await sleep(600);
  const names = [...doc.querySelectorAll('#shopGrid .pc-name')].map(n => n.textContent.toLowerCase());
  check('shop: search narrows results', names.length > 0 && names.length < 12 && names.some(n => n.includes('rice')), names.join(','));
  const catBox = doc.querySelector('[data-cat="safety"]');
  catBox.checked = true;
  catBox.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(300);
  check('shop: department filter works', doc.getElementById('shopTitle').textContent.includes('Safety'));
  check('shop: no errors', errors.length === 0, errors[0]);
  close();
}

/* ---------- 4. product: live tier pricing ---------- */
{
  const { window, doc, errors, close } = await loadPage('/product.html?id=' + p1.id);
  const price = () => doc.getElementById('unitPrice').textContent;
  check('product: MOQ default price', price() === 'KES ' + p1.tiers[0][1].toLocaleString('en-KE'), price());
  const target = p1.tiers[1][0];
  for (let i = 0; i < target - p1.moq; i++) doc.getElementById('qtyPlus').click();
  check('product: tier 2 price after qty ' + target, price() === 'KES ' + p1.tiers[1][1].toLocaleString('en-KE'), price());
  check('product: tier row highlighted', doc.querySelectorAll('#tierTable tr.tier-on').length === 1);
  check('product: related lines', doc.querySelectorAll('#relatedGrid .pcard').length > 0);
  check('product: no errors', errors.length === 0, errors[0]);
  close();
}

/* ---------- 5. auth: modern panel, demo sign-in, compact signup, recovery ---------- */
{
  const { window, doc, errors, navs, close } = await loadPage('/auth.html?mode=signin');
  check('auth: compact visual, no big animation', doc.querySelectorAll('.auth-photo').length === 1 && !doc.getElementById('authAnim') && !doc.getElementById('animToggle') && !!doc.querySelector('.auth-visual-status'));
  check('auth: login motion present', !!doc.querySelector('.auth-drive .ad-truck') && !!doc.querySelector('.auth-drive .ad-van'));
  check('auth: compact sign-in fields', !!doc.querySelector('[name="identifier"]') && !!doc.querySelector('[name="password"]') && !doc.querySelector('[name="organisation"]'));
  check('auth: demo picker present', doc.querySelectorAll('[data-demo]').length === 2);
  doc.querySelector('[data-demo="customer"]').click();
  check('auth: demo fill', doc.querySelector('[name="identifier"]').value === 'demo@norvex.co.ke');
  doc.getElementById('authForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(1800);
  check('auth: success state', doc.getElementById('authSuccess').classList.contains('show'));
  check('auth: signed in', window.NV.auth.isIn() && window.NV.auth.current().email === 'demo@norvex.co.ke');
  check('auth: redirect attempted', navs.some(n => n.includes('desk.html') || n.includes('navigation to another Document')), navs.join('|'));
  check('auth: no errors', errors.length === 0, errors[0]);
  close();

  const { window: w2, doc: d2, errors: e2, close: c2 } = await loadPage('/auth.html?mode=signup');
  check('auth: signup uses name/email/password only', !!d2.querySelector('[name="name"]') && !!d2.querySelector('[name="email"]') && !!d2.querySelector('[name="password"]') && !d2.querySelector('[name="organisation"]') && !d2.querySelector('[name="phone"]') && !d2.querySelector('[name="username"]') && !d2.querySelector('[name="confirm"]'));
  d2.getElementById('authForm').dispatchEvent(new w2.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(300);
  check('auth: signup validates empty fields', d2.querySelectorAll('.auth-field.bad').length >= 3);
  setInput(w2, d2.querySelector('[name="name"]'), 'QA New Buyer');
  setInput(w2, d2.querySelector('[name="email"]'), 'qa.newbuyer@example.com');
  setInput(w2, d2.querySelector('[name="password"]'), 'Norvex2026');
  d2.getElementById('termsCheck').checked = true;
  d2.getElementById('authForm').dispatchEvent(new w2.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(700);
  check('auth: compact signup creates account', w2.NV.auth.isIn() && w2.NV.auth.current().email === 'qa.newbuyer@example.com');
  check('auth: profile details optional', w2.NV.auth.current().organisation === '' && w2.NV.auth.current().phone === '' && !!w2.NV.auth.current().username);
  check('auth: signup success offers next steps', d2.querySelectorAll('#authSuccess [data-success-go]').length === 2);
  check('auth: signup no errors', e2.length === 0, e2[0]);
  c2();

  const r = await loadPage('/auth.html?mode=signin');
  r.doc.getElementById('forgotBtn').click();
  await sleep(120);
  check('auth: recovery dialog opens', r.doc.getElementById('resetDialog').open || r.doc.getElementById('resetDialog').hasAttribute('open'));
  setInput(r.window, r.doc.getElementById('resetEmail'), 'demo@norvex.co.ke');
  setInput(r.window, r.doc.getElementById('resetPassword'), 'Recovered2026');
  r.doc.getElementById('resetForm').dispatchEvent(new r.window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(500);
  const signInRes = await r.window.NV.auth.signIn('demo@norvex.co.ke', 'Recovered2026');
  check('auth: device-local password reset works', signInRes.ok === true, signInRes.error || '');
  check('auth: recovery no errors', r.errors.length === 0, r.errors[0]);
  r.close();
}

/* ---------- 6. basket: steppers + summary ---------- */
{
  const seed = { 'norvex.basket.v1': [{ id: p1.id, qty: p1.tiers[1][0] }] };
  const { window, doc, errors, close } = await loadPage('/basket.html', { seed });
  check('basket: line rendered', doc.querySelectorAll('#basketLines .bline').length === 1);
  const before = doc.querySelector('.bl-total').textContent;
  doc.querySelector('#basketLines [data-step="1"]').click();
  await sleep(400);
  const after = doc.querySelector('.bl-total').textContent;
  check('basket: stepper updates total', before !== after, `${before} → ${after}`);
  check('basket: summary total present', /KES/.test(doc.querySelector('.sum-total b').textContent));
  check('basket: no errors', errors.length === 0, errors[0]);
  close();
}

/* ---------- 7. checkout: full 3-step flow → real order ---------- */
let createdRef = '';
{
  const seed = {
    ...session('usr_demo'),
    'norvex.basket.v1': [{ id: p1.id, qty: 10 }, { id: p2.id, qty: 10 }]
  };
  const { window, doc, errors, close } = await loadPage('/checkout.html', { seed, wait: 1500 });
  check('checkout: prefilled from account', doc.querySelector('[name="organisation"]').value.length > 0);
  doc.getElementById('next1').click();
  await sleep(200);
  check('checkout: step 2 shown', doc.querySelector('.co-panel[data-panel="2"]').classList.contains('on'));
  setInput(window, doc.querySelector('[name="address"]'), 'QA House, Test Road');
  const express = doc.querySelector('input[name="deliveryMethod"][value="Express delivery"]');
  express.checked = true;
  express.dispatchEvent(new window.Event('change', { bubbles: true }));
  doc.getElementById('next2').click();
  await sleep(200);
  check('checkout: review shows lines', doc.querySelectorAll('#reviewBlocks tbody tr').length === 2);
  doc.getElementById('placeBtn').click();
  await sleep(1600);
  const success = !doc.getElementById('checkoutSuccess').classList.contains('hide');
  check('checkout: order placed', success, errors[0]);
  const refEl = doc.querySelector('#checkoutSuccess .ref-chip');
  createdRef = refEl ? refEl.textContent.trim().split(/\s/)[0] : '';
  check('checkout: reference issued', /^NVX-/.test(createdRef), createdRef);
  check('checkout: proceeds to payment', !!doc.querySelector('#checkoutSuccess a[href^="/payment.html"]'));
  check('checkout: basket cleared', window.NV.basket.count() === 0);
  check('checkout: no errors', errors.length === 0, errors.slice(0, 2).join('|'));
  close();
  const remote = await (await fetch(BASE + '/api/orders?email=demo@norvex.co.ke')).json();
  const serverOrder = (remote.orders || []).find(o => o.ref === createdRef);
  check('checkout: order exists server-side', !!serverOrder);
  const expectedFee = serverOrder ? (serverOrder.totals.subtotal >= 150000 ? 0 : 4500) + 2500 : -1;
  check('checkout: express fee server-side', serverOrder && serverOrder.totals.delivery === expectedFee, serverOrder && `${serverOrder.totals.delivery} vs ${expectedFee}`);
}

/* ---------- 8. orders + order tracking ---------- */
{
  const { doc, errors, close } = await loadPage('/orders.html', { seed: session('usr_demo') });
  check('orders: history lists the new order', doc.body.textContent.includes(createdRef));
  check('orders: KPIs rendered', doc.querySelectorAll('.kpi').length === 3);
  check('orders: no errors', errors.length === 0, errors[0]);
  close();
  const t = await loadPage('/order.html?ref=' + createdRef);
  check('order: timeline rendered', t.doc.querySelectorAll('.tl-step').length === 5);
  check('order: items table', t.doc.querySelectorAll('.table tbody tr').length === 2);
  check('order: no errors', t.errors.length === 0, t.errors[0]);
  t.close();
}

/* ---------- 9. admin: guard + console + status advance ---------- */
{
  const g = await loadPage('/admin.html');
  check('admin: guest sees guard', g.doc.body.textContent.includes('Administrator sign-in required'));
  g.close();
  const { window, doc, errors, close } = await loadPage('/admin.html', { seed: session('usr_admin'), wait: 1600 });
  check('admin: KPI tiles', doc.querySelectorAll('.kpi').length === 6);
  check('admin: pipeline rows', doc.querySelectorAll('[data-status-ref]').length > 0);
  const sel = doc.querySelector(`[data-status-ref="${createdRef}"]`);
  if (sel) {
    sel.value = 'confirmed';
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    await sleep(900);
    const o = await (await fetch(BASE + '/api/orders/' + createdRef)).json();
    check('admin: status advance persisted', o.order.status === 'confirmed', o.order.status);
  } else check('admin: pipeline contains new order', false, createdRef);
  check('admin: no errors', errors.length === 0, errors.slice(0, 2).join('|'));
  close();
}

/* ---------- 10. manage: render + add product ---------- */
{
  const { window, doc, errors, close } = await loadPage('/manage.html', { seed: session('usr_admin'), wait: 1600 });
  const rowsBefore = doc.querySelectorAll('#manageBody tbody tr').length;
  check('manage: product table', rowsBefore >= catalog.products.length);
  doc.getElementById('addProduct').click();
  await sleep(200);
  const modal = doc.getElementById('manageModal');
  setInput(window, modal.querySelector('[name="name"]'), 'QA Test Widget');
  setInput(window, modal.querySelector('[name="unit"]'), 'box of 10');
  modal.querySelector('#saveProduct').click();
  await sleep(900);
  check('manage: product added', doc.body.textContent.includes('QA Test Widget'), errors[0]);
  check('manage: no errors', errors.length === 0, errors.slice(0, 2).join('|'));
  close();
}

/* ---------- 11. quote desk flow ---------- */
{
  const { window, doc, errors, close } = await loadPage('/quote.html');
  const sel = doc.querySelector('[data-line-id]');
  setInput(window, sel, p1.id);
  await sleep(200);
  setInput(window, doc.querySelector('[data-line-qty]'), '40');
  await sleep(200);
  ['name', 'organisation', 'email', 'phone'].forEach(n => setInput(window, doc.querySelector(`#quoteContact [name="${n}"]`), n === 'email' ? 'qa@norvex.co.ke' : n === 'phone' ? '0712345678' : 'QA ' + n));
  doc.getElementById('sendQuote').click();
  await sleep(1200);
  check('quote: RFQ submitted', /ENQ-/.test(doc.getElementById('quoteMain').textContent));
  check('quote: no errors', errors.length === 0, errors[0]);
  close();
}

/* ---------- 12. future planner flow ---------- */
{
  const { window, doc, errors, close } = await loadPage('/plan.html');
  setInput(window, doc.querySelector('[data-item-id]'), p1.id);
  ['name', 'organisation', 'email'].forEach(n => setInput(window, doc.querySelector(`#planForm [name="${n}"]`), n === 'email' ? 'qa@norvex.co.ke' : 'QA ' + n));
  setInput(window, doc.querySelector('#planForm [name="deliveryDate"]'), '2026-12-15');
  setInput(window, doc.querySelector('#planForm [name="deliveryLocation"]'), 'QA Depot, Nairobi');
  doc.getElementById('sendPlan').click();
  await sleep(1200);
  check('plan: reserved', /FO-/.test(doc.getElementById('planDone').textContent));
  check('plan: no errors', errors.length === 0, errors[0]);
  close();
}

/* ---------- 13. contact + account ---------- */
{
  const { window, doc, errors, close } = await loadPage('/contact.html');
  setInput(window, doc.querySelector('#contactForm [name="name"]'), 'QA Visitor');
  setInput(window, doc.querySelector('#contactForm [name="email"]'), 'qa@norvex.co.ke');
  setInput(window, doc.querySelector('#contactForm [name="message"]'), 'This is a smoke-test message over ten chars.');
  doc.getElementById('contactForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(1000);
  check('contact: message sent', doc.getElementById('contactFormCard').textContent.includes('Message received'));
  check('contact: no errors', errors.length === 0, errors[0]);
  close();

  const a = await loadPage('/account.html', { seed: session('usr_demo'), wait: 1500 });
  check('account: profile rendered', !!a.doc.getElementById('profileForm'));
  setInput(a.window, a.doc.querySelector('#profileForm [name="organisation"]'), 'QA Updated Org');
  a.doc.getElementById('profileForm').dispatchEvent(new a.window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(400);
  check('account: profile update works', a.window.NV.auth.current().organisation === 'QA Updated Org');
  check('account: vertical layout', !!a.doc.querySelector('.account-stack') && !a.doc.querySelector('.account-grid'));
  check('account: 20 avatar options', a.doc.querySelectorAll('.av-opt').length === 20);
  const avBtn = a.doc.querySelector('.av-opt');
  const avChoice = avBtn.dataset.av;
  avBtn.click();
  await sleep(250);
  check('account: avatar change persists', a.window.NV.auth.current().avatar === avChoice, a.window.NV.auth.current().avatar);
  check('account: no errors', a.errors.length === 0, a.errors[0]);
  a.close();
}

/* ---------- 14. phone navigation: bottom bar, badges, drawers, checkout bar ---------- */
{
  const { window, doc, errors, close } = await loadPage('/');
  check('top: util bar removed', !doc.querySelector('.util-bar'));
  const fi = doc.querySelector('.footer-info');
  check('top: hours + free delivery moved to footer', !!fi && /Free/.test(fi.textContent) && /8:00am/.test(fi.textContent));
  check('app: theme-color meta present', !!doc.querySelector('meta[name="theme-color"]'));
  check('app: back button present', !!doc.getElementById('navBack'));
  const bar = doc.getElementById('bottomBar');
  check('phone: floating pill present', !!bar);
  check('phone: six tabs', bar && bar.querySelectorAll('.btab').length === 6);
  check('phone: home tab active', bar && bar.querySelector('.btab.active span') && bar.querySelector('.btab.active span').textContent === 'Home');
  const badge = bar && bar.querySelector('.bcount');
  check('phone: badge hidden at zero', badge && badge.dataset.zero === '1');
  doc.querySelector('[data-add]').click();
  await sleep(400);
  check('phone: badge live-updates', badge && badge.textContent === String(window.NV.basket.count()) && badge.dataset.zero === '0', badge && badge.textContent);
  check('phone: menu tab present', !!doc.getElementById('bMenu'));
  check('phone: pay tab present', !!doc.getElementById('bPay'));
  check('phone: header account icon', !!doc.getElementById('acctBtn'));
  doc.getElementById('appSearch').click();
  await sleep(120);
  check('phone: app search bar opens overlay', doc.getElementById('searchOverlay').classList.contains('open'));
  window.NV.shell.closeAll();
  doc.getElementById('bSearch').click();
  await sleep(150);
  check('phone: bottom search opens overlay', doc.getElementById('searchOverlay').classList.contains('open'));
  window.NV.shell.closeAll();
  doc.getElementById('bCats').click();
  await sleep(150);
  check('phone: categories opens sheet', doc.getElementById('catSheet').classList.contains('open'));
  check('phone: categories sheet has departments', doc.querySelectorAll('#catGrid .cat-tile').length === catalog.categories.length);
  window.NV.shell.closeAll();
  doc.getElementById('bMenu').click();
  await sleep(150);
  check('phone: main menu opens drawer', doc.getElementById('menuDrawer').classList.contains('open'));
  check('phone: menu has departments', doc.querySelectorAll('#menuBody .mnav-depts a').length === catalog.categories.length);
  check('track: moved into menu drawer', !!doc.querySelector('#menuBody a[href="/order.html"]'));
  check('track: present in footer', !!doc.querySelector('.site-footer a[href="/order.html"]'));
  check('phone: no errors', errors.length === 0, errors[0]);
  close();

  const shop = await loadPage('/shop.html');
  check('phone: categories tab active on catalogue', shop.doc.querySelector('#bottomBar .btab.active span').textContent === 'Categories');
  shop.close();
}
{
  const seed = { 'norvex.basket.v1': [{ id: p1.id, qty: 10 }] };
  const { window, doc, errors, close } = await loadPage('/basket.html', { seed });
  const bar = doc.getElementById('checkoutBar');
  check('phone: sticky checkout bar on basket', !!bar);
  check('phone: checkout bar shows total', bar && /KES/.test(bar.textContent));
  check('phone: body flagged for bar clearance', doc.body.classList.contains('has-checkoutbar'));
  check('phone: basket tab active', doc.querySelector('#bottomBar .btab.active span:not(.bcount)').textContent === 'Basket');
  doc.querySelector('#basketLines [data-remove]').click();
  await sleep(400);
  check('phone: checkout bar removed when empty', !doc.getElementById('checkoutBar') && !doc.body.classList.contains('has-checkoutbar'));
  check('phone: basket no errors', errors.length === 0, errors[0]);
  close();
}

/* ---------- 15. desktop collapsible side navigation ---------- */
{
  const { window, doc, errors, close } = await loadPage('/');
  const sn = doc.getElementById('sideNav');
  check('sidenav: present on desktop shell', !!sn && doc.body.classList.contains('has-sidenav'));
  check('sidenav: icon + label links', sn.querySelectorAll('.sn-link').length >= 15 && sn.querySelectorAll('.sn-link .sn-ico svg').length === sn.querySelectorAll('.sn-link').length);
  check('sidenav: browse + workspace sections', sn.querySelectorAll('.sn-label').length >= 2 && !!sn.querySelector('.sn-link[href="/shop.html"]') && !!sn.querySelector('.sn-link[href="/desk.html"]'));
  const toggle = doc.getElementById('snCollapse');
  toggle.click();
  check('sidenav: collapses to icons', doc.body.classList.contains('sn-collapsed') && window.localStorage.getItem('norvex.sidenav.v1') === '1' && toggle.getAttribute('aria-expanded') === 'false');
  toggle.click();
  check('sidenav: expands again', !doc.body.classList.contains('sn-collapsed') && window.localStorage.getItem('norvex.sidenav.v1') === '0');
  doc.querySelector('[data-add]').click();
  await sleep(400);
  const snCount = sn.querySelector('.sn-count');
  check('sidenav: live basket badge', snCount && snCount.textContent === String(window.NV.basket.count()));
  check('sidenav: no errors', errors.length === 0, errors[0]);
  close();

  const admin = await loadPage('/', { seed: session('usr_admin'), wait: 1400 });
  check('sidenav: admin links for admin', !!admin.doc.querySelector('#sideNav .sn-link[href="/admin.html"]') && !!admin.doc.querySelector('#sideNav .sn-link[href="/manage.html"]'));
  check('sidenav: admin no errors', admin.errors.length === 0, admin.errors[0]);
  admin.close();
}

/* ---------- 16. admin operations console (distinct from client) ---------- */
{
  const c = await loadPage('/admin.html', { seed: session('usr_admin'), wait: 1800 });
  check('console: distinct admin chrome', !!c.doc.querySelector('.console-side') && !c.doc.getElementById('bottomBar') && !c.doc.querySelector('.site-header'));
  check('console: admin nav sections', c.doc.querySelectorAll('.console-side .cs-link').length >= 6 && !!c.doc.querySelector('.cs-link[href="/manage.html"]'));
  check('console: control panels present', !!c.doc.getElementById('orders') && !!c.doc.getElementById('enquiries') && !!c.doc.getElementById('plans') && !!c.doc.getElementById('payments'));
  check('console: enquiry control buttons', c.doc.querySelectorAll('[data-enq-resolve], [data-enq-reopen]').length > 0);
  check('console: no errors', c.errors.length === 0, c.errors[0]);
  c.close();
}

/* ---------- 17. payments page: methods + M-Pesa flow ---------- */
{
  const p = await loadPage('/payment.html');
  check('payment: four method cards', p.doc.querySelectorAll('.pay-method').length === 4);
  check('payment: modern method icons', p.doc.querySelectorAll('.pay-method .pm-ico svg').length === 4);
  check('payment: mpesa panel default', !!p.doc.getElementById('mpesaForm'));
  p.doc.querySelector('[data-method="card"]').click();
  await sleep(80);
  check('payment: card panel switches', !!p.doc.getElementById('cardForm'));
  p.doc.querySelector('[data-method="bank"]').click();
  await sleep(80);
  check('payment: bank panel shows details', !!p.doc.getElementById('bankForm') && /Equity/.test(p.doc.getElementById('payPanel').textContent));
  p.doc.querySelector('[data-method="mpesa"]').click();
  await sleep(80);
  setInput(p.window, p.doc.querySelector('#mpesaForm [name="phone"]'), '0722000000');
  setInput(p.window, p.doc.querySelector('#mpesaForm [name="amount"]'), '25000');
  p.doc.getElementById('mpesaForm').dispatchEvent(new p.window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(700);
  check('payment: mpesa prompt success', !!p.doc.querySelector('.pay-success') && /prompt sent/i.test(p.doc.getElementById('payPanel').textContent));
  check('payment: no errors', p.errors.length === 0, p.errors[0]);
  p.close();
}

console.log(results.join('\n'));
console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} checks passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
