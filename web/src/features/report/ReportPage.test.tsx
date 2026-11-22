import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import { ApiError } from '../../lib/api.ts';
import { ReportPage } from './ReportPage.tsx';
import {
  CALLS,
  SERVER_EVALUATION_ERRORS,
  evaluatingSession,
  failedSession,
  unreadableReportSession,
} from './fixtures.ts';
import {
  clientWith,
  renderAtReport,
  scriptedClient,
  stubMatchMedia,
  stubScroll,
  type FakeClient,
} from './test-utils.tsx';

const { strong, weak } = CALLS;

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

const page = (client: FakeClient, slowAfterMs?: number) => (
  <ReportPage sessionId="s1" client={client} slowAfterMs={slowAfterMs} />
);

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const steps = () =>
  within(screen.getByRole('list', { name: 'Report progress' })).getAllByRole('listitem');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('loading and not found', () => {
  it('shows the page while the call loads, with a name for assistive technology', () => {
    renderAtReport(page(clientWith({})));
    expect(screen.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeInTheDocument();
    expect(
      screen.getByText('Loading your coaching report').closest('[role="status"]'),
    ).not.toBeNull();
  });

  it('draws no placeholder for the first moment, and the shape of the page once the wait is not short', async () => {
    vi.useFakeTimers();
    renderAtReport(page(clientWith({})));
    await settle();
    const placeholder = () => document.querySelector('.rp-state__skeleton') as HTMLElement;
    expect(placeholder()).toHaveAttribute('data-waiting');
    // The name is there from the start, for assistive technology.
    expect(screen.getByText('Loading your coaching report')).toBeInTheDocument();
    await settle(149);
    expect(placeholder()).toHaveAttribute('data-waiting');
    await settle(1);
    expect(placeholder()).not.toHaveAttribute('data-waiting');
  });

  it('holds the placeholder back in the same way when motion is reduced: a flash is as unwelcome', async () => {
    vi.useFakeTimers();
    const restore = stubMatchMedia((query) => query.includes('prefers-reduced-motion'));
    try {
      renderAtReport(page(clientWith({})));
      await settle();
      expect(document.querySelector('.rp-state__skeleton')).toHaveAttribute('data-waiting');
      await settle(150);
      expect(document.querySelector('.rp-state__skeleton')).not.toHaveAttribute('data-waiting');
    } finally {
      restore();
    }
  });

  it('never draws the placeholder for a report that arrives before the wait is over', async () => {
    vi.useFakeTimers();
    renderAtReport(page(scriptedClient(strong.session)));
    await settle();
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
    expect(document.querySelector('.rp-state__skeleton')).toBeNull();
  });

  it('says plainly that an unknown call was not found, and links to the scenarios', async () => {
    const client = clientWith({
      getSession: vi.fn(() =>
        Promise.reject(new ApiError(404, 'not_found', 'That session was not found.', false)),
      ),
    });
    renderAtReport(page(client));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Report unavailable' }),
    ).toBeInTheDocument();
    expect(screen.getByText('We could not find this call')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a scenario' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('says when the server could not be reached, and lets the person try again', async () => {
    const getSession = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, 'network', "Can't reach Firefly right now.", true))
      .mockResolvedValue(strong.session);
    renderAtReport(page(clientWith({ getSession })));
    expect(await screen.findByText('Firefly could not load this report')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("Can't reach Firefly right now.");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('sends a call that is still active back to the call', async () => {
    const active: SessionDTO = { ...strong.session, status: 'active', report: null };
    const { router } = renderAtReport(page(scriptedClient(active)));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/calls/s1'));
  });
});

describe('the evaluation under way', () => {
  it('shows the five steps with an icon and a word each, and says the transcript is saved', async () => {
    vi.useFakeTimers();
    renderAtReport(page(scriptedClient(evaluatingSession(strong, 'scoring'))));
    await settle();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Building your coaching report' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Your transcript is saved.')).toBeInTheDocument();
    expect(steps()).toHaveLength(5);
    expect(steps().map((step) => step.textContent)).toEqual([
      expect.stringContaining('Transcript saved'),
      expect.stringContaining('Checking what you found out'),
      expect.stringContaining('Scoring six skills'),
      expect.stringContaining('Writing the report'),
      expect.stringContaining('Report saved'),
    ]);
    expect(steps().map((step) => step.getAttribute('data-status'))).toEqual([
      'done',
      'done',
      'current',
      'waiting',
      'waiting',
    ]);
    // Each step says its state in words, not only in its icon.
    expect(steps()[0]).toHaveTextContent('Done');
    expect(steps()[2]).toHaveTextContent('In progress');
    expect(steps()[3]).toHaveTextContent('Waiting');
  });

  it('makes the list of steps clear only once the wait is not short, and reads it from the first', async () => {
    vi.useFakeTimers();
    renderAtReport(page(scriptedClient(evaluatingSession(strong, 'scoring'))));
    await settle();
    const list = screen.getByRole('list', { name: 'Report progress' });
    expect(list).toHaveAttribute('data-waiting');
    expect(steps()).toHaveLength(5);
    await settle(150);
    expect(list).not.toHaveAttribute('data-waiting');
  });

  it('gives a step a new icon when its state changes, so a spinner that becomes a tick fades in rather than swaps', async () => {
    vi.useFakeTimers();
    const client = scriptedClient(
      evaluatingSession(strong, 'scoring'),
      evaluatingSession(strong, 'building_report'),
    );
    renderAtReport(page(client));
    await settle();
    const icon = () => steps()[2]?.querySelector('.rp-step__icon');
    const before = icon();
    expect(before).not.toBeNull();
    await settle(800);
    expect(steps()[2]).toHaveAttribute('data-status', 'done');
    expect(icon()).not.toBe(before);
  });

  it('asks again every 800 ms and moves each step on as the server reports it', async () => {
    vi.useFakeTimers();
    const client = scriptedClient(
      evaluatingSession(strong, 'discovery_review'),
      evaluatingSession(strong, 'scoring'),
      evaluatingSession(strong, 'building_report'),
      strong.session,
    );
    renderAtReport(page(client));
    await settle();
    const status = () => steps().map((step) => step.getAttribute('data-status'));
    expect(client.getSession).toHaveBeenCalledTimes(1);
    expect(status()).toEqual(['done', 'current', 'waiting', 'waiting', 'waiting']);

    await settle(799);
    expect(client.getSession).toHaveBeenCalledTimes(1);
    await settle(1);
    expect(client.getSession).toHaveBeenCalledTimes(2);
    expect(status()).toEqual(['done', 'done', 'current', 'waiting', 'waiting']);

    await settle(800);
    expect(status()).toEqual(['done', 'done', 'done', 'current', 'waiting']);

    await settle(800);
    expect(screen.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
    const calls = client.getSession.mock.calls.length;
    await settle(5000);
    expect(client.getSession).toHaveBeenCalledTimes(calls);
  });

  it('asks only every 3 seconds while the tab is in the background', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      const client = scriptedClient(evaluatingSession(strong, 'scoring'));
      renderAtReport(page(client));
      await settle();
      expect(client.getSession).toHaveBeenCalledTimes(1);
      await settle(2999);
      expect(client.getSession).toHaveBeenCalledTimes(1);
      await settle(1);
      expect(client.getSession).toHaveBeenCalledTimes(2);
    } finally {
      Reflect.deleteProperty(document, 'hidden');
    }
  });

  it('says the wait is longer than usual after 40 seconds, and offers the saved transcript', async () => {
    vi.useFakeTimers();
    const client = scriptedClient(evaluatingSession(strong, 'scoring'));
    renderAtReport(page(client));
    await settle();
    await settle(39_000);
    expect(screen.queryByText(/taking longer than usual/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Transcript' })).not.toBeInTheDocument();
    await settle(1100);
    expect(
      screen.getByText(
        /This is taking longer than usual\. Your transcript is saved and you can leave this page\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read your transcript' })).toHaveAttribute(
      'href',
      '#transcript',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Transcript' })).toBeInTheDocument();
    // The transcript works without a report: every turn is there, with no markers or citations.
    expect(screen.getAllByText(/^Turn \d+$/)).toHaveLength(strong.session.turns.length);
    expect(screen.queryByText(/Cited for/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mood: /)).not.toBeInTheDocument();
  });

  it('stops asking, and cancels the request in flight, when the page is left', async () => {
    vi.useFakeTimers();
    const client = scriptedClient(evaluatingSession(strong, 'scoring'));
    const { unmount } = renderAtReport(page(client));
    await settle();
    await settle(1700);
    const calls = client.getSession.mock.calls.length;
    expect(calls).toBeGreaterThan(1);
    const signal = client.getSession.mock.calls.at(-1)?.[1] as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
    await settle(10_000);
    expect(client.getSession).toHaveBeenCalledTimes(calls);
  });

  it('keeps trying after the server stops answering, and says so, then carries on when it answers', async () => {
    vi.useFakeTimers();
    const trouble = new ApiError(0, 'network', "Can't reach Firefly right now.", true);
    const getSession = vi
      .fn()
      .mockResolvedValueOnce(evaluatingSession(strong, 'scoring'))
      .mockRejectedValueOnce(trouble)
      .mockRejectedValueOnce(trouble)
      .mockRejectedValueOnce(trouble)
      .mockResolvedValue(evaluatingSession(strong, 'building_report'));
    renderAtReport(page(clientWith({ getSession })));
    await settle();
    await settle(800 * 3);
    expect(screen.getByText(/cannot reach the server to check progress/)).toBeInTheDocument();
    expect(
      screen.getByText(/Your transcript is saved, and this page keeps trying/),
    ).toBeInTheDocument();
    // Never the raw error.
    expect(document.body).not.toHaveTextContent("Can't reach Firefly right now.");
    await settle(800);
    expect(screen.queryByText(/cannot reach the server/)).not.toBeInTheDocument();
    expect(steps()[3]).toHaveAttribute('data-status', 'current');
  });

  it('moves focus to the report heading and says so when the report is ready', async () => {
    vi.useFakeTimers();
    const client = scriptedClient(evaluatingSession(strong, 'building_report'), strong.session);
    renderAtReport(page(client));
    await settle();
    await settle(800);
    const heading = screen.getByRole('heading', { level: 1, name: 'Coaching report' });
    expect(heading).toHaveFocus();
    // The polite region speaks one sentence at a time, so it reaches this one after the one before.
    await settle(800);
    expect(
      screen
        .getAllByRole('status')
        .some((s) => /Your coaching report is ready\./.test(s.textContent ?? '')),
    ).toBe(true);
  });
});

describe('revealing the report', () => {
  const root = () => document.querySelector('.rp-page');

  it('fades the report in when it has just been made while the page was open', async () => {
    vi.useFakeTimers();
    renderAtReport(
      page(scriptedClient(evaluatingSession(strong, 'building_report'), strong.session)),
    );
    await settle();
    await settle(800);
    expect(root()).toHaveClass('rp-reveal');
  });

  it('does not, under reduced motion', async () => {
    vi.useFakeTimers();
    const restore = stubMatchMedia((query) => query.includes('prefers-reduced-motion'));
    try {
      renderAtReport(
        page(scriptedClient(evaluatingSession(strong, 'building_report'), strong.session)),
      );
      await settle();
      await settle(800);
      expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
      expect(root()).not.toHaveClass('rp-reveal');
    } finally {
      restore();
    }
  });

  it('does not when the report was already there on opening the page', async () => {
    vi.useFakeTimers();
    renderAtReport(page(scriptedClient(strong.session)));
    await settle();
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
    expect(root()).not.toHaveClass('rp-reveal');
  });
});

describe('a failed evaluation', () => {
  it('says what happened, that the call is saved and what to do, and shows the whole transcript', async () => {
    const failed = failedSession(weak, SERVER_EVALUATION_ERRORS.internal);
    renderAtReport(page(scriptedClient(failed)));
    const alert = await screen.findByRole('alert');
    expect(screen.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeInTheDocument();
    expect(alert).toHaveTextContent('The coaching report could not be finished');
    // The server's message already says the transcript is safe, so it is not said a second time.
    expect(alert).toHaveTextContent(SERVER_EVALUATION_ERRORS.internal.message);
    expect(alert.textContent?.match(/transcript/gi)).toHaveLength(1);
    expect(within(alert).getByRole('button', { name: 'Retry evaluation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Transcript' })).toBeInTheDocument();
    expect(screen.getAllByText(/^Turn \d+$/)).toHaveLength(weak.session.turns.length);
    expect(screen.queryByRole('navigation', { name: 'On this page' })).not.toBeInTheDocument();
  });

  it('says the call is saved when the server\u2019s words do not', async () => {
    renderAtReport(
      page(scriptedClient(failedSession(weak, SERVER_EVALUATION_ERRORS.providerBusy))),
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(SERVER_EVALUATION_ERRORS.providerBusy.message);
    expect(alert).toHaveTextContent('Your call and its transcript are saved. Nothing was lost.');
  });

  it('retries the evaluation, follows it, and shows the report when it is done', async () => {
    vi.useFakeTimers();
    const client = scriptedClient(
      failedSession(weak, SERVER_EVALUATION_ERRORS.providerBusy),
      weak.session,
    );
    client.evaluate.mockResolvedValue(evaluatingSession(weak, 'discovery_review'));
    renderAtReport(page(client));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Retry evaluation' }));
    await settle();
    expect(client.evaluate).toHaveBeenCalledWith('s1');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Building your coaching report' }),
    ).toBeInTheDocument();
    await settle(800);
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
    expect(document.querySelector('.rp-page')).toHaveClass('rp-reveal');
  });

  it('offers no retry when trying again cannot help', async () => {
    renderAtReport(
      page(scriptedClient(failedSession(weak, SERVER_EVALUATION_ERRORS.notConfigured))),
    );
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Retry evaluation' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Trying again will not fix this');
    expect(screen.getByRole('heading', { level: 2, name: 'Transcript' })).toBeInTheDocument();
  });

  it('says when starting again did not work, in the server\u2019s safe words', async () => {
    const client = scriptedClient(failedSession(weak, SERVER_EVALUATION_ERRORS.internal));
    client.evaluate.mockRejectedValue(
      new ApiError(
        503,
        'provider_unavailable',
        'The AI provider is not available right now. Please try again in a moment.',
        true,
      ),
    );
    renderAtReport(page(client));
    await userEvent.click(await screen.findByRole('button', { name: 'Retry evaluation' }));
    expect(await screen.findByText('The evaluation did not start again')).toBeInTheDocument();
    expect(screen.getByText(/The AI provider is not available right now/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry evaluation' })).toBeEnabled();
  });

  it('never shows raw error text, from the stored failure or from a retry', async () => {
    const raw =
      'Error: connect ECONNREFUSED 10.0.0.12:443 {"error":{"message":"provider stack at /srv/app/x.js:12:3"}}';
    const failed = failedSession(weak, { message: raw, retryable: true });
    const client = scriptedClient(failed);
    client.evaluate.mockRejectedValue(
      new ApiError(
        500,
        'internal',
        'TypeError: undefined is not a function at /srv/app/y.js:4:2',
        true,
      ),
    );
    renderAtReport(page(client));
    await userEvent.click(await screen.findByRole('button', { name: 'Retry evaluation' }));
    await screen.findByText('The evaluation did not start again');
    for (const fragment of [
      'ECONNREFUSED',
      'provider stack',
      '/srv/app',
      'TypeError',
      '{"error"',
    ]) {
      expect(document.body).not.toHaveTextContent(fragment);
    }
    // Our own words instead.
    expect(
      screen.getByText('Something went wrong while the coaching report was being prepared.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Firefly could not start the evaluation again. Please try again.'),
    ).toBeInTheDocument();
  });

  it('treats a completed call whose report cannot be read as a failure that a retry cannot fix', async () => {
    renderAtReport(page(scriptedClient(unreadableReportSession(strong))));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The saved coaching report for this call could not be read.',
    );
    expect(screen.queryByRole('button', { name: 'Retry evaluation' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Turn \d+$/)).toHaveLength(strong.session.turns.length);
  });

  it('lets the person leave, or delete the call, from the failure', async () => {
    renderAtReport(page(scriptedClient(failedSession(weak, SERVER_EVALUATION_ERRORS.internal))));
    await screen.findByRole('alert');
    expect(screen.getByRole('link', { name: 'Try another call' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.getByRole('button', { name: 'Delete this call' })).toBeInTheDocument();
  });
});

describe('the completed report', () => {
  it('opens at the report with one level-one heading and its own title', async () => {
    renderAtReport(page(scriptedClient(strong.session)));
    await screen.findByRole('navigation', { name: 'On this page' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe('Coaching report \u00b7 Firefly');
  });

  it('shows a call saved before the Microsoft scenarios without a product or CARE', async () => {
    renderAtReport(page(scriptedClient(CALLS.legacy.session)));
    await screen.findByRole('navigation', { name: 'On this page' });
    expect(screen.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'CARE review' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Microsoft/)).not.toBeInTheDocument();
  });

  it('asks which scenarios exist once, and only for a finished report', async () => {
    const client = scriptedClient(strong.session);
    renderAtReport(page(client));
    await screen.findByRole('navigation', { name: 'On this page' });
    await vi.waitFor(() => expect(client.scenarios).toHaveBeenCalledTimes(1));
    cleanup();
    const evaluating = scriptedClient(evaluatingSession(strong, 'scoring'));
    renderAtReport(page(evaluating));
    await screen.findByRole('heading', { level: 1, name: 'Building your coaching report' });
    expect(evaluating.scenarios).not.toHaveBeenCalled();
  });

  it('jumps to a section and puts focus on its heading', async () => {
    const { scroll, restore } = stubScroll();
    try {
      renderAtReport(page(scriptedClient(strong.session)));
      const nav = await screen.findByRole('navigation', { name: 'On this page' });
      await userEvent.click(within(nav).getByRole('link', { name: 'Discovery review' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Discovery review' })).toHaveFocus();
      expect(scroll).toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});
