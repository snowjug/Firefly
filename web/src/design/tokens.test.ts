import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The tokens are the single source of colour, so this reads tokens.css as text and checks the pairs
// the interface actually puts together, in BOTH themes. WCAG 2.2 AA: 4.5:1 for text, 3:1 for the
// edge of a control and for graphics. The dark theme is authored (not inverted), so every pair is
// checked there on its own terms, and every colour token must exist in both themes.

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The text of the first rule that starts with `selector`, from its `{` to the matching `}`. */
function blockOf(selector: string): { text: string; start: number } {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`tokens.css has no ${selector} block`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return { text: css.slice(start, i), start };
  }
  throw new Error(`tokens.css has an unclosed ${selector} block`);
}

function declarations(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [, name, value] of text.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(name as string, (value as string).trim());
  }
  return map;
}

const lightBlock = blockOf(':root {');
const darkBlock = blockOf(":root[data-theme='dark'] {");
const light = declarations(lightBlock.text);
const darkOnly = declarations(darkBlock.text);
// What the dark theme sees: everything the light theme declares, overridden by the dark block.
const dark = new Map([...light, ...darkOnly]);

type Theme = 'light' | 'dark';
const THEMES: Record<Theme, Map<string, string>> = { light, dark };

function resolve(theme: Theme, name: string): string {
  const tokens = THEMES[theme];
  let value = tokens.get(name);
  if (value === undefined) throw new Error(`--${name} is not a token`);
  for (let depth = 0; depth < 6; depth += 1) {
    const alias = /^var\(--([\w-]+)\)$/.exec(value);
    if (!alias) break;
    value = tokens.get(alias[1] as string);
    if (value === undefined) throw new Error(`--${name} points at a missing token`);
  }
  return value;
}

function rgb(theme: Theme, name: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(resolve(theme, name));
  if (!hex) throw new Error(`--${name} is not a six digit colour: ${resolve(theme, name)}`);
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

export function contrast(theme: Theme, foreground: string, background: string): number {
  const [a, b] = [luminance(rgb(theme, foreground)), luminance(rgb(theme, background))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const STATES = ['calm', 'concerned', 'frustrated', 'angry', 'escalating', 'recovering'];
const STATUSES = ['success', 'warning', 'danger', 'info', 'neutral'];
const ACCENTS = ['blue', 'indigo', 'purple', 'teal', 'green', 'orange', 'magenta'];
const SURFACES = ['bg-canvas', 'bg-quiet', 'bg-subtle', 'bg-section', 'bg-raised'];
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
  // The brand as a fill that carries text.
  ['fg-on-brand', 'brand'],
  ['fg-on-brand', 'brand-hover'],
  ['fg-on-brand', 'brand-pressed'],
  ['fg-on-brand', 'brand-selected'],
  // The brand as text and icons.
  ['brand-fg', 'bg-canvas'],
  ['brand-fg', 'bg-quiet'],
  ['brand-fg-2', 'bg-canvas'],
  ['brand-fg-2', 'bg-quiet'],
  ['brand-fg-2', 'bg-raised'],
  ['brand-fg-2', 'brand-tint'],
  ['brand-fg-2', 'brand-tint-hover'],
  // A link under the pointer (`a:hover`, "Show more"): text on the same surfaces as the link itself.
  ['brand-fg-hover', 'bg-canvas'],
  ['brand-fg-hover', 'bg-quiet'],
  ['brand-fg-hover', 'bg-raised'],
  ['brand-fg-hover', 'brand-tint'],
  ['brand-fg-hover', 'brand-tint-hover'],
  ['fg-1', 'brand-tint'],
  ['fg-2', 'brand-tint'],
  // Destructive actions.
  ['fg-on-brand', 'danger'],
  ['fg-on-brand', 'danger-hover'],
  ['fg-on-brand', 'danger-pressed'],
  // Every status and every customer state on its own tinted ground, and the status text on the page.
  ...STATUSES.map((s) => [`status-${s}-fg`, `status-${s}-bg`] as [string, string]),
  ['status-danger-fg', 'bg-canvas'],
  ['status-warning-fg', 'bg-canvas'],
  ['status-success-fg', 'bg-canvas'],
  ...STATES.map((s) => [`state-${s}-fg`, `state-${s}-bg`] as [string, string]),
  ...STATES.map((s) => [`state-${s}-fg`, 'bg-canvas'] as [string, string]),
  // Analysis written by the evaluator.
  ['ai-fg', 'ai-bg'],
  ['ai-fg', 'bg-canvas'],
  // Product accents: the mark on its own tint, and on the page it sits on.
  ...ACCENTS.flatMap((a) => [
    [`accent-${a}-fg`, `accent-${a}-bg`] as [string, string],
    [`accent-${a}-fg`, 'bg-canvas'] as [string, string],
    [`accent-${a}-fg`, 'bg-quiet'] as [string, string],
  ]),
  // The wording changes in the report: text on its tint.
  ['diff-del-fg', 'diff-del-bg'],
  ['diff-add-fg', 'diff-add-bg'],
];

describe.each(['light', 'dark'] as const)('tokens (%s theme): text contrast', (theme) => {
  it.each(textPairs)('%s on %s is at least 4.5:1', (foreground, background) => {
    expect(contrast(theme, foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the lightest text Firefly uses at 4.5:1 or better on every surface', () => {
    for (const surface of [...SURFACES, 'bg-strong']) {
      expect(contrast(theme, 'fg-3', surface), `fg-3 on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe.each(['light', 'dark'] as const)('tokens (%s theme): edges and graphics', (theme) => {
  it('draws the edge of a control (--stroke-accessible) at 3:1 or better on the page', () => {
    expect(contrast(theme, 'stroke-accessible', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'stroke-accessible', 'bg-quiet')).toBeGreaterThanOrEqual(3);
  });

  it('draws the selected edge, lines and the error edge at 3:1 or better', () => {
    expect(contrast(theme, 'brand-stroke', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'brand-stroke', 'bg-quiet')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'brand-stroke', 'brand-tint')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'status-danger-fg', 'bg-canvas')).toBeGreaterThanOrEqual(3);
  });

  it('draws the focus ring at 3:1 or better on the page and on the brand fill', () => {
    expect(contrast(theme, 'focus-outer', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'focus-outer', 'brand')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'focus-inner', 'focus-outer')).toBeGreaterThanOrEqual(3);
  });

  it('draws both voices of the waveform at 3:1 or better on the page', () => {
    expect(contrast(theme, 'voice-trainee', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'voice-customer', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'voice-customer', 'bg-quiet')).toBeGreaterThanOrEqual(3);
  });

  it('draws filled bars and switch parts at 3:1 or better on their tracks', () => {
    expect(contrast(theme, 'brand-stroke', 'bg-strong')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'status-success-fg', 'bg-strong')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'fg-2', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    // The thumb of a switch that is on, against its brand track.
    expect(contrast(theme, 'bg-canvas', 'brand')).toBeGreaterThanOrEqual(3);
  });

  it('draws the chart line and its grid so that both can be told from the page', () => {
    expect(contrast(theme, 'chart-line', 'bg-canvas')).toBeGreaterThanOrEqual(3);
    expect(contrast(theme, 'chart-axis', 'bg-canvas')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme, 'chart-grid', 'bg-canvas')).toBeGreaterThan(1.1);
  });
});

describe('tokens: the two themes', () => {
  it('declares light as the default and dark only for a page that asks for it', () => {
    expect(lightBlock.text).toMatch(/color-scheme:\s*light\s*;/);
    expect(darkBlock.text).toMatch(/color-scheme:\s*dark\s*;/);
    expect(contrast('light', 'bg-canvas', 'fg-1')).toBeGreaterThan(15);
  });

  it('applies the dark theme on screen only, so a printed report is always the light document', () => {
    const before = css.slice(Math.max(0, darkBlock.start - 40), darkBlock.start);
    expect(before).toMatch(/@media screen\s*\{\s*$/);
  });

  it('declares every colour and depth token in both themes, and nothing extra in dark', () => {
    const colourOrDepth =
      /^(bg|fg|stroke|brand|focus|status|state|danger|ai|voice|accent|edge|shadow|acrylic)(-|$)/;
    const lightNames = [...light.keys()].filter((name) => colourOrDepth.test(name));
    // Tokens that dark leaves to the light block: they are not colours, or they are the same in both.
    const SHARED = new Set(['acrylic-filter', 'stroke-w', 'stroke-w-thick']);
    const missing = lightNames.filter((name) => !darkOnly.has(name) && !SHARED.has(name));
    expect(missing).toEqual([]);
    const extra = [...darkOnly.keys()].filter((name) => !light.has(name));
    expect(extra).toEqual([]);
  });

  it('is a charcoal-navy ladder: lighter surfaces are nearer, and none is pure black or white', () => {
    const lum = (name: string) => luminance(rgb('dark', name));
    const ladder = ['bg-canvas', 'bg-quiet', 'bg-subtle', 'bg-section', 'bg-strong'];
    for (let i = 1; i < ladder.length; i += 1) {
      expect(
        lum(ladder[i] as string),
        `${ladder[i]} is lighter than ${ladder[i - 1]}`,
      ).toBeGreaterThan(lum(ladder[i - 1] as string));
    }
    expect(lum('bg-canvas')).toBeGreaterThan(0.005); // not pure black
    expect(lum('bg-canvas')).toBeLessThan(0.03); // still dark
    for (const surface of [...ladder, 'bg-raised', 'bg-hover', 'bg-pressed', 'bg-selected']) {
      expect(resolve('dark', surface).toLowerCase()).not.toBe('#000000');
      expect(resolve('dark', surface).toLowerCase()).not.toBe('#ffffff');
    }
    // Strong, readable text on the dark canvas.
    expect(contrast('dark', 'fg-1', 'bg-canvas')).toBeGreaterThanOrEqual(12);
  });

  it('keeps the live voice cyan and the customer states warm: amber for concern, orange to red above it', () => {
    const [r, g, b] = rgb('dark', 'voice-customer');
    expect(g).toBeGreaterThan(r); // cyan leans green and blue
    expect(b).toBeGreaterThan(r);
    const concerned = rgb('dark', 'state-concerned-fg');
    const frustrated = rgb('dark', 'state-frustrated-fg');
    expect(concerned[0]).toBeGreaterThan(concerned[2]); // warm
    expect(frustrated[0]).toBeGreaterThan(frustrated[2]);
  });

  it('gives each brand role its own job in the dark theme', () => {
    // A fill that carries white text is darker than the line, bar and text blues.
    const lum = (name: string) => luminance(rgb('dark', name));
    expect(lum('brand')).toBeLessThan(lum('brand-stroke'));
    expect(lum('brand')).toBeLessThan(lum('brand-fg'));
    // In the light theme the three are one blue, so nothing moves there.
    expect(resolve('light', 'brand')).toBe(resolve('light', 'brand-stroke'));
    expect(resolve('light', 'brand')).toBe(resolve('light', 'brand-fg'));
  });

  it('keeps the dark shadows free of bloom: only black, never a coloured glow', () => {
    for (const name of [
      'shadow-2',
      'shadow-4',
      'shadow-8',
      'shadow-16',
      'shadow-28',
      'shadow-64',
    ]) {
      const value = darkOnly.get(name) as string;
      expect(value, name).toMatch(/rgb\(0 0 0 \//);
      expect(value, name).not.toMatch(/rgb\((?!0 0 0)/);
    }
  });
});

describe('tokens: sizes', () => {
  it('keeps the default control height at the 44 px target and the smallest above the 24 px floor', () => {
    const px = (name: string) => {
      const value = resolve('light', name);
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
  const { text } = blockOf('@media (prefers-reduced-motion: reduce)');
  return declarations(text);
}

describe('tokens: motion', () => {
  const motion = [...light.keys()].filter((name) => /^(dur|move|press)-/.test(name));
  const reduced = reducedMotionTokens();

  it('has a duration, a travel and a press token for every kind of movement', () => {
    expect(motion.filter((name) => name.startsWith('dur-')).length).toBeGreaterThanOrEqual(12);
    expect(motion).toEqual(
      expect.arrayContaining(['move-xs', 'move-sm', 'move-lift', 'press-shift', 'press-grow']),
    );
  });

  it.each(motion)('--%s has a still equivalent when the person asks for less motion', (name) => {
    const value = reduced.get(name);
    expect(value, `--${name} is not set in the prefers-reduced-motion block`).toBeDefined();
    // Durations collapse to an instant and distances to nothing: a state change, not a movement.
    expect(value).toMatch(name.startsWith('dur-') ? /^0\.01ms$/ : /^0(px)?$/);
  });

  it('keeps no motion token in the reduced-motion block that the light theme does not declare', () => {
    const strays = [...reduced.keys()].filter((name) => !light.has(name));
    expect(strays).toEqual([]);
  });

  it('names the five motion tiers inside the ranges the interaction system promises', () => {
    const ms = (name: string) => {
      let value = light.get(name) as string;
      for (let depth = 0; depth < 4; depth += 1) {
        const alias = /^var\(--([\w-]+)\)/.exec(value);
        if (!alias) break;
        value = light.get(alias[1] as string) as string;
      }
      const match = /^(\d+)ms/.exec(value);
      if (!match) throw new Error(`--${name} is not a duration: ${value}`);
      return Number(match[1]);
    };
    const inRange = (name: string, low: number, high: number) => {
      expect(ms(name), name).toBeGreaterThanOrEqual(low);
      expect(ms(name), name).toBeLessThanOrEqual(high);
    };
    inRange('motion-instant', 80, 120);
    inRange('motion-control', 120, 180);
    inRange('motion-component', 180, 260);
    inRange('motion-panel', 220, 340);
    inRange('motion-page', 240, 400);
  });

  it('keeps the five tiers collapsing with the rest: they are names for duration tokens', () => {
    for (const tier of ['instant', 'control', 'component', 'panel', 'page']) {
      expect(light.get(`motion-${tier}`), tier).toMatch(/^var\(--dur-[a-z]+\)$/);
    }
  });
});
