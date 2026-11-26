#!/usr/bin/env python3
"""
Builds a single self-contained HTML file (no server, no external assets) from the
Norvex site: CSS, JS, catalogue and imagery are all inlined as data URIs, and the
pages are wired into a tiny hash router.

Usage: python3 tools/build-single-file.py  →  ../norvex-app.html
"""
import base64, json, mimetypes, os, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
OUT = ROOT.parent / "norvex-app.html"

PAGES = [
    # key,      file,             title
    ("index",   "index.html",     "Supply · Procurement · Safety"),
    ("shop",    "shop.html",      "Catalogue"),
    ("product", "product.html",   "Catalogue item"),
    ("services","services.html",  "Services"),
    ("about",   "about.html",     "About Us"),
    ("contact", "contact.html",   "Contact"),
    ("quote",   "quote.html",     "Request a Quotation"),
    ("desk",    "desk.html",      "Order desk"),
    ("basket",  "basket.html",    "Supply basket"),
    ("checkout","checkout.html",  "Checkout"),
    ("orders",  "orders.html",    "Order history"),
    ("order",   "order.html",     "Order tracking"),
    ("plan",    "plan.html",      "Future order planner"),
    ("account", "account.html",   "Organisation profile"),
    ("admin",   "admin.html",     "Operations"),
    ("404",     "404.html",       "Page not found"),
    ("auth",    "auth.html",      "Sign in"),
    ("manage",  "manage.html",    "Catalogue manager"),
]

# ------------------------------------------------ images → data URIs
def data_uri(path: pathlib.Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()

IMG = {}
for f in ["logo.png", "mark.png", "logo-light.png", "mark-light.png", "hero.jpg", "hero-1100.jpg", "hero-700.jpg",
          "about-hero.jpg", "about-hero-1100.jpg", "about-hero-700.jpg",
          "contact-hero.jpg", "contact-hero-1100.jpg", "contact-hero-700.jpg",
          "future-hero.jpg", "future-hero-1100.jpg", "future-hero-700.jpg",
          "basket-hero.jpg", "basket-hero-1100.jpg", "basket-hero-700.jpg",
          "icon-192.png"]:
    p = PUB / "img" / f
    if p.exists():
        IMG[f"/img/{f}"] = data_uri(p)

def inline_assets(text: str) -> str:
    for src, uri in IMG.items():
        text = text.replace(src, uri)
    return text

# ------------------------------------------------ page extraction
def extract(html: str):
    body_open = re.search(r"<body([^>]*)>", html, re.S)
    attrs = body_open.group(1).strip()
    body = html[body_open.end():]
    body = re.sub(r"<script\b[^>]*>.*?</script>", "", body, flags=re.S)
    body = body.split("</body>")[0]
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = inline_assets(body).strip()
    return attrs, body

def attr(attrs: str, name: str, default="") -> str:
    m = re.search(rf'{name}="([^"]*)"', attrs)
    return m.group(1) if m else default

TEMPLATES = {}
for key, filename, title in PAGES:
    attrs, body = extract((PUB / filename).read_text(encoding="utf-8"))
    TEMPLATES[key] = {
        "attrs": attrs,
        "body": body,
        "page": attr(attrs, "data-page", key),
        "crumb": attr(attrs, "data-crumb", ""),
        "title": title,
    }

# ------------------------------------------------ css
css = "\n".join((PUB / "css" / f).read_text(encoding="utf-8")
                for f in ["base.css", "portal.css", "console.css", "auth.css", "responsive.css"])
css = inline_assets(css)
css += """
/* ---------- single-file overrides ---------- */
html { scroll-behavior: smooth; }
#nv-app-root { display: contents; }
.single-file-badge { position: fixed; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 90;
  background: rgba(5,26,19,.82); color: #cfe0d7; font: 600 9px/1.3 var(--font-sans); letter-spacing: .14em;
  text-transform: uppercase; padding: 5px 12px; border-radius: 999px; border: 1px solid rgba(201,162,74,.3);
  pointer-events: none; opacity: .75; transition: opacity .6s; }
.single-file-badge.fade { opacity: 0; }
"""

# ------------------------------------------------ javascript
def read_js(name):
    return (PUB / "js" / name).read_text(encoding="utf-8")

core = read_js("nv-core.js")
# storage: fall back to memory when localStorage is unavailable (sandboxed iframes)
core = core.replace(
    """  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };""",
    """  const MEM = {};
  const read = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : (JSON.parse(raw) ?? fallback); }
    catch { return Object.prototype.hasOwnProperty.call(MEM, key) ? MEM[key] : fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { MEM[key] = value; }
  };""")
# no service worker / manifest in single-file mode
core = core.replace("""    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }""", "")
core = core.replace("""    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.appendChild(link);""", "")

# single-file mode: never attempt network calls
core = core.replace("""  async function api(path, options) {
    const opts = Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {});""",
"""  async function api(path, options) {
    if (window.__NORVEX_STATIC) { state.offline = true; throw Object.assign(new Error('offline'), { offline: true }); }
    const opts = Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {});""")

ui = read_js("nv-ui.js")
payments = read_js("nv-payments.js")
cookies = read_js("nv-cookies.js")
charts = read_js("nv-charts.js")
auth = read_js("nv-auth.js")
portal = read_js("chrome-portal.js")
console_ = read_js("chrome-console.js")
snapshot = read_js("catalog-snapshot.js")

# chrome must only build once per mount
portal = portal.replace("""    const mount = document.getElementById('nv-header');
    if (!mount) return;""",
"""    const mount = document.getElementById('nv-header');
    if (!mount || mount.dataset.built === '1') return;
    mount.dataset.built = '1';""")
portal = portal.replace("""    const mount = document.getElementById('nv-footer');
    if (!mount) return;""",
"""    const mount = document.getElementById('nv-footer');
    if (!mount || mount.dataset.built === '1') return;
    mount.dataset.built = '1';""")
console_ = console_.replace("""      if (railMount) railMount.outerHTML = buildRail(active);
      if (cmdMount) cmdMount.outerHTML = buildCmdbar();
      if (railMount || cmdMount) {
        wireConsole();
        NV.reveal();
      }""",
"""      if (railMount && railMount.dataset.built !== '1') { railMount.dataset.built = '1'; railMount.outerHTML = buildRail(active); }
      if (cmdMount && cmdMount.dataset.built !== '1') { cmdMount.dataset.built = '1'; cmdMount.outerHTML = buildCmdbar(); }
      if ((railMount || cmdMount) && !window.__consoleWired) { window.__consoleWired = true; wireConsole(); NV.reveal(); }""")

# ---- each page script becomes a named initializer that the router calls on render ----
PAGE_MODULES = {
    "page-home.js":      ["index"],
    "page-shop.js":      ["shop"],
    "page-product.js":   ["product"],
    "page-static.js":    ["services", "about", "404"],
    "page-contact.js":   ["contact"],
    "page-quote.js":     ["quote"],
    "page-basket.js":    ["basket"],
    "page-checkout.js":  ["checkout"],
    "page-order.js":     ["order"],
    "page-orders.js":    ["orders"],
    "page-desk.js":      ["desk"],
    "page-plan.js":      ["plan"],
    "page-account.js":   ["account"],
    "page-admin.js":     ["admin"],
    "page-auth.js":      ["auth"],
    "page-manage.js":    ["manage"],
}

READY_SHIM = (
    "const __onReady = function (fn) {\n"
    "    try { const r = fn(); if (r && typeof r.catch === 'function') r.catch(e => console.warn('[norvex]', e)); }\n"
    "    catch (e) { console.warn('[norvex]', e); }\n"
    "  };\n"
)

def as_initializer(src: str) -> str:
    # turn DOMContentLoaded registration into an immediate call at init time
    src = src.replace("document.addEventListener('DOMContentLoaded',", "__onReady(")
    # navigation calls -> hash router
    src = re.sub(r"location\.href\s*=\s*([^;]+);", lambda m: f"__nvNav({m.group(1)});", src)
    src = re.sub(r"location\.replace\(([^)]+)\);", lambda m: f"__nvNav({m.group(1)});", src)
    src = re.sub(r"location\.reload\(\);", "window.__nvRerender && window.__nvRerender();", src)
    src = re.sub(r"history\.replaceState\([^;]*\);", "", src)
    return src

chunks = ['window.__NV_INIT = window.__NV_INIT || {};']
for fname, keys in PAGE_MODULES.items():
    body = as_initializer(read_js(fname))
    for key in keys:
        chunks.append("window.__NV_INIT['%s'] = function () {\n  %s\n%s\n};" % (key, READY_SHIM.strip(), body))

# chrome modules
for fname, key in [("chrome-portal.js", "chrome:portal"), ("chrome-console.js", "chrome:console")]:
    body = as_initializer(read_js(fname))
    chunks.append("window.__NV_INIT['%s'] = function () {\n  %s\n%s\n};" % (key, READY_SHIM.strip(), body))

page_scripts = ["\n\n".join(chunks)]


pages_json = json.dumps({k: {"body": v["body"], "page": v["page"], "crumb": v["crumb"],
                             "attrs": v["attrs"], "title": v["title"]} for k, v in TEMPLATES.items()})


# ------------------------------------------------ router
router = r"""
/* ================= SINGLE-FILE ROUTER ================= */
(function () {
  const NV = window.NV;
  const PAGES = __PAGES__;
  const CONSOLE_PAGES = new Set(['desk', 'basket', 'checkout', 'orders', 'order', 'plan', 'account', 'admin', 'manage']);

  function parse(target) {
    let t = String(target || '').replace(/^#\/?/, '').replace(/^\//, '');
    if (!t) t = 'index';
    const [path, query] = t.split('?');
    let key = path.replace(/\.html$/i, '').toLowerCase();
    if (key === '' || key === 'index') key = 'index';
    if (!PAGES[key]) key = '404';
    return { key, query: query || '' };
  }

  async function render(key, query) {
    const page = PAGES[key] || PAGES['404'];
    document.title = (page.title ? page.title + ' — ' : '') + 'Norvex Integrated Enterprises Ltd';
    const cls = page.attrs.match(/class="([^"]*)"/);
    document.body.className = cls ? cls[1] : 'portal';
    const dp = page.attrs.match(/data-page="([^"]*)"/);
    document.body.dataset.page = dp ? dp[1] : key;
    const crumb = page.attrs.match(/data-crumb="([^"]*)"/);
    if (crumb) document.body.dataset.crumb = crumb[1]; else delete document.body.dataset.crumb;

    window.__nvQuery = query;

    let root = document.getElementById('nv-app-root');
    if (!root) { root = document.createElement('div'); root.id = 'nv-app-root'; document.body.appendChild(root); }
    root.innerHTML = page.body;
    window.scrollTo(0, 0);

    const init = window.__NV_INIT || {};
    const isConsole = CONSOLE_PAGES.has(key);
    if (isConsole) { init['chrome:console'] && init['chrome:console'](); }
    else { init['chrome:portal'] && init['chrome:portal'](); }
    if (init[key]) init[key]();
    try { if (NV.auth && NV.auth.refresh) NV.auth.refresh(); } catch (err) {}
    document.dispatchEvent(new CustomEvent('norvex:chrome'));

    document.querySelectorAll('[data-count]').forEach(el => { el.textContent = NV.basket.count(); });
  }

  function go(target) {
    const { key, query } = parse(target);
    const hash = '#' + key + (query ? '?' + query : '');
    if (location.hash === hash) render(key, query);
    else location.hash = hash;
  }
  window.__nvNav = go;
  window.__nvRerender = () => render(document.body.dataset.page || 'index', window.__nvQuery || '');

  NV.queryString = function () {
    return new URLSearchParams((window.__nvQuery || '').replace(/^\?/, ''));
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (a.hasAttribute('data-ui')) return;   /* drawer/overlay controls, not routes */
    const raw = a.getAttribute('href');
    if (!raw) return;
    if (raw.startsWith('#') && raw.length > 2) { e.preventDefault(); go(raw); return; }
    if (/^\/(?!\/)/.test(raw) && !/\.(png|jpe?g|svg|pdf|zip|csv)$/i.test(raw)) { e.preventDefault(); go(raw); return; }
    if (/^(index|shop|product|services|about|contact|quote|desk|basket|checkout|orders|order|plan|account|admin|manage|auth|404)\.html/i.test(raw)) {
      e.preventDefault(); go('/' + raw);
    }
  }, true);

  function start() { const { key, query } = parse(location.hash); render(key, query); }
  window.addEventListener('hashchange', () => { const { key, query } = parse(location.hash); render(key, query); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
"""
router = router.replace("__PAGES__", pages_json)

# ---- inline product photography for the single-file build (md + tiny LQIP) ----
prod_dir = PUB / "img" / "products"
registry = {}
for f in sorted(prod_dir.glob("*.jpg")):
    if f.name.endswith(("-sm.jpg", "-tiny.jpg")):
        continue
    if f.name.endswith("-md.jpg"):
        name = f.name[:-7]
        tiny = prod_dir / f"{name}-tiny.jpg"
        registry[name] = {
            "md": data_uri(f),
            "tiny": data_uri(tiny) if tiny.exists() else data_uri(f),
        }
img_registry_js = "window.__NV_IMG = " + json.dumps(registry) + ";"

bundle_js = "\n\n".join(["window.__NORVEX_STATIC = true;", img_registry_js, snapshot, core, ui, payments, charts, cookies, auth] + page_scripts + [router])
# runtime-built markup (header/footer/rail) also references /img/... — inline those too
bundle_js = inline_assets(bundle_js)

# ------------------------------------------------ document
html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Norvex Integrated Enterprises Ltd — Supply, Procurement &amp; Safety</title>
<meta name="description" content="Norvex Integrated Enterprises Ltd — institutional supply, procurement and occupational health &amp; safety. Catalogue, supply basket, order desk and operations console.">
<link rel="icon" href="{IMG.get('/img/mark.png','')}">
<style>
{css}
</style>
</head>
<body class="portal" data-page="index">
<noscript><p style="padding:24px;font-family:system-ui">This demo needs JavaScript enabled.</p></noscript>
<script>
{bundle_js}
</script>
</body>
</html>
"""

OUT.write_text(html, encoding="utf-8")
print(f"built {OUT} — {len(html)/1024:.0f} KB")
