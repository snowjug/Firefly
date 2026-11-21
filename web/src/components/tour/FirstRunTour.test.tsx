import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSoundForTests } from '../../lib/sound.ts';
import { resetTourForTests } from '../../lib/tour.ts';
import { FirstRunTour } from './FirstRunTour.tsx';

function renderTour(onClose = vi.fn()) {
  const view = render(
    <MemoryRouter>
      <FirstRunTour open onClose={onClose} />
    </MemoryRouter>,
  );
  return { onClose, unmount: view.unmount };
}

const stored = () => JSON.parse(localStorage.getItem('firefly.tour') ?? 'null') as string | null;
const next = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /^Next/ }));
const presence = () => document.querySelector('.sig-presence') as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  resetTourForTests();
  resetSoundForTests();
});

describe('FirstRunTour', () => {
  it('opens as a labelled dialog on step one, with focus on Next, and says how long it is', () => {
    renderTour();
    const dialog = screen.getByRole('dialog', { name: 'A short tour of Firefly' });
    expect(dialog).toHaveAccessibleDescription(
      'Five small examples, under a minute. Skip any time.',
    );
    expect(within(dialog).getByText('Step 1 of 5')).toBeInTheDocument();
    const progress = within(dialog).getByRole('progressbar', { name: 'Tour progress' });
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    expect(progress).toHaveAttribute('aria-valuemax', '5');
    expect(progress).toHaveAttribute('aria-valuetext', 'Step 1 of 5');
    expect(
      within(dialog).getByRole('heading', { level: 3, name: 'Pick a practice call' }),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: /^Next/ })).toHaveFocus();
    // Nothing is decided until the person chooses: opening the tour never marks it seen.
    expect(stored()).toBeNull();
  });

  it('walks through five small working examples and back again', async () => {
    const user = userEvent.setup();
    renderTour();

    // 1. Pick a practice call: the example difficulty changes what the customer is like.
    expect(screen.getByRole('radio', { name: 'Starter' })).toBeChecked();
    expect(screen.getByText(/Calm and cooperative/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Challenge' }));
    expect(screen.getByRole('radio', { name: 'Challenge' })).toBeChecked();
    expect(screen.getByText(/High pressure and sure it is not their fault/)).toBeInTheDocument();
    expect(screen.queryByText(/Calm and cooperative/)).not.toBeInTheDocument();
    expect(screen.getByText(/real scenarios under/)).toHaveTextContent('Missions');
    await next(user);

    // 2. A good question brings out a hidden fact, and the instrument gains a lit signal.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Some things stay hidden' }),
    ).toHaveFocus();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.queryByText('Hidden fact found')).not.toBeInTheDocument();
    expect(presence().querySelector('.sig-dot.is-lit')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Have you tried restarting it?' }));
    expect(screen.queryByText('Hidden fact found')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'When did it start, and did anything change?' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Hidden fact found');
    expect(
      screen.getByRole('button', { name: 'When did it start, and did anything change?' }),
    ).toBeDisabled();
    expect(presence().querySelectorAll('.sig-dot.is-lit')).toHaveLength(1);
    await next(user);

    // 3. The customer reacts to what you say: words and the instrument both change.
    expect(screen.getByText('Choose a reply to see how the customer reacts.')).toBeInTheDocument();
    expect(presence()).toHaveAttribute('data-sig-mood', 'frustrated');
    await user.click(screen.getByRole('button', { name: /^I can hear how frustrating this is/ }));
    expect(screen.getByText(/The customer settles\./)).toBeInTheDocument();
    expect(presence()).toHaveAttribute('data-sig-mood', 'calm');
    await user.click(screen.getByRole('button', { name: 'That is not how it works.' }));
    expect(screen.getByText(/The customer gets more tense\./)).toBeInTheDocument();
    expect(presence()).toHaveAttribute('data-sig-mood', 'angry');
    expect(screen.getByRole('button', { name: 'That is not how it works.' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await next(user);

    // 4. Feedback quotes your own words, and is not a rating.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Feedback in your own words' }),
    ).toBeVisible();
    expect(screen.getByRole('figure')).toHaveTextContent(
      'When did it start, and did anything change?',
    );
    expect(screen.getByText(/not a performance rating/)).toBeInTheDocument();
    await next(user);

    // 5. Ready: practise, with sound off until asked for.
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Next/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Sound effects/ })).not.toBeChecked();
    expect(screen.getByRole('link', { name: /Start practising/ })).toHaveAttribute(
      'href',
      '/practice',
    );
    expect(screen.getByText(/nobody is ranked/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Tour progress' })).toHaveAttribute(
      'aria-valuenow',
      '4',
    );
  });

  it('points at the dock and the search, not at a sidebar that is no longer there', async () => {
    const user = userEvent.setup();
    renderTour();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/dock at the bottom of the screen/);
    expect(dialog).toHaveTextContent(/Ctrl or Cmd\+K/);
    for (let step = 0; step < 4; step++) {
      expect(dialog).not.toHaveTextContent(/sidebar|top bar/i);
      await next(user);
    }
    expect(dialog).not.toHaveTextContent(/sidebar|top bar/i);
  });

  it('can be skipped at any step, and a skip is remembered on this device', async () => {
    const user = userEvent.setup();
    const { onClose } = renderTour();
    await next(user);
    await user.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(stored()).toBe('skipped');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with Escape, which counts as a skip until the last step', async () => {
    const user = userEvent.setup();
    const { onClose } = renderTour();
    await next(user);
    await user.keyboard('{Escape}');
    expect(stored()).toBe('skipped');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('counts Escape on the last step as finishing it', async () => {
    const user = userEvent.setup();
    const { onClose } = renderTour();
    for (let step = 0; step < 4; step++) await next(user);
    await user.keyboard('{Escape}');
    expect(stored()).toBe('done');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the tour done when it is finished, whether by Done or by starting to practise', async () => {
    const user = userEvent.setup();
    const first = renderTour();
    for (let step = 0; step < 4; step++) await next(user);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(stored()).toBe('done');
    expect(first.onClose).toHaveBeenCalledTimes(1);

    localStorage.clear();
    resetTourForTests();
    first.unmount();
    const second = renderTour();
    for (let step = 0; step < 4; step++) await next(user);
    await user.click(screen.getByRole('link', { name: /Start practising/ }));
    expect(stored()).toBe('done');
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not forget that it was finished when someone replays it and skips', async () => {
    const user = userEvent.setup();
    localStorage.setItem('firefly.tour', JSON.stringify('done'));
    resetTourForTests();
    renderTour();
    await user.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(stored()).toBe('done');
  });

  it('starts again from the first step each time it is opened', async () => {
    const user = userEvent.setup();
    const first = renderTour();
    await next(user);
    await next(user);
    await user.click(screen.getByRole('button', { name: 'Skip tour' }));
    first.unmount();

    renderTour();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('turns sound on only when asked', async () => {
    const user = userEvent.setup();
    renderTour();
    for (let step = 0; step < 4; step++) await next(user);
    const sound = screen.getByRole('switch', { name: /Sound effects/ });
    expect(localStorage.getItem('firefly.sound')).toBeNull();
    await user.click(sound);
    await waitFor(() => expect(sound).toBeChecked());
    expect(localStorage.getItem('firefly.sound')).toBe('true');
  });
});
