import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_ID, makeSession } from '../components/report/report.fixtures.ts';
import { api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
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
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Transcript page', () => {
  it('lists every turn with a text speaker label, a turn id and a time', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript();
    const list = await screen.findByRole('list', { name: 'Conversation' });
    expect(list.children).toHaveLength(10);
    const first = document.getElementById('turn-1') as HTMLElement;
    expect(first).toHaveTextContent('Customer – Maya Okafor');
    expect(first).toHaveTextContent('Turn 1');
    expect(first).toHaveTextContent('Customer message number 1.');
    expect(document.getElementById('turn-2')).toHaveTextContent('You');
    expect(document.getElementById('turn-2')).toHaveTextContent('Trainee message number 2.');
  });

  it('scrolls to, focuses and highlights the turn named in ?turn=, with a text tag', async () => {
    getSession.mockResolvedValue(makeSession());
    renderTranscript(`/sessions/${SESSION_ID}/transcript?turn=4`);
    await screen.findByRole('list', { name: 'Conversation' });

    const turn = document.getElementById('turn-4') as HTMLElement;
    expect(turn).toHaveFocus();
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
    expect(document.getElementById('turn-6')).toHaveFocus();
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
