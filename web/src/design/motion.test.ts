import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Motion has rules, and a rule nobody checks is a hope. This reads the stylesheets of the design
// system, the shell and the public pages as text and fails on the ways motion goes wrong:
//
//  - a time written into a stylesheet instead of taken from a --dur-* token (every token has a
//    still equivalent under reduced motion, a literal one does not);
//  - `transition: all`, and any transition of a layout property (width, height, margin, padding,
//    top, left, inset and the like), which makes the page move under the person's hands;
//  - a keyframe that moves anything but transform and opacity;
//  - a base stylesheet that no longer switches animation and transition off for reduced motion.
//
// Other features have their own owners and their own tests; this covers the parts shared by all.

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNED = ['design', 'app', 'features/landing', 'features/content'];

function stylesheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

const files = OWNED.flatMap((folder) => stylesheets(join(web, folder))).map((path) => ({
  name: relative(web, path).replaceAll('\\', '/'),
  css: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
}));

/** Splits on commas that are not inside parentheses: `a 1s, b cubic-bezier(0, 1, 0, 1)`. */
const topLevel = (list: string) => list.split(/,(?![^(]*\))/).map((part) => part.trim());

/** The value of every transition and animation declaration (shorthand, duration and delay). */
function motionDeclarations(css: string) {
  return [
    ...css.matchAll(
      /(?<![\w-])(transition|animation)(-duration|-delay|-property)?\s*:\s*([^;}]+)/g,
    ),
  ].map((match) => ({
    kind: match[1] as 'transition' | 'animation',
    part: (match[2] ?? '') as '' | '-duration' | '-delay' | '-property',
    value: (match[3] as string).replace(/!important/, '').trim(),
  }));
}

/** The body of every @keyframes block, as its declared property names. */
function keyframeProperties(css: string): { name: string; properties: string[] }[] {
  const blocks: { name: string; properties: string[] }[] = [];
  for (const match of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1;
    let index = (match.index as number) + match[0].length;
    const start = index;
    for (; index < css.length && depth > 0; index += 1) {
      if (css[index] === '{') depth += 1;
      if (css[index] === '}') depth -= 1;
    }
    const body = css.slice(start, index - 1);
    const properties = [...body.matchAll(/(?:^|[;{\s])([a-z-]+)\s*:/g)].map((m) => m[1] as string);
    blocks.push({ name: match[1] as string, properties });
  }
  return blocks;
}

const TIME = /(?<![\w.-])(?:\d+\.?\d*|\.\d+)(?:ms|s)\b/g;
// Paint and compositor properties that may change state: no layout property is on this list.
const TRANSITIONABLE = new Set([
  'transform',
  'opacity',
  'color',
  'background-color',
  'border-color',
  'box-shadow',
  'outline-color',
  'text-decoration-color',
  'fill',
  'stroke',
  'visibility',
  'none',
]);
const KEYFRAME_PROPERTIES = new Set(['transform', 'opacity']);

describe('motion in the shared stylesheets', () => {
  it('reads the stylesheets it is meant to police', () => {
    expect(files.length).toBeGreaterThan(30);
    expect(files.map((file) => file.name)).toEqual(
      expect.arrayContaining(['design/primitives/button.css', 'app/shell/shell.css']),
    );
  });

  it('takes every time from a --dur-* token: no literal duration or delay', () => {
    const literals = files.flatMap((file) =>
      motionDeclarations(file.css).flatMap(({ kind, part, value }) =>
        part === '-property'
          ? []
          : (value.match(TIME) ?? [])
              .filter((time) => !/^0(\.0+)?m?s$/.test(time) && time !== '0.01ms')
              .map((time) => `${file.name}: ${kind}${part} uses ${time}`),
      ),
    );
    expect(literals).toEqual([]);
  });

  it('never transitions "all", and never a layout property', () => {
    const problems = files.flatMap((file) =>
      motionDeclarations(file.css)
        .filter(
          ({ kind, part }) => kind === 'transition' && part !== '-duration' && part !== '-delay',
        )
        .flatMap(({ part, value }) =>
          topLevel(value).flatMap((item) => {
            const property = part === '-property' ? item : (item.split(/\s+/)[0] ?? '');
            return TRANSITIONABLE.has(property)
              ? []
              : [`${file.name}: transitions ${property || '(nothing)'}`];
          }),
        ),
    );
    expect(problems).toEqual([]);
  });

  it('moves only transform and opacity in a keyframe', () => {
    const problems = files.flatMap((file) =>
      keyframeProperties(file.css).flatMap(({ name, properties }) =>
        properties
          .filter((property) => !KEYFRAME_PROPERTIES.has(property))
          .map((property) => `${file.name}: @keyframes ${name} animates ${property}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it('declares will-change nowhere, and never for everything', () => {
    for (const file of files) expect(file.css, file.name).not.toMatch(/will-change\s*:\s*all/);
  });

  it('keeps the base rule that ends every animation and transition under reduced motion', () => {
    const base = files.find((file) => file.name === 'design/base.css')?.css ?? '';
    const block =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(base)?.[1] ?? '';
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it('can tell a literal time, a layout transition and a bad keyframe when there is one', () => {
    expect(motionDeclarations('a { transition: width 200ms ease; }')[0]?.value).toBe(
      'width 200ms ease',
    );
    expect('width 200ms ease'.match(TIME)).toEqual(['200ms']);
    expect('opacity var(--dur-fast) cubic-bezier(0.1, 0.9, 0.2, 1)'.match(TIME)).toBeNull();
    expect(topLevel('a 1s, b cubic-bezier(0, 1, 0, 1)')).toEqual([
      'a 1s',
      'b cubic-bezier(0, 1, 0, 1)',
    ]);
    expect(
      keyframeProperties('@keyframes x { from { opacity: 0; } to { inset-inline-start: 1px; } }'),
    ).toEqual([{ name: 'x', properties: ['opacity', 'inset-inline-start'] }]);
  });
});
