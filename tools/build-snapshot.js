/**
 * Regenerates public/js/catalog-snapshot.js from data/catalog.json.
 * Run after editing the catalogue: npm run snapshot
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const out = '/* Auto-generated snapshot of data/catalog.json — used when the API is unreachable (e.g. static hosting). */\n'
  + 'window.NORVEX_CATALOG = ' + JSON.stringify(catalog, null, 2) + ';\n';
fs.writeFileSync(path.join(root, 'public/js/catalog-snapshot.js'), out);
console.log(`catalog-snapshot.js rebuilt — ${catalog.products.length} products, ${catalog.categories.length} categories`);
