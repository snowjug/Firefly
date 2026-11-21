import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CallSnapshot } from '../call/contract.ts';
import { FIXTURE_NAMES, FIXTURES, type FixtureName } from './call-fixtures.ts';
import {
  announced,
  clearViewport,
  fakeActions,
  renderCall,
  snapshotOf,
  WIDTH,
} from './test-utils.tsx';

afterEach(() => {
  cleanup();
  clearViewport();
  vi.useRealTimers();
});

const zone = () => screen.getByRole('group', { name: 'Call status and controls' });
const stateCard = () => screen.getByRole('group', { name: 'Customer state' });
// Testing Library treats every <header> as a banner, and the command bar is the first one on the page.
const bar = () => screen.getAllByRole('banner')[0]!;

// What the large status line says in each fixture that shows the workspace.
const STATUS: Partial<Record<FixtureName, string>> = {
  ready: 'Connecting',
  listening: 'Listening',
  'speech-detected': 'Hearing you',
  transcribing: 'Transcribing what you said',
  processing: 'The customer is thinking',
  'customer-speaking': 'The customer is speaking',
  'ready-for-next-turn': 'Your turn',
  'hands-free': 'Your turn',
  interrupted: 'Your turn',
  muted: 'Microphone muted',
  paused: 'Call paused',
  'nothing-heard': 'Your turn',
  'text-only': 'Text-only call. Type your reply.',
  'text-only-thinking': 'The customer is thinking',
  'blocking-reply-failed': 'The customer has not replied',
  'problem-offline': 'You are offline',
  'problem-microphone-lost': 'Microphone unavailable',
  'turn-limit': 'Message limit reached',
  ending: 'Ending the call',
  // A spoken call carries on paused after a failed ending: the microphone was let go of.
  'end-failed': 'Call paused',
  'end-nothing-to-review': 'Call paused',
};

const STATE_LABEL: Partial<Record<FixtureName, string>> = {
  'state-calm': 'Calm',
  'state-concerned': 'Concerned',
  'state-frustrated': 'Frustrated',
  'state-angry': 'Angry',
  'state-escalating': 'Escalating',
  'state-recovering': 'Recovering',
};

const isWorkspace = (name: FixtureName) => {
  const { session, phase } = FIXTURES[name].snapshot;
  return session !== null && phase !== 'idle' && phase !== 'requesting-microphone';
};
const WORKSPACE = FIXTURE_NAMES.filter(isWorkspace);

describe('every fixture', () => {
  it.each(FIXTURE_NAMES)('%s has one h1, no duplicate ids and no inline styles', (name) => {
    for (const width of [WIDTH.narrow, WIDTH.wide]) {
      const { container, unmount } = renderCall(name, { width });
      expect(container.querySelectorAll('h1')).toHaveLength(1);
      const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
      expect(new Set(ids).size, `duplicate ids in ${name} at ${width}px`).toBe(ids.length);
      expect(container.querySelectorAll('[style]'), `inline style in ${name}`).toHaveLength(0);
      unmount();
      clearViewport();
    }
  });

  it.each(WORKSPACE)('%s shows the right status line, state and controls', (name) => {
    const { snapshot } = FIXTURES[name];
    renderCall(name, { width: WIDTH.wide });
    const expected = STATUS[name] ?? 'Your turn';
    expect(within(zone()).getByText(expected)).toBeInTheDocument();

    // The customer's state is always shown, with its word.
    const state = snapshot.customerState;
    expect(state).not.toBeNull();
    const label = STATE_LABEL[name] ?? state!.band.label;
    expect(within(stateCard()).getByText(label)).toBeInTheDocument();

    const blocking = snapshot.problem?.severity === 'blocking';
    const controls = screen.queryByRole('group', { name: 'Voice controls' });
    if (snapshot.mode === 'voice' && !blocking) {
      expect(controls).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', { name: /^(Talk|Stop talking|Interrupt)$/ }),
      ).toHaveLength(1);
    } else {
      expect(controls).not.toBeInTheDocument();
    }
    // Every workspace has the command bar's End call.
    expect(screen.getAllByRole('button', { name: 'End call' }).length).toBeGreaterThan(0);
  });
});

describe('the four stages of a turn', () => {
  it('tells them apart by words, icon shape and how the waveform is drawn', () => {
    const stages = ['speech-detected', 'transcribing', 'processing', 'customer-speaking'] as const;
    const seen = stages.map((name) => {
      renderCall(name, { width: WIDTH.wide });
      const strip = within(zone()).getByText(STATUS[name]!).closest('[data-stage]') as HTMLElement;
      const record = {
        stage: strip.dataset.stage,
        label: STATUS[name],
        icon: strip.querySelector('svg')?.innerHTML,
        wave: strip.querySelector('svg[data-mode]')?.getAttribute('data-mode'),
      };
      cleanup();
      clearViewport();
      return record;
    });
    expect(new Set(seen.map((entry) => entry.stage)).size).toBe(4);
    expect(new Set(seen.map((entry) => entry.icon)).size).toBe(4);
    expect(seen.map((entry) => entry.wave)).toEqual([
      'trainee',
      'transcribing',
      'thinking',
      'customer',
    ]);
  });

  it('shows the customer’s ring and the word Speaking while their voice plays', () => {
    renderCall('customer-speaking', { width: WIDTH.wide });
    const stage = screen.getByRole('region', { name: 'Customer and voice' });
    expect(within(stage).getByText('Speaking')).toBeInTheDocument();
  });
});

describe('the layouts', () => {
  it('shows three columns at 80em and up', () => {
    renderCall('ready-for-next-turn', { width: WIDTH.wide });
    expect(screen.getByRole('region', { name: 'Customer and voice' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Transcript' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Call context' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
  });

  it('moves the context into a sheet between 64em and 80em', async () => {
    renderCall('ready-for-next-turn', { width: WIDTH.medium });
    expect(screen.getByRole('region', { name: 'Customer and voice' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Call context' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Details' }));
    const sheet = screen.getByRole('dialog', { name: 'Call details' });
    expect(within(sheet).getByText('Your objective')).toBeInTheDocument();
    // The stage panel already shows the customer, so the sheet does not repeat the state card.
    expect(within(sheet).queryByRole('group', { name: 'Customer state' })).not.toBeInTheDocument();
  });

  it('is one column below 64em, with the controls in a dock and the customer in the sheet', async () => {
    renderCall('ready-for-next-turn', { width: WIDTH.tablet });
    expect(screen.queryByRole('region', { name: 'Customer and voice' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Talk' })).toBeInTheDocument();
    // The compact bar carries the customer, their state, the time and End call.
    const commandBar = bar();
    expect(within(commandBar).getByText('Maya Okafor')).toBeInTheDocument();
    expect(within(commandBar).getByText('Concerned')).toBeInTheDocument();
    expect(within(commandBar).getByRole('timer')).toBeInTheDocument();
    expect(within(commandBar).getByRole('button', { name: 'End call' })).toBeInTheDocument();
    await userEvent.click(within(commandBar).getByRole('button', { name: 'Details' }));
    const sheet = screen.getByRole('dialog', { name: 'Call details' });
    expect(within(sheet).getByRole('group', { name: 'Customer state' })).toBeInTheDocument();
    expect(within(sheet).getByText('Your objective')).toBeInTheDocument();
  });

  it('keeps End call in the bar, last in its tab order, at every width', () => {
    for (const width of Object.values(WIDTH)) {
      const { unmount } = renderCall('ready-for-next-turn', { width });
      const buttons = within(bar()).getAllByRole('button');
      expect(buttons[buttons.length - 1]).toHaveAccessibleName('End call');
      unmount();
      clearViewport();
    }
  });
});

describe('the command bar', () => {
  it('writes out the scenario, the customer and their role in full', () => {
    renderCall('ready-for-next-turn', { width: WIDTH.wide });
    expect(within(bar()).getByText('Locked out after a password reset')).toBeInTheDocument();
    expect(within(bar()).getByText('Maya Okafor, Front-desk coordinator')).toBeInTheDocument();
  });

  it('has a timer that is never announced', () => {
    renderCall('ready-for-next-turn', { width: WIDTH.wide });
    const timer = screen.getByRole('timer', { name: 'Call time' });
    expect(timer).toHaveAttribute('aria-live', 'off');
    expect(timer).toHaveTextContent('2:47');
  });

  it('labels the difficulty and the provider, never calling the built-in rules a live model', () => {
    const { unmount } = renderCall('ready-for-next-turn', { width: WIDTH.wide });
    expect(within(bar()).getByText('Starter')).toBeInTheDocument();
    expect(within(bar()).getByText('Demo mode')).toBeInTheDocument();
    expect(within(bar()).queryByText('Live model')).not.toBeInTheDocument();
    unmount();
    renderCall('live-model', { width: WIDTH.wide });
    expect(within(bar()).getByText('Live model')).toBeInTheDocument();
  });

  it.each([
    ['ready-for-next-turn', 'Live call'],
    ['muted', 'Muted'],
    ['paused', 'Paused'],
    ['text-only', 'Text-only call'],
    ['problem-offline', 'Offline'],
  ] as const)('shows the connection badge for %s', (name, label) => {
    renderCall(name, { width: WIDTH.wide });
    expect(within(bar()).getByText(label)).toBeInTheDocument();
  });

  it('says reconnecting once the browser is back online but the call has not recovered', () => {
    renderCall('problem-offline', { width: WIDTH.wide, online: true });
    expect(within(bar()).getByText('Reconnecting')).toBeInTheDocument();
  });
});

describe('the context', () => {
  it('shows what the trainee was told, and nothing hidden, in a standard call', () => {
    renderCall('ready-for-next-turn', { width: WIDTH.wide });
    const context = screen.getByRole('region', { name: 'Call context' });
    for (const text of [
      'Business impact',
      'Call stage',
      'Your objective',
      'Ground rules',
      'Difficulty',
      "Customer's starting state",
      'Live hints',
      'Off',
      'Understand what is happening and why, then agree how she will get back in.',
    ]) {
      expect(within(context).getByText(text)).toBeInTheDocument();
    }
    // Standard mode shows no hints at all.
    expect(within(context).queryByText('Areas worth exploring')).not.toBeInTheDocument();
    expect(screen.queryByText(/Context found/)).not.toBeInTheDocument();
    expect(screen.queryByText('Other devices using the account')).not.toBeInTheDocument();
  });

  it('is one named region that a keyboard can reach, because the column scrolls', () => {
    renderCall('ready-for-next-turn', { width: WIDTH.wide });
    // It holds only text, so the scrolling area itself has to take focus (WCAG 2.1.1), and it is
    // the only landmark with this name.
    expect(screen.getAllByRole('region', { name: 'Call context' })).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Call context' })).toHaveAttribute('tabindex', '0');
  });

  it('adds the areas worth exploring and a count, never a total, in guided practice', () => {
    renderCall('guided-hints', { width: WIDTH.wide });
    const context = screen.getByRole('region', { name: 'Call context' });
    expect(within(context).getByText('Areas worth exploring')).toBeInTheDocument();
    expect(within(context).getByText('Other devices using the account')).toBeInTheDocument();
    expect(within(context).getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Context found: 2')).toBeInTheDocument();
    expect(screen.queryByText(/of \d+/)).not.toBeInTheDocument();
  });
});

describe('landmarks and skip links', () => {
  it('has one h1, named for the customer, and headings that do not skip a level', () => {
    renderCall('ready-for-next-turn', { width: WIDTH.wide });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Call with Maya Okafor');
    const levels = screen
      .getAllByRole('heading')
      .map((heading) => Number(heading.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index]! - levels[index - 1]!).toBeLessThanOrEqual(1);
    }
  });

  it('starts with a "Jump to" list of skip links to the controls, the transcript and the reply box', async () => {
    renderCall('ready-for-next-turn', { width: WIDTH.wide });
    const nav = screen.getByRole('navigation', { name: 'Jump to' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Jump to the call controls',
      'Jump to the transcript',
      'Jump to the reply box',
    ]);
    // They come before everything else on the page.
    expect(nav.parentElement?.firstElementChild).toBe(nav);

    await userEvent.click(links[2]!);
    expect(screen.getByRole('textbox', { name: 'Type a reply' })).toHaveFocus();
    await userEvent.click(links[1]!);
    expect(screen.getByRole('region', { name: 'Transcript' })).toHaveFocus();
    await userEvent.click(links[0]!);
    expect(screen.getByRole('button', { name: 'Talk' })).toHaveFocus();
  });

  it('keeps the reply box’s address in the page while the box is closed, at every width', () => {
    for (const width of [WIDTH.narrow, WIDTH.medium, WIDTH.wide]) {
      const { unmount } = renderCall('ready-for-next-turn', { width });
      // The "Jump to the reply box" link points here: a link to nothing is a broken skip link.
      expect(screen.queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument();
      expect(document.getElementById('cw-reply'), `no #cw-reply at ${width}px`).not.toBeNull();
      unmount();
      clearViewport();
    }
  });

  it('has no global character shortcuts', async () => {
    const { actions } = renderCall('ready-for-next-turn', { width: WIDTH.wide });
    await userEvent.keyboard('m p t r s e ? / 1');
    for (const name of ['talk', 'toggleMute', 'togglePause', 'replay', 'endCall'] as const) {
      expect(actions[name]).not.toHaveBeenCalled();
    }
  });
});

describe('what a screen reader hears', () => {
  it('reads the engine’s announcement once, as a whole sentence', () => {
    vi.useFakeTimers();
    const base = snapshotOf('ready-for-next-turn');
    const { update } = renderCall({ ...base, announcement: null });
    expect(announced()).toBe('');
    update({ ...base, announcement: { id: 1, text: 'The customer is speaking.' } });
    expect(announced()).toBe('The customer is speaking.');
    // The same message again (same id) is not read again.
    act(() => vi.advanceTimersByTime(6000));
    expect(announced()).toBe('');
    update({ ...base, announcement: { id: 1, text: 'The customer is speaking.' } });
    expect(announced()).toBe('');
  });

  it('says a change of the customer’s state once, and never why', () => {
    vi.useFakeTimers();
    const base = snapshotOf('state-concerned');
    const worse: CallSnapshot = {
      ...base,
      customerState: { ...base.customerState!, band: { id: 'frustrated', label: 'Frustrated' } },
    };
    const { update } = renderCall(base, { width: WIDTH.wide });
    expect(announced()).toBe('');
    update(worse);
    expect(announced()).toBe('The customer now seems frustrated.');
    act(() => vi.advanceTimersByTime(6000));
    update({ ...worse, elapsedSeconds: worse.elapsedSeconds + 1 });
    expect(announced()).toBe('');
  });

  it('shows the new state in words and gives the card a brief outline', () => {
    vi.useFakeTimers();
    const base = snapshotOf('state-concerned');
    const worse: CallSnapshot = {
      ...base,
      customerState: {
        ...base.customerState!,
        band: { id: 'frustrated', label: 'Frustrated' },
        trend: 'rising',
      },
    };
    const { update } = renderCall(base, { width: WIDTH.wide });
    expect(stateCard()).not.toHaveAttribute('data-changed');
    update(worse);
    expect(within(stateCard()).getByText('Frustrated')).toBeInTheDocument();
    expect(within(stateCard()).getByText('Getting more frustrated')).toBeInTheDocument();
    expect(stateCard()).toHaveAttribute('data-changed', 'true');
    act(() => vi.advanceTimersByTime(3000));
    expect(stateCard()).not.toHaveAttribute('data-changed');
  });

  it('never reads transcript text through the announcer: a new reply is the log’s to announce', () => {
    vi.useFakeTimers();
    const base = snapshotOf('ready-for-next-turn');
    const { update } = renderCall(base);
    const reply = {
      ...base.turns[0]!,
      key: 'new',
      index: 11,
      text: 'A brand new reply from the customer.',
    };
    update({ ...base, turns: [...base.turns, reply] });
    expect(announced()).toBe('');
    expect(screen.getByRole('log', { name: 'Call transcript' })).toHaveTextContent(
      'A brand new reply from the customer.',
    );
  });
});

describe('the status line is plain text', () => {
  it('is not a live region, so nothing is read twice', () => {
    renderCall('transcribing', { width: WIDTH.wide });
    const line = within(zone()).getByText('Transcribing what you said');
    expect(line.closest('[aria-live]')).toBeNull();
    expect(line.closest('[role="status"]')).toBeNull();
  });
});

describe('the page states', () => {
  it('shows a skeleton while loading, with one heading', () => {
    const { container } = renderCall('loading');
    expect(container.querySelector('[aria-busy="true"]')).toHaveTextContent('Loading the call');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('explains a load failure and offers Try again and a way back', async () => {
    const { actions } = renderCall('load-error');
    expect(
      screen.getByRole('heading', { level: 1, name: 'This call could not be opened.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nothing in the call was changed.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(actions.retry).toHaveBeenCalledTimes(1);
  });

  it('says "Call unavailable" for a call that does not exist', () => {
    renderCall('unavailable');
    expect(screen.getByRole('heading', { level: 1, name: 'Call unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('is never blank for a call that is already over', () => {
    const base = snapshotOf('ready-for-next-turn');
    renderCall({ ...base, session: { ...base.session!, status: 'completed' } });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Opening your report' }),
    ).toBeInTheDocument();
  });
});

describe('the actions it is given', () => {
  it('never calls the engine just by being shown', () => {
    const actions = fakeActions();
    for (const name of FIXTURE_NAMES) {
      const { unmount } = renderCall(name, { actions, width: WIDTH.wide });
      unmount();
      clearViewport();
    }
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  });
});
