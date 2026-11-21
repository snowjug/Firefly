import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { ReportView } from './ReportView.tsx';
import { callFixtures, type CallFixture } from './fixtures.ts';
import { renderAtReport, must, scriptedClient, stubScroll } from './test-utils.tsx';

let calls: Record<string, CallFixture>;
let restoreScroll: () => void;

beforeEach(async () => {
  calls = await callFixtures();
  restoreScroll = stubScroll().restore;
});

afterEach(() => {
  cleanup();
  restoreScroll();
});

function show(name: string, report?: CoachingReport) {
  const call = calls[name] as CallFixture;
  const shown = report ?? call.report;
  return renderAtReport(
    <ReportView
      session={{ ...call.session, report: shown }}
      report={shown}
      client={scriptedClient(call.session)}
      reveal={false}
    />,
  );
}

const transcript = () => screen.getByRole('region', { name: 'Transcript' });
const turn = (index: number) => document.getElementById(`turn-${index}`) as HTMLElement;
const turns = () => [...document.querySelectorAll<HTMLElement>('li[id^="turn-"]')];

describe('the transcript', () => {
  it('shows every turn exactly as it was said, each with an anchor that can take focus', () => {
    show('strong');
    const { session } = calls.strong as CallFixture;
    expect(turns()).toHaveLength(session.turns.length);
    for (const t of session.turns) {
      const row = turn(t.index);
      expect(row).toHaveAttribute('tabindex', '-1');
      expect(within(row).getByText(t.text, { normalizer: (s) => s })).toBeInTheDocument();
      expect(row).toHaveTextContent(`Turn ${t.index}`);
    }
  });

  it('names the speaker and the time since the start of the call, and keeps the text direction automatic', () => {
    show('strong');
    expect(turn(1)).toHaveTextContent('Daniel Osei');
    expect(turn(1)).toHaveTextContent('at 0:00');
    expect(turn(2)).toHaveTextContent('You');
    expect(turn(2)).toHaveTextContent(/at \d+:\d{2}/);
    expect(turn(2).querySelector('p[dir="auto"]')).not.toBeNull();
  });

  it('marks the turns that were spoken', () => {
    show('voice');
    expect(within(transcript()).getAllByText('Spoken')).toHaveLength(5);
    cleanup();
    show('strong');
    expect(within(transcript()).queryByText('Spoken')).not.toBeInTheDocument();
  });

  it('labels what the engine recorded on a turn: mood, a fact uncovered, an unexpected turn', () => {
    show('strong');
    expect(within(turn(2)).getAllByText('Mood: eased')).toHaveLength(3);
    expect(within(turn(2)).getByText('Fact uncovered')).toBeInTheDocument();
    expect(turn(2)).toHaveTextContent('The exact permission message');
    cleanup();
    show('curveball');
    const fired = (calls.curveball as CallFixture).report.curveball?.firedAtTurn as number;
    expect(within(turn(fired)).getByText('Unexpected turn')).toBeInTheDocument();
    expect(turn(fired)).toHaveTextContent('Customer mentions a bad experience');
    cleanup();
    show('weak');
    expect(within(turn(4)).getByText('Mood: rose')).toBeInTheDocument();
  });

  it('says which skills cite a turn as evidence', () => {
    show('strong');
    expect(within(turn(12)).getByText('Cited for: Clarity')).toBeInTheDocument();
    expect(within(turn(12)).getByText('Cited for: Ownership & Next Steps')).toBeInTheDocument();
    expect(within(turn(12)).getByText('Cited for: Closing')).toBeInTheDocument();
    expect(within(turn(3)).queryByText(/Cited for/)).not.toBeInTheDocument();
  });

  it('handles a long call: every turn is there, and finding and filtering still work', async () => {
    show('long');
    const { session } = calls.long as CallFixture;
    expect(session.turns.length).toBeGreaterThanOrEqual(60);
    expect(turns()).toHaveLength(session.turns.length);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find in transcript' }), 'VPN');
    expect(await within(transcript()).findByText(/matches?$/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Evidence/ }));
    expect(turns().length).toBeGreaterThan(0);
    expect(turns().length).toBeLessThan(session.turns.length);
  });
});

describe('finding in the transcript', () => {
  const search = () => screen.getByRole('searchbox', { name: 'Find in transcript' });
  const count = () => within(transcript()).getByRole('status', { name: '' });

  it('highlights every match with <mark> and says how many there are', async () => {
    show('strong');
    await userEvent.type(search(), 'workspace');
    const marks = transcript().querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(2);
    expect([...marks].every((m) => /^workspace$/i.test(m.textContent ?? ''))).toBe(true);
    expect(await screen.findByText(`${marks.length} matches`)).toBeInTheDocument();
  });

  it('says there are no matches, and says "1 match" for one', async () => {
    show('strong');
    await userEvent.type(search(), 'zebra');
    expect(await screen.findByText('No matches')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
    await userEvent.clear(search());
    await userEvent.type(search(), 'Adventure Works');
    expect(await screen.findByText('1 match')).toBeInTheDocument();
  });

  it('moves to the next and previous match with the buttons and Enter, and wraps round', async () => {
    show('strong');
    await userEvent.type(search(), 'workspace');
    const total = transcript().querySelectorAll('mark').length;
    await userEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(count()).toHaveTextContent(new RegExp(`Match 1 of ${total}, in turn \\d+`));
    expect(transcript().querySelectorAll('mark[data-rp-current-match]')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(count()).toHaveTextContent(`Match 2 of ${total}`);
    await userEvent.click(screen.getByRole('button', { name: 'Previous match' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous match' }));
    expect(count()).toHaveTextContent(`Match ${total} of ${total}`);
    await userEvent.type(search(), '{Enter}');
    expect(count()).toHaveTextContent(`Match 1 of ${total}`);
    await userEvent.type(search(), '{Shift>}{Enter}{/Shift}');
    expect(count()).toHaveTextContent(`Match ${total} of ${total}`);
  });

  it('steps to the first match when Enter is pressed at once, before the matches have caught up with the typing', async () => {
    show('strong');
    const box = search();
    // One batch, so the deferred matches for "workspace" have not been drawn when Enter arrives.
    act(() => {
      fireEvent.change(box, { target: { value: 'workspace' } });
      fireEvent.keyDown(box, { key: 'Enter' });
    });
    const total = transcript().querySelectorAll('mark').length;
    expect(total).toBeGreaterThan(2);
    expect(count()).toHaveTextContent(new RegExp(`Match 1 of ${total}, in turn \\d+`));
    expect(transcript().querySelectorAll('mark[data-rp-current-match]')).toHaveLength(1);
  });

  it('clears with Escape and goes back to no highlights', async () => {
    show('strong');
    await userEvent.type(search(), 'workspace');
    expect(transcript().querySelectorAll('mark').length).toBeGreaterThan(0);
    await userEvent.type(search(), '{Escape}');
    expect(search()).toHaveValue('');
    expect(transcript().querySelectorAll('mark')).toHaveLength(0);
  });

  it('counts only the turns a filter shows', async () => {
    show('strong');
    await userEvent.click(screen.getByRole('radio', { name: /Evidence/ }));
    await userEvent.type(search(), 'the');
    const shown = turns().map((t) => t.textContent ?? '');
    const expected = shown.reduce((n, text) => n + (text.match(/the/gi)?.length ?? 0), 0);
    expect(transcript().querySelectorAll('mark').length).toBeLessThanOrEqual(expected);
    expect(transcript().querySelectorAll('mark').length).toBeGreaterThan(0);
  });
});

describe('the filters', () => {
  it('offer All turns, Evidence, Discovered facts, Mood changes and Unexpected turn, with counts', () => {
    show('curveball');
    const group = screen.getByRole('group', { name: 'Filter the transcript' });
    const names = within(group)
      .getAllByRole('radio')
      .map((r) => r.getAttribute('id'));
    expect(names).toHaveLength(5);
    for (const label of [
      /^All turns \(13\)/,
      /^Evidence \(\d+\)/,
      /^Discovered facts \(\d+\)/,
      /^Mood changes \(\d+\)/,
      /^Unexpected turn \(\d+\)/,
    ]) {
      expect(within(group).getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('disables a filter that would find nothing', () => {
    show('strong');
    expect(screen.getByRole('radio', { name: /^Unexpected turn \(0\)/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /^All turns/ })).toBeEnabled();
  });

  it.each([
    [/^Evidence/, 'cited as evidence'],
    [/^Discovered facts/, 'where a hidden fact was uncovered'],
    [/^Mood changes/, 'that changed the customer\u2019s mood'],
  ])(
    '%s shows only what it finds, says so, and All turns brings everything back',
    async (name, words) => {
      show('curveball');
      const total = turns().length;
      await userEvent.click(screen.getByRole('radio', { name }));
      expect(turns().length).toBeLessThan(total);
      expect(screen.getByText(new RegExp(`Showing \\d+ turns? ${words}`))).toBeInTheDocument();
      await userEvent.click(screen.getByRole('radio', { name: /^All turns/ }));
      expect(turns()).toHaveLength(total);
    },
  );

  it('Unexpected turn shows the turn the engine recorded it on and the customer\u2019s reply', async () => {
    show('curveball');
    const fired = (calls.curveball as CallFixture).report.curveball?.firedAtTurn as number;
    await userEvent.click(screen.getByRole('radio', { name: /^Unexpected turn/ }));
    const shown = turns().map((t) => Number(t.id.replace('turn-', '')));
    expect(shown).toContain(fired);
    expect(shown).toContain(fired + 1);
  });
});

describe('evidence navigation', () => {
  const link = (index: number, within_ = 'What went well') =>
    within(screen.getByRole('region', { name: within_ })).getAllByRole('link', {
      name: `See turn ${index} in the transcript`,
    })[0] as HTMLElement;

  it('scrolls to the turn, puts focus on it, marks it Cited and marks the quoted words', async () => {
    show('strong');
    const quote = (calls.strong as CallFixture).report.strengths[1]?.quote as string;
    await userEvent.click(link(6));
    expect(turn(6)).toHaveFocus();
    expect(within(turn(6)).getByText('Cited')).toBeInTheDocument();
    const marked = [...turn(6).querySelectorAll('mark')].map((m) => m.textContent).join('');
    expect(marked).toBe(quote);
    expect(turn(6).className).toMatch(/rp-turn--cited/);
    expect(document.querySelectorAll('.rp-turn--cited')).toHaveLength(1);
  });

  it('marks only the turn when the quoted words cannot be found in it', async () => {
    const { report } = calls.strong as CallFixture;
    const [first, ...rest] = report.strengths;
    show('strong', {
      ...report,
      strengths: [
        {
          ...must(first, 'a strength'),
          quote: 'words that are not in the turn',
          turnIndex: 4,
        },
        ...rest,
      ],
    });
    await userEvent.click(link(4));
    expect(turn(4)).toHaveFocus();
    expect(within(turn(4)).getByText('Cited')).toBeInTheDocument();
    expect(turn(4).querySelectorAll('mark')).toHaveLength(0);
  });

  it('offers "Back to <section>" and returns focus to the link the person came from', async () => {
    show('strong');
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
    const from = link(6);
    await userEvent.click(from);
    await userEvent.click(screen.getByRole('button', { name: 'Back to What went well' }));
    expect(from).toHaveFocus();
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.rp-turn--cited')).toHaveLength(0);
  });

  it('names the part the link was in: a skill, a discovery fact, the temperature section', async () => {
    show('strong');
    await userEvent.click(
      within(document.getElementById('skill-clarity') as HTMLElement).getAllByRole('link', {
        name: /See turn 12/,
      })[0] as HTMLElement,
    );
    expect(screen.getByRole('button', { name: 'Back to Clarity' })).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Customer temperature' })).getAllByRole('link', {
        name: 'See turn 10 in the transcript',
      })[0] as HTMLElement,
    );
    expect(
      screen.getByRole('button', { name: 'Back to Customer temperature' }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Discovery review' })).getAllByRole('link', {
        name: /See turn \d+ in the transcript/,
      })[0] as HTMLElement,
    );
    expect(screen.getByRole('button', { name: 'Back to Discovery review' })).toBeInTheDocument();
  });

  it('shows all turns again when the filter would hide the turn that was linked to', async () => {
    show('strong');
    await userEvent.click(screen.getByRole('radio', { name: /^Discovered facts/ }));
    expect(document.getElementById('turn-10')).toBeNull();
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Customer temperature' })).getAllByRole('link', {
        name: 'See turn 10 in the transcript',
      })[0] as HTMLElement,
    );
    expect(screen.getByRole('radio', { name: /^All turns/ })).toBeChecked();
    expect(turn(10)).toHaveFocus();
  });

  it('moves the highlight when another link is followed, and leaves a link with a modifier key alone', async () => {
    const user = userEvent.setup();
    show('strong');
    await user.click(link(2));
    await user.click(link(6));
    expect(document.querySelectorAll('.rp-turn--cited')).toHaveLength(1);
    expect(turn(6)).toHaveFocus();
    await user.keyboard('{Control>}');
    await user.click(link(2));
    await user.keyboard('{/Control}');
    expect(turn(6)).toHaveClass('rp-turn--cited');
    expect(turn(2)).not.toHaveClass('rp-turn--cited');
  });

  it('shows a reference to a turn the transcript does not have as plain text, never a dead link', () => {
    const { report } = calls.strong as CallFixture;
    const [first, ...rest] = report.strengths;
    show('strong', {
      ...report,
      strengths: [{ ...must(first, 'a strength'), turnIndex: 999 }, ...rest],
    });
    const section = screen.getByRole('region', { name: 'What went well' });
    expect(within(section).queryByRole('link', { name: /turn 999/ })).not.toBeInTheDocument();
    expect(section).toHaveTextContent('You, turn 999');
  });
});

describe('without a report', () => {
  it('is the plain transcript: every turn, a search box, and no filters, markers or citations', async () => {
    const call = calls.weak as CallFixture;
    const { TranscriptReview } = await import('./Transcript.tsx');
    const { EvidenceProvider } = await import('./evidence.tsx');
    const plain = {
      ...call.session,
      report: null,
      turns: call.session.turns.map(({ markers: _markers, ...rest }) => rest),
    };
    renderAtReport(
      <EvidenceProvider turnIndexes={plain.turns.map((t) => t.index)}>
        <TranscriptReview session={plain} report={null} />
      </EvidenceProvider>,
    );
    expect(turns()).toHaveLength(plain.turns.length);
    expect(screen.getByRole('searchbox', { name: 'Find in transcript' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter the transcript' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Cited for|Mood:|Fact uncovered/)).not.toBeInTheDocument();
  });
});
