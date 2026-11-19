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
    expect(within(dialog).getByRole('progressbar', { name: 'Tour progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
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
    expect(screen.getByText(/Calm and cooperative/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Challenge' }));
    expect(screen.getByText(/High pressure and sure it is not their fault/)).toBeInTheDocument();
    expect(screen.getByText(/real scenarios under/)).toHaveTextContent('Practice');
    await next(user);

    // 2. A good question brings out a hidden fact.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Some things stay hidden' }),
    ).toHaveFocus();
    expect(screen.queryByText('Hidden fact found')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Have you tried restarting it?' }));
    expect(screen.queryByText('Hidden fact found')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'When did it start, and did anything change?' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Hidden fact found');
    expect(
      screen.getByRole('button', { name: 'When did it start, and did anything change?' }),
    ).toBeDisabled();
    await next(user);

    // 3. The customer reacts to what you say.
    expect(screen.getByText('Choose a reply to see how the customer reacts.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^I can hear how frustrating this is/ }));
    expect(screen.getByText(/The customer settles\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'That is not how it works.' }));
    expect(screen.getByText(/The customer gets more tense\./)).toBeInTheDocument();
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

  it('turns sound on only when asked', async () => {
    const user = userEvent.setup();
    renderTour();
    for (let step = 0; step < 4; step++) await next(user);
    const sound = screen.getByRole('switch', { name: /Sound effects/ });
    await user.click(sound);
    await waitFor(() => expect(sound).toBeChecked());
    expect(localStorage.getItem('firefly.sound')).toBe('true');
  });
});
