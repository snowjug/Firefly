import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import { immersive, makeReply, makeSession, persona, stubScreen } from './call-test-kit.ts';
import { Composer } from './Composer.tsx';
import { ContextPanel } from './ContextPanel.tsx';
import { EndCallDialog } from './EndCallDialog.tsx';
import { HintChips } from './HintChips.tsx';
import { HINTS, hintIdsForAreas, hintsFor, withStarter } from './hints.ts';
import { MessageList } from './MessageList.tsx';
import { CustomerStage } from './StagePanel.tsx';
import { callReducer, initialCallState, type ChatTurn } from './useCall.ts';

vi.mock('../ProviderBadge.tsx', () => ({
  ProviderBadge: () => <span>Demo mode</span>,
}));

beforeEach(() => {
  stubScreen();
  Element.prototype.scrollTo = () => undefined;
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
      <HintChips hints={hintsFor({ areas, band: 'calm', traineeTurns: 0 })} onPick={onPick} />,
    );
    const group = screen.getByRole('group', { name: 'Ideas for what to say' });
    await user.click(within(group).getByRole('button', { name: 'Acknowledge the impact' }));
    expect(onPick).toHaveBeenCalledWith(HINTS.acknowledge);
    expect(group).toHaveAccessibleDescription(/Nothing is sent until you press Send/);
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
    expect(box).toHaveAttribute('placeholder', 'Type your response…');
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

describe('MessageList', () => {
  it('renders plain text for both speakers and offers a retry for a failed message', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <MessageList
        persona={persona}
        typing={false}
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

  it('shows who is typing, without exposing the indicator to assistive technology', () => {
    const { container } = render(
      <MessageList persona={persona} typing={true} onRetry={vi.fn()} turns={[turn({})]} />,
    );
    const typing = container.querySelector('.msg-typing');
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
    const { rerender } = render(
      <MessageList persona={persona} typing={false} onRetry={vi.fn()} turns={turns} />,
    );
    expect(screen.queryByRole('button', { name: /listen/i })).not.toBeInTheDocument();
    rerender(
      <MessageList
        persona={persona}
        typing={false}
        onRetry={vi.fn()}
        turns={turns}
        onListen={onListen}
      />,
    );
    const buttons = screen.getAllByRole('button', { name: /^Listen to Maya Okafor/ });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0] as HTMLElement);
    expect(onListen).toHaveBeenCalledWith('Hello');
  });

  it('shows mood shifts and signal markers in guided practice, and none of it in immersive', () => {
    const turns = [
      turn({ key: 't1', index: 1 }),
      turn({ key: 't2', index: 2, role: 'trainee', text: 'Hi' }),
      turn({ key: 't3', index: 3, text: 'Something useful' }),
    ];
    const shifts = [
      {
        afterKey: 't3',
        kind: 'band' as const,
        from: { id: 'calm' as const, label: 'Calm' },
        to: { id: 'frustrated' as const, label: 'Frustrated' },
        direction: 'tenser' as const,
      },
      { afterKey: 't3', kind: 'silent' as const },
    ];
    const { container, rerender } = render(
      <MessageList
        persona={persona}
        typing={false}
        onRetry={vi.fn()}
        turns={turns}
        guided
        signalKeys={['t3']}
        shifts={shifts}
      />,
    );
    expect(screen.getByText(/Maya Okafor's mood shifted from Calm to Frustrated/)).toBeVisible();
    expect(screen.getByText('Maya Okafor has gone quiet.')).toBeVisible();
    expect(screen.getByText('Signal found in this reply')).toBeVisible();

    rerender(
      <MessageList
        persona={persona}
        typing={false}
        onRetry={vi.fn()}
        turns={turns}
        signalKeys={['t3']}
        shifts={shifts}
      />,
    );
    expect(container.querySelector('.shift')).toBeNull();
    expect(screen.queryByText(/signal found/i)).not.toBeInTheDocument();
    expect(container.querySelector('[data-signal]')).toBeNull();
  });

  it('says only that the conversation changed for a curveball, and only in guided practice', () => {
    const turns = [turn({ key: 't1', index: 1 }), turn({ key: 't3', index: 3, text: 'Hm.' })];
    const shifts = [{ afterKey: 't3', kind: 'curveball' as const }];
    const { container, rerender } = render(
      <MessageList
        persona={persona}
        typing={false}
        onRetry={vi.fn()}
        turns={turns}
        guided
        shifts={shifts}
      />,
    );
    const note = container.querySelector('.shift');
    expect(note).toHaveAttribute('data-kind', 'curveball');
    expect(note).toHaveTextContent(/^The conversation changed\.$/);
    expect(screen.queryByText(/mood shifted/)).not.toBeInTheDocument();

    rerender(
      <MessageList
        persona={persona}
        typing={false}
        onRetry={vi.fn()}
        turns={turns}
        shifts={shifts}
      />,
    );
    expect(container.querySelector('.shift')).toBeNull();
    expect(screen.queryByText(/conversation changed/i)).not.toBeInTheDocument();
  });

  it('only gives messages that arrive later an entrance, never the ones the call opened with', () => {
    const opening = [turn({ key: 't1', index: 1 }), turn({ key: 't2', index: 2, role: 'trainee' })];
    const { container, rerender } = render(
      <MessageList persona={persona} typing={false} onRetry={vi.fn()} turns={opening} />,
    );
    expect(container.querySelectorAll('[data-fresh]')).toHaveLength(0);
    rerender(
      <MessageList
        persona={persona}
        typing={false}
        onRetry={vi.fn()}
        turns={[...opening, turn({ key: 't3', index: 3 })]}
      />,
    );
    expect(container.querySelectorAll('[data-fresh="true"]')).toHaveLength(1);
  });

  it('keeps a message that did not get through, and its retry banner, in view', () => {
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo;
    const opening = turn({ key: 't1', index: 1 });
    const mine = turn({ key: 'mine', index: null, role: 'trainee', status: 'sending' });
    const { rerender } = render(
      <MessageList persona={persona} typing={false} onRetry={vi.fn()} turns={[opening, mine]} />,
    );
    scrollTo.mockClear();
    rerender(
      <MessageList
        persona={persona}
        typing={false}
        onRetry={vi.fn()}
        turns={[opening, { ...mine, status: 'failed', error: 'Not delivered.' }]}
      />,
    );
    expect(scrollTo).toHaveBeenCalled();
  });

  it('opens at the latest message at once, then scrolls smoothly for a new one', () => {
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo;
    const many = Array.from({ length: 30 }, (_, i) =>
      turn({ key: `t${i}`, index: i + 1, role: i % 2 === 0 ? 'customer' : 'trainee' }),
    );
    const { rerender } = render(
      <MessageList persona={persona} typing={false} onRetry={vi.fn()} turns={many} />,
    );
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    scrollTo.mockClear();

    rerender(
      <MessageList
        persona={persona}
        typing={false}
        onRetry={vi.fn()}
        turns={[...many, turn({ key: 'new', index: 31, role: 'trainee' })]}
      />,
    );
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });
});

describe('CustomerStage', () => {
  const guided = makeSession();
  const quiet = immersive(guided);
  const stage = (session: SessionDTO, over: Partial<Parameters<typeof CustomerStage>[0]> = {}) => (
    <CustomerStage
      session={session}
      state={session.state}
      typing={false}
      speaking={false}
      latest="Nothing works and my whole team is waiting."
      discoveries={0}
      variant="panel"
      {...over}
    />
  );
  const face = (container: HTMLElement) => container.querySelector('svg.ill-customer');

  it('shows who is calling, how much is at stake and what they said last', () => {
    const { container } = render(stage(guided));
    const region = screen.getByRole('region', { name: 'Maya Okafor, the customer' });
    expect(within(region).getByText('Maya Okafor')).toBeVisible();
    expect(within(region).getByText('Receptionist, Northwind Clinic')).toBeVisible();
    expect(within(region).getByText('High impact')).toBeVisible();
    // The speech bubble repeats the chat, so it stays out of the accessibility tree.
    const bubble = within(region).getByText('Nothing works and my whole team is waiting.');
    expect(bubble.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(face(container)).toHaveAttribute('data-mood', 'frustrated');
  });

  it('adds the mood label, the mood meter and the count of uncovered facts in guided practice', () => {
    render(stage(guided));
    expect(screen.getByText('Customer mood')).toBeVisible();
    expect(screen.getByText('Getting more tense')).toBeVisible();
    expect(screen.getByText(/uncovered so far/)).toHaveTextContent('2 facts uncovered so far');
    // The mood is written, never only coloured: once in the caption and once in the meter.
    expect(screen.getAllByText('Frustrated')).toHaveLength(2);
  });

  it('shows no mood label, meter or count in immersive practice, and the face stays calm', () => {
    const { container } = render(stage(quiet));
    expect(screen.queryByText('Customer mood')).not.toBeInTheDocument();
    expect(screen.queryByText(/uncovered/)).not.toBeInTheDocument();
    expect(screen.queryByText('Frustrated')).not.toBeInTheDocument();
    expect(container.querySelector('.mood')).toBeNull();
    expect(screen.getByText('High impact')).toBeVisible();
    // The mood is the one thing immersive practice keeps back, so not even the expression follows it.
    expect(face(container)).toHaveAttribute('data-mood', 'calm');
  });

  it('moves the avatar\u2019s mouth while the customer is typing or speaking', () => {
    const { container, rerender } = render(stage(guided));
    expect(face(container)).toHaveAttribute('data-speaking', 'false');
    rerender(stage(guided, { typing: true }));
    expect(face(container)).toHaveAttribute('data-speaking', 'true');
    rerender(stage(guided, { speaking: true }));
    expect(face(container)).toHaveAttribute('data-speaking', 'true');
  });

  it('acknowledges a new signal once, without saying what it was', () => {
    const { rerender } = render(stage(guided));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(stage(guided, { discoveries: 1 }));
    expect(screen.getByRole('status')).toHaveTextContent(/^Signal found$/);
  });

  it('acknowledges it on a narrow screen too, to a screen reader only', () => {
    const { rerender } = render(stage(guided, { variant: 'strip' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(stage(guided, { variant: 'strip', discoveries: 1 }));
    expect(screen.getByRole('status')).toHaveTextContent(/^Signal found$/);
    expect(screen.getByRole('status')).toHaveClass('sr-only');
  });

  it('says nothing of signals in immersive practice', () => {
    const { rerender } = render(stage(quiet));
    rerender(stage(quiet, { discoveries: 1 }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('becomes a compact strip with the name and, in guided practice only, the mood', () => {
    const { container, rerender } = render(stage(guided, { variant: 'strip', typing: true }));
    const strip = screen.getByRole('region', { name: 'Maya Okafor, the customer' });
    expect(within(strip).getByText('Maya Okafor is typing…')).toBeVisible();
    expect(within(strip).getByText('Frustrated')).toBeVisible();
    expect(container.querySelector('.cstage-bubble')).toBeNull();
    rerender(stage(quiet, { variant: 'strip' }));
    expect(screen.queryByText('Frustrated')).not.toBeInTheDocument();
    expect(screen.getByText('Receptionist')).toBeVisible();
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
});

describe('ContextPanel', () => {
  it('shows the briefing and light cues in guided mode', () => {
    const session = makeSession();
    render(<ContextPanel session={session} state={session.state} notes="" onNotes={vi.fn()} />);
    expect(screen.getByText('A customer cannot sign in.')).toBeInTheDocument();
    expect(screen.getByText('Find out what is happening.')).toBeInTheDocument();
    expect(screen.getByText('Frustrated')).toBeInTheDocument();
    expect(screen.getByText(/uncovered so far/)).toBeInTheDocument();
    expect(screen.getByText('When it started')).toBeInTheDocument();
  });

  it('shows no mood, count or discovery areas in immersive mode', () => {
    const session = immersive(makeSession());
    render(<ContextPanel session={session} state={session.state} notes="" onNotes={vi.fn()} />);
    expect(screen.queryByText('Frustrated')).not.toBeInTheDocument();
    expect(screen.queryByText(/uncovered so far/)).not.toBeInTheDocument();
    expect(screen.queryByText('When it started')).not.toBeInTheDocument();
    expect(screen.getByText(/No on-screen cues/)).toBeInTheDocument();
  });

  it('keeps private notes in the box the person types in', async () => {
    const onNotes = vi.fn();
    const session = makeSession();
    const user = userEvent.setup();
    render(<ContextPanel session={session} state={session.state} notes="" onNotes={onNotes} />);
    await user.type(screen.getByLabelText('Private notes'), 'x');
    expect(onNotes).toHaveBeenCalledWith('x');
  });
});
