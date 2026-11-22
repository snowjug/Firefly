import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MOUSE, pointer, send, stubMedia, stubRaf } from '../interaction/test-utils.ts';
import { Carousel } from './Carousel.tsx';

// jsdom has no layout, so the geometry is stood in for: sixteen-or-so items 280 px wide with 16 px
// between them and 8 px of room at each end, in a window 1216 px wide that shows four and a bit.
const STEP = 296;
const WINDOW = 1216;
const BAR = 300;

type Box = HTMLElement & { scrollLeft: number };

function stubLayout() {
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    if (this.classList.contains('ff-carousel__viewport')) return WINDOW;
    if (this.classList.contains('ff-carousel__bar')) return BAR;
    return 0;
  });
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('ff-carousel__viewport')
      ? (this.querySelectorAll('.ff-carousel__item').length || 0) * STEP
      : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.classList.contains('ff-carousel__item')) return 0;
    return 8 + [...(this.parentElement?.children ?? [])].indexOf(this) * STEP;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('ff-carousel__item') ? 280 : 0;
  });
}

interface ScrollCall {
  left: number;
  behavior: ScrollBehavior | undefined;
}

/** Elements have no scrollTo in jsdom: this one records the call, then does what the browser would. */
function stubScrollTo(): ScrollCall[] {
  const calls: ScrollCall[] = [];
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value(this: Box, options: ScrollToOptions) {
      calls.push({ left: options.left ?? 0, behavior: options.behavior });
      this.scrollLeft = options.left ?? 0;
      this.dispatchEvent(new Event('scroll'));
    },
  });
  return calls;
}

const viewport = () => document.querySelector('.ff-carousel__viewport') as Box;
const items = () => within(screen.getByRole('list')).getAllByRole('listitem');
const previous = () => screen.getByRole('button', { name: 'Previous scenarios' });
const next = () => screen.getByRole('button', { name: 'Next scenarios' });
const count = () => document.querySelector('.ff-carousel__count') as HTMLElement;

function Links({ total = 12 }: { total?: number }) {
  return (
    <Carousel label="Featured scenarios" noun="scenarios" mode="link">
      {Array.from({ length: total }, (_, index) => (
        <a key={index} href={`#item-${index + 1}`}>
          Item {index + 1}
        </a>
      ))}
    </Carousel>
  );
}

function Choices({
  total = 12,
  start = 0,
  onPick,
}: {
  total?: number;
  start?: number;
  onPick?(index: number): void;
}) {
  const [selected, setSelected] = useState(start);
  return (
    <Carousel label="Scenarios" noun="scenarios" mode="select" selectedIndex={selected}>
      {Array.from({ length: total }, (_, index) => (
        <label key={index}>
          <input
            type="radio"
            name="gallery"
            checked={selected === index}
            onChange={() => {
              setSelected(index);
              onPick?.(index);
            }}
          />
          Choice {index + 1}
        </label>
      ))}
    </Carousel>
  );
}

let raf: ReturnType<typeof stubRaf>;
let scrolls: ScrollCall[];

beforeEach(() => {
  stubLayout();
  scrolls = stubScrollTo();
  raf = stubRaf();
  // The last thing anyone did was press a key, so a focus is a keyboard focus.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
});

describe('what it is to a screen reader', () => {
  it('is a named carousel region holding a standard list of items', () => {
    render(<Links />);
    const region = screen.getByRole('region', { name: 'Featured scenarios' });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    expect(region.tagName).toBe('SECTION');
    const list = within(region).getByRole('list');
    expect(list.tagName).toBe('UL');
    expect(items()).toHaveLength(12);
    for (const item of items()) expect(item.tagName).toBe('LI');
  });

  it('gives every item its place in the set, "3 of 12"', () => {
    render(<Links />);
    items().forEach((item, index) => {
      expect(item).toHaveAttribute('aria-posinset', String(index + 1));
      expect(item).toHaveAttribute('aria-setsize', '12');
    });
  });

  it('shows the count as plain text that the region is described by, not as a live region', () => {
    render(<Links />);
    const region = screen.getByRole('region', { name: 'Featured scenarios' });
    expect(count()).toHaveTextContent('1\u20134 of 12');
    expect(count()).not.toHaveTextContent('Selected');
    expect(region).toHaveAttribute('aria-describedby', count().id);
    expect(count().closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('names its two buttons by what they move, and what they control', () => {
    render(<Links />);
    const list = screen.getByRole('list');
    expect(previous()).toHaveAttribute('aria-controls', list.id);
    expect(next()).toHaveAttribute('aria-controls', list.id);
    expect(previous().getAttribute('aria-label')).toBe('Previous scenarios');
  });

  it('hides the position bar, which the count already says', () => {
    render(<Links />);
    expect(document.querySelector('.ff-carousel__bar')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing for no items', () => {
    const { container } = render(<Carousel label="None">{[]}</Carousel>);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts the chosen item\u2019s place when there is a choice, and says that it is the choice', () => {
    render(<Choices start={2} />);
    expect(count()).toHaveTextContent('Selected 3 of 12');
    expect(count().querySelector('.ff-carousel__kind')).toHaveTextContent('Selected');
    expect(screen.getByRole('region', { name: 'Scenarios' })).toHaveAccessibleDescription(
      'Selected 3 of 12',
    );
  });
});

describe('the edge that has more beyond it', () => {
  it('is marked, so it can fade: the end at first, both ends part-way, the start at the far end', async () => {
    const user = userEvent.setup();
    render(<Links />);
    expect(viewport()).toHaveAttribute('data-more', 'end');
    await user.click(next());
    raf.frame(16);
    expect(viewport()).toHaveAttribute('data-more', 'start end');
    await user.click(next());
    raf.frame(32);
    await user.click(next());
    raf.frame(48);
    expect(viewport()).toHaveAttribute('data-more', 'start');
  });

  it('is not marked when everything fits', () => {
    render(<Links total={3} />);
    expect(viewport()).not.toHaveAttribute('data-more');
  });
});

describe('the previous and next buttons', () => {
  it('start with previous unavailable, and say so without taking focus away', () => {
    render(<Links />);
    expect(previous()).toHaveAttribute('aria-disabled', 'true');
    expect(previous()).not.toBeDisabled();
    expect(next()).not.toHaveAttribute('aria-disabled');
  });

  it('scroll by the number of items that are wholly visible', async () => {
    const user = userEvent.setup();
    render(<Links />);
    await user.click(next());
    expect(scrolls.at(-1)).toEqual({ left: 4 * STEP, behavior: 'smooth' });
  });

  it('follow the scroll: previous wakes, and next goes quiet at the far end', async () => {
    const user = userEvent.setup();
    render(<Links />);
    await user.click(next());
    raf.frame(16);
    expect(previous()).not.toHaveAttribute('aria-disabled');
    expect(count()).toHaveTextContent('5\u20138 of 12');
    await user.click(next());
    raf.frame(32);
    await user.click(next());
    raf.frame(48);
    expect(next()).toHaveAttribute('aria-disabled', 'true');
    // The last page is as far as the scroller goes, not past it.
    expect(viewport().scrollLeft).toBe(12 * STEP - WINDOW);
  });

  it('do nothing when they are unavailable', async () => {
    const user = userEvent.setup();
    render(<Links />);
    const before = scrolls.length;
    await user.click(previous());
    expect(scrolls).toHaveLength(before);
  });

  it('go back a page the same way', async () => {
    const user = userEvent.setup();
    render(<Links />);
    await user.click(next());
    raf.frame(16);
    await user.click(previous());
    expect(scrolls.at(-1)).toEqual({ left: 0, behavior: 'smooth' });
  });

  it('are both unavailable when everything fits', () => {
    render(<Links total={3} />);
    expect(previous()).toHaveAttribute('aria-disabled', 'true');
    expect(next()).toHaveAttribute('aria-disabled', 'true');
  });

  it('move the position thumb with transforms only, from one end of its bar to the other', async () => {
    const user = userEvent.setup();
    render(<Links />);
    const thumb = document.querySelector('.ff-carousel__thumb') as HTMLElement;
    const width = parseFloat(thumb.style.getPropertyValue('--ff-thumb-w'));
    expect(width).toBe(Math.round((BAR * WINDOW) / (12 * STEP)));
    expect(thumb.style.getPropertyValue('--ff-thumb-x')).toBe('0px');
    await user.click(next());
    raf.frame(16);
    await user.click(next());
    raf.frame(32);
    await user.click(next());
    raf.frame(48);
    expect(parseFloat(thumb.style.getPropertyValue('--ff-thumb-x'))).toBeCloseTo(BAR - width, 0);
  });
});

describe('the keyboard, in a gallery of links', () => {
  it('moves focus along the items with the arrow keys, and to either end with Home and End', async () => {
    const user = userEvent.setup();
    render(<Links />);
    const links = screen.getAllByRole('link');
    links[0]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(links[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(links[11]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(links[10]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(links[0]).toHaveFocus();
  });

  it('stops at the ends instead of going round', async () => {
    const user = userEvent.setup();
    render(<Links />);
    const links = screen.getAllByRole('link');
    links[0]?.focus();
    await user.keyboard('{ArrowLeft}');
    expect(links[0]).toHaveFocus();
    links[11]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(links[11]).toHaveFocus();
  });

  it('leaves the vertical arrows to the page', async () => {
    const user = userEvent.setup();
    render(<Links />);
    const links = screen.getAllByRole('link');
    links[2]?.focus();
    const down = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    links[2]?.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(links[2]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(links[2]).toHaveFocus();
  });

  it('keeps Tab going through every link, so the arrows are an extra', async () => {
    const user = userEvent.setup();
    render(<Links total={6} />);
    await user.tab();
    const seen: (string | null)[] = [];
    for (let step = 0; step < 6; step++) {
      seen.push(document.activeElement?.textContent ?? null);
      await user.tab();
    }
    expect(seen).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6']);
    // ...and on to the two buttons.
    expect(previous()).toHaveFocus();
    await user.tab();
    expect(next()).toHaveFocus();
  });

  it('brings the item it moved to into view, and one that takes focus by Tab too', async () => {
    const user = userEvent.setup();
    render(<Links />);
    const links = screen.getAllByRole('link');
    links[3]?.focus();
    const before = scrolls.length;
    await user.keyboard('{End}');
    expect(scrolls.length).toBeGreaterThan(before);
    expect(scrolls.at(-1)).toEqual({ left: 12 * STEP - WINDOW, behavior: 'smooth' });
    links[0]?.focus();
    expect(scrolls.at(-1)).toEqual({ left: 0, behavior: 'smooth' });
  });

  it('does not scroll the item under a pointer that has just pressed it', () => {
    render(<Links />);
    const links = screen.getAllByRole('link');
    document.dispatchEvent(new Event('pointerdown'));
    const before = scrolls.length;
    links[6]?.focus();
    expect(scrolls).toHaveLength(before);
  });
});

describe('the keyboard, in a gallery with a choice', () => {
  it('chooses as it moves, as any radio group does, and keeps what it moved to in view', async () => {
    const user = userEvent.setup();
    const picked: number[] = [];
    render(<Choices onPick={(index) => picked.push(index)} />);
    const radios = screen.getAllByRole('radio');
    radios[0]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toBeChecked();
    await user.keyboard('{End}');
    expect(radios[11]).toBeChecked();
    expect(count()).toHaveTextContent('12 of 12');
    await user.keyboard('{Home}');
    expect(radios[0]).toBeChecked();
    expect(picked).toEqual([1, 11, 0]);
    expect(scrolls.length).toBeGreaterThan(0);
  });

  it('moves with the up and down arrows too, never round the ends', async () => {
    const user = userEvent.setup();
    render(<Choices start={11} />);
    const radios = screen.getAllByRole('radio');
    radios[11]?.focus();
    await user.keyboard('{ArrowDown}');
    expect(radios[11]).toBeChecked();
    await user.keyboard('{ArrowUp}');
    expect(radios[10]).toBeChecked();
  });

  it('puts one radio in the tab order, and then the two buttons', async () => {
    const user = userEvent.setup();
    render(<Choices start={4} />);
    await user.tab();
    expect(screen.getAllByRole('radio')[4]).toHaveFocus();
    await user.tab();
    expect(previous()).toHaveFocus();
  });

  it('selects on a click, and says which of them with the count', async () => {
    const user = userEvent.setup();
    render(<Choices />);
    await user.click(screen.getByLabelText('Choice 3'));
    expect(screen.getByLabelText('Choice 3')).toBeChecked();
    expect(count()).toHaveTextContent('3 of 12');
  });
});

describe('the chosen item stays in view', () => {
  it('on the first render, at once', () => {
    render(<Choices start={9} />);
    expect(scrolls[0]).toEqual({ left: 12 * STEP - WINDOW, behavior: 'auto' });
  });

  it('when the choice moves, smoothly', async () => {
    const user = userEvent.setup();
    render(<Choices start={0} />);
    expect(scrolls).toHaveLength(0);
    await user.click(screen.getByLabelText('Choice 8'));
    expect(scrolls.at(-1)).toEqual({ left: 7 * STEP, behavior: 'smooth' });
  });

  it('leaves it where it is when it is already wholly visible', async () => {
    const user = userEvent.setup();
    render(<Choices start={0} />);
    await user.click(screen.getByLabelText('Choice 3'));
    expect(scrolls).toHaveLength(0);
  });

  it('when the items change, as they do with a filter, at once', () => {
    function Filtered({ ids }: { ids: number[] }) {
      return (
        <Carousel label="Scenarios" mode="select" selectedIndex={ids.indexOf(9)}>
          {ids.map((id) => (
            <label key={id}>
              <input type="radio" name="g" checked={id === 9} onChange={() => undefined} />
              Choice {id}
            </label>
          ))}
        </Carousel>
      );
    }
    const { rerender } = render(<Filtered ids={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} />);
    scrolls.length = 0;
    rerender(<Filtered ids={[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]} />);
    expect(scrolls.at(-1)?.behavior).toBe('auto');
    expect(scrolls.at(-1)?.left).toBe(7 * STEP);
  });
});

describe('a mouse drag', () => {
  it('scrolls the items, and ends with a click that never chooses a card', async () => {
    const picked: number[] = [];
    render(<Choices onPick={(index) => picked.push(index)} />);
    const el = viewport();
    send(items()[1] as HTMLElement, pointer('pointerdown', { clientX: 600, clientY: 50 }));
    send(document, pointer('pointermove', { clientX: 400, clientY: 50, timeStamp: 200 }));
    expect(el).toHaveAttribute('data-dragging', 'true');
    expect(el.scrollLeft).toBe(200);
    send(document, pointer('pointerup', { clientX: 400, clientY: 50, timeStamp: 220 }));
    expect(el).not.toHaveAttribute('data-dragging');
    // The browser sends a click to the item under the pointer when the button is released.
    fireEvent.click(screen.getByLabelText('Choice 4'));
    expect(picked).toEqual([]);
    expect(screen.getByLabelText('Choice 1')).toBeChecked();
  });

  it('still chooses on a click that never became a drag', async () => {
    const user = userEvent.setup();
    const picked: number[] = [];
    render(<Choices onPick={(index) => picked.push(index)} />);
    const el = viewport();
    send(items()[1] as HTMLElement, pointer('pointerdown', { clientX: 600, clientY: 50 }));
    send(document, pointer('pointermove', { clientX: 598, clientY: 50, timeStamp: 100 }));
    send(document, pointer('pointerup', { clientX: 598, clientY: 50, timeStamp: 120 }));
    expect(el).not.toHaveAttribute('data-dragging');
    await user.click(screen.getByLabelText('Choice 2'));
    expect(picked).toEqual([1]);
  });

  it('moves one item for a short, fast flick, gliding there with snapping held off until it arrives', () => {
    render(<Links />);
    const el = viewport();
    // 60 px at 3 px per ms: over the swipe distance, and fast.
    send(
      items()[1] as HTMLElement,
      pointer('pointerdown', { clientX: 600, clientY: 50, timeStamp: 0 }),
    );
    send(document, pointer('pointermove', { clientX: 560, clientY: 50, timeStamp: 10 }));
    send(document, pointer('pointermove', { clientX: 540, clientY: 50, timeStamp: 20 }));
    send(document, pointer('pointerup', { clientX: 540, clientY: 50, timeStamp: 25 }));
    expect(scrolls.at(-1)).toEqual({ left: STEP, behavior: 'smooth' });
    // The browser would snap back at once and then reverse; it waits until the glide has arrived.
    expect(el).toHaveAttribute('data-settling', 'true');
    // The drag's own scrolling can still send `scrollend`: that is not the glide arriving.
    fireEvent(el, new Event('scrollend'));
    expect(el).toHaveAttribute('data-settling', 'true');
    raf.frame(16);
    expect(el).not.toHaveAttribute('data-settling');
  });

  it('holds snapping off before it reads the layout: the browser snaps the moment it works out the styles', () => {
    render(<Links />);
    const el = viewport();
    send(
      items()[1] as HTMLElement,
      pointer('pointerdown', { clientX: 600, clientY: 50, timeStamp: 0 }),
    );
    send(document, pointer('pointermove', { clientX: 540, clientY: 50, timeStamp: 10 }));
    const reads: (string | null)[] = [];
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (!this.classList.contains('ff-carousel__item')) return 0;
      reads.push(el.getAttribute('data-settling'));
      return 8 + [...(this.parentElement?.children ?? [])].indexOf(this) * STEP;
    });
    send(document, pointer('pointerup', { clientX: 540, clientY: 50, timeStamp: 20 }));
    expect(reads.length).toBeGreaterThan(0);
    expect([...new Set(reads)]).toEqual(['true']);
  });

  it('glides to the item nearest to where a longer drag was let go, instead of jumping there', () => {
    render(<Links />);
    const el = viewport();
    send(
      items()[1] as HTMLElement,
      pointer('pointerdown', { clientX: 900, clientY: 50, timeStamp: 0 }),
    );
    // Dragged 1.4 items along, and let go slowly.
    send(document, pointer('pointermove', { clientX: 486, clientY: 50, timeStamp: 600 }));
    expect(el.scrollLeft).toBe(414);
    send(document, pointer('pointerup', { clientX: 486, clientY: 50, timeStamp: 2400 }));
    expect(scrolls.at(-1)).toEqual({ left: STEP, behavior: 'smooth' });
    expect(el).toHaveAttribute('data-settling', 'true');
  });

  it('glides back to the item it began on after a slow drag that went nowhere', () => {
    render(<Links />);
    send(
      items()[1] as HTMLElement,
      pointer('pointerdown', { clientX: 600, clientY: 50, timeStamp: 0 }),
    );
    send(document, pointer('pointermove', { clientX: 590, clientY: 50, timeStamp: 500 }));
    send(document, pointer('pointerup', { clientX: 590, clientY: 50, timeStamp: 900 }));
    expect(scrolls.at(-1)).toEqual({ left: 0, behavior: 'smooth' });
  });

  it('lets go of the snapping after a moment even if the glide is cut short', () => {
    vi.useFakeTimers();
    render(<Links />);
    const el = viewport();
    send(
      items()[1] as HTMLElement,
      pointer('pointerdown', { clientX: 600, clientY: 50, timeStamp: 0 }),
    );
    send(document, pointer('pointermove', { clientX: 500, clientY: 50, timeStamp: 400 }));
    send(document, pointer('pointerup', { clientX: 500, clientY: 50, timeStamp: 900 }));
    expect(el).toHaveAttribute('data-settling', 'true');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(el).not.toHaveAttribute('data-settling');
  });

  it('settles at once, without a glide, for a person who asked for less motion', () => {
    stubMedia({ ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true });
    render(<Links />);
    const el = viewport();
    send(
      items()[1] as HTMLElement,
      pointer('pointerdown', { clientX: 900, clientY: 50, timeStamp: 0 }),
    );
    send(document, pointer('pointermove', { clientX: 700, clientY: 50, timeStamp: 900 }));
    send(document, pointer('pointerup', { clientX: 700, clientY: 50, timeStamp: 1900 }));
    expect(scrolls.at(-1)).toEqual({ left: STEP, behavior: 'auto' });
    expect(el).toHaveAttribute('data-settling', 'true');
    raf.frame(16);
    expect(el).not.toHaveAttribute('data-settling');
  });

  it('stretches a little past the start, and the track settles back on release', () => {
    stubMedia(DESKTOP_MOUSE);
    render(<Links />);
    const el = viewport();
    send(items()[1] as HTMLElement, pointer('pointerdown', { clientX: 300, clientY: 50 }));
    send(document, pointer('pointermove', { clientX: 450, clientY: 50, timeStamp: 100 }));
    expect(el.style.getPropertyValue('--drag-overscroll')).toBe('-48px');
    send(document, pointer('pointerup', { clientX: 450, clientY: 50, timeStamp: 120 }));
    expect(el.style.getPropertyValue('--drag-overscroll')).toBe('');
  });

  it('does not stretch for a person who asked for less motion, and still scrolls', () => {
    stubMedia({ ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true });
    render(<Links />);
    const el = viewport();
    send(items()[1] as HTMLElement, pointer('pointerdown', { clientX: 600, clientY: 50 }));
    send(document, pointer('pointermove', { clientX: 500, clientY: 50, timeStamp: 100 }));
    expect(el.scrollLeft).toBe(100);
    send(document, pointer('pointermove', { clientX: 900, clientY: 50, timeStamp: 200 }));
    expect(el.scrollLeft).toBe(0);
    expect(el.style.getPropertyValue('--drag-overscroll')).toBe('');
  });

  it('does not stretch on a coarse pointer', () => {
    stubMedia({ '(hover: none)': true, '(pointer: coarse)': true });
    render(<Links />);
    const el = viewport();
    send(items()[1] as HTMLElement, pointer('pointerdown', { clientX: 300, clientY: 50 }));
    send(document, pointer('pointermove', { clientX: 450, clientY: 50, timeStamp: 100 }));
    expect(el.style.getPropertyValue('--drag-overscroll')).toBe('');
  });

  it('leaves touch to the browser: a touch pointer starts no drag', () => {
    render(<Links />);
    const el = viewport();
    send(
      items()[1] as HTMLElement,
      pointer('pointerdown', { clientX: 600, clientY: 50, pointerType: 'touch' }),
    );
    send(
      document,
      pointer('pointermove', { clientX: 400, clientY: 50, pointerType: 'touch', timeStamp: 100 }),
    );
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el.scrollLeft).toBe(0);
  });
});

describe('the wheel', () => {
  it('is left to the browser: a vertical wheel over the gallery is not stopped', () => {
    render(<Links />);
    const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
    viewport().dispatchEvent(wheel);
    const sideways = new WheelEvent('wheel', { deltaX: 120, bubbles: true, cancelable: true });
    viewport().dispatchEvent(sideways);
    expect(wheel.defaultPrevented).toBe(false);
    expect(sideways.defaultPrevented).toBe(false);
  });
});

describe('reduced motion', () => {
  it('scrolls smoothly when motion is allowed, and at once when it is not', async () => {
    const user = userEvent.setup();
    render(<Links />);
    await user.click(next());
    expect(scrolls.at(-1)?.behavior).toBe('smooth');
    cleanup();

    stubMedia({ '(prefers-reduced-motion: reduce)': true });
    render(<Links />);
    await user.click(next());
    expect(scrolls.at(-1)?.behavior).toBe('auto');
  });

  it('also brings a focused item into view at once', async () => {
    stubMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<Links />);
    screen.getAllByRole('link')[0]?.focus();
    await user.keyboard('{End}');
    expect(scrolls.at(-1)?.behavior).toBe('auto');
  });
});

describe('it never moves by itself', () => {
  it('does not scroll, choose or loop however long it is left, focused or not', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] });
    render(<Choices start={3} />);
    screen.getAllByRole('radio')[3]?.focus();
    const before = { scrolls: scrolls.length, left: viewport().scrollLeft };
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    raf.frame(100_000);
    expect(scrolls).toHaveLength(before.scrolls);
    expect(viewport().scrollLeft).toBe(before.left);
    expect(screen.getAllByRole('radio')[3]).toBeChecked();
    expect(count()).toHaveTextContent('4 of 12');
    // Nothing was copied for a loop: twelve items in, twelve out.
    expect(items()).toHaveLength(12);
  });

  it('asks the page for no timer and no animation frame of its own while it is still', () => {
    const timers = vi.spyOn(globalThis, 'setInterval');
    render(<Links />);
    expect(timers).not.toHaveBeenCalled();
    expect(raf.pending()).toBe(0);
  });
});

describe('what its stylesheet promises', () => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'carousel.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  it('lets the browser scroll and snap for touch, and keeps the page\u2019s own gestures', () => {
    expect(css).toMatch(/scroll-snap-type:\s*x mandatory/);
    expect(css).toMatch(/scroll-snap-align:\s*start/);
    expect(css).toMatch(/overscroll-behavior-x:\s*contain/);
    expect(css).toMatch(/touch-action:\s*pan-x pan-y/);
  });

  it('stretches the track by the drag hook\u2019s property, with a spring to settle', () => {
    expect(css).toMatch(/translateX\(calc\(var\(--drag-overscroll, 0px\) \* -1\)\)/);
    expect(css).toMatch(/transition:\s*transform var\(--dur-spring\) var\(--ease-spring\)/);
  });

  it('holds snapping off while it glides to where a drag comes to rest', () => {
    expect(css).toMatch(
      /\.ff-carousel__viewport\[data-settling='true'\]\s*\{\s*scroll-snap-type:\s*none;\s*\}/,
    );
  });

  it('fades an edge that has more beyond it with a mask, the start only as wide as the room before the first item', () => {
    for (const edge of ['end', 'start', 'start end']) {
      expect(css).toMatch(new RegExp(`\\[data-more='${edge}'\\]\\s*\\{[^}]*mask-image:`));
    }
    const start = css.match(/\[data-more='start'\]\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(start).toContain('var(--ff-carousel-inset)');
    expect(start).not.toContain('var(--ff-carousel-fade)');
  });

  it('runs out into the page\u2019s side padding, and on a phone leaves a slice of the next item showing', () => {
    expect(css).toMatch(/--ff-carousel-inset:\s*var\(--gutter\)/);
    const flat = css.replace(/\s+/g, ' ');
    expect(flat).toMatch(
      /@media \(max-width: 47\.99em\) \{ \.ff-carousel__item \{ flex-basis: min\(/,
    );
    expect(flat).toContain(
      'calc(100cqw - var(--ff-carousel-inset) - var(--sp-4) - var(--ff-carousel-peek))',
    );
  });

  it('has no hover effect outside a fine hovering pointer, and none keyed on anything but data-fx', () => {
    const hover = [...css.matchAll(/[^{}]*:hover[^{}]*\{/g)].map((match) => match[0].trim());
    expect(hover.length).toBeGreaterThan(0);
    const outside = css
      .split('@media (hover: hover) and (pointer: fine) {')
      .map((part, index) => (index === 0 ? part : part.slice(part.indexOf('\n}\n') + 3)))
      .join('');
    expect(outside).not.toMatch(/:hover/);
  });

  it('never autoplays: no animation or interval of its own', () => {
    expect(css).not.toMatch(/animation\s*:/);
    expect(css).not.toMatch(/@keyframes/);
  });
});
