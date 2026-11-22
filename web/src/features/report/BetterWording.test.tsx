import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { wordCount } from '#shared/domain/scenario.ts';
import { BetterWording, WORDING_WORDS } from './BetterWording.tsx';
import type { Wording } from './report-model.ts';
import {
  FakeIntersectionObserver,
  stubIntersectionObserver,
  stubMatchMedia,
} from './test-utils.tsx';

afterEach(cleanup);

const SAID: Wording = {
  state: 'said',
  original: 'Can you tell me exactly what you see in the meeting chat after a recording ends?',
  improved:
    'Can you tell me exactly what you see in the meeting chat, and confirm your organisation still has recording enabled?',
};

const group = () => screen.getByRole('group', { name: 'Better wording' });
/** The sentence on a line, without the words said only for a screen reader. */
const spoken = (line: 'before' | 'after') =>
  (group().querySelector(`.rp-bw__line--${line} .rp-bw__text`)?.textContent ?? '')
    .replace(/(Removed|Added): /g, '')
    .replace(/^\u201c|\u201d$/g, '');

describe('the better wording', () => {
  it('sets what was said above what could be said, and keeps both sentences whole', () => {
    render(<BetterWording wording={SAID} why="Confirming the setting finds the cause sooner." />);
    expect(within(group()).getByText('You said')).toBeInTheDocument();
    expect(within(group()).getByText('Try')).toBeInTheDocument();
    expect(spoken('before')).toBe(SAID.original);
    expect(spoken('after')).toBe(SAID.improved);
    expect(group()).toHaveTextContent('Confirming the setting finds the cause sooner.');
  });

  it('marks what went as removed and what came as added, with real elements and words for a screen reader', () => {
    render(<BetterWording wording={SAID} why="" />);
    const removed = [...group().querySelectorAll('del')];
    const added = [...group().querySelectorAll('ins')];
    expect(removed.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);
    for (const mark of removed) expect(mark.textContent).toMatch(/^Removed: /);
    for (const mark of added) expect(mark.textContent).toMatch(/^Added: /);
    expect(added.map((mark) => mark.textContent).join(' ')).toMatch(/confirm your organisation/);
    // What both sentences share is not marked.
    expect(group().querySelector('.rp-bw__line--before')?.textContent).toContain('Can you tell me');
    expect(removed.map((mark) => mark.textContent).join(' ')).not.toContain('Can you tell me');
  });

  it('has a key for the two marks that a screen reader does not hear', () => {
    render(<BetterWording wording={SAID} why="" />);
    const key = group().querySelector('.rp-bw__legend');
    expect(key).toHaveAttribute('aria-hidden', 'true');
    expect(key).toHaveTextContent('Removed');
    expect(key).toHaveTextContent('Added');
  });

  it('says nothing was said when the improvement is about something that never happened, and adds the whole sentence', () => {
    const wording: Wording = {
      state: 'omitted',
      original: null,
      improved: 'When did you first notice it, and did anything change around then?',
    };
    render(<BetterWording wording={wording} why="" />);
    expect(group()).toHaveTextContent('Not said in this call');
    expect(spoken('after')).toBe(wording.improved);
    expect(group().querySelector('del')).toBeNull();
    expect(group().querySelectorAll('.rp-bw__line--after ins').length).toBeGreaterThan(0);
    // The key names only the marks that are there: nothing was removed.
    const key = group().querySelector('.rp-bw__legend');
    expect(key).toHaveTextContent('Added');
    expect(key).not.toHaveTextContent('Removed');
  });

  it('names in the key only the marks that are drawn: words that were only added, or only removed', () => {
    const { unmount } = render(
      <BetterWording
        wording={{
          state: 'said',
          original: 'Can you tell me what you see?',
          improved: 'Can you tell me what you see in the meeting chat?',
        }}
        why=""
      />,
    );
    expect(group().querySelector('del')).toBeNull();
    expect(group().querySelector('.rp-bw__legend')).toHaveTextContent('Added');
    expect(group().querySelector('.rp-bw__legend')).not.toHaveTextContent('Removed');
    unmount();
    render(
      <BetterWording
        wording={{
          state: 'said',
          original: 'Can you tell me what you see in the meeting chat?',
          improved: 'Can you tell me what you see?',
        }}
        why=""
      />,
    );
    expect(group().querySelector('ins')).toBeNull();
    expect(group().querySelector('.rp-bw__legend')).toHaveTextContent('Removed');
    expect(group().querySelector('.rp-bw__legend')).not.toHaveTextContent('Added');
  });

  it('shows "Insufficient evidence" instead of words the transcript does not back, and no marks', () => {
    const wording: Wording = { state: 'unverified', original: null, improved: SAID.improved };
    render(<BetterWording wording={wording} why="" />);
    expect(group()).toHaveTextContent('Insufficient evidence');
    expect(group().querySelector('del')).toBeNull();
    expect(group().querySelector('ins')).toBeNull();
    expect(group().querySelector('.rp-bw__legend')).toBeNull();
    expect(spoken('after')).toBe(SAID.improved);
  });

  it('keeps the reason to its first words, and gives the rest behind Show more', async () => {
    const why = 'This wording is stronger because it asks for one specific thing. '
      .repeat(8)
      .trim();
    render(<BetterWording wording={SAID} why={why} />);
    const text = group().querySelector('.rp-bw__why') as HTMLElement;
    expect(wordCount(text.textContent ?? '')).toBeLessThanOrEqual(WORDING_WORDS);
    await userEvent.click(within(group()).getByRole('button', { name: 'Show more' }));
    expect(text).toHaveTextContent(why);
  });
});

describe('how the two lines arrive', () => {
  it('waits to be seen before it plays, and plays once it is', () => {
    const observer = stubIntersectionObserver();
    try {
      render(<BetterWording wording={SAID} why="" />);
      expect(group()).not.toHaveAttribute('data-revealed');
      const [watcher] = FakeIntersectionObserver.watching(group());
      act(() => {
        watcher?.reportElement(group(), true);
      });
      expect(group()).toHaveAttribute('data-revealed');
    } finally {
      observer.restore();
    }
  });

  it('is simply there under reduced motion, before it has been seen', () => {
    const observer = stubIntersectionObserver();
    const media = stubMatchMedia((query) => query.includes('prefers-reduced-motion: reduce'));
    try {
      render(<BetterWording wording={SAID} why="" />);
      expect(group()).toHaveAttribute('data-revealed');
    } finally {
      media();
      observer.restore();
    }
  });
});
