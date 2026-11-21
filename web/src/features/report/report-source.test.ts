import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The rules for the report's markup and styles that the Content Security Policy, the design system
// and the performance budget depend on, checked on the source itself.

const folder = `${resolve('web/src/features/report')}/`;
const files = readdirSync(folder);
const read = (name: string) => readFileSync(`${folder}${name}`, 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const STYLESHEETS = files.filter((f) => f.endsWith('.css'));
const SOURCES = files.filter((f) => /\.tsx?$/.test(f) && !/\.test\.|fixtures|test-utils/.test(f));
const css = (name: string) => stripComments(read(name));

/** Every declaration in a stylesheet with the at-rules it sits inside, innermost last. */
function declarations(sheet: string): { property: string; value: string; within: string[] }[] {
  const found: { property: string; value: string; within: string[] }[] = [];
  const stack: string[] = [];
  let buffer = '';
  for (const char of sheet) {
    if (char === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (char === '}') {
      const last = buffer.trim();
      if (last.includes(':')) {
        const at = last.indexOf(':');
        found.push({
          property: last.slice(0, at).trim(),
          value: last.slice(at + 1).trim(),
          within: stack.filter((s) => s.startsWith('@')),
        });
      }
      buffer = '';
      stack.pop();
    } else if (char === ';') {
      const at = buffer.indexOf(':');
      if (at > 0) {
        found.push({
          property: buffer.slice(0, at).trim(),
          value: buffer.slice(at + 1).trim(),
          within: stack.filter((s) => s.startsWith('@')),
        });
      }
      buffer = '';
    } else buffer += char;
  }
  return found;
}

describe('the report\u2019s stylesheets', () => {
  it('are the five this feature owns', () => {
    expect([...STYLESHEETS].sort()).toEqual([
      'journey-chart.css',
      'journey.css',
      'report.css',
      'states.css',
      'transcript.css',
    ]);
  });

  it('use no raw colour values: tokens and system colours only', () => {
    for (const name of STYLESHEETS) {
      const text = css(name);
      expect(text, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, name).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/i);
    }
  });

  it('give every class to exactly one stylesheet', () => {
    // A class belongs to the stylesheet where a rule is about it: the first class in the selector.
    // `.rp-move > .rp-quote` is about the move, so it may sit beside the move's own rules.
    const owner = new Map<string, string>();
    for (const name of STYLESHEETS) {
      for (const [, selectors] of css(name).matchAll(/(?:^|[}{;])\s*([^{};@]+)\{/g)) {
        for (const selector of (selectors as string).split(',')) {
          const subject = selector.match(/\.(rp-[a-z0-9_-]+)/)?.[1];
          if (!subject) continue;
          const was = owner.get(subject);
          if (was && was !== name) throw new Error(`${subject} is in both ${was} and ${name}`);
          owner.set(subject, name);
        }
      }
    }
    expect(owner.size).toBeGreaterThan(150);
  });

  it('style every class the components use, apart from the few that are only hooks', () => {
    const defined = new Set(
      STYLESHEETS.flatMap((name) =>
        [...css(name).matchAll(/\.(rp-[a-z0-9_-]+)/g)].map((m) => m[1]),
      ),
    );
    const used = new Set<string>();
    for (const name of SOURCES) {
      for (const [, cls] of read(name).matchAll(/['"`{ ](rp-[a-z0-9_-]+)/g))
        used.add(cls as string);
    }
    const hooksOnly = new Set(['rp-marker--cites']);
    const missing = [...used].filter(
      (cls) => !defined.has(cls) && !hooksOnly.has(cls) && !cls.endsWith('-'),
    );
    expect(missing).toEqual([]);
  });

  it('style nothing the components never use', () => {
    const used = new Set<string>();
    for (const name of SOURCES) {
      for (const [, cls] of read(name).matchAll(/['"`{ ](rp-[a-z0-9_-]+)/g))
        used.add(cls as string);
      // Classes built from a name: rp-chart__stripe--calm, rp-chart__marker--escalating.
      for (const [, base] of read(name).matchAll(/(rp-[a-z0-9_-]+--)\$\{/g)) used.add(`${base}*`);
    }
    const prefixes = [...used].filter((c) => c.endsWith('*')).map((c) => c.slice(0, -1));
    const defined = new Set(
      STYLESHEETS.flatMap((name) =>
        [...css(name).matchAll(/\.(rp-[a-z0-9_-]+)/g)].map((m) => m[1] as string),
      ),
    );
    const unused = [...defined].filter(
      (cls) =>
        !used.has(cls) &&
        !prefixes.some((prefix) => cls.startsWith(prefix)) &&
        // Joined with a state attribute or written into a template string in a component.
        !read('ReportView.tsx').includes(cls),
    );
    expect(unused).toEqual([]);
  });
});

describe('motion', () => {
  const all = STYLESHEETS.flatMap((name) => declarations(css(name)).map((d) => ({ ...d, name })));

  it('plays every animation only where motion is not reduced (or switches it off for paper)', () => {
    const animations = all.filter((d) => /^animation(-name|-delay)?$/.test(d.property));
    expect(animations.length).toBeGreaterThan(5);
    for (const d of animations) {
      const ok =
        d.value === 'none' ||
        d.within.some((at) => /prefers-reduced-motion:\s*no-preference/.test(at));
      expect(ok, `${d.name}: ${d.property}: ${d.value}`).toBe(true);
    }
  });

  it('takes durations from the shared tokens, and never transitions everything', () => {
    for (const d of all.filter((x) => x.property === 'transition' || x.property === 'animation')) {
      if (d.value === 'none') continue;
      expect(d.value, `${d.name}: ${d.property}`).toMatch(/var\(--dur-/);
      expect(d.value, `${d.name}: ${d.property}`).not.toMatch(/\ball\b/);
    }
    for (const d of all.filter((x) => x.property === 'transition-property')) {
      expect(d.value).not.toMatch(/\ball\b/);
    }
  });

  it('animates only transform and opacity: no width, height, position, margin or padding', () => {
    const keyframes = STYLESHEETS.flatMap((name) =>
      declarations(css(name)).filter((d) => d.within.some((at) => at.startsWith('@keyframes'))),
    );
    expect(keyframes.length).toBeGreaterThan(3);
    for (const d of keyframes) expect(['transform', 'opacity']).toContain(d.property);
    for (const d of all.filter((x) => x.property === 'transition')) {
      expect(d.value, `${d.name}: ${d.value}`).not.toMatch(
        /(?:^|[\s,])(?:width|height|inline-size|block-size|top|left|right|bottom|inset|margin|padding)\b/,
      );
    }
  });

  it('has forced-colours rules for the parts that draw with colour', () => {
    for (const name of STYLESHEETS) {
      expect(css(name), name).toMatch(/@media \(forced-colors: active\)/);
    }
  });
});

describe('print', () => {
  const all = STYLESHEETS.map((name) => css(name)).join('\n');

  it('has print rules in the stylesheet of each part that needs them', () => {
    for (const name of ['report.css', 'transcript.css', 'journey.css', 'journey-chart.css']) {
      expect(css(name), name).toMatch(/@media print\s*\{/);
    }
  });

  it('hides the app header and footer, the navigation, the words that name a toggle and the Actions section', () => {
    const text = css('report.css');
    const print = text.slice(text.indexOf('@media print'));
    expect(print).toMatch(/\.ff-header/);
    expect(print).toMatch(/\.ff-footer/);
    expect(print).toMatch(/\.rp-nav/);
    expect(print).toMatch(/\.rp-header__actions/);
    expect(print).toMatch(/\.rp-row__toggle/);
    expect(print).toMatch(/\.rp-more/);
    expect(print).toMatch(/#actions/);
    expect(print).toMatch(/display:\s*none\s*!important/);
    const transcript = css('transcript.css').slice(css('transcript.css').indexOf('@media print'));
    expect(transcript).toMatch(/\.rp-tools/);
    expect(transcript).toMatch(/\.rp-back/);
  });

  it('shows the print header, and sets the page black on white', () => {
    expect(css('report.css')).toMatch(/\.rp-print-head\s*\{\s*display:\s*block/);
    expect(css('report.css')).toMatch(/@page\s*\{/);
    expect(css('report.css')).toMatch(/color:\s*CanvasText/);
    expect(css('report.css')).toMatch(/background:\s*Canvas/);
  });

  it('keeps quotes, rows, facts and turns whole across pages', () => {
    expect(all).toMatch(/\.rp-quote[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-row,[\s\S]*?break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-table tr[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-turn\s*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-fact[^{]*\{[^}]*break-inside:\s*avoid/);
  });

  it('shows links as plain text', () => {
    expect(css('report.css')).toMatch(/@media print[\s\S]*a\s*\{[^}]*text-decoration:\s*none/);
  });
});

describe('the markup', () => {
  it('has no inline style attribute, style tag or raw HTML in any component', () => {
    for (const name of SOURCES) {
      const text = read(name);
      expect(text, name).not.toMatch(/\bstyle=/);
      expect(text, name).not.toMatch(/<style[\s>]/);
      expect(text, name).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });

  it('has no inline event handler attribute written as a string', () => {
    for (const name of SOURCES) {
      expect(read(name), name).not.toMatch(/\bon[a-z]+=["']/);
    }
  });

  it('writes no console output', () => {
    for (const name of SOURCES) expect(read(name), name).not.toMatch(/console\.(log|debug|info)/);
  });

  it('imports only plain data from the shared domain at run time, never anything that pulls in zod', () => {
    const allowed = new Set(['vocab', 'state', 'text']);
    for (const name of SOURCES) {
      for (const [statement, source] of read(name).matchAll(
        /^import\s+(?!type\b)[^;]*?from\s+'#shared\/domain\/([a-z-]+)\.ts';/gm,
      )) {
        expect(allowed.has(source as string), `${name}: ${statement.split('\n')[0]}`).toBe(true);
      }
    }
  });

  it('does not import zod or the server', () => {
    for (const name of SOURCES) {
      expect(read(name), name).not.toMatch(/from\s+'zod'/);
      expect(read(name), name).not.toMatch(/#server\//);
    }
  });
});
