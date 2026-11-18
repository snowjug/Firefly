import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { SESSION_ID, makeEarlyReport, makeSession } from '../components/report/report.fixtures.ts';
import { ApiError, api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import Report from './Report.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { getSession: vi.fn(), evaluate: vi.fn() } };
});

const getSession = vi.mocked(api.getSession);
const evaluate = vi.mocked(api.evaluate);

// A wide screen, so evidence is shown inline and the section rail is visible.
function stubMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function renderReport() {
  return render(
    <MemoryRouter initialEntries={[`/sessions/${SESSION_ID}/report`]}>
      <Routes>
        <Route path="sessions/:id/report" element={<Report />} />
        <Route path="calls/:id" element={<p>The call screen</p>} />
        <Route path="history" element={<p>The history screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  stubMatchMedia();
});

describe('Report page: session status', () => {
  it('sends a call that is still active back to the call screen', async () => {
    getSession.mockResolvedValue(makeSession({ status: 'active', report: null }));
    renderReport();
    expect(await screen.findByText('The call screen')).toBeInTheDocument();
  });

  it('shows the real evaluation phase, then the report, and moves focus to the heading', async () => {
    getSession
      .mockResolvedValueOnce(
        makeSession({ status: 'completing', evaluationPhase: 'scoring', report: null }),
      )
      .mockResolvedValue(makeSession());
    renderReport();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Preparing your coaching report' }),
    ).toBeInTheDocument();
    const current = screen.getByText('Finding evidence and scoring').closest('li');
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(within(current as HTMLElement).getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 5: Finding evidence and scoring')).toBeInTheDocument();
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    const title = await screen.findByRole(
      'heading',
      { level: 1, name: 'Locked out after a password reset' },
      { timeout: 4000 },
    );
    expect(title).toHaveFocus();
  });

  it('offers a retry when the evaluation failed, and keeps the transcript one click away', async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(
      makeSession({
        status: 'evaluation_failed',
        report: null,
        evaluationPhase: null,
        evaluationError: { message: 'The coaching service is busy right now.', retryable: true },
      }),
    );
    evaluate.mockResolvedValue(makeSession());
    renderReport();

    expect(await screen.findByText('The coaching service is busy right now.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /your transcript is safe/i })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/transcript`,
    );
    await user.click(screen.getByRole('button', { name: 'Retry evaluation' }));
    expect(evaluate).toHaveBeenCalledWith(SESSION_ID);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Locked out after a password reset' }),
    ).toBeInTheDocument();
  });

  it('does not offer a retry that cannot help', async () => {
    getSession.mockResolvedValue(
      makeSession({
        status: 'evaluation_failed',
        report: null,
        evaluationError: { message: 'This evaluation cannot be repeated.', retryable: false },
      }),
    );
    renderReport();
    expect(await screen.findByText('This evaluation cannot be repeated.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry evaluation' })).not.toBeInTheDocument();
  });

  it('explains a report that cannot be found and links back to history', async () => {
    getSession.mockRejectedValue(
      new ApiError(404, 'not_found', 'That session was not found.', false),
    );
    renderReport();
    expect(await screen.findByRole('alert')).toHaveTextContent('That session was not found.');
    expect(screen.getByRole('link', { name: 'Back to history' })).toHaveAttribute(
      'href',
      '/history',
    );
  });
});

describe('Report page: completed report', () => {
  it('shows the six skills, each with a score in words and evidence that links to its turn', async () => {
    getSession.mockResolvedValue(makeSession());
    renderReport();
    await screen.findByRole('heading', { level: 1, name: 'Locked out after a password reset' });

    for (const id of DIMENSION_IDS) {
      expect(
        screen.getByRole('heading', { level: 3, name: DIMENSIONS[id].label }),
      ).toBeInTheDocument();
    }
    const openingCard = screen
      .getByRole('heading', { level: 3, name: 'Opening & Rapport' })
      .closest('article') as HTMLElement;
    expect(openingCard).toHaveTextContent('4 of 5 – Strong');
    expect(
      within(openingCard).getByRole('link', { name: 'Turn 4, view in transcript' }),
    ).toHaveAttribute('href', `/sessions/${SESSION_ID}/transcript?turn=4`);

    const overview = screen.getAllByRole('link', { name: /of 5/ });
    expect(overview).toHaveLength(6);
    expect(overview[0]).toHaveAttribute('href', '#dim-opening-rapport');
    expect(screen.getByText('3.7')).toBeInTheDocument();
  });

  it('shows an improvement about something that never happened without a broken link', async () => {
    getSession.mockResolvedValue(makeSession());
    renderReport();
    const title = await screen.findByRole('heading', {
      level: 3,
      name: /did not find out: phone still using the old password/i,
    });
    const card = title.closest('article') as HTMLElement;
    expect(within(card).getByText(/didn.t come up in the call/i)).toBeInTheDocument();
    expect(within(card).queryAllByRole('link')).toHaveLength(0);
    expect(within(card).getByText('A stronger way to say it')).toBeInTheDocument();
  });

  it('copies the stronger phrasing and says so', async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(makeSession());
    renderReport();
    const title = await screen.findByRole('heading', { level: 3, name: /blamed the customer/i });
    const card = title.closest('article') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Copy phrasing' }));
    expect(await navigator.clipboard.readText()).toBe(
      'Thanks for explaining that. What did you see when it stopped working?',
    );
    expect(within(card).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(within(card).getByRole('status')).toHaveTextContent('Phrasing copied to the clipboard.');
  });

  it('describes discovery in words: found, partly found and missed', async () => {
    getSession.mockResolvedValue(makeSession());
    renderReport();
    expect(await screen.findByText('Found 1 of 3 hidden facts, and 1 partly')).toBeInTheDocument();
    const missed = screen
      .getByRole('heading', { level: 3, name: 'Phone still using the old password' })
      .closest('article') as HTMLElement;
    expect(within(missed).getByText('Missed')).toBeInTheDocument();
    expect(within(missed).getByText('A question worth asking')).toBeInTheDocument();
    const found = screen
      .getByRole('heading', { level: 3, name: 'Started right after the password change' })
      .closest('article') as HTMLElement;
    expect(within(found).getByText('Found')).toBeInTheDocument();
    expect(
      within(found).getByRole('link', { name: 'Turn 4, view in transcript' }),
    ).toBeInTheDocument();
  });

  it('says plainly when a call ended early with limited evidence, and shows the curveball', async () => {
    getSession.mockResolvedValue(
      makeSession({ completion: 'ended-early', report: makeEarlyReport(), overallScore: null }),
    );
    renderReport();
    await screen.findByRole('heading', { level: 1, name: 'Locked out after a password reset' });

    expect(screen.getByText('Ended early')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This call stopped before a wrap-up, so the Closing score rests on limited evidence.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/limited evidence/i);
    expect(screen.getByText('No overall score for this call.')).toBeInTheDocument();
    expect(screen.queryByText(/of 5\s*$/i, { selector: '.rp-overall-of' })).not.toBeInTheDocument();
    expect(screen.getByText(/no clear strength stood out/i)).toBeInTheDocument();
    expect(screen.getAllByText('Not enough evidence').length).toBeGreaterThan(0);

    const curveball = screen
      .getByRole('heading', { level: 3, name: 'Asks for a manager' })
      .closest('article') as HTMLElement;
    expect(within(curveball).getByText('Still open when the call ended')).toBeInTheDocument();
    expect(within(curveball).getByRole('link', { name: /view turn 4/i })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/transcript?turn=4`,
    );
  });

  it('links to the next practice scenario and keeps the training note visible', async () => {
    getSession.mockResolvedValue(makeSession());
    renderReport();
    const next = await screen.findByRole('link', { name: /practise this next/i });
    expect(next).toHaveAttribute('href', '/scenarios/follow-up-no-recent-update/setup');
    expect(screen.getByText('Reminders still missing and no update for days')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practise this scenario again' })).toHaveAttribute(
      'href',
      '/scenarios/locked-out-after-password-reset/setup',
    );
    expect(screen.getByText(/not an assessment of your performance/i)).toBeInTheDocument();
    expect(screen.getByText(/can be incomplete or wrong/i)).toBeInTheDocument();
  });

  it('prints through the browser', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    getSession.mockResolvedValue(makeSession());
    renderReport();
    await user.click(await screen.findByRole('button', { name: 'Print or save as PDF' }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
