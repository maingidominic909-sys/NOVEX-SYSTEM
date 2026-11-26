# Norvex v4 — analytics, performance & QA notes

## What was added
- `public/js/nv-charts.js` — dependency-free inline-SVG chart kit:
  `area` (line/area with gradient fill + stroke animation), `bars`, `donut`, `funnel`,
  `spark`, `gauge`. Charts measure their container and choose a 1-unit-per-pixel
  viewBox, thin out x-axis labels (48px minimum gap) and re-render on resize (debounced).
- `public/js/page-admin.js` — analytics layer: cost ratios per department, seeded
  34-order demo book (`rng(20261116)` deterministic), demo enquiries + future orders,
  money maths (revenue, COGS, gross profit, margin, cash in, receivables ageing,
  AOV, pending orders), and 7 chart renders.
- `public/css/console.css` — `.ops-grid` layouts, KPI 6-up rhythm, chart shells,
  scroll-in-panel order table, admin bar fit rules.
- `public/css/responsive.css` — footer fit rules, CTA strips, flat cat-cards,
  compact consent bar, 40px touch targets, button wrapping.
- `public/css/base.css` — `content-visibility` for below-fold portal sections.

## Verification (headless Chromium, single file)
- 14 routes × 6 widths (360/390/430/768/1024/1440) = 84 checks
  → **0 overflow, 0 clipped text, 0 overlapping siblings, 0 page errors**.
- Cold load 0.25 s · DOM interactive 0.09 s · route switch ~25 ms ·
  admin charts drawn 40 ms · scroll 60 fps.

## Build
```
python3 tools/build-single-file.py     # → ../norvex-app.html
```


## v5 — accounts + catalogue manager

New files:
- `public/auth.html`, `public/js/page-auth.js`, `public/css/auth.css` — split-screen sign in / create account
  with segmented mode switch, inline validation, password strength, reveal toggle, demo fill and success beat.
- `public/manage.html`, `public/js/page-manage.js` — admin catalogue manager (products, departments, price tiers,
  picture upload/drag-drop, delete with confirmation, JSON export, reset).
- `public/js/nv-auth.js` — accounts + session store, SHA-256 (salted) hashing, sign in by email / phone / username,
  sign out, profile update, password change, order gate modal, page guard, header identity menu.

Rules:
- Browsing never needs an account; checkout and order history do (`NV.auth.require` / `pageGuard`).
- Catalogue edits are stored as overrides (`norvex.catalog.overrides.v1`) layered over the shipped catalogue, so
  added/edited/removed products and department pictures apply across shop, product pages, basket and admin instantly.
- Uploaded pictures are downscaled to 900px JPEG data URIs (works offline and in the single-file build).
- Storage falls back to memory when `localStorage` is blocked (file://, sandboxed preview).

Demo logins: `demo@norvex.co.ke` / `admin@norvex.co.ke`, password `Norvex2026`.

QA: 17 routes × 6 widths = 102 checks → 0 overflow, 0 overlaps, 0 clipped text, 0 page errors.
