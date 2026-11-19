import type { CoreMood, CorePalette, Rgb } from './engine.ts';

const FALLBACK = {
  glow: { r: 246, g: 189, b: 94 },
  accent: { r: 139, g: 220, b: 200 },
  calm: { r: 127, g: 220, b: 198 },
  concerned: { r: 241, g: 214, b: 107 },
  frustrated: { r: 245, g: 159, b: 74 },
  angry: { r: 244, g: 105, b: 76 },
  escalating: { r: 232, g: 74, b: 116 },
  muted: { r: 154, g: 167, b: 160 },
  bg: { r: 6, g: 17, b: 16 },
} satisfies Record<string, Rgb>;

/** Parses #rgb, #rrggbb and rgb()/rgba() values. Returns the fallback for anything else. */
export function parseColor(value: string, fallback: Rgb): Rgb {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex?.[1]) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
    };
  }
  const fn = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/.exec(text);
  if (fn?.[1] && fn[2] && fn[3]) {
    return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]) };
  }
  return fallback;
}

/** Relative luminance (0 black .. 1 white). */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Builds the core's palette from the design tokens, so it follows the theme. `read` returns the
 * computed value of a CSS custom property (for example `(name) => style.getPropertyValue(name)`).
 */
export function readCorePalette(read: (name: string) => string): CorePalette {
  const pick = (name: string, fallback: Rgb) => parseColor(read(name), fallback);
  const glow = pick('--glow', FALLBACK.glow);
  const calm = pick('--temp-calm', FALLBACK.calm);
  const moods: Record<CoreMood, Rgb> = {
    neutral: glow,
    calm,
    concerned: pick('--temp-concerned', FALLBACK.concerned),
    frustrated: pick('--temp-frustrated', FALLBACK.frustrated),
    angry: pick('--temp-angry', FALLBACK.angry),
    escalating: pick('--temp-escalating', FALLBACK.escalating),
  };
  return {
    nucleus: glow,
    mist: pick('--accent', FALLBACK.accent),
    moods,
    dormant: pick('--text-3', FALLBACK.muted),
    additive: luminance(pick('--bg', FALLBACK.bg)) < 0.4,
  };
}
