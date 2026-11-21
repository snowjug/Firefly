import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The app's entry (main.tsx, the router, the layouts, the header and footer, the page title and
// config hooks) is downloaded before any page can draw, so what it imports is first-load JavaScript.
// The design barrel (design/index.ts) re-exports every primitive, and each primitive pulls its own
// stylesheet in, so one import from the barrel anywhere in the entry takes Dialog, the form fields,
// the tabs and the shared vocabulary into the first load with it. That cost 5.4 kB of gzip JavaScript and
// 3.4 kB of gzip CSS. The entry imports the one primitive it needs from its own file; pages, which load
// lazily, may use the barrel. scripts/check-budgets.mjs holds the line on the size; this finds the cause.

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const BARREL = /from\s+['"](?:\.\.?\/)+design\/index\.ts['"]|from\s+['"]\.\/design\/index\.ts['"]/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('the first-load entry', () => {
  const entry = [
    join(web, 'main.tsx'),
    join(web, 'App.tsx'),
    ...sources(join(web, 'app')).filter((file) => !file.endsWith('test-kit.tsx')),
    ...sources(join(web, 'lib')),
  ];

  it('imports design primitives from their own files, not from the design barrel', () => {
    const offenders = entry
      .filter((file) => BARREL.test(readFileSync(file, 'utf8')))
      .map((file) => relative(web, file).replaceAll('\\', '/'));
    expect(offenders).toEqual([]);
  });

  it('can tell a barrel import when there is one', () => {
    expect(BARREL.test("import { Spinner } from '../design/index.ts';")).toBe(true);
    expect(BARREL.test("import { AnnouncerProvider } from './design/index.ts';")).toBe(true);
    expect(BARREL.test("import { Spinner } from '../design/primitives/Spinner.tsx';")).toBe(false);
  });
});
