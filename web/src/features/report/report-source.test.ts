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
  it('are the ten this feature owns, one for each part of the page', () => {
    expect([...STYLESHEETS].sort()).toEqual([
      'coaching.css',
      'journey-chart.css',
      'journey.css',
      'report.css',
      'scores.css',
      'states.css',
      'summary.css',
      'timeline.css',
      'transcript.css',
      'wording.css',
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

  /** Every declaration with the selector of its rule and the at-rules it sits inside. */
  function rulesOf(sheet: string) {
    const found: { selector: string; property: string; value: string; within: string[] }[] = [];
    const stack: string[] = [];
    let buffer = '';
    const within = () => stack.filter((prelude) => prelude.startsWith('@'));
    const record = (text: string) => {
      const at = text.indexOf(':');
      const selector = stack[stack.length - 1];
      if (at > 0 && selector !== undefined && !selector.startsWith('@')) {
        found.push({
          selector,
          property: text.slice(0, at).trim(),
          value: text.slice(at + 1).trim(),
          within: within(),
        });
      }
    };
    for (const char of sheet) {
      if (char === '{') {
        stack.push(buffer.trim());
        buffer = '';
      } else if (char === '}') {
        record(buffer.trim());
        buffer = '';
        stack.pop();
      } else if (char === ';') {
        record(buffer.trim());
        buffer = '';
      } else buffer += char;
    }
    return found;
  }

  // Paper does not move: a part of the design system (a score bar, a disclosure's panel) that starts an
  // animation when the page is made ready to print would be caught on its first frame.
  const off = (value: string) => /^none(\s*!important)?$/.test(value);

  it('plays every animation only where motion is not reduced (or switches it off for paper)', () => {
    const animations = all.filter((d) => /^animation(-name|-delay)?$/.test(d.property));
    expect(animations.length).toBeGreaterThan(5);
    for (const d of animations) {
      const ok =
        off(d.value) || d.within.some((at) => /prefers-reduced-motion:\s*no-preference/.test(at));
      expect(ok, `${d.name}: ${d.property}: ${d.value}`).toBe(true);
    }
  });

  it('switches every animation inside the report off on paper, the design system’s included', () => {
    const paper = rulesOf(css('report.css')).find(
      (rule) =>
        rule.selector.startsWith('.rp-page *') &&
        rule.property === 'animation' &&
        rule.within.includes('@media print'),
    );
    expect(paper?.value).toBe('none !important');
  });

  // What an entrance starts from (a block that waits to come in, a line at nothing, a number at 0) is
  // only ever drawn on a screen where motion is allowed. On paper, for a person who asked for less and
  // for a script that never runs, the page is whole: a start state that print can see is a bug.
  it('draws what an entrance starts from only on a screen, where motion is allowed', () => {
    const STARTS =
      /\[data-draw=['"]wait['"]\]|:not\(\[data-(?:revealed|drawn)\]\)|\[data-counting\]/;
    const starts = STYLESHEETS.flatMap((name) =>
      rulesOf(css(name))
        .filter((rule) => STARTS.test(rule.selector))
        .map((rule) => ({ ...rule, name })),
    );
    expect(starts.length).toBeGreaterThan(5);
    for (const rule of starts) {
      expect(
        rule.within.some((at) =>
          /^@media screen and \(prefers-reduced-motion:\s*no-preference\)$/.test(at),
        ),
        `${rule.name}: ${rule.selector} { ${rule.property}: ${rule.value} }`,
      ).toBe(true);
    }
  });

  // The turn an evidence link led to is marked by an overlay that fades by opacity alone: its colour
  // is not animated, so the words are never over a colour in the middle of a change.
  it('marks the turn a link led to with an overlay whose opacity is the only thing that moves', () => {
    const overlay = rulesOf(css('transcript.css')).filter(
      (rule) => rule.selector === '.rp-turn::before',
    );
    const transition = overlay.find((rule) => rule.property === 'transition');
    expect(transition?.value).toMatch(/^opacity var\(--dur-/);
    expect(transition?.value).not.toMatch(/background|color|shadow/);
    expect(overlay.find((rule) => rule.property === 'opacity')?.value).toBe('0');
  });

  // The card that suggests the next call lifts under a mouse, as the scenario cards do, but only for
  // a pointer that can hover and where the page has switched the effects on (data-fx): a touch screen,
  // reduced motion and a slow display never get it. The press settles it everywhere, by --press-grow,
  // which is nothing when motion is reduced.
  it('lifts the next practice card only for a fine hovering pointer with the effects on', () => {
    const lift = rulesOf(css('report.css')).filter(
      (rule) =>
        rule.selector.startsWith(".rp-next[data-fx='on']:hover") && rule.property === 'transform',
    );
    expect(lift.length).toBeGreaterThan(1);
    for (const rule of lift) {
      expect(rule.within).toContain('@media (hover: hover) and (pointer: fine)');
    }
    expect(lift.map((rule) => rule.value).join(' ')).toMatch(/--move-lift/);
    expect(lift.map((rule) => rule.value).join(' ')).toMatch(/--press-grow/);
    const press = rulesOf(css('report.css')).find(
      (rule) => rule.selector === '.rp-next:active' && rule.property === 'transform',
    );
    expect(press?.value).toMatch(/--press-grow/);
  });

  // The whole card is the button's target: its link's ::after is stretched over the card. A press gives a
  // button a transform of its own, and that would make the button the box the stretch is measured from,
  // so the target would shrink to the button as the press began and a press away from it would follow
  // nothing. The press must leave the button where it is.
  it('does not move the next practice button when it is pressed, so its stretched target stays the card', () => {
    const rules = rulesOf(css('report.css'));
    const stretch = rules.find(
      (rule) => rule.selector === '.rp-next__cta::after' && rule.property === 'inset',
    );
    expect(stretch?.value).toBe('0');
    const press = rules.find(
      (rule) =>
        rule.selector === '.rp-next .ff-button.rp-next__cta:active' &&
        rule.property === 'transform',
    );
    expect(press?.value).toBe('none');
  });

  it('takes durations from the shared tokens, and never transitions everything', () => {
    for (const d of all.filter((x) => x.property === 'transition' || x.property === 'animation')) {
      if (off(d.value)) continue;
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
  const printRules = (name: string) => css(name).slice(css(name).indexOf('@media print'));

  it('has print rules in the stylesheet of each part that needs them', () => {
    for (const name of [
      'report.css',
      'summary.css',
      'timeline.css',
      'scores.css',
      'coaching.css',
      'wording.css',
      'transcript.css',
      'journey.css',
      'journey-chart.css',
    ]) {
      expect(css(name), name).toMatch(/@media print\s*\{/);
    }
  });

  it('hides the app header and footer, the navigation, the words that name a toggle and the Actions section', () => {
    const print = printRules('report.css');
    expect(print).toMatch(/\.ff-header/);
    expect(print).toMatch(/\.ff-footer/);
    expect(print).toMatch(/\.rp-nav/);
    expect(print).toMatch(/\.rp-more/);
    expect(print).toMatch(/#actions/);
    expect(print).toMatch(/display:\s*none\s*!important/);
    expect(printRules('summary.css')).toMatch(
      /\.rp-exec__actions\s*\{\s*display:\s*none\s*!important/,
    );
    expect(printRules('scores.css')).toMatch(
      /\.rp-skill__toggle[^{]*\{\s*display:\s*none\s*!important/,
    );
    const transcript = printRules('transcript.css');
    expect(transcript).toMatch(/\.rp-tools/);
    expect(transcript).toMatch(/\.rp-back/);
  });

  it('opens what is closed: score details and the CARE panels all show, and the selector goes', () => {
    expect(printRules('scores.css')).toMatch(
      /\.rp-skill__panel\[hidden\]\s*\{\s*display:\s*block\s*!important/,
    );
    expect(printRules('scores.css')).toMatch(
      /\.rp-care__tabs[^{]*\{\s*display:\s*none\s*!important/,
    );
    expect(printRules('scores.css')).toMatch(/\.rp-care \.ff-tabpanel--stacked/);
  });

  it('shows the print header, and sets the page black on white', () => {
    expect(css('report.css')).toMatch(/\.rp-print-head\s*\{\s*display:\s*block/);
    expect(css('report.css')).toMatch(/@page\s*\{/);
    expect(css('report.css')).toMatch(/color:\s*CanvasText/);
    expect(css('report.css')).toMatch(/background:\s*Canvas/);
  });

  it('keeps quotes, rows, facts, moments, wording and turns whole across pages', () => {
    expect(all).toMatch(/\.rp-quote[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-skill\b[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-table tr[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-turn\s*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-fact[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-moment[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-bw\s*\{[^}]*break-inside:\s*avoid/);
    expect(all).toMatch(/\.rp-tl__printitem[^{]*\{[^}]*break-inside:\s*avoid/);
  });

  it('shows links as plain text', () => {
    expect(css('report.css')).toMatch(/@media print[\s\S]*a\s*\{[^}]*text-decoration:\s*none/);
  });
});

describe('the markup', () => {
  it('has no inline style attribute written as a string, style tag or raw HTML in any component', () => {
    for (const name of SOURCES) {
      const text = read(name);
      // `style={...}` is React setting properties on the element through the CSSOM, which the Content
      // Security Policy (style-src 'self') allows: the stagger of a block (`--reveal-i`) and the
      // place of a chart's markers are set that way. A style attribute written as a string, or a
      // <style> element, is what it blocks.
      expect(text, name).not.toMatch(/\bstyle=["']/);
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
