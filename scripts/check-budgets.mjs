// Enforces the performance budgets on the production build (dist/web). Run after `npm run build`:
//
//   node scripts/check-budgets.mjs
//
// Sizes are gzip, because that is what the network carries. The limits live in scripts/budgets.json
// so they are visible in review: raising one is a decision, not an accident. Also fails if a source
// map reached the build, because maps can expose private source paths.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist', 'web');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/web/index.html not found. Run `npm run build` first.');
  process.exit(2);
}
const budgets = JSON.parse(readFileSync(join(root, 'scripts', 'budgets.json'), 'utf8'));

const kb = (bytes) => bytes / 1024;
const gz = (file) => kb(gzipSync(readFileSync(file), { level: 9 }).length);
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = (pattern) =>
  [...html.matchAll(pattern)].map((m) => join(dist, m[1].replace(/^\//, '')));
const entryJs = refs(/<script[^>]+src="([^"]+\.js)"/g);
const preloadJs = refs(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g);
const entryCss = refs(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g);
const preloadFonts = [...html.matchAll(/<link[^>]+rel="preload"[^>]+href="([^"]+\.woff2)"/g)].map(
  (m) => join(dist, m[1].replace(/^\//, '')),
);

const files = walk(dist);
const js = files.filter((f) => extname(f) === '.js');
const css = files.filter((f) => extname(f) === '.css');
const fonts = files.filter((f) => extname(f) === '.woff2');
const maps = files.filter((f) => extname(f) === '.map');

const sum = (list) => list.reduce((total, file) => total + gz(file), 0);
const biggest = (list) =>
  list.map((file) => ({ file, size: gz(file) })).sort((a, b) => b.size - a.size)[0] ?? {
    file: '',
    size: 0,
  };

const rows = [];
const check = (label, value, limit, detail = '') => {
  rows.push({ label, value, limit, ok: value <= limit, detail });
};

check(
  'First-load JS (entry + preloaded)',
  sum([...new Set([...entryJs, ...preloadJs])]),
  budgets.firstLoadJsKB,
);
check('First-load CSS', sum(entryCss), budgets.firstLoadCssKB);
const bigJs = biggest(js.filter((file) => !entryJs.includes(file)));
check(
  'Largest route/feature JS chunk',
  bigJs.size,
  budgets.anyJsChunkKB,
  bigJs.file.replace(dist, ''),
);
const bigCss = biggest(css);
check('Largest CSS file', bigCss.size, budgets.anyCssKB, bigCss.file.replace(dist, ''));
check('Preloaded fonts (critical path)', sum(preloadFonts), budgets.criticalFontsKB);
check('All fonts', sum(fonts), budgets.totalFontsKB);
for (const [pattern, limit] of Object.entries(budgets.chunkOverridesKB ?? {})) {
  const match = js.filter((f) => new RegExp(pattern).test(f));
  if (match.length)
    check(`Chunk /${pattern}/`, biggest(match).size, limit, biggest(match).file.replace(dist, ''));
}

console.log('\nPerformance budgets (gzip)\n');
for (const row of rows) {
  const mark = row.ok ? 'ok  ' : 'OVER';
  console.log(
    `  ${mark}  ${row.label.padEnd(38)} ${row.value.toFixed(1).padStart(7)} kB  / ${String(row.limit).padStart(4)}  ${row.detail}`,
  );
}
let failed = rows.some((row) => !row.ok);
if (maps.length > 0) {
  failed = true;
  console.log(`\n  FAIL  source maps in the build (they can expose source paths):`);
  for (const map of maps) console.log(`        ${map.replace(dist, '')}`);
}
console.log(failed ? '\nBudgets exceeded.\n' : '\nAll budgets met.\n');
process.exit(failed ? 1 : 0);
