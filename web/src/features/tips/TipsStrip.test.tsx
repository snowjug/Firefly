import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnouncerProvider } from '../../design/index.ts';
import {
  DESKTOP_MOUSE,
  layOut,
  pointer,
  send,
  stubMedia,
  stubRaf,
} from '../../design/interaction/test-utils.ts';
import { TipsStrip, type TipsStripProps } from './TipsStrip.tsx';
import { TIPS } from './tips.ts';
import { dragShift, DRAG_FOLLOW, EDGE_FOLLOW, velocityOf } from './use-deck-gestures.ts';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(async () => {
  cleanup();
  // Real timers first: the tick below is a real timeout.
  vi.useRealTimers();
  // A drag that just ended swallows the next click for one tick: let that pass between tests.
  await tick();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const BASE: TipsStripProps = {
  stage: 'first-contact',
  traineeTurns: 0,
  customerTurns: 1,
  customerBusy: false,
};

function mount(extra: Partial<TipsStripProps> = {}) {
  const ui = (props: Partial<TipsStripProps>) => (
    <AnnouncerProvider>
      <TipsStrip {...BASE} {...extra} {...props} />
    </AnnouncerProvider>
  );
  const view = render(ui({}));
  return { ...view, update: (props: Partial<TipsStripProps>) => view.rerender(ui(props)) };
}

const strip = () => screen.getByRole('region', { name: 'Tips for this call' });
const shown = () =>
  document.querySelector('.tp-card[data-current="true"] .tp-card__text')?.textContent;
const next = () => screen.getByRole('button', { name: 'Next tip' });
const previous = () => screen.getByRole('button', { name: 'Previous tip' });
const learnWhy = () => screen.getByRole('button', { name: 'Learn why' });
const announced = () =>
  document.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? '';
const track = () => document.querySelector('.tp-track') as HTMLElement;
const textOf = (index: number) => TIPS[index]?.text;
const focus = (element: HTMLElement) => act(() => element.focus());

describe('the strip', () => {
  it('is a named region with a heading and one card for each tip, each named by its place', () => {
    mount();
    const region = strip();
    expect(
      within(region).getByRole('heading', { level: 2, name: 'During the call' }),
    ).toBeInTheDocument();
    const cards = within(region).getAllByRole('listitem');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(
      TIPS.map((_, index) => `Tip ${index + 1} of ${TIPS.length}`),
    );
    expect(region.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    expect(cards[0]).toHaveAttribute('aria-current', 'true');
  });

  it('starts at the first tip of the phase the call is in', () => {
    const first = (phase: string) => TIPS.find((tip) => tip.phase === phase)?.text;
    const { unmount } = mount();
    expect(shown()).toBe(first('opening'));
    unmount();
    const resumed = mount({ traineeTurns: 5 });
    expect(shown()).toBe(first('empathy'));
    resumed.unmount();
    mount({ stage: 'closure', traineeTurns: 5 });
    expect(shown()).toBe(first('closing'));
  });

  it('says nothing on its own: it is not a live region, and the announcer stays silent as tips move', async () => {
    const user = userEvent.setup();
    const { update } = mount();
    expect(document.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
    expect(
      strip().querySelector('[aria-live], [role="status"], [role="alert"], [role="log"]'),
    ).toBe(null);
    await user.click(next());
    await user.keyboard('{ArrowRight}');
    await user.click(learnWhy());
    update({ customerTurns: 2 });
    update({ customerTurns: 3 });
    expect(announced()).toBe('');
    expect(strip().querySelector('[aria-live]')).toBeNull();
  });

  it('is the same cards in the same places whichever tip shows: moving changes no sizes', async () => {
    const user = userEvent.setup();
    mount();
    const cards = [...track().children];
    const outside = () =>
      ['.tp-deck', '.tp-nav', '.tp-strip__hide', '.tp-strip__title'].map(
        (selector) => strip().querySelectorAll(selector).length,
      );
    const before = outside();
    await user.click(next());
    await user.click(next());
    // The very same elements, in the same order: nothing is added, removed or replaced.
    expect([...track().children].every((card, place) => card === cards[place])).toBe(true);
    expect(track().children).toHaveLength(cards.length);
    expect(outside()).toEqual(before);
    // The card that shows is told apart by an attribute alone.
    expect(strip().querySelectorAll('.tp-card[data-current]')).toHaveLength(1);
  });
});

describe('moving the tips by hand', () => {
  it('goes one tip with Previous and Next; at either end the button is dimmed but stays reachable', async () => {
    const user = userEvent.setup();
    mount();
    expect(shown()).toBe(textOf(0));
    expect(previous()).toHaveAttribute('aria-disabled', 'true');
    expect(previous()).not.toBeDisabled();
    await user.click(previous());
    expect(shown()).toBe(textOf(0));
    await user.click(next());
    expect(shown()).toBe(textOf(1));
    expect(previous()).not.toHaveAttribute('aria-disabled');
    await user.click(previous());
    expect(shown()).toBe(textOf(0));
    for (let step = 0; step < TIPS.length - 1; step += 1) await user.click(next());
    expect(shown()).toBe(textOf(TIPS.length - 1));
    expect(next()).toHaveAttribute('aria-disabled', 'true');
    await user.click(next());
    expect(shown()).toBe(textOf(TIPS.length - 1));
  });

  it('moves with the arrow keys, Home and End while the keyboard is in the strip, and nowhere else', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(next());
    expect(shown()).toBe(textOf(1));
    await user.keyboard('{ArrowRight}');
    expect(shown()).toBe(textOf(2));
    await user.keyboard('{ArrowLeft}');
    expect(shown()).toBe(textOf(1));
    await user.keyboard('{End}');
    expect(shown()).toBe(textOf(TIPS.length - 1));
    await user.keyboard('{Home}');
    expect(shown()).toBe(textOf(0));
    // A chord with a modifier belongs to the browser.
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(shown()).toBe(textOf(0));
    // And the keyboard anywhere else on the page is not the strip's.
    act(() => (document.activeElement as HTMLElement).blur());
    await user.keyboard('{ArrowRight}{End}');
    expect(shown()).toBe(textOf(0));
  });

  it('shows where a tip is in the list to a screen reader, by the name of its card', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(next());
    expect(screen.getByRole('listitem', { name: `Tip 2 of ${TIPS.length}` })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('listitem', { name: `Tip 1 of ${TIPS.length}` })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

describe('putting the strip away', () => {
  it('is put away with Hide tips, leaving one quiet button that takes the keyboard, and comes back where it was', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(next());
    await user.click(next());
    const where = shown();
    await user.click(screen.getByRole('button', { name: 'Hide tips' }));
    expect(screen.queryByRole('button', { name: 'Next tip' })).toBeNull();
    expect(screen.queryByText('During the call')).toBeNull();
    const show = screen.getByRole('button', { name: 'Show tips' });
    expect(strip()).toContainElement(show);
    expect(show).toHaveFocus();
    await user.click(show);
    expect(screen.getByRole('button', { name: 'Hide tips' })).toHaveFocus();
    expect(shown()).toBe(where);
  });

  it('can start put away, and keeps nothing beyond this call', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const first = mount({ defaultHidden: true });
    expect(screen.getByRole('button', { name: 'Show tips' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next tip' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show tips' }));
    await user.click(screen.getByRole('button', { name: 'Hide tips' }));
    expect(setItem).not.toHaveBeenCalled();
    // Another call: the strip is back.
    first.unmount();
    mount();
    expect(screen.getByRole('button', { name: 'Next tip' })).toBeInTheDocument();
  });
});

describe('what brings a new tip', () => {
  it('waits for the customer to finish speaking, and then brings one new tip, once', () => {
    const { update } = mount({ customerTurns: 1, customerBusy: false });
    const first = shown();
    update({ customerTurns: 2, customerBusy: true });
    expect(shown()).toBe(first);
    update({ customerTurns: 2, customerBusy: true });
    expect(shown()).toBe(first);
    update({ customerTurns: 2, customerBusy: false });
    const second = shown();
    expect(second).not.toBe(first);
    update({ customerTurns: 2, customerBusy: false });
    expect(shown()).toBe(second);
  });

  it('brings one tip for a customer turn that arrives while the voice is silent', () => {
    const { update } = mount({ customerTurns: 1 });
    const first = shown();
    update({ customerTurns: 2 });
    expect(shown()).not.toBe(first);
  });

  it('never rotates on a timer: a long wait with nothing happening moves nothing and sets no timer', () => {
    vi.useFakeTimers();
    mount();
    const first = shown();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });
    expect(shown()).toBe(first);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not move under a person who is using the strip: a tip that comes due then is let go', () => {
    const { update } = mount({ customerTurns: 1 });
    const first = shown();
    focus(next());
    update({ customerTurns: 2 });
    expect(shown()).toBe(first);
    // It was let go, not kept: leaving the strip does not bring it up later.
    act(() => next().blur());
    update({ customerTurns: 2 });
    expect(shown()).toBe(first);
    // The next customer turn does.
    update({ customerTurns: 3 });
    expect(shown()).not.toBe(first);
  });

  it('does not move while “Learn why” is open, and lets that tip go', () => {
    const { update } = mount({ customerTurns: 1 });
    const first = shown();
    fireEvent.click(learnWhy());
    update({ customerTurns: 2 });
    expect(shown()).toBe(first);
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => learnWhy().blur());
    update({ customerTurns: 2 });
    expect(shown()).toBe(first);
  });

  it('is moved a step at a time by the person alone: a new tip is never the one already on show', () => {
    const { update } = mount({ customerTurns: 1 });
    for (let turn = 2; turn < 8; turn += 1) {
      const before = shown();
      update({ customerTurns: turn });
      expect(shown()).not.toBe(before);
    }
  });
});

describe('Learn why', () => {
  const line = () =>
    document.getElementById(learnWhy().getAttribute('aria-controls') as string) as HTMLElement;

  it('is a disclosure: it shows the tip’s line when opened, and the line is short', async () => {
    const user = userEvent.setup();
    mount();
    expect(learnWhy()).toHaveAttribute('aria-expanded', 'false');
    await user.click(learnWhy());
    expect(learnWhy()).toHaveAttribute('aria-expanded', 'true');
    expect(line()).toHaveTextContent(TIPS[0]?.why as string);
    expect((line().textContent ?? '').trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    await user.click(learnWhy());
    expect(learnWhy()).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.tp-why')).toBeNull();
  });

  it('closes with Escape, and the keyboard is back on the button', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(learnWhy());
    await user.tab();
    await user.keyboard('{Escape}');
    expect(learnWhy()).toHaveAttribute('aria-expanded', 'false');
    expect(learnWhy()).toHaveFocus();
  });

  it('closes on a press anywhere outside the strip, but not on one inside it', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(learnWhy());
    fireEvent.pointerDown(document.querySelector('.tp-card__text') as Element);
    expect(learnWhy()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(document.body);
    expect(learnWhy()).toHaveAttribute('aria-expanded', 'false');
  });

  it('belongs to the tip it was opened on: another tip closes it, and it stays closed on coming back', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(learnWhy());
    await user.click(next());
    expect(document.querySelector('.tp-why')).toBeNull();
    await user.click(previous());
    expect(document.querySelector('.tp-why')).toBeNull();
    expect(learnWhy()).toHaveAttribute('aria-expanded', 'false');
  });

  it('is on the card in hand only, and a tip with no line has no button at all', async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.getAllByRole('button', { name: 'Learn why' })).toHaveLength(1);
    const bare = TIPS.findIndex((tip) => !tip.why);
    expect(bare).toBeGreaterThan(0);
    focus(next());
    for (let step = 0; step < bare; step += 1) await user.keyboard('{ArrowRight}');
    expect(shown()).toBe(textOf(bare));
    expect(screen.queryByRole('button', { name: 'Learn why' })).toBeNull();
  });

  it('opens in place, as a row of the strip under the cards, so it never lies over the conversation', async () => {
    const user = userEvent.setup();
    mount();
    expect(strip().querySelector('.tp-why')).toBeNull();
    await user.click(learnWhy());
    // Inside the strip (a child of it, after the deck), not a layer over the page.
    const reason = strip().querySelector('.tp-why') as HTMLElement;
    expect(reason).not.toBeNull();
    expect(reason.parentElement).toBe(strip());
    const deck = strip().querySelector('.tp-deck') as HTMLElement;
    expect(deck.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reason).toHaveTextContent(TIPS[0]?.why as string);
  });

  it('marks the card in hand as open, so its pointer light can go out while the reason is read', async () => {
    const user = userEvent.setup();
    mount();
    const card = () => document.querySelector('.tp-card[data-current="true"]') as HTMLElement;
    expect(card()).not.toHaveAttribute('data-why');
    await user.click(learnWhy());
    expect(card()).toHaveAttribute('data-why', 'open');
    expect(document.querySelectorAll('.tp-card[data-why]')).toHaveLength(1);
    await user.click(learnWhy());
    expect(card()).not.toHaveAttribute('data-why');
  });
});

describe('Hide tips and Show tips', () => {
  it('are buttons with an edge, not bare text', async () => {
    const user = userEvent.setup();
    mount();
    const hide = screen.getByRole('button', { name: 'Hide tips' });
    expect(hide).toHaveClass('ff-button--outline');
    await user.click(hide);
    expect(screen.getByRole('button', { name: 'Show tips' })).toHaveClass('ff-button--outline');
  });
});

describe('the pluck effects', () => {
  // The hook reads the pointer on the card, which keeps still; the face inside it is what moves.
  const cards = () => [...document.querySelectorAll<HTMLElement>('.tp-card')];

  it('are on for the card in hand under a mouse that can hover, and on that card only', () => {
    stubMedia(DESKTOP_MOUSE);
    mount();
    expect(cards()[0]?.dataset.fx).toBe('on');
    expect(cards()[1]?.dataset.fx).toBeUndefined();
  });

  it.each([
    ['a touch screen', { '(hover: hover)': false, '(pointer: fine)': false }],
    ['reduced motion', { ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true }],
    ['a browser that cannot say', {}],
  ])('are off on %s: no tilt, no lift, no light', (_name, media) => {
    stubMedia(media);
    mount();
    expect(cards()[0]?.dataset.fx).toBe('off');
    const raf = stubRaf();
    layOut(cards()[0] as HTMLElement, { width: 300, height: 90 });
    send(cards()[0] as HTMLElement, pointer('pointermove', { clientX: 290, clientY: 5 }));
    raf.frame(16);
    expect(cards()[0]?.style.getPropertyValue('--tilt-y')).toBe('');
  });

  it('tilt the card toward the pointer by no more than two degrees', () => {
    stubMedia(DESKTOP_MOUSE);
    const raf = stubRaf();
    mount();
    const card = cards()[0] as HTMLElement;
    layOut(card, { width: 300, height: 90 });
    send(card, pointer('pointermove', { clientX: 300, clientY: 0 }));
    raf.frame(16);
    const tilt = (name: string) => Math.abs(parseFloat(card.style.getPropertyValue(name)));
    expect(tilt('--tilt-y')).toBeGreaterThan(0.5);
    expect(tilt('--tilt-y')).toBeLessThanOrEqual(2);
    expect(tilt('--tilt-x')).toBeLessThanOrEqual(2);
    send(card, pointer('pointerleave'));
    expect(card.style.getPropertyValue('--tilt-y')).toBe('');
  });

  it('follow the card that is in hand, and leave the one that was', async () => {
    stubMedia(DESKTOP_MOUSE);
    const raf = stubRaf();
    mount();
    const user = userEvent.setup();
    await user.click(next());
    const [was, now] = cards() as [HTMLElement, HTMLElement];
    layOut(was, { width: 300, height: 90 });
    layOut(now, { width: 300, height: 90 });
    send(was, pointer('pointermove', { clientX: 290, clientY: 5 }));
    raf.frame(16);
    expect(was.style.getPropertyValue('--tilt-y')).toBe('');
    send(now, pointer('pointermove', { clientX: 290, clientY: 5 }));
    raf.frame(32);
    expect(now.style.getPropertyValue('--tilt-y')).not.toBe('');
  });
});

describe('dragging the cards', () => {
  const current = () => document.querySelector('.tp-card[data-current="true"]') as HTMLElement;
  const down = (x: number, extra: PointerEventInit & { timeStamp?: number } = {}, at?: Element) =>
    send(
      at ?? current(),
      pointer('pointerdown', { clientX: x, clientY: 20, timeStamp: 0, ...extra }),
    );
  const move = (x: number, timeStamp: number, y = 20) =>
    send(current(), pointer('pointermove', { clientX: x, clientY: y, timeStamp }));
  const up = (x: number, timeStamp: number) =>
    send(current(), pointer('pointerup', { clientX: x, clientY: 20, timeStamp }));
  const deck = () => document.querySelector('.tp-deck') as HTMLElement;

  /** A drag from `from` to `to` that takes `ms`, in a few steps. */
  const drag = (from: number, to: number, ms: number) => {
    down(from);
    move(from + (to - from) / 2, ms / 2);
    move(to, ms);
    up(to, ms);
  };

  it('moves to the next tip after a drag of 48 px or more to the left, however slowly', () => {
    mount();
    drag(300, 240, 900);
    expect(shown()).toBe(textOf(1));
  });

  it('moves back after the same drag to the right', async () => {
    mount();
    drag(300, 240, 900);
    await act(tick);
    drag(240, 300, 900);
    expect(shown()).toBe(textOf(0));
  });

  it('stays where it was after a short, slow drag, and the card goes back', () => {
    mount();
    drag(300, 270, 900);
    expect(shown()).toBe(textOf(0));
    expect(deck()).not.toHaveAttribute('data-dragging');
    expect(track().style.getPropertyValue('--tp-drag')).toBe('');
  });

  it('counts a quick flick of 16 px or more, and not one that is shorter', async () => {
    mount();
    drag(300, 280, 30);
    expect(shown()).toBe(textOf(1));
    await act(tick);
    drag(300, 290, 20);
    expect(shown()).toBe(textOf(1));
  });

  it('does not count a drag that was already heading back when it was let go', () => {
    mount();
    down(300);
    move(200, 500);
    move(250, 520);
    up(250, 520);
    expect(shown()).toBe(textOf(0));
  });

  it('does not count a quick move that stopped before it was let go as a flick', () => {
    mount();
    down(300);
    move(284, 10);
    move(280, 20);
    up(280, 220);
    expect(shown()).toBe(textOf(0));
  });

  it('follows the pointer at about sixty percent beyond the threshold, written for the stylesheet', () => {
    const raf = stubRaf();
    mount();
    down(300);
    move(200, 100);
    raf.frame(116);
    expect(deck()).toHaveAttribute('data-dragging', 'true');
    const written = parseFloat(track().style.getPropertyValue('--tp-drag'));
    expect(written).toBeCloseTo(dragShift(-100, { first: true, last: false }), 0);
    expect(written).toBeLessThan(-50);
    expect(written).toBeGreaterThan(-70);
    // The window has the same number, which its soft edge reads: the fade grows with the drag.
    expect(parseFloat(deck().style.getPropertyValue('--tp-drag'))).toBe(written);
    up(200, 100);
    expect(track().style.getPropertyValue('--tp-drag')).toBe('');
    expect(deck().style.getPropertyValue('--tp-drag')).toBe('');
    expect(deck()).not.toHaveAttribute('data-dragging');
  });

  it('settles on a spring after a drag, and glides when the person used a button', async () => {
    mount();
    expect(track()).toHaveAttribute('data-motion', 'glide');
    drag(300, 240, 900);
    expect(track()).toHaveAttribute('data-motion', 'spring');
    await act(tick);
    await userEvent.setup().click(next());
    expect(track()).toHaveAttribute('data-motion', 'glide');
  });

  it('swallows the click that ends a drag, and only that one', async () => {
    mount();
    drag(300, 240, 900);
    const click = () => new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(send(next(), click())).toBe(false);
    expect(shown()).toBe(textOf(1));
    await act(tick);
    await userEvent.setup().click(next());
    expect(shown()).toBe(textOf(2));
  });

  it('is not started by a press on a button, by a mostly vertical move or by the other mouse button', () => {
    mount();
    // “Learn why” is a button inside the deck: a press on it is a press, not the start of a drag.
    down(300, {}, learnWhy());
    move(200, 100);
    expect(deck()).not.toHaveAttribute('data-dragging');
    up(200, 100);
    down(300);
    move(310, 50, 90);
    expect(deck()).not.toHaveAttribute('data-dragging');
    up(310, 60);
    down(300, { button: 2 });
    move(200, 100);
    expect(deck()).not.toHaveAttribute('data-dragging');
    expect(shown()).toBe(textOf(0));
  });

  it('is taken back if the browser cancels it, and the card goes back', () => {
    mount();
    down(300);
    move(200, 100);
    expect(deck()).toHaveAttribute('data-dragging', 'true');
    send(current(), pointer('pointercancel', { clientX: 200, clientY: 20 }));
    expect(deck()).not.toHaveAttribute('data-dragging');
    expect(shown()).toBe(textOf(0));
  });

  it('works for a finger and a pen as it does for a mouse', () => {
    mount();
    down(300, { pointerType: 'touch' });
    move(240, 600);
    up(240, 600);
    expect(shown()).toBe(textOf(1));
  });

  it('lets go of a tip that comes due mid-drag, instead of moving it under the pointer', () => {
    const { update } = mount({ customerTurns: 1 });
    down(300);
    move(250, 100);
    expect(deck()).toHaveAttribute('data-dragging', 'true');
    update({ customerTurns: 2 });
    expect(shown()).toBe(textOf(0));
    send(current(), pointer('pointercancel', { clientX: 250, clientY: 20 }));
    update({ customerTurns: 2 });
    expect(shown()).toBe(textOf(0));
  });

  it('leaves nothing listening, and no drag in progress, when the strip goes away', () => {
    const removed = vi.spyOn(document, 'removeEventListener');
    const { unmount } = mount();
    down(300);
    move(200, 100);
    unmount();
    expect(removed.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']),
    );
  });
});

describe('how far a dragged card follows the pointer', () => {
  const free = { first: false, last: false };

  it('does not move inside the threshold, then follows about sixty percent of the rest', () => {
    expect(dragShift(0, free)).toBe(0);
    expect(dragShift(6, free)).toBe(0);
    expect(dragShift(-6, free)).toBe(0);
    expect(dragShift(106, free)).toBeCloseTo(100 * DRAG_FOLLOW);
    expect(dragShift(-106, free)).toBeCloseTo(-100 * DRAG_FOLLOW);
    expect(DRAG_FOLLOW).toBeGreaterThan(0.5);
    expect(DRAG_FOLLOW).toBeLessThan(0.7);
  });

  it('resists more where there is no tip to go to: pulling right on the first, left on the last', () => {
    expect(dragShift(106, { first: true, last: false })).toBeCloseTo(100 * EDGE_FOLLOW);
    expect(dragShift(-106, { first: false, last: true })).toBeCloseTo(-100 * EDGE_FOLLOW);
    // The other way is a normal drag.
    expect(dragShift(-106, { first: true, last: false })).toBeCloseTo(-100 * DRAG_FOLLOW);
    expect(dragShift(106, { first: false, last: true })).toBeCloseTo(100 * DRAG_FOLLOW);
  });

  it('reads speed over the last eighty milliseconds, positive toward the start', () => {
    expect(velocityOf([])).toBe(0);
    expect(velocityOf([{ t: 0, x: 100 }])).toBe(0);
    expect(
      velocityOf([
        { t: 0, x: 300 },
        { t: 40, x: 280 },
        { t: 60, x: 250 },
      ]),
    ).toBeCloseTo((300 - 250) / 60);
    // A pause before the end is not part of the speed.
    expect(
      velocityOf([
        { t: 0, x: 300 },
        { t: 500, x: 100 },
        { t: 540, x: 100 },
      ]),
    ).toBeCloseTo(0);
  });
});
