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
//  - an entrance of the design system that paper would run, and catch partway;
//  - a base stylesheet that no longer switches animation and transition off for reduced motion.
//
// Other features have their own owners and their own tests; this covers the parts shared by all.

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNED = ['design', 'app', 'features'];

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

/** The preludes of the blocks a position sits inside, outermost first: `@media screen`, then a selector. */
function enclosing(css: string, position: number): string[] {
  const stack: string[] = [];
  let start = 0;
  for (let index = 0; index < position; index += 1) {
    const char = css[index];
    if (char === '{') {
      stack.push(css.slice(start, index).trim());
      start = index + 1;
    } else if (char === '}') {
      stack.pop();
      start = index + 1;
    } else if (char === ';') start = index + 1;
  }
  return stack;
}

/**
 * Every finite animation that is declared where paper would run it, as `selector: value`. An endless
 * one is a state (a spinner, a shimmer, a pulse) and `none` is no animation; a declaration inside
 * `@media screen` is never seen on paper. `prefers-reduced-motion: no-preference` alone is not enough:
 * paper matches it too.
 */
function animatedOnPaper(css: string): string[] {
  return [...css.matchAll(/(?<![\w-])animation(?:-name)?\s*:\s*([^;}]+)/g)].flatMap((match) => {
    const value = (match[1] as string).replace(/!important/, '').trim();
    if (value.startsWith('none') || /\binfinite\b/.test(value)) return [];
    const blocks = enclosing(css, match.index as number);
    if (blocks.some((block) => /^@media\s+screen\b/.test(block))) return [];
    return [`${blocks.at(-1) ?? '(top level)'}: ${value}`];
  });
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

  // A placeholder that is shown at once and replaced a moment later is a flash of grey. A loading
  // screen or a skeleton waits one --dur-fast before it appears (the fill keeps it invisible during
  // the wait, and its space is kept), and then fades in.
  it('shows a loading placeholder only after a short wait, so a quick load never flashes', () => {
    const rules = (name: string, selector: string) => {
      const css = files.find((file) => file.name === name)?.css ?? '';
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return [...css.matchAll(new RegExp(`(?<![\\w.-])${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
        .map((match) => match[1])
        .join('\n');
    };
    const WAITS =
      /animation:\s*ff-fade var\(--dur-slow\) var\(--ease-easy\) var\(--dur-fast\) backwards/;
    expect(rules('design/primitives/skeleton.css', '.ff-skeleton')).toMatch(WAITS);
    expect(rules('app/shell/shell.css', '.ff-main--centred .ff-spinner')).toMatch(WAITS);
  });

  // Spring is for four things only: a dragged carousel item settling, a tip card released after a
  // drag, a call control being pressed and the report's evidence moving into view. Dialogs, pages,
  // the theme change, transcript entry and report expansion use plain easing.
  it('uses the spring easing only where the interaction system allows it', () => {
    const allowed = [
      /^design\/carousel\//,
      /^features\/tips\//,
      /^features\/call-ui\/controls\.css$/,
      /^features\/report\//,
    ];
    const misuse = files
      .filter((file) => /var\(--ease-spring\)/.test(file.css))
      .filter((file) => !allowed.some((pattern) => pattern.test(file.name)))
      .map((file) => file.name);
    expect(misuse).toEqual([]);
  });

  // Getting a page ready to print opens what is closed and reveals what waits, which starts the
  // entrances of the parts it holds (a score bar filling, a panel fading in), and paper takes whatever
  // frame it finds: a bar caught at a third, a panel not yet there. So every entrance of the design
  // system is declared only for a screen, and the pages that use it need no print rule of their own.
  // A dialog is the exception: opening and closing it start its animations, never a page being made
  // ready to print.
  it('declares every entrance of the design system for a screen only, so paper is never caught mid-way', () => {
    const FOR_DIALOGS = ['design/primitives/dialog.css'];
    const design = files.filter(
      (file) => file.name.startsWith('design/') && !FOR_DIALOGS.includes(file.name),
    );
    expect(design.length).toBeGreaterThan(20);
    const onPaper = design.flatMap((file) =>
      animatedOnPaper(file.css).map((found) => `${file.name} ${found}`),
    );
    expect(onPaper).toEqual([]);
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

  it('can tell an entrance that paper would run from one it never sees', () => {
    expect(animatedOnPaper('a { animation: x 1s both; }')).toEqual(['a: x 1s both']);
    expect(animatedOnPaper('@media screen { a { animation: x 1s both; } }')).toEqual([]);
    expect(
      animatedOnPaper(
        '@media screen and (prefers-reduced-motion: no-preference) { a { animation: x 1s; } }',
      ),
    ).toEqual([]);
    expect(
      animatedOnPaper(
        '@media (prefers-reduced-motion: no-preference) { a:not([hidden]) { animation: x 1s; } }',
      ),
    ).toEqual(['a:not([hidden]): x 1s']);
    expect(animatedOnPaper('@media print { a { animation: none !important; } }')).toEqual([]);
    expect(animatedOnPaper('a { animation: spin 1s linear infinite; }')).toEqual([]);
    expect(animatedOnPaper('@media screen { a { color: red; } } b { animation-name: y; }')).toEqual(
      ['b: y'],
    );
  });
});
