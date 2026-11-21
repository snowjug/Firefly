import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { wordCount } from '#shared/domain/scenario.ts';
import {
  describeStatus,
  STATUS_IDS,
  stateChangeSentence,
  describeCustomerState,
  type StatusId,
} from './call-model.ts';
import { FIXTURE_NAMES, FIXTURES, STATUS_FIXTURES, type FixtureName } from './call-fixtures.ts';
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
});

/** The fixtures that are the whole screen, not the workspace (loading, errors, the pre-flight). */
const NOT_THE_WORKSPACE: readonly FixtureName[] = [
  'loading',
  'load-error',
  'unavailable',
  'report-opening',
  'preflight-voice',
  'preflight-text',
  'preflight-browser-speech',
  'preflight-demo-speech',
  'preflight-unsupported',
  'preflight-resume',
  'requesting-permission',
  'permission-denied',
  'microphone-unavailable',
];
const WORKSPACE = FIXTURE_NAMES.filter((name) => !NOT_THE_WORKSPACE.includes(name));
const BEFORE_THE_CALL: readonly StatusId[] = [
  'mic-not-requested',
  'requesting-permission',
  'permission-denied',
  'mic-unavailable',
];

function statusOf(name: FixtureName) {
  const { snapshot, view } = FIXTURES[name];
  return describeStatus({
    stage: snapshot.stage,
    mode: snapshot.mode,
    phase: snapshot.phase,
    speechDetected: snapshot.speechDetected,
    micOpen: snapshot.micOpen,
    microphone: snapshot.microphone,
    problem: snapshot.problem,
    online: view?.online ?? true,
  });
}

describe('every fixture', () => {
  it.each(FIXTURE_NAMES)('%s has one h1, no duplicate ids and no inline styles', (name) => {
    const { container } = renderCall(name);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size, `duplicate ids in ${name}`).toBe(ids.length);
    // CSP: styles come from stylesheets, never from attributes (a loading bar's transform excepted).
    const styled = [...container.querySelectorAll('[style]')].filter(
      (element) => !element.classList.contains('ff-progress__fill'),
    );
    expect(styled, name).toHaveLength(0);
  });

  it.each(FIXTURE_NAMES)('%s never calls the engine just by being shown', (name) => {
    const { actions } = renderCall(name);
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  });
});

describe('the states of the call', () => {
  it('has a fixture for every status, and each fixture is that status', () => {
    expect(Object.keys(STATUS_FIXTURES).sort()).toEqual([...STATUS_IDS].sort());
    for (const id of STATUS_IDS) {
      expect(statusOf(STATUS_FIXTURES[id]).id, `${id} from ${STATUS_FIXTURES[id]}`).toBe(id);
    }
  });

  it.each(STATUS_IDS.filter((id) => !BEFORE_THE_CALL.includes(id)))(
    '%s shows its label under the customer, and the status describes the microphone control',
    (id) => {
      const name = STATUS_FIXTURES[id];
      renderCall(name);
      const status = statusOf(name);
      const stage = screen.getByRole('region', { name: 'Customer' });
      const label = within(stage).getByText(status.label);
      expect(label).toBeVisible();
      // The label is in the paragraph the controls point at, so a dimmed control says why.
      const describedBy = label.closest('p')?.id;
      expect(describedBy).toBeTruthy();
      const talk = screen.getByRole('button', { name: /^(Talk|Done speaking|Return to voice)$/ });
      expect(talk).toHaveAttribute('aria-describedby', describedBy);
    },
  );

  it.each(BEFORE_THE_CALL)('%s is the microphone row of the step before the call', (id) => {
    const name = STATUS_FIXTURES[id];
    renderCall(name);
    const row = within(screen.getByRole('list', { name: 'What is ready' })).getByText('Microphone')
      .parentElement as HTMLElement;
    // The row says the same state in a word or two: the status line's label is for the call itself.
    expect(row).toHaveTextContent(statusOf(name).row);
  });

  it('keeps every status label to three words or fewer, and no two states share one', () => {
    const labels = STATUS_IDS.map((id) => statusOf(STATUS_FIXTURES[id]).label);
    for (const label of labels) expect(wordCount(label), label).toBeLessThanOrEqual(3);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('tells the four stages of a turn apart by words and by icon, never by colour alone', () => {
    const icons = new Map<string, string>();
    for (const id of [
      'listening',
      'processing-speech',
      'generating-reply',
      'customer-speaking',
    ] as const) {
      const status = statusOf(STATUS_FIXTURES[id]);
      icons.set(status.label, status.icon);
    }
    expect(new Set(icons.values()).size).toBe(4);
    expect(new Set(icons.keys()).size).toBe(4);
  });

  it('shows the customer ring and the current turn while the customer speaks, and no bouncing', () => {
    const { container } = renderCall('customer-speaking');
    expect(container.querySelector('.ff-avatar--speaking')).not.toBeNull();
    const current = container.querySelectorAll('[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Priya Raman');
    cleanup();
    renderCall('mic-ready');
    expect(document.querySelector('[aria-current="true"]')).toBeNull();
  });

  it('shows what the trainee said in the transcript while the customer is thinking', () => {
    renderCall('transcript-available');
    const log = screen.getByRole('log', { name: 'Call transcript' });
    expect(within(log).getByText(/Did anything change on those PCs/)).toBeInTheDocument();
    expect(within(log).getByText('Sending')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Customer' })).getByText('Customer is replying'),
    ).toBeVisible();
  });

  it('shows a message being transcribed as a placeholder in the transcript, with a shimmer and no percentage', () => {
    const { container } = renderCall('processing-speech');
    const log = screen.getByRole('log', { name: 'Call transcript' });
    expect(within(log).getByText('Transcribing')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Processing speech' })).not.toHaveAttribute(
      'aria-valuenow',
    );
    expect(container.textContent).not.toMatch(/\d+\s?%/);
  });

  it('shows the words the trainee is saying now, hidden from assistive technology', () => {
    const { container } = renderCall('speech-detected');
    const live = container.querySelector('.cw-interim');
    expect(live).toHaveAttribute('aria-hidden', 'true');
    expect(live).toHaveTextContent(/Can I check which headset model/);
    expect(
      within(screen.getByRole('log', { name: 'Call transcript' })).queryByText(/Can I check which/),
    ).toBeNull();
    renderCall('listening');
    expect(document.querySelectorAll('.cw-interim')).toHaveLength(1);
  });
});

describe('the layouts', () => {
  it('shows three columns at 80em and up: the customer, the transcript and the case', () => {
    renderCall('mic-ready', { width: WIDTH.wide });
    expect(screen.getByRole('region', { name: 'Customer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Transcript' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Case' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Case' })).toBeNull();
    // The controls are in the stage panel, not a dock.
    expect(screen.getByRole('group', { name: 'Call controls' }).closest('.cw-dock')).toBeNull();
  });

  it('moves the case into a sheet between 64em and 80em, opened from the bar', async () => {
    renderCall('mic-ready', { width: WIDTH.medium });
    expect(screen.queryByRole('heading', { level: 2, name: 'Case' })).toBeNull();
    const open = screen.getByRole('button', { name: 'Case' });
    expect(open).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('is one column below 64em, with the controls in a dock and the customer as a strip', () => {
    renderCall('mic-ready', { width: WIDTH.narrow });
    const controls = screen.getByRole('group', { name: 'Call controls' });
    expect(controls.closest('.cw-dock')).not.toBeNull();
    expect(document.querySelectorAll('[id="cw-controls"]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Case' })).toBeInTheDocument();
    expect(document.querySelector('.cw-person--compact')).not.toBeNull();
  });

  it('opens the case sheet from the bar and shows the same case as the column', async () => {
    renderCall('case-sheet', { width: WIDTH.medium });
    const dialog = screen.getByRole('dialog', { name: 'Case' });
    expect(within(dialog).getByText('Microsoft Teams')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Private notes' })).toBeInTheDocument();
  });

  it('keeps End call in the bar, last in its tab order, at every width', () => {
    for (const width of [WIDTH.narrow, WIDTH.medium, WIDTH.wide]) {
      const { unmount } = renderCall('mic-ready', { width });
      const buttons = within(document.querySelector('header') as HTMLElement).getAllByRole(
        'button',
      );
      expect(buttons[buttons.length - 1]).toHaveAccessibleName('End call');
      expect(screen.getAllByRole('button', { name: 'End call' })).toHaveLength(1);
      unmount();
    }
  });
});

describe('the top bar', () => {
  it('names the product, the scenario in full and a call timer that is never announced', () => {
    renderCall('mic-ready');
    const bar = document.querySelector('header') as HTMLElement;
    expect(within(bar).getByText('Microsoft Teams')).toBeInTheDocument();
    expect(within(bar).getByText('Meeting audio drops for one team')).toBeInTheDocument();
    expect(within(bar).getByText('Firefly')).toBeInTheDocument();
    const timer = within(bar).getByRole('timer', { name: 'Call time' });
    expect(timer).toHaveAttribute('aria-live', 'off');
    expect(timer.textContent).toMatch(/^\d+:\d{2}$/);
  });

  it('says Live, Reconnecting or Offline, and labels demo mode and a live model', () => {
    const bar = () => document.querySelector('header') as HTMLElement;
    renderCall('mic-ready');
    expect(within(bar()).getByText('Live')).toBeInTheDocument();
    expect(within(bar()).getByText('Demo mode')).toBeInTheDocument();
    cleanup();
    renderCall('live-model');
    expect(within(bar()).getByText('Live model')).toBeInTheDocument();
    expect(within(bar()).queryByText('Demo mode')).toBeNull();
    cleanup();
    renderCall('offline');
    expect(within(bar()).getByText('Offline')).toBeInTheDocument();
    cleanup();
    renderCall('reconnecting');
    expect(within(bar()).getByText('Reconnecting')).toBeInTheDocument();
  });

  it('shows no product for a call saved before scenarios named one, and guesses nothing', () => {
    renderCall('legacy-call');
    const bar = document.querySelector('header') as HTMLElement;
    expect(within(bar).queryByText(/Microsoft/)).toBeNull();
    expect(within(bar).getByText('Meeting audio drops for one team')).toBeInTheDocument();
  });
});

describe('the case', () => {
  const caseColumn = () => screen.getByRole('region', { name: 'Case' });

  it('shows the product, case reference, issue, impact, stage and objective, and what is found so far', () => {
    renderCall('guided-hints');
    const column = within(caseColumn());
    expect(column.getByText('Microsoft Teams')).toBeInTheDocument();
    expect(column.getByText('FX-20418')).toBeInTheDocument();
    expect(column.getByText('Synthetic')).toBeInTheDocument();
    expect(column.getByText(/Audio cuts out for several people/)).toBeInTheDocument();
    // Impact is the configured level's own line from the public brief.
    expect(column.getByText('Medium')).toBeInTheDocument();
    expect(column.getByText(/cannot hold its daily handover meeting/)).toBeInTheDocument();
    expect(column.getByText('First contact')).toBeInTheDocument();
    expect(column.getByText(/Find what changed, then agree a next step/)).toBeInTheDocument();
    expect(column.getByText('Context found').nextElementSibling).toHaveTextContent('3');
  });

  it('keeps the rest of the public brief behind "More context"', async () => {
    renderCall('mic-ready');
    const toggle = within(caseColumn()).getByRole('button', { name: 'More context' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(caseColumn()).getByText(/shared Windows desktop PCs/)).not.toBeVisible();
  });

  it('shows a count of what was found, never a total and never what it is', () => {
    renderCall('mic-ready');
    const found = within(caseColumn()).getByText('Context found').nextElementSibling;
    expect(found).toHaveTextContent(/^0$/);
    expect(caseColumn().textContent).not.toMatch(/of \d+|\/ ?\d+/);
  });

  it('adds the areas worth exploring only in guided practice', () => {
    renderCall('guided-hints');
    expect(within(caseColumn()).getByText('Areas to explore')).toBeInTheDocument();
    expect(within(caseColumn()).getByText('When it started')).toBeInTheDocument();
    cleanup();
    renderCall('mic-ready');
    expect(within(caseColumn()).queryByText('Areas to explore')).toBeNull();
  });

  it('falls back to the older goal and the impact description for a call with no public brief', () => {
    renderCall('legacy-call');
    const column = within(caseColumn());
    expect(column.queryByText('Product')).toBeNull();
    expect(column.queryByText('Case')).toBeNull();
    expect(column.getByText('Find what changed, then agree a next step.')).toBeInTheDocument();
    expect(column.getByText(/Several users or one team blocked/)).toBeInTheDocument();
  });

  it('has private notes that are only on this screen, with a label and a hint', () => {
    renderCall('notes');
    const notes = within(caseColumn()).getByRole('textbox', { name: 'Private notes' });
    expect(notes).toHaveValue('Driver 10.0.22621 updated Monday. Ask for the rollback plan.');
    expect(notes).toHaveAccessibleDescription('Only on this screen. Not saved or scored.');
  });

  it('is one named region that a keyboard can reach, because the column scrolls', () => {
    renderCall('mic-ready');
    expect(caseColumn()).toHaveAttribute('tabindex', '0');
  });

  it('shows no score, no hint about what to say and no hidden fact', () => {
    const { container } = renderCall('guided-hints');
    expect(container.textContent).not.toMatch(/\bscore\b|CARE|suggest|you should say|hidden/i);
  });
});

describe('landmarks and skip links', () => {
  it('has one h1, named for the customer, and headings that do not skip a level', () => {
    renderCall('mic-ready');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Call with Priya Raman' }),
    ).toBeInTheDocument();
    const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName[1]));
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    }
  });

  it('starts with a "Jump to" list: controls and transcript, and the reply box in a typed call', () => {
    renderCall('mic-ready');
    const jump = screen.getByRole('navigation', { name: 'Jump to' });
    expect(
      within(jump)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Jump to the call controls', 'Jump to the transcript']);
    cleanup();
    renderCall('text-fallback');
    expect(
      within(screen.getByRole('navigation', { name: 'Jump to' })).getByRole('link', {
        name: 'Jump to the reply box',
      }),
    ).toBeInTheDocument();
  });

  it('has no global character shortcuts: letters do nothing, a button is only pressed when focused', async () => {
    const { actions } = renderCall('mic-ready');
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.keyboard('tmpsrne');
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    // The keyboard starts on Talk, so the one press it takes is Talk's own.
    expect(screen.getByRole('button', { name: 'Talk' })).toHaveFocus();
    await user.keyboard(' ');
    expect(actions.talk).toHaveBeenCalledTimes(1);
  });
});

describe('what a screen reader hears', () => {
  it('reads the engine’s announcement once, as a whole sentence', () => {
    renderCall('customer-speaking');
    expect(announced()).toBe(
      'The customer is speaking. You can stop the customer audio at any time.',
    );
  });

  it('says a change of the customer’s state once, and never why', () => {
    const { update } = renderCall('state-calm');
    expect(announced()).toBe('');
    update(FIXTURES['state-frustrated'].snapshot);
    expect(announced()).toBe('The customer now seems frustrated.');
    for (const name of [
      'state-concerned',
      'state-frustrated',
      'state-angry',
      'state-escalating',
      'state-recovering',
    ] as const) {
      const { customerState, stateHistory } = FIXTURES[name].snapshot;
      expect(
        stateChangeSentence(describeCustomerState(customerState, stateHistory)!),
        name,
      ).not.toMatch(/because|since|after you|\d/i);
    }
  });

  it('says "recovering" when a customer who was angrier is easing', () => {
    const { update } = renderCall('state-angry');
    update(FIXTURES['state-recovering'].snapshot);
    expect(announced()).toBe('The customer seems to be recovering.');
  });

  it('says nothing when the state stays as it was, whatever else changes', () => {
    const { update } = renderCall('state-calm');
    update({ ...FIXTURES['state-calm'].snapshot, elapsedSeconds: 99, micLevel: 0.4 });
    expect(announced()).toBe('');
  });

  it('shows the new state in words and an icon, with the trend, and the label changes in place', () => {
    const { update } = renderCall('state-calm');
    const stage = () => screen.getByRole('region', { name: 'Customer' });
    expect(within(stage()).getByText('Calm')).toBeVisible();
    update(FIXTURES['state-escalating'].snapshot);
    expect(within(stage()).getByText('Escalating')).toBeVisible();
    expect(within(stage()).getByText('rising')).toBeInTheDocument();
    expect(stage().querySelector('.ff-status')).not.toBeNull();
  });

  it('never reads transcript text through the announcer: a new reply is the log’s to announce', () => {
    const { update } = renderCall('mic-ready');
    const next = snapshotOf('speech-detected');
    update({
      ...next,
      announcement: { id: 9, text: 'The customer is speaking.', politeness: 'polite' },
    });
    for (const turn of next.turns) expect(announced()).not.toContain(turn.text);
    const log = screen.getByRole('log', { name: 'Call transcript' });
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-relevant', 'additions');
  });

  it('keeps the status line plain text, not a live region, so nothing is read twice', () => {
    renderCall('listening');
    const label = within(screen.getByRole('region', { name: 'Customer' })).getByText('Listening');
    expect(label.closest('[aria-live]')).toBeNull();
    expect(label.closest('[role="status"]')).toBeNull();
  });
});

describe('the page states', () => {
  it('shows a skeleton while loading, with one heading', () => {
    renderCall('loading');
    expect(screen.getByRole('heading', { level: 1, name: 'Loading the call' })).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('explains a load failure and offers Retry and a way back', async () => {
    const { actions } = renderCall('load-error');
    expect(
      screen.getByRole('heading', { level: 1, name: 'This call could not be opened.' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing in the call was changed/)).toBeInTheDocument();
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(actions.retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Back to scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('says a call cannot be found, with no Retry, for a call that does not exist', () => {
    renderCall('unavailable');
    expect(
      screen.getByRole('heading', { level: 1, name: 'We could not find this call.' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to scenarios' })).toBeInTheDocument();
  });

  it('is never blank for a call that is already over', () => {
    renderCall('report-opening');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Opening your review' }),
    ).toBeInTheDocument();
  });
});

describe('copy budgets: no instructional text during a call', () => {
  const ALLOWED = ['cw-log', 'cw-case', 'cw-recovery', 'cw-turn', 'cw-interim'];

  it.each(WORKSPACE.filter((name) => !name.startsWith('end-')))(
    '%s has no paragraph of more than twelve words outside the transcript, the case and a problem',
    (name) => {
      const { container } = renderCall(name);
      for (const paragraph of container.querySelectorAll('p')) {
        if (paragraph.closest(ALLOWED.map((cls) => `.${cls}`).join(','))) continue;
        if (paragraph.closest('dialog')) continue;
        expect(
          wordCount(paragraph.textContent ?? ''),
          `${name}: ${paragraph.textContent}`,
        ).toBeLessThanOrEqual(12);
      }
    },
  );

  it('keeps every control label to three words or fewer', () => {
    renderCall('mic-ready');
    const controls = screen.getByRole('group', { name: 'Call controls' });
    for (const button of within(controls).getAllByRole('button')) {
      expect(wordCount(button.textContent ?? ''), button.textContent ?? '').toBeLessThanOrEqual(3);
    }
  });

  it('has no explanation of how the screen works anywhere in the workspace', () => {
    const { container } = renderCall('mic-ready');
    expect(container.textContent).not.toMatch(
      /press|click|you can|will appear|how it works|everything the customer says/i,
    );
  });
});

describe('the actions it is given', () => {
  it('is rendered with fresh fake actions each time', () => {
    const actions = fakeActions();
    renderCall('mic-ready', { actions });
    expect(actions.begin).not.toHaveBeenCalled();
  });
});
