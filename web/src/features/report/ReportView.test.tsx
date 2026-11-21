import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSIONS, DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { ApiError } from '../../lib/api.ts';
import { formatDuration } from '../../lib/format.ts';
import { ReportView } from './ReportView.tsx';
import { toBriefHref } from './brief-href.ts';
import { CALLS, SCENARIO_INDEX, asVersion1, withReport, type CallName } from './fixtures.ts';
import {
  must,
  renderAtReport,
  scriptedClient,
  stubScroll,
  type FakeClient,
} from './test-utils.tsx';

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function show(name: CallName, client: FakeClient = scriptedClient(CALLS[name].session)) {
  const { session, report } = CALLS[name];
  return {
    client,
    ...renderAtReport(
      <ReportView session={session} report={report} client={client} reveal={false} />,
    ),
  };
}

function showReport(name: CallName, report: CoachingReport, client?: FakeClient) {
  const session = withReport(CALLS[name], report);
  const fake = client ?? scriptedClient(session);
  return {
    client: fake,
    ...renderAtReport(
      <ReportView session={session} report={report} client={fake} reveal={false} />,
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

/** The row for a skill in the scores. */
function row(skill: string): HTMLElement {
  const item = region('Scores').querySelector<HTMLElement>(`li[data-rp-origin="${skill}"]`);
  if (!item) throw new Error(`No score row for ${skill}`);
  return item;
}

const expander = (container: HTMLElement, name: string | RegExp) =>
  within(container).getByRole('button', { name });

describe('the header', () => {
  it('names the page and the scenario, and says this is for training only', () => {
    show('strong');
    expect(screen.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeInTheDocument();
    expect(screen.getByText('Teams meeting recordings are missing')).toBeInTheDocument();
    expect(screen.getByText('Training only')).toBeInTheDocument();
  });

  it('shows the Microsoft product, when, how long, and how the customer began and ended', () => {
    show('strong');
    expect(meta('Product')).toHaveTextContent('Microsoft Teams');
    expect(meta('Product')).toHaveTextContent('Meetings');
    expect(meta('Date')).toHaveTextContent(/19 Nov 2026/);
    expect(meta('Duration')).toHaveTextContent(
      formatDuration(CALLS.strong.session.durationSeconds),
    );
    expect(meta('Start state')).toHaveTextContent('Frustrated');
    expect(meta('End state')).toHaveTextContent('Calm');
  });

  it('shows no product for a call saved before the Microsoft scenarios, and does not guess one', () => {
    show('legacy');
    expect(screen.queryByText('Product', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Microsoft/)).not.toBeInTheDocument();
    expect(meta('Start state')).toHaveTextContent('Concerned');
    expect(meta('End state')).toHaveTextContent('Calm');
  });

  it('says Ended early, and only for a call that ended early', () => {
    show('short');
    expect(screen.getByText('Ended early')).toBeInTheDocument();
    cleanup();
    show('strong');
    expect(screen.queryByText('Ended early')).not.toBeInTheDocument();
  });

  it('says it is demo mode when the call ran in demo mode', () => {
    show('strong');
    expect(screen.getByText('Demo mode')).toBeInTheDocument();
    cleanup();
    const live = { ...CALLS.strong.session, providerKind: 'gemini' as const };
    renderAtReport(
      <ReportView
        session={live}
        report={CALLS.strong.report}
        client={scriptedClient(live)}
        reveal={false}
      />,
    );
    expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
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
  it('gives the evaluator\u2019s summary and the average of the six skills', () => {
    show('strong');
    const summary = region('Summary');
    expect(summary).toHaveTextContent(CALLS.strong.report.summary.overall);
    expect(within(summary).getByText('4.2')).toBeInTheDocument();
    expect(summary).toHaveTextContent('4.2 of 5');
    expect(summary).toHaveTextContent('Average of the six skills');
  });

  it('says there is not enough evidence for an overall score when there is none', () => {
    show('short');
    const summary = region('Summary');
    expect(summary).toHaveTextContent('Not enough evidence for an overall score');
    expect(summary).not.toHaveTextContent(/\d of 5/);
  });

  it('says in one line that this is automatic practice feedback, not an assessment', () => {
    show('strong');
    expect(region('Summary')).toHaveTextContent(
      'Automatic practice feedback, not a performance assessment.',
    );
  });

  it('adds the note about limited evidence for a short or ended-early call, and only then', () => {
    show('short');
    expect(region('Summary')).toHaveTextContent(
      must(CALLS.short.report.completion.note, 'a completion note'),
    );
    cleanup();
    show('strong');
    expect(region('Summary')).not.toHaveTextContent('limited evidence');
  });

  it('carries a print header with the date and what the report is', () => {
    show('strong');
    expect(screen.getByText(/Practice coaching, not performance assessment\./)).toBeInTheDocument();
    expect(screen.getByText(/^Printed \d/)).toBeInTheDocument();
  });
});

describe('the scores', () => {
  it('is six rows, one for each skill, in rubric order', () => {
    show('strong');
    const rows = within(region('Scores')).getAllByRole('heading', { level: 3 });
    expect(rows).toHaveLength(6);
    DIMENSION_IDS.forEach((id, index) => {
      expect(rows[index]?.textContent?.startsWith(DIMENSIONS[id].label)).toBe(true);
    });
  });

  it('writes each score as a number, "of 5" and a word, in the line that opens the row', () => {
    show('weak');
    for (const d of CALLS.weak.report.dimensions) {
      const label = DIMENSIONS[d.id].label;
      const button = within(row(label)).getByRole('button', { name: new RegExp(`^${label}`) });
      expect(button).toHaveTextContent(`${d.score} of 5`);
      expect(button).toHaveTextContent(d.label);
    }
  });

  it('says how many quotes back each score', () => {
    show('strong');
    expect(row('Opening & Rapport')).toHaveTextContent('2 quotes');
    expect(row('Empathy & De-escalation')).toHaveTextContent('1 quote');
    cleanup();
    show('weak');
    expect(row('Opening & Rapport')).toHaveTextContent('No quotes');
  });

  it('says in words when the evidence is thin, without opening anything', () => {
    show('short');
    expect(row('Empathy & De-escalation')).toHaveTextContent('Not enough evidence');
    expect(row('Opening & Rapport')).toHaveTextContent('Limited evidence');
    cleanup();
    show('strong');
    expect(within(region('Scores')).queryByText('Limited evidence')).not.toBeInTheDocument();
  });

  it('keeps the details closed until asked, then opens them in place with the button', async () => {
    show('strong');
    const item = row('Clarity');
    const button = expander(item, /^Clarity/);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('Expand details');
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(panel).toHaveAttribute('hidden');
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveTextContent('Hide details');
    expect(panel).not.toHaveAttribute('hidden');
    expect(panel).toBeVisible();

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('hidden');
  });

  it('shows the reason, the verified quote with its turn, what to improve and how firm the evidence is', async () => {
    show('strong');
    const item = row('Scoping & Discovery');
    await userEvent.click(expander(item, /Expand details/));
    const d = must(
      CALLS.strong.report.dimensions.find((x) => x.id === 'scoping-discovery'),
      'the scoping skill',
    );
    expect(item).toHaveTextContent(d.rationale);
    for (const e of d.evidence) {
      expect(item).toHaveTextContent(e.quote);
      expect(
        within(item).getByRole('link', { name: `See turn ${e.turnIndex} in the transcript` }),
      ).toHaveAttribute('href', `#turn-${e.turnIndex}`);
    }
    expect(item).toHaveTextContent(d.guidance);
    expect(item).toHaveTextContent('Evidence confidence');
    expect(item).toHaveTextContent('There was enough in the call to judge this skill.');
  });

  it('says so when no quotable moment stood out, and how thin evidence should be read', async () => {
    show('short');
    const item = row('Empathy & De-escalation');
    await userEvent.click(expander(item, /Expand details/));
    expect(item).toHaveTextContent('No quotable moment stood out for this skill.');
    expect(item).toHaveTextContent('Not enough in this call to judge this skill');
  });

  it('opens and closes every row with Expand all and Collapse all', async () => {
    show('strong');
    const scores = region('Scores');
    await userEvent.click(within(scores).getByRole('button', { name: 'Expand all' }));
    for (const button of within(scores).getAllByRole('button', { name: /Hide details/ })) {
      expect(button).toHaveAttribute('aria-expanded', 'true');
    }
    expect(within(scores).getAllByRole('button', { name: /Hide details/ })).toHaveLength(6);
    await userEvent.click(within(scores).getByRole('button', { name: 'Collapse all' }));
    expect(within(scores).getAllByRole('button', { name: /Expand details/ })).toHaveLength(6);
  });

  it('can be opened and closed from the keyboard alone', async () => {
    show('strong');
    const button = expander(row('Closing'), /Expand details/);
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('CARE', () => {
  it('has the four principles, each with a level in words and one sentence', () => {
    show('strong');
    const care = region('CARE summary');
    expect(
      within(care)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Communicate effectively', 'Be accountable', 'Be resourceful', 'Be empathetic']);
    for (const principle of must(CALLS.strong.report.care, 'care')) {
      expect(care).toHaveTextContent(principle.summary);
    }
    expect(within(care).getAllByText('Strong')).toHaveLength(3);
    expect(within(care).getByText('Developing')).toBeInTheDocument();
  });

  it('counts the behaviours shown, partly shown and not shown, and keeps them closed', () => {
    show('strong');
    const item = within(region('CARE summary'))
      .getByRole('heading', { level: 3, name: 'Be resourceful' })
      .closest('li') as HTMLElement;
    expect(item).toHaveTextContent('2 shown');
    expect(item).toHaveTextContent('1 partly shown');
    expect(item).toHaveTextContent('1 not shown');
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows each behaviour with its status in words, its note and its verified quote when opened', async () => {
    show('strong');
    const item = within(region('CARE summary'))
      .getByRole('heading', { level: 3, name: 'Be resourceful' })
      .closest('li') as HTMLElement;
    await userEvent.click(expander(item, 'Show behaviours for Be resourceful'));
    expect(item).toHaveTextContent('Scoped who was affected');
    expect(item).toHaveTextContent('Partly shown');
    expect(item).toHaveTextContent('The deadline was acknowledged, but its scale was not asked.');
    expect(item).toHaveTextContent('Not shown');
    expect(item).toHaveTextContent('Not asked in this call.');
    expect(
      within(item).getAllByRole('link', { name: /See turn \d+ in the transcript/ }).length,
    ).toBeGreaterThanOrEqual(3);
    expect(expander(item, 'Hide behaviours for Be resourceful')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('says Limited evidence for a short call, and has no button for a principle with no behaviours', () => {
    show('short');
    const care = region('CARE summary');
    expect(within(care).getAllByText('Limited evidence')).toHaveLength(4);
    const accountable = within(care)
      .getByRole('heading', { level: 3, name: 'Be accountable' })
      .closest('li') as HTMLElement;
    expect(within(accountable).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows nothing for CARE when the report has none (saved before CARE was read from the call)', () => {
    show('legacy');
    expect(screen.queryByRole('region', { name: 'CARE summary' })).not.toBeInTheDocument();
    expect(screen.queryByText('Communicate effectively')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'On this page' })).queryByRole('link', {
        name: 'CARE summary',
      }),
    ).not.toBeInTheDocument();
  });
});

describe('the customer journey', () => {
  const milestones = () => within(region('Customer journey')).getAllByRole('listitem');

  it('lists the six milestones in call order, each with its status in words', () => {
    show('strong');
    const items = within(
      within(region('Customer journey')).getByRole('heading', { name: 'Call milestones' })
        .parentElement as HTMLElement,
    ).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(
      items.map(
        (i) =>
          within(i).getByText(
            /^(Greeting|Impact established|Discovery|Escalation|Ownership|Closure)$/,
          ).textContent,
      ),
    ).toEqual([
      'Greeting',
      'Impact established',
      'Discovery',
      'Escalation',
      'Ownership',
      'Closure',
    ]);
    expect(items[0]).toHaveTextContent('Reached');
    expect(items[3]).toHaveTextContent('Not applicable');
    expect(items[4]).toHaveTextContent('Reached');
  });

  it('links each reached milestone to its turn, with the words that show it', () => {
    show('strong');
    const ownership = milestones().find((i) => /Ownership/.test(i.textContent ?? ''));
    expect(ownership).toHaveTextContent("I'll take ownership of this case");
    expect(
      within(ownership as HTMLElement).getByRole('link', { name: 'See turn 8 in the transcript' }),
    ).toHaveAttribute('href', '#turn-8');
  });

  it('says Not reached for what did not happen, and links to no turn for it', () => {
    show('weak');
    const section = region('Customer journey');
    const list = within(section).getByRole('heading', { name: 'Call milestones' })
      .parentElement as HTMLElement;
    const items = within(list).getAllByRole('listitem');
    expect(items.every((i) => /Not reached/.test(i.textContent ?? ''))).toBe(true);
    expect(within(list).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows an unexpected turn that was handled as a reached escalation', () => {
    show('curveball');
    const escalation = milestones().find((i) => /^Escalation/.test(i.textContent ?? ''));
    expect(escalation).toHaveTextContent('Reached');
    expect(escalation).toHaveTextContent("I'm sorry nobody called you back");
  });

  it('shows the temperature alone for an older report, with no milestones and nothing invented', () => {
    showReport('strong', asVersion1(CALLS.strong.report));
    const section = region('Customer journey');
    expect(
      within(section).queryByRole('heading', { name: 'Call milestones' }),
    ).not.toBeInTheDocument();
    expect(
      within(section).queryByText(/Reached|Not reached|Not applicable/),
    ).not.toBeInTheDocument();
    expect(
      within(section).getByRole('heading', { level: 3, name: 'What moved the customer' }),
    ).toBeInTheDocument();
  });

  it('lists what moved the customer, in words, with the trainee\u2019s words and a link', () => {
    show('strong');
    const section = region('Customer journey');
    const moves = within(section).getByRole('heading', { name: 'What moved the customer' })
      .nextElementSibling as HTMLElement;
    const items = within(moves).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[1]).toHaveTextContent('Turn 4: Frustrated to Concerned');
    expect(items[1]).toHaveTextContent('Asked a focused question about scope');
    expect(items[1]).toHaveTextContent(
      'Is it happening in every meeting, or only for some organisers?',
    );
    expect(
      within(items[1] as HTMLElement).getByRole('link', { name: 'See turn 4 in the transcript' }),
    ).toHaveAttribute('href', '#turn-4');
  });

  it('gives the same points as a table, with a link on every row', async () => {
    show('strong');
    const section = region('Customer journey');
    await userEvent.click(within(section).getByText('Show as a table'));
    const table = within(section).getByRole('table', {
      name: 'Customer temperature at each point in the call',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(
      CALLS.strong.report.journey.points.length + 1,
    );
    expect(
      within(table).getAllByRole('link', { name: /See turn \d+ in the transcript/ }),
    ).toHaveLength(CALLS.strong.report.journey.points.length - 1);
  });

  it('describes an unexpected turn after the call, in the report\u2019s plain words', () => {
    show('curveball');
    const block = within(region('Customer journey')).getByRole('heading', {
      level: 3,
      name: 'Unexpected turn',
    }).parentElement as HTMLElement;
    expect(block).toHaveTextContent('Mentions a bad experience');
    expect(block).toHaveTextContent('After turn 2');
    expect(block).toHaveTextContent('Resolved');
    expect(block).toHaveTextContent('You apologised without excuses');
    cleanup();
    show('weak');
    expect(region('Customer journey')).toHaveTextContent('Still open when the call ended');
  });

  it('shows no unexpected-turn block, and never the word curveball, for a call without one', () => {
    show('strong');
    expect(screen.queryByRole('heading', { name: 'Unexpected turn' })).not.toBeInTheDocument();
    for (const name of ['strong', 'curveball', 'weak'] as const) {
      cleanup();
      show(name);
      expect(document.body).not.toHaveTextContent(/curveball/i);
    }
  });
});

describe('strengths and improvements', () => {
  it('shows each strength with its skill, title, reason, exact quote and a link to its turn', () => {
    show('strong');
    const section = region('Strengths');
    for (const strength of CALLS.strong.report.strengths) {
      const item = within(section)
        .getByRole('heading', { level: 3, name: strength.title })
        .closest('li') as HTMLElement;
      expect(item).toHaveTextContent(DIMENSIONS[strength.dimension].label);
      expect(item).toHaveTextContent(strength.whyItHelped);
      expect(item).toHaveTextContent(strength.quote);
      expect(
        within(item).getByRole('link', {
          name: `See turn ${strength.turnIndex} in the transcript`,
        }),
      ).toHaveAttribute('href', `#turn-${strength.turnIndex}`);
    }
  });

  it('says so, and points to the improvements, when no strength stood out', () => {
    show('weak');
    expect(region('Strengths')).toHaveTextContent(
      'No clear strength stood out in this call. The improvements below are the best place to start.',
    );
  });

  it('shows each improvement with its risk and the words, and the plain statement for a gap', () => {
    show('strong');
    const section = region('Improvements');
    const gap = within(section)
      .getByRole('heading', { level: 3, name: 'Did not ask what had been tried' })
      .closest('li') as HTMLElement;
    expect(gap).toHaveTextContent('Something that did not happen');
    expect(within(gap).queryByRole('link')).not.toBeInTheDocument();
    const said = within(section)
      .getByRole('heading', { level: 3, name: 'Did not confirm the tenant' })
      .closest('li') as HTMLElement;
    expect(said).toHaveTextContent('Can you tell me exactly what you see in the meeting chat');
    expect(
      within(said).getByRole('link', { name: 'See turn 2 in the transcript' }),
    ).toBeInTheDocument();
  });

  it('says so when there is no improvement to show, and leaves out better wording', () => {
    showReport('strong', { ...CALLS.strong.report, improvements: [] });
    expect(region('Improvements')).toHaveTextContent(
      'No specific improvement stood out in this call.',
    );
    expect(screen.queryByRole('region', { name: 'Better wording' })).not.toBeInTheDocument();
  });
});

describe('better wording', () => {
  it('sets the original beside the improved wording, for each improvement', () => {
    show('weak');
    const section = region('Better wording');
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const blame = items[0] as HTMLElement;
    expect(blame).toHaveTextContent('Blamed the customer');
    expect(blame).toHaveTextContent('Original');
    expect(blame).toHaveTextContent(
      '\u201cYou should have checked the service status page first.\u201d',
    );
    expect(blame).toHaveTextContent('Improved');
    expect(blame).toHaveTextContent("I'm sorry twelve of your staff can't work.");
    expect(blame).toHaveTextContent('Why it works: It names the impact');
  });

  it('says nothing was said when the improvement is about something that never happened', () => {
    show('strong');
    const first = within(region('Better wording')).getAllByRole('listitem')[0] as HTMLElement;
    expect(first).toHaveTextContent('Not said in this call');
    expect(first).toHaveTextContent('what have you or your admin already tried');
  });
});

describe('discovery', () => {
  it('says how many hidden facts were found, and splits them into found, partly found and missed', () => {
    show('strong');
    const section = region('Discovery');
    expect(section).toHaveTextContent('3 of 5 hidden facts found');
    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Found (3)', 'Partly found (1)', 'Missed (1)']);
    expect(
      within(section)
        .getAllByRole('heading', { level: 4 })
        .map((h) => h.textContent),
    ).toEqual([
      'Storage settings changed last week',
      'Only sales-organised meetings are affected',
      'The first recording went missing on Monday',
      'Most missing recordings were meetings with external guests',
      'Two organisers lost their OneDrive licence',
    ]);
  });

  it('shows how much each fact mattered and where you asked, and keeps the detail closed', () => {
    show('strong');
    const item = within(region('Discovery'))
      .getByRole('heading', { level: 4, name: 'Storage settings changed last week' })
      .closest('li') as HTMLElement;
    expect(item).toHaveTextContent('Critical');
    expect(item).toHaveTextContent('You asked');
    expect(
      within(item).getByRole('link', { name: 'See turn 6 in the transcript' }),
    ).toBeInTheDocument();
    expect(within(item).getByText('What the customer held back')).not.toBeVisible();
  });

  it('opens what the customer held back and the question that found it', async () => {
    show('strong');
    const item = within(region('Discovery'))
      .getByRole('heading', { level: 4, name: 'Storage settings changed last week' })
      .closest('li') as HTMLElement;
    await userEvent.click(expander(item, /Show details/));
    expect(within(item).getByText('Your question')).toBeVisible();
    expect(item).toHaveTextContent('Did anything change recently, such as a licence update');
    expect(within(item).getByText('What the customer held back')).toBeVisible();
    expect(item).toHaveTextContent(
      'The admin changed where recordings are stored the week before.',
    );
    expect(item).not.toHaveTextContent('A question worth asking');
  });

  it('opens a better question and why it mattered for a missed fact, and no turn', async () => {
    show('strong');
    const item = within(region('Discovery'))
      .getByRole('heading', { level: 4, name: 'Two organisers lost their OneDrive licence' })
      .closest('li') as HTMLElement;
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(expander(item, /Show details/));
    expect(item).toHaveTextContent('A question worth asking');
    expect(item).toHaveTextContent(
      'Do the organisers with missing recordings still have their OneDrive licence?',
    );
    expect(item).toHaveTextContent('Why it mattered');
    expect(item).not.toHaveTextContent('What the customer held back');
  });

  it('suggests one question: the one for the most important fact that was not found', () => {
    show('strong');
    const block = within(region('Discovery'))
      .getByText('Suggested question')
      .closest('div') as HTMLElement;
    expect(block).toHaveTextContent(
      '\u201cDo the organisers with missing recordings still have their OneDrive licence?\u201d',
    );
    expect(block).toHaveTextContent('To find out: Two organisers lost their OneDrive licence');
  });

  it('suggests nothing when every fact was found, and says when there was nothing to find', () => {
    const found = CALLS.strong.report.discovery.results.filter((r) => r.status === 'discovered');
    showReport('strong', {
      ...CALLS.strong.report,
      discovery: { results: found, found: 3, partial: 0, missed: 0, total: 3 },
    });
    expect(screen.queryByText('Suggested question')).not.toBeInTheDocument();
    cleanup();
    showReport('strong', {
      ...CALLS.strong.report,
      discovery: { results: [], found: 0, partial: 0, missed: 0, total: 0 },
    });
    expect(region('Discovery')).toHaveTextContent('This scenario had no hidden facts to find.');
  });
});

describe('next practice', () => {
  it('recommends one scenario by title, product and difficulty, with the skill it is for', async () => {
    show('strong');
    const section = region('Next practice');
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Staff locked out after an MFA change',
    );
    await within(section).findByText('Microsoft Entra ID');
    expect(section).toHaveTextContent('Standard');
    expect(section).toHaveTextContent('Skill: Scoping & Discovery');
    expect(within(section).getByRole('link', { name: 'Practise this scenario' })).toHaveAttribute(
      'href',
      '/scenarios?scenario=entra-mfa-lockout&difficulty=standard',
    );
  });

  it('shows the title from the report while the scenario list is still on its way', () => {
    const waiting = scriptedClient(CALLS.weak.session);
    waiting.scenarios.mockReturnValue(new Promise(() => undefined));
    show('weak', waiting);
    expect(within(region('Next practice')).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Shared calendar is not updating',
    );
  });

  it('offers the scenario list instead when the suggested scenario no longer exists', async () => {
    show('legacy');
    const section = region('Next practice');
    expect(within(section).getByRole('link', { name: 'Choose a scenario' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(section).not.toHaveTextContent('Recurring midday slowdowns');
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Scoping & Discovery',
    );
  });

  it('offers the scenario list when no scenario is suggested', () => {
    showReport('weak', {
      ...CALLS.weak.report,
      nextPractice: {
        ...CALLS.weak.report.nextPractice,
        suggestedScenarioId: null,
        suggestedScenarioTitle: null,
      },
    });
    expect(
      within(region('Next practice')).getByRole('link', { name: 'Choose a scenario' }),
    ).toHaveAttribute('href', '/scenarios');
  });
});

describe('actions', () => {
  it('links to another call, and to the same scenario again with the same settings', () => {
    show('curveball');
    const section = region('Actions');
    expect(within(section).getByRole('link', { name: 'Try another call' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(within(section).getByRole('link', { name: 'Repeat scenario' })).toHaveAttribute(
      'href',
      toBriefHref(CALLS.curveball.session),
    );
    expect(section).not.toHaveTextContent('no longer available');
  });

  it('falls back to the scenario list, and says why, when the scenario of the call is gone', async () => {
    const { client } = show('legacy');
    const section = region('Actions');
    const repeat = within(section).getByRole('link', { name: 'Repeat scenario' });
    expect(repeat).toHaveAttribute('href', '/scenarios');
    expect(repeat).toHaveAccessibleDescription(
      'This scenario is no longer available, so Repeat scenario opens the scenario list.',
    );
    await vi.waitFor(() => expect(client.scenarios).toHaveBeenCalledTimes(1));
    expect(within(section).getByRole('link', { name: 'Try another call' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    // Following it lands on the list, not on a brief for a scenario that is gone.
    await userEvent.click(repeat);
    expect(await screen.findByText('Scenarios page')).toBeInTheDocument();
  });

  it('decides from the list of scenarios once it arrives, even for a call that has a product', async () => {
    const gone = scriptedClient(CALLS.strong.session);
    gone.scenarios.mockResolvedValue(
      SCENARIO_INDEX.filter((s) => s.id !== 'teams-recordings-missing'),
    );
    show('strong', gone);
    const link = await within(region('Actions')).findByRole('link', {
      name: 'Repeat scenario',
    });
    await vi.waitFor(() => expect(link).toHaveAttribute('href', '/scenarios'));
  });

  it('keeps the brief link when the list of scenarios cannot be loaded for a call that has a product', async () => {
    const down = scriptedClient(CALLS.strong.session);
    down.scenarios.mockRejectedValue(new ApiError(0, 'network', 'offline', true));
    show('strong', down);
    await vi.waitFor(() => expect(down.scenarios).toHaveBeenCalled());
    expect(
      within(region('Actions')).getByRole('link', { name: 'Repeat scenario' }),
    ).toHaveAttribute('href', toBriefHref(CALLS.strong.session));
  });

  it('works with a client that cannot list scenarios at all', () => {
    const plain = scriptedClient(CALLS.legacy.session);
    const { scenarios: _scenarios, ...rest } = plain;
    show('legacy', rest as FakeClient);
    expect(
      within(region('Actions')).getByRole('link', { name: 'Repeat scenario' }),
    ).toHaveAttribute('href', '/scenarios');
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
    const client = scriptedClient(CALLS.strong.session);
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
  const about = () => region('About this report');
  const details = () => about().querySelector('details') as HTMLDetailsElement;

  it('is closed until it is wanted', () => {
    show('strong');
    expect(details().open).toBe(false);
  });

  it('says in one plain line that coaching is practice feedback and that CBCF mapping is not applied', async () => {
    show('strong');
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(details().open).toBe(true);
    expect(about()).toHaveTextContent(
      'Automatic practice feedback, not an assessment. CBCF mapping is not applied: it is awaiting an authoritative source.',
    );
  });

  it('never claims that the coaching is aligned with CBCF', () => {
    show('strong');
    expect(document.body.textContent).not.toMatch(
      /CBCF[- ]?(compliant|compliance|aligned|alignment|mapped to)/i,
    );
    expect(document.body.textContent).not.toMatch(/aligned (with|to) CBCF/i);
  });

  it('says the same about an older report, without the status it never had', async () => {
    show('legacy');
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(about()).toHaveTextContent(
      'Automatic practice feedback, not an assessment. CBCF mapping is not applied.',
    );
    expect(about()).not.toHaveTextContent('awaiting an authoritative source');
  });

  it('explains the 1 to 5 scale and the six skills', async () => {
    show('strong');
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(about()).toHaveTextContent('5 of 5, Excellent');
    expect(about()).toHaveTextContent('Critical behaviours were absent or counterproductive.');
    for (const id of DIMENSION_IDS) {
      expect(about()).toHaveTextContent(DIMENSIONS[id].label);
    }
  });

  it('names who played the customer and who wrote the coaching, and says demo mode and synthetic', async () => {
    show('strong');
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(about()).toHaveTextContent('Priya Nair, IT coordinator, Fabrikam Logistics (synthetic)');
    expect(about()).toHaveTextContent(
      "Firefly's built-in rules engine (demo mode), not a language model",
    );
    expect(about()).toHaveTextContent("Firefly's built-in rules evaluator (demo mode)");
    expect(about()).toHaveTextContent('Firefly rules evaluator (rules-2.0.0)');
    expect(about()).toHaveTextContent(CALLS.strong.report.trainingNote);
    expect(
      within(about()).getByRole('link', { name: 'How Firefly uses AI and speech' }),
    ).toHaveAttribute('href', '/responsible-ai');
  });

  it('names a language model by its real label when one wrote the coaching', async () => {
    const model: CoachingReport = {
      ...CALLS.strong.report,
      evaluator: {
        kind: 'model',
        name: 'Firefly model evaluator',
        version: 'v1',
        providerLabel: 'Gemini (gemini-3.5-flash-lite)',
      },
    };
    const session = {
      ...withReport(CALLS.strong, model),
      providerKind: 'gemini' as const,
      providerLabel: 'Gemini (gemini-3.5-flash-lite)',
    };
    renderAtReport(
      <ReportView
        session={session}
        report={model}
        client={scriptedClient(session)}
        reveal={false}
      />,
    );
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(about()).toHaveTextContent('the language model Gemini (gemini-3.5-flash-lite)');
    expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
  });

  it('is opened, and its heading focused, from "About this report" in the summary', async () => {
    const { restore } = stubScroll();
    try {
      show('strong');
      await userEvent.click(
        within(region('Summary')).getByRole('link', { name: 'About this report' }),
      );
      expect(details().open).toBe(true);
      expect(screen.getByRole('heading', { level: 2, name: 'About this report' })).toHaveFocus();
    } finally {
      restore();
    }
  });
});

describe('the page as a document', () => {
  it('has one level-one heading and no skipped levels, for every call', () => {
    for (const name of ['strong', 'weak', 'short', 'curveball', 'legacy'] as const) {
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
    const regions = screen
      .getAllByRole('region')
      .map(
        (r) => document.getElementById(r.getAttribute('aria-labelledby') as string)?.textContent,
      );
    const nav = within(screen.getByRole('navigation', { name: 'On this page' }))
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(regions).toEqual(nav);
    expect(regions).toEqual([
      'Summary',
      'Scores',
      'CARE summary',
      'Customer journey',
      'Strengths',
      'Improvements',
      'Better wording',
      'Discovery',
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

  it('names every one of the six rows differently, by its skill', () => {
    show('strong');
    const names = within(region('Scores'))
      .getAllByRole('button', { name: /Expand details/ })
      .map((b) => b.textContent);
    expect(new Set(names).size).toBe(6);
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

  it('says which part of the report is current as it is scrolled (the navigation marks it)', () => {
    show('strong');
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    expect(within(nav).getByRole('link', { name: 'Summary' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getAllByRole('link')).toHaveLength(12);
  });

  it('jumps to a section and puts focus on its heading', async () => {
    const { scroll, restore } = stubScroll();
    try {
      show('strong');
      const nav = screen.getByRole('navigation', { name: 'On this page' });
      await userEvent.click(within(nav).getByRole('link', { name: 'Discovery' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Discovery' })).toHaveFocus();
      expect(scroll).toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('has no achievements, points, streaks or badges earned anywhere', () => {
    for (const name of ['strong', 'weak', 'short', 'curveball', 'legacy'] as const) {
      show(name);
      expect(document.body.textContent, name).not.toMatch(
        /achievement|streak|leaderboard|level up|unlocked|badge earned|\bXP\b|\d+ points\b/i,
      );
      cleanup();
    }
  });
});
