import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Stylesheets load with their page or component and then stay loaded, so a class that two sheets both
// style as the subject of a rule (not as a scoped override under the owner's own class) quietly merges
// the two the next time someone visits both. This reads every stylesheet under web/src as text and
// fails on a second owner. Prefix feature classes (ff-, l-, t-, u-, or a page's own prefix).
//
// A compound selector such as `.ff-button.cw-bar__jump` is about the feature's own class (the last
// one in the compound): it only reaches elements that carry both, so it merges nothing.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function stylesheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

/** Selectors of every rule, split on top-level commas (a comma inside :is() or :not() is not a split). */
function selectorsOf(css: string): string[] {
  const out: string[] = [];
  let buffer = '';
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      const text = buffer.trim();
      buffer = '';
      if (!text || text.startsWith('@')) continue;
      let depth = 0;
      let current = '';
      for (const c of text) {
        if (c === '(') depth += 1;
        if (c === ')') depth -= 1;
        if (c === ',' && depth === 0) {
          out.push(current.trim());
          current = '';
        } else current += c;
      }
      out.push(current.trim());
    } else if (char === '}' || char === ';') {
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return out;
}

/** The compound selectors of a selector: split at combinators outside parentheses and brackets. */
function compounds(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of selector) {
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (depth === 0 && /[\s>+~]/.test(char)) {
      if (current) out.push(current);
      current = '';
    } else current += char;
  }
  if (current) out.push(current);
  return out;
}

const DESIGN_SYSTEM = new Set(['ff', 'l', 't', 'u']);
const family = (name: string) => name.split(/[-_]/)[0] as string;

/**
 * The class a rule is about: in the first compound selector that has a class, the feature's own
 * class if a design system class is joined to it (`.ff-button.cw-bar__jump` is about the jump
 * button), else the first class. A scoped override leads with its scope: `.page .a` and
 * `body:has(.page) .a` are about `.page`, and `:root[data-x] .a` is about `.a`.
 */
function leadingClass(selector: string): string | null {
  for (const compound of compounds(selector)) {
    const classes = [...compound.replace(/\[[^\]]*\]/g, '').matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(
      (match) => match[1] as string,
    );
    if (classes.length === 0) continue;
    return classes.find((name) => !DESIGN_SYSTEM.has(family(name))) ?? (classes[0] as string);
  }
  return null;
}

describe('stylesheets', () => {
  const owners = new Map<string, Set<string>>();
  for (const file of stylesheets(root)) {
    for (const selector of selectorsOf(readFileSync(file, 'utf8'))) {
      const name = leadingClass(selector);
      if (!name) continue;
      if (!owners.has(name)) owners.set(name, new Set());
      owners.get(name)?.add(relative(root, file).replaceAll('\\', '/'));
    }
  }

  it('give each class one owner, so visiting two pages never merges their rules', () => {
    const clashes = [...owners]
      .filter(([, files]) => files.size > 1)
      .map(([name, files]) => `.${name}: ${[...files].sort().join(', ')}`);
    expect(clashes).toEqual([]);
  });

  it('prefix the design system classes, so no page can collide with them by accident', () => {
    const design = [...owners]
      .filter(([, files]) => [...files].every((file) => file.startsWith('design/')))
      .map(([name]) => name)
      .filter(
        (name) =>
          !/^(ff-|gx-|l-|t-|u-)/.test(name) &&
          !['visually-hidden', 'skip-link', 'measure', 'no-print'].includes(name),
      );
    expect(design).toEqual([]);
  });

  it('can tell a clash when there is one', () => {
    expect(selectorsOf('.a, .b:is(.c, .d) { x: y }')).toEqual(['.a', '.b:is(.c, .d)']);
    expect(leadingClass('.page .a')).toBe('page');
    expect(leadingClass(':root[data-x] .a')).toBe('a');
    expect(leadingClass('html:has(.shell .a)')).toBe('shell');
    expect(leadingClass('body:has(.rp-page) .ff-header')).toBe('rp-page');
    expect(leadingClass('html:has(dialog.ff-dialog[open])')).toBe('ff-dialog');
    expect(leadingClass("a[href$='.pdf']")).toBeNull();
    expect(leadingClass('a.ff-button:hover')).toBe('ff-button');
    expect(leadingClass(".ff-button[aria-disabled='true']:not(.ff-button--loading)")).toBe(
      'ff-button',
    );
    expect(leadingClass('.ff-button.cw-bar__jump')).toBe('cw-bar__jump');
    expect(leadingClass('.cw-turn__skeleton.ff-skeleton')).toBe('cw-turn__skeleton');
    expect(leadingClass('.ff-button--primary.ff-button--small')).toBe('ff-button--primary');
    expect(leadingClass('.ff-tab__label[data-text]::after')).toBe('ff-tab__label');
  });
});
