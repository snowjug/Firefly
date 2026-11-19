import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import type * as ApiModule from '../lib/api.ts';
import { ApiError, api } from '../lib/api.ts';
import Setup from './Setup.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { scenario: vi.fn() } };
});

const scenario = makeScenario({ id: 'team-workspace' });

function Harness() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <p data-testid="url">{`${location.pathname}${location.search}`}</p>
      <button type="button" onClick={() => void navigate(-1)}>
        Browser back
      </button>
    </div>
  );
}

function renderSetup(step?: number) {
  const entry = `/scenarios/team-workspace/setup${step ? `?step=${step}` : ''}`;
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Harness />
      <Routes>
        <Route path="/scenarios/:id/setup" element={<Setup />} />
        <Route path="/scenarios/:id/brief" element={<p>Brief page</p>} />
        <Route path="/scenarios" element={<p>Library page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const draft = () => JSON.parse(sessionStorage.getItem('firefly.draft') ?? 'null');
const next = () => screen.getByRole('button', { name: /^Next/ });
const stepHeading = (name: string) => screen.findByRole('heading', { level: 2, name });

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(api.scenario).mockResolvedValue(scenario);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Setup flow', () => {
  it('keeps the step in the address, moves focus to the step heading and announces the step', async () => {
    const user = userEvent.setup();
    renderSetup();
    await stepHeading('Is this the issue you want to practise?');
    expect(screen.getByText(scenario.summary)).toBeInTheDocument();

    await user.click(next());
    const heading = await stepHeading('How much is the business affected?');
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByTestId('url')).toHaveTextContent('?step=2');
    expect(
      screen.getByText('Step 2 of 8: Business impact', { selector: '[role=status]' }),
    ).toBeInTheDocument();
    // The scenario's own setting is preselected and labelled.
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByText('Scenario default')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    await stepHeading('Is this the issue you want to practise?');
  });

  it('saves every change to the draft and keeps only what differs from the scenario', async () => {
    const user = userEvent.setup();
    renderSetup(2);
    await user.click(await screen.findByRole('radio', { name: 'High' }));
    expect(draft()).toEqual({ scenarioId: 'team-workspace', overrides: { impact: 'high' } });

    await user.click(screen.getByRole('radio', { name: 'Medium' }));
    expect(draft()).toEqual({ scenarioId: 'team-workspace', overrides: {} });
  });

  it('shows the call so far, updates it as you choose and can reset to the defaults', async () => {
    const user = userEvent.setup();
    renderSetup(3);
    const heading = await screen.findByRole('heading', { name: 'Your call so far' });
    const preview = heading.closest('section') as HTMLElement;
    expect(
      within(preview).getByText(/is frustrated and terse, with intermediate technical knowledge/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Angry / escalating' }));
    expect(within(preview).getByText(/is angry and terse/)).toBeInTheDocument();
    expect(within(preview).getByText('Changed')).toBeInTheDocument();

    await user.click(within(preview).getByRole('button', { name: 'Reset to scenario defaults' }));
    expect(within(preview).getByText(/is frustrated and terse/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Frustrated' })).toBeChecked();
    expect(draft().overrides).toEqual({});
  });

  it('re-checks chosen curveballs against the difficulty whenever it changes', async () => {
    const user = userEvent.setup();
    renderSetup(6);
    await user.click(await screen.findByRole('radio', { name: 'Challenge' }));
    await user.click(next());
    await user.click(await screen.findByRole('radio', { name: 'Choose' }));
    await user.click(screen.getByRole('checkbox', { name: 'Asks for a manager' }));
    await user.click(screen.getByRole('checkbox', { name: 'Imposes a deadline' }));
    expect(screen.getByText(/2 of 2 chosen/)).toBeInTheDocument();

    // A third pick is refused, and the reason is on the page and tied to the option.
    const third = screen.getByRole('checkbox', { name: 'Goes quiet' });
    expect(third).toHaveAttribute('aria-disabled', 'true');
    await user.click(third);
    expect(third).not.toBeChecked();
    expect(screen.getByText(/Challenge allows up to two curveballs/)).toBeInTheDocument();

    // Lowering the difficulty drops what no longer fits, keeps the earliest pick and says so.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('radio', { name: 'Starter' }));
    await user.click(next());
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: 'Asks for a manager' })).toBeChecked();
    expect(
      screen.getByText(/Starter allows up to one curveball, so "Imposes a deadline" was removed/),
    ).toBeInTheDocument();
    expect(draft().overrides).toEqual({ difficulty: 'starter', curveballs: ['ask-manager'] });
  });

  it('restores a draft for this scenario and ignores one for another', async () => {
    sessionStorage.setItem(
      'firefly.draft',
      JSON.stringify({
        scenarioId: 'team-workspace',
        overrides: { startingTemperature: 'angry', style: 'not-a-style' },
      }),
    );
    renderSetup(8);
    const review = await screen.findByLabelText('Your choices');
    expect(within(review).getByText('Angry / escalating')).toBeInTheDocument();
    expect(within(review).getAllByText('Changed from default')).toHaveLength(1);
    expect(within(review).getByText('Terse')).toBeInTheDocument(); // the invalid style fell back
    cleanup();

    sessionStorage.setItem(
      'firefly.draft',
      JSON.stringify({ scenarioId: 'another-scenario', overrides: { impact: 'high' } }),
    );
    renderSetup(8);
    await screen.findByLabelText('Your choices');
    expect(screen.queryByText('Changed from default')).not.toBeInTheDocument();
  });

  it('reviews every choice, jumps back to a step to edit it and goes on to the brief', async () => {
    const user = userEvent.setup();
    renderSetup(8);
    const edit = await screen.findByRole('link', { name: 'Edit customer temperament' });
    expect(edit).toHaveAttribute('href', '/scenarios/team-workspace/setup?step=3');

    await user.click(edit);
    await stepHeading('How does the customer feel when the call starts?');
    for (let step = 4; step <= 8; step += 1) await user.click(next());
    await user.click(screen.getByRole('button', { name: 'Continue to brief' }));
    expect(await screen.findByText('Brief page')).toBeInTheDocument();
    expect(draft()).toEqual({ scenarioId: 'team-workspace', overrides: {} });
  });

  it('docks a collapsible summary above the step buttons on narrow screens', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const user = userEvent.setup();
    renderSetup(3);
    const toggle = await screen.findByRole('button', { name: /Your call so far/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/is frustrated and terse/)).not.toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/is frustrated and terse/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('says what went wrong when the scenario cannot be loaded and lets you try again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenario)
      .mockRejectedValueOnce(
        new ApiError(500, 'internal', 'Something went wrong on our side. Please try again.', true),
      )
      .mockResolvedValueOnce(scenario);
    renderSetup();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on our side. Please try again.');
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    await stepHeading('Is this the issue you want to practise?');
  });

  it('offers a way back when the scenario does not exist', async () => {
    vi.mocked(api.scenario).mockRejectedValue(
      new ApiError(404, 'not_found', 'That scenario was not found.', false),
    );
    renderSetup();
    expect(
      await screen.findByRole('heading', { level: 1, name: "We couldn't find that scenario" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });
});
