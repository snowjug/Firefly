import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetProfileForTests, saveProfile } from '../lib/profile.ts';
import Landing from './Landing.tsx';

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetProfileForTests();
});

describe('Landing', () => {
  it('says what Firefly is, with one top-level heading and a way to start', () => {
    renderLanding();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Practice difficult customer conversations before they become real ones.',
      }),
    ).toBeInTheDocument();
    expect(document.title).toMatch(/Firefly/);
    expect(
      screen.getByText(/practice environment for customer-facing support conversations/),
    ).toBeInTheDocument();

    const begin = screen.getAllByRole('link', { name: 'Begin' })[0];
    expect(begin).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'How a call goes' })).toHaveAttribute(
      'href',
      '#how-a-call-goes',
    );
  });

  it('has one primary way in, which is the same wherever it is repeated', () => {
    renderLanding();
    for (const link of screen.getAllByRole('link', { name: 'Begin' })) {
      expect(link).toHaveAttribute('href', '/sign-in');
      expect(link).toHaveClass('action');
    }
    expect(screen.queryByRole('link', { name: /Sign in|Get started/ })).not.toBeInTheDocument();
  });

  it('sends someone who already has a profile straight to their dashboard', () => {
    saveProfile({ name: 'Priya Raman' });
    renderLanding();
    for (const link of screen.getAllByRole('link', { name: 'Continue' })) {
      expect(link).toHaveAttribute('href', '/home');
    }
    expect(screen.queryByRole('link', { name: 'Begin' })).not.toBeInTheDocument();
    expect(screen.getByText('Welcome back, Priya')).toBeInTheDocument();
  });

  it('has the section its in-page link points at, and the other sections it promises', () => {
    const { container } = renderLanding();
    expect(container.querySelector('#how-a-call-goes')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'How a call goes' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'What Firefly is not' })).toBeVisible();
  });

  it('lists the six coaching skills and the five steps', () => {
    renderLanding();
    const steps = screen.getByRole('heading', { name: 'How a call goes' }).closest('section');
    const list = within(steps as HTMLElement).getAllByRole('list')[0] as HTMLElement;
    expect(
      within(list)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Configure', 'Simulate', 'Adapt', 'Evaluate', 'Improve']);
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);

    const skills = within(steps as HTMLElement).getByRole('list', {
      name: 'What the report looks at',
    });
    expect(
      within(skills)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Opening & Rapport',
      'Scoping & Discovery',
      'Empathy & De-escalation',
      'Clarity',
      'Ownership & Next Steps',
      'Closing',
    ]);
  });

  it('is honest: a training aid, fictional customers, no ranking, and no claim that AI is behind it', () => {
    const { container } = renderLanding();
    const text = container.textContent ?? '';
    expect(text).toMatch(/Firefly is a training aid/);
    expect(text).toMatch(/Not an assessment/);
    expect(text).toMatch(/Every scenario and customer is fictional/);
    expect(text).toMatch(/never ranked/);
    expect(text).toMatch(/built-in simulation or a live model/);
    expect(text).toMatch(/There is no password and no organisation sign-in/);
    expect(text).not.toMatch(/AI-powered/i);
    expect(text).not.toMatch(/\bXP\b/);
    expect(text).not.toMatch(/Microsoft/);
    // The training-aid line is the colophon, word for word.
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Firefly is a training aid. Scenarios are fictional; never enter real customer information. Scores are for practice, not performance reviews.',
    );
  });

  it('leaves the banner to the frame, keeps its decoration out of the accessibility tree and its external link safe', () => {
    const { container } = renderLanding();
    // The public frame draws the wordmark and the controls; the page must not add a second banner.
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(container.querySelector('header.masthead, .lp-header')).toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img')).toHaveAccessibleName(/signal instrument/i);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');

    const source = screen.getByRole('link', { name: /Source on GitHub/ });
    expect(source).toHaveAttribute('href', 'https://github.com/snowjug/Firefly');
    expect(source).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(source).toHaveAttribute('target', '_blank');
    expect(source).toHaveAccessibleName(/opens in a new tab/);
  });

  it('puts the statement and the way in on the page from the first frame, with no gate on motion', () => {
    const { container } = renderLanding();
    // Nothing is hidden or faded in by script: the words are there, focusable links included.
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toBeVisible();
    expect(container.querySelector('[hidden], [aria-hidden="false"][style*="opacity"]')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Begin' })[0]).toBeVisible();
  });
});
