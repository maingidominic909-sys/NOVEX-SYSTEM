# NORVEX — Integrated Commerce Platform (v2)

An end-to-end supply & procurement system for **Norvex Integrated Enterprises Ltd** (Nairobi, Kenya):
a public **storefront**, a transactional **order desk**, and an internal **operations console** —
now rebuilt as **one connected system with a single modern design language**.

```
node server/server.js      →  http://localhost:3000
```

No build step, no dependencies (`npm install` not required). Node 18+.

---

## 1. What changed in v2

The v1 site had two competing navigation systems (a floating sidebar for the shop, a dark rail for the
console), five stylesheets, legacy pages mixed in, and **no `index.html`** — so `/` returned a 404.
v2 fixes all of that:

| Fix | Detail |
|---|---|
| **One shell everywhere** | `js/shell.js` injects the same utility bar, sticky header, catalogue mega-menu, search overlay, basket drawer, mobile drawer and footer on **every page** |
| **Connected navigation** | Primary nav (Home · Catalogue · Services · Future orders · About · Contact) + a workspace tab strip (Desk · Basket · Checkout · Orders · Future plan · Account, plus Operations/Catalogue manager for admins) + a mega footer that links all 18 pages |
| **Real homepage** | `public/index.html` — hero with catalogue search, 13 department cards, featured lines, how-it-works, services, testimonials, CTA |
| **One design system** | `css/nv.css` — tokens, buttons, forms, cards, tables, KPIs, drawers, modals, toasts, responsive rules. Deep green + gold brand kept |
| **New login panel** | `auth.html` — split brand/form layout, sign-in/create-account tabs, inline validation, password visibility + strength meter, one-click demo accounts, return-to redirect |
| **Preview-friendly server** | `X-Frame-Options` removed so the site renders in embedded previews; express/pickup delivery priced server-side |
| **Legacy links redirect** | `Index.html`, `catalogue.html`, `supply-basket.html`, `future-order.html` → new pages |

## 2. Pages (all connected)

**Storefront:** `index` · `shop` (filters, search, sort, pagination, deep-linkable) · `product` (live
3-tier pricing, MOQ, related lines) · `services` · `about` · `contact` (validated form → API) · `quote` (multi-line RFQ)

**Order desk:** `desk` (KPIs + quick actions) · `basket` (tier nudges, free-delivery progress) ·
`checkout` (3-step wizard, server-priced, offline fallback) · `orders` (history, CSV, reorder) ·
`order` (live timeline, printable sheet) · `plan` (recurring supply cycles) · `account` (profile, security, favourites)

**Operations (admin role):** `admin` (revenue KPIs, 14-day chart, status donut, pipeline with inline
status advance, enquiries) · `manage` (add/edit/delete products & departments, tiers, pictures — device-local overrides)

**Auth:** `auth` (sign in / create account) · `404`

Everything works **without the backend too** — a bundled catalogue snapshot plus local queues keep
browsing, baskets, accounts and orders alive in offline preview mode.

## 3. Project structure

```
├── server/server.js            # zero-dependency Node server: static host + JSON API + file store
├── data/catalog.json           # single source of truth: 13 categories, 45 products, tiers, MOQ, lead
├── data/db/*.json              # runtime store (orders, enquiries, future-orders, events)
├── tools/
│   ├── seed-demo.js            # realistic demo orders/enquiries/plans  (node tools/seed-demo.js --force)
│   ├── qa-smoke.mjs            # jsdom harness: boots every page + simulates key flows (91 checks)
│   ├── build-snapshot.js       # regenerates the offline catalogue snapshot
│   └── build-single-file.py    # LEGACY v1 single-file builder (kept for the old norvex-app.html)
└── public/
    ├── css/nv.css              # ★ v2 design system — the only stylesheet pages load
    ├── js/
    │   ├── nv-core.js          # formatting, icons, API client, basket store, pricing, toasts
    │   ├── nv-auth.js          # device-local accounts, sessions, gate modal, identity menus
    │   ├── ui.js               # ★ v2 product cards + shared binders
    │   ├── shell.js            # ★ v2 unified chrome (header/mega/search/drawer/footer)
    │   ├── catalog-snapshot.js # generated offline catalogue
    │   └── pages/*.js          # ★ v2 controller per page
    ├── img/                    # logo, mark, heroes, product photos (optimised)
    ├── *.html                  # the 18 pages + legacy redirects
    └── manifest.webmanifest · sw.js (v2 cache)
```

Legacy v1 assets (`css/base|portal|console|auth|responsive|style.css`, `js/chrome-*.js`, `js/page-*.js`,
`legacy-original-site/`, root `norvex-*.html` tours) are kept for reference and the old single-file
builder — **no live page loads them**.

## 4. Signing in (demo)

| Role | Email | Password |
|---|---|---|
| Customer | `demo@norvex.co.ke` | `Norvex2026` |
| Admin | `admin@norvex.co.ke` | `Norvex2026` |

The auth page has one-click demo fill buttons. Accounts are device-local (hashed, offline-first);
the demo customer ships with seeded order history, and the admin console reads the live API.
You can also create your own account (name, organisation, email, mobile, username, password).

## 5. API

Base: `/api`

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` · `/config` | liveness · company details |
| GET | `/catalog?q=&cat=` | categories + products |
| POST | `/quote` | server-authoritative tiered quote |
| POST | `/orders` | create order (validated, priced server-side; express +2,500, pickup free) |
| GET | `/orders?email=&org=` · `/orders/:ref` | list / single order |
| PATCH | `/orders/:ref` | advance status (`received → confirmed → sourcing → dispatched → delivered`, or `cancelled`) |
| POST/GET | `/future-orders` | planned supply cycles |
| POST | `/enquiries` | contact / RFQ submissions |
| GET | `/admin/summary` | KPIs, status mix, top items, recent records |
| GET/POST | `/payments/*` | methods, M-Pesa STK sandbox, card tokenisation mock |

**Pricing rules** (`tiers: [[minQty, unitPrice], …]`): unit price = highest tier whose `minQty` is met ·
VAT 16% · delivery KES 4,500 Nairobi Metro, **free above KES 150,000** · express +2,500 · pickup free ·
MOQ enforced on product pages; the basket nudges toward the next tier.

Change a price → edit `data/catalog.json` → `npm run snapshot` → restart.

## 6. Design tokens

| Token | Value | Use |
|---|---|---|
| `--green-950 / 800` | `#051a13` / `#0b3d2c` | footer & heroes / primary buttons |
| `--gold-500 / 400` | `#c9a24a` / `#dfbf74` | CTA gradient, accents, active states |
| `--bg / --surface` | `#f6f5f0` / `#ffffff` | warm paper canvas / cards |
| `--font-serif` | Iowan / Palatino / Georgia | display headings |
| `--font-sans` | system UI stack | body & UI |

No external fonts or CDNs — everything renders offline and inside sandboxed previews.

## 7. QA

```
node server/server.js &        # start the site
npm install --no-save jsdom    # test-only dependency
node tools/qa-smoke.mjs        # 91 checks: every page boots clean + real user flows
node tools/seed-demo.js --force  # reset & reseed demo records
```

The harness boots all 18 pages in jsdom against the running server and simulates: add-to-basket,
catalogue search/filters, live tier pricing, demo sign-in, the full 3-step checkout (verifying the
order server-side), order tracking, admin status advance, catalogue-manager product creation,
RFQ submission, future-plan reservation, contact form and profile updates.

## 8. Suggested next steps (production)

1. **Real auth** — swap the device-local account store for server accounts + roles.
2. **Payments** — wire Daraja STK push and a card gateway to the existing payment endpoints.
3. **Database** — replace the JSON file store with Postgres/SQLite (1:1 mapping).
4. **Notifications** — email/SMS on order status transitions.
5. **Stock** — per-SKU availability on product pages.
6. **Frame policy** — re-add `frame-ancestors` CSP when embedding is not wanted.
7. **SEO** — per-product meta/OG tags + sitemap from `catalog.json`.

© 2026 Norvex Integrated Enterprises Ltd · Nairobi, Kenya
