import { render, screen } from '@testing-library/react';
import { matchRoutes } from 'react-router';
import { expect, vi } from 'vitest';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import { App, AppProviders, appRoutes, createAppRouter } from '../../App.tsx';
import { ApiError, api } from '../../lib/api.ts';

// Shared by the tests of the three public pages: render a page through the real router, and check
// the things every page has to get right (headings, landmarks, links, pictures, words to avoid).

export const CONFIG: AppConfigDTO = {
  app: { name: 'Firefly', version: '0.1.0' },
  provider: { kind: 'mock', label: 'Demo mode (built-in rules engine)', demo: true, notice: null },
  speech: {
    provider: 'none',
    label: 'Not configured',
    demo: false,
    transcribe: false,
    synthesize: false,
    expressiveStyles: false,
    notice: null,
    limits: { maxAudioBytes: 1_500_000, maxAudioSeconds: 30, sampleRate: 16000 },
  },
  limits: { maxMessageChars: 1500, maxTraineeTurns: 60 },
  features: { devDiagnostics: false, testHooks: false },
};

/** Answers `/api/config` with this config, or fails the way an unreachable server does. */
export function mockConfig(config: AppConfigDTO | null = CONFIG) {
  vi.spyOn(api, 'config').mockImplementation(() =>
    config
      ? Promise.resolve(config)
      : Promise.reject(new ApiError(0, 'network', 'Cannot reach Firefly.', true)),
  );
}

/** Renders the real app at `path` and waits for the page (a lazy chunk) to arrive. */
export async function renderPublicPage(path: string) {
  window.scrollTo = vi.fn();
  const router = createAppRouter([path]);
  const view = render(
    <AppProviders>
      <App router={router} />
    </AppProviders>,
  );
  // The first visit to a page compiles its chunk, which can take a while on a busy machine.
  await screen.findByRole('heading', { level: 1 }, { timeout: 20_000 });
  return { ...view, router };
}

/** The levels of the headings in the page, in reading order. */
export function headingLevels(): number[] {
  return screen.getAllByRole('heading').map((heading) => Number(heading.tagName.slice(1)));
}

/** One h1, first, and no level skipped on the way down. */
export function expectHeadingOutline() {
  const levels = headingLevels();
  expect(levels.filter((level) => level === 1)).toHaveLength(1);
  expect(levels[0]).toBe(1);
  levels.forEach((level, index) => {
    if (index > 0)
      expect(level, `heading ${index + 1} skips a level`).toBeLessThanOrEqual(
        (levels[index - 1] ?? 0) + 1,
      );
  });
}

/** The landmarks a public page has: a header, a named navigation, main, and a footer. */
export function expectLandmarks() {
  expect(screen.getAllByRole('banner')).toHaveLength(1);
  expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  const main = screen.getByRole('main');
  expect(main).toHaveAttribute('id', 'main');
  const names = screen
    .getAllByRole('navigation')
    .map((nav) => nav.getAttribute('aria-label') ?? nav.getAttribute('aria-labelledby'));
  expect(names.every(Boolean), 'every navigation landmark has a name').toBe(true);
  expect(new Set(names).size, 'navigation names are unique').toBe(names.length);
  expect(document.querySelector('a[href]')).toHaveAttribute('href', '#main');
}

const EXTERNAL_HOSTS = new Set(['github.com', 'learn.microsoft.com', 'ai.google.dev']);

/**
 * Every link goes somewhere real: a fragment that names an element on the page, a path the router
 * has a page for (the catch-all does not count), or an https address on a host Firefly means to link to.
 */
export function expectLinksToResolve(currentPath: string) {
  const problems: string[] = [];
  const routes = (pathname: string) => {
    const matches = matchRoutes(appRoutes, pathname);
    return Boolean(matches && matches[matches.length - 1]?.route.path !== '*');
  };
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = anchor.getAttribute('href') ?? '';
    const label = `${anchor.textContent?.trim() ?? ''} -> ${href}`;
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      if (!id || !document.getElementById(id)) problems.push(`${label}: no element has that id`);
    } else if (href.startsWith('/')) {
      const url = new URL(href, 'http://firefly.test');
      if (!routes(url.pathname)) problems.push(`${label}: no page at that path`);
      if (url.hash && url.pathname === currentPath && !document.getElementById(url.hash.slice(1))) {
        problems.push(`${label}: no element has that id`);
      }
    } else if (href.startsWith('https://')) {
      const url = new URL(href);
      if (!EXTERNAL_HOSTS.has(url.hostname)) problems.push(`${label}: unexpected host`);
      if (anchor.getAttribute('target') === '_blank' && !/\bnoopener\b/.test(anchor.rel)) {
        problems.push(`${label}: opens a new tab without rel="noopener"`);
      }
    } else {
      problems.push(`${label}: not a route, a fragment or an https address`);
    }
  }
  expect(problems).toEqual([]);
}

/** Every picture has words for people who cannot see it, or is hidden and has them beside it. */
export function expectPicturesHaveAlternatives(root: HTMLElement = document.body) {
  expect(root.querySelectorAll('img, picture, canvas, video')).toHaveLength(0);
  for (const svg of root.querySelectorAll('svg')) {
    const hidden = svg.closest('[aria-hidden="true"]') !== null;
    const named = svg.getAttribute('role') === 'img' && Boolean(svg.getAttribute('aria-label'));
    expect(hidden || named, 'an svg is neither hidden nor named').toBe(true);
  }
  for (const picture of root.querySelectorAll('[role="img"]')) {
    const name = picture.getAttribute('aria-label') ?? picture.getAttribute('aria-labelledby');
    expect(name, 'an element with role="img" has no name').toBeTruthy();
  }
}

/** The words and marks the product never uses, as a page would show them. */
export const FORBIDDEN_COPY: readonly [string, RegExp][] = [
  ['AI-powered', /ai-powered/i],
  ['level up', /level up/i],
  ['supercharge', /supercharge/i],
  ['revolutionise', /revolutionis/i],
  ['revolutionize', /revolutioniz/i],
  ['unlock', /unlock/i],
  ['game', /game/i],
  ['badge', /badge/i],
  ['points', /points/i],
  ['streak', /streak/i],
  ['leaderboard', /leaderboard/i],
  ['an exclamation mark', /!/],
  ['world-class', /world-class/i],
  ['cutting-edge', /cutting-edge/i],
  ['seamless', /seamless/i],
  ['journey', /journey/i],
  ['mastery', /mastery/i],
];

/** Everything a person or a screen reader is given as words: text, names and descriptions. */
export function pageWords(root: HTMLElement = document.body): string {
  const words = [root.textContent ?? ''];
  for (const element of root.querySelectorAll('[aria-label], [title], [alt]')) {
    for (const attribute of ['aria-label', 'title', 'alt']) {
      const value = element.getAttribute(attribute);
      if (value) words.push(value);
    }
  }
  return words.join('\n');
}

export function expectNoForbiddenCopy(words: string) {
  const found = FORBIDDEN_COPY.filter(([, pattern]) => pattern.test(words)).map(([name]) => name);
  expect(found, `the page uses words the product does not use: ${found.join(', ')}`).toEqual([]);
}
