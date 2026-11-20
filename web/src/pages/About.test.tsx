import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import {
  CARE_LABELS,
  DIMENSION_IDS,
  DIMENSIONS,
  SCORE_DESCRIPTIONS,
} from '#shared/domain/vocab.ts';
import type * as ApiModule from '../lib/api.ts';
import { ConfigProvider } from '../lib/config.tsx';
import About from './About.tsx';

const mocks = vi.hoisted(() => ({ config: vi.fn() }));
vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: mocks };
});

const CONFIG: AppConfigDTO = {
  app: { name: 'Firefly', version: '0.1.0' },
  provider: { kind: 'mock', label: 'Demo mode (built-in rules engine)', demo: true, notice: null },
  limits: { maxMessageChars: 1500, maxTraineeTurns: 60 },
  features: { devDiagnostics: false, testHooks: false },
};

function renderHelp(address = '/help') {
  return render(
    <ConfigProvider>
      <MemoryRouter initialEntries={[address]}>
        <About />
      </MemoryRouter>
    </ConfigProvider>,
  );
}

/** jsdom has no media queries: say whether the window is wide enough for the index beside the text. */
function setViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const section = (name: string) =>
  screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockResolvedValue(CONFIG);
  setViewport(true);
});
afterEach(() => {
  // @ts-expect-error -- put jsdom back as it was: no matchMedia
  delete window.matchMedia;
});

describe('Help page', () => {
  it('has one h1 and a contents list that leads to every section', () => {
    renderHelp();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Help & responsible AI' })).toBeVisible();

    const toc = screen.getByRole('navigation', { name: 'On this page' });
    const links = within(toc).getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      const target = document.getElementById(id);
      expect(target, `#${id}`).not.toBeNull();
      // Each target is the topic for that link, named by its own heading, and can take focus.
      expect(target).toHaveAccessibleName();
      expect(target).toHaveAttribute('tabindex', '-1');
      expect(target?.querySelector('h2')?.textContent).toContain(link.textContent ?? '');
    }
    expect(
      within(toc).getByRole('link', { name: 'Responsible AI and data safety' }),
    ).toHaveAttribute('href', '#responsible-ai');
    expect(within(toc).getByRole('link', { name: 'Voice (Beta)' })).toHaveAttribute(
      'href',
      '#voice',
    );
  });

  it('collapses the index into a list under a button on a narrow window, with the same links', async () => {
    setViewport(false);
    const user = userEvent.setup();
    renderHelp();
    const summary = screen.getByText('On this page', { selector: 'summary span' });
    const details = summary.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    const links = within(details).getAllByRole('link', { hidden: true });
    expect(links.length).toBeGreaterThanOrEqual(10);

    await user.click(summary);
    expect(details.open).toBe(true);
    expect(within(details).getByRole('navigation', { name: 'On this page' })).toBeVisible();
  });

  it('marks the section being read in the index, and nothing else', async () => {
    const observers: { callback: IntersectionObserverCallback }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observers.push({ callback });
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    renderHelp();
    const toc = screen.getByRole('navigation', { name: 'On this page' });
    expect(within(toc).queryByRole('link', { current: 'location' })).toBeNull();

    const voice = document.getElementById('voice') as HTMLElement;
    act(() => {
      observers[0]?.callback(
        [{ isIntersecting: true, target: voice } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    const current = within(toc).getAllByRole('link', { current: 'location' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Voice (Beta)');
    vi.unstubAllGlobals();
  });

  it('lists the six coaching dimensions with what they look at and their CARE behaviours', () => {
    renderHelp();
    const dimensions = section('The six coaching dimensions');
    for (const id of DIMENSION_IDS) {
      const heading = within(dimensions).getByRole('heading', {
        level: 3,
        name: DIMENSIONS[id].label,
      });
      const card = heading.closest('li') as HTMLElement;
      expect(card).toHaveTextContent(DIMENSIONS[id].description);
      for (const behaviour of DIMENSIONS[id].care) {
        expect(within(card).getByText(CARE_LABELS[behaviour])).toBeInTheDocument();
      }
    }
    expect(within(dimensions).getByText(SCORE_DESCRIPTIONS[3] as string)).toBeInTheDocument();
  });

  it('keeps the responsible AI statements', () => {
    renderHelp();
    const responsible = section('Responsible AI and data safety');
    expect(responsible).toHaveAttribute('id', 'responsible-ai');
    expect(responsible).toHaveTextContent('Firefly is a training aid');
    expect(responsible).toHaveTextContent('Do not enter real customer information');
    expect(responsible).toHaveTextContent('AI feedback can be incomplete or wrong');
    expect(responsible).toHaveTextContent('not a performance rating');
    expect(responsible).toHaveTextContent('API keys stay on the server');
    expect(responsible).toHaveTextContent(
      'does not claim any compliance certification or legal guarantee',
    );
    expect(within(responsible).getByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      '/history',
    );
    expect(within(responsible).getAllByRole('link', { name: 'Calibration page' })).toHaveLength(1);
    expect(within(responsible).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings#data',
    );
  });

  it('explains voice honestly: opt-in, a beta, and what leaves the device', () => {
    renderHelp();
    const voice = section('Voice (Beta): how it works and your privacy');
    expect(voice).toHaveAttribute('id', 'voice');
    expect(voice).toHaveTextContent('off until you turn it on');
    expect(voice).toHaveTextContent('typing always keeps working');
    expect(voice).toHaveTextContent('works best in Chrome or Edge');
    expect(voice).toHaveTextContent('Firefly never records, keeps or uploads audio');
    expect(voice).toHaveTextContent('online speech service run by the browser’s maker');
    expect(voice).toHaveTextContent('The microphone is never opened until you turn voice on');
    expect(within(voice).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings#preferences',
    );
  });

  it('says how points and badges work, without ranking, speed or penalties', () => {
    renderHelp();
    const points = section('How points and badges work');
    expect(points).toHaveTextContent('Points reward practising');
    expect(points).toHaveTextContent('no ranking and no leaderboard');
    expect(points).toHaveTextContent('no points for speed');
    expect(points).toHaveTextContent('A missed day costs nothing');
    expect(
      within(points).getByRole('link', { name: /See your points and badges/ }),
    ).toHaveAttribute('href', '/rewards');
    expect(document.body).not.toHaveTextContent(/\bXP\b|top performer|level up/i);
  });

  it('covers using Firefly with a mentor, the questions people ask and its limits', () => {
    renderHelp();
    const mentor = section('Using Firefly with a mentor');
    expect(mentor).toHaveTextContent('Coaching, not assessment');
    expect(within(mentor).getByRole('link', { name: 'Calibration page' })).toHaveAttribute(
      'href',
      '/calibration',
    );

    const faq = section('Questions and answers');
    expect(
      within(faq)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toContain('Do I need an account?');
    expect(faq).toHaveTextContent('Firefly has no sign-in');

    const limits = section('What Firefly can’t do');
    expect(limits).toHaveAttribute('id', 'limitations');
    expect(limits).toHaveTextContent('Scores are for practice, not performance assessment');
    expect(limits).toHaveTextContent('Voice is a beta');
    expect(limits).not.toHaveTextContent('Voice is not implemented');
  });

  it('opens at the section a link points to, with focus on it', async () => {
    renderHelp('/help#voice');
    await waitFor(() => expect(document.getElementById('voice')).toHaveFocus());
  });

  it('opens the repository safely and shows the version and provider from the server', async () => {
    renderHelp();
    const link = screen.getByRole('link', { name: /github\.com\/snowjug\/Firefly/ });
    expect(link).toHaveAttribute('href', 'https://github.com/snowjug/Firefly');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link).toHaveAccessibleName(/opens in a new tab/);

    expect(await screen.findByText('0.1.0')).toBeInTheDocument();
    expect(
      screen.getByText('Demo mode (built-in rules engine)', { selector: 'dd' }),
    ).toBeInTheDocument();
  });

  it('says so, in words, when the server cannot be reached', async () => {
    mocks.config.mockRejectedValue(new Error('offline'));
    renderHelp();
    expect(await screen.findByText(/Unavailable: the server could not be reached/)).toBeVisible();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(1);
  });
});
