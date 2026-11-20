import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIMENSION_IDS, DIMENSIONS, scoreLabel } from '#shared/domain/vocab.ts';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { ReportOverview } from './ReportOverview.tsx';
import { pickCallRewards } from './RewardsSection.tsx';
import { SectionRail } from './SectionRail.tsx';
import { SkillConstellation, armsFor } from './SkillConstellation.tsx';
import {
  OVERALL_CAPTION,
  feedbackNote,
  issueUrl,
  noPointsReason,
  reportSubline,
} from './labels.ts';
import {
  SESSION_ID,
  makeBadge,
  makeEarlyReport,
  makeLedgerEntry,
  makeReport,
  makeRewards,
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

afterEach(() => {
  stubMatchMedia(false);
  vi.unstubAllGlobals();
});

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

describe('the opening of the report', () => {
  function renderOverview(report = makeReport()) {
    return render(
      <MemoryRouter>
        <ReportOverview report={report} />
      </MemoryRouter>,
    );
  }

  it('says the overall score in words with its caption, and sets it on a ruler that adds no noise', () => {
    renderOverview();
    const figure = screen.getByRole('img', { name: 'Overall score: 3.7 out of 5' });
    expect(figure).toBeInTheDocument();
    // The ruler inside is a picture of that sentence: it is not announced a second time.
    expect(within(figure).queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(scoreLabel(3.7))).toBeInTheDocument();
    expect(screen.getByText(OVERALL_CAPTION)).toBeInTheDocument();
    expect(screen.getByText(makeReport().summary.overall)).toBeInTheDocument();
  });

  it('draws an empty ruler and says so when there is no overall score', () => {
    const base = makeReport();
    renderOverview(makeReport({ summary: { ...base.summary, overallScore: null } }));
    expect(screen.getByRole('img', { name: 'No overall score for this call' })).toBeInTheDocument();
    expect(screen.getByText('No overall score for this call.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Overall score:/ })).not.toBeInTheDocument();
    expect(screen.queryByText(OVERALL_CAPTION)).not.toBeInTheDocument();
  });

  it('sets the facts about the call as rows of one ledger, with the skills to look at first as links', () => {
    renderOverview();
    const facts = screen.getByRole('group', { name: 'At a glance' });
    expect(within(facts).getByText('Hidden facts found').nextElementSibling).toHaveTextContent(
      '1 of 3',
    );
    expect(within(facts).getByText('Customer mood').nextElementSibling).toHaveTextContent(
      'Frustrated to Calm',
    );
    expect(within(facts).getByText('Your turns').nextElementSibling).toHaveTextContent('8');
    expect(
      within(facts).getByRole('link', { name: DIMENSIONS['scoping-discovery'].label }),
    ).toHaveAttribute('href', '#dim-scoping-discovery');
    expect(within(facts).getByRole('link', { name: DIMENSIONS.clarity.label })).toHaveAttribute(
      'href',
      '#dim-clarity',
    );
  });

  it('leaves out quick facts it has nothing to say about', () => {
    const base = makeReport();
    renderOverview(
      makeReport({
        discovery: { results: [], found: 0, partial: 0, missed: 0, total: 0 },
        journey: { ...base.journey, points: [] },
        summary: { ...base.summary, coachingFocus: [] },
      }),
    );
    const facts = screen.getByRole('group', { name: 'At a glance' });
    expect(within(facts).queryByText('Hidden facts found')).not.toBeInTheDocument();
    expect(within(facts).queryByText('Customer mood')).not.toBeInTheDocument();
    expect(within(facts).queryByText('Coaching focus')).not.toBeInTheDocument();
    expect(within(facts).getByText('Your turns')).toBeInTheDocument();
  });
});

describe('the six skills as a constellation', () => {
  it('lists the skills in call order, each a link to its details named in numbers and words', () => {
    const { container } = render(
      <SkillConstellation dimensions={[...makeReport().dimensions].reverse()} />,
    );
    const items = [...container.querySelectorAll('.rp-const__item')];
    expect(items.map((item) => item.querySelector('a')?.getAttribute('href'))).toEqual(
      DIMENSION_IDS.map((id) => `#dim-${id}`),
    );
    const clarity = items[3] as HTMLElement;
    expect(clarity).toHaveTextContent(DIMENSIONS.clarity.label);
    expect(clarity).toHaveTextContent('3 of 5');
    expect(clarity).toHaveTextContent('Developing');
    // Weaker scores are drawn warmer, and the tone is a word the stylesheet reads, not a colour.
    expect(clarity).toHaveAttribute('data-tone', 'ok');
    expect(items[1]).toHaveAttribute('data-tone', 'low');
    expect(items[5]).toHaveAttribute('data-score', '5');
  });

  it('draws a skill resting on thin evidence as an outline, and says so in words', () => {
    const { container } = render(<SkillConstellation dimensions={makeEarlyReport().dimensions} />);
    const items = [...container.querySelectorAll('.rp-const__item')];
    expect(items[0]).toHaveTextContent('Not enough evidence');
    expect(items[1]).toHaveTextContent('Limited evidence');
    for (const item of items) {
      const solid = item.querySelector('.rp-const__star')?.hasAttribute('data-solid');
      expect(solid).toBe(item.getAttribute('data-sufficiency') === 'sufficient');
    }
    const full = render(<SkillConstellation dimensions={makeReport().dimensions} />);
    expect(full.container.querySelectorAll('.rp-const__star[data-solid]')).toHaveLength(6);
  });

  it('gives a higher score longer arms, within bounds', () => {
    expect(armsFor(5)).toBeGreaterThan(armsFor(3));
    expect(armsFor(3)).toBeGreaterThan(armsFor(1));
    expect(armsFor(9)).toBe(armsFor(5));
    expect(armsFor(0)).toBe(armsFor(1));
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
    const toggle = screen.getByRole('button', { name: 'See it in the conversation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: /around turn 4/i })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
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
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: /around turn 4/i })).not.toBeInTheDocument();
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

  it('is a rail of numbered links beside the page on a wide screen', () => {
    stubMatchMedia(true);
    render(<SectionRail items={items} />);
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    expect(within(nav).getByRole('link', { name: 'Discovery' })).toHaveAttribute(
      'href',
      '#discovery',
    );
    expect(within(nav).queryByText('Jump to a section')).not.toBeInTheDocument();
    expect(within(nav).getAllByRole('listitem')).toHaveLength(2);
  });

  it('folds into a "Jump to a section" disclosure on a narrow one', async () => {
    const user = userEvent.setup();
    stubMatchMedia(false);
    render(<SectionRail items={items} />);
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    await user.click(within(nav).getByText('Jump to a section'));
    expect(within(nav).getByRole('link', { name: 'Six skills' })).toBeVisible();
  });

  it('marks the section being read, and nothing near the top of the page', () => {
    stubMatchMedia(true);
    let notify: IntersectionObserverCallback = () => undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    for (const item of items) {
      const section = document.createElement('section');
      section.id = item.id;
      document.body.append(section);
    }
    render(<SectionRail items={items} />);
    const link = (name: string) => screen.getByRole('link', { name });
    expect(link('Discovery')).not.toHaveAttribute('aria-current');
    act(() =>
      notify(
        [
          { isIntersecting: true, target: document.getElementById('discovery') },
        ] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      ),
    );
    expect(link('Discovery')).toHaveAttribute('aria-current', 'location');
    expect(link('Six skills')).not.toHaveAttribute('aria-current');
    for (const item of items) document.getElementById(item.id)?.remove();
  });
});
