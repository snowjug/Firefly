import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { ReportConstellation, constellationLayout } from './ReportConstellation.tsx';
import { ReportView } from './ReportView.tsx';
import { makeEarlyReport, makeReport, makeSession, makeTurns } from './report.fixtures.ts';
import { ReportTurnsContext, segmentAround } from './turns-context.ts';
import { EvidenceQuote } from './EvidenceQuote.tsx';

function withScores(scores: Partial<Record<(typeof DIMENSION_IDS)[number], number>>) {
  const base = makeReport();
  return makeReport({
    dimensions: base.dimensions.map((d) => ({ ...d, score: scores[d.id] ?? d.score })),
  });
}

function renderView(report: CoachingReport, proficiency: 'novice' | 'expert' = 'novice') {
  const session = makeSession({ report });
  session.scenario = {
    ...session.scenario,
    config: { ...session.scenario.config, proficiency },
  };
  return render(
    <MemoryRouter>
      <ReportView session={session} report={report} focusHeading={false} />
    </MemoryRouter>,
  );
}

describe('constellationLayout', () => {
  const nodes = constellationLayout(makeReport().dimensions);

  it('places the six skills in rubric order, starting at the top', () => {
    expect(nodes.map((n) => n.id)).toEqual([...DIMENSION_IDS]);
    expect(nodes[0]?.y).toBeLessThan(nodes[3]?.y ?? 0);
  });

  it('draws stronger skills larger, further out and brighter', () => {
    const weak = constellationLayout(withScores({ clarity: 1 }).dimensions).find(
      (n) => n.id === 'clarity',
    );
    const strong = constellationLayout(withScores({ clarity: 5 }).dimensions).find(
      (n) => n.id === 'clarity',
    );
    expect(weak && strong).toBeTruthy();
    expect(strong!.size).toBeGreaterThan(weak!.size);
    const distance = (n: { x: number; y: number }) => Math.hypot(n.x - 200, n.y - 200);
    expect(distance(strong!)).toBeGreaterThan(distance(weak!));
    expect(weak!.tier).toBe(0);
    expect(strong!.tier).toBe(4);
  });

  it('keeps every name inside the picture and off the lines', () => {
    for (const n of nodes) {
      expect(n.labelX).toBeGreaterThan(0);
      expect(n.labelX).toBeLessThan(100);
      expect(n.labelY).toBeGreaterThan(0);
      expect(n.labelY).toBeLessThan(100);
    }
    expect(nodes.map((n) => n.anchor)).toEqual([
      'middle',
      'start',
      'start',
      'middle',
      'end',
      'end',
    ]);
  });
});

describe('ReportConstellation', () => {
  it('is decorative: hidden from assistive technology and out of the tab order', () => {
    const { container } = render(<ReportConstellation dimensions={makeReport().dimensions} />);
    expect(container.querySelector('.rp-const')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.rp-star')).toHaveLength(6);
    for (const link of container.querySelectorAll('a')) {
      expect(link).toHaveAttribute('tabindex', '-1');
    }
    expect(container.querySelectorAll('.rp-const-label')).toHaveLength(6);
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
    expect(screen.getByRole('link', { name: /turn 4, view in transcript/i })).toBeInTheDocument();
  });
});

describe('the report experience', () => {
  it('shows what the call earned, each with proof from the conversation', () => {
    renderView(withScores({ 'ownership-next-steps': 5, closing: 5, clarity: 4 }), 'novice');
    const section = screen.getByRole('region', { name: 'Earned in this call' });
    expect(within(section).getByRole('heading', { name: 'Clear Ownership' })).toBeVisible();
    expect(within(section).getByRole('heading', { name: 'Complete the Loop' })).toBeVisible();
    expect(within(section).getByRole('heading', { name: 'Plain Language' })).toBeVisible();
    expect(
      within(section).getAllByRole('link', { name: /view in transcript/i }).length,
    ).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('link', { name: 'Earned' })).toBeInTheDocument();
  });

  it('does not award Plain Language when the customer was not new to the technology', () => {
    renderView(withScores({ clarity: 5 }), 'expert');
    expect(screen.queryByRole('heading', { name: 'Plain Language' })).not.toBeInTheDocument();
  });

  it('shows nothing earned for a call that ended early', () => {
    renderView(makeEarlyReport());
    expect(screen.queryByRole('region', { name: 'Earned in this call' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Earned' })).not.toBeInTheDocument();
  });

  it('keeps the six skills and their numbers available as plain text beside the constellation', () => {
    renderView(makeReport());
    const overview = screen.getAllByRole('link', { name: new RegExp(DIMENSIONS['clarity'].label) });
    expect(overview.length).toBeGreaterThan(0);
    expect(screen.getByText('3.7')).toBeInTheDocument();
  });
});
