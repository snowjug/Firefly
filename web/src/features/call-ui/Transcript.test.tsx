import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Design from '../../design/index.ts';
import type { CallTurn } from '../call/contract.ts';
import { FIXTURE_START, FIXTURES } from './call-fixtures.ts';
import { timeMarks } from './call-model.ts';
import { Transcript, type TranscriptProps } from './Transcript.tsx';
import { renderCall } from './test-utils.tsx';

// Every customer row draws one avatar, so counting those avatars counts the customer rows drawn.
const drawn = vi.hoisted(() => ({ avatars: 0 }));
vi.mock('../../design/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof Design>();
  return {
    ...actual,
    Avatar: (props: Parameters<typeof actual.Avatar>[0]) => {
      if (props.className?.includes('cw-turn__avatar')) drawn.avatars += 1;
      return <actual.Avatar {...props} />;
    },
  };
});

const scrollTo = vi.fn();

beforeEach(() => {
  scrollTo.mockClear();
  drawn.avatars = 0;
  Element.prototype.scrollTo = scrollTo as unknown as Element['scrollTo'];
});

afterEach(() => {
  cleanup();
  delete (Element.prototype as { scrollTo?: unknown }).scrollTo;
});

const CUSTOMER = 'Priya Raman';
const turnsOf = (name: keyof typeof FIXTURES): CallTurn[] => FIXTURES[name].snapshot.turns;

function view(props: Partial<TranscriptProps> = {}) {
  const base: TranscriptProps = {
    turns: turnsOf('mic-ready'),
    customerName: CUSTOMER,
    startedAt: FIXTURE_START,
    interim: '',
    speaking: false,
    reducedMotion: false,
    titleId: 'transcript-title',
    ...props,
  };
  const ui = (next: TranscriptProps) => (
    <>
      <h2 id="transcript-title">Transcript</h2>
      <Transcript {...next} />
    </>
  );
  const result = render(ui(base));
  return {
    ...result,
    update: (change: Partial<TranscriptProps>) => result.rerender(ui({ ...base, ...change })),
  };
}

const scroller = () => screen.getByRole('region', { name: 'Transcript' });
const log = () => screen.getByRole('log', { name: 'Call transcript' });
const rows = () => [...log().querySelectorAll<HTMLElement>('.cw-turn')];

/** Pretends the box is `height` tall in total, `client` tall on screen and scrolled to `top`. */
function measure(element: HTMLElement, height: number, client: number, top: number) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: height });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: client });
  element.scrollTop = top;
}

describe('the transcript as a log', () => {
  it('is a polite log of additions inside a named region that the keyboard can scroll', () => {
    view();
    expect(log()).toHaveAttribute('aria-live', 'polite');
    expect(log()).toHaveAttribute('aria-relevant', 'additions');
    expect(scroller()).toHaveAttribute('tabindex', '0');
    expect(scroller()).toContainElement(log());
  });

  it('shows whole turns: the customer by name, the trainee as "You"', () => {
    view({ turns: turnsOf('mic-ready') });
    const who = rows().map((row) => row.querySelector('.cw-turn__who')?.textContent);
    expect(who).toEqual([CUSTOMER, 'You', CUSTOMER]);
    expect(
      within(log()).getByText(/Hello, yes\. We have a problem with Teams audio/),
    ).toBeInTheDocument();
  });

  it('writes each turn’s text to follow its own direction, so any language reads correctly', () => {
    view();
    for (const text of log().querySelectorAll('.cw-turn__text')) {
      expect(text).toHaveAttribute('dir', 'auto');
    }
  });

  it('says there are no messages yet, instead of an empty box', () => {
    view({ turns: [] });
    expect(within(log()).getByText('No messages yet.')).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it('stamps the first turn and then no more than one a minute, as real times a screen reader can read', () => {
    const turns = turnsOf('end-confirm');
    view({ turns });
    const stamps = [...log().querySelectorAll('time')];
    const expected = timeMarks(turns, FIXTURE_START);
    expect(stamps.map((stamp) => stamp.textContent?.replace('at ', ''))).toEqual([
      ...expected.values(),
    ]);
    expect(stamps.length).toBeLessThan(turns.length);
    for (const stamp of stamps) {
      expect(stamp.getAttribute('datetime')).toMatch(/^2026-11-21T/);
      expect(stamp.querySelector('.visually-hidden')?.textContent).toBe('at ');
    }
  });
});

describe('what became of a message', () => {
  it('shows the words being transcribed as a placeholder with a tag, never an empty line', () => {
    view({ turns: turnsOf('processing-speech') });
    const row = rows().at(-1) as HTMLElement;
    expect(within(row).getByText('Transcribing')).toBeInTheDocument();
    expect(row.querySelector('.cw-turn__text')).toBeNull();
    expect(row.querySelector('.ff-skeleton')).not.toBeNull();
  });

  it('shows the words once they are known, tagged Sending until the server has them', () => {
    view({ turns: turnsOf('transcript-available') });
    const row = rows().at(-1) as HTMLElement;
    expect(within(row).getByText('Sending')).toBeInTheDocument();
    expect(within(row).getByText(/Did anything change on those PCs/)).toBeInTheDocument();
  });

  it('keeps a message that could not be sent, with its words and the tag "Not sent"', () => {
    view({ turns: turnsOf('retry-required') });
    const row = rows().at(-1) as HTMLElement;
    expect(within(row).getByText('Not sent')).toBeInTheDocument();
    expect(within(row).getByText('Take your time, I will stay on the line.')).toBeInTheDocument();
    expect(row).toHaveClass('cw-turn--failed');
  });

  it('marks a reply the trainee stopped, and keeps all of its words', () => {
    const turns = turnsOf('interrupted');
    view({ turns });
    const stopped = rows().filter((row) => row.textContent?.includes('Audio stopped'));
    expect(stopped).toHaveLength(1);
    const reply = turns.find((turn) => turn.interrupted) as CallTurn;
    expect(within(stopped[0] as HTMLElement).getByText(reply.text)).toBeInTheDocument();
  });

  it('shows a plain sent turn with no tag at all', () => {
    view({ turns: turnsOf('mic-ready') });
    expect(log().querySelectorAll('.cw-turn__tag')).toHaveLength(0);
  });

  it('tells a spoken turn from a typed one only for a developer', () => {
    const turns = turnsOf('end-confirm');
    view({ turns });
    expect(screen.queryByText('Spoken')).toBeNull();
    expect(screen.queryByText('Typed')).toBeNull();
    cleanup();
    view({ turns, showInputMode: true });
    expect(screen.getAllByText('Spoken').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Typed')).toHaveLength(
      turns.filter((turn) => turn.role === 'trainee' && turn.inputMode === 'text').length,
    );
    // Customer turns are never tagged.
    for (const row of rows().filter((item) => item.classList.contains('cw-turn--customer'))) {
      expect(row.querySelector('.cw-turn__tag')).toBeNull();
    }
  });
});

describe('the turn being spoken', () => {
  it('is marked as the current turn while the customer’s voice plays, and only that one', () => {
    view({ turns: turnsOf('customer-speaking'), speaking: true });
    const current = log().querySelectorAll('[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toBe(rows().at(-1));
  });

  it('is not marked when nobody is speaking', () => {
    view({ turns: turnsOf('customer-speaking'), speaking: false });
    expect(log().querySelector('[aria-current]')).toBeNull();
  });
});

describe('words still being said', () => {
  it('shows them under the log, hidden from assistive technology, until the turn is finished', () => {
    const { update } = view({ interim: 'Can I check which headset' });
    const live = document.querySelector('.cw-interim') as HTMLElement;
    expect(live).toHaveAttribute('aria-hidden', 'true');
    expect(live).toHaveTextContent('Can I check which headset');
    expect(log()).not.toContainElement(live);
    update({ interim: '' });
    expect(document.querySelector('.cw-interim')).toBeNull();
  });
});

describe('long calls', () => {
  const LONG = turnsOf('long-transcript');

  it('shows every turn, and lets the browser skip laying out all but the newest ten', () => {
    view({ turns: LONG });
    expect(LONG).toHaveLength(64);
    expect(rows()).toHaveLength(64);
    expect(rows().filter((row) => row.classList.contains('cw-turn--old'))).toHaveLength(54);
    expect(
      rows()
        .slice(-10)
        .some((row) => row.classList.contains('cw-turn--old')),
    ).toBe(false);
  });

  it('adds a turn without touching the ones already there', () => {
    const { update } = view({ turns: LONG.slice(0, 40) });
    const before = rows();
    update({ turns: LONG.slice(0, 41) });
    const after = rows();
    expect(after).toHaveLength(41);
    expect(after.slice(0, 40).every((row, index) => row === before[index])).toBe(true);
  });

  it('fades in only the turns that arrive after it was first shown', () => {
    const { update } = view({ turns: LONG.slice(0, 20) });
    expect(log().querySelectorAll('.cw-turn--enter')).toHaveLength(0);
    update({ turns: LONG.slice(0, 21) });
    const entering = log().querySelectorAll('.cw-turn--enter');
    expect(entering).toHaveLength(1);
    expect(entering[0]).toBe(rows().at(-1));
  });
});

describe('drawing the rows', () => {
  const LONG = turnsOf('long-transcript');
  const customerRows = (turns: readonly CallTurn[]) =>
    turns.filter((turn) => turn.role === 'customer').length;

  it('draws every row once when it first appears', () => {
    const sixty = LONG.slice(0, 60);
    view({ turns: sixty });
    expect(drawn.avatars).toBe(customerRows(sixty));
  });

  it('draws none of them again when only the clock, the level or the live words change', () => {
    const sixty = LONG.slice(0, 60);
    const { update } = view({ turns: sixty });
    drawn.avatars = 0;
    // The engine hands over a new list of the same turns with every snapshot.
    for (let tick = 0; tick < 10; tick += 1) update({ turns: [...sixty], interim: `word ${tick}` });
    expect(drawn.avatars).toBe(0);
  });

  it('draws only the new turn, and the one that stopped being among the newest, when a turn arrives', () => {
    const before = LONG.slice(0, 60);
    const after = LONG.slice(0, 61);
    expect(after.at(-1)?.role).toBe('customer');
    const { update } = view({ turns: before });
    drawn.avatars = 0;
    update({ turns: after });
    expect(drawn.avatars).toBeGreaterThan(0);
    expect(drawn.avatars).toBeLessThanOrEqual(2);
  });

  it('draws no row when the call screen is redrawn for a snapshot that changed something else', () => {
    const { snapshot } = FIXTURES['long-transcript'];
    const { update } = renderCall('long-transcript');
    drawn.avatars = 0;
    for (let tick = 0; tick < 10; tick += 1) {
      update({ ...snapshot, micLevel: tick / 10, elapsedSeconds: snapshot.elapsedSeconds + tick });
    }
    expect(drawn.avatars).toBe(0);
  });
});

describe('following the conversation', () => {
  it('stays with the newest turn as it arrives, at once: the turn fades in, the log does not glide', () => {
    const turns = turnsOf('long-transcript');
    const { update } = view({ turns: turns.slice(0, 30) });
    measure(scroller(), 3000, 500, 2500);
    scrollTo.mockClear();
    update({ turns: turns.slice(0, 31) });
    expect(scrollTo).toHaveBeenCalledWith({ top: 3000, behavior: 'auto' });
    expect(scrollTo).not.toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(log().querySelectorAll('.cw-turn--enter')).toHaveLength(1);
  });

  it('glides back to the newest turn on request, and not at all for someone who asked for less motion', () => {
    const turns = turnsOf('long-transcript');
    const first = view({ turns: turns.slice(0, 30) });
    measure(scroller(), 3000, 500, 400);
    fireEvent.scroll(scroller());
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 3000, behavior: 'smooth' });
    first.unmount();

    view({ turns: turns.slice(0, 30), reducedMotion: true });
    measure(scroller(), 3000, 500, 400);
    fireEvent.scroll(scroller());
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 3000, behavior: 'auto' });
  });

  it('stays where the person scrolled to, and offers a way back to the newest turn', () => {
    const turns = turnsOf('long-transcript');
    const { update } = view({ turns: turns.slice(0, 30) });
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
    measure(scroller(), 3000, 500, 400);
    fireEvent.wheel(scroller(), { deltaY: -120 });
    fireEvent.scroll(scroller());
    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument();
    scrollTo.mockClear();
    // However many turns arrive while they read, nothing scrolls under them.
    update({ turns: turns.slice(0, 31) });
    update({ turns: turns.slice(0, 32) });
    update({ turns: turns.slice(0, 32), interim: 'Can I check which headset' });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument();
  });

  it('does not take its own scroll to a new turn for the person leaving it, so the button never flickers', () => {
    const turns = turnsOf('long-transcript');
    const { update } = view({ turns: turns.slice(0, 30) });
    measure(scroller(), 3000, 500, 2500);
    // The new turn makes the log taller, and the log is sent to its end.
    measure(scroller(), 3100, 500, 2500);
    update({ turns: turns.slice(0, 31) });
    // On the way the browser reports places that are not the end.
    measure(scroller(), 3100, 500, 2540);
    fireEvent.scroll(scroller());
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
    // And it is still following when it arrives, and when the next turn comes.
    measure(scroller(), 3100, 500, 2600);
    fireEvent.scroll(scroller());
    scrollTo.mockClear();
    update({ turns: turns.slice(0, 32) });
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('lets a hand end the page’s own scroll: scrolling away after a new turn is the person’s', () => {
    const turns = turnsOf('long-transcript');
    const { update } = view({ turns: turns.slice(0, 30) });
    measure(scroller(), 3000, 500, 2500);
    measure(scroller(), 3100, 500, 2500);
    update({ turns: turns.slice(0, 31) });
    fireEvent.touchStart(scroller());
    measure(scroller(), 3100, 500, 900);
    fireEvent.scroll(scroller());
    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument();
  });

  it('treats a scroll away from the end that nobody on the page asked for as the person’s', () => {
    // Find in page, for example, moves the log without a wheel, a key or a touch.
    view({ turns: turnsOf('long-transcript') });
    measure(scroller(), 3000, 500, 400);
    fireEvent.scroll(scroller());
    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument();
  });

  it('jumps to the newest turn on request, keeps the keyboard in the transcript and follows again', () => {
    const turns = turnsOf('long-transcript');
    const { update } = view({ turns: turns.slice(0, 30) });
    measure(scroller(), 3000, 500, 400);
    fireEvent.scroll(scroller());
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 3000, behavior: 'smooth' });
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
    expect(scroller()).toHaveFocus();
    // The glide passes places that are not the end; the button does not come back for them.
    measure(scroller(), 3000, 500, 1200);
    fireEvent.scroll(scroller());
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
    scrollTo.mockClear();
    update({ turns: turns.slice(0, 31) });
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('forgets the offer once the person has scrolled back to the end by hand', () => {
    view({ turns: turnsOf('long-transcript') });
    measure(scroller(), 3000, 500, 400);
    fireEvent.scroll(scroller());
    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument();
    measure(scroller(), 3000, 500, 2490);
    fireEvent.scroll(scroller());
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
  });

  it('stays with the newest words while they are being said', () => {
    const { update } = view({ interim: 'Can I' });
    scrollTo.mockClear();
    act(() => update({ interim: 'Can I check which headset' }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });
});
