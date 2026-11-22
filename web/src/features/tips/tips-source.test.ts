import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// What the tips folder may import, and what its stylesheet may do, checked on the source itself. The
// strip teaches general behaviour in Guided practice: it must not be able to reach a scenario or the
// state of a call, it announces nothing, nothing in it runs on a timer, and its effects are for a
// mouse only.

const folder = `${resolve('web/src/features/tips')}/`;
const files = readdirSync(folder);
const read = (name: string) => readFileSync(`${folder}${name}`, 'utf8');
const SOURCES = files.filter((name) => /\.tsx?$/.test(name) && !/\.test\./.test(name));
const STYLESHEETS = files.filter((name) => name.endsWith('.css'));
const stripCss = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const stripCode = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const css = () => stripCss(read('tips.css'));

interface Declaration {
  selector: string;
  property: string;
  value: string;
  within: string[];
}

/** Every declaration, with the selector of its rule and the at-rules it sits inside. */
function declarations(sheet: string): Declaration[] {
  const found: Declaration[] = [];
  const stack: string[] = [];
  let buffer = '';
  const add = (text: string) => {
    const at = text.indexOf(':');
    if (at <= 0) return;
    found.push({
      selector: [...stack].reverse().find((block) => !block.startsWith('@')) ?? '',
      property: text.slice(0, at).trim(),
      value: text.slice(at + 1).trim(),
      within: stack.filter((block) => block.startsWith('@')),
    });
  };
  for (const char of sheet) {
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

const FINE_POINTER = /\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/;

/** Every import in a file: whether it is `import type`, and where from. */
function imports(text: string): { isType: boolean; from: string }[] {
  const found: { isType: boolean; from: string }[] = [];
  for (const match of text.matchAll(/^import\s+(type\s+)?[^;]*?\s+from\s+['"]([^'"]+)['"]/gm)) {
    found.push({ isType: Boolean(match[1]), from: match[2] as string });
  }
  for (const match of text.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) {
    found.push({ isType: false, from: match[1] as string });
  }
  return found;
}

describe('what the tips folder imports', () => {
  it('finds its sources', () => {
    expect(SOURCES).toEqual(
      expect.arrayContaining([
        'TipsStrip.tsx',
        'selection.ts',
        'tips.ts',
        'use-deck-gestures.ts',
        'use-tip-deck.ts',
      ]),
    );
    expect(STYLESHEETS).toEqual(['tips.css']);
  });

  it('is React, the design system and itself: no scenario, no call, no server, no schema library', () => {
    for (const name of SOURCES) {
      for (const { from } of imports(read(name))) {
        const allowed =
          from === 'react' ||
          from === '../../design/index.ts' ||
          /^\.\/[\w-]+\.(?:tsx?|css)$/.test(from);
        expect(allowed, `${name} imports ${from}`).toBe(true);
      }
    }
  });

  it('keeps the tips and what picks them free of anything but types and each other', () => {
    for (const name of ['tips.ts', 'selection.ts']) {
      for (const { isType, from } of imports(read(name))) {
        const sibling = /^\.\/[\w-]+\.ts$/.test(from);
        expect(isType || sibling, `${name} imports ${from} as a value`).toBe(true);
      }
    }
  });

  it('never mentions a scenario, a hidden fact, the customer’s state or a complication in code', () => {
    for (const name of SOURCES) {
      expect(stripCode(read(name)), name).not.toMatch(
        /scenario|hiddenFact|temperature|curveball|discover|customerState|stateHistory|product|persona/i,
      );
    }
  });
});

describe('what the tips never do', () => {
  it('announce nothing: no live region, no announcer', () => {
    for (const name of SOURCES) {
      const code = stripCode(read(name));
      expect(code, name).not.toMatch(/aria-live|role=["'](?:status|alert|log)["']|useAnnouncer/);
    }
  });

  it('rotate on no timer, and the choice of a tip uses none', () => {
    for (const name of ['TipsStrip.tsx', 'use-tip-deck.ts', 'selection.ts', 'tips.ts']) {
      expect(stripCode(read(name)), name).not.toMatch(
        /setInterval|setTimeout|requestAnimationFrame|useLoopClock|Date\.now|performance\.now/,
      );
    }
  });

  it('write no inline style, no raw HTML and no console output', () => {
    for (const name of SOURCES) {
      const code = stripCode(read(name));
      expect(code, name).not.toMatch(/\bstyle=/);
      expect(code, name).not.toMatch(/dangerouslySetInnerHTML|<style[\s>]/);
      expect(code, name).not.toMatch(/console\./);
    }
  });

  it('keep nothing between calls: no storage, no cookie', () => {
    for (const name of SOURCES) {
      expect(stripCode(read(name)), name).not.toMatch(
        /localStorage|sessionStorage|document\.cookie|indexedDB/,
      );
    }
  });
});

describe('the tips stylesheet', () => {
  const all = () => declarations(css());

  it('is written in tp- classes, apart from the design system’s own', () => {
    const classes = [...css().matchAll(/\.([a-z][\w-]*)/g)].map((match) => match[1] as string);
    expect(classes.filter((name) => name.startsWith('tp-')).length).toBeGreaterThan(10);
    expect(classes.filter((name) => !/^(?:tp|ff)-/.test(name))).toEqual([]);
  });

  it('uses no raw colour: tokens and system colours only', () => {
    expect(css()).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css()).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/i);
  });

  it('shakes nothing, flashes nothing and repeats nothing', () => {
    expect(css()).not.toMatch(/@keyframes/);
    expect(css()).not.toMatch(
      /infinite|animation-iteration-count|shake|flash|bounce|wobble|blink|pulse/i,
    );
    for (const d of all().filter((x) => x.property === 'animation')) {
      expect(d.value, d.selector).toMatch(/^ff-enter\b/);
    }
  });

  it('moves only by transform, opacity and colour, never by size, position or spacing', () => {
    for (const d of all().filter((x) => x.property === 'transition')) {
      expect(d.value, `${d.selector}: ${d.value}`).not.toMatch(
        /(?:^|[\s,])(?:all|width|height|inline-size|block-size|top|left|right|bottom|inset|margin|padding)\b/,
      );
    }
  });

  it('keeps the spring for a card that was let go after a drag, under a mouse', () => {
    const springs = all().filter((d) => d.value.includes('--ease-spring'));
    expect(springs.length).toBeGreaterThan(0);
    for (const d of springs) {
      expect(d.selector, d.value).toContain("[data-motion='spring']");
      expect(
        d.within.some((at) => FINE_POINTER.test(at)),
        d.selector,
      ).toBe(true);
    }
  });

  it('lifts, tilts, lights and presses only the card in hand, only under a mouse', () => {
    const effects = all().filter((d) => d.selector.includes("[data-fx='on']"));
    expect(effects.length).toBeGreaterThan(3);
    for (const d of effects) {
      expect(d.selector, d.property).toContain('[data-current]');
      expect(
        d.within.some((at) => FINE_POINTER.test(at)),
        d.selector,
      ).toBe(true);
    }
  });

  it('gives the keyboard the same prominence as the mouse, without the tilt', () => {
    const focus = all().filter((d) => d.selector.includes(':has(:focus-visible)'));
    expect(focus.some((d) => d.property === '--_lift')).toBe(true);
    expect(focus.some((d) => d.property === 'box-shadow')).toBe(true);
    expect(focus.filter((d) => /tilt/.test(d.property + d.value))).toEqual([]);
  });

  it('reserves its space: the strip does not flex, the window has a floor, the “Learn why” card floats', () => {
    const rule = (selector: string, property: string) =>
      all().find((d) => d.selector.trim() === selector && d.property === property)?.value;
    expect(rule('.tp-strip', 'flex')).toBe('none');
    expect(rule('.tp-deck', 'min-block-size')).toBe('var(--_deck-h)');
    expect(rule('.tp-deck', 'overflow')).toBe('hidden');
    expect(rule('.tp-card', 'flex')).toBe('0 0 var(--_card)');
    // Opening “Learn why” moves nothing: it is laid over the transcript, above the strip.
    expect(rule('.tp-why', 'position')).toBe('absolute');
    expect(rule('.tp-why', 'inset-block-end')).toMatch(/100%/);
  });

  it('has no peek of the next card on a phone, and a rule for forced colours', () => {
    const phone = all().filter((d) => d.within.some((at) => /max-width:\s*39\.99em/.test(at)));
    expect(
      phone.find((d) => d.selector.trim() === '.tp-strip' && d.property === '--_peek')?.value,
    ).toBe('0rem');
    expect(css()).toMatch(/@media \(forced-colors: active\)/);
  });

  it('gives the quieter buttons a 44 px target under a finger', () => {
    const coarse = all().filter((d) => d.within.some((at) => /pointer:\s*coarse/.test(at)));
    const selectors = coarse.map((d) => d.selector).join(' ');
    expect(selectors).toContain('tp-strip__hide');
    expect(selectors).toContain('tp-card__why');
    expect(selectors).toContain('tp-strip--quiet');
    for (const d of coarse) expect(d.value).toBe('var(--target)');
  });
});
