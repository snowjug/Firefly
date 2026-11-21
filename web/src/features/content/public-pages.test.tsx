import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  expectHeadingOutline,
  expectLandmarks,
  expectLinksToResolve,
  expectNoForbiddenCopy,
  expectPicturesHaveAlternatives,
  mockConfig,
  pageWords,
  renderPublicPage,
} from './test-support.tsx';

// What every public page has to get right, whatever it says: one h1 and headings in order, the
// landmarks, links that go somewhere, pictures with words, and none of the language the product avoids.

const PAGES = [
  ['/', 'the landing page'],
  ['/responsible-ai', 'the Responsible AI page'],
  ['/about', 'the About page'],
  ['/no/such/page', 'the not-found page'],
] as const;

// The first test to visit each page compiles it; give a busy machine room.
vi.setConfig({ testTimeout: 30_000 });

describe.each(PAGES)('%s (%s)', (path) => {
  beforeEach(() => mockConfig());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('has one h1 and headings that never skip a level', async () => {
    await renderPublicPage(path);
    expectHeadingOutline();
  });

  it('has a header, a named navigation, main and a footer, with the skip link first', async () => {
    await renderPublicPage(path);
    expectLandmarks();
  });

  it('links only to pages, fragments and addresses that exist', async () => {
    await renderPublicPage(path);
    expectLinksToResolve(path);
  });

  it('gives every picture a text alternative, or hides it beside the same words', async () => {
    await renderPublicPage(path);
    expectPicturesHaveAlternatives(screen.getByRole('main'));
  });

  it('does not use the words and marks the product avoids', async () => {
    await renderPublicPage(path);
    expectNoForbiddenCopy(pageWords());
  });
});

describe('the copy guard', () => {
  it('notices each word and mark it is there to catch', () => {
    for (const text of [
      'An AI-powered coach',
      'Level up fast',
      'Supercharge your calls',
      'We revolutionise support',
      'Unlock your potential',
      'A game for support',
      'Earn a badge',
      'Collect points',
      'Keep your streak',
      'See the leaderboard',
      'Start now!',
      'A world-class tool',
      'Cutting-edge voice',
      'A seamless call',
      'Your learning journey',
      'Mastery of calls',
      'AI insights for every call',
      'A compliant tool',
      'Certified by Microsoft',
      'CBCF-aligned scoring',
      'Real-time emotion detection',
    ]) {
      expect(() => expectNoForbiddenCopy(text), text).toThrow();
    }
  });

  it('lets ordinary product language through', () => {
    expect(() => expectNoForbiddenCopy('Practise Microsoft support calls safely.')).not.toThrow();
    expect(() =>
      expectNoForbiddenCopy(
        'No compliance or certification claims. No official CBCF mapping is applied.',
      ),
    ).not.toThrow();
    expect(() =>
      expectNoForbiddenCopy(
        'Firefly does not analyse your voice for emotion, tone, accent or pace.',
      ),
    ).not.toThrow();
  });
});
