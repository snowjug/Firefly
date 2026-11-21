import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import Landing from '../../pages/Landing.tsx';
import {
  expectNoForbiddenCopy,
  mockConfig,
  pageWords,
  renderPublicPage,
  visibleText,
  visibleWords,
} from '../content/test-support.tsx';
import { COVERAGE, EVIDENCE, FINAL_TITLE, HERO, RESPONSIBLE_NOTE, STEPS } from './landing-copy.ts';
import { PREVIEW_CALLS } from './preview-data.ts';
import { LANDING_TITLE } from './use-landing-title.ts';

// The first test to visit the page compiles it; give a busy machine room.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

describe('the landing page: copy budgets, counted from what is on screen', () => {
  it('has a hero title of at most nine words', () => {
    renderLanding();
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent(HERO.title);
    expect(visibleWords(title)).toBeLessThanOrEqual(9);
  });

  it('has a supporting line of at most eighteen words, which describes the hero', () => {
    renderLanding();
    const hero = screen.getByRole('region', { name: HERO.title });
    const lead = document.getElementById(hero.getAttribute('aria-describedby') ?? '');
    expect(lead).toHaveTextContent(HERO.lead);
    expect(visibleWords(lead as HTMLElement)).toBeLessThanOrEqual(18);
  });

  it('has a primary button of at most three words, going to the scenarios', () => {
    renderLanding();
    const hero = screen.getByRole('region', { name: HERO.title });
    const primary = within(hero).getByRole('link', { name: HERO.primary });
    expect(visibleWords(primary)).toBeLessThanOrEqual(3);
    expect(primary).toHaveAttribute('href', '/scenarios');
    expect(within(hero).getByRole('link', { name: HERO.secondary })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('explains the call in three steps of at most eight words each, in an ordered list', () => {
    renderLanding();
    const region = screen.getByRole('region', { name: 'How it works' });
    const list = within(region).getByRole('list');
    expect(list.tagName).toBe('OL');
    const steps = within(list).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    steps.forEach((step, index) => {
      expect(visibleText(step)).toBe(`${STEPS[index]?.title} ${STEPS[index]?.text}`);
      expect(visibleWords(step)).toBeLessThanOrEqual(8);
    });
  });

  it('keeps the responsible-use note to at most 24 words plus "Learn more"', () => {
    renderLanding();
    const region = screen.getByRole('region', { name: 'Responsible use' });
    const note = within(region).getByText(RESPONSIBLE_NOTE);
    expect(visibleWords(note)).toBeLessThanOrEqual(24);
    const more = within(region).getByRole('link', { name: 'Learn more about responsible AI' });
    expect(visibleText(more)).toBe('Learn more');
    expect(more).toHaveAttribute('href', '/responsible-ai');
    expect(visibleWords(region)).toBeLessThanOrEqual(26);
  });

  it('says much less than the page it replaced (686 words in the main area)', () => {
    const { container } = renderLanding();
    expect(visibleWords(container)).toBeLessThan(260);
  });
});

describe('the landing page: what is on it', () => {
  beforeEach(() => mockConfig());

  it('is titled for the product and sets its own document title', async () => {
    await renderPublicPage('/');
    expect(LANDING_TITLE).toBe('Firefly: practise Microsoft support calls');
    await waitFor(() => expect(document.title).toBe(LANDING_TITLE));
  });

  it('has one h1, then a heading for each part, in order, each part a named region', async () => {
    await renderPublicPage('/');
    expect(
      screen.getAllByRole('heading').map((heading) => [heading.tagName, heading.textContent]),
    ).toEqual([
      ['H1', HERO.title],
      ['H2', 'How it works'],
      ['H2', 'Microsoft products'],
      ['H2', 'Coaching evidence'],
      ['H2', FINAL_TITLE],
    ]);
    expect(screen.getAllByRole('region')).toHaveLength(6);
    expect(screen.getByRole('region', { name: 'Responsible use' })).toBeInTheDocument();
  });

  it('puts "Start call" in the header, the hero and the end, and every one goes to the scenarios', async () => {
    await renderPublicPage('/');
    const links = screen.getAllByRole('link', { name: HERO.primary });
    expect(links).toHaveLength(3);
    for (const link of links) expect(link).toHaveAttribute('href', '/scenarios');
    expect(within(screen.getByRole('banner')).getByRole('link', { name: HERO.primary })).toBe(
      links[0],
    );
    expect(
      within(screen.getByRole('region', { name: FINAL_TITLE })).getByRole('link', {
        name: HERO.primary,
      }),
    ).toBe(links[2]);
  });

  it('names the eight Microsoft products as text with a neutral mark, and shows no logo or picture', async () => {
    await renderPublicPage('/');
    const region = screen.getByRole('region', { name: 'Microsoft products' });
    const items = within(region).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(COVERAGE.map(({ label }) => label));
    expect(items.map((item) => item.textContent)).toEqual([
      'Teams',
      'Outlook',
      'Entra ID',
      'OneDrive',
      'SharePoint',
      'Windows',
      'Azure',
      'Intune',
    ]);
    for (const item of items)
      expect(item.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(region.querySelectorAll('img, picture, canvas, video')).toHaveLength(0);
  });

  it('shows one piece of coaching evidence: what you said, and what the coaching made of it', async () => {
    await renderPublicPage('/');
    const region = screen.getByRole('region', { name: 'Coaching evidence' });
    expect(within(region).getByText('You said')).toBeVisible();
    expect(within(region).getByText(/I\u2019ll own this and update you by 3 PM\./)).toBeVisible();
    expect(within(region).getByText('Coaching')).toBeVisible();
    expect(within(region).getByText('Clear owner and update time.')).toBeVisible();
    expect(EVIDENCE.said).toBe('I\u2019ll own this and update you by 3 PM.');
    expect(within(region).getByText(DIMENSIONS[EVIDENCE.skill].label)).toBeVisible();
  });

  it('is honest: synthetic, practice coaching, and none of the claims the product does not make', async () => {
    await renderPublicPage('/');
    const words = pageWords();
    expectNoForbiddenCopy(words);
    expect(words).toMatch(/Example call\. The customer is synthetic\./);
    expect(words).toMatch(/Synthetic scenarios only\. Coaching, not performance assessment\./);
    expect(words).not.toMatch(/real customer|real person|guarantee|certif|CBCF/i);
  });
});

describe('the call preview', () => {
  it('shows an active call: the product, who is speaking, how they feel, the words so far and a first look at the coaching', () => {
    renderLanding();
    const panel = screen.getByRole('tabpanel', { name: 'Teams' });
    const call = PREVIEW_CALLS[0];
    expect(call).toBeDefined();
    expect(within(panel).getByText('Microsoft Teams')).toBeVisible();
    expect(within(panel).getByText('Customer speaking')).toBeVisible();
    expect(within(panel).getByText('Maya Okafor', { selector: 'p' })).toBeVisible();
    expect(within(panel).getByText('Concerned')).toBeVisible();
    const turns = within(panel).getAllByRole('listitem').slice(0, 2);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toHaveTextContent('Maya Okafor 0:08');
    expect(turns[1]).toHaveTextContent('You 0:21');
    const scores = within(panel).getAllByRole('listitem').slice(2);
    expect(scores.map((row) => row.textContent)).toEqual([
      'Opening4 of 5Strong',
      'Discovery5 of 5Excellent',
      'Empathy3 of 5Developing',
    ]);
    expect(screen.getByText('Example call. The customer is synthetic.')).toBeVisible();
  });

  it('is made of real components: tabs, text and decorative drawings, never a picture of a screen', () => {
    const { container } = renderLanding();
    expect(container.querySelectorAll('img, picture, canvas, video')).toHaveLength(0);
    for (const svg of container.querySelectorAll('svg')) {
      expect(
        svg.closest('[aria-hidden="true"]'),
        'an svg is exposed to assistive technology',
      ).not.toBeNull();
    }
    expect(screen.getByRole('tablist', { name: 'Example calls by product' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Teams',
      'Outlook',
      'Entra ID',
    ]);
  });

  it('switches product by click and by arrow key, and only the chosen call is exposed', async () => {
    const user = userEvent.setup();
    renderLanding();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    await user.click(screen.getByRole('tab', { name: 'Teams' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Outlook', selected: true })).toHaveFocus();
    const outlook = screen.getByRole('tabpanel', { name: 'Outlook' });
    expect(within(outlook).getByText('Daniel Reyes', { selector: 'p' })).toBeVisible();
    expect(within(outlook).getByText('Frustrated')).toBeVisible();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    await user.click(screen.getByRole('tab', { name: 'Entra ID' }));
    const entra = screen.getByRole('tabpanel', { name: 'Entra ID' });
    expect(within(entra).getByText('Microsoft Entra ID')).toBeVisible();
    expect(within(entra).getByText('Recovering')).toBeVisible();
  });

  it('keeps every panel in the layout, so a change of tab cannot move what is below it', () => {
    renderLanding();
    const panels = document.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(PREVIEW_CALLS.length);
    expect(document.querySelectorAll('[role="tabpanel"][data-selected]')).toHaveLength(1);
  });

  it('keeps each example short, and fictional', () => {
    for (const call of PREVIEW_CALLS) {
      for (const turn of call.turns) {
        expect(turn.text.split(/\s+/).length, turn.text).toBeLessThanOrEqual(16);
      }
      expect(call.scores).toHaveLength(3);
    }
  });
});

describe('the landing page without a server', () => {
  it('renders at once and asks the network for nothing', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('the landing page motion', () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const preview = read('web/src/features/landing/call-preview.css');
  const tokens = read('web/src/design/tokens.css');
  const token = (name: string) => Number(new RegExp(`--${name}:\\s*(\\d+)ms`).exec(tokens)?.[1]);

  /** The text of the blocks that open with the given at-rule. */
  function block(css: string, opener: string): string {
    const start = css.indexOf(opener);
    if (start < 0) return '';
    let depth = 0;
    for (let index = css.indexOf('{', start); index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      if (css[index] === '}' && --depth === 0) return css.slice(start, index + 1);
    }
    return '';
  }

  it('swings the waveform only for people who have not asked for less motion', () => {
    const allowed = block(preview, '@media (prefers-reduced-motion: no-preference)');
    expect(allowed).toMatch(/animation:\s*cp-swing/);
    expect(preview.replace(allowed, '')).not.toMatch(/animation\s*:|transition\s*:/);
  });

  it('starts when a panel is selected, so choosing a product plays it again', () => {
    expect(block(preview, '@media (prefers-reduced-motion: no-preference)')).toMatch(
      /\.cp__panel\[data-selected\] \.cp__bar/,
    );
  });

  it('ends by itself in under five seconds, so nothing on the page needs a pause control', () => {
    expect(preview).not.toMatch(/infinite/);
    const iterations = Number(
      /animation:\s*cp-swing\s+var\(--dur-wave\)\s+var\(--ease-easy\)\s+(\d+)/.exec(preview)?.[1],
    );
    const stagger = [
      ...preview.matchAll(
        /animation-delay:\s*(?:calc\(var\(--dur-instant\) \* (\d+)\)|var\(--dur-instant\))/g,
      ),
    ].map((match) => Number(match[1] ?? 1));
    const total = iterations * token('dur-wave') + Math.max(0, ...stagger) * token('dur-instant');
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(5000);
  });

  it('moves the hero action by transform only: it compresses 1 to 2 px and the arrow leans', () => {
    const buttons = read('web/src/design/primitives/button.css');
    expect(buttons).toMatch(
      /\.ff-button:active:not\([^)]*\)\s*\{[^}]*transform:\s*translateY\(var\(--press-shift\)\)/,
    );
    expect(buttons).toMatch(/\.ff-button--nudge:focus-visible \.ff-icon\s*\{[^}]*translateX/);
    expect(buttons).toMatch(/@media \(hover: hover\)\s*\{\s*\.ff-button--nudge:hover \.ff-icon/);
    expect(buttons).toMatch(/\.ff-button--nudge:active \.ff-icon\s*\{[^}]*translateX/);
    expect(tokens).toMatch(/--press-shift:\s*1px/);
    expect(tokens).toMatch(/--press-shift-lg:\s*2px/);
  });
});
