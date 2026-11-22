import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductId } from '#shared/domain/vocab.ts';
import { pointer, send, stubRaf } from '../../design/interaction/test-utils.ts';
import { ProductRail, type RailProduct } from './ProductRail.tsx';

// jsdom has no layout: each chip is 100 px wide with 10 px between, in a row 600 px wide.
const CHIP = 110;
const WINDOW = 600;

function stubLayout(chips: number) {
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('scn-rail__scroller') ? WINDOW : 0;
  });
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('scn-rail__scroller') ? chips * CHIP : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.classList.contains('scn-chip')) return 0;
    return [...(this.parentElement?.querySelectorAll('.scn-chip') ?? [])].indexOf(this) * CHIP;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('scn-chip') ? 100 : 0;
  });
}

const PRODUCTS: RailProduct[] = [
  { id: 'teams', count: 2 },
  { id: 'outlook', count: 1 },
  { id: 'exchange-online', count: 1 },
  { id: 'sharepoint-online', count: 1 },
  { id: 'onedrive-business', count: 1 },
  { id: 'm365-apps', count: 1 },
  { id: 'entra-id', count: 2 },
  { id: 'intune', count: 0 },
  { id: 'defender-office-365', count: 1 },
  { id: 'windows-11', count: 1 },
  { id: 'azure', count: 2 },
  { id: 'dynamics-365', count: 1 },
  { id: 'power-platform', count: 1 },
];

function Rail({
  start = null,
  onChange,
}: {
  start?: ProductId | null;
  onChange?(value: ProductId | null): void;
}) {
  const [value, setValue] = useState<ProductId | null>(start);
  return (
    <ProductRail
      products={PRODUCTS}
      total={15}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

let scrolls: { left: number; behavior: ScrollBehavior | undefined }[];
let raf: ReturnType<typeof stubRaf>;

beforeEach(() => {
  stubLayout(PRODUCTS.length + 1);
  scrolls = [];
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value(this: HTMLElement, options: ScrollToOptions) {
      scrolls.push({ left: options.left ?? 0, behavior: options.behavior });
      this.scrollLeft = options.left ?? 0;
    },
  });
  raf = stubRaf();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
});

const group = () => screen.getByRole('group', { name: 'Product' });
const chips = () => within(group()).getAllByRole('radio');
const track = () => document.querySelector('.scn-rail__track') as HTMLElement;

describe('the chips', () => {
  it('are All and one per product that has scenarios, in the order given, each with its count in words', () => {
    render(<Rail />);
    const names = chips().map((chip) => chip.closest('label')?.textContent?.replace(/\s+/g, ' '));
    expect(chips()).toHaveLength(14);
    expect(names[0]).toBe('All15, 15 scenarios');
    expect(names[1]).toBe('Teams2, 2 scenarios');
    expect(names[2]).toBe('Outlook1, 1 scenario');
    expect(names.at(-1)).toBe('Power Platform1, 1 scenario');
    expect(
      screen.getByRole('radio', { name: 'Microsoft 365 Apps, 1 scenario' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All, 15 scenarios' })).toBeInTheDocument();
  });

  it('give each product its mark, which a screen reader does not read', () => {
    render(<Rail />);
    const teams = screen.getByRole('radio', { name: /^Teams/ }).closest('label') as HTMLElement;
    expect(teams.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // All has no product, so no mark.
    expect(
      screen.getByRole('radio', { name: /^All/ }).closest('label')?.querySelector('svg'),
    ).toBeNull();
  });

  it('are one radio group named "Product", with exactly one chip chosen', () => {
    render(<Rail start="azure" />);
    expect(chips().filter((chip) => (chip as HTMLInputElement).checked)).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /^Azure/ })).toBeChecked();
    const names = new Set(chips().map((chip) => chip.getAttribute('name')));
    expect(names.size).toBe(1);
  });

  it('choose All with null, and a product with its id', async () => {
    const user = userEvent.setup();
    const changes: (ProductId | null)[] = [];
    render(<Rail start="teams" onChange={(value) => changes.push(value)} />);
    await user.click(screen.getByRole('radio', { name: /^Azure/ }));
    await user.click(screen.getByRole('radio', { name: /^All/ }));
    expect(changes).toEqual(['azure', null]);
  });

  it('put a product that nothing matches out of reach, unless it is the one chosen', () => {
    const { unmount } = render(<Rail />);
    expect(screen.getByRole('radio', { name: /^Intune/ })).toBeDisabled();
    unmount();
    render(<Rail start="intune" />);
    expect(screen.getByRole('radio', { name: /^Intune/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /^Intune/ })).toBeChecked();
  });

  it('bring a count in again when it changes, and leave every count that did not change alone', () => {
    const counts = (list: RailProduct[]) => (
      <ProductRail products={list} total={15} value={null} onChange={() => undefined} />
    );
    const { rerender } = render(counts(PRODUCTS));
    const nodeOf = (name: RegExp) =>
      screen.getByRole('radio', { name }).closest('label')?.querySelector('.scn-chip__count');
    const teams = nodeOf(/^Teams/);
    const outlook = nodeOf(/^Outlook/);
    rerender(
      counts(
        PRODUCTS.map((product) => (product.id === 'teams' ? { ...product, count: 1 } : product)),
      ),
    );
    expect(nodeOf(/^Teams/)).toHaveTextContent('1');
    // A new element replays the fade; the same element would not.
    expect(nodeOf(/^Teams/)).not.toBe(teams);
    expect(nodeOf(/^Outlook/)).toBe(outlook);
  });
});

describe('the keyboard', () => {
  it('moves and chooses with the arrow keys, as any radio group does', async () => {
    const user = userEvent.setup();
    const changes: (ProductId | null)[] = [];
    render(<Rail onChange={(value) => changes.push(value)} />);
    screen.getByRole('radio', { name: /^All/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /^Teams/ })).toHaveFocus();
    expect(screen.getByRole('radio', { name: /^Teams/ })).toBeChecked();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: /^Exchange/ })).toBeChecked();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: /^Outlook/ })).toBeChecked();
    expect(changes).toEqual(['teams', 'outlook', 'exchange-online', 'outlook']);
  });

  it('goes to the first and last chip with Home and End', async () => {
    const user = userEvent.setup();
    render(<Rail start="outlook" />);
    screen.getByRole('radio', { name: /^Outlook/ }).focus();
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: /^Power Platform/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Power Platform/ })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: /^All/ })).toBeChecked();
  });

  it('skips the one that is out of reach on Home, End and the arrows', async () => {
    const user = userEvent.setup();
    render(<Rail start="entra-id" />);
    screen.getByRole('radio', { name: /^Entra/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /^Defender/ })).toBeChecked();
  });

  it('puts one chip in the tab order: the chosen one', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Rail start="azure" />
        <button type="button">After</button>
      </>,
    );
    screen.getByRole('button', { name: 'Before' }).focus();
    await user.tab();
    expect(screen.getByRole('radio', { name: /^Azure/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });
});

describe('the shared indicator', () => {
  it('sits under the chosen chip, and is a transform, not a background on each chip', () => {
    render(<Rail start="outlook" />);
    expect(track().style.getPropertyValue('--scn-ind-x')).toBe(`${2 * CHIP}px`);
    expect(track().style.getPropertyValue('--scn-ind-w')).toBe('100');
    expect(track().style.getPropertyValue('--scn-ind-o')).toBe('1');
    const indicator = track().querySelector('.scn-rail__ind');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    // One indicator for the whole rail.
    expect(track().querySelectorAll('.scn-rail__ind')).toHaveLength(1);
  });

  it('slides to the next chip, and starts moving only after the first frame', async () => {
    const user = userEvent.setup();
    render(<Rail />);
    expect(track()).not.toHaveAttribute('data-placed');
    raf.frame(16);
    expect(track()).toHaveAttribute('data-placed', 'true');
    expect(track().style.getPropertyValue('--scn-ind-x')).toBe('0px');
    await user.click(screen.getByRole('radio', { name: /^Exchange/ }));
    expect(track().style.getPropertyValue('--scn-ind-x')).toBe(`${3 * CHIP}px`);
  });

  it('marks the chosen chip for the stylesheet', () => {
    render(<Rail start="azure" />);
    expect(document.querySelectorAll('.scn-chip[data-selected]')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /^Azure/ }).closest('label')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });

  it('slides by transform in a component-sized beat, and a press settles an enabled chip a pixel', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'product-rail.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(
      /\.scn-rail__track\[data-placed\] \.scn-rail__ind\s*\{\s*transition:\s*transform var\(--motion-component\)/,
    );
    // The radio covers the chip, so it is the radio that is pressed; a disabled one never is.
    expect(css).toMatch(
      /\.scn-chip__input:not\(:disabled\):active \+ \.scn-chip__face\s*\{[^}]*background:\s*var\(--bg-pressed\)[^}]*transform:\s*translateY\(var\(--press-shift\)\)/,
    );
  });
});

describe('the row scrolls sideways', () => {
  it('brings a chosen chip that is out of view into it, once, without moving when it is in view', () => {
    render(<Rail start="power-platform" />);
    // The last chip is 13 x 110 = 1430 px along: centred it would be at 1430 - 250 = 1180, which is
    // as far as the row goes (14 x 110 - 600 = 940).
    expect(scrolls.at(-1)).toEqual({ left: 940, behavior: 'auto' });
    cleanup();
    scrolls.length = 0;
    render(<Rail start="outlook" />);
    expect(scrolls).toEqual([]);
  });

  it('fades the edge that has more beyond it', () => {
    render(<Rail />);
    const strip = document.querySelector('.scn-rail__scroller') as HTMLElement;
    expect(strip.dataset.more).toBe('end');
    strip.scrollLeft = 300;
    fireEvent.scroll(strip);
    raf.frame(16);
    expect(strip.dataset.more).toBe('start end');
    strip.scrollLeft = 940;
    fireEvent.scroll(strip);
    raf.frame(32);
    expect(strip.dataset.more).toBe('start');
  });

  it('can be dragged with a mouse, and a drag never chooses a chip', () => {
    const changes: (ProductId | null)[] = [];
    render(<Rail onChange={(value) => changes.push(value)} />);
    const outlook = screen.getByRole('radio', { name: /^Outlook/ });
    send(outlook, pointer('pointerdown', { clientX: 400, clientY: 20 }));
    send(document, pointer('pointermove', { clientX: 250, clientY: 20, timeStamp: 100 }));
    const strip = document.querySelector('.scn-rail__scroller') as HTMLElement;
    expect(strip).toHaveAttribute('data-dragging', 'true');
    expect(strip.scrollLeft).toBe(150);
    send(document, pointer('pointerup', { clientX: 250, clientY: 20, timeStamp: 120 }));
    fireEvent.click(outlook);
    expect(changes).toEqual([]);
  });

  it('never wraps: one row that keeps its chips on a line', () => {
    render(<Rail />);
    expect(group().querySelectorAll('.scn-rail__track')).toHaveLength(1);
  });
});
