import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_IDS } from '#shared/domain/vocab.ts';
import { api } from '../../lib/api.ts';
import Landing from '../../pages/Landing.tsx';
import {
  expectHeadingOutline,
  expectLandmarks,
  expectLinksToResolve,
  expectNoForbiddenCopy,
  expectPicturesHaveAlternatives,
  mockConfig,
  pageWords,
  renderPublicPage,
  visibleText,
  visibleWords,
} from '../content/test-support.tsx';
import {
  FEATURED,
  FEATURED_ID,
  FINAL_TITLE,
  HERO,
  HERO_LEAD_KEEP,
  REPORT_PREVIEW,
  RESPONSIBLE_NOTE,
  STEPS,
} from './landing-copy.ts';
import { makeScenario } from './test-utils.ts';
import { LANDING_TITLE } from './use-landing-title.ts';

// The first test to visit the page compiles it; give a busy machine room.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const LIBRARY = PRODUCT_IDS.map((product) => makeScenario(`${product}-a`, product));

/** The landing page on its own, with the scenarios still on their way. */
function renderLanding() {
  vi.spyOn(api, 'scenarios').mockReturnValue(new Promise(() => undefined));
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
    expect(HERO.title).toBe('Practise Microsoft support calls safely.');
    expect(visibleWords(title)).toBeLessThanOrEqual(9);
  });

  it('has one short supporting line of at most eighteen words, which describes the hero', () => {
    renderLanding();
    const hero = screen.getByRole('region', { name: HERO.title });
    const lead = document.getElementById(hero.getAttribute('aria-describedby') ?? '');
    expect(lead).toHaveTextContent(
      'Speak with a realistic customer. Review evidence-based coaching after the call.',
    );
    expect(visibleWords(lead as HTMLElement)).toBeLessThanOrEqual(18);
  });

  it('keeps "evidence-based" in one piece, so no line of the supporting line ends at its hyphen', () => {
    renderLanding();
    const lead = document.getElementById('lp-hero-lead') as HTMLElement;
    expect(lead.querySelectorAll('.lp-hero__keep')).toHaveLength(1);
    expect(lead.querySelector('.lp-hero__keep')).toHaveTextContent(HERO_LEAD_KEEP);
    expect(HERO.lead).toContain(HERO_LEAD_KEEP);
  });

  it('has two actions of at most three words: "Start call" to the scenarios, "Explore scenarios" to the featured ones', () => {
    renderLanding();
    const hero = screen.getByRole('region', { name: HERO.title });
    const primary = within(hero).getByRole('link', { name: 'Start call' });
    const secondary = within(hero).getByRole('link', { name: 'Explore scenarios' });
    expect(visibleWords(primary)).toBeLessThanOrEqual(3);
    expect(visibleWords(secondary)).toBeLessThanOrEqual(3);
    expect(primary).toHaveAttribute('href', '/scenarios');
    expect(secondary).toHaveAttribute('href', `/#${FEATURED_ID}`);
  });

  it('has two to three words for the featured heading and one short line under it', () => {
    renderLanding();
    const section = screen.getByRole('region', { name: FEATURED.title });
    expect(visibleWords(within(section).getByRole('heading', { level: 2 }))).toBeLessThanOrEqual(3);
    expect(visibleWords(within(section).getByText(FEATURED.lead))).toBeLessThanOrEqual(18);
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
    expect(STEPS.map((step) => step.title)).toEqual([
      'Choose scenario',
      'Speak naturally',
      'Review coaching',
    ]);
  });

  it('numbers the steps 1, 2 and 3 for the eye, in marks that assistive technology skips (the list already counts)', () => {
    renderLanding();
    const list = within(screen.getByRole('region', { name: 'How it works' })).getByRole('list');
    const marks = [...list.querySelectorAll('.lp-step__number')];
    expect(marks.map((mark) => mark.textContent)).toEqual(['1', '2', '3']);
    for (const mark of marks) expect(mark).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the report preview’s own words to one short line under its heading', () => {
    renderLanding();
    const region = screen.getByRole('region', { name: REPORT_PREVIEW.title });
    expect(visibleWords(within(region).getByText(REPORT_PREVIEW.lead))).toBeLessThanOrEqual(18);
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

  it('says little: the page’s own words, without the scenario cards, stay under a budget', () => {
    const { container } = renderLanding();
    expect(visibleWords(container)).toBeLessThan(420);
  });
});

describe('the landing page: what is on it', () => {
  beforeEach(() => {
    mockConfig();
    vi.spyOn(api, 'scenarios').mockResolvedValue(LIBRARY);
  });

  it('is titled for the product and sets its own document title', async () => {
    await renderPublicPage('/');
    expect(LANDING_TITLE).toBe('Firefly: practise Microsoft support calls');
    await vi.waitFor(() => expect(document.title).toBe(LANDING_TITLE));
  });

  it('has one h1, then a heading for each part in order, with no level skipped', async () => {
    await renderPublicPage('/');
    expect(
      screen.getAllByRole('heading').map((heading) => [heading.tagName, heading.textContent]),
    ).toEqual([
      ['H1', HERO.title],
      ['H2', 'Featured scenarios'],
      ['H2', 'How it works'],
      ['H2', 'Coaching evidence'],
      ['H2', FINAL_TITLE],
    ]);
    expectHeadingOutline();
  });

  it('is seven parts in the order the brief asks for: hero, call preview, featured, steps, report, note, last action', async () => {
    await renderPublicPage('/');
    const main = screen.getByRole('main');
    const where = (element: HTMLElement) => [...main.querySelectorAll('*')].indexOf(element);
    const hero = screen.getByRole('region', { name: HERO.title });
    const preview = within(hero).getByRole('figure', {
      name: 'Example call. The customer is synthetic.',
    });
    const featured = screen.getByRole('region', { name: FEATURED.title });
    const steps = screen.getByRole('region', { name: 'How it works' });
    const report = screen.getByRole('region', { name: REPORT_PREVIEW.title });
    const note = screen.getByRole('region', { name: 'Responsible use' });
    const last = screen.getByRole('region', { name: FINAL_TITLE });
    const order = [hero, preview, featured, steps, report, note, last].map(where);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(7);
  });

  it('puts the gallery of featured scenarios inside its section once the scenarios arrive', async () => {
    await renderPublicPage('/');
    const featured = screen.getByRole('region', { name: FEATURED.title });
    // The gallery is its own chunk: the first visit compiles it.
    expect(
      await within(featured).findByRole('region', { name: 'Scenario cards' }, { timeout: 20_000 }),
    ).toBeVisible();
    expect(featured).toHaveAttribute('id', FEATURED_ID);
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

  it('makes the hero’s "Start call" the first thing a keyboard reaches in the main area', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/');
    screen.getByRole('main').focus();
    await user.tab();
    expect(document.activeElement).toBe(
      within(screen.getByRole('region', { name: HERO.title })).getByRole('link', {
        name: HERO.primary,
      }),
    );
  });

  it('moves focus to the featured section when "Explore scenarios" is followed, so the next thing read is its heading', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    await renderPublicPage('/');
    await user.click(screen.getByRole('link', { name: HERO.secondary }));
    await vi.waitFor(() => expect(document.activeElement?.id).toBe(FEATURED_ID));
    expect(screen.getByRole('region', { name: FEATURED.title })).toBe(document.activeElement);
  });

  it('has landmarks, links that go somewhere real, and no picture of anything', async () => {
    await renderPublicPage('/');
    await screen.findByRole('region', { name: 'Scenario cards' }, { timeout: 20_000 });
    expectLandmarks();
    expectLinksToResolve('/');
    expectPicturesHaveAlternatives();
  });

  it('is honest: synthetic, practice coaching, and none of the claims the product does not make', async () => {
    await renderPublicPage('/');
    const words = pageWords();
    expectNoForbiddenCopy(words);
    expect(words).toMatch(/Example call\. The customer is synthetic\./);
    expect(words).toMatch(/Example report\. Synthetic call\./);
    expect(words).toMatch(/Synthetic scenarios only\. Coaching, not performance assessment\./);
    expect(words).not.toMatch(/real customer|real person|guarantee|certif|CBCF/i);
  });
});

describe('the landing page and the server', () => {
  it('renders at once, and the only thing it asks the scenarios API for is the featured scenarios, once', () => {
    const scenarios = vi.spyOn(api, 'scenarios').mockReturnValue(new Promise(() => undefined));
    const config = vi.spyOn(api, 'config');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    expect(scenarios).toHaveBeenCalledTimes(1);
    expect(config).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never waits for them: with the request failing, every other part of the page is there', async () => {
    vi.spyOn(api, 'scenarios').mockRejectedValue(new Error('no server'));
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    expect(await screen.findByText(FEATURED.failed)).toBeVisible();
    for (const name of [
      HERO.title,
      'How it works',
      REPORT_PREVIEW.title,
      'Responsible use',
      FINAL_TITLE,
    ]) {
      expect(screen.getByRole('region', { name })).toBeVisible();
    }
    expect(
      screen.getByRole('figure', { name: 'Example call. The customer is synthetic.' }),
    ).toBeVisible();
  });
});

describe('the landing page’s stylesheets', () => {
  const folder = join(process.cwd(), 'web/src/features/landing');
  const stripped = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const sheets = readdirSync(folder)
    .filter((name) => name.endsWith('.css'))
    .map((name) => ({ name, css: stripped(join(folder, name)) }));
  const sheet = (name: string) => sheets.find((item) => item.name === name)?.css ?? '';
  const tokens = stripped(join(process.cwd(), 'web/src/design/tokens.css'));
  const token = (name: string) => Number(new RegExp(`--${name}:\\s*(\\d+)ms`).exec(tokens)?.[1]);

  /** The text of the first block that opens with the given at-rule. */
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

  it('reads the five stylesheets of the page', () => {
    expect(sheets.map((item) => item.name).sort()).toEqual([
      'call-preview.css',
      'featured.css',
      'hero.css',
      'landing.css',
      'report-preview.css',
      'steps.css',
    ]);
  });

  it('use tokens and system colours only: no colour value of their own', () => {
    for (const { name, css } of sheets) {
      expect(css, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css, name).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch)\(/);
    }
  });

  it('never use the spring: it is for the carousel, the tips, the call controls and the report', () => {
    for (const { name, css } of sheets) expect(css, name).not.toMatch(/ease-spring/);
  });

  it('has nothing in the call preview that repeats by itself: the loop is the clock, so it can be paused', () => {
    const css = sheet('call-preview.css');
    expect(css).not.toMatch(/infinite/);
    expect(css).not.toMatch(/will-change/);
  });

  it('gives the preview’s tilt and glow to a fine pointer with hover, and only while the hook has switched it on', () => {
    const css = sheet('call-preview.css');
    const fine = block(css, '@media (hover: hover) and (pointer: fine)');
    expect(fine).toMatch(
      /\.lp-preview__window\[data-fx='on'\]:hover\s*\{[^}]*rotateX\(var\(--tilt-x, 0deg\)\)[^}]*rotateY\(var\(--tilt-y, 0deg\)\)/,
    );
    expect(fine).toMatch(/\[data-fx='on'\]:hover::before/);
    expect(css.replace(fine, '')).not.toMatch(/--tilt-[xy]/);
  });

  it('shows the call and the report one above the other, whole, when motion is reduced', () => {
    const reduced = block(sheet('call-preview.css'), '@media (prefers-reduced-motion: reduce)');
    expect(reduced).toMatch(/\.lp-panel__stage\s*\{[^}]*flex-direction:\s*column/);
    expect(reduced).toMatch(/\.lp-panel\[data-phase\] \.lp-face\s*\{[^}]*opacity:\s*1/);
  });

  it('moves the steps’ marks and lines a short beat apart, by the stagger token and by transform', () => {
    const css = sheet('steps.css');
    expect(css).toMatch(/transition-delay:\s*calc\(var\(--dur-stagger\)/);
    expect(css).toMatch(/\.lp-step__link::after\s*\{[^}]*transform:\s*scaleY\(0\)/);
    expect(css).toMatch(/\.lp-steps\[data-active\] \.lp-step__link::after\s*\{[^}]*scaleY\(1\)/);
    expect(token('dur-stagger')).toBeGreaterThan(0);
  });

  it('brings the scores in after the evidence has landed, one row after another', () => {
    const css = sheet('report-preview.css');
    // Every level is drawn from the start in a neutral colour; it takes the product's colour a beat after
    // the card has come into view, row by row.
    expect(css).toMatch(
      /\.lp-rp__pip\[data-on\]\s*\{[^}]*background:\s*var\(--stroke-accessible\)[^}]*transition:\s*background-color/,
    );
    expect(css).toMatch(
      /\.lp-rp__card\[data-revealed\] \.lp-rp__pip\[data-on\]\s*\{[^}]*background:\s*var\(--brand-stroke\)[^}]*transition-delay:\s*calc\(var\(--motion-panel\) \+ var\(--dur-stagger\) \* var\(--i\)\)/,
    );
    // The evidence itself is never held back: it has no reveal state of its own.
    expect(css).not.toMatch(/data-revealed\] \.lp-rp__evidence/);
  });

  it('gives every skill row one height of 44px, with its skill, level and turn centred on it', () => {
    const css = sheet('report-preview.css');
    expect(css).toMatch(
      /\.lp-rp__row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto;[^}]*align-items:\s*center;[^}]*min-block-size:\s*var\(--target\)/,
    );
    expect(tokens).toMatch(/--target:\s*2\.75rem/);
    // The line from the chosen row to the evidence leaves from the middle of the row.
    expect(css).toMatch(
      /\.lp-rp__row\[data-active\]::after\s*\{[^}]*inset-block-start:\s*calc\(50% /,
    );
  });

  it('steps the call’s microphone pictures back once the call has ended', () => {
    const css = sheet('call-preview.css');
    expect(css).toMatch(
      /\.lp-panel\[data-phase='report'\] \.lp-panel__indicators\s*\{[^}]*opacity:\s*0\.4/,
    );
    // The two pictures do nothing: they are not controls, whatever their state.
    expect(css).not.toMatch(/\.lp-ind[^{]*\{[^}]*cursor:\s*pointer/);
  });

  it('keeps the speaker’s column narrow, and the state word beside the waveform it describes', () => {
    const css = sheet('call-preview.css');
    expect(css).toMatch(/\.lp-line\s*\{[^}]*grid-template-columns:\s*4rem minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.lp-call__voice\s*\{[^}]*justify-content:\s*flex-start/);
    // Neither the preview nor its tabs stop short of the column they are in.
    expect(css).not.toMatch(/\.lp-preview\s*\{[^}]*max-inline-size/);
  });

  it('steps the promise up from 1440px, in the same page container as the rest', () => {
    const css = sheet('hero.css');
    const wide = block(css, '@media (min-width: 90em)');
    expect(wide).toMatch(/\.lp-hero__title\s*\{[^}]*font-size:\s*var\(--fs-display-wide\)/);
    expect(wide).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
    expect(block(css, '@media (min-width: 120em)')).toMatch(
      /font-size:\s*var\(--fs-display-widest\)/,
    );
    // Both sizes the sheet asks for exist: a missing token would leave the title at its inherited size.
    expect(tokens).toMatch(/--fs-display-wide:\s*3rem;/);
    expect(tokens).toMatch(/--fs-display-widest:\s*3\.25rem;/);
  });

  it('moves the hero action by transform only: it compresses 1 to 2 px and the arrow leans', () => {
    const buttons = stripped(join(process.cwd(), 'web/src/design/primitives/button.css'));
    expect(buttons).toMatch(
      /\.ff-button:active:not\([^)]*\)\s*\{[^}]*transform:\s*translateY\(var\(--press-shift\)\)/,
    );
    expect(buttons).toMatch(/\.ff-button--nudge:focus-visible \.ff-icon\s*\{[^}]*translateX/);
    expect(buttons).toMatch(/@media \(hover: hover\)\s*\{\s*\.ff-button--nudge:hover \.ff-icon/);
    expect(tokens).toMatch(/--press-shift:\s*1px/);
    expect(tokens).toMatch(/--press-shift-lg:\s*2px/);
  });
});
