import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import { Composer } from './Composer.tsx';
import { ContextPanel } from './ContextPanel.tsx';
import { EndCallDialog } from './EndCallDialog.tsx';
import { MessageList } from './MessageList.tsx';
import { Presence, presenceFor } from './Presence.tsx';
import { callReducer, initialCallState, type ChatTurn } from './useCall.ts';
import { ThemeProvider } from '../../lib/theme.tsx';

vi.mock('../ProviderBadge.tsx', () => ({
  ProviderBadge: () => <span>Demo mode</span>,
}));

function mockPointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: coarse && query.includes('pointer: coarse'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  mockPointer(false);
  Element.prototype.scrollTo = () => undefined;
});
afterEach(() => vi.unstubAllGlobals());

const persona = { name: 'Maya Okafor', role: 'Receptionist', organisation: 'Northwind Clinic' };

const turn = (over: Partial<ChatTurn>): ChatTurn => ({
  key: 't1',
  index: 1,
  role: 'customer',
  text: 'Hello',
  createdAt: '2025-01-01T10:00:00.000Z',
  status: 'sent',
  ...over,
});

function makeSession(over: Partial<SessionDTO> = {}): SessionDTO {
  return {
    id: 'session-1',
    scenarioId: 'demo',
    scenarioTitle: 'Demo',
    issueType: 'sign-in-access',
    difficulty: 'starter',
    startingTemperature: 'calm',
    impact: 'low',
    style: 'talkative',
    mode: 'guided',
    providerKind: 'mock',
    providerLabel: 'Demo mode',
    isSample: false,
    status: 'active',
    startedAt: '2025-01-01T10:00:00.000Z',
    endedAt: null,
    durationSeconds: null,
    traineeTurns: 1,
    completion: null,
    overallScore: null,
    dimensionScores: null,
    mentorReviewed: false,
    scenario: {
      scenarioId: 'demo',
      title: 'Demo',
      summary: 'Summary',
      issueType: 'sign-in-access',
      tags: [],
      estimatedMinutes: 10,
      persona,
      brief: {
        situation: 'A customer cannot sign in.',
        goal: 'Find out what is happening.',
        groundRules: ['Everything is fictional.'],
      },
      config: {
        impact: 'low',
        startingTemperature: 'calm',
        proficiency: 'novice',
        style: 'talkative',
        callStage: 'first-contact',
        difficulty: 'starter',
        mode: 'guided',
        curveballsEnabled: false,
      },
      expectedDiscoveryAreas: ['When it started'],
      coachingFocus: ['scoping-discovery'],
    },
    turns: [
      {
        index: 1,
        role: 'customer',
        text: 'Hi',
        createdAt: '2025-01-01T10:00:00.000Z',
        source: 'opening',
      },
      {
        index: 2,
        role: 'trainee',
        text: 'Hello Maya',
        createdAt: '2025-01-01T10:00:05.000Z',
        source: 'trainee',
      },
    ],
    state: {
      band: { id: 'concerned', label: 'Concerned' },
      trend: 'falling',
      discoveredCount: 2,
      silent: false,
    },
    awaitingReply: null,
    evaluationPhase: null,
    evaluationError: null,
    report: null,
    ...over,
  };
}

describe('conversation state', () => {
  it('shows a saved message whose reply never arrived as retryable, with its original id', () => {
    const state = initialCallState(
      makeSession({ awaitingReply: { clientMessageId: 'abc12345', turnIndex: 2 } }),
      60,
    );
    const last = state.turns[1];
    expect(last).toMatchObject({
      status: 'failed',
      saved: true,
      clientMessageId: 'abc12345',
      text: 'Hello Maya',
    });
    expect(state.turnsRemaining).toBe(59);
    expect(initialCallState(makeSession(), 60).turns.every((t) => t.status === 'sent')).toBe(true);
  });

  const reply = (over: Partial<SessionDTO['state']>, text = 'Maya says something') => ({
    traineeTurn: {
      index: 3,
      role: 'trainee' as const,
      text: 'Hello',
      createdAt: '2025-01-01T10:00:10.000Z',
      source: 'trainee' as const,
    },
    customerTurn: {
      index: 4,
      role: 'customer' as const,
      text,
      createdAt: '2025-01-01T10:00:12.000Z',
      source: 'live' as const,
    },
    state: { ...makeSession().state, ...over },
    redactions: [],
    turnsRemaining: 50,
  });
  const sending: ChatTurn = turn({ key: 'k1', index: null, role: 'trainee', status: 'sending' });

  it('notes when a reply lights a signal, and when the customer changes mood or goes quiet', () => {
    const before = { ...initialCallState(makeSession(), 60), turns: [sending] };

    const found = callReducer(before, {
      type: 'sent',
      key: 'k1',
      response: reply({ discoveredCount: 3 }),
      announcement: '',
    });
    expect(found.discoveries).toBe(1);
    expect(found.signalKeys).toEqual(['t4']);
    expect(found.replies).toBe(1);
    expect(found.shifts).toEqual([]);

    const tenser = callReducer(before, {
      type: 'sent',
      key: 'k1',
      response: reply({ band: { id: 'frustrated', label: 'Frustrated' }, silent: true }),
      announcement: '',
    });
    expect(tenser.discoveries).toBe(0);
    expect(tenser.signalKeys).toEqual([]);
    expect(tenser.shifts).toMatchObject([
      { kind: 'band', direction: 'tenser', from: { id: 'concerned' }, to: { id: 'frustrated' } },
      { kind: 'silent' },
    ]);

    const calmer = callReducer(before, {
      type: 'sent',
      key: 'k1',
      response: reply({ band: { id: 'calm', label: 'Calm' } }),
      announcement: '',
    });
    expect(calmer.shifts).toMatchObject([{ kind: 'band', direction: 'calmer' }]);
  });
});

describe('customer presence', () => {
  const guided = makeSession();
  const immersive = makeSession({
    scenario: { ...guided.scenario, config: { ...guided.scenario.config, mode: 'immersive' } },
  });

  it('follows the customer state in guided practice and keeps a couple of signals dormant', () => {
    const view = presenceFor(guided, guided.state);
    expect(view).toMatchObject({ guided: true, mood: 'concerned', tone: 'falling', found: 2 });
    expect(view.signals).toEqual({ total: 4, lit: 2 });
    expect(presenceFor(guided, { ...guided.state, discoveredCount: 20 }).signals?.total).toBe(8);
  });

  it('shows nothing about the customer in immersive practice', () => {
    const view = presenceFor(immersive, immersive.state);
    expect(view).toMatchObject({ guided: false, mood: 'neutral', tone: 'steady', signals: null });
  });

  it('renders signal points in guided practice only, and never as readable text', () => {
    const props = { pending: false, replies: 0, discoveries: 0 };
    const { container, rerender } = render(
      <ThemeProvider>
        <Presence session={guided} state={guided.state} {...props} />
      </ThemeProvider>,
    );
    const dots = container.querySelectorAll('.signal-dot');
    expect(dots).toHaveLength(4);
    expect(container.querySelectorAll('.signal-dot[data-lit="true"]')).toHaveLength(2);
    expect(container.querySelector('.signal-row')).toHaveAttribute('aria-hidden', 'true');

    rerender(
      <ThemeProvider>
        <Presence session={immersive} state={immersive.state} {...props} />
      </ThemeProvider>,
    );
    expect(container.querySelector('.signal-row')).toBeNull();
    expect(container.querySelector('.core')).toHaveAttribute('data-mood', 'neutral');
    expect(container.textContent).not.toMatch(/concerned|calm|frustrated/i);
  });

  it('acknowledges a new signal once, without saying what it was', () => {
    const props = { pending: false, replies: 0 };
    const { rerender } = render(
      <ThemeProvider>
        <Presence session={guided} state={guided.state} discoveries={0} {...props} />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(
      <ThemeProvider>
        <Presence session={guided} state={guided.state} discoveries={1} {...props} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/^Signal found$/);
  });
});

describe('Composer', () => {
  it('sends with Enter on a desktop keyboard and adds a line with Shift+Enter', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <Composer
        maxChars={100}
        busy={false}
        blockedMessage={null}
        turnsRemaining={null}
        onSend={onSend}
      />,
    );
    const box = screen.getByLabelText('Your reply to the customer');
    await user.type(box, 'First line{Shift>}{Enter}{/Shift}Second line');
    expect(box).toHaveValue('First line\nSecond line');
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledWith('First line\nSecond line');
    expect(box).toHaveValue('');
  });

  it('adds a line on Enter on a touch device and sends with the button', async () => {
    mockPointer(true);
    const onSend = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <Composer
        maxChars={100}
        busy={false}
        blockedMessage={null}
        turnsRemaining={null}
        onSend={onSend}
      />,
    );
    const box = screen.getByLabelText('Your reply to the customer');
    await user.type(box, 'Hello{Enter}there');
    expect(onSend).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSend).toHaveBeenCalledWith('Hello\nthere');
  });

  it('does not send empty, over-long or while a reply is pending, and explains why', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Composer
        maxChars={10}
        busy={false}
        blockedMessage={null}
        turnsRemaining={null}
        onSend={vi.fn()}
      />,
    );
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText('Your reply to the customer'), 'This is far too long');
    expect(send).toBeDisabled();
    expect(screen.getByText(/characters over the 10 limit/)).toBeInTheDocument();
    rerender(
      <Composer
        maxChars={100}
        busy={true}
        blockedMessage={null}
        turnsRemaining={3}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByText('3 messages left in this call')).toBeInTheDocument();
  });

  it('warns about personal data before it is sent and blocks the box at the message limit', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Composer
        maxChars={500}
        busy={false}
        blockedMessage={null}
        turnsRemaining={null}
        onSend={vi.fn()}
      />,
    );
    await user.type(
      screen.getByLabelText('Your reply to the customer'),
      'Mail me at jo@example.com',
    );
    expect(screen.getByText(/looks like it contains an email address/i)).toBeInTheDocument();
    rerender(
      <Composer
        maxChars={500}
        busy={false}
        blockedMessage="This call has reached its message limit."
        turnsRemaining={0}
        onSend={vi.fn()}
      />,
    );
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

  it('shows a typing indicator without exposing it as text to assistive technology', () => {
    const { container } = render(
      <MessageList persona={persona} typing={true} onRetry={vi.fn()} turns={[turn({})]} />,
    );
    const typing = container.querySelector('.msg-typing');
    expect(typing).toHaveAttribute('aria-hidden', 'true');
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

describe('EndCallDialog', () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    pending: false,
    error: null,
    onConfirm: vi.fn(),
    onDiscard: vi.fn(),
  };

  it('only offers to discard a call with no messages', async () => {
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
  it('shows light cues in guided mode', () => {
    render(
      <ContextPanel
        session={makeSession()}
        state={makeSession().state}
        notes=""
        onNotes={vi.fn()}
      />,
    );
    expect(screen.getByText('Concerned')).toBeInTheDocument();
    expect(screen.getByText(/uncovered so far/)).toBeInTheDocument();
    expect(screen.getByText('When it started')).toBeInTheDocument();
  });

  it('shows no mood, count or discovery areas in immersive mode', () => {
    const base = makeSession();
    const immersive = makeSession({
      scenario: { ...base.scenario, config: { ...base.scenario.config, mode: 'immersive' } },
    });
    render(<ContextPanel session={immersive} state={immersive.state} notes="" onNotes={vi.fn()} />);
    expect(screen.queryByText('Concerned')).not.toBeInTheDocument();
    expect(screen.queryByText(/uncovered so far/)).not.toBeInTheDocument();
    expect(screen.queryByText('When it started')).not.toBeInTheDocument();
    expect(screen.getByText(/No on-screen cues/)).toBeInTheDocument();
  });
});
