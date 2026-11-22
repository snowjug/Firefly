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

  it('is a ring, a breath and three points, and nothing flashes or shakes', () => {
    const names = repeating.map((d) => d.value.split(' ')[0]).sort();
    expect(names).toEqual(['cw-breathe', 'cw-ring', 'cw-think']);
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
