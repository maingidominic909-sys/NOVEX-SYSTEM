/* NORVEX v2 — home page: moving offers, live ticker, deals, logistics */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;
  const $ = id => document.getElementById(id);
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const savePct = p => p.tiers.length > 1 ? Math.round((1 - p.tiers[p.tiers.length - 1][1] / p.tiers[0][1]) * 100) : 0;
  const popScore = p => (p.popular ? 2 : 0) + (p.featured ? 1 : 0);
  const leadDays = p => parseInt(p.lead, 10) || 99;

  document.addEventListener('DOMContentLoaded', async () => {
    /* ---------- hero search ---------- */
    const heroForm = $('heroSearch');
    if (heroForm) heroForm.addEventListener('submit', e => {
      e.preventDefault();
      const q = heroForm.querySelector('input').value.trim();
      location.href = '/shop.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });

    /* ---------- offer carousel (moving offers) ---------- */
    const carousel = $('offerCarousel');
    const track = $('ocTrack');
    if (carousel && track) {
      const slides = Array.from(track.children);
      const dotsMount = $('ocDots');
      const prog = $('ocProgress');
      const DUR = 6000;
      let idx = 0, timer = null, paused = false;

      const dots = slides.map((s, i) => {
        const b = document.createElement('button');
        b.className = 'oc-dot' + (i === 0 ? ' on' : '');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', 'Show offer ' + (i + 1));
        b.addEventListener('click', () => go(i));
        dotsMount.appendChild(b);
        return b;
      });

      const restartProgress = () => {
        if (!prog) return;
        prog.classList.remove('run');
        void prog.offsetWidth; /* restart the CSS animation */
        if (!paused && !reduceMotion) prog.classList.add('run');
      };
      const paint = () => {
        track.style.transform = 'translateX(-' + (idx * 100) + '%)';
        dots.forEach((d, i) => { d.classList.toggle('on', i === idx); d.setAttribute('aria-selected', String(i === idx)); });
        slides.forEach((s, i) => {
          s.setAttribute('aria-hidden', String(i !== idx));
          s.querySelectorAll('a,button').forEach(el => { el.tabIndex = i === idx ? 0 : -1; });
        });
        restartProgress();
      };
      const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
      const start = () => { stop(); if (!reduceMotion && !paused) timer = setInterval(() => { idx = (idx + 1) % slides.length; paint(); }, DUR); };
      const go = n => { idx = (n + slides.length) % slides.length; paint(); start(); };

      const prev = $('ocPrev'), next = $('ocNext');
      if (prev) { prev.innerHTML = NV.icon('arrowL'); prev.addEventListener('click', () => go(idx - 1)); }
      if (next) { next.innerHTML = NV.icon('arrowR'); next.addEventListener('click', () => go(idx + 1)); }

      carousel.addEventListener('pointerenter', () => { paused = true; stop(); if (prog) prog.style.animationPlayState = 'paused'; });
      carousel.addEventListener('pointerleave', () => { paused = false; if (prog) prog.style.animationPlayState = ''; paint(); start(); });
      carousel.addEventListener('focusin', () => { paused = true; stop(); });
      carousel.addEventListener('focusout', e => { if (!carousel.contains(e.relatedTarget)) { paused = false; paint(); start(); } });
      carousel.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      });
      document.addEventListener('visibilitychange', () => { document.hidden ? stop() : (paint(), start()); });

      /* touch swipe */
      let downX = null;
      track.addEventListener('pointerdown', e => { downX = e.clientX; });
      track.addEventListener('pointerup', e => {
        if (downX == null) return;
        const dx = e.clientX - downX; downX = null;
        if (Math.abs(dx) > 45) go(idx + (dx < 0 ? 1 : -1));
      });

      paint(); start();
    }

    /* ---------- track-an-order form ---------- */
    const trackForm = $('trackForm');
    if (trackForm) trackForm.addEventListener('submit', e => {
      e.preventDefault();
      const ref = trackForm.querySelector('input').value.trim();
      if (ref) location.href = '/order.html?ref=' + encodeURIComponent(ref);
    });

    /* ---------- fresh-from-the-desk feed (rotating updates) ---------- */
    const feedList = $('deskFeedList');
    if (feedList) {
      const FEED = [
        { ic: 'truck', badge: NV.ui.statusBadge('dispatched'), txt: 'NVX-2611-P2D77E dispatched — Nairobi West route', t: 'Today · 09:40' },
        { ic: 'grain', badge: '<span class="badge blue">Restock</span>', txt: 'Grade A rice 25kg back in stock — bulk tiers live', t: 'Today · 08:15' },
        { ic: 'chart', badge: '<span class="badge gold">Price watch</span>', txt: 'A4 paper drops at 50+ reams — tier 3 pricing', t: 'Yesterday' },
        { ic: 'check', badge: NV.ui.statusBadge('delivered'), txt: 'NVX-2611-K4F2A8 delivered and signed — 3 lines', t: 'Yesterday' },
        { ic: 'clipboard', badge: NV.ui.statusBadge('confirmed'), txt: 'Quotation ENQ-2611-Q7D21C issued by the desk', t: '2 days ago' },
        { ic: 'bolt', badge: '<span class="badge amber">Express</span>', txt: 'Order before 14:00 for next-morning Nairobi delivery', t: 'Daily' }
      ];
      let off = 0;
      const renderFeed = () => {
        const rows = [0, 1, 2].map(i => FEED[(off + i) % FEED.length]);
        feedList.innerHTML = rows.map(f => `
          <div class="df-item">${NV.icon(f.ic)}<span>${E(f.txt)}<small>${E(f.t)}</small></span>${f.badge}</div>`).join('');
      };
      renderFeed();
      if (!reduceMotion) setInterval(() => { off = (off + 1) % FEED.length; renderFeed(); }, 5000);
    }

    /* ---------- deals-of-the-week countdown ---------- */
    const cd = $('dealCountdown');
    if (cd) {
      const end = (() => {
        const t = new Date();
        t.setDate(t.getDate() + ((7 - t.getDay()) % 7));
        t.setHours(23, 59, 59, 999);
        if (t <= new Date()) t.setDate(t.getDate() + 7);
        return t;
      })();
      const pad = n => String(n).padStart(2, '0');
      const tick = () => {
        let ms = Math.max(0, end - Date.now());
        const d = Math.floor(ms / 864e5); ms -= d * 864e5;
        const h = Math.floor(ms / 36e5); ms -= h * 36e5;
        const m = Math.floor(ms / 6e4); ms -= m * 6e4;
        cd.textContent = `${d}d ${pad(h)}h ${pad(m)}m ${pad(Math.floor(ms / 1e3))}s`;
      };
      tick(); setInterval(tick, 1000);
    }

    const cat = await NV.catalog();
    const savers = cat.products.filter(p => p.tiers.length > 1).sort((a, b) => savePct(b) - savePct(a));

    /* ---------- live ticker (moving updates) ---------- */
    const tickerTrack = $('tickerTrack');
    if (tickerTrack) {
      const restocks = cat.products.filter(p => p.featured).slice(0, 3).map(p => p.name);
      const top = savers[0];
      const items = [
        ['truck', `Free Nairobi delivery on orders over <b>KES 150,000</b>`],
        ['bolt', `Express dispatch — Nairobi within <b>24 hours</b> (+KES 2,500)`],
        ['grain', `Restocked: <b>${E(restocks.join(' · '))}</b>`],
        ['chart', top ? `Bulk price watch: <b>${E(top.name)}</b> — save ${savePct(top)}% at volume` : 'Volume pricing on every line'],
        ['shield', 'Every order tracked live — received → confirmed → sourcing → dispatched → delivered'],
        ['receipt', 'LPO &amp; 30-day terms for approved institutions'],
        ['wallet', 'M-Pesa Paybill <b>4168290</b> · Equity <b>0170 2918 4473</b>']
      ];
      const half = items.map(([ic, txt]) => `<span class="lt-item">${NV.icon(ic)}<span>${txt}</span></span>`).join('');
      tickerTrack.innerHTML = `<div class="lt-half">${half}</div><div class="lt-half" aria-hidden="true">${half}</div>`;
    }

    /* ---------- deals rail ---------- */
    const rail = $('dealRail');
    if (rail) {
      rail.innerHTML = savers.slice(0, 8).map(p => `<div class="prail-item">${NV.ui.productCard(p, cat)}</div>`).join('');
      const scrollRail = dir => {
        const item = rail.querySelector('.prail-item');
        const step = item ? (item.getBoundingClientRect().width + 16) * 2 : 560;
        if (rail.scrollBy) rail.scrollBy({ left: dir * step, behavior: reduceMotion ? 'auto' : 'smooth' });
        else rail.scrollLeft += dir * step;
      };
      const dp = $('dealPrev'), dn = $('dealNext');
      if (dp) { dp.innerHTML = NV.icon('arrowL'); dp.addEventListener('click', () => scrollRail(-1)); }
      if (dn) { dn.innerHTML = NV.icon('arrowR'); dn.addEventListener('click', () => scrollRail(1)); }
    }

    /* ---------- departments ---------- */
    const deptMount = $('deptGrid');
    if (deptMount) {
      const count = id => cat.products.filter(p => p.cat === id).length;
      deptMount.innerHTML = cat.categories.map(c => `
        <a class="dept-card reveal" href="/shop.html?cat=${E(c.id)}">
          <span class="dc-img"><img src="${E(c.img || '/img/products/' + (c.id === 'institutional' ? 'school' : c.id) + '.jpg')}" alt="${E(c.name)}" loading="lazy"></span>
          <span class="dc-body">
            <span class="dc-ico">${NV.icon(c.icon || NV.catIcon(c.id))}</span>
            <span><b>${E(c.name)}</b><small>${count(c.id)} lines</small></span>
            <span class="dc-arrow">${NV.icon('arrowR')}</span>
          </span>
        </a>`).join('');
    }

    /* ---------- trending tabs + featured grid ---------- */
    const featMount = $('featuredGrid');
    const VIEWS = {
      popular: list => [...list].sort((a, b) => popScore(b) - popScore(a)),
      savers: list => [...list].sort((a, b) => savePct(b) - savePct(a)),
      fast: list => [...list].sort((a, b) => leadDays(a) - leadDays(b) || popScore(b) - popScore(a))
    };
    const renderTrend = name => {
      if (!featMount) return;
      featMount.innerHTML = (VIEWS[name] || VIEWS.popular)(cat.products).slice(0, 8).map(p => NV.ui.productCard(p, cat)).join('');
    };
    renderTrend('popular');
    const tabs = $('trendTabs');
    if (tabs) tabs.addEventListener('click', e => {
      const btn = e.target.closest('.ptab');
      if (!btn) return;
      tabs.querySelectorAll('.ptab').forEach(b => { b.classList.toggle('on', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
      renderTrend(btn.dataset.tab);
    });

    /* ---------- hero stats + volume-tier example ---------- */
    const lines = $('statLines'); if (lines) lines.textContent = cat.products.length + '+';
    const depts = $('statDepts'); if (depts) depts.textContent = String(cat.categories.length);
    const pctEl = $('ocSavePct'); if (pctEl && savers[0]) pctEl.textContent = savePct(savers[0]) + '%';
    const example = cat.products.find(p => p.cat === 'food' && p.tiers.length === 3) || savers[0];
    const tierName = $('ocTierName'), tierBody = $('ocTierBody');
    if (example && tierName && tierBody) {
      tierName.textContent = example.name + ' · ' + example.unit;
      tierBody.innerHTML = example.tiers.map(([q, price], i) =>
        `<tr><td>${q}+ · ${E(example.unit)}</td><td${i === example.tiers.length - 1 ? ' class="oc-free"' : ''}>${NV.money(price)}</td></tr>`).join('');
    }

    NV.reveal();
  });
})();
