import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_ID, makeSession } from '../components/report/report.fixtures.ts';
import { ApiError, api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { resetProfileForTests } from '../lib/profile.ts';
import Transcript from './Transcript.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { getSession: vi.fn() } };
});

const getSession = vi.mocked(api.getSession);

function renderTranscript(path = `/sessions/${SESSION_ID}/transcript`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="sessions/:id/transcript" element={<Transcript />} />
        <Route path="sessions/:id/report" element={<p>The report screen</p>} />
        <Route path="calls/:id" element={<p>The call screen</p>} />
        <Route path="history" element={<p>The history screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The usual call, with the words of some turns replaced so the report's quotes can be found in them. */
function sessionWithTexts(texts: Record<number, string>) {
  const session = makeSession();
  return {
    ...session,
    turns: session.turns.map((turn) =>
      texts[turn.index] ? { ...turn, text: texts[turn.index]! } : turn,
    ),
  };
}

function turnItem(index: number): HTMLElement {
  return document.getElementById(`turn-${index}`) as HTMLElement;
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  resetProfileForTests();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  localStorage.clear();
  resetProfileForTests();
});

describe('Transcript page', () => {
  it('has one page heading, the call it belongs to and a way back to the report', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    expect(screen.getByRole('heading', { level: 1, name: 'Transcript' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const call = screen.getByRole('region', { name: 'Locked out after a password reset' });
    expect(within(call).getByText('10 turns')).toBeInTheDocument();
    expect(within(call).getByText('Starter')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to report' })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/report`,
    );
  });

  it('says it is loading before the call arrives, with the heading already in place', () => {
    getSession.mockReturnValue(new Promise(() => undefined));
    renderTranscript();
    expect(screen.getByRole('heading', { level: 1, name: 'Transcript' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading the transcript' })).toBeInTheDocument();
  });

  it('prints through the browser', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    getSession.mockResolvedValue(makeSession());
    renderTranscript();
    await user.click(await screen.findByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('lists every turn with a text speaker label, a turn id and a time', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript();
    const list = await screen.findByRole('list', { name: 'Conversation' });
    expect(list.children).toHaveLength(10);
    const first = turnItem(1);
    expect(first).toHaveTextContent('Customer \u2013 Maya Okafor');
    expect(first).toHaveTextContent('Turn 1');
    expect(first).toHaveTextContent('Customer message number 1.');
    expect(first.querySelector('time')).toHaveAttribute('datetime');
    expect(turnItem(2)).toHaveTextContent('You');
    expect(turnItem(2)).toHaveTextContent('Trainee message number 2.');
  });

  it('tells the customer from the learner by words and role, and draws the line as decoration only', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    const customer = turnItem(1);
    const you = turnItem(2);
    expect(customer).toHaveAttribute('data-role', 'customer');
    expect(you).toHaveAttribute('data-role', 'trainee');
    expect(within(customer).getByText('Maya Okafor')).toBeInTheDocument();
    expect(within(you).getByText('You')).toBeInTheDocument();
    // No initials stand in for the speaker: the label says who spoke.
    expect(document.querySelector('.tx-avatar')).toBeNull();
    for (const turn of [customer, you]) {
      expect(turn.querySelector('.tx-spine')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('scrolls to, focuses and highlights the turn named in ?turn=, with a text tag', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript(`/sessions/${SESSION_ID}/transcript?turn=4`);
    await screen.findByRole('list', { name: 'Conversation' });

    const turn = turnItem(4);
    // The page focuses the turn in an effect, which can land just after the list appears.
    await waitFor(() => expect(turn).toHaveFocus());
    expect(turn).toHaveAttribute('data-linked', 'true');
    expect(turn).toHaveAttribute('aria-current', 'location');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    // Turn 4 is cited as evidence in the report, so it carries the text tag and its reasons.
    expect(within(turn).getByText('Cited in report')).toBeInTheDocument();
    expect(within(turn).getByText('Evidence: Opening')).toBeInTheDocument();
    // Other turns are not highlighted.
    expect(turnItem(5)).not.toHaveAttribute('data-linked');
  });

  it('draws a line to the arrived-at turn only, and tags a linked turn the report does not cite', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript(`/sessions/${SESSION_ID}/transcript?turn=5`);
    await screen.findByRole('list', { name: 'Conversation' });
    const turn = turnItem(5);
    await waitFor(() => expect(turn).toHaveFocus());
    expect(within(turn).getByText('Linked turn')).toBeInTheDocument();
    expect(within(turn).queryByText('Cited in report')).not.toBeInTheDocument();
    expect(turn.querySelector('.tx-trace')).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelectorAll('.tx-trace')).toHaveLength(1);
  });

  it('also understands #turn-N', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript(`/sessions/${SESSION_ID}/transcript#turn-6`);
    await screen.findByRole('list', { name: 'Conversation' });
    await waitFor(() => expect(turnItem(6)).toHaveFocus());
  });

  it('shows analysis markers as labelled text and hides them with the switch', async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(makeSession());
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });

    expect(screen.getByText('Customer mood eased: Showed specific empathy')).toBeInTheDocument();
    expect(
      screen.getByText('Discovered: Started right after the password change'),
    ).toBeInTheDocument();
    expect(screen.getByText('Curveball: customer asked for a manager')).toBeInTheDocument();
    expect(screen.queryByText(/-6/)).not.toBeInTheDocument();

    const toggle = screen.getByRole('switch', { name: 'Show analysis markers' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.queryByText(/Customer mood eased/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Curveball: customer asked/)).not.toBeInTheDocument();
  });

  it('sets a star where a hidden fact came out and a jog where a curveball landed', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    expect(turnItem(4)).toHaveAttribute('data-signal', 'true');
    expect(turnItem(4).querySelector('.tx-star')).not.toBeNull();
    expect(turnItem(8)).toHaveAttribute('data-shift', 'true');
    expect(turnItem(5)).not.toHaveAttribute('data-signal');
    expect(turnItem(5)).not.toHaveAttribute('data-shift');
  });

  it('names how the customer sounded on their turns, and keeps the page plain without the markers', async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(makeSession());
    renderTranscript(`/sessions/${SESSION_ID}/transcript?turn=4`);
    await screen.findByRole('list', { name: 'Conversation' });

    // The mood after the last thing the customer heard: angry at turn 4, concerned by turn 8.
    expect(within(turnItem(5)).getByText('Angry')).toBeInTheDocument();
    expect(within(turnItem(9)).getByText('Concerned')).toBeInTheDocument();
    // A trainee's turn gets no mood word of its own.
    expect(turnItem(4).querySelector('.tx-turn__mood')).toBeNull();

    await user.click(screen.getByRole('switch', { name: 'Show analysis markers' }));
    expect(document.querySelector('.tx-turn__mood')).toBeNull();
    expect(document.querySelector('[data-mood]')).toBeNull();
    expect(document.querySelector('[data-signal]')).toBeNull();
    expect(screen.queryByText('Cited in report')).not.toBeInTheDocument();
    // Arriving from the report is not analysis: the linked turn is still found and named.
    expect(turnItem(4)).toHaveAttribute('data-linked', 'true');
    expect(within(turnItem(4)).getByText('Linked turn')).toBeInTheDocument();
  });

  it('underlines the words the report quotes and says why the turn is cited', async () => {
    getSession.mockResolvedValue(
      sessionWithTexts({ 6: 'Well. You should have updated it. Anyway, let us fix it.' }),
    );
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });

    const turn = turnItem(6);
    const quoted = turn.querySelectorAll('mark.tx-quote');
    expect(quoted).toHaveLength(1);
    expect(quoted[0]).toHaveTextContent('You should have updated it.');
    expect(turn.querySelector('.tx-turn__text')).toHaveTextContent(
      'Well. You should have updated it. Anyway, let us fix it.',
    );
    const reasons = within(
      within(turn).getByRole('list', { name: 'Where the report uses this turn' }),
    ).getAllByRole('listitem');
    expect(reasons.map((item) => item.textContent)).toEqual([
      'To improve: Empathy',
      'Turning point',
    ]);
  });

  it('leaves a turn plain when the report quotes all of it, and when its quote cannot be found', async () => {
    getSession.mockResolvedValue(
      sessionWithTexts({ 8: 'I will take this on and call you at 3pm.' }),
    );
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    // Turn 8 is quoted whole, turn 4's quote is not in its words: both are still cited.
    for (const index of [8, 4]) {
      expect(turnItem(index).querySelector('mark')).toBeNull();
      expect(within(turnItem(index)).getByText('Cited in report')).toBeInTheDocument();
    }
  });

  it('shows the underlines only while the analysis markers are on', async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(
      sessionWithTexts({ 6: 'Well. You should have updated it. Anyway, let us fix it.' }),
    );
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    expect(document.querySelectorAll('mark.tx-quote')).toHaveLength(1);
    await user.click(screen.getByRole('switch', { name: 'Show analysis markers' }));
    expect(document.querySelectorAll('mark')).toHaveLength(0);
    expect(turnItem(6).querySelector('.tx-turn__text')).toHaveTextContent(
      'Well. You should have updated it. Anyway, let us fix it.',
    );
  });

  it('shows the turns of a call whose report is not ready, without markers', async () => {
    getSession.mockResolvedValue(
      makeSession({
        status: 'evaluation_failed',
        report: null,
        turns: makeSession().turns.map((t) => ({ ...t, markers: undefined })),
      }),
    );
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    expect(
      screen.getByText('Analysis markers appear once the report is ready.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(document.querySelector('[data-mood]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Retry the report' })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/report`,
    );
  });

  it('points a call that is still being reviewed at the report that is on its way', async () => {
    getSession.mockResolvedValue(makeSession({ status: 'completing', report: null }));
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    expect(screen.getByRole('link', { name: 'See report progress' })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/report`,
    );
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('sends a call that is still active back to the call screen', async () => {
    getSession.mockResolvedValue(makeSession({ status: 'active', report: null }));
    renderTranscript();
    expect(await screen.findByText('The call screen')).toBeInTheDocument();
  });

  it('explains a transcript that cannot be opened and links back to history', async () => {
    getSession.mockRejectedValue(
      new ApiError(404, 'not_found', 'That session was not found.', false),
    );
    renderTranscript();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'We couldn\u2019t open this transcript',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to history' })).toHaveAttribute(
      'href',
      '/history',
    );
  });

  it('wraps a very long unbroken message instead of overflowing', async () => {
    const long = 'x'.repeat(400);
    getSession.mockResolvedValue(sessionWithTexts({ 2: long }));
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    const paragraph = within(turnItem(2)).getByText(long);
    expect(paragraph).toHaveClass('tx-turn__text');
  });
});
