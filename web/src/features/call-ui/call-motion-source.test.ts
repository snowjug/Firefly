import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// How the call screen moves, checked on its stylesheets: a turn arriving fades and rises on plain
// easing, the call controls dip a shallow way on a spring, and nothing that repeats lacks a still
// equivalent for people who asked for less motion. The rules that apply to every stylesheet (times
// from tokens, only transform and opacity in keyframes) are in design/motion.test.ts.

const folder = `${resolve('web/src/features/call-ui')}/`;
const SHEETS = readdirSync(folder).filter((name) => name.endsWith('.css'));
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const read = (name: string) => strip(readFileSync(`${folder}${name}`, 'utf8'));

interface Declaration {
  selector: string;
  property: string;
  value: string;
  within: string[];
  sheet: string;
}

function declarations(sheet: string): Declaration[] {
  const css = read(sheet);
  const found: Declaration[] = [];
  const stack: string[] = [];
  let buffer = '';
  const add = (text: string) => {
    const at = text.indexOf(':');
    if (at <= 0) return;
    found.push({
      sheet,
      selector: [...stack].reverse().find((block) => !block.startsWith('@')) ?? '',
      property: text.slice(0, at).trim(),
      value: text.slice(at + 1).trim(),
      within: stack.filter((block) => block.startsWith('@')),
    });
  };
  for (const char of css) {
    if (char === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (char === '}') {
      if (buffer.trim()) add(buffer.trim());
      buffer = '';
      stack.pop();
    } else if (char === ';') {
      add(buffer.trim());
      buffer = '';
    } else buffer += char;
  }
  return found;
}

const all = SHEETS.flatMap(declarations);
const tokens = strip(readFileSync(resolve('web/src/design/tokens.css'), 'utf8'));
const REDUCED = /prefers-reduced-motion:\s*reduce/;

describe('a turn arriving', () => {
  const rule = all.find((d) => d.selector === '.cw-turn--enter' && d.property === 'animation');

  it('fades and rises a short way, on the component time and plain easing', () => {
    expect(rule?.value).toMatch(/^cw-turn-in var\(--motion-component\) var\(--ease-decelerate\)/);
    const keyframes = all.filter((d) => d.within.some((at) => at === '@keyframes cw-turn-in'));
    expect(keyframes.map((d) => d.property).sort()).toEqual(['opacity', 'transform']);
    expect(keyframes.find((d) => d.property === 'transform')?.value).toBe(
      'translateY(var(--move-sm))',
    );
  });

  it('never bounces: the spring is the call controls’ alone', () => {
    const springs = all.filter((d) => d.value.includes('--ease-spring')).map((d) => d.sheet);
    expect(springs.length).toBeGreaterThan(0);
    expect([...new Set(springs)]).toEqual(['controls.css']);
  });
});

describe('pressing a call control', () => {
  it('dips a shallow way, and the spring brings it back', () => {
    const settle = all.find(
      (d) => d.selector === '.cw-ctl .ff-button' && d.property === 'transition',
    );
    expect(settle?.value).toMatch(/transform var\(--dur-spring\) var\(--ease-spring\)/);
    const press = all.find(
      (d) => d.selector.startsWith('.cw-ctl .ff-button:active') && d.property === 'transform',
    );
    expect(press?.value).toBe('scale(calc(1 - var(--press-grow)))');
    // The token holds it to a few percent, and to nothing at all when motion is reduced.
    const grow = Number(/--press-grow:\s*([\d.]+)/.exec(tokens)?.[1]);
    expect(grow).toBeGreaterThan(0);
    expect(grow).toBeLessThanOrEqual(0.03);
  });
});

describe('what repeats on the call screen', () => {
  const repeating = all.filter((d) => d.property === 'animation' && /\binfinite\b/.test(d.value));

  it('is a ring, a breath, a halo, an arc that turns and three points, and nothing flashes or shakes', () => {
    const names = repeating.map((d) => d.value.split(' ')[0]).sort();
    // The arc turns twice: while connecting, and a slower, quieter turn while something is worked out.
    expect(names).toEqual(['cw-breathe', 'cw-halo', 'cw-ring', 'cw-think', 'cw-turn', 'cw-turn']);
    for (const sheet of SHEETS) {
      expect(read(sheet), sheet).not.toMatch(
        /@keyframes\s+[\w-]*(?:shake|flash|bounce|wobble|blink)/i,
      );
    }
  });

  it('has a still equivalent for each, where motion is reduced', () => {
    for (const d of repeating) {
      const still = all.find(
        (other) =>
          other.sheet === d.sheet &&
          other.selector === d.selector &&
          other.property === 'animation' &&
          other.value === 'none' &&
          other.within.some((at) => REDUCED.test(at)),
      );
      expect(still, `${d.selector} repeats and has no still equivalent`).toBeDefined();
    }
  });
});

describe('the customer’s presence', () => {
  it('follows a voice only where motion is allowed: the level is never a size under reduced motion', () => {
    const followers = all.filter((d) => d.value.includes('--cw-level'));
    expect(followers.length).toBeGreaterThan(0);
    for (const d of followers) {
      expect(
        d.within.some((at) => /prefers-reduced-motion:\s*no-preference/.test(at)),
        `${d.selector} uses the level outside no-preference`,
      ).toBe(true);
    }
  });

  it('smooths the level with a short transition on transform, and never lets it jump or spring', () => {
    const smoothing = all.find(
      (d) =>
        d.property === 'transition' &&
        d.selector.includes('cw-presence__halo') &&
        d.within.some((at) => /no-preference/.test(at)),
    );
    expect(smoothing?.value).toMatch(/transform var\(--dur-fast\) var\(--ease-easy\)/);
    expect(smoothing?.value).not.toMatch(/spring/);
  });

  it('arrives once: a ripple and a slight growth, neither of which repeats', () => {
    for (const name of ['cw-ripple', 'cw-arrive']) {
      const uses = all.filter((d) => d.property === 'animation' && d.value.startsWith(name));
      expect(uses.length, name).toBeGreaterThan(0);
      for (const d of uses) expect(d.value, d.selector).not.toMatch(/\binfinite\b/);
    }
  });

  it('pulses the mood chip once per change, and only transform and opacity move in it', () => {
    const cue = all.find((d) => d.selector === '.cw-mood__cue' && d.property === 'animation');
    expect(cue?.value).toMatch(/^cw-mood-cue var\(--dur-slow\)/);
    expect(cue?.value).not.toMatch(/\binfinite\b/);
    const moved = all
      .filter((d) => d.within.some((at) => at === '@keyframes cw-mood-cue'))
      .map((d) => d.property)
      .sort();
    expect(moved).toEqual(['opacity', 'opacity', 'transform', 'transform']);
  });
});

describe('the captions and the soft guidance', () => {
  it('keep a height of their own, so that nothing moves when they appear or go', () => {
    const strip = all.filter((d) => d.selector === '.cw-captions');
    expect(strip.map((d) => d.property)).toContain('block-size');
    // The words themselves are drawn in a box of fixed height: more of them never grow the page.
    const body = all.filter(
      (d) => d.selector === '.cw-captions__body' && d.property === 'block-size',
    );
    expect(body).toHaveLength(1);
    const guidance = all.find(
      (d) => d.selector === '.cw-ctl__slot' && d.property === 'min-block-size',
    );
    expect(guidance?.value).toBe('var(--target)');
  });

  it('fade and rise by opacity and transform alone', () => {
    const live = all.filter((d) => d.selector === ".cw-captions[data-live='true']");
    expect(live.map((d) => d.property).sort()).toEqual(['opacity', 'transform']);
    const shown = all.filter(
      (d) => d.selector === ".cw-ctl__slot > .cw-ctl__hint[data-visible='true']",
    );
    expect(shown.map((d) => d.property).sort()).toEqual(['opacity', 'transform']);
  });
});
