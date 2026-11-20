import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Page stylesheets load with their page and then stay loaded, so a class that two sheets both style
// as the subject of a rule (not as a scoped override under the page's own class) quietly merges the
// two the next time someone visits both pages. `.cal-bar` was once the sticky "Enter the call" bar
// on the setup page and a 5 rem meter in the mentor tools; the bar went wrong only after visiting
// both. This reads every sheet as text and fails on a second owner.

const styles = join(dirname(fileURLToPath(import.meta.url)));

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

/** A selector without its parenthesised parts: `html:has(.shell .a)` is about html, not about `.shell`. */
const withoutParens = (selector: string): string => {
  let text = selector;
  for (let before = ''; before !== text;) {
    before = text;
    text = text.replace(/\([^()]*\)/g, '');
  }
  return text;
};

/** The leftmost class of a selector: the one the rule is about. A scoped override leads with its page. */
const leadingClass = (selector: string): string | null =>
  /^[^.]*?\.([a-zA-Z_][\w-]*)/.exec(withoutParens(selector))?.[1] ?? null;

// Deliberate second sheets for one class: the report is drawn by report.css and restyled by
// debrief.css (both load together with the report), `.ff-section__head` has one print-only rule in
// debrief.css, and a few primitives are extended where they are used. Add to this only with a reason.
const SHARED = new Set(['ff-dialog', 'ff-section__head', 'palette', 'skip-link', 'text-link']);
const isShared = (name: string) => SHARED.has(name) || name === 'rp' || name.startsWith('rp-');

describe('stylesheets', () => {
  const owners = new Map<string, Set<string>>();
  for (const file of readdirSync(styles).filter((name) => name.endsWith('.css'))) {
    for (const selector of selectorsOf(readFileSync(join(styles, file), 'utf8'))) {
      const name = leadingClass(selector);
      if (!name) continue;
      if (!owners.has(name)) owners.set(name, new Set());
      owners.get(name)!.add(file);
    }
  }

  it('give each class one owner, so visiting two pages never merges their rules', () => {
    const clashes = [...owners]
      .filter(([name, files]) => files.size > 1 && !isShared(name))
      .map(([name, files]) => `.${name}: ${[...files].sort().join(', ')}`);
    expect(clashes).toEqual([]);
  });

  it('can tell a clash when there is one', () => {
    expect(selectorsOf('.a, .b:is(.c, .d) { x: y }')).toEqual(['.a', '.b:is(.c, .d)']);
    expect(leadingClass('.page .a')).toBe('page');
    expect(leadingClass(':root[data-x] .a')).toBe('a');
    expect(leadingClass('html:has(.shell .a)')).toBeNull();
  });
});
