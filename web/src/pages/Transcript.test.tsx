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
    const first = document.getElementById('turn-1') as HTMLElement;
    expect(first).toHaveTextContent('Customer \u2013 Maya Okafor');
    expect(first).toHaveTextContent('Turn 1');
    expect(first).toHaveTextContent('Customer message number 1.');
    expect(first.querySelector('time')).toHaveAttribute('datetime');
    expect(document.getElementById('turn-2')).toHaveTextContent('You');
    expect(document.getElementById('turn-2')).toHaveTextContent('Trainee message number 2.');
  });

  it('puts the customer and the learner on opposite sides, with avatars that are only decoration', async () => {
    localStorage.setItem(
      'firefly.profile',
      JSON.stringify({ name: 'Priya Raman', role: '', location: '', preferences: {} }),
    );
    resetProfileForTests();
    getSession.mockResolvedValue(makeSession());
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    const customer = document.getElementById('turn-1') as HTMLElement;
    const you = document.getElementById('turn-2') as HTMLElement;
    expect(customer).toHaveAttribute('data-role', 'customer');
    expect(you).toHaveAttribute('data-role', 'trainee');
    const customerAvatar = customer.querySelector('.tx-avatar') as HTMLElement;
    const yourAvatar = you.querySelector('.tx-avatar') as HTMLElement;
    expect(customerAvatar).toHaveAttribute('aria-hidden', 'true');
    expect(customerAvatar).toHaveTextContent('MO');
    expect(yourAvatar).toHaveAttribute('aria-hidden', 'true');
    expect(yourAvatar).toHaveTextContent('PR');
  });

  it('scrolls to, focuses and highlights the turn named in ?turn=, with a text tag', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript(`/sessions/${SESSION_ID}/transcript?turn=4`);
    await screen.findByRole('list', { name: 'Conversation' });

    const turn = document.getElementById('turn-4') as HTMLElement;
    // The page focuses the turn in an effect, which can land just after the list appears.
    await waitFor(() => expect(turn).toHaveFocus());
    expect(turn).toHaveAttribute('data-linked', 'true');
    expect(turn).toHaveAttribute('aria-current', 'location');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    // Turn 4 is cited as evidence in the report, so it carries the text tag and its reasons.
    expect(within(turn).getByText('Cited in report')).toBeInTheDocument();
    expect(within(turn).getByText('Evidence: Opening')).toBeInTheDocument();
    // Other turns are not highlighted.
    expect(document.getElementById('turn-5')).not.toHaveAttribute('data-linked');
  });

  it('also understands #turn-N', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript(`/sessions/${SESSION_ID}/transcript#turn-6`);
    await screen.findByRole('list', { name: 'Conversation' });
    await waitFor(() => expect(document.getElementById('turn-6')).toHaveFocus());
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
    expect(screen.getByRole('link', { name: 'Retry the report' })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_ID}/report`,
    );
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
    const session = makeSession();
    getSession.mockResolvedValue({
      ...session,
      turns: session.turns.map((t) => (t.index === 2 ? { ...t, text: long } : t)),
    });
    renderTranscript();
    await screen.findByRole('list', { name: 'Conversation' });
    const paragraph = within(document.getElementById('turn-2') as HTMLElement).getByText(long);
    expect(paragraph).toHaveClass('tx-text');
  });
});
