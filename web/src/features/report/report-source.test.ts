import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The rules for the report's markup and styles that the Content Security Policy and the design
// system depend on, checked on the source itself.

const folder = `${resolve('web/src/features/report')}/`;
const files = readdirSync(folder);
const read = (name: string) => readFileSync(`${folder}${name}`, 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const STYLESHEETS = files.filter((f) => f.endsWith('.css'));
const SOURCES = files.filter((f) => /\.tsx?$/.test(f) && !/\.test\.|fixtures|test-utils/.test(f));
const css = (name: string) => stripComments(read(name));

describe('the report\u2019s stylesheets', () => {
  it('are the five this feature owns', () => {
    expect(STYLESHEETS.sort()).toEqual([
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
    const owner = new Map<string, string>();
    for (const name of STYLESHEETS) {
      for (const [, cls] of css(name).matchAll(/\.(rp-[a-z0-9_-]+)/g)) {
        const was = owner.get(cls as string);
        if (was && was !== name) throw new Error(`${cls} is in both ${was} and ${name}`);
        owner.set(cls as string, name);
      }
    }
    expect(owner.size).toBeGreaterThan(100);
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
});

describe('print', () => {
  const all = STYLESHEETS.map((name) => css(name)).join('\n');

  it('has print rules in the stylesheet of each part that needs them', () => {
    for (const name of ['report.css', 'transcript.css', 'journey.css', 'journey-chart.css']) {
      expect(css(name), name).toMatch(/@media print\s*\{/);
    }
  });

  it('hides the app header and footer, the navigation, the action buttons, the find bar and the Actions section', () => {
    const print = css('report.css').slice(css('report.css').indexOf('@media print'));
    expect(print).toMatch(/\.ff-header/);
    expect(print).toMatch(/\.ff-footer/);
    expect(print).toMatch(/\.rp-nav/);
    expect(print).toMatch(/\.rp-header__actions/);
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

  it('keeps quotes, table rows and facts whole across pages', () => {
    expect(all).toMatch(/\.rp-quote[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-scores tr[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-table tr[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-turn\s*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-fact[^{]*\{[^}]*break-inside:\s*avoid/);
  });

  it('shows links as plain text', () => {
    expect(css('report.css')).toMatch(/@media print[\s\S]*a,[\s\S]*text-decoration:\s*none/);
  });
});

describe('motion, contrast and colour modes', () => {
  it('plays the reveal only where motion is not reduced, and stops it for print', () => {
    const text = css('report.css');
    expect(text).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{[^@]*\.rp-reveal[^@]*animation:\s*rp-reveal/,
    );
    expect(text).toMatch(/@media print[\s\S]*\.rp-reveal[\s\S]*animation:\s*none/);
  });

  it('has forced-colours rules for the parts that draw with colour', () => {
    for (const name of STYLESHEETS)
      expect(css(name), name).toMatch(/@media \(forced-colors: active\)/);
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

  it('writes no console output', () => {
    for (const name of SOURCES) expect(read(name), name).not.toMatch(/console\.(log|debug|info)/);
  });
});
