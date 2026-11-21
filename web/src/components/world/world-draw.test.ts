import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MOOD_ATMOSPHERE } from '../call/atmosphere.ts';
import {
  RAMP_STEPS,
  TOKEN_NAMES,
  buildPalette,
  drawWorld,
  parseColor,
  spanFor,
  toPx,
  windowToField,
  type FieldTokens,
  type RGB,
  type View,
} from './world-draw.ts';
import { createWorld, settleWorld } from './world-model.ts';

const styles = resolve(dirname(fileURLToPath(import.meta.url)), '../../styles');
const read = (name: string) => readFileSync(resolve(styles, name), 'utf8');
const tokensCss = read('tokens.css');
const worldCss = read('world.css');

/** The text between the braces that follow `selector` (the first match), nested braces included. */
function blockOf(source: string, selector: string): string {
  const at = source.indexOf(selector);
  if (at < 0) throw new Error(`no ${selector}`);
  const open = source.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && (depth -= 1) === 0) return source.slice(open + 1, i);
  }
  throw new Error(`unclosed ${selector}`);
}
const declared = (block: string) =>
  Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], (m[2] ?? '').trim()]),
  );

const THEMES = {
  dark: declared(blockOf(tokensCss, ":root[data-theme='dark']")),
  light: declared(blockOf(tokensCss, ":root[data-theme='light']")),
  system: declared(blockOf(tokensCss, ':root:not([data-theme])')),
};
const CAPS = {
  dark: Number(declared(blockOf(worldCss, '\n:root {'))['--world-cap']),
  light: Number(declared(blockOf(worldCss, ":root[data-theme='light']"))['--world-cap']),
  system: Number(declared(blockOf(worldCss, ':root:not([data-theme])'))['--world-cap']),
};

const tokensOf = (theme: Record<string, string | undefined>): Partial<FieldTokens> =>
  Object.fromEntries(
    (Object.keys(TOKEN_NAMES) as (keyof FieldTokens)[]).map((key) => [
      key,
      theme[TOKEN_NAMES[key]],
    ]),
  );

// ---- WCAG contrast -------------------------------------------------------------------------
const linear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = (c: readonly number[]) =>
  0.2126 * linear(c[0] as number) +
  0.7152 * linear(c[1] as number) +
  0.0722 * linear(c[2] as number);
const contrast = (a: readonly number[], b: readonly number[]) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high as number) + 0.05) / ((low as number) + 0.05);
};
const over = (ground: readonly number[], paint: readonly number[], share: number): RGB => [
  (ground[0] as number) * (1 - share) + (paint[0] as number) * share,
  (ground[1] as number) * (1 - share) + (paint[1] as number) * share,
  (ground[2] as number) * (1 - share) + (paint[2] as number) * share,
];
const colour = (text: string | undefined) => {
  const parsed = parseColor(text);
  if (!parsed) throw new Error(`not a colour: ${text}`);
  return parsed;
};
const withAlpha = (text: string | undefined): [RGB, number] => {
  const m = /rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(text ?? '');
  if (!m) throw new Error(`not rgba: ${text}`);
  return [[Number(m[1]), Number(m[2]), Number(m[3])], Number(m[4])];
};

/**
 * Every colour the page's own background reaches, from the real `--world-base` gradient: sampled on
 * a grid over several window sizes (the lights have fixed pixel radii, so a phone sees a different
 * slice of them) plus the centre of each light, where it is strongest. Built to throw, not to guess,
 * if the gradient is ever written in a form this does not understand.
 */
function groundColours(theme: Record<string, string | undefined>): RGB[] {
  const base = theme['--world-base'] ?? '';
  const radials = [
    ...base.matchAll(
      /radial-gradient\(\s*(\d+)px\s+(\d+)px\s+at\s+(\d+)%\s+(\d+)%\s*,\s*var\((--[\w-]+)\)\s*,\s*transparent\s+(\d+)%\s*\)/g,
    ),
  ];
  const linear =
    /linear-gradient\(\s*180deg\s*,\s*var\((--[\w-]+)\)\s*,\s*var\((--[\w-]+)\)\s+(\d+)%\s*\)/.exec(
      base,
    );
  if (radials.length !== 2 || !linear)
    throw new Error(`--world-base is not in the form this test reads: ${base}`);
  const top = colour(theme[linear[1] as string]);
  const bottom = colour(theme[linear[2] as string]);
  const reach = Number(linear[3]) / 100;
  const lights = radials.map((m) => {
    const [colourOf, alpha] = withAlpha(theme[m[5] as string]);
    return {
      rx: Number(m[1]),
      ry: Number(m[2]),
      cx: Number(m[3]) / 100,
      cy: Number(m[4]) / 100,
      end: Number(m[6]) / 100,
      colour: colourOf,
      alpha,
    };
  });
  const out: RGB[] = [];
  const at = (x: number, y: number, w: number, h: number) => {
    let c: RGB = [0, 1, 2].map(
      (k) =>
        (top[k] as number) +
        ((bottom[k] as number) - (top[k] as number)) * Math.min(1, y / h / reach),
    ) as unknown as RGB;
    // Painted bottom-up: the last light listed is beneath the first.
    for (const light of [...lights].reverse()) {
      const d = Math.hypot((x - light.cx * w) / light.rx, (y - light.cy * h) / light.ry);
      const a = light.alpha * Math.max(0, 1 - d / light.end);
      if (a > 0) c = over(c, light.colour, a);
    }
    out.push(c);
  };
  for (const [w, h] of [
    [1920, 1080],
    [1440, 900],
    [768, 1024],
    [390, 844],
    [320, 568],
  ] as const) {
    for (let i = 0; i <= 24; i += 1)
      for (let j = 0; j <= 24; j += 1) at((w * i) / 24, (h * j) / 24, w, h);
    for (const light of lights) at(light.cx * w, light.cy * h, w, h);
  }
  return out;
}

/** The part of the page behind the text that makes it hardest to read: the lightest ground on dark, the darkest on light. */
function hardestGround(theme: Record<string, string | undefined>, light: boolean): RGB {
  return groundColours(theme).sort((a, b) =>
    light ? luminance(a) - luminance(b) : luminance(b) - luminance(a),
  )[0] as RGB;
}

describe('legibility over the field', () => {
  // The canvas is capped as a whole (world.css), so a pixel can never move the page further than the
  // cap. This works out the worst case from the real tokens: the strongest canvas pixel at the cap,
  // over the part of the field gradient that is hardest to read against.
  for (const name of ['dark', 'light', 'system'] as const) {
    const theme = THEMES[name];
    const light = name !== 'dark';
    const palette = buildPalette(tokensOf(theme));
    const strands = [...palette.rgb, ...palette.pale.map(colour), colour(theme['--amber'])];
    // One strand at its strongest, and the bound for any number of strands piling up in one pixel
    // (light adds up to white, ink-tinted strands darken toward their darkest channels).
    const single = [...strands].sort((a, b) =>
      light ? luminance(a) - luminance(b) : luminance(b) - luminance(a),
    )[0] as RGB;
    const piled: RGB = light
      ? ([0, 1, 2].map((c) => Math.min(...strands.map((s) => s[c] as number))) as unknown as RGB)
      : [255, 255, 255];
    const ground = hardestGround(theme, light);

    it(`keeps --ink-1 and --ink-2 at WCAG AA (4.5:1) in the ${name} theme, even where strands pile up`, () => {
      const cap = CAPS[name];
      expect(cap).toBeGreaterThan(0.1); // not made safe by making the field vanish
      for (const bound of [single, piled]) {
        const worst = over(ground, bound, cap);
        for (const ink of ['--ink-1', '--ink-2']) {
          expect(
            contrast(colour(theme[ink]), worst),
            `${ink} over ${worst.map(Math.round)}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`keeps the quietest ink (--ink-3, the small labels) at 3:1 or better in the ${name} theme`, () => {
      // Not the 4.5:1 that --ink-1 and --ink-2 keep: a label that must stay clear of a dense field
      // goes on a .world-veil. This holds the floor for the worst pixel the field can make.
      const worst = over(ground, piled, CAPS[name]);
      expect(contrast(colour(theme['--ink-3']), worst)).toBeGreaterThanOrEqual(3);
    });
  }

  it('applies the same guarantee when the system picks the light theme as when it is chosen', () => {
    expect(CAPS.system).toBe(CAPS.light);
    for (const key of [
      '--field-0',
      '--field-1',
      '--field-2',
      '--ink-1',
      '--ink-2',
      '--ink-3',
      '--aqua',
      '--sage',
      '--amber',
      '--coral',
      '--ember',
    ]) {
      expect(THEMES.system[key], key).toBe(THEMES.light[key]);
    }
  });

  it('gives people who ask for more contrast less field, never more', () => {
    const scale = declared(blockOf(worldCss, '@media (prefers-contrast: more)'))[
      '--world-cap-scale'
    ];
    expect(Number(scale)).toBeLessThan(1);
  });
});

describe('palette', () => {
  it('reads the colours a browser reports', () => {
    expect(parseColor('#8ed8e6')).toEqual([142, 216, 230]);
    expect(parseColor('#FA0')).toEqual([255, 170, 0]);
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseColor('rgba(10 20 30 / 0.5)')).toEqual([10, 20, 30]);
    expect(parseColor('')).toBeNull();
    expect(parseColor('oklch(0.7 0.1 200)')).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });

  it('is built from the tokens: cool aqua first, ember last, and ink-safe on the light field', () => {
    const dark = buildPalette(tokensOf(THEMES.dark));
    const light = buildPalette(tokensOf(THEMES.light));
    expect([dark.light, light.light]).toEqual([false, true]);
    expect(dark.ramp).toHaveLength(RAMP_STEPS);
    expect(dark.rgb[0]).toEqual(colour(THEMES.dark['--aqua']));
    expect(dark.rgb.at(-1)).toEqual(colour(THEMES.dark['--ember']));
    // On parchment every light is pulled toward ink, so a hairline stays visible there.
    expect(luminance(light.rgb[0] as RGB)).toBeLessThan(luminance(colour(THEMES.light['--aqua'])));
    expect(dark.amberClear).toMatch(/^rgba\(\d+,\d+,\d+,0\)$/);
  });

  it('still works when a token is missing, with the dark defaults', () => {
    const palette = buildPalette({});
    expect(palette.light).toBe(false);
    expect(palette.ramp).toHaveLength(RAMP_STEPS);
  });
});

describe('geometry of the run', () => {
  it('makes the run wider than a tall window, so a phone sees the middle of a longer field', () => {
    expect(spanFor(1440, 900)).toBe(1440);
    expect(spanFor(390, 844)).toBeCloseTo(1.3 * 844);
    const view: View = { w: 390, h: 844, dpr: 1, span: spanFor(390, 844) };
    expect(toPx(view, 0.5)).toBe(195);
    // A point across the window, asked for by a page, lands on the same pixel in the run.
    for (const x of [0, 0.25, 0.5, 1])
      expect(toPx(view, windowToField(view, x))).toBeCloseTo(x * view.w);
  });
});

/** A canvas context that only counts what it is asked to do, and notes the opacities it was given. */
function recorder() {
  const calls: Record<string, number> = {};
  const composite: string[] = [];
  const alphas: number[] = [];
  const state: Record<string, unknown> = { canvas: { width: 0, height: 0 } };
  const context = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {
        calls[prop] = (calls[prop] ?? 0) + 1;
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      if (prop === 'globalCompositeOperation') composite.push(String(value));
      if (prop === 'globalAlpha') alphas.push(Number(value));
      return true;
    },
  });
  return { context: context as unknown as CanvasRenderingContext2D, calls, composite, alphas };
}

describe('drawWorld', () => {
  const view: View = { w: 1440, h: 900, dpr: 1, span: 1440 };
  const dark = buildPalette(tokensOf(THEMES.dark));
  const light = buildPalette(tokensOf(THEMES.light));
  const mood = (name: keyof typeof MOOD_ATMOSPHERE, tier: 'high' | 'low' = 'high') => {
    const world = createWorld(3, tier);
    settleWorld(world, { ...MOOD_ATMOSPHERE[name], intensity: 1 });
    return world;
  };

  it('draws nothing at all when there are no strands', () => {
    const { context, calls } = recorder();
    drawWorld(context, mood('calm', 'low'), view, dark, null);
    expect(calls.stroke).toBeUndefined();
  });

  it('adds light on dark and lays ink on light', () => {
    const night = recorder();
    drawWorld(night.context, mood('calm'), view, dark, null);
    const day = recorder();
    drawWorld(day.context, mood('calm'), view, light, null);
    expect(night.composite).toContain('lighter');
    expect(night.composite).not.toContain('source-over');
    expect(day.composite).toContain('source-over');
    expect(day.composite).not.toContain('lighter');
  });

  it('draws one stroke per visible strand, and skips the ones that are hidden', () => {
    const calm = recorder();
    drawWorld(calm.context, mood('calm'), view, dark, null);
    const tense = recorder();
    drawWorld(tense.context, mood('angry'), view, dark, null);
    expect(calm.calls.stroke as number).toBeGreaterThan(5);
    expect(calm.calls.stroke as number).toBeLessThan(90);
    expect(tense.calls.stroke as number).toBeGreaterThan(calm.calls.stroke as number);
  });

  it('cuts a frayed strand into pieces instead of dashing it', () => {
    const whole = recorder();
    drawWorld(whole.context, mood('angry'), view, dark, null);
    const frayed = recorder();
    drawWorld(frayed.context, mood('escalating'), view, dark, null);
    expect(frayed.calls.setLineDash).toBeUndefined();
    expect(frayed.calls.moveTo as number).toBeGreaterThan(2 * (whole.calls.moveTo as number));
  });

  it('brightens the strands near the pointer, and only those', () => {
    const drawn = (pointer: { x: number; y: number; k: number } | null) => {
      const { context, alphas } = recorder();
      drawWorld(context, mood('calm'), view, dark, pointer);
      return alphas;
    };
    const plain = drawn(null);
    const lit = drawn({ x: 700, y: 450, k: 1 });
    expect(lit).toHaveLength(plain.length);
    expect(lit.some((a, i) => a > (plain[i] as number))).toBe(true);
    expect(lit.some((a, i) => a === plain[i])).toBe(true); // strands out of its reach are as they were
    expect(lit.every((a) => a <= 1)).toBe(true);
    // A pointer that has faded out changes nothing.
    expect(drawn({ x: 700, y: 450, k: 0 })).toEqual(plain);
  });
});
