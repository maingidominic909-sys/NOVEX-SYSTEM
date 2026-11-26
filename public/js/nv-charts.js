/* =========================================================
   NORVEX CHARTS — dependency-free inline SVG
   line/area · bars · donut · funnel · sparkline · gauge
   Every chart is responsive (viewBox), accessible (role=img
   + aria-label) and animates once on entry.
   ========================================================= */
(function () {
  'use strict';
  const NV = window.NV;
  const E = NV.esc;

  const PALETTE = ['#17694a', '#c9a24a', '#2f5f8a', '#7d5ba6', '#b3261e', '#3f8f6b', '#a8761a', '#4b46a8'];
  const fmt = n => NV.compact ? NV.compact(n) : 'KES ' + n;
  const money = n => 'KES ' + Math.round(Number(n) || 0).toLocaleString('en-KE');
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  const uid = (() => { let i = 0; return () => 'c' + (++i); })();

  /* ---------------- area / line ---------------- */
  const registry = [];
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => registry.forEach(({ el, fn }) => { if (el.isConnected) fn(el); }), 160);
  }, { passive: true });

  function area(el, opts) {
    const o = Object.assign({ height: 240, series: [], labels: [], area: true, currency: true, yTicks: 4 }, opts);
    /* keep 1 SVG unit ≈ 1 CSS pixel so labels stay legible at any width */
    const cw = Math.max(260, Math.round(el.clientWidth || 640));
    const W = Math.min(760, cw);
    const H = cw < 460 ? Math.round(o.height * 0.82) : o.height;
    const pad = { t: 16, r: cw < 460 ? 8 : 18, b: 28, l: cw < 460 ? 44 : 66 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const all = o.series.flatMap(s => s.values);
    const max = Math.max(1, ...all) * 1.12;
    const n = o.labels.length;
    const X = i => pad.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
    const Y = v => pad.t + ih - (v / max) * ih;
    const id = uid();

    const grid = Array.from({ length: o.yTicks + 1 }).map((_, i) => {
      const v = (max * i) / o.yTicks;
      const y = Y(v);
      const tickLabel = o.currency ? (cw < 460 ? fmt(v).replace('KES ', '') : fmt(v)) : Math.round(v);
      return `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="#e8eae4" stroke-width="1"/>
        <text x="${pad.l - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#8a978f">${tickLabel}</text>`;
    }).join('');

    const paths = o.series.map((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
      const line = 'M' + pts.join(' L');
      const fill = o.area
        ? `<path d="${line} L${X(n - 1).toFixed(1)},${(pad.t + ih).toFixed(1)} L${X(0).toFixed(1)},${(pad.t + ih).toFixed(1)} Z" fill="url(#g${id}${si})" opacity="${si === 0 ? 1 : 0.55}"/>`
        : '';
      return `<defs><linearGradient id="g${id}${si}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="${si === 0 ? .28 : .16}"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient></defs>
        ${fill}
        <path d="${line}" fill="none" stroke="${color}" stroke-width="${si === 0 ? 2.6 : 2}" stroke-linecap="round" stroke-linejoin="round"
          stroke-dasharray="${si === 0 ? '' : '5 4'}" pathLength="1" class="chart-line"/>
        ${s.values.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${si === 0 ? 3.4 : 2.6}" fill="#fff" stroke="${color}" stroke-width="2"/>`).join('')}`;
    }).join('');

    /* keep x labels from colliding: walk right→left, 48px minimum gap */
    const every = cw < 400 ? 3 : cw < 520 ? 2 : 1;
    const keep = new Set([o.labels.length - 1]);
    let lastX = X(o.labels.length - 1);
    for (let i = o.labels.length - 2; i >= 0; i--) {
      if (i % every !== 0) continue;
      if (lastX - X(i) < 48) continue;
      keep.add(i); lastX = X(i);
    }
    const xlabels = o.labels.map((l, i) => {
      if (!keep.has(i)) return '';
      const last = i === o.labels.length - 1;
      const anchor = last ? 'end' : i === 0 ? 'start' : 'middle';
      return `<text x="${X(i).toFixed(1)}" y="${H - 7}" text-anchor="${anchor}" font-size="10" fill="#8a978f">${E(l)}</text>`;
    }).join('');

    if (!registry.some(r => r.el === el)) registry.push({ el, fn: x => area(x, o) });
    el.innerHTML = `<div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${E(o.title || 'Chart')}" style="width:100%;height:auto">
        ${grid}${paths}${xlabels}
      </svg>
      <div class="chart-legend">
        ${o.series.map((s, i) => `<span><i style="background:${s.color || PALETTE[i % PALETTE.length]}"></i>${E(s.name)}</span>`).join('')}
        <em class="chart-note">${E(o.note || '')}</em>
      </div>
    </div>`;
    el.querySelectorAll('.chart-line').forEach(pth => {
      const len = pth.getTotalLength ? pth.getTotalLength() : 0;
      if (!len) return;
      pth.style.strokeDasharray = len;
      pth.style.strokeDashoffset = len;
      pth.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)';
      requestAnimationFrame(() => { pth.style.strokeDashoffset = 0; });
    });
  }

  /* ---------------- horizontal bars ---------------- */
  function bars(el, opts) {
    const o = Object.assign({ items: [], currency: true, unit: '' }, opts);
    const max = Math.max(1, ...o.items.map(i => i.value));
    el.innerHTML = `<div class="chart-bars">
      ${o.items.map((it, i) => {
        const p = Math.max(2, Math.round((it.value / max) * 100));
        const color = it.color || PALETTE[i % PALETTE.length];
        return `<div class="cbar">
          <span class="cbar-label">${E(it.label)}</span>
          <span class="cbar-track"><span class="cbar-fill" style="width:0;background:${color}" data-w="${p}"></span></span>
          <span class="cbar-value">${o.currency ? money(it.value) : it.value + o.unit}</span>
        </div>`;
      }).join('')}
    </div>`;
    requestAnimationFrame(() => el.querySelectorAll('.cbar-fill').forEach(f => { f.style.width = f.dataset.w + '%'; }));
  }

  /* ---------------- donut ---------------- */
  function donut(el, opts) {
    const o = Object.assign({ items: [], size: 200, thickness: 24, currency: true }, opts);
    const total = o.items.reduce((s, i) => s + i.value, 0) || 1;
    const R = 50, C = 2 * Math.PI * R;
    let offset = 0;
    const segs = o.items.map((it, i) => {
      const frac = it.value / total;
      const len = frac * C;
      const seg = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${it.color || PALETTE[i % PALETTE.length]}"
        stroke-width="${o.thickness}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)" stroke-linecap="butt"/>`;
      offset += len;
      return seg;
    }).join('');
    el.innerHTML = `<div class="chart-donut">
      <svg viewBox="0 0 120 120" role="img" aria-label="${E(o.title || 'Breakdown')}">
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="#eef0ea" stroke-width="${o.thickness}"/>
        ${segs}
        <text x="60" y="57" text-anchor="middle" font-size="13" font-weight="700" fill="#072a1e">${o.currency ? fmt(total) : total}</text>
        <text x="60" y="71" text-anchor="middle" font-size="7.5" letter-spacing="1.4" fill="#8a978f">${E(o.centerLabel || 'TOTAL')}</text>
      </svg>
      <ul class="donut-legend">
        ${o.items.map((it, i) => `<li><i style="background:${it.color || PALETTE[i % PALETTE.length]}"></i>
          <span title="${E(it.label)}">${E(it.short || it.label)}</span>
          <b>${o.currency ? fmt(it.value) : it.value}<em>${Math.round((it.value / total) * 100)}%</em></b></li>`).join('')}
      </ul>
    </div>`;
  }

  /* ---------------- funnel ---------------- */
  function funnel(el, opts) {
    const o = Object.assign({ items: [] }, opts);
    const max = Math.max(1, ...o.items.map(i => i.value));
    el.innerHTML = `<div class="chart-funnel">
      ${o.items.map((it, i) => `
        <div class="fstep">
          <div class="fstep-head"><span>${E(it.label)}</span><b>${it.value}</b></div>
          <div class="fstep-track"><span class="fstep-fill" data-w="${Math.max(3, Math.round((it.value / max) * 100))}"
            style="background:linear-gradient(90deg, ${it.color || PALETTE[i % PALETTE.length]}, ${it.color2 || it.color || PALETTE[i % PALETTE.length]})"></span></div>
          ${i < o.items.length - 1
            ? `<small>${it.value ? Math.round((o.items[i + 1].value / it.value) * 100) : 0}% continue · ${Math.max(0, it.value - o.items[i + 1].value)} parked</small>`
            : `<small>${o.items[0].value ? Math.round((it.value / o.items[0].value) * 100) : 0}% of intake delivered</small>`}
        </div>`).join('')}
    </div>`;
    requestAnimationFrame(() => el.querySelectorAll('.fstep-fill').forEach(f => { f.style.width = f.dataset.w + '%'; }));
  }

  /* ---------------- sparkline ---------------- */
  function spark(values, opts) {
    const o = opts || {};
    const W = 120, H = 34, max = Math.max(...values, 1), min = Math.min(...values, 0);
    const span = max - min || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1 || 1)) * W},${H - ((v - min) / span) * (H - 4) - 2}`);
    const color = o.color || '#17694a';
    const d = 'M' + pts.join(' L');
    return `<svg viewBox="0 0 ${W} ${H}" class="spark" aria-hidden="true" preserveAspectRatio="none">
      <path d="${d} L${W},${H} L0,${H} Z" fill="${color}" opacity=".1"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }

  /* ---------------- gauge ---------------- */
  function gauge(el, opts) {
    const o = Object.assign({ value: 0, label: '', sub: '', color: '#17694a' }, opts);
    const v = Math.max(0, Math.min(100, o.value));
    const R = 46, C = Math.PI * R;
    const len = (v / 100) * C;
    el.innerHTML = `<div class="chart-gauge">
      <svg viewBox="0 0 120 70" role="img" aria-label="${E(o.label)} ${v}%">
        <path d="M14 60 A${R} ${R} 0 0 1 106 60" fill="none" stroke="#eef0ea" stroke-width="11" stroke-linecap="round"/>
        <path d="M14 60 A${R} ${R} 0 0 1 106 60" fill="none" stroke="${o.color}" stroke-width="11" stroke-linecap="round"
          stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}" style="transition:stroke-dasharray 1s cubic-bezier(.16,1,.3,1)"/>
        <text x="60" y="52" text-anchor="middle" font-size="17" font-weight="700" fill="#072a1e">${v}%</text>
      </svg>
      <b>${E(o.label)}</b><small>${E(o.sub)}</small>
    </div>`;
  }

  window.NVCharts = { area, bars, donut, funnel, spark, gauge, money, fmt, PALETTE };
})();
