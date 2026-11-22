import { act, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ARRIVAL_STEPS, arrivalStep, useArrivals } from './arrival.ts';

describe('the step a card arrives on', () => {
  it('is its place in the sequence, for the first eight new cards', () => {
    expect(arrivalStep(0)).toBe(0);
    expect(arrivalStep(3)).toBe(3);
    expect(arrivalStep(ARRIVAL_STEPS - 1)).toBe(ARRIVAL_STEPS - 1);
  });

  it('is none for a card past the last step: it is simply there, so a long row is not a long animation', () => {
    expect(arrivalStep(ARRIVAL_STEPS)).toBeNull();
    expect(arrivalStep(31)).toBeNull();
  });

  it('never goes below the first step, whatever it is given', () => {
    expect(arrivalStep(-4)).toBe(0);
    expect(arrivalStep(2.9)).toBe(2);
    expect(arrivalStep(Number.NaN)).toBe(0);
  });
});

/** The cards a set of ids brings in, in the order they arrive, as the hook says them. */
const order = (arrivals: ReadonlyMap<string, number>) =>
  [...arrivals].sort((a, b) => a[1] - b[1]).map(([id]) => id);

describe('which cards have just arrived', () => {
  it('is nothing while there are no cards, and every card, in order, the first time there are', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: [] as string[] },
    });
    expect(result.current.size).toBe(0);
    rerender({ ids: ['a', 'b', 'c'] });
    expect(order(result.current)).toEqual(['a', 'b', 'c']);
    expect(result.current.get('a')).toBe(0);
    expect(result.current.get('c')).toBe(2);
  });

  it('does not start again for a re-render with the same cards, even in a new array', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a', 'b', 'c'] },
    });
    const first = result.current;
    rerender({ ids: ['a', 'b', 'c'] });
    expect(result.current).toBe(first);
  });

  it('says nothing is new when a filter takes cards away: the ones that stay do not move', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a', 'b', 'c', 'd'] },
    });
    rerender({ ids: ['b', 'd'] });
    expect(result.current.size).toBe(0);
  });

  it('brings in only the cards a filter adds, counted from the first of them, and not the ones that stayed', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a', 'b', 'c', 'd', 'e'] },
    });
    rerender({ ids: ['b', 'd'] });
    rerender({ ids: ['a', 'b', 'c', 'd', 'e'] });
    expect(order(result.current)).toEqual(['a', 'c', 'e']);
    expect(result.current.get('a')).toBe(0);
    expect(result.current.get('c')).toBe(1);
    expect(result.current.get('e')).toBe(2);
    expect(result.current.has('b')).toBe(false);
    expect(result.current.has('d')).toBe(false);
  });

  it('treats a card that went and came back as new, and every card as new after an empty answer', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a', 'b'] },
    });
    rerender({ ids: [] });
    expect(result.current.size).toBe(0);
    rerender({ ids: ['a', 'b'] });
    expect(order(result.current)).toEqual(['a', 'b']);
  });

  it('keeps the same answer until the set of cards changes, so choosing a card never replays it', () => {
    const { result, rerender } = renderHook(({ ids, n }) => ({ arrivals: useArrivals(ids), n }), {
      initialProps: { ids: ['a', 'b', 'c'], n: 0 },
    });
    const first = result.current.arrivals;
    act(() => rerender({ ids: ['a', 'b', 'c'], n: 1 }));
    expect(result.current.arrivals).toBe(first);
  });
});

describe('how the details of a chosen scenario come in', () => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'detail.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');
  const keyframes = css.match(/@keyframes scn-fade\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

  it('starts faint, not at nothing: on a first visit they are the largest thing on the page, and text at nothing is not painted as far as the browser is concerned until its fade ends', () => {
    const start = Number(/opacity:\s*([\d.]+)/.exec(keyframes)?.[1]);
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(1);
    expect(keyframes).toMatch(/transform:\s*translateY\(var\(--move-xs\)\)/);
  });

  it('moves opacity and transform only, a beat apart, holds nothing once they have arrived, and does it only on a screen with motion allowed', () => {
    expect([...keyframes.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]).sort()).toEqual([
      'opacity',
      'transform',
    ]);
    expect(css).toMatch(
      /\.scn-detail__head,\s*\.scn-facts,\s*\.scn-setup\s*\{\s*animation:\s*scn-fade var\(--motion-component\)[^;]*backwards;/,
    );
    expect(css).toMatch(/\.scn-facts\s*\{\s*animation-delay:\s*var\(--dur-stagger\);/);
    expect(css).toMatch(/\.scn-setup\s*\{\s*animation-delay:\s*calc\(var\(--dur-stagger\) \* 2\);/);
    expect(css).not.toMatch(/scn-fade[^;]*(forwards|both)/);
    // Nothing outside the query starts it: with less motion, and on paper, the details are simply there.
    const query =
      /@media screen and \(prefers-reduced-motion: no-preference\)\s*\{([\s\S]*?)\n\}/.exec(
        css,
      )?.[1] ?? '';
    expect(query).toMatch(/animation:\s*scn-fade/);
    expect(css.replace(query, '')).not.toMatch(/animation:\s*scn-fade/);
  });
});
