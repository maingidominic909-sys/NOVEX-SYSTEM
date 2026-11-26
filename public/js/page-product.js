/* Product detail page */
(function () {
  const NV = window.NV;

  async function init() {
    const cat = await NV.catalog();
    const id = NV.queryString().get('id') || cat.products[0].id;
    const p = cat.products.find(x => x.id === id);
    const wrap = document.getElementById('pdp');

    if (!p) {
      wrap.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <h2>Catalogue line not found</h2>
        <p class="muted">That reference may have been retired. Browse the catalogue for the current range.</p>
        <a href="/shop.html" class="btn btn-gold">Back to catalogue</a></div>`;
      document.getElementById('related').innerHTML = '';
      return;
    }

    const category = cat.categories.find(c => c.id === p.cat) || { name: p.cat, id: p.cat };
    document.title = `${p.name} — ${NV.CONFIG.name}`;
    let qty = Math.max(1, p.moq);

    /* breadcrumb */
    const crumbs = document.getElementById('crumbs');
    crumbs.innerHTML = `
      <a href="/index.html">Home</a><span class="sep">/</span>
      <a href="/shop.html">Catalogue</a><span class="sep">/</span>
      <a href="/shop.html?cat=${p.cat}">${NV.esc(category.name)}</a><span class="sep">/</span>
      <span class="current" style="color:var(--gold-600)">${NV.esc(p.name)}</span>`;

    /* main layout */
    wrap.innerHTML = `
      <div class="pdp-media">
        ${NV.ui.mediaFor(NV.ui.imgName(p), { alt: p.name, sizes: '(max-width:1020px) 92vw, 620px', eager: true })}
        ${p.featured ? `<span class="pill pill-gold" style="position:absolute;top:18px;left:18px;z-index:2">Contract pick</span>` : ''}
        <span class="pdp-media-badge">${NV.icon(NV.catIcon(p.cat))} ${NV.esc(category.name)}</span>
      </div>

      <div>
        <p class="eyebrow">${NV.esc(category.name)} · ${NV.esc(p.id.toUpperCase())}</p>
        <h1>${NV.esc(p.name)}</h1>
        <p class="lede" style="font-size:1rem">${NV.esc(p.desc)}</p>

        <div class="pdp-price">
          <span class="amt" id="livePrice">${NV.money(p.tiers[0][1])}</span>
          <span class="muted small">per ${NV.esc(p.unit)}</span>
          <span class="pill" id="discPill" style="display:none"></span>
        </div>
        <p class="small muted" id="tierHint">MOQ ${p.moq} ${NV.esc(p.unit)}s · volume breaks apply automatically</p>

        <div class="pdp-buy">
          <div class="qty">
            <button id="qDec" aria-label="Decrease quantity">−</button>
            <input id="qInput" type="number" value="${qty}" min="${p.moq}" aria-label="Quantity">
            <button id="qInc" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-gold" id="addBtn" style="flex:1;min-width:190px">${NV.icon('cart')} Add to supply basket</button>
          <a class="btn btn-ghost" href="/quote.html?item=${p.id}" title="Request a quotation">Quote</a>
        </div>
        <div class="pdp-meta-row">
          <span>${NV.icon('truck')} Dispatch in ${NV.esc(p.lead)}</span>
          <span>${NV.icon('shield')} Specification checked on receipt</span>
          <a href="https://wa.me/${NV.CONFIG.whatsapp}?text=${encodeURIComponent('Hello Norvex, I would like a quote for ' + p.name)}" target="_blank" rel="noopener">${NV.icon('whatsapp')} Ask on WhatsApp</a>
        </div>

        <table class="tier-table" id="tierTable">
          <thead><tr><th>Quantity (${NV.esc(p.unit)}s)</th><th>Unit price</th><th>You save</th></tr></thead>
          <tbody>
            ${p.tiers.map((t, i) => {
              const next = p.tiers[i + 1];
              const range = next ? `${t[0]} – ${next[0] - 1}` : `${t[0]}+`;
              const disc = i === 0 ? '—' : `−${Math.round((1 - t[1] / p.tiers[0][1]) * 100)}%`;
              return `<tr data-min="${t[0]}" data-max="${next ? next[0] - 1 : 999999}">
                <td>${range}</td><td>${NV.money(t[1])}</td><td style="color:var(--success)">${disc}</td></tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="pdp-meta">
          <div><span>Reference</span><strong>${NV.esc(p.id.toUpperCase())}</strong></div>
          <div><span>Sold per</span><strong>${NV.esc(p.unit)}</strong></div>
          <div><span>Minimum order</span><strong>${p.moq} ${NV.esc(p.unit)}s</strong></div>
          <div><span>Lead time</span><strong>${NV.esc(p.lead)}</strong></div>
          <div><span>Availability</span><strong style="color:var(--success)">In supply · Nairobi hub</strong></div>
        </div>

        <div class="accordion" style="margin-top:26px">
          <details open>
            <summary>What's included in the price</summary>
            <div class="body">Unit price covers sourcing, quality check and packaging against your specification. Delivery is quoted separately by zone (free above KES 150,000). VAT at 16% is added at checkout where applicable.</div>
          </details>
          <details>
            <summary>Can I order less than the minimum?</summary>
            <div class="body">For smaller requirements, send a request through the quote desk — we consolidate smaller orders in the same department to keep MOQs workable.</div>
          </details>
          <details>
            <summary>Do you support tenders &amp; framework agreements?</summary>
            <div class="body">Yes. We issue formal quotations, pro-forma invoices, delivery notes and completion certificates for tender submissions. Fixed pricing can be held for 3–12 months on framework agreements.</div>
          </details>
        </div>
      </div>`;

    /* tabs content */
    const tabs = {
      overview: `<h3 style="font-size:1.15rem">About this line</h3>
        <p class="muted">${NV.esc(p.desc)} Supplied from vetted sources with a documented specification before dispatch. Brands and pack presentation may vary by supply cycle, but specification and quantity are guaranteed against your order.</p>
        <p class="muted">Suitable for ${NV.esc(category.name.toLowerCase())} requirements across schools, hospitals, offices, NGOs and county programmes. Bulk buyers can request pre-shipment samples.</p>`,
      spec: `<h3 style="font-size:1.15rem">Specification &amp; delivery</h3>
        <div class="pdp-meta" style="background:#fff;margin:14px 0">
          <div><span>Pack / unit</span><strong>${NV.esc(p.unit)}</strong></div>
          <div><span>Minimum order</span><strong>${p.moq} units</strong></div>
          <div><span>Dispatch window</span><strong>${NV.esc(p.lead)}</strong></div>
          <div><span>Delivery zones</span><strong>Nairobi Metro · upcountry via courier</strong></div>
          <div><span>Documentation</span><strong>Quotation · delivery note · invoice</strong></div>
        </div>
        <p class="muted">Deliveries are scheduled within the confirmed dispatch window. Upcountry consignments travel by contracted courier with tracking shared on the order record.</p>`,
      procurement: `<h3 style="font-size:1.15rem">Procurement notes</h3>
        <p class="muted">For tender or LPO-based purchasing, submit your specification through <a href="/quote.html" style="color:var(--green-700);text-decoration:underline">the quote desk</a>. We'll return a formal quotation with validity period, payment terms and delivery commitments.</p>
        <p class="muted">Payment options: M-Pesa Paybill, bank transfer, 30-day invoice on approved accounts, and cash on delivery within Nairobi Metro.</p>`
    };
    document.getElementById('tabBody').innerHTML = `<div class="card card-pad">${tabs.overview}</div>`;
    document.querySelectorAll('.tabs button').forEach(btn => btn.onclick = () => {
      document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b === btn));
      document.getElementById('tabBody').innerHTML = `<div class="card card-pad">${tabs[btn.dataset.tab]}</div>`;
    });

    /* related */
    const related = cat.products.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
    const relGrid = document.getElementById('related');
    relGrid.innerHTML = related.length
      ? related.map(x => NV.ui.productCard(x, category.name)).join('')
      : cat.products.filter(x => x.id !== p.id).slice(0, 4).map(x => NV.ui.productCard(x, (cat.categories.find(c => c.id === x.cat) || {}).name)).join('');
    NV.ui.bindCards(relGrid);

    /* quantity + pricing interaction */
    const priceEl = document.getElementById('livePrice');
    const pill = document.getElementById('discPill');
    const hint = document.getElementById('tierHint');
    const input = document.getElementById('qInput');

    const paint = () => {
      const price = NV.tierPrice(p, qty);
      priceEl.textContent = NV.money(price);
      const pct = Math.round((1 - price / p.tiers[0][1]) * 100);
      pill.style.display = pct > 0 ? 'inline-flex' : 'none';
      pill.textContent = `Save ${pct}%`;
      hint.textContent = qty >= p.moq
        ? `${qty} × ${p.unit} = ${NV.money(price * qty)} · dispatch in ${p.lead}`
        : `Minimum order is ${p.moq} ${p.unit}s — increase quantity to continue`;
      document.querySelectorAll('#tierTable tbody tr').forEach(tr => {
        tr.classList.toggle('on', qty >= Number(tr.dataset.min) && qty <= Number(tr.dataset.max));
      });
    };
    const setQty = v => {
      qty = Math.max(1, Math.floor(Number(v) || 1));
      input.value = qty;
      paint();
    };
    document.getElementById('qInc').onclick = () => setQty(qty + Math.max(1, Math.round(p.moq / 2)));
    document.getElementById('qDec').onclick = () => setQty(qty - Math.max(1, Math.round(p.moq / 2)));
    input.onchange = () => setQty(input.value);

    document.getElementById('addBtn').onclick = () => {
      if (qty < p.moq) { NV.toast(`Minimum order for ${p.name} is ${p.moq} ${p.unit}s.`, { title: 'Increase the quantity', type: 'error' }); return; }
      NV.basket.add(p.id, qty);
      NV.toast(`${qty} × ${p.name} added to your supply basket.`, { title: 'Added' });
    };

    paint();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
