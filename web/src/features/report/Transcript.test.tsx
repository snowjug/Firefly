import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { ReportView } from './ReportView.tsx';
import { TranscriptReview } from './Transcript.tsx';
import { CALLS, withReport, type CallName } from './fixtures.ts';
import { EvidenceProvider, HIGHLIGHT_MS } from './evidence.tsx';
import { must, renderAtReport, scriptedClient, stubScroll } from './test-utils.tsx';

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

let restoreScroll: () => void;

beforeEach(() => {
  restoreScroll = stubScroll().restore;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  restoreScroll();
});

function show(name: CallName, report?: CoachingReport) {
  const call = CALLS[name];
  const shown = report ?? call.report;
  return renderAtReport(
    <ReportView
      session={withReport(call, shown)}
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
    const { session } = CALLS.strong;
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
    expect(turn(1)).toHaveTextContent('Priya Nair');
    expect(turn(1)).toHaveTextContent('at 0:00');
    expect(turn(2)).toHaveTextContent('You');
    expect(turn(2)).toHaveTextContent(/at \d+:\d{2}/);
    expect(turn(2).querySelector('p[dir="auto"]')).not.toBeNull();
  });

  it('does not label any turn as spoken or typed, and says once that spoken turns were transcribed', () => {
    show('voice');
    expect(within(transcript()).queryByText('Spoken')).not.toBeInTheDocument();
    expect(transcript()).toHaveTextContent(
      'Spoken turns were transcribed automatically and may contain recognition errors.',
    );
    cleanup();
    show('strong');
    expect(transcript()).not.toHaveTextContent('transcribed automatically');
  });

  it('labels what the engine recorded on a turn: mood, a fact uncovered, an unexpected turn', () => {
    show('strong');
    expect(within(turn(4)).getByText('Mood: eased')).toBeInTheDocument();
    expect(within(turn(4)).getByText('Fact uncovered')).toBeInTheDocument();
    expect(turn(4)).toHaveTextContent('Only sales-organised meetings are affected');
    expect(within(turn(6)).getByText('Fact partly uncovered')).toBeInTheDocument();
    cleanup();
    show('curveball');
    const fired = must(CALLS.curveball.report.curveball, 'an unexpected turn').firedAtTurn;
    expect(within(turn(fired)).getByText('Unexpected turn')).toBeInTheDocument();
    expect(turn(fired)).toHaveTextContent('Customer mentions a bad earlier experience');
  });

  it('says which skills cite a turn as evidence', () => {
    show('strong');
    expect(within(turn(2)).getByText('Cited for: Opening & Rapport')).toBeInTheDocument();
    expect(within(turn(2)).getByText('Cited for: Empathy & De-escalation')).toBeInTheDocument();
    expect(within(turn(10)).getByText('Cited for: Ownership & Next Steps')).toBeInTheDocument();
    expect(within(turn(3)).queryByText(/Cited for/)).not.toBeInTheDocument();
  });

  it('handles a long call: every turn is there, and finding and filtering still work', async () => {
    show('long');
    const { session } = CALLS.long;
    expect(session.turns.length).toBeGreaterThanOrEqual(60);
    expect(turns()).toHaveLength(session.turns.length);
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Find in transcript' }),
      'example number',
    );
    expect(await within(transcript()).findByText(/\d+ matches$/)).toBeInTheDocument();
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
    await userEvent.type(search(), 'recording');
    const marks = transcript().querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(2);
    expect([...marks].every((m) => /^recording$/i.test(m.textContent ?? ''))).toBe(true);
    expect(await screen.findByText(`${marks.length} matches`)).toBeInTheDocument();
  });

  it('says there are no matches, and says "1 match" for one', async () => {
    show('strong');
    await userEvent.type(search(), 'zebra');
    expect(await screen.findByText('No matches')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
    await userEvent.clear(search());
    await userEvent.type(search(), 'Monday morning');
    expect(await screen.findByText('1 match')).toBeInTheDocument();
  });

  it('moves to the next and previous match with the buttons and Enter, and wraps round', async () => {
    show('strong');
    await userEvent.type(search(), 'recording');
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

  it('steps to the first match when Enter is pressed at once, before the matches have caught up with the typing', () => {
    show('strong');
    const box = search();
    // One batch, so the deferred matches for "recording" have not been drawn when Enter arrives.
    act(() => {
      fireEvent.change(box, { target: { value: 'recording' } });
      fireEvent.keyDown(box, { key: 'Enter' });
    });
    const total = transcript().querySelectorAll('mark').length;
    expect(total).toBeGreaterThan(2);
    expect(count()).toHaveTextContent(new RegExp(`Match 1 of ${total}, in turn \\d+`));
    expect(transcript().querySelectorAll('mark[data-rp-current-match]')).toHaveLength(1);
  });

  it('clears with Escape and goes back to no highlights', async () => {
    show('strong');
    await userEvent.type(search(), 'recording');
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
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    for (const label of [
      /^All turns \(15\)/,
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
    const fired = must(CALLS.curveball.report.curveball, 'an unexpected turn').firedAtTurn;
    await userEvent.click(screen.getByRole('radio', { name: /^Unexpected turn/ }));
    expect(turns().map((t) => Number(t.id.replace('turn-', '')))).toEqual([fired, fired + 1]);
  });
});

describe('evidence navigation', () => {
  const link = (index: number, from = 'Strengths') =>
    within(screen.getByRole('region', { name: from })).getAllByRole('link', {
      name: `See turn ${index} in the transcript`,
    })[0] as HTMLElement;

  it('scrolls to the turn, puts focus on it, marks it Cited and marks the quoted words', async () => {
    show('strong');
    const quote = must(CALLS.strong.report.strengths[1], 'a strength').quote;
    await userEvent.click(link(2));
    expect(turn(2)).toHaveFocus();
    expect(within(turn(2)).getByText('Cited')).toBeInTheDocument();
    const marked = [...turn(2).querySelectorAll('mark')].map((m) => m.textContent).join('');
    expect(marked).toBe(quote);
    expect(turn(2)).toHaveClass('rp-turn--cited');
    expect(document.querySelectorAll('.rp-turn--cited')).toHaveLength(1);
  });

  it('marks only the turn when the quoted words cannot be found in it', async () => {
    const { report } = CALLS.strong;
    const [first, ...rest] = report.strengths;
    show('strong', {
      ...report,
      strengths: [
        { ...must(first, 'a strength'), quote: 'words that are not in the turn', turnIndex: 4 },
        ...rest,
      ],
    });
    await userEvent.click(link(4));
    expect(turn(4)).toHaveFocus();
    expect(within(turn(4)).getByText('Cited')).toBeInTheDocument();
    expect(turn(4).querySelectorAll('mark')).toHaveLength(0);
  });

  it('marks the turn only for a few seconds, then the mark goes and the way back stays', () => {
    vi.useFakeTimers();
    show('strong');
    act(() => {
      fireEvent.click(link(2));
    });
    expect(turn(2)).toHaveClass('rp-turn--cited');
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_MS - 100);
    });
    expect(turn(2)).toHaveClass('rp-turn--cited');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(turn(2)).not.toHaveClass('rp-turn--cited');
    expect(turn(2).querySelector('mark')).toBeNull();
    expect(turn(2)).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Back to Strengths' })).toBeInTheDocument();
  });

  it('marks it again, for as long again, when the same link is followed twice', () => {
    vi.useFakeTimers();
    show('strong');
    act(() => {
      fireEvent.click(link(2));
    });
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_MS + 100);
    });
    expect(turn(2)).not.toHaveClass('rp-turn--cited');
    act(() => {
      fireEvent.click(link(2));
    });
    expect(turn(2)).toHaveClass('rp-turn--cited');
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_MS - 100);
    });
    expect(turn(2)).toHaveClass('rp-turn--cited');
  });

  it('offers "Back to <section>" and returns focus to the link the person came from', async () => {
    show('strong');
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
    const from = link(2);
    await userEvent.click(from);
    await userEvent.click(screen.getByRole('button', { name: 'Back to Strengths' }));
    expect(from).toHaveFocus();
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.rp-turn--cited')).toHaveLength(0);
  });

  it('names the part the link was in: a skill, the journey, a discovery fact', async () => {
    show('strong');
    const scores = screen.getByRole('region', { name: 'Scores' });
    await userEvent.click(within(scores).getByRole('button', { name: /^Clarity/ }));
    await userEvent.click(
      within(
        within(scores)
          .getByRole('heading', { level: 3, name: /^Clarity/ })
          .closest('li') as HTMLElement,
      ).getAllByRole('link', { name: /See turn 12/ })[0] as HTMLElement,
    );
    expect(screen.getByRole('button', { name: 'Back to Clarity' })).toBeInTheDocument();
    await userEvent.click(link(10, 'Customer journey'));
    expect(screen.getByRole('button', { name: 'Back to Customer journey' })).toBeInTheDocument();
    await userEvent.click(link(6, 'Discovery'));
    expect(
      screen.getByRole('button', { name: 'Back to Storage settings changed last week' }),
    ).toBeInTheDocument();
  });

  it('shows all turns again when the filter would hide the turn that was linked to', async () => {
    show('strong');
    await userEvent.click(screen.getByRole('radio', { name: /^Discovered facts/ }));
    expect(document.getElementById('turn-10')).toBeNull();
    await userEvent.click(link(10, 'Customer journey'));
    expect(screen.getByRole('radio', { name: /^All turns/ })).toBeChecked();
    expect(turn(10)).toHaveFocus();
  });

  it('moves the mark when another link is followed, and leaves a link with a modifier key alone', async () => {
    const user = userEvent.setup();
    show('strong');
    await user.click(link(2));
    await user.click(link(10));
    expect(document.querySelectorAll('.rp-turn--cited')).toHaveLength(1);
    expect(turn(10)).toHaveFocus();
    await user.keyboard('{Control>}');
    await user.click(link(2));
    await user.keyboard('{/Control}');
    expect(turn(10)).toHaveClass('rp-turn--cited');
    expect(turn(2)).not.toHaveClass('rp-turn--cited');
  });

  it('shows a reference to a turn the transcript does not have as plain text, never a dead link', () => {
    const { report } = CALLS.strong;
    const [first, ...rest] = report.strengths;
    show('strong', {
      ...report,
      strengths: [{ ...must(first, 'a strength'), turnIndex: 999 }, ...rest],
    });
    const section = screen.getByRole('region', { name: 'Strengths' });
    expect(within(section).queryByRole('link', { name: /turn 999/ })).not.toBeInTheDocument();
    expect(section).toHaveTextContent('You Turn 999');
  });
});

describe('without a report', () => {
  it('is the plain transcript: every turn, a search box, and no filters, markers or citations', () => {
    const call = CALLS.weak;
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
    expect(
      screen.queryByText(/Cited for|Mood:|Fact uncovered|Unexpected turn/),
    ).not.toBeInTheDocument();
  });
});
