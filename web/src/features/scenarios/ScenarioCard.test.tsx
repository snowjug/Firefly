import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DESKTOP_MOUSE, stubMedia } from '../../design/interaction/test-utils.ts';
import { ScenarioCard, ScenarioCardSkeleton, scenarioHref } from './ScenarioCard.tsx';
import { SAMPLE, publicScenarios, scenarioById } from './testing/fixtures.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const teams = scenarioById(SAMPLE.standard);
const challenge = scenarioById(SAMPLE.challenge);

/** The words a person reads: runs of letters or digits, not the dots between phrases. */
const words = (text: string) =>
  text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

function selectCard(scenario: PublicScenarioDTO, selected = false, onSelect = vi.fn()) {
  return render(
    <ScenarioCard
      scenario={scenario}
      mode="select"
      name="gallery"
      selected={selected}
      onSelect={onSelect}
    />,
  );
}

function linkCard(scenario: PublicScenarioDTO, to?: string) {
  return render(
    <MemoryRouter>
      <ScenarioCard scenario={scenario} mode="link" to={to} />
    </MemoryRouter>,
  );
}

const card = () => document.querySelector('.scn-card') as HTMLElement;

describe('what a card says', () => {
  it('is the product, the issue in a few words, how it starts, how long, how hard and the way on', () => {
    selectCard(teams);
    const text = card().textContent ?? '';
    expect(text).toContain('Teams');
    expect(text).toContain('Meeting recordings missing');
    expect(text).toContain('Medium impact \u00b7 Frustrated \u00b7 First contact');
    expect(text).toContain('8\u201312 min');
    expect(text).toContain('Standard');
    expect(text).toContain('Use scenario');
  });

  it('says the metadata line and the duration exactly as the brief words them', () => {
    selectCard(challenge);
    expect(card().querySelector('.scn-card__meta')).toHaveTextContent(
      'High impact \u00b7 Angry \u00b7 Escalated',
    );
    expect(card().querySelector('.scn-card__time')).toHaveTextContent('10\u201314 min');
  });

  it('shows the difficulty as three bars and its name, never colour alone', () => {
    selectCard(challenge);
    const level = card().querySelector('.scn-level') as HTMLElement;
    expect(level).toHaveTextContent('Challenge');
    expect(level.querySelector('.scn-level__bars')).toHaveAttribute('data-steps', '3');
    expect(level.querySelector('.scn-level__bars')).toHaveAttribute('aria-hidden', 'true');
  });

  it('leaves the summary out, so a row of cards can be scanned', () => {
    selectCard(teams);
    expect(card().textContent).not.toContain(teams.listSummary);
    expect(card().textContent).not.toContain(teams.summary);
  });

  it('uses the full title when the server has not sent a short one', () => {
    selectCard({ ...teams, shortTitle: '' });
    expect(card().querySelector('.scn-card__title')).toHaveTextContent(teams.title);
  });

  it('marks the product with an accent tile and a small edge, never with its name alone', () => {
    selectCard(teams);
    expect(card()).toHaveClass('ff-accent', 'ff-accent--purple');
    expect(card().querySelector('.scn-card__tile svg')).toHaveAttribute('aria-hidden', 'true');
    expect(card().querySelector('.scn-card__accent')).toHaveAttribute('aria-hidden', 'true');
    expect(card()).toHaveTextContent('Teams');
  });

  it('keeps every card in the library to a six-word title and an eighteen-word preview', () => {
    for (const scenario of publicScenarios()) {
      const { unmount } = selectCard(scenario);
      expect(
        words(card().querySelector('.scn-card__title')?.textContent ?? ''),
      ).toBeLessThanOrEqual(6);
      expect(words(card().textContent ?? ''), scenario.id).toBeLessThanOrEqual(18);
      unmount();
    }
  });

  it('has a decorative waveform that is hidden from a screen reader', () => {
    selectCard(teams);
    expect(card().querySelector('.scn-card__wave')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('a card that chooses', () => {
  it('is one radio that the whole card answers to, named by its title and described by the rest', () => {
    selectCard(teams);
    const radio = screen.getByRole('radio', { name: 'Meeting recordings missing' });
    expect(radio).toHaveAttribute('name', 'gallery');
    expect(radio).toHaveAttribute('value', teams.id);
    const described = (radio.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' | ');
    expect(described).toContain('Teams');
    expect(described).toContain('Medium impact');
    expect(described).toContain('8\u201312 min');
    expect(described).toContain('Standard');
    expect(radio.className).toBe('scn-card__input');
  });

  it('holds no second control: nothing to tab to or press but the radio', () => {
    selectCard(teams);
    const controls = card().querySelectorAll(
      'a, button, input, select, textarea, [tabindex], [role="button"], [role="link"]',
    );
    expect([...controls].map((control) => control.tagName)).toEqual(['INPUT']);
  });

  it('says "Use scenario" until it is chosen, and then "Selected" with a check', () => {
    const { rerender } = selectCard(teams);
    expect(card()).not.toHaveAttribute('data-selected');
    expect(card().querySelector('.scn-card__go')).toHaveTextContent('Use scenario');
    rerender(
      <ScenarioCard
        scenario={teams}
        mode="select"
        name="gallery"
        selected
        onSelect={() => undefined}
      />,
    );
    expect(card()).toHaveAttribute('data-selected', 'true');
    expect(card().querySelector('.scn-card__go')).toHaveTextContent('Selected');
    expect(card().querySelector('.scn-card__go svg')).not.toBeNull();
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('keeps the visual action out of what a screen reader reads, since the radio says it', () => {
    selectCard(teams);
    expect(card().querySelector('.scn-card__go')).toHaveAttribute('aria-hidden', 'true');
  });

  it('chooses on a click and on the keyboard, once', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    selectCard(teams, false, onSelect);
    await user.click(screen.getByRole('radio'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(teams.id);
    onSelect.mockClear();
    screen.getByRole('radio').focus();
    expect(screen.getByRole('radio')).toHaveFocus();
  });
});

describe('a card that links', () => {
  it('is a link to the workspace with the scenario chosen, named by what it does and for what', () => {
    linkCard(teams);
    const link = screen.getByRole('link', { name: 'Use scenario Meeting recordings missing' });
    expect(link).toHaveAttribute('href', `/scenarios?scenario=${teams.id}`);
    expect(scenarioHref('a b')).toBe('/scenarios?scenario=a%20b');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('is described by the product, how it starts, the time and the difficulty', () => {
    linkCard(challenge);
    const link = screen.getByRole('link');
    const described = (link.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' | ');
    expect(described).toContain('High impact \u00b7 Angry \u00b7 Escalated');
    expect(described).toContain('Challenge');
  });

  it('can go somewhere else', () => {
    linkCard(teams, '/elsewhere');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/elsewhere');
  });

  it('is a single link: the card is one target, with nothing nested', () => {
    linkCard(teams);
    expect(within(card()).getAllByRole('link')).toHaveLength(1);
    expect(within(card()).queryAllByRole('button')).toEqual([]);
  });
});

describe('what a mouse does to it, and what it does not', () => {
  it('follows a mouse with a fine hovering pointer', () => {
    stubMedia(DESKTOP_MOUSE);
    selectCard(teams);
    expect(card()).toHaveAttribute('data-fx', 'on');
  });

  it('does not tilt or glow on a coarse pointer, or without hover', () => {
    stubMedia({ '(hover: none)': true, '(pointer: coarse)': true });
    selectCard(teams);
    expect(card()).toHaveAttribute('data-fx', 'off');
  });

  it('does not tilt or glow when motion is reduced', () => {
    stubMedia({ ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true });
    selectCard(teams);
    expect(card()).toHaveAttribute('data-fx', 'off');
  });
});

describe('while the scenarios load', () => {
  it('is a placeholder that says nothing and can do nothing', () => {
    const { container } = render(<ScenarioCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('a, button, input')).toBeNull();
  });
});

describe('arriving', () => {
  it('has no arrival of its own unless it is told it is new: a card that was there does not move', () => {
    selectCard(teams);
    expect(card()).not.toHaveAttribute('data-arrive');
    expect(card().style.getPropertyValue('--reveal-i')).toBe('');
  });

  it('carries its place in the sequence, and none past the eighth: thirty cards are not thirty animations', () => {
    const { rerender } = render(
      <ScenarioCard
        scenario={teams}
        mode="select"
        name="g"
        onSelect={() => undefined}
        arrive={{ index: 3 }}
      />,
    );
    expect(card()).toHaveAttribute('data-arrive', 'now');
    expect(card().style.getPropertyValue('--reveal-i')).toBe('3');
    rerender(
      <ScenarioCard
        scenario={teams}
        mode="select"
        name="g"
        onSelect={() => undefined}
        arrive={{ index: 29 }}
      />,
    );
    expect(card()).not.toHaveAttribute('data-arrive');
    expect(card().style.getPropertyValue('--reveal-i')).toBe('');
  });

  it('rests on its first frame while it is waiting to be seen, and goes when it is let go', () => {
    const { rerender } = linkCard(teams);
    rerender(
      <MemoryRouter>
        <ScenarioCard scenario={teams} mode="link" arrive={{ index: 1, waiting: true }} />
      </MemoryRouter>,
    );
    expect(card()).toHaveAttribute('data-arrive', 'waiting');
    rerender(
      <MemoryRouter>
        <ScenarioCard scenario={teams} mode="link" arrive={{ index: 1, waiting: false }} />
      </MemoryRouter>,
    );
    expect(card()).toHaveAttribute('data-arrive', 'now');
  });

  it('does not change what the card says or what it does', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ScenarioCard
        scenario={teams}
        mode="select"
        name="g"
        onSelect={onSelect}
        arrive={{ index: 0, waiting: true }}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Meeting recordings missing' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(teams.id);
  });
});

describe('what its stylesheet promises', () => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'scenario-card.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  /** The rules of a block, without the at-rule's own braces. */
  const insideFinePointer = css.slice(
    css.indexOf('@media (hover: hover) and (pointer: fine) {'),
    css.indexOf('.scn-card:active {'),
  );

  it('moves, lights and animates under a pointer only for a fine hovering pointer with data-fx on', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
      selector: (match[1] as string).trim(),
      body: match[2] as string,
    }));
    const hovered = rules.filter(({ selector }) => /:hover/.test(selector));
    const moving = hovered.filter(({ body }) =>
      /transform|box-shadow|opacity|animation/.test(body),
    );
    expect(moving.length).toBeGreaterThan(4);
    for (const { selector } of moving) {
      expect(selector, selector).toContain("[data-fx='on']");
      expect(insideFinePointer, selector).toContain(selector);
    }
  });

  it('gives a focused card the same prominence, without the tilt', () => {
    expect(css).toMatch(
      /\.scn-card:has\(:focus-visible\)\s*\{[^}]*translateY\(calc\(var\(--move-lift\) \* -1\)\)/,
    );
    const focus = css.slice(
      css.indexOf('.scn-card:has(:focus-visible) {'),
      css.indexOf('@media (hover: hover) and (pointer: fine) {'),
    );
    expect(focus).not.toMatch(/rotate|perspective|--tilt/);
    expect(focus).toMatch(/\.scn-card__edge/);
    expect(focus).toMatch(/\.scn-card__accent/);
    expect(focus).toMatch(/\.scn-card__meta/);
  });

  it('tilts by the hook\u2019s variables, which are cleared when the pointer leaves', () => {
    expect(css).toMatch(/rotateX\(var\(--tilt-x, 0deg\)\) rotateY\(var\(--tilt-y, 0deg\)\)/);
    expect(css).toMatch(/var\(--glow-x, 50%\) var\(--glow-y, 0%\)/);
  });

  it('keeps the title to two lines, with room for two, and sits a shorter title at the bottom of it', () => {
    expect(css).toMatch(/-webkit-line-clamp:\s*2/);
    expect(css).toMatch(/min-block-size:\s*calc\(var\(--lh-subtitle2\) \* 2\)/);
    const title = css.match(/\.scn-card__title\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(title).toMatch(/flex-direction:\s*column/);
    expect(title).toMatch(/justify-content:\s*flex-end/);
    expect(css).toMatch(/\.scn-card__title > span\s*\{[^}]*-webkit-line-clamp:\s*2/);
  });

  it('keeps brand blue for the chosen card and for the link on the landing page, and the action of every other card quiet', () => {
    expect(css).toMatch(/\.scn-card__go\s*\{[^}]*color:\s*var\(--fg-2\)/);
    expect(css).toMatch(
      /\.scn-card\[data-selected\] \.scn-card__go,\s*\.scn-card__link\s*\{\s*color:\s*var\(--brand-fg-2\)/,
    );
    // A link is underlined, so the card's is left to the page's own rule for links.
    expect(css).not.toMatch(/text-decoration:\s*none/);
  });

  it('uses no spring, and no colour of its own', () => {
    expect(css).not.toMatch(/--ease-spring/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it('brings a new card in only on a screen with motion allowed, a beat after the one before it', () => {
    const query = '@media screen and (prefers-reduced-motion: no-preference) {';
    const start = css.indexOf(query);
    expect(start, 'the arrival has a query of its own').toBeGreaterThan(-1);
    const arrival = css.slice(start, css.indexOf('@keyframes scn-card-arrive'));
    expect(arrival).toMatch(
      /\.scn-card\[data-arrive\]\s*\{[^}]*animation:\s*scn-card-arrive var\(--motion-panel\)[^;]*backwards/,
    );
    expect(arrival).toMatch(
      /animation-delay:\s*calc\(var\(--reveal-i, 0\) \* var\(--dur-stagger\)\)/,
    );
    // It fills backwards only: once it has ended the card's own hover, tilt and press are its own again.
    expect(arrival).not.toMatch(/forwards|both/);
    // Nothing outside the query starts it, so a reduced-motion visitor and paper keep every card.
    expect(css.replace(arrival, '')).not.toMatch(/animation:\s*scn-card-arrive/);
  });

  it('holds a card that is waiting on its first frame, and moves only opacity and transform', () => {
    expect(css).toMatch(
      /\.scn-card\[data-arrive='waiting'\]\s*\{\s*animation-play-state:\s*paused;\s*\}/,
    );
    const keyframes = css.match(/@keyframes scn-card-arrive\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(keyframes).toMatch(/opacity:\s*0/);
    expect(keyframes).toMatch(/transform:\s*translateY\(var\(--move-sm\)\)/);
    const moved = [...keyframes.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
    expect([...new Set(moved)].sort()).toEqual(['opacity', 'transform']);
  });

  it('seats the chosen card a little higher, as a card under the pointer is, and a press still wins', () => {
    const chosen = css.match(/\.scn-card\[data-selected\]\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(chosen).toMatch(/transform:\s*translateY\(calc\(var\(--move-lift\) \* -1\)\)/);
    // The press comes after it in the sheet at the same specificity, so pressing the chosen card compresses it.
    expect(css.indexOf('.scn-card:active {')).toBeGreaterThan(
      css.indexOf('.scn-card[data-selected] {'),
    );
  });
});
