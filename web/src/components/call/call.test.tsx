import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import { atmosphereFor } from './atmosphere.ts';
import { CallDetails } from './CallDetails.tsx';
import { immersive, makeReply, makeSession, stubScreen } from './call-test-kit.ts';
import { Composer } from './Composer.tsx';
import { Conversation, NEAR_TURNS } from './Conversation.tsx';
import { EndCallDialog } from './EndCallDialog.tsx';
import { HintLinks } from './HintLinks.tsx';
import { HINTS, hintIdsForAreas, hintsFor, withStarter } from './hints.ts';
import { PresenceRail } from './PresenceRail.tsx';
import { callReducer, initialCallState, type ChatShift, type ChatTurn } from './useCall.ts';
import { ThemeProvider } from '../../lib/theme.tsx';

vi.mock('./ProviderNote.tsx', () => ({
  ProviderNote: () => <span>Demo mode</span>,
}));

beforeEach(() => {
  stubScreen();
  Element.prototype.scrollTo = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => vi.unstubAllGlobals());

const turn = (over: Partial<ChatTurn>): ChatTurn => ({
  key: 't1',
  index: 1,
  role: 'customer',
  text: 'Hello',
  createdAt: '2025-01-01T10:00:00.000Z',
  status: 'sent',
  ...over,
});

describe('conversation state', () => {
  it('shows a saved message whose reply never arrived as retryable, with its original id', () => {
    const base = makeSession();
    const session = makeSession({
      turns: [
        ...base.turns,
        {
          index: 2,
          role: 'trainee',
          text: 'Hello Maya',
          createdAt: '2025-01-01T10:00:05.000Z',
          source: 'trainee',
        },
      ],
      awaitingReply: { clientMessageId: 'abc12345', turnIndex: 2 },
    });
    const state = initialCallState(session, 60);
    expect(state.turns[1]).toMatchObject({
      status: 'failed',
      saved: true,
      clientMessageId: 'abc12345',
      text: 'Hello Maya',
    });
    expect(state.turnsRemaining).toBe(59);
    expect(initialCallState(makeSession(), 60).turns.every((t) => t.status === 'sent')).toBe(true);
  });

  const sending: ChatTurn = turn({ key: 'k1', index: null, role: 'trainee', status: 'sending' });

  it('notes when a reply lights a signal, and when the customer changes mood or goes quiet', () => {
    const before = { ...initialCallState(makeSession(), 60), turns: [sending] };

    const found = callReducer(before, {
      type: 'sent',
      key: 'k1',
      response: makeReply('Something', { discoveredCount: 3 }),
      announcement: '',
    });
    expect(found.discoveries).toBe(1);
    expect(found.signalKeys).toHaveLength(1);
    expect(found.replies).toBe(1);
    expect(found.shifts).toEqual([]);

    const tenser = callReducer(before, {
      type: 'sent',
      key: 'k1',
      response: makeReply('Hm.', { band: { id: 'angry', label: 'Angry' }, silent: true }),
      announcement: '',
    });
    expect(tenser.discoveries).toBe(0);
    expect(tenser.shifts).toMatchObject([
      { kind: 'band', direction: 'tenser', from: { id: 'frustrated' }, to: { id: 'angry' } },
      { kind: 'silent' },
    ]);

    const calmer = callReducer(before, {
      type: 'sent',
      key: 'k1',
      response: makeReply('Thanks', { band: { id: 'calm', label: 'Calm' } }),
      announcement: '',
    });
    expect(calmer.shifts).toMatchObject([{ kind: 'band', direction: 'calmer' }]);
  });

  it('remembers the customer’s mood at the reply that was newest when the call opened, and at each reply after', () => {
    const opening = initialCallState(makeSession(), 60);
    expect(opening.moods).toEqual({
      t1: { id: 'frustrated', label: 'Frustrated', trend: 'rising' },
    });
    const next = callReducer(
      {
        ...opening,
        turns: [
          ...opening.turns,
          turn({ key: 'k1', index: null, role: 'trainee', status: 'sending' }),
        ],
      },
      {
        type: 'sent',
        key: 'k1',
        response: makeReply('Better.', {
          band: { id: 'concerned', label: 'Concerned' },
          trend: 'falling',
        }),
        announcement: '',
      },
    );
    const replyKey = next.turns[next.turns.length - 1]?.key as string;
    expect(next.moods[replyKey]).toEqual({ id: 'concerned', label: 'Concerned', trend: 'falling' });
    // Earlier replies keep what was known; nothing is invented for turns the screen never saw.
    expect(next.moods.t1?.id).toBe('frustrated');
    expect(Object.keys(next.moods)).toHaveLength(2);
  });

  describe('a curveball', () => {
    const reply = (
      current: ReturnType<typeof initialCallState>,
      key: string,
      text: string,
      over: Parameters<typeof makeReply>[1] = {},
    ) => {
      const response = makeReply(text, over);
      return {
        next: callReducer(current, { type: 'sent', key, response, announcement: '' }),
        customerKey: `t${response.customerTurn.index}`,
      };
    };
    const opening = { ...initialCallState(makeSession(), 60), turns: [sending] };

    it('is recorded once, after the reply that raised the shift count, saying nothing of its kind', () => {
      const { next, customerKey } = reply(opening, 'k1', 'Actually, that is not the problem.', {
        shifts: 1,
      });
      expect(next.shifts).toStrictEqual([{ afterKey: customerKey, kind: 'curveball' }]);
      expect(next.state.shifts).toBe(1);
      expect(next.discoveries).toBe(0);
    });

    it('is still one entry when the count jumps by more than one', () => {
      const { next, customerKey } = reply(opening, 'k1', 'Hm.', { shifts: 3 });
      expect(next.shifts).toStrictEqual([{ afterKey: customerKey, kind: 'curveball' }]);
    });

    it('is not recorded while the count stays the same, or if it ever goes down', () => {
      const settled = { ...opening, state: { ...opening.state, shifts: 2 } };
      expect(reply(settled, 'k1', 'Fine.', { shifts: 2 }).next.shifts).toEqual([]);
      expect(reply(settled, 'k1', 'Fine.', { shifts: 1 }).next.shifts).toEqual([]);
      expect(reply(opening, 'k1', 'Fine.').next.shifts).toEqual([]);
    });

    it('follows the change of mood and the silence it came with, all after the same reply', () => {
      const { next, customerKey } = reply(opening, 'k1', '...', {
        band: { id: 'angry', label: 'Angry' },
        silent: true,
        shifts: 1,
      });
      expect(next.shifts.map((shift) => shift.kind)).toEqual(['band', 'silent', 'curveball']);
      expect(next.shifts.every((shift) => shift.afterKey === customerKey)).toBe(true);
    });

    it('is recorded again after a later reply that raises the count again', () => {
      const first = reply(opening, 'k1', 'First.', { shifts: 1 });
      const again = { ...first.next, turns: [...first.next.turns, { ...sending, key: 'k2' }] };
      const second = reply(again, 'k2', 'Second.', { shifts: 2 });
      expect(second.next.shifts).toStrictEqual([
        { afterKey: first.customerKey, kind: 'curveball' },
        { afterKey: second.customerKey, kind: 'curveball' },
      ]);
    });
  });
});

describe('starter phrases', () => {
  const areas = [
    'When it started',
    'The exact message on screen',
    'Who is affected and since when',
  ];

  it('are picked from the scenario areas, with the most useful first, and never more than three', () => {
    expect(hintIdsForAreas(areas)).toEqual(['when', 'error', 'who']);
    const early = hintsFor({ areas, band: 'calm', traineeTurns: 0 });
    expect(early.map((hint) => hint.id)).toEqual(['acknowledge', 'when', 'error']);
    // A calm customer later in the call needs no reminder to show empathy; a tense one does.
    expect(hintsFor({ areas, band: 'calm', traineeTurns: 3 }).map((h) => h.id)).toEqual([
      'when',
      'error',
      'who',
    ]);
    expect(hintsFor({ areas, band: 'angry', traineeTurns: 3 }).map((h) => h.id)[0]).toBe(
      'acknowledge',
    );
    expect(hintsFor({ areas, band: 'calm', traineeTurns: 6 }).map((h) => h.id)[0]).toBe('next');
  });

  it('make way for the next ones once used, and fall back to general habits without areas', () => {
    const used = hintsFor({ areas, band: 'angry', traineeTurns: 0, used: ['acknowledge', 'when'] });
    expect(used.map((hint) => hint.id)).toEqual(['error', 'who', 'changed']);
    expect(hintsFor({ areas: [], band: 'calm', traineeTurns: 0 })).toHaveLength(3);
  });

  it('never carry anything from the scenario into the words', () => {
    const detail = 'Zebra-Helen-reorganised-the-access-groups';
    const hints = hintsFor({ areas: [detail, ...areas], band: 'angry', traineeTurns: 6, max: 10 });
    const text = hints.map((hint) => `${hint.label} ${hint.starter}`).join(' ');
    expect(text).not.toMatch(/zebra|helen|reorganised/i);
    expect(hints.every((hint) => HINTS[hint.id] === hint)).toBe(true);
  });

  it('are added after what is already typed, ready for the next word', () => {
    expect(withStarter('', 'Could you tell me more?')).toBe('Could you tell me more? ');
    expect(withStarter('Thanks. ', 'What changed?')).toBe('Thanks. What changed? ');
    expect(withStarter('Thanks', 'What changed?')).toBe('Thanks What changed? ');
  });

  it('are buttons that report which one was chosen', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <HintLinks hints={hintsFor({ areas, band: 'calm', traineeTurns: 0 })} onPick={onPick} />,
    );
    const group = screen.getByRole('group', { name: 'Ideas for what to say' });
    await user.click(within(group).getByRole('button', { name: 'Acknowledge the impact' }));
    expect(onPick).toHaveBeenCalledWith(HINTS.acknowledge);
    expect(group).toHaveAccessibleDescription(/Nothing is sent until you press Send/);
  });

  it('show nothing when there is nothing to offer', () => {
    const { container } = render(<HintLinks hints={[]} onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Composer', () => {
  function Box({
    onSend = vi.fn().mockResolvedValue({ ok: true }),
    maxChars = 100,
    busy = false,
    blockedMessage = null,
    turnsRemaining = null,
  }: {
    onSend?: (text: string) => Promise<unknown>;
    maxChars?: number;
    busy?: boolean;
    blockedMessage?: string | null;
    turnsRemaining?: number | null;
  }) {
    const [value, setValue] = useState('');
    return (
      <Composer
        value={value}
        onChange={setValue}
        maxChars={maxChars}
        busy={busy}
        blockedMessage={blockedMessage}
        turnsRemaining={turnsRemaining}
        onSend={onSend}
      />
    );
  }

  it('sends with Enter on a desktop keyboard and adds a line with Shift+Enter', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<Box onSend={onSend} />);
    const box = screen.getByLabelText('Your reply to the customer');
    expect(box).toHaveAttribute('placeholder', 'Say what you would say.');
    await user.type(box, 'First line{Shift>}{Enter}{/Shift}Second line');
    expect(box).toHaveValue('First line\nSecond line');
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledWith('First line\nSecond line');
    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
  });

  it('adds a line on Enter on a touch device and sends with the button', async () => {
    stubScreen({ coarse: true });
    const onSend = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<Box onSend={onSend} />);
    const box = screen.getByLabelText('Your reply to the customer');
    await user.type(box, 'Hello{Enter}there');
    expect(onSend).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSend).toHaveBeenCalledWith('Hello\nthere');
  });

  it('does not send empty, over-long or while a reply is pending, and explains why', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Box maxChars={10} />);
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText('Your reply to the customer'), 'This is far too long');
    expect(send).toBeDisabled();
    expect(screen.getByText(/characters over the 10 limit/)).toBeInTheDocument();
    expect(screen.getByLabelText('Your reply to the customer')).toHaveAccessibleDescription(
      /characters over the 10 limit/,
    );
    rerender(<Box busy turnsRemaining={3} />);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByText('3 messages left in this call')).toBeInTheDocument();
  });

  it('shows how much is left only near the limit', async () => {
    const user = userEvent.setup();
    render(<Box maxChars={20} />);
    const box = screen.getByLabelText('Your reply to the customer');
    await user.type(box, 'Short');
    expect(screen.queryByText(/of 20/)).not.toBeInTheDocument();
    await user.type(box, ' but getting.');
    expect(screen.getByText('18 of 20')).toBeInTheDocument();
  });

  it('warns about personal data before it is sent and blocks the box at the message limit', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Box maxChars={500} />);
    await user.type(
      screen.getByLabelText('Your reply to the customer'),
      'Mail me at jo@example.com',
    );
    expect(screen.getByText(/looks like it contains an email address/i)).toBeInTheDocument();
    rerender(<Box maxChars={500} blockedMessage="This call has reached its message limit." />);
    expect(screen.getByLabelText('Your reply to the customer')).toBeDisabled();
    expect(screen.getByText('This call has reached its message limit.')).toBeInTheDocument();
  });
});

describe('Conversation', () => {
  const guidedProps = { customer: 'Maya Okafor', typing: false, cue: 'full' as const };
  const quietProps = { customer: 'Maya Okafor', typing: false, cue: 'none' as const };

  it('renders plain text for both speakers and offers a retry for a failed message', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <Conversation
        {...guidedProps}
        onRetry={onRetry}
        turns={[
          turn({ key: 't1', text: '<b>Hello</b> from Maya' }),
          turn({
            key: 'mine',
            index: 2,
            role: 'trainee',
            text: 'Can you tell me more?',
            status: 'failed',
            saved: true,
            error: 'The simulated customer is unavailable right now.',
          }),
        ]}
      />,
    );
    expect(screen.getByText('<b>Hello</b> from Maya')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Saved.')).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith('mine');
  });

  it('sets each turn with who said it and which turn it is, in the margin', () => {
    render(
      <Conversation
        {...quietProps}
        onRetry={vi.fn()}
        turns={[
          turn({ key: 't1', index: 1 }),
          turn({ key: 't2', index: 2, role: 'trainee', text: 'Hi' }),
          turn({ key: 't12', index: 12, text: 'Later' }),
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Maya Okafor Turn 01');
    expect(items[1]).toHaveTextContent('You Turn 02');
    expect(items[2]).toHaveTextContent('Maya Okafor Turn 12');
  });

  it('shows who is typing, without exposing the indicator to assistive technology', () => {
    const { container } = render(
      <Conversation {...guidedProps} typing onRetry={vi.fn()} turns={[turn({})]} />,
    );
    const typing = container.querySelector('.ch-turn--typing');
    expect(typing).toHaveAttribute('aria-hidden', 'true');
    expect(typing).toHaveTextContent('Maya Okafor is typing…');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('adds a Listen button to customer messages only when speech is available', async () => {
    const onListen = vi.fn();
    const user = userEvent.setup();
    const turns = [
      turn({ key: 't1', text: 'Hello' }),
      turn({ key: 't2', index: 2, role: 'trainee' }),
    ];
    const { rerender } = render(<Conversation {...guidedProps} onRetry={vi.fn()} turns={turns} />);
    expect(screen.queryByRole('button', { name: /listen/i })).not.toBeInTheDocument();
    rerender(<Conversation {...guidedProps} onRetry={vi.fn()} turns={turns} onListen={onListen} />);
    const buttons = screen.getAllByRole('button', { name: /^Listen to Maya Okafor/ });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0] as HTMLElement);
    expect(onListen).toHaveBeenCalledWith('Hello');
  });

  const shifts: ChatShift[] = [
    {
      afterKey: 't3',
      kind: 'band',
      from: { id: 'calm', label: 'Calm' },
      to: { id: 'frustrated', label: 'Frustrated' },
      direction: 'tenser',
    },
    { afterKey: 't3', kind: 'silent' },
  ];
  const three = [
    turn({ key: 't1', index: 1 }),
    turn({ key: 't2', index: 2, role: 'trainee', text: 'Hi' }),
    turn({ key: 't3', index: 3, text: 'Something useful' }),
  ];

  it('shows mood shifts, signals and the mood word in guided practice, and none of it in immersive', () => {
    const moods = {
      t3: { id: 'frustrated' as const, label: 'Frustrated', trend: 'rising' as const },
    };
    const { container, rerender } = render(
      <Conversation
        {...guidedProps}
        onRetry={vi.fn()}
        turns={three}
        signalKeys={['t3']}
        shifts={shifts}
        moods={moods}
      />,
    );
    expect(screen.getByText(/Maya Okafor's mood shifted from Calm to Frustrated/)).toBeVisible();
    expect(screen.getByText('Maya Okafor has gone quiet.')).toBeVisible();
    expect(screen.getByText('Signal found')).toBeVisible();
    expect(container.querySelector('[data-signal]')).not.toBeNull();
    expect(container.querySelector('li[data-turn="t3"] .ch-turn__mood')).toHaveTextContent(
      'Frustrated',
    );

    rerender(
      <Conversation
        {...quietProps}
        onRetry={vi.fn()}
        turns={three}
        signalKeys={['t3']}
        shifts={shifts}
        moods={moods}
      />,
    );
    expect(container.querySelector('.ch-note')).toBeNull();
    expect(screen.queryByText(/signal found/i)).not.toBeInTheDocument();
    expect(container.querySelector('[data-signal]')).toBeNull();
    expect(container.querySelector('.ch-turn__mood')).toBeNull();
    expect(container.querySelector('[data-mood]')).toBeNull();
  });

  it('gives no mood word to a reply the screen never saw the mood at', () => {
    const { container } = render(
      <Conversation
        {...guidedProps}
        onRetry={vi.fn()}
        turns={three}
        moods={{ t3: { id: 'angry', label: 'Angry', trend: 'steady' } }}
      />,
    );
    expect(container.querySelectorAll('.ch-turn__mood')).toHaveLength(1);
    expect(container.querySelector('li[data-turn="t1"] .ch-turn__mood')).toBeNull();
    // The trainee message between them was said into a mood nobody saw: plain.
    expect(container.querySelector('li[data-turn="t2"] .ch-turn__mood')).toBeNull();
  });

  it('says only that the conversation changed for a curveball, and only in guided practice', () => {
    const turns = [turn({ key: 't1', index: 1 }), turn({ key: 't3', index: 3, text: 'Hm.' })];
    const curveball: ChatShift[] = [{ afterKey: 't3', kind: 'curveball' }];
    const { container, rerender } = render(
      <Conversation {...guidedProps} onRetry={vi.fn()} turns={turns} shifts={curveball} />,
    );
    const note = container.querySelector('.ch-note');
    expect(note).toHaveAttribute('data-kind', 'curveball');
    expect(note).toHaveTextContent(/^Situation shiftThe conversation changed\.$/);
    expect(container.querySelector('li[data-turn="t3"]')).toHaveAttribute('data-shift');
    expect(screen.queryByText(/mood shifted/)).not.toBeInTheDocument();

    rerender(<Conversation {...quietProps} onRetry={vi.fn()} turns={turns} shifts={curveball} />);
    expect(container.querySelector('.ch-note')).toBeNull();
    expect(container.querySelector('[data-shift]')).toBeNull();
    expect(screen.queryByText(/conversation changed/i)).not.toBeInTheDocument();
  });

  it('rests on the latest customer line, and lets the lines before it step back', () => {
    const { container } = render(<Conversation {...quietProps} onRetry={vi.fn()} turns={three} />);
    const emphasis = [...container.querySelectorAll('li[data-turn]')].map((li) =>
      li.getAttribute('data-emphasis'),
    );
    expect(emphasis).toEqual(['recent', 'recent', 'active']);
  });

  it('only gives messages that arrive later an entrance, never the ones the call opened with', () => {
    const opening = [turn({ key: 't1', index: 1 }), turn({ key: 't2', index: 2, role: 'trainee' })];
    const { container, rerender } = render(
      <Conversation {...guidedProps} onRetry={vi.fn()} turns={opening} />,
    );
    expect(container.querySelectorAll('[data-fresh]')).toHaveLength(0);
    rerender(
      <Conversation
        {...guidedProps}
        onRetry={vi.fn()}
        turns={[...opening, turn({ key: 't3', index: 3 })]}
      />,
    );
    expect(container.querySelectorAll('[data-fresh="true"]')).toHaveLength(1);
  });

  it('keeps a message that did not get through, and its retry line, in view', () => {
    const intoView = vi.fn();
    Element.prototype.scrollIntoView = intoView;
    const opening = turn({ key: 't1', index: 1 });
    const mine = turn({ key: 'mine', index: null, role: 'trainee', status: 'sending' });
    const { rerender } = render(
      <Conversation {...guidedProps} onRetry={vi.fn()} turns={[opening, mine]} />,
    );
    intoView.mockClear();
    rerender(
      <Conversation
        {...guidedProps}
        onRetry={vi.fn()}
        turns={[opening, { ...mine, status: 'failed', error: 'Not delivered.' }]}
      />,
    );
    expect(intoView).toHaveBeenCalled();
  });

  describe('following the conversation', () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        turn({ key: `t${i}`, index: i + 1, role: i % 2 === 0 ? 'customer' : 'trainee' }),
      );

    /** Makes the newest turn look like it is far below the part of the page that is on screen. */
    async function scrollAway() {
      // The view ignores the scrolls it makes itself, for a moment after it makes them.
      await new Promise((resolve) => setTimeout(resolve, 120));
      const scroller = screen.getByRole('region', { name: 'Conversation' });
      Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 500 });
      const items = scroller.querySelectorAll('li[data-turn]');
      const newest = items[items.length - 1] as HTMLElement;
      newest.getBoundingClientRect = () => ({ top: 3000, bottom: 3100 }) as DOMRect;
      fireEvent.scroll(scroller);
    }

    let frames: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      frames = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    });
    afterEach(() => frames.mockRestore());

    it('opens at the latest message at once, then eases to a new one', () => {
      const { rerender } = render(
        <Conversation {...guidedProps} onRetry={vi.fn()} turns={many(30)} />,
      );
      expect(frames).not.toHaveBeenCalled();
      rerender(
        <Conversation
          {...guidedProps}
          onRetry={vi.fn()}
          turns={[...many(30), turn({ key: 'new', index: 31, role: 'trainee' })]}
        />,
      );
      expect(frames).toHaveBeenCalled();
    });

    it('moves at once, not by easing, when reduced motion is asked for', () => {
      localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
      const page = (turns: ChatTurn[]) => (
        <ThemeProvider>
          <Conversation {...guidedProps} onRetry={vi.fn()} turns={turns} />
        </ThemeProvider>
      );
      const { rerender } = render(page(many(30)));
      rerender(page([...many(30), turn({ key: 'new', index: 31, role: 'trainee' })]));
      expect(frames).not.toHaveBeenCalled();
      expect(screen.getAllByRole('listitem')).toHaveLength(31);
      document.documentElement.removeAttribute('data-motion');
      localStorage.clear();
    });

    it('leaves a reader who scrolled back alone, says a reply is waiting, and takes them there on request', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Conversation {...guidedProps} onRetry={vi.fn()} turns={many(30)} />,
      );
      expect(screen.queryByRole('button', { name: /latest|new message/i })).not.toBeInTheDocument();
      await scrollAway();
      const jump = await screen.findByRole('button', { name: 'Jump to latest' });
      frames.mockClear();

      rerender(
        <Conversation
          {...guidedProps}
          onRetry={vi.fn()}
          turns={[...many(30), turn({ key: 'reply', index: 31 })]}
        />,
      );
      expect(frames).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: '1 new message' })).toBeVisible();

      await user.click(screen.getByRole('button', { name: '1 new message' }));
      expect(frames).toHaveBeenCalled();
      expect(jump).not.toBeInTheDocument();
    });

    it('still brings the reader to the end for their own message', async () => {
      const { rerender } = render(
        <Conversation {...guidedProps} onRetry={vi.fn()} turns={many(30)} />,
      );
      await scrollAway();
      frames.mockClear();
      rerender(
        <Conversation
          {...guidedProps}
          onRetry={vi.fn()}
          turns={[
            ...many(30),
            turn({ key: 'mine', index: null, role: 'trainee', status: 'sending' }),
          ]}
        />,
      );
      expect(frames).toHaveBeenCalled();
    });
  });

  describe('a long call', () => {
    it('keeps every turn in the page, and fully draws only the newest ones', () => {
      const turns = Array.from({ length: 70 }, (_, i) =>
        turn({
          key: `t${i}`,
          index: i + 1,
          role: i % 2 === 0 ? 'customer' : 'trainee',
          text: `Line ${i}`,
        }),
      );
      const { container } = render(
        <Conversation {...guidedProps} onRetry={vi.fn()} turns={turns} />,
      );
      // Older turns stay in the page, so a screen reader and find-in-page still reach them.
      expect(screen.getAllByRole('listitem')).toHaveLength(70);
      expect(screen.getByText('Line 0')).toBeInTheDocument();
      expect(container.querySelectorAll('li[data-near]')).toHaveLength(NEAR_TURNS);
      expect(container.querySelector('li[data-turn="t69"]')).toHaveAttribute('data-near');
      expect(container.querySelector('li[data-turn="t0"]')).not.toHaveAttribute('data-near');
      // Each turn has its own stretch of filament.
      expect(container.querySelectorAll('li[data-turn] .ch-spine path')).toHaveLength(70);
    });

    it('draws a filament for no turns and for one', () => {
      const { container, rerender } = render(
        <Conversation {...guidedProps} onRetry={vi.fn()} turns={[]} />,
      );
      expect(container.querySelectorAll('.ch-spine')).toHaveLength(0);
      rerender(<Conversation {...guidedProps} onRetry={vi.fn()} turns={[turn({})]} />);
      expect(container.querySelectorAll('.ch-spine path')).toHaveLength(1);
      expect(container.querySelector('.ch-spine path')).toHaveAttribute('d');
    });

    it('shows a very long unbroken word and a very long reply whole', () => {
      const word = 'Supercalifragilistic'.repeat(12);
      const reply = 'We have been trying to sign in since this morning. '.repeat(40);
      render(
        <Conversation
          {...guidedProps}
          onRetry={vi.fn()}
          turns={[
            turn({ key: 't1', text: word }),
            turn({ key: 't2', index: 2, role: 'trainee', text: reply }),
          ]}
        />,
      );
      expect(screen.getByText(word)).toBeInTheDocument();
      expect(screen.getByText(reply.trim())).toBeInTheDocument();
    });
  });
});

describe('PresenceRail', () => {
  const guided = makeSession();
  const quiet = immersive(guided);
  const props = (session: SessionDTO, over: Partial<Parameters<typeof PresenceRail>[0]> = {}) => ({
    persona: session.scenario.persona,
    atmosphere: atmosphereFor(
      session.state,
      session.scenario.config.mode === 'guided' ? 'full' : 'none',
    ),
    guided: session.scenario.config.mode === 'guided',
    found: 2,
    shifts: 0,
    announceFound: false,
    speaking: false,
    ending: false,
    size: 240,
    soundOn: false,
    onSound: vi.fn(),
    onOpenDetails: vi.fn(),
    onEnd: vi.fn(),
    ...over,
  });
  const presence = (container: HTMLElement) => container.querySelector('[data-sig="presence"]');

  it('shows who is calling, in the customer’s name', () => {
    render(<PresenceRail {...props(guided)} />);
    const rail = screen.getByRole('complementary', { name: 'Maya Okafor, the customer' });
    expect(within(rail).getByRole('heading', { level: 1, name: 'Maya Okafor' })).toBeVisible();
    expect(within(rail).getByText('Receptionist, Northwind Clinic')).toBeVisible();
  });

  it('adds the mood in words, with its trend, and the number of signals found in guided practice', () => {
    const { container, rerender } = render(<PresenceRail {...props(guided)} />);
    expect(screen.getByText('Customer mood')).toBeVisible();
    expect(screen.getByText('Frustrated, rising')).toBeVisible();
    expect(screen.getByText(/signals found/)).toHaveTextContent('2 signals found');
    expect(container.querySelectorAll('.ch-signals__dots i[data-lit]')).toHaveLength(2);
    expect(presence(container)).toHaveAttribute('data-sig-mood', 'frustrated');
    // The pool of dormant points is the same however many are found, so it never hints at a total.
    const dots = container.querySelectorAll('.ch-signals__dots i').length;
    rerender(<PresenceRail {...props(guided, { found: 1 })} />);
    expect(screen.getByText(/signal found/)).toHaveTextContent('1 signal found');
    expect(container.querySelectorAll('.ch-signals__dots i')).toHaveLength(dots);
  });

  it('says how the customer is easing, and when they have gone quiet', () => {
    const easing = {
      ...guided.state,
      band: { id: 'concerned' as const, label: 'Concerned' },
      trend: 'falling' as const,
      silent: true,
    };
    const { container } = render(
      <PresenceRail {...props(guided, { atmosphere: atmosphereFor(easing, 'full') })} />,
    );
    expect(screen.getByText('Concerned, easing')).toBeVisible();
    expect(container.querySelector('.ch-mood')).toHaveAttribute('data-silent');
    expect(presence(container)).toHaveAttribute('data-silent');
  });

  it('shows no mood, count or signal in immersive practice, and a neutral presence whatever the mood', () => {
    const { container } = render(<PresenceRail {...props(quiet)} />);
    expect(screen.queryByText('Customer mood')).not.toBeInTheDocument();
    expect(screen.queryByText(/signals? found/)).not.toBeInTheDocument();
    expect(screen.queryByText('Frustrated')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Customer mood cues are off in immersive practice.')).toBeVisible();
    expect(presence(container)).toHaveAttribute('data-sig-mood', 'neutral');
    expect(container.querySelectorAll('[data-lit]')).toHaveLength(0);
  });

  it('moves the presence while the customer is typing or speaking', () => {
    const { container, rerender } = render(<PresenceRail {...props(guided)} />);
    expect(presence(container)).not.toHaveAttribute('data-typing');
    rerender(<PresenceRail {...props(guided, { speaking: true })} />);
    expect(presence(container)).toHaveAttribute('data-typing');
  });

  it('acknowledges a new signal once, without saying what it was', () => {
    const { rerender } = render(<PresenceRail {...props(guided)} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(<PresenceRail {...props(guided, { announceFound: true })} />);
    expect(screen.getByRole('status')).toHaveTextContent(/^Signal found$/);
  });

  it('keeps End call, Sound effects and Details within reach', async () => {
    const user = userEvent.setup();
    const onEnd = vi.fn();
    const onSound = vi.fn();
    const onOpenDetails = vi.fn();
    render(<PresenceRail {...props(guided, { onEnd, onSound, onOpenDetails })} />);
    await user.click(screen.getByRole('button', { name: 'End call' }));
    await user.click(screen.getByRole('button', { name: 'Sound effects' }));
    await user.click(screen.getByRole('button', { name: 'Call details' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onSound).toHaveBeenCalledWith(true);
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });
});

describe('EndCallDialog', () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    pending: false,
    error: null,
    onConfirm: vi.fn(),
    onDiscard: vi.fn(),
  };

  it('only offers to discard a call with no messages', () => {
    render(<EndCallDialog {...baseProps} traineeTurns={0} replying={false} />);
    expect(
      screen.queryByRole('button', { name: /end call and get feedback/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard call/i })).toBeInTheDocument();
  });

  it('warns that a very short call gives limited evidence, and waits for a pending reply', () => {
    const { rerender } = render(<EndCallDialog {...baseProps} traineeTurns={2} replying={false} />);
    expect(screen.getByText(/limited evidence/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /end call and get feedback/i })).toBeEnabled();
    rerender(<EndCallDialog {...baseProps} traineeTurns={5} replying={true} />);
    expect(screen.queryByText(/limited evidence/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /end call and get feedback/i })).toBeDisabled();
  });

  it('puts focus on the safe answer, and cannot be dismissed while the call is being ended', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <EndCallDialog {...baseProps} onClose={onClose} traineeTurns={4} replying={false} />,
    );
    expect(screen.getByRole('button', { name: 'Keep talking' })).toHaveFocus();
    rerender(
      <EndCallDialog {...baseProps} onClose={onClose} traineeTurns={4} replying={false} pending />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });
});

describe('CallDetails', () => {
  it('shows the briefing and the areas worth exploring in guided practice', () => {
    const session = makeSession();
    render(<CallDetails session={session} notes="" onNotes={vi.fn()} />);
    expect(screen.getByText('Locked out after a password reset')).toBeInTheDocument();
    expect(screen.getByText('A customer cannot sign in.')).toBeInTheDocument();
    expect(screen.getByText('Find out what is happening.')).toBeInTheDocument();
    expect(screen.getByText('When it started')).toBeInTheDocument();
    expect(screen.getByText('Guided practice')).toBeInTheDocument();
    expect(screen.getByText('Demo mode')).toBeInTheDocument();
    // The mood and the number of signals are on the page behind it, not here.
    expect(screen.queryByText('Frustrated')).not.toBeInTheDocument();
  });

  it('shows no discovery areas in immersive practice, and says there are no cues', () => {
    const session = immersive(makeSession());
    render(<CallDetails session={session} notes="" onNotes={vi.fn()} />);
    expect(screen.queryByText('When it started')).not.toBeInTheDocument();
    expect(screen.queryByText('Areas worth exploring')).not.toBeInTheDocument();
    expect(screen.getByText(/No on-screen cues/)).toBeInTheDocument();
    expect(screen.getByText('A customer cannot sign in.')).toBeInTheDocument();
  });

  it('keeps private notes in the box the person types in', async () => {
    const onNotes = vi.fn();
    const session = makeSession();
    const user = userEvent.setup();
    render(<CallDetails session={session} notes="" onNotes={onNotes} />);
    await user.type(screen.getByLabelText('Private notes'), 'x');
    expect(onNotes).toHaveBeenCalledWith('x');
  });
});
