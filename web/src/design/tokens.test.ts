import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The tokens are the single source of colour, so this reads tokens.css as text and checks the pairs
// the interface actually puts together. WCAG 2.2 AA: 4.5:1 for text, 3:1 for the edge of a control.

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The first :root block: the light theme. Later blocks only adjust it for a preference. */
function rootBlock(): string {
  const start = css.indexOf(':root {');
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(start, i);
  }
  throw new Error('tokens.css has no :root block');
}

const declared = new Map<string, string>();
for (const [, name, value] of rootBlock().matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
  declared.set(name as string, (value as string).trim());
}

function resolve(name: string): string {
  let value = declared.get(name);
  if (value === undefined) throw new Error(`--${name} is not a token`);
  for (let depth = 0; depth < 5; depth += 1) {
    const alias = /^var\(--([\w-]+)\)$/.exec(value);
    if (!alias) break;
    value = declared.get(alias[1] as string);
    if (value === undefined) throw new Error(`--${name} points at a missing token`);
  }
  return value;
}

function rgb(name: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(resolve(name));
  if (!hex) throw new Error(`--${name} is not a six digit colour: ${resolve(name)}`);
  const n = parseInt(hex[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(foreground: string, background: string): number {
  const [a, b] = [luminance(rgb(foreground)), luminance(rgb(background))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const STATES = ['calm', 'concerned', 'frustrated', 'angry', 'escalating', 'recovering'];
const STATUSES = ['success', 'warning', 'danger', 'info', 'neutral'];
const SURFACES = ['bg-canvas', 'bg-quiet', 'bg-subtle', 'bg-section'];
const TEXTS = ['fg-1', 'fg-2', 'fg-3'];

const textPairs: [string, string][] = [
  // Body text on every page surface.
  ...TEXTS.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as [string, string])),
  // Text on the fills that hover, press and select use.
  ['fg-1', 'bg-hover'],
  ['fg-1', 'bg-pressed'],
  ['fg-1', 'bg-strong'],
  ['fg-2', 'bg-strong'],
  ['fg-3', 'bg-strong'],
  ['fg-1', 'bg-selected'],
  // The brand: white on blue, blue on white and on its own tint.
  ['fg-on-brand', 'brand'],
  ['fg-on-brand', 'brand-hover'],
  ['fg-on-brand', 'brand-pressed'],
  ['fg-on-brand', 'brand-selected'],
  ['brand-fg', 'bg-canvas'],
  ['brand-fg-2', 'bg-canvas'],
  ['brand-fg-2', 'bg-quiet'],
  ['brand-fg-2', 'brand-tint'],
  ['brand-fg-2', 'brand-tint-hover'],
  ['fg-1', 'brand-tint'],
  ['fg-2', 'brand-tint'],
  // Destructive actions.
  ['fg-on-brand', 'danger'],
  ['fg-on-brand', 'danger-hover'],
  ['fg-on-brand', 'danger-pressed'],
  // Every status and every customer state on its own tinted ground, and the status text on white.
  ...STATUSES.map((s) => [`status-${s}-fg`, `status-${s}-bg`] as [string, string]),
  ['status-danger-fg', 'bg-canvas'],
  ['status-warning-fg', 'bg-canvas'],
  ['status-success-fg', 'bg-canvas'],
  ...STATES.map((s) => [`state-${s}-fg`, `state-${s}-bg`] as [string, string]),
  // Analysis written by the evaluator.
  ['ai-fg', 'ai-bg'],
  ['ai-fg', 'bg-canvas'],
];

describe('tokens: text contrast', () => {
  it.each(textPairs)('%s on %s is at least 4.5:1', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the lightest text Firefly uses at 4.5:1 or better on every surface', () => {
    for (const surface of SURFACES) {
      expect(contrast('fg-3', surface), `fg-3 on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('tokens: edges and graphics', () => {
  it('draws the edge of a control (--stroke-accessible) at 3:1 or better on white', () => {
    expect(contrast('stroke-accessible', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast('stroke-accessible', 'bg-quiet')).toBeGreaterThanOrEqual(3);
  });

  it('draws the selected edge and the error edge at 3:1 or better', () => {
    expect(contrast('brand-stroke', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast('brand-stroke', 'brand-tint')).toBeGreaterThanOrEqual(3);
    expect(contrast('status-danger-fg', 'bg-canvas')).toBeGreaterThanOrEqual(3);
  });

  it('draws the focus ring at 3:1 or better on white and on the brand blue', () => {
    expect(contrast('focus-outer', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast('focus-outer', 'brand')).toBeGreaterThanOrEqual(3);
    expect(contrast('focus-inner', 'focus-outer')).toBeGreaterThanOrEqual(3);
  });

  it('draws both voices of the waveform at 3:1 or better on white', () => {
    expect(contrast('voice-trainee', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast('voice-customer', 'bg-canvas')).toBeGreaterThanOrEqual(3);
  });

  it('draws filled bars and switch thumbs at 3:1 or better on their tracks', () => {
    expect(contrast('brand', 'bg-strong')).toBeGreaterThanOrEqual(3);
    expect(contrast('status-success-fg', 'bg-strong')).toBeGreaterThanOrEqual(3);
    expect(contrast('fg-2', 'bg-canvas')).toBeGreaterThanOrEqual(3);
  });

  it('is a light theme and has no raw dark values to fall back on', () => {
    expect(css).toMatch(/color-scheme:\s*light\s*;/);
    expect(css).not.toMatch(/color-scheme:\s*[^;]*dark/);
    expect(contrast('bg-canvas', 'fg-1')).toBeGreaterThan(15);
  });
});

describe('tokens: sizes', () => {
  it('keeps the default control height at the 44 px target and the smallest above the 24 px floor', () => {
    const px = (name: string) => {
      const value = resolve(name);
      const rem = /^([\d.]+)rem$/.exec(value);
      if (!rem) throw new Error(`--${name} is not in rem: ${value}`);
      return Number(rem[1]) * 16;
    };
    expect(px('ctl-md')).toBeGreaterThanOrEqual(44);
    expect(px('ctl-lg')).toBeGreaterThanOrEqual(44);
    expect(px('ctl-sm')).toBeGreaterThanOrEqual(24);
    expect(px('target-min')).toBeGreaterThanOrEqual(24);
  });
});

/** The declarations of the `prefers-reduced-motion: reduce` block's :root rule. */
function reducedMotionTokens(): Map<string, string> {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  if (start < 0) throw new Error('tokens.css has no reduced-motion block');
  let depth = 0;
  let end = css.length;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  const tokens = new Map<string, string>();
  for (const [, name, value] of css.slice(start, end).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(name as string, (value as string).trim());
  }
  return tokens;
}

describe('tokens: motion', () => {
  const motion = [...declared.keys()].filter((name) => /^(dur|move|press)-/.test(name));
  const reduced = reducedMotionTokens();

  it('has a duration, a travel and a press token for every kind of movement', () => {
    expect(motion.filter((name) => name.startsWith('dur-')).length).toBeGreaterThanOrEqual(12);
    expect(motion).toEqual(expect.arrayContaining(['move-xs', 'move-sm', 'press-shift']));
  });

  it.each(motion)('--%s has a still equivalent when the person asks for less motion', (name) => {
    const value = reduced.get(name);
    expect(value, `--${name} is not set in the prefers-reduced-motion block`).toBeDefined();
    // Durations collapse to an instant and distances to nothing: a state change, not a movement.
    expect(value).toMatch(name.startsWith('dur-') ? /^0\.01ms$/ : /^0(px)?$/);
  });

  it('keeps no motion token in the reduced-motion block that the light theme does not declare', () => {
    const strays = [...reduced.keys()].filter((name) => !declared.has(name));
    expect(strays).toEqual([]);
  });
});
