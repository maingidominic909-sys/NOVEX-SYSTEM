# NORVEX — Integrated Commerce Platform

An end-to-end e-commerce system for **Norvex Integrated Enterprises Ltd** (Nairobi, Kenya):
a public **storefront**, a transactional **order desk**, and an internal **operations console** —
all built on your existing brand, copy and imagery, but upgraded into a working commerce product.

```
node server/server.js      →  http://localhost:3000
```

No build step, no dependencies (`npm install` not required). Node 18+.

---

## 1. What this is

Your original site was six static pages with a catalogue and a "supply basket". This rebuild keeps the brand
(deep green + gold, serif display type, the eagle mark) and turns it into a system:

| Capability | What it does |
|---|---|
| **Catalogue** | 45 SKUs across 13 departments, each with SKU, pack unit, MOQ, lead time and **3-step volume pricing** |
| **Search / filter** | Full-text search, department + price-band + MOQ + dispatch-speed filters, sort, pagination, deep-linkable URLs |
| **Product pages** | Live price recalculation as quantity crosses a tier, tier table, spec/procurement tabs, related lines |
| **Supply basket** | Persists per device, quantity steppers, "add N more to reach the next tier" nudges, free-delivery progress |
| **Checkout** | 3-step wizard (organisation → delivery → review), delivery method pricing, payment options, validation |
| **Orders** | Server-generated references, status timeline (received → confirmed → sourcing → dispatched → delivered), printable order sheet, reorder |
| **Order history** | Filterable, searchable, CSV export, spend KPIs, reorder favourites |
| **Quote desk (RFQ)** | Multi-line pricing sheet with indicative totals, submits a formal quotation request |
| **Future order planner** | Forward requirement planning with recurring schedules, budget bands and estimated value |
| **Operations console** | Revenue/KPI dashboard, order pipeline with one-click status advance, enquiry feed, top-moving lines, status mix |
| **Enquiries** | Validated contact form → API, offline-safe local queue |
| **PWA** | Web manifest, icons, service worker (asset caching), installable |

Everything works **without the backend too** — a bundled catalogue snapshot plus a local order queue means the
pages still function if opened as plain static files or if the API is down (`offline preview mode`).

---

## 2. Two unique navigation layouts

You asked for the navigations in both layouts to be distinctive. They are deliberately different *systems*,
not the same bar in two colours:

### Layout A — **The Portal** (public storefront)
`index · shop · product · services · about · contact · quote`
- Utility bar (dispatch cut-off, free-delivery threshold, track order, phone, sign in)
- Sticky centred **brand header** with inline nav and a **department mega-menu** (13 departments in two columns + a dark "bulk buyer" feature panel + footer row)
- Icon cluster: search overlay (`/` or `Ctrl K`), account, basket drawer with live totals
- Full-screen **search overlay** with instant results and popular searches
- Slide-in **basket drawer** with tier pricing, quantity steppers and checkout CTA
- Mega footer: brand, shop, company, order desk, contact + newsletter + payment badges
- Mobile: right-hand drawer with department grid

### Layout B — **The Ops Console** (transactional)
`desk · basket · checkout · orders · order · plan · account · admin`
- Dark **vertical rail** with grouped, collapsible sections (Ordering / Procurement / Records / Operations / Portal), live basket badge, organisation chip, user footer, **collapsible to icon-only**
- **Command bar** on top: breadcrumb, **command palette** (`Ctrl K` — jump to any tool), notifications, basket, "New order"
- Workspace canvas with panels, data tables, KPI tiles, wizard steps, timelines
- Mobile: rail becomes an off-canvas drawer

---

## 3. Project structure

```
norvex/
├── server/
│   └── server.js               # zero-dependency Node server: static host + JSON API + file store
├── data/
│   ├── catalog.json            # single source of truth: categories, products, tiers, MOQ, lead
│   └── db/                     # runtime store (orders, enquiries, future-orders, events)
├── tools/
│   └── build-snapshot.js       # regenerates the offline catalogue snapshot
├── public/
│   ├── css/
│   │   ├── base.css            # design tokens, reset, shared components (buttons, forms, toasts…)
│   │   ├── portal.css          # LAYOUT A chrome + storefront components
│   │   └── console.css         # LAYOUT B chrome + workspace components
│   ├── js/
│   │   ├── nv-core.js          # formatting, icons, API client, basket store, pricing engine, toasts, PWA
│   │   ├── nv-ui.js            # product cards, skeletons, binders
│   │   ├── chrome-portal.js    # injects Portal header/search/cart/footer
│   │   ├── chrome-console.js   # injects rail + command bar + command palette
│   │   ├── catalog-snapshot.js # generated offline catalogue
│   │   └── page-*.js           # one controller per page
│   ├── img/                    # your logo, mark, hero + interior hero images (optimised)
│   ├── index.html  shop.html  product.html  services.html  about.html  contact.html  quote.html
│   ├── desk.html  basket.html  checkout.html  orders.html  order.html  plan.html  account.html  admin.html
│   ├── 404.html
│   ├── catalogue.html · supply-basket.html · future-order.html · Index.html   # legacy → redirects
│   ├── manifest.webmanifest  sw.js
└── legacy-original-site/       # your original uploads, untouched
```

---

## 4. API

Base: `/api`

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/config` | company details, terms, delivery thresholds |
| GET | `/catalog?q=&cat=` | categories + products (with `from` price) |
| POST | `/quote` | server-authoritative tiered quote for a set of lines |
| POST | `/orders` | create order (validated, priced server-side) |
| GET | `/orders?email=&org=` | list orders |
| GET | `/orders/:ref` | single order |
| PATCH | `/orders/:ref` | advance status (`received → … → delivered`) |
| POST | `/future-orders` · GET | planned requirements |
| POST | `/enquiries` | contact / RFQ submissions |
| GET | `/admin/summary` | KPIs, status mix, top items, recent records |

**Pricing rules** (`data/catalog.json` → `tiers: [[minQty, unitPrice], …]`):
- unit price is the highest tier whose `minQty` is satisfied
- VAT 16 % applied at checkout
- delivery KES 4,500 inside Nairobi Metro, **free above KES 150,000**; express +2,500; upcountry quoted
- MOQ enforced on product pages; the basket nudges you toward the next tier instead of blocking

Change a price → edit `data/catalog.json` → `npm run snapshot` (keeps static/offline mode in sync) → restart.

---

## 5. Design system

| Token | Value | Use |
|---|---|---|
| `--green-950` | `#051a13` | rail, hero scrim, footer |
| `--green-800` | `#0b3d2c` | primary buttons, headings |
| `--gold-500` | `#c9a24a` | accents, CTA gradient, active states |
| `--cream` / `--sand` | `#faf8f3` / `#f2efe6` | section rhythm |
| `--font-serif` | Iowan / Palatino / Georgia | display headings |
| `--font-sans` | Inter / system UI | body, UI |

No external fonts or CDNs are loaded — everything renders offline and inside sandboxed previews.

---

## 6. Suggested next steps (production)

1. **Auth** — replace the demo identity with real accounts (organisation, users, roles). The rail already
   reads from a customer profile object, so it's a single swap.
2. **Payments** — wire M-Pesa (Daraja STK push) and bank/Pesalink to the `payment` field on orders.
3. **Database** — replace the JSON file store with Postgres/SQLite (`data/db/*.json` maps 1:1 to tables).
4. **Email/SMS** — send quotation, dispatch and delivery notifications from the order status transitions.
5. **Stock** — add per-SKU availability so the product page can show live stock instead of `In supply`.
6. **Admin auth** — put `/admin.html` and the PATCH endpoints behind a signed-in role.
7. **SEO** — per-product meta/OG tags and a sitemap (prerender from `catalog.json`).

---

© 2026 Norvex Integrated Enterprises Ltd · Nairobi, Kenya

---

## 7. Quick tour (start here)

| Want to see | Go to | Try this |
|---|---|---|
| Storefront | `/` | Hover **Catalogue** for the mega-menu; press `/` for search |
| Catalogue | `/shop.html` | Filter by department + price band, add 3 lines |
| Product / volume pricing | `/product.html?id=nvx-fd-011` | Raise quantity past 20 and 100 — the price drops live |
| Basket | `/basket.html` | Watch "add N more → cheaper" nudges and free-delivery progress |
| Checkout | `/checkout.html` | 3-step wizard, express delivery, invoice/M-Pesa options |
| Order tracking | `/order.html` | Status timeline + printable order sheet |
| Order history | `/orders.html` | Status filter, search, CSV export, reorder |
| Quote desk | `/quote.html` | Multi-line RFQ with indicative totals |
| Future orders | `/plan.html` | Recurring schedule + reserved-stock estimate |
| Operations | `/admin.html` | Advance an order status; watch the buyer's timeline change |
| Command palette | any console page | `Ctrl K` / `⌘ K` |

Demo data lives in `data/db/*.json`. Reset it at any time with:

```bash
for f in data/db/*.json; do echo '[]' > "$f"; done
```
