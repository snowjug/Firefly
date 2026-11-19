import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import {
  SESSION_ID,
  makeBadge,
  makeLedgerEntry,
  makeRewards,
  makeSession,
  makeSpecSession,
} from '../components/report/report.fixtures.ts';
import { ApiError, api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { loadDraft } from '../lib/draft.ts';
import { ToastProvider } from '../lib/toast.tsx';
import Report from './Report.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { getSession: vi.fn(), evaluate: vi.fn(), rewards: vi.fn() } };
});

const getSession = vi.mocked(api.getSession);
const evaluate = vi.mocked(api.evaluate);
const rewards = vi.mocked(api.rewards);

// A wide screen, so evidence is shown inline and the section bar is visible.
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
    <ToastProvider>
      <MemoryRouter initialEntries={[`/sessions/${SESSION_ID}/report`]}>
        <Routes>
          <Route path="sessions/:id/report" element={<Report />} />
          <Route path="calls/:id" element={<p>The call screen</p>} />
          <Route path="history" element={<p>The history screen</p>} />
          <Route path="rewards" element={<p>The rewards screen</p>} />
          <Route path="calibration" element={<p>The calibration screen</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

const FOUND = { level: 1, name: 'Call feedback' } as const;

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  stubMatchMedia();
  rewards.mockResolvedValue(makeRewards());
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

    const title = await screen.findByRole('heading', FOUND, { timeout: 4000 });
    // Focus is applied in an effect right after the heading appears, so wait for it.
    await waitFor(() => expect(title).toHaveFocus());
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
    expect(await screen.findByRole('heading', FOUND)).toBeInTheDocument();
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
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We couldn\u2019t open this report' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('That session was not found.');
    expect(screen.getByRole('link', { name: 'Back to history' })).toHaveAttribute(
      'href',
      '/history',
    );
  });

  it('says so when a finished call has no readable report', async () => {
    getSession.mockResolvedValue(makeSession({ report: null, status: 'completed' }));
    renderReport();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'This report can\u2019t be opened' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /read your transcript/i })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/transcript`,
    );
  });
});

describe('Report page: a call that ended early (modelled on a real report)', () => {
  async function renderSpec() {
    getSession.mockResolvedValue(makeSpecSession());
    renderReport();
    await screen.findByRole('heading', FOUND);
  }

  it('has one page heading, a truthful sub-line and a print button that explains itself', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await renderSpec();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/ended before a natural close, so treat the feedback/i)).toBeVisible();
    expect(screen.queryByText(/great effort/i)).not.toBeInTheDocument();
    const download = screen.getByRole('button', { name: 'Download report' });
    expect(download).toHaveAccessibleDescription(
      "Opens your browser's print dialog. Choose Save as PDF.",
    );
    await user.click(download);
    expect(print).toHaveBeenCalledTimes(1);
    // The transcript is one click away from the top and again in "Next practice target".
    const transcripts = screen.getAllByRole('link', { name: /review transcript/i });
    expect(transcripts).toHaveLength(2);
    for (const link of transcripts) {
      expect(link).toHaveAttribute('href', `/sessions/${SESSION_ID}/transcript`);
    }
  });

  it('shows the call: when, how long, how hard, how it ended, who coached, and the notes', async () => {
    await renderSpec();
    const meta = screen.getByRole('region', { name: 'A user needs help finding a feature' });

    expect(within(meta).getByText('Practice coaching report')).toBeInTheDocument();
    expect(meta.querySelector('time')).toHaveAttribute('datetime', makeSpecSession().startedAt);
    expect(within(meta).getByText('3 min 6s')).toBeInTheDocument();
    expect(within(meta).getByText('Starter')).toBeInTheDocument();
    expect(within(meta).getByText('Guided practice')).toBeInTheDocument();
    expect(within(meta).getByText('Ended early')).toBeInTheDocument();
    expect(within(meta).getByText('Customer at the end: Concerned')).toBeInTheDocument();
    expect(within(meta).getByText('Gemini (model "gemini-test-model")')).toBeInTheDocument();
    // Said once each: the plain note about the early end, and the evidence note with its badge.
    expect(
      within(meta).getByText(
        'This call stopped before a wrap-up, so the Closing score rests on limited evidence.',
      ),
    ).toBeInTheDocument();
    expect(
      within(meta).getByText(/The call ended early after dismissive trainee replies/),
    ).toBeVisible();
    const note = within(meta).getByRole('note');
    expect(note).toHaveTextContent('Limited evidence.');
    expect(note).toHaveTextContent('The call was ended before a natural close.');
    expect(note).toHaveTextContent('More turns would give firmer coaching.');
  });

  it('shows the overall score with its caption, the quick facts and six skill rows with evidence chips', async () => {
    await renderSpec();
    expect(screen.getByRole('img', { name: 'Overall score: 1 out of 5' })).toBeInTheDocument();
    expect(
      screen.getByText('Across the six skills. A practice signal, not a grade or a ranking.'),
    ).toBeInTheDocument();

    const facts = screen.getByRole('list', { name: 'At a glance' });
    expect(within(facts).getByText('0 of 4')).toBeInTheDocument();
    expect(within(facts).getByText('Hidden facts found')).toBeInTheDocument();
    expect(within(facts).getByText('Calm to Concerned')).toBeInTheDocument();
    expect(within(facts).getByText('Customer mood')).toBeInTheDocument();
    expect(within(facts).getByText('5')).toBeInTheDocument();
    expect(within(facts).getByText('Your turns')).toBeInTheDocument();
    expect(within(facts).getByRole('link', { name: 'Scoping & Discovery' })).toHaveAttribute(
      'href',
      '#dim-scoping-discovery',
    );
    expect(within(facts).getByRole('link', { name: 'Clarity' })).toHaveAttribute(
      'href',
      '#dim-clarity',
    );

    const skills = screen.getByRole('region', { name: 'Six skill scores' });
    const rows = within(skills).getAllByRole('link');
    expect(rows).toHaveLength(6);
    DIMENSION_IDS.forEach((id, index) => {
      expect(rows[index]).toHaveAttribute('href', `#dim-${id}`);
      expect(rows[index]).toHaveTextContent(DIMENSIONS[id].label);
      expect(rows[index]).toHaveTextContent('1 of 5');
      expect(rows[index]).toHaveTextContent('Not demonstrated');
    });
    expect(within(skills).getAllByText('Limited evidence')).toHaveLength(2);
    expect(within(skills).getAllByText('Not enough evidence')).toHaveLength(1);
    expect(rows[5]).toHaveTextContent('Not enough evidence');
  });

  it('keeps the lead sentence of every section of the original report', async () => {
    await renderSpec();
    for (const sentence of [
      'Each skill is scored from 1 to 5 against the practice rubric, using quotes from your own call. Select a skill to jump to its details.',
      'Moments from your call that helped, in your own words.',
      'Where a different choice could have helped, with wording you can try next time.',
      'Customers rarely volunteer everything. These are the facts this customer held back, and whether your questions brought them out.',
      'How the customer\u2019s mood moved through the call, and what moved it. Turning points link back to the exact turn in your transcript.',
      'One thing to work on in your next call, not a list of everything.',
    ]) {
      expect(screen.getByText(sentence)).toBeInTheDocument();
    }
  });

  it('lists the sections in "On this page" once the rewards are known', async () => {
    await renderSpec();
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    await within(nav).findByRole('link', { name: 'Rewards' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Six skills',
      'What went well',
      'Skill details',
      'Opportunities',
      'Discovery',
      'Customer temperature',
      'Rewards',
      'Next practice',
      'About this report',
    ]);
    expect(within(nav).getByRole('link', { name: 'Discovery' })).toHaveAttribute(
      'href',
      '#discovery',
    );
  });

  it('says plainly that no strength stood out, and gives each skill its rationale, evidence and advice', async () => {
    await renderSpec();
    const strengths = screen.getByRole('region', { name: 'What went well' });
    expect(
      within(strengths).getByText(
        'No clear strength stood out in this call. The opportunities below are the best place to start.',
      ),
    ).toBeInTheDocument();

    const opening = screen
      .getByRole('heading', { level: 3, name: 'Opening & Rapport' })
      .closest('article') as HTMLElement;
    expect(within(opening).getByText('Communicate effectively')).toBeInTheDocument();
    expect(within(opening).getByText('Be empathetic')).toBeInTheDocument();
    expect(opening).toHaveTextContent('1 of 5 – Not demonstrated');
    expect(within(opening).getByText(/no name or team introduction/)).toBeInTheDocument();
    expect(within(opening).getByText('Evidence from your call')).toBeInTheDocument();
    expect(
      within(opening).getByRole('link', { name: 'Turn 2, view in transcript' }),
    ).toHaveAttribute('href', `/sessions/${SESSION_ID}/transcript?turn=2`);
    expect(within(opening).getByText('\u201cHi how shall i help u\u201d')).toBeInTheDocument();
    expect(within(opening).getByText('See it in the conversation')).toBeInTheDocument();
    expect(within(opening).getByText('To strengthen this')).toBeInTheDocument();
    expect(within(opening).getByText(/offering a warm, professional greeting/)).toBeInTheDocument();

    const scoping = screen
      .getByRole('heading', { level: 3, name: 'Scoping & Discovery' })
      .closest('article') as HTMLElement;
    expect(
      within(scoping).getByText('No quotable moment stood out for this skill.'),
    ).toBeInTheDocument();
    // Four of the six skills had nothing to quote.
    expect(screen.getAllByText('No quotable moment stood out for this skill.')).toHaveLength(4);
  });

  it('opens the conversation around a quote in place', async () => {
    const user = userEvent.setup();
    await renderSpec();
    const opening = screen
      .getByRole('heading', { level: 3, name: 'Opening & Rapport' })
      .closest('article') as HTMLElement;
    await user.click(within(opening).getByText('See it in the conversation'));
    const around = within(opening).getByRole('list', { name: 'The conversation around turn 2' });
    expect(
      within(around).getByText(
        "Hello, I'm Carmen. I can't find the Export button on the invoices page.",
      ),
    ).toBeInTheDocument();
    expect(within(around).getByText('Hi how shall i help u').closest('li')).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('shows the opportunity with what was said, why it matters and a stronger way to say it', async () => {
    const user = userEvent.setup();
    await renderSpec();
    const card = screen
      .getByRole('heading', { level: 3, name: 'A moment to rework: empathy' })
      .closest('article') as HTMLElement;
    expect(within(card).getByText('Empathy & De-escalation')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Turn 4, view in transcript' })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/transcript?turn=4`,
    );
    expect(within(card).getByText('What you said')).toBeInTheDocument();
    expect(within(card).getByText("\u201cNo, I can't help with that.\u201d")).toBeInTheDocument();
    expect(within(card).getByText('See it in the conversation')).toBeInTheDocument();
    expect(within(card).getByText('Why it matters')).toBeInTheDocument();
    expect(within(card).getByText(/damages customer trust/)).toBeInTheDocument();
    expect(within(card).getByText('A stronger way to say it')).toBeInTheDocument();
    expect(within(card).getByText(/Let's look at the screen together/)).toBeInTheDocument();
    expect(within(card).getByText('Why it works')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Copy phrasing' }));
    expect(await navigator.clipboard.readText()).toMatch(/^I completely understand/);
    // The same item is summarised in "Areas to improve" and links to the detail.
    const areas = screen.getByRole('region', { name: 'Areas to improve' });
    expect(
      within(areas).getByRole('link', { name: /see a stronger way to say it/i }),
    ).toHaveAttribute('href', '#imp-0');
  });

  it('describes discovery: found 0 of 4, the three counts and every fact with its status and importance', async () => {
    await renderSpec();
    expect(screen.getByRole('heading', { level: 2, name: 'Discovery' })).toBeInTheDocument();
    expect(screen.getByText('Found 0 of 4 hidden facts')).toBeInTheDocument();
    expect(screen.getByText('0 found')).toBeInTheDocument();
    expect(screen.getByText('0 partly found')).toBeInTheDocument();
    expect(screen.getByText('4 missed')).toBeInTheDocument();

    const facts = [
      ['Three-dots icon she has not opened', 'Critical'],
      ['Browser window fills half the screen', 'Important'],
      ["Last month's invoices for a 2 pm meeting", 'Important'],
      ['Following an old training guide', 'Helpful'],
    ] as const;
    for (const [label, importance] of facts) {
      const card = screen
        .getByRole('heading', { level: 3, name: label })
        .closest('article') as HTMLElement;
      expect(within(card).getByText('Missed')).toBeInTheDocument();
      expect(within(card).getByText(importance)).toBeInTheDocument();
      expect(card).toHaveTextContent(`Importance: ${importance}`);
      expect(within(card).getByText('A question worth asking')).toBeVisible();
      expect(within(card).getByText('What the customer had held back')).toBeInTheDocument();
      expect(within(card).getByText('The customer would have said')).toBeVisible();
      expect(within(card).getByText('Why it mattered')).toBeVisible();
    }
    expect(
      screen.getByText(
        'Can you tell me what you can see across the top of the invoice list, from left to right?',
      ),
    ).toBeInTheDocument();
  });

  it('draws the customer temperature, names the turning point and moves between points with the arrow keys', async () => {
    const user = userEvent.setup();
    await renderSpec();
    const section = screen.getByRole('region', { name: 'Customer temperature' });
    expect(within(section).getByText('Started Calm, ended Concerned.')).toBeInTheDocument();
    expect(
      within(section).getByRole('img', {
        name: 'Customer mood timeline: started Calm, ended Concerned.',
      }),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(
        /The customer is simulated, so heights show direction rather than exact measurements\./,
      ),
    ).toBeInTheDocument();

    const panel = within(section).getByRole('group', { name: 'Selected moment' });
    expect(within(panel).getByText('Turn 8')).toBeInTheDocument();
    expect(within(panel).getByText('Point 5 of 6')).toBeInTheDocument();
    expect(within(panel).getByText('Turning point')).toBeInTheDocument();
    expect(within(panel).getByText('Rose, still Calm.')).toBeInTheDocument();
    expect(within(panel).getByText('Dismissed the customer\u2019s concern')).toBeInTheDocument();
    expect(
      within(panel).getByText('No single phrase stands out for this moment.'),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /view in transcript/i })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/transcript?turn=8`,
    );

    const selected = within(section).getByRole('button', { name: /^Turn 8,/ });
    selected.focus();
    await user.keyboard('{ArrowLeft}');
    expect(within(section).getByRole('button', { name: /^Turn 6,/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(within(panel).getByText('Turn 6')).toBeInTheDocument();
  });

  it('explains why no points were earned, and links to the rewards', async () => {
    await renderSpec();
    const section = await screen.findByRole('region', { name: 'Rewards from this call' });
    expect(
      await within(section).findByText(/Calls that end early earn no points\./),
    ).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /how points are earned/i })).toHaveAttribute(
      'href',
      '/rewards',
    );
  });

  it('suggests the next call at the suggested difficulty and keeps the closing explanations visible', async () => {
    const user = userEvent.setup();
    await renderSpec();
    const next = screen.getByRole('region', { name: 'Next practice target' });
    expect(within(next).getByText('Focus skill')).toBeInTheDocument();
    expect(within(next).getByText('Empathy & De-escalation')).toBeInTheDocument();
    expect(
      within(next).getByText(
        'Recognising the customer\u2019s situation and responding in ways that lower tension.',
      ),
    ).toBeInTheDocument();
    expect(
      within(next).getByText(/Practise maintaining a calm, professional tone/),
    ).toBeInTheDocument();
    expect(within(next).getByText('Suggested next call')).toBeInTheDocument();
    expect(
      within(next).getByText('Team cannot open the shared project workspace'),
    ).toBeInTheDocument();
    expect(within(next).getByText('Starter')).toBeInTheDocument();
    const practise = within(next).getByRole('link', { name: /practise this next/i });
    expect(practise).toHaveAttribute('href', '/scenarios/team-cannot-open-shared-workspace/setup');
    expect(
      within(next).getByRole('link', { name: 'Practise this scenario again' }),
    ).toHaveAttribute('href', '/scenarios/cannot-find-export-feature/setup');
    expect(within(next).getByRole('link', { name: /review transcript/i })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/transcript`,
    );

    // Opening the setup carries the suggested difficulty with it.
    await user.click(practise);
    expect(loadDraft()).toEqual({
      scenarioId: 'team-cannot-open-shared-workspace',
      overrides: { difficulty: 'starter' },
    });
  });

  it('closes with what the report is, its limits, the rubric and the training-aid reminder', async () => {
    const user = userEvent.setup();
    await renderSpec();
    const about = screen.getByRole('region', { name: 'About this report' });
    expect(
      within(about).getByText(
        /practice coaching generated automatically \(Firefly model evaluator\), not an assessment of your performance/,
      ),
    ).toBeInTheDocument();
    expect(within(about).getByText(/can be incomplete or wrong/)).toBeInTheDocument();
    // The reminder that scores are for practice ends both the disclaimer and the footer line.
    expect(
      within(about).getAllByText(/Scores are for practice, not performance assessment\./i),
    ).toHaveLength(2);
    expect(
      within(about).getByText(
        'Firefly is a training aid. Scenarios are fictional; never enter real customer information. Scores are for practice, not performance assessment.',
      ),
    ).toBeInTheDocument();

    await user.click(within(about).getByText('Report details and scoring rubric'));
    expect(within(about).getByText('Firefly model evaluator, version model-1.0.0')).toBeVisible();
    expect(within(about).getByText('Scoring rubric')).toBeVisible();
    expect(
      within(about).getByText(/Critical behaviours were absent or counterproductive/),
    ).toBeVisible();
  });

  it('lets someone report incorrect feedback without sharing the conversation', async () => {
    const user = userEvent.setup();
    await renderSpec();
    await user.click(screen.getByRole('button', { name: 'Report incorrect feedback' }));
    const dialog = await screen.findByRole('dialog', { name: 'Report incorrect feedback' });

    await user.selectOptions(
      within(dialog).getByLabelText('Which skill looks wrong?'),
      'empathy-deescalation',
    );
    await user.type(within(dialog).getByLabelText('Turn number'), '4');
    await user.click(within(dialog).getByRole('button', { name: 'Copy a note for your mentor' }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toContain(`Session: ${SESSION_ID}`);
    expect(copied).toContain('Skill: Empathy & De-escalation');
    expect(copied).toContain('Turn: 4');
    // Nothing from the conversation or the report's own words goes into the note.
    for (const turn of makeSpecSession().turns) expect(copied).not.toContain(turn.text);
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    const issue = within(dialog).getByRole('link', { name: /open an issue on github/i });
    expect(issue.getAttribute('href')).toMatch(
      /^https:\/\/github\.com\/snowjug\/Firefly\/issues\/new\?/,
    );
    expect(issue).toHaveAttribute('target', '_blank');
    expect(issue.getAttribute('rel')).toContain('noopener');
    expect(within(dialog).getByText(/never paste real customer information/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'calibration page' })).toHaveAttribute(
      'href',
      '/calibration',
    );

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('checks the turn number before it goes into the note', async () => {
    const user = userEvent.setup();
    await renderSpec();
    await user.click(screen.getByRole('button', { name: 'Report incorrect feedback' }));
    const dialog = await screen.findByRole('dialog', { name: 'Report incorrect feedback' });
    const turn = within(dialog).getByLabelText('Turn number');
    await user.type(turn, '99');
    expect(turn).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByText('Use a whole number from 1 to 10.')).toBeInTheDocument();
    const note = within(dialog).getByLabelText('The note you will copy') as HTMLTextAreaElement;
    expect(note.value).toContain('Turn: Not sure');
  });
});

describe('Report page: a completed call', () => {
  it('shows six skills with scores in words and evidence that links to its turn', async () => {
    getSession.mockResolvedValue(makeSession());
    renderReport();
    await screen.findByRole('heading', FOUND);

    for (const id of DIMENSION_IDS) {
      expect(
        screen.getByRole('heading', { level: 3, name: DIMENSIONS[id].label }),
      ).toBeInTheDocument();
    }
    const openingCard = screen
      .getByRole('heading', { level: 3, name: 'Opening & Rapport' })
      .closest('article') as HTMLElement;
    expect(openingCard).toHaveTextContent('4 of 5 \u2013 Strong');
    expect(
      within(openingCard).getByRole('link', { name: 'Turn 4, view in transcript' }),
    ).toHaveAttribute('href', `/sessions/${SESSION_ID}/transcript?turn=4`);

    expect(screen.getByRole('img', { name: 'Overall score: 3.7 out of 5' })).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByText('Ended early')).not.toBeInTheDocument();
  });

  it('shows what went well with its quotes, and the improvement about something that never happened without a broken link', async () => {
    getSession.mockResolvedValue(makeSession());
    renderReport();
    await screen.findByRole('heading', FOUND);

    const strengths = screen.getByRole('region', { name: 'What went well' });
    expect(within(strengths).getByText('Recapped what was agreed')).toBeInTheDocument();
    expect(within(strengths).getAllByText('Why it helped')).toHaveLength(2);
    expect(
      within(strengths).getAllByRole('link', { name: /view in transcript/i }).length,
    ).toBeGreaterThan(0);

    const title = screen.getByRole('heading', {
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
    expect(within(found).getByText('Your question')).toBeInTheDocument();
    expect(
      within(found).getByRole('link', { name: 'Turn 4, view in transcript' }),
    ).toBeInTheDocument();
    const partly = screen
      .getByRole('heading', { level: 3, name: 'The message says the account is locked' })
      .closest('article') as HTMLElement;
    expect(within(partly).getByText('Partly found')).toBeInTheDocument();
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

  it('shows the curveball a call met, and says it is still open when the call ended first', async () => {
    getSession.mockResolvedValue(
      makeSpecSession({
        report: {
          ...(makeSpecSession().report as NonNullable<
            ReturnType<typeof makeSpecSession>['report']
          >),
          curveball: {
            type: 'ask-manager',
            firedAtTurn: 4,
            status: 'active',
            assessment: 'After turn 4 the customer asked for a manager.',
          },
        },
      }),
    );
    renderReport();
    const curveball = (
      await screen.findByRole('heading', { level: 3, name: 'Asks for a manager' })
    ).closest('article') as HTMLElement;
    expect(within(curveball).getByText('Still open when the call ended')).toBeInTheDocument();
    expect(within(curveball).getByRole('link', { name: /view turn 4/i })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/transcript?turn=4`,
    );
    expect(
      within(screen.getByRole('navigation', { name: 'On this page' })).getByRole('link', {
        name: 'Curveball',
      }),
    ).toHaveAttribute('href', '#curveball');
  });

  it('marks a sample session and a mentor review', async () => {
    getSession.mockResolvedValue(makeSession({ isSample: true, mentorReviewed: true }));
    renderReport();
    await screen.findByRole('heading', FOUND);
    expect(screen.getByText('Sample session')).toBeInTheDocument();
    expect(screen.getByText('Mentor reviewed')).toBeInTheDocument();
    expect(screen.getByText(/Sample sessions are generated by Firefly/)).toBeInTheDocument();
  });
});

describe('Report page: rewards from this call', () => {
  it('lists what this call earned and why, with its quotes, and the badge it completed', async () => {
    const session = makeSession();
    getSession.mockResolvedValue(session);
    rewards.mockResolvedValue(
      makeRewards({
        points: 145,
        ledger: [
          makeLedgerEntry({ id: 'full', points: 50 }),
          makeLedgerEntry({
            id: 'fact',
            ruleId: 'hidden-fact',
            points: 10,
            title: 'Found: Started right after the password change',
            reason: 'Your question uncovered this in "Locked out after a password reset".',
            evidence: {
              turnIndex: 4,
              quote: 'When did it start, and did anything change recently?',
            },
          }),
          makeLedgerEntry({
            id: 'day',
            ruleId: 'practice-day',
            points: 5,
            sessionId: null,
            at: session.endedAt as string,
            title: 'Practised on 12 Nov',
            reason: 'You completed a full call on 12 Nov 2026.',
          }),
          makeLedgerEntry({
            id: 'earlier',
            sessionId: 'another-call',
            points: 80,
            title: 'An earlier call',
          }),
        ],
        badges: [
          makeBadge({ earned: true, earnedInSessionId: SESSION_ID, earnedAt: session.endedAt }),
          makeBadge({
            id: 'scope-detective',
            title: 'Scope Detective',
            earned: true,
            earnedInSessionId: 'another-call',
          }),
        ],
      }),
    );
    renderReport();

    const section = await screen.findByRole('region', { name: 'Rewards from this call' });
    await within(section).findByText('You earned 65 points from this call');
    const entries = within(section)
      .getAllByRole('listitem')
      .filter((item) => item.classList.contains('rp-ledger-item'));
    expect(entries).toHaveLength(3);
    expect(within(section).getByText('Completed a full scenario')).toBeInTheDocument();
    expect(within(section).getByText(/Your question uncovered this/)).toBeInTheDocument();
    expect(
      within(section).getByText('\u201cWhen did it start, and did anything change recently?\u201d'),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole('link', { name: 'Turn 4, view in transcript' }),
    ).toHaveAttribute('href', `/sessions/${SESSION_ID}/transcript?turn=4`);
    expect(within(section).getByText('Practised on 12 Nov')).toBeInTheDocument();
    expect(within(section).queryByText('An earlier call')).not.toBeInTheDocument();
    expect(within(section).getByText('Badge earned: First Practice')).toBeInTheDocument();
    expect(within(section).queryByText(/Scope Detective/)).not.toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /see all your rewards/i })).toHaveAttribute(
      'href',
      '/rewards',
    );
    expect(within(section).getByText(/never compared with anyone else/i)).toBeInTheDocument();
  });

  it('asks for the rewards in the learner\u2019s time zone', async () => {
    getSession.mockResolvedValue(makeSession());
    renderReport();
    await screen.findByRole('region', { name: 'Rewards from this call' });
    expect(rewards).toHaveBeenCalledTimes(1);
    expect(rewards.mock.calls[0]?.[0]).toBe(new Date().getTimezoneOffset());
  });

  it('says plainly when a finished call earned nothing', async () => {
    getSession.mockResolvedValue(makeSession());
    rewards.mockResolvedValue(
      makeRewards({ ledger: [makeLedgerEntry({ sessionId: 'another-call' })] }),
    );
    renderReport();
    const section = await screen.findByRole('region', { name: 'Rewards from this call' });
    expect(
      await within(section).findByText('No points were recorded for this call.'),
    ).toBeInTheDocument();
  });

  it('leaves the section out, and the rest of the report alone, when the rewards cannot be loaded', async () => {
    getSession.mockResolvedValue(makeSession());
    rewards.mockRejectedValue(new ApiError(500, 'internal', 'Something went wrong.', true));
    renderReport();
    await screen.findByRole('heading', FOUND);
    await waitFor(() => expect(rewards).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Rewards from this call' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole('navigation', { name: 'On this page' })).queryByRole('link', {
        name: 'Rewards',
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Six skill scores' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Next practice target' }),
    ).toBeInTheDocument();
  });

  it('also leaves it out if the request cannot even start', async () => {
    getSession.mockResolvedValue(makeSession());
    rewards.mockImplementation(() => {
      throw new Error('offline');
    });
    renderReport();
    await screen.findByRole('heading', FOUND);
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Rewards from this call' }),
      ).not.toBeInTheDocument(),
    );
  });
});
