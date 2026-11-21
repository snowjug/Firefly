import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import {
  CURVEBALL_LABELS,
  DIMENSIONS,
  DIMENSION_IDS,
  SCORE_DESCRIPTIONS,
} from '#shared/domain/vocab.ts';
import { ApiError } from '../../lib/api.ts';
import { ReportView } from './ReportView.tsx';
import { toBriefHref } from './brief-href.ts';
import { callFixtures, type CallFixture } from './fixtures.ts';
import {
  scriptedClient,
  renderAtReport,
  must,
  stubMatchMedia,
  stubScroll,
  type FakeClient,
} from './test-utils.tsx';

let calls: Record<string, CallFixture>;

beforeEach(async () => {
  calls = await callFixtures();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function show(name: string, client: FakeClient = scriptedClient(calls[name]!.session)) {
  const { session, report } = calls[name] as CallFixture;
  return {
    client,
    ...renderAtReport(
      <ReportView session={session} report={report} client={client} reveal={false} />,
    ),
  };
}

const region = (name: string) => screen.getByRole('region', { name });

/** The value beside a label in the header's list of facts. */
function meta(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: 'dt' });
  const value = term.parentElement?.querySelector('dd');
  if (!value) throw new Error(`No value for ${label}`);
  return value;
}

describe('the header', () => {
  it('names the page and the scenario, with a breadcrumb back to the scenarios', () => {
    show('strong');
    expect(screen.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeInTheDocument();
    expect(screen.getByText('Team cannot open the shared project workspace')).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(within(crumbs).getByText('Report')).toHaveAttribute('aria-current', 'page');
  });

  it('shows who the customer was, when, for how long, how it ended and how it was set up', () => {
    show('strong');
    const { session } = calls.strong as CallFixture;
    expect(meta('Customer')).toHaveTextContent('Daniel Osei');
    expect(meta('Customer')).toHaveTextContent('Project lead');
    expect(meta('Customer')).toHaveTextContent('Proseware Consulting');
    expect(meta('Date and time')).toHaveTextContent(/19 Nov 2026/);
    expect(meta('Call duration')).toHaveTextContent('4 min 10s');
    expect(meta('Completion')).toHaveTextContent('Completed');
    expect(meta('Starting state')).toHaveTextContent('Frustrated');
    expect(meta('Ending state')).toHaveTextContent('Calm');
    expect(meta('Difficulty')).toHaveTextContent('Standard');
    expect(meta('Live hints')).toHaveTextContent('Off');
    expect(session.durationSeconds).toBe(250);
  });

  it('says Ended early, and that live hints were on, for a short guided call', () => {
    show('short');
    expect(meta('Completion')).toHaveTextContent('Ended early');
    expect(meta('Live hints')).toHaveTextContent('On');
    expect(meta('Difficulty')).toHaveTextContent('Starter');
  });

  it('has buttons to print the report and to go to the transcript', async () => {
    const { scroll, restore } = stubScroll();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    try {
      show('strong');
      const header = screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
      await userEvent.click(within(header).getByRole('button', { name: 'Print report' }));
      expect(print).toHaveBeenCalledTimes(1);
      await userEvent.click(within(header).getByRole('button', { name: 'Review transcript' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Transcript' })).toHaveFocus();
      expect(scroll).toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

describe('the summary', () => {
  it('gives the evaluator\u2019s summary, and the overall score second to the six skills', () => {
    show('strong');
    const summary = region('Overall coaching summary');
    expect(summary).toHaveTextContent(
      (calls.strong as CallFixture).report.summary.overall.slice(0, 40),
    );
    expect(within(summary).getByText('4.5')).toBeInTheDocument();
    expect(summary).toHaveTextContent('4.5 of 5');
    expect(summary).toHaveTextContent('A practice signal, not a grade.');
    expect(summary).toHaveTextContent('Average across the six skills.');
  });

  it('says there is not enough evidence for an overall score when there is none', () => {
    show('short');
    const summary = region('Overall coaching summary');
    expect(summary).toHaveTextContent('Not enough evidence for an overall score');
    expect(summary).toHaveTextContent('A practice signal, not a grade.');
    expect(summary).not.toHaveTextContent(/\d of 5/);
  });

  it('says it is practice coaching written by the evaluator, and can be wrong', () => {
    show('strong');
    const summary = region('Overall coaching summary');
    expect(within(summary).getByText('Written by the coaching evaluator')).toBeInTheDocument();
    expect(summary).toHaveTextContent(
      "Practice coaching, not employee-performance assessment. Written by Firefly's built-in rules evaluator (demo mode). It can be incomplete or wrong: review it with a mentor.",
    );
  });

  it('names a language model by its real label when one wrote the coaching', () => {
    const { session, report } = calls.strong as CallFixture;
    const modelReport: CoachingReport = {
      ...report,
      evaluator: {
        kind: 'model',
        name: 'Firefly model evaluator',
        version: 'v1',
        providerLabel: 'Gemini (gemini-3.5-flash-lite)',
      },
    };
    renderAtReport(
      <ReportView
        session={{
          ...session,
          providerKind: 'gemini',
          providerLabel: 'Gemini (gemini-3.5-flash-lite)',
          report: modelReport,
        }}
        report={modelReport}
        client={scriptedClient(session)}
        reveal={false}
      />,
    );
    expect(region('Overall coaching summary')).toHaveTextContent(
      'Written by the language model Gemini (gemini-3.5-flash-lite).',
    );
    expect(region('About this report')).toHaveTextContent(
      'A language model, checked against the transcript',
    );
  });

  it('lists the skills the scenario practises', () => {
    show('strong');
    expect(region('Overall coaching summary')).toHaveTextContent(
      'Scoping & Discovery, Empathy & De-escalation and Ownership & Next Steps',
    );
  });

  it('adds a note about limited evidence for a short or ended-early call, and only then', () => {
    show('short');
    const note = (calls.short as CallFixture).report.completion.note as string;
    expect(region('Overall coaching summary')).toHaveTextContent(note);
    cleanup();
    show('strong');
    expect(region('Overall coaching summary')).not.toHaveTextContent(
      'More turns would give firmer coaching',
    );
  });

  it('warns that spoken turns were transcribed automatically, and only when there were some', () => {
    show('voice');
    expect(region('Overall coaching summary')).toHaveTextContent(
      'Parts of this call were spoken and transcribed automatically. Speech recognition can mishear words, so check the quotes against what you said.',
    );
    cleanup();
    show('strong');
    expect(screen.queryByText(/transcribed automatically/)).not.toBeInTheDocument();
  });

  it('carries a print header with the date and what the report is', () => {
    show('strong');
    expect(screen.getByText(/Practice coaching, not performance assessment\./)).toBeInTheDocument();
    expect(screen.getByText(/^Printed \d/)).toBeInTheDocument();
  });
});

describe('the score table', () => {
  it('is a table with a caption, a header row and one row for each skill, in rubric order', () => {
    show('strong');
    const table = screen.getByRole('table', {
      name: 'Six coaching skills, each scored from 1 to 5',
    });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers.slice(0, 3)).toEqual(['Skill', 'Score', 'Evidence']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(
      DIMENSION_IDS.map((id) => DIMENSIONS[id].label),
    );
  });

  it('says each score in words as well as a bar, and how firm the evidence is', () => {
    show('weak');
    const { report } = calls.weak as CallFixture;
    const table = screen.getByRole('table', {
      name: 'Six coaching skills, each scored from 1 to 5',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    for (const [i, id] of DIMENSION_IDS.entries()) {
      const d = report.dimensions.find((x) => x.id === id) as CoachingReport['dimensions'][number];
      expect(rows[i]).toHaveTextContent(`${d.score} of 5`);
      expect(rows[i]).toHaveTextContent(d.label);
      expect(rows[i]).toHaveTextContent('Sufficient');
    }
  });

  it('uses the words Limited and Not enough evidence for thin evidence', () => {
    show('short');
    const table = screen.getByRole('table', {
      name: 'Six coaching skills, each scored from 1 to 5',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.every((row) => /Not enough evidence/.test(row.textContent ?? ''))).toBe(true);
  });

  it('links each row to its skill detail by name', () => {
    show('strong');
    for (const id of DIMENSION_IDS) {
      const link = screen.getByRole('link', { name: `Details for ${DIMENSIONS[id].label}` });
      expect(link).toHaveAttribute('href', `#skill-${id}`);
    }
  });

  it('opens a closed skill and focuses it when its Details link is followed', async () => {
    const { restore } = stubScroll();
    try {
      show('strong');
      const detail = document.getElementById('skill-clarity') as HTMLDetailsElement;
      expect(detail.open).toBe(false);
      await userEvent.click(screen.getByRole('link', { name: 'Details for Clarity' }));
      expect(detail.open).toBe(true);
      expect(within(detail).getByText('Clarity').closest('summary')).toHaveFocus();
    } finally {
      restore();
    }
  });
});

describe('strengths and opportunities', () => {
  it('shows each strength with its skill, title, exact quote, turn link and why it worked', () => {
    show('strong');
    const section = region('What went well');
    const { report } = calls.strong as CallFixture;
    for (const strength of report.strengths) {
      const item = within(section)
        .getByRole('heading', { level: 3, name: strength.title })
        .closest('li') as HTMLElement;
      expect(item).toHaveTextContent(DIMENSIONS[strength.dimension].label);
      expect(item).toHaveTextContent(strength.quote);
      expect(item).toHaveTextContent(`You, turn ${strength.turnIndex}`);
      expect(
        within(item).getByRole('link', {
          name: `See turn ${strength.turnIndex} in the transcript`,
        }),
      ).toHaveAttribute('href', `#turn-${strength.turnIndex}`);
      expect(item).toHaveTextContent('Why it worked');
      expect(item).toHaveTextContent(strength.whyItHelped.slice(0, 30));
    }
  });

  it('says so, and points to the opportunities, when no strength stood out', () => {
    show('weak');
    expect(region('What went well')).toHaveTextContent(
      'No clear strength stood out in this call. The opportunities below are the best place to start.',
    );
  });

  it('shows each opportunity with the risk, a stronger way to say it and why it works', () => {
    show('weak');
    const section = region('What to improve');
    const { report } = calls.weak as CallFixture;
    const blamed = report.improvements.find(
      (i) => i.turnIndex !== null,
    ) as CoachingReport['improvements'][number];
    const item = within(section)
      .getByRole('heading', { level: 3, name: blamed.title })
      .closest('li') as HTMLElement;
    expect(item).toHaveTextContent(blamed.quote as string);
    expect(item).toHaveTextContent('The risk');
    expect(item).toHaveTextContent('A stronger way to say it');
    expect(item).toHaveTextContent(blamed.betterPhrasing);
    expect(item).toHaveTextContent('Why it works');
    expect(
      within(item).getByRole('link', { name: /See turn \d+ in the transcript/ }),
    ).toBeInTheDocument();
  });

  it('says "Something that did not happen" for a gap with no turn, and links to no turn', () => {
    show('weak');
    const { report } = calls.weak as CallFixture;
    const gap = report.improvements.find(
      (i) => i.turnIndex === null,
    ) as CoachingReport['improvements'][number];
    const item = within(region('What to improve'))
      .getByRole('heading', { level: 3, name: gap.title })
      .closest('li') as HTMLElement;
    expect(item).toHaveTextContent('Something that did not happen');
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
    expect(item).toHaveTextContent(gap.betterPhrasing);
  });

  it('says so when there is no opportunity to show', () => {
    const { session, report } = calls.strong as CallFixture;
    const none: CoachingReport = { ...report, improvements: [] };
    renderAtReport(
      <ReportView
        session={{ ...session, report: none }}
        report={none}
        client={scriptedClient(session)}
        reveal={false}
      />,
    );
    expect(region('What to improve')).toHaveTextContent(
      'No specific opportunity to improve stood out in this call.',
    );
  });
});

describe('skill details', () => {
  it('has one disclosure for each skill, with the score, the rubric line and the rationale', async () => {
    show('strong');
    const section = region('Skill details');
    const { report } = calls.strong as CallFixture;
    for (const d of report.dimensions) {
      const detail = document.getElementById(`skill-${d.id}`) as HTMLDetailsElement;
      expect(detail).toBeInstanceOf(HTMLDetailsElement);
      expect(
        within(section).getByText(DIMENSIONS[d.id].label, { selector: 'summary span' }),
      ).toBeInTheDocument();
      expect(detail).toHaveTextContent(`${d.score} of 5, ${d.label}.`);
      expect(detail).toHaveTextContent(SCORE_DESCRIPTIONS[d.score] as string);
      expect(detail).toHaveTextContent(d.rationale.slice(0, 40));
      expect(detail).toHaveTextContent(d.guidance.slice(0, 40));
      expect(detail).toHaveTextContent('To strengthen this');
    }
  });

  it('cites the evidence quotes, each with its turn link, and says when none stood out', () => {
    show('weak');
    const { report } = calls.weak as CallFixture;
    const withEvidence = report.dimensions.find(
      (d) => d.evidence.length > 0,
    ) as CoachingReport['dimensions'][number];
    const detail = document.getElementById(`skill-${withEvidence.id}`) as HTMLElement;
    for (const e of withEvidence.evidence) {
      expect(detail).toHaveTextContent(e.quote);
      expect(
        within(detail).getAllByRole('link', { name: `See turn ${e.turnIndex} in the transcript` })
          .length,
      ).toBeGreaterThan(0);
    }
    const without = report.dimensions.find(
      (d) => d.evidence.length === 0,
    ) as CoachingReport['dimensions'][number];
    expect(document.getElementById(`skill-${without.id}`)).toHaveTextContent(
      'No quotable moment stood out for this skill.',
    );
  });

  it('says how firm each score is in words, and names the CARE behaviours as plain tags', () => {
    show('short');
    const detail = document.getElementById('skill-closing') as HTMLElement;
    expect(detail).toHaveTextContent(
      'There was not enough in the call to judge this skill with confidence',
    );
    expect(detail).toHaveTextContent('Be accountable');
    expect(detail).toHaveTextContent('Communicate effectively');
  });

  it('opens only the lowest-scored skill on a narrow screen, and every skill on a wide one', () => {
    show('weak');
    const open = () =>
      DIMENSION_IDS.filter(
        (id) => (document.getElementById(`skill-${id}`) as HTMLDetailsElement).open,
      );
    expect(open()).toEqual([(calls.weak as CallFixture).report.nextPractice.dimension]);
    cleanup();
    const restore = stubMatchMedia((query) => query === '(min-width: 64em)');
    try {
      show('weak');
      expect(open()).toEqual([...DIMENSION_IDS]);
    } finally {
      restore();
    }
  });

  it('can be focused from the keyboard and opened and closed (the browser toggles it on Enter or Space)', async () => {
    show('strong');
    const detail = document.getElementById('skill-clarity') as HTMLDetailsElement;
    const summary = within(detail).getByText('Clarity').closest('summary') as HTMLElement;
    summary.focus();
    expect(summary).toHaveFocus();
    expect(detail.open).toBe(false);
    await userEvent.click(summary);
    expect(detail.open).toBe(true);
    await userEvent.click(summary);
    expect(detail.open).toBe(false);
  });
});

describe('the discovery review', () => {
  it('says how many hidden facts were found, in the discovery review only', () => {
    show('strong');
    expect(region('Discovery review')).toHaveTextContent('You found 4 of 6 hidden facts.');
    expect(screen.getAllByText(/You found 4 of 6 hidden facts/)).toHaveLength(1);
    expect(meta('Customer').closest('dl')).not.toHaveTextContent(/hidden facts/);
  });

  it('groups the facts as found and missed, in the report\u2019s order, leaving none out', () => {
    show('strong');
    const section = region('Discovery review');
    const { report } = calls.strong as CallFixture;
    const headings = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['Found (4)', 'Missed (2)']);
    const titles = within(section)
      .getAllByRole('heading', { level: 4 })
      .map((h) => h.textContent);
    expect(titles).toEqual([
      ...report.discovery.results.filter((r) => r.status === 'discovered').map((r) => r.label),
      ...report.discovery.results.filter((r) => r.status === 'missed').map((r) => r.label),
    ]);
  });

  it('shows importance as a word and the status as an icon and a word', () => {
    show('strong');
    const { report } = calls.strong as CallFixture;
    const critical = report.discovery.results.find(
      (r) => r.importance === 'critical',
    ) as CoachingReport['discovery']['results'][number];
    const item = within(region('Discovery review'))
      .getByRole('heading', { level: 4, name: critical.label })
      .closest('li') as HTMLElement;
    expect(item).toHaveTextContent('Importance: Critical');
    expect(item).toHaveTextContent('Found');
  });

  it('shows what revealed a found fact and what had been held back', () => {
    show('strong');
    const { report } = calls.strong as CallFixture;
    const found = report.discovery.results.find(
      (r) => r.status === 'discovered',
    ) as CoachingReport['discovery']['results'][number];
    const item = within(region('Discovery review'))
      .getByRole('heading', { level: 4, name: found.label })
      .closest('li') as HTMLElement;
    expect(item).toHaveTextContent(`Revealed at turn ${found.revealedAtTurn} by your question`);
    expect(item).toHaveTextContent(found.revealingQuestion as string);
    expect(
      within(item).getByRole('link', {
        name: `See turn ${found.revealedAtTurn} in the transcript`,
      }),
    ).toBeInTheDocument();
    expect(item).toHaveTextContent('What the customer had held back');
    expect(item).toHaveTextContent(found.whatWasHidden);
    expect(item).not.toHaveTextContent('A question worth asking');
  });

  it('shows a better question and why it mattered for a missed fact, and no turn', () => {
    show('strong');
    const { report } = calls.strong as CallFixture;
    const missed = report.discovery.results.find(
      (r) => r.status === 'missed',
    ) as CoachingReport['discovery']['results'][number];
    const item = within(region('Discovery review'))
      .getByRole('heading', { level: 4, name: missed.label })
      .closest('li') as HTMLElement;
    expect(item).toHaveTextContent('Missed');
    expect(item).toHaveTextContent('A question worth asking');
    expect(item).toHaveTextContent(missed.betterQuestion);
    expect(item).toHaveTextContent('Why it mattered');
    expect(item).toHaveTextContent(missed.consequence);
    expect(item).not.toHaveTextContent('What the customer had held back');
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps a partly found fact in its own group with what it revealed and what is still open', () => {
    const { session, report } = calls.strong as CallFixture;
    const [first, ...rest] = report.discovery.results;
    const partial: CoachingReport = {
      ...report,
      discovery: {
        ...report.discovery,
        found: report.discovery.found - 1,
        partial: 1,
        results: [{ ...must(first, 'a discovery result'), status: 'partial' }, ...rest],
      },
    };
    renderAtReport(
      <ReportView
        session={{ ...session, report: partial }}
        report={partial}
        client={scriptedClient(session)}
        reveal={false}
      />,
    );
    const section = region('Discovery review');
    expect(section).toHaveTextContent(
      'You found 3 of 6 hidden facts, and 1 more was found partly.',
    );
    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Found (3)', 'Partly found (1)', 'Missed (2)']);
    const item = within(section)
      .getByRole('heading', { level: 4, name: (first as { label: string }).label })
      .closest('li') as HTMLElement;
    expect(item).toHaveTextContent('Partly found');
    expect(item).toHaveTextContent('What the customer had held back');
    expect(item).toHaveTextContent('A question worth asking');
  });
});

describe('next practice', () => {
  it('suggests one skill, what to do, a difficulty and a scenario, with a link to practise it', () => {
    show('weak');
    const next = (calls.weak as CallFixture).report.nextPractice;
    const section = region('Next practice');
    expect(section).toHaveTextContent(DIMENSIONS[next.dimension].label);
    expect(section).toHaveTextContent(next.recommendation.slice(0, 50));
    expect(section).toHaveTextContent('Starter');
    expect(section).toHaveTextContent(next.suggestedScenarioTitle as string);
    const link = within(section).getByRole('link', { name: 'Practise this next' });
    expect(link).toHaveAttribute(
      'href',
      `/scenarios?scenario=${next.suggestedScenarioId}&difficulty=${next.suggestedDifficulty}`,
    );
  });

  it('links to the scenarios alone when no scenario is suggested', () => {
    const { session, report } = calls.weak as CallFixture;
    const none: CoachingReport = {
      ...report,
      nextPractice: {
        ...report.nextPractice,
        suggestedScenarioId: null,
        suggestedScenarioTitle: null,
      },
    };
    renderAtReport(
      <ReportView
        session={{ ...session, report: none }}
        report={none}
        client={scriptedClient(session)}
        reveal={false}
      />,
    );
    const section = region('Next practice');
    expect(within(section).getByRole('link', { name: 'Practise this next' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(section).not.toHaveTextContent('Suggested scenario');
  });
});

describe('actions', () => {
  it('links to another scenario, the same one again with the same settings, and home', () => {
    show('curveball');
    const section = region('Actions');
    const { session } = calls.curveball as CallFixture;
    expect(within(section).getByRole('link', { name: 'Try another scenario' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(within(section).getByRole('link', { name: 'Repeat this scenario' })).toHaveAttribute(
      'href',
      toBriefHref(session),
    );
    expect(within(section).getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
  });

  it('opens the transcript and prints from the buttons', async () => {
    const { restore } = stubScroll();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    try {
      show('strong');
      const section = region('Actions');
      await userEvent.click(within(section).getByRole('button', { name: 'Print report' }));
      expect(print).toHaveBeenCalledTimes(1);
      await userEvent.click(within(section).getByRole('button', { name: 'Review transcript' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Transcript' })).toHaveFocus();
    } finally {
      restore();
    }
  });

  it('asks before deleting, says what goes, and does nothing on Cancel', async () => {
    const { client } = show('strong');
    const opener = screen.getByRole('button', { name: 'Delete this call' });
    await userEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Delete this call?' });
    expect(dialog).toHaveTextContent(
      'The transcript and the coaching report for this call are removed from this device.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(client.deleteSession).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it('closes on Escape without deleting', async () => {
    const { client } = show('strong');
    await userEvent.click(screen.getByRole('button', { name: 'Delete this call' }));
    const dialog = await screen.findByRole('dialog');
    // The browser sends `cancel` for Escape; jsdom does not, so send it.
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(client.deleteSession).not.toHaveBeenCalled();
  });

  it('deletes the call and goes to the scenarios when confirmed', async () => {
    const { client, router } = show('strong');
    await userEvent.click(screen.getByRole('button', { name: 'Delete this call' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this call?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete call' }));
    expect(client.deleteSession).toHaveBeenCalledWith('fx-strong');
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/scenarios'));
    expect(await screen.findByText('Scenarios page')).toBeInTheDocument();
  });

  it('keeps the dialog open and says why when the call could not be deleted', async () => {
    const client = scriptedClient((calls.strong as CallFixture).session);
    client.deleteSession.mockRejectedValue(
      new ApiError(500, 'internal', 'Something went wrong on our side. Please try again.', true),
    );
    const { router } = show('strong', client);
    await userEvent.click(screen.getByRole('button', { name: 'Delete this call' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this call?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete call' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The call was not deleted');
    expect(dialog).toHaveTextContent('Something went wrong on our side. Please try again.');
    expect(dialog).toHaveTextContent('Nothing was removed.');
    expect(router.state.location.pathname).toBe('/sessions/s1/report');
    expect(within(dialog).getByRole('button', { name: 'Delete call' })).toBeEnabled();
  });
});

describe('about this report', () => {
  it('names the evaluator, its version and provider, and says who played the customer', () => {
    show('strong');
    const section = region('About this report');
    const { report } = calls.strong as CallFixture;
    expect(section).toHaveTextContent(`${report.evaluator.name} (${report.evaluator.version})`);
    expect(section).toHaveTextContent('Built-in rules, not a language model');
    expect(section).toHaveTextContent(report.evaluator.providerLabel);
    expect(section).toHaveTextContent(
      "Firefly's built-in rules engine (demo mode), not a language model",
    );
  });

  it('gives the training note and the plain disclaimers', () => {
    show('strong');
    const section = region('About this report');
    expect(section).toHaveTextContent((calls.strong as CallFixture).report.trainingNote);
    expect(section).toHaveTextContent('practice coaching, not an assessment of your performance');
    expect(section).toHaveTextContent('can be incomplete or wrong');
    expect(section).toHaveTextContent(
      'A mentor\u2019s review adds what automatic coaching cannot.',
    );
    expect(section).toHaveTextContent('Scores are not compared with anyone else\u2019s.');
    expect(
      within(section).getByRole('link', { name: 'How Firefly uses AI and speech' }),
    ).toHaveAttribute('href', '/responsible-ai');
  });
});

describe('the page as a document', () => {
  it('has one level-one heading and no skipped levels, for every call', async () => {
    for (const name of Object.keys(calls)) {
      show(name);
      const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)));
      expect(
        levels.filter((l) => l === 1),
        name,
      ).toHaveLength(1);
      levels.forEach((level, i) => {
        if (i > 0)
          expect(level, `${name} heading ${i}`).toBeLessThanOrEqual((levels[i - 1] as number) + 1);
      });
      cleanup();
    }
  });

  it('lists its parts as named regions in the order the navigation lists them', () => {
    show('strong');
    const names = screen
      .getAllByRole('region')
      .map((r) => r.getAttribute('aria-labelledby'))
      .map((id) => document.getElementById(id as string)?.textContent);
    expect(names).toEqual([
      'Overall coaching summary',
      'Scores',
      'Customer temperature',
      'What went well',
      'What to improve',
      'Skill details',
      'Discovery review',
      'Next practice',
      'Actions',
      'Transcript',
      'About this report',
    ]);
  });

  it('gives every table a caption and every control and link a name', () => {
    show('curveball');
    for (const table of document.querySelectorAll('table')) {
      expect(table.querySelector('caption')?.textContent?.trim(), 'table caption').toBeTruthy();
    }
    for (const control of [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('link'),
      ...screen.getAllByRole('searchbox'),
      ...screen.getAllByRole('radio'),
    ]) {
      expect(control).toHaveAccessibleName();
    }
    for (const img of screen.queryAllByRole('img')) expect(img).toHaveAccessibleName();
  });

  it('says which part of the report is current as it is scrolled (the navigation marks it)', async () => {
    show('strong');
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    // Before anything has scrolled, the first part is the current one.
    expect(within(nav).getByRole('link', { name: 'Summary' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getAllByRole('link')).toHaveLength(11);
  });

  it('has the same places in a Jump to disclosure for narrow screens', () => {
    show('strong');
    const jump = screen.getByRole('navigation', { name: 'Jump to' });
    expect(
      within(jump)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(
      within(screen.getByRole('navigation', { name: 'On this page' }))
        .getAllByRole('link')
        .map((l) => l.textContent),
    );
  });

  it('shows no unexpected-turn block and no curveball wording for a call without one', () => {
    show('strong');
    expect(screen.queryByRole('heading', { name: 'Unexpected turn' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/curveball/i);
    cleanup();
    show('curveball');
    expect(document.body).not.toHaveTextContent(/curveball/i);
    expect(CURVEBALL_LABELS['previous-bad-experience'].label).toBe('Mentions a bad experience');
  });
});
