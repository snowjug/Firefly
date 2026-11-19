import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { pickCallRewards } from './RewardsSection.tsx';
import { ScoreOverview } from './ScoreOverview.tsx';
import { SectionNav } from './SectionNav.tsx';
import { feedbackNote, issueUrl, noPointsReason, reportSubline } from './labels.ts';
import {
  SESSION_ID,
  makeBadge,
  makeLedgerEntry,
  makeReport,
  makeRewards,
  makeSpecReport,
  makeTurns,
} from './report.fixtures.ts';
import { ReportTurnsContext, segmentAround } from './turns-context.ts';

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
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

afterEach(() => stubMatchMedia(false));

describe('the line under "Call feedback"', () => {
  const withScore = (
    overallScore: number | null,
    status: 'completed' | 'ended-early' = 'completed',
  ) =>
    makeReport({
      completion: {
        status,
        traineeTurns: 5,
        evidence: 'sufficient',
        note: null,
      },
      summary: { overall: 'x', overallScore, coachingFocus: [] },
    });

  it('describes the result instead of praising by default', () => {
    expect(reportSubline(withScore(4.6))).toMatch(/what worked well/);
    expect(reportSubline(withScore(3.2))).toMatch(/where a different choice could help/);
    expect(reportSubline(withScore(1.8))).toMatch(/clearest places to improve/);
    expect(reportSubline(withScore(null))).toMatch(/too little on this call for an overall score/);
    const lines = [4.6, 3.2, 1.8, null].map((score) => reportSubline(withScore(score)));
    expect(new Set(lines).size).toBe(4);
    for (const line of lines) expect(line).not.toMatch(/great|well done|congrat/i);
  });

  it('calls a call that ended early a first look, whatever it scored', () => {
    expect(reportSubline(withScore(4.8, 'ended-early'))).toMatch(/first look/);
  });
});

describe('why a call earned nothing', () => {
  const completion = makeReport().completion;
  it('uses the same terms as the rewards rules', () => {
    expect(noPointsReason({ isSample: true }, completion)).toMatch(/never earn points/);
    expect(noPointsReason({ isSample: false }, { ...completion, status: 'ended-early' })).toMatch(
      /^Calls that end early earn no points\./,
    );
    expect(
      noPointsReason({ isSample: false }, { ...completion, evidence: 'insufficient' }),
    ).toMatch(/too little on this call to coach/);
    expect(noPointsReason({ isSample: false }, completion)).toBe(
      'No points were recorded for this call.',
    );
  });
});

describe('the note for a mentor', () => {
  const evaluator = { name: 'Firefly model evaluator', version: 'model-1.0.0' };

  it('names the call, the skill and the turn, and nothing from the conversation', () => {
    const note = feedbackNote({
      sessionId: 'abc-123',
      skill: 'clarity',
      turn: 6,
      evaluator,
    });
    expect(note).toContain('Session: abc-123');
    expect(note).toContain('Skill: Clarity');
    expect(note).toContain('Turn: 6');
    expect(note).toContain('Firefly model evaluator, version model-1.0.0');
  });

  it('says "not sure" when the person did not pick a skill or a turn', () => {
    const note = feedbackNote({ sessionId: 'abc-123', skill: null, turn: null, evaluator });
    expect(note).toContain('Skill: Not sure (the whole report)');
    expect(note).toContain('Turn: Not sure');
  });

  it('opens a new issue on the project with the note filled in and a warning about real data', () => {
    const note = feedbackNote({ sessionId: 'abc-123', skill: 'closing', turn: 2, evaluator });
    const url = new URL(issueUrl(note));
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/snowjug/Firefly/issues/new');
    expect(url.searchParams.get('title')).toBe('Incorrect feedback in a coaching report');
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('Skill: Closing');
    expect(body).toMatch(/do not add real customer information/i);
  });
});

describe('what one call earned out of the whole ledger', () => {
  const session = {
    id: SESSION_ID,
    startedAt: '2026-11-12T10:00:00.000Z',
    endedAt: '2026-11-12T10:09:00.000Z',
  };

  it('keeps this call\u2019s entries, the day\u2019s points it triggered and its own badges', () => {
    const picked = pickCallRewards(
      makeRewards({
        ledger: [
          makeLedgerEntry({ id: 'a', points: 50 }),
          makeLedgerEntry({ id: 'b', sessionId: 'other', points: 50 }),
          makeLedgerEntry({
            id: 'day',
            ruleId: 'practice-day',
            sessionId: null,
            points: 5,
            at: session.endedAt,
          }),
          makeLedgerEntry({
            id: 'other-day',
            ruleId: 'practice-day',
            sessionId: null,
            points: 5,
            at: '2026-11-10T10:00:00.000Z',
          }),
        ],
        badges: [
          makeBadge({ earned: true, earnedInSessionId: SESSION_ID }),
          makeBadge({ id: 'scope-detective', earned: true, earnedInSessionId: 'other' }),
          makeBadge({ id: 'de-escalator', earned: false }),
        ],
      }),
      session,
    );
    expect(picked.entries.map((e) => e.id)).toEqual(['a', 'day']);
    expect(picked.points).toBe(55);
    expect(picked.badges.map((b) => b.id)).toEqual(['first-practice']);
  });

  it('finds nothing for a call that earned nothing', () => {
    const picked = pickCallRewards(
      makeRewards({ ledger: [makeLedgerEntry({ sessionId: 'other' })] }),
      session,
    );
    expect(picked).toEqual({ entries: [], badges: [], points: 0 });
  });
});

describe('the score row', () => {
  function renderScores(report = makeSpecReport()) {
    return render(
      <MemoryRouter>
        <ScoreOverview report={report} />
      </MemoryRouter>,
    );
  }

  it('draws an empty ring and says so when there is no overall score', () => {
    const base = makeReport();
    renderScores(makeReport({ summary: { ...base.summary, overallScore: null } }));
    expect(screen.getByRole('img', { name: 'No overall score for this call' })).toBeInTheDocument();
    expect(screen.getByText('No overall score for this call.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Overall score:/ })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Across the six skills. A practice signal, not a grade or a ranking.'),
    ).not.toBeInTheDocument();
  });

  it('lists the skills in rubric order with the number, its name and a warmer bar for weaker scores', () => {
    const { container } = renderScores(makeReport());
    const rows = [...container.querySelectorAll('.rp-skill-row')];
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(
      DIMENSION_IDS.map((id) => `#dim-${id}`),
    );
    const clarity = rows[3] as HTMLElement;
    expect(clarity).toHaveTextContent('3 of 5');
    expect(clarity).toHaveTextContent('Developing');
    expect(clarity).toHaveAttribute('data-tone', 'ok');
    expect(rows[1]).toHaveAttribute('data-tone', 'low');
  });

  it('leaves out quick facts it has nothing to say about', () => {
    const base = makeReport();
    renderScores(
      makeReport({
        discovery: { results: [], found: 0, partial: 0, missed: 0, total: 0 },
        journey: { ...base.journey, points: [] },
        summary: { ...base.summary, coachingFocus: [] },
      }),
    );
    const facts = screen.getByRole('list', { name: 'At a glance' });
    expect(within(facts).queryByText('Hidden facts found')).not.toBeInTheDocument();
    expect(within(facts).queryByText('Customer mood')).not.toBeInTheDocument();
    expect(within(facts).queryByText('Coaching focus')).not.toBeInTheDocument();
    expect(within(facts).getByText('Your turns')).toBeInTheDocument();
  });
});

describe('segmentAround', () => {
  it('returns up to two turns either side, oldest first', () => {
    const turns = makeTurns(10);
    expect(segmentAround(turns, 5).map((t) => t.index)).toEqual([3, 4, 5, 6, 7]);
    expect(segmentAround(turns, 1).map((t) => t.index)).toEqual([1, 2, 3]);
    expect(segmentAround(turns, 10).map((t) => t.index)).toEqual([8, 9, 10]);
  });
});

describe('EvidenceQuote in a report', () => {
  const quote = (
    <EvidenceQuote quote="Thanks, that helps." turn={4} href="/sessions/s/transcript?turn=4" />
  );

  it('offers no extra control outside a report', () => {
    render(<MemoryRouter>{quote}</MemoryRouter>);
    expect(screen.queryByText('See it in the conversation')).not.toBeInTheDocument();
  });

  it('opens the conversation around the quote in place, marking the cited turn', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportTurnsContext.Provider value={makeTurns(10)}>{quote}</ReportTurnsContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('list', { name: /around turn 4/i })).not.toBeInTheDocument();
    await user.click(screen.getByText('See it in the conversation'));
    const list = screen.getByRole('list', { name: 'The conversation around turn 4' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(within(list).getByText('Trainee message number 4.').closest('li')).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(items[0] as HTMLElement).getByText('Trainee message number 2.')).toBeVisible();
    expect(within(items[1] as HTMLElement).getByText('Customer message number 3.')).toBeVisible();
    // The link to the full transcript is still there.
    expect(screen.getByRole('link', { name: /turn 4, view in transcript/i })).toHaveAttribute(
      'href',
      '/sessions/s/transcript?turn=4',
    );
  });

  it('shows a turn without a quote and a quote without a link', () => {
    render(
      <MemoryRouter>
        <EvidenceQuote turn={3} href="/t?turn=3" />
        <EvidenceQuote quote="Only words." label="You said" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /turn 3/i })).toBeInTheDocument();
    expect(screen.getByText('\u201cOnly words.\u201d')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});

describe('"On this page"', () => {
  const items = [
    { id: 'skills', label: 'Six skills' },
    { id: 'discovery', label: 'Discovery' },
  ];

  it('is a row of links on a wide screen', () => {
    stubMatchMedia(true);
    render(<SectionNav items={items} />);
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    expect(within(nav).getByRole('link', { name: 'Discovery' })).toHaveAttribute(
      'href',
      '#discovery',
    );
    expect(within(nav).queryByText('Jump to a section')).not.toBeInTheDocument();
  });

  it('folds into a "Jump to a section" disclosure on a narrow one', async () => {
    const user = userEvent.setup();
    stubMatchMedia(false);
    render(<SectionNav items={items} />);
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    await user.click(within(nav).getByText('Jump to a section'));
    expect(within(nav).getByRole('link', { name: 'Six skills' })).toBeVisible();
  });
});
