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
      screen.getByRole('heading', { level: 1, name: /Practice real conversations/ }),
    ).toBeInTheDocument();
    expect(document.title).toMatch(/Firefly/);

    const getStarted = screen.getAllByRole('link', { name: /Get started/ })[0];
    expect(getStarted).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
  });

  it('sends someone who already has a profile straight to their dashboard', () => {
    saveProfile({ name: 'Priya' });
    renderLanding();
    expect(screen.getAllByRole('link', { name: /Open your dashboard/ })[0]).toHaveAttribute(
      'href',
      '/home',
    );
    expect(screen.getByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', '/home');
    expect(screen.queryByRole('link', { name: /Get started/ })).not.toBeInTheDocument();
  });

  it('has the sections its navigation points at', () => {
    const { container } = renderLanding();
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    for (const link of within(nav).getAllByRole('link')) {
      const target = link.getAttribute('href')?.slice(1) ?? '';
      expect(container.querySelector(`#${target}`), `section for ${target}`).not.toBeNull();
    }
  });

  it('lists the six coaching skills and the five steps', () => {
    renderLanding();
    for (const skill of [
      'Opening & Rapport',
      'Scoping & Discovery',
      'Empathy & De-escalation',
      'Clarity',
      'Ownership & Next Steps',
      'Closing',
    ]) {
      expect(screen.getByText(skill)).toBeInTheDocument();
    }
    const steps = screen.getByRole('heading', { name: /Five steps/ }).closest('section');
    expect(within(steps as HTMLElement).getAllByRole('listitem')).toHaveLength(5);
  });

  it('is honest: a training aid, fictional customers, no ranking, and no claim that AI is behind it', () => {
    const { container } = renderLanding();
    const text = container.textContent ?? '';
    expect(text).toMatch(/training aid, not an assessment/i);
    expect(text).toMatch(/Every scenario and customer is fictional/);
    expect(text).toMatch(/never ranked/);
    expect(text).toMatch(/built-in simulation or a live model/);
    expect(text).not.toMatch(/AI-powered/i);
    expect(text).not.toMatch(/\bXP\b/);
  });

  it('keeps its decoration out of the accessibility tree and its external link safe', () => {
    const { container } = renderLanding();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const source = screen.getByRole('link', { name: 'Source on GitHub' });
    expect(source).toHaveAttribute('href', 'https://github.com/snowjug/Firefly');
    expect(source).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(container.querySelector('main#main')).not.toBeNull();
    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelector('footer')).not.toBeNull();
  });
});
