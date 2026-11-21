// Enforces the performance budgets and the shape of the production build (dist/web). Run after
// `npm run build`:
//
//   node scripts/check-budgets.mjs
//
// FIREFLY_BUILD_DIR=<folder, relative to the repository root> reads another build instead (a folder
// under scripts/_tmp, say). Sizes are gzip at its highest level, because that is what a compressing
// host sends; the Node server itself does not compress (see docs/performance.md). The limits live in
// scripts/budgets.json so they are visible in review: raising one is a decision, not an accident.
//
// Beyond sizes, the build fails if it contains:
//   - a source map (maps can expose private source paths);
//   - a font file (Firefly uses the system fonts and downloads none);
//   - any page other than index.html (the component galleries and dev pages never ship);
//   - the string "ZodError" in any script (the web app must never ship zod: schemas stay on the server).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, process.env.FIREFLY_BUILD_DIR ?? join('dist', 'web'));
const shown = (file) => relative(dist, file).replaceAll('\\', '/');
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`${relative(root, dist)}/index.html not found. Run \`npm run build\` first.`);
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
const firstLoadJs = [...new Set([...entryJs, ...preloadJs])];

const files = walk(dist);
const js = files.filter((f) => extname(f) === '.js');
const css = files.filter((f) => extname(f) === '.css');

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

check('First-load JS (entry + preloaded)', sum(firstLoadJs), budgets.firstLoadJsKB);
check('First-load CSS', sum(entryCss), budgets.firstLoadCssKB);
// Everything a page needs beyond the first load is fetched when that page is visited.
const bigJs = biggest(js.filter((file) => !firstLoadJs.includes(file)));
check('Largest lazy JS chunk', bigJs.size, budgets.anyJsChunkKB, shown(bigJs.file));
const bigCss = biggest(css);
check('Largest CSS file', bigCss.size, budgets.anyCssKB, shown(bigCss.file));
for (const [pattern, limit] of Object.entries(budgets.chunkOverridesKB ?? {})) {
  const match = js.filter((f) => new RegExp(pattern).test(basename(f)));
  if (match.length) {
    check(`Chunk /${pattern}/`, biggest(match).size, limit, shown(biggest(match).file));
  } else {
    rows.push({
      label: `Chunk /${pattern}/`,
      value: 0,
      limit,
      ok: false,
      detail: 'no chunk matches: remove or fix this override',
    });
  }
}

const problems = [];
const maps = files.filter((f) => extname(f) === '.map');
if (maps.length > 0) {
  problems.push(['source maps in the build (they can expose source paths)', maps.map(shown)]);
}
const fonts = files.filter((f) => /\.(woff2?|ttf|otf|eot)$/i.test(f));
if (fonts.length > 0) {
  problems.push(['font files in the build (Firefly uses the system fonts)', fonts.map(shown)]);
}
const pages = files.filter((f) => extname(f) === '.html' && f !== join(dist, 'index.html'));
if (pages.length > 0) {
  problems.push([
    'pages other than index.html (galleries and dev pages never ship)',
    pages.map(shown),
  ]);
}
const withZod = js.filter((f) => readFileSync(f, 'utf8').includes('ZodError'));
if (withZod.length > 0) {
  problems.push(['zod in a script (the web app must never ship zod)', withZod.map(shown)]);
}

console.log(`\nPerformance budgets (gzip), ${relative(root, dist).replaceAll('\\', '/')}\n`);
for (const row of rows) {
  const mark = row.ok ? 'ok  ' : 'OVER';
  console.log(
    `  ${mark}  ${row.label.padEnd(38)} ${row.value.toFixed(1).padStart(7)} kB  / ${String(row.limit).padStart(4)}  ${row.detail}`,
  );
}
console.log('');
if (problems.length === 0) {
  console.log('  ok    no source maps, no fonts, no extra pages, no zod');
}
for (const [what, list] of problems) {
  console.log(`  FAIL  ${what}:`);
  for (const file of list) console.log(`        ${file}`);
}
const failed = rows.some((row) => !row.ok) || problems.length > 0;
console.log(failed ? '\nBudgets exceeded.\n' : '\nAll budgets met.\n');
process.exit(failed ? 1 : 0);
