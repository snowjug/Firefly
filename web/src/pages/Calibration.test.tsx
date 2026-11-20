import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CalibrationDTO,
  CalibrationRecordDTO,
  SessionSummaryDTO,
  TranscriptDTO,
} from '#shared/domain/api.ts';
import { computeCalibration, type CalibrationPair } from '#shared/domain/calibration.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import { ApiError } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { ThemeProvider } from '../lib/theme.tsx';
import { ToastProvider } from '../lib/toast.tsx';
import Calibration from './Calibration.tsx';

const mocks = vi.hoisted(() => ({
  calibration: vi.fn(),
  transcript: vi.fn(),
  // The review must never ask for the session or its report.
  getSession: vi.fn(),
  report: vi.fn(),
  mentorScore: vi.fn(),
}));
vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: mocks };
});

const scoresOf = (value: number, overrides: Partial<Record<DimensionId, number>> = {}) =>
  Object.fromEntries(DIMENSION_IDS.map((id) => [id, overrides[id] ?? value])) as Record<
    DimensionId,
    number
  >;

// Distinct values that must never appear while a mentor is scoring blind.
const AI_OVERALL = 4.4;
const SUMMARY: SessionSummaryDTO = {
  id: 'session-1',
  scenarioId: 'locked-out-after-password-reset',
  scenarioTitle: 'Locked out after a password reset',
  issueType: 'sign-in-access',
  difficulty: 'starter',
  startingTemperature: 'calm',
  impact: 'low',
  style: 'talkative',
  mode: 'guided',
  providerKind: 'mock',
  providerLabel: 'Demo mode (built-in rules engine)',
  isSample: false,
  status: 'completed',
  startedAt: '2026-11-18T09:00:00.000Z',
  endedAt: '2026-11-18T09:09:00.000Z',
  durationSeconds: 540,
  traineeTurns: 2,
  completion: 'completed',
  overallScore: AI_OVERALL,
  dimensionScores: scoresOf(4),
  mentorReviewed: false,
};

const TRANSCRIPT: TranscriptDTO = {
  sessionId: SUMMARY.id,
  scenarioTitle: SUMMARY.scenarioTitle,
  persona: { name: 'Maya Lindqvist', role: 'Receptionist', organisation: 'Northwind Clinic' },
  status: 'completed',
  turns: [
    {
      index: 1,
      role: 'customer',
      text: 'Hello, I cannot sign in to the staff portal.',
      createdAt: '2026-11-18T09:00:00.000Z',
    },
    {
      index: 2,
      role: 'trainee',
      text: 'Hi Maya, thanks for calling. What does the sign-in screen say?',
      createdAt: '2026-11-18T09:01:00.000Z',
    },
  ],
};

function pair(
  sessionId: string,
  ai: Record<DimensionId, number>,
  mentor: Record<DimensionId, number>,
) {
  return {
    sessionId,
    evaluatorVersion: 'rules-1.0.0',
    rubricVersion: 'rubric-1',
    source: 'mentor',
    ai,
    mentor,
  } satisfies CalibrationPair;
}

function record(id: number, source: 'mentor' | 'sample', p: CalibrationPair): CalibrationRecordDTO {
  return {
    id,
    sessionId: p.sessionId,
    scenarioTitle: 'Locked out after a password reset',
    reviewer: source === 'sample' ? 'Sample mentor' : 'AB',
    source,
    evaluatorVersion: p.evaluatorVersion,
    rubricVersion: p.rubricVersion,
    ai: p.ai,
    mentor: p.mentor,
    notes: null,
    createdAt: '2026-11-18T10:00:00.000Z',
  };
}

function dto(pairs: CalibrationPair[], extra: Partial<CalibrationDTO> = {}): CalibrationDTO {
  return {
    metrics: computeCalibration(pairs),
    records: pairs.map((p, i) => record(i + 1, 'mentor', p)),
    includesSamples: false,
    reviewable: [],
    ...extra,
  };
}

// The AI scores Clarity one point above the mentor in every review.
const clarityHigh = (n: number) =>
  Array.from({ length: n }, (_, i) => pair(`s${i}`, scoresOf(3, { clarity: 4 }), scoresOf(3)));

function renderCalibration() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/calibration']}>
          <Calibration />
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.calibration.mockResolvedValue(dto([]));
  mocks.transcript.mockResolvedValue(TRANSCRIPT);
});

describe('Calibration studio frame', () => {
  it('is the second of two studio tools, with a real link to the first', async () => {
    renderCalibration();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Calibration' }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Studio' });
    expect(within(nav).getByRole('link', { name: 'Calibration' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Trainer' })).toHaveAttribute('href', '/trainer');
    expect(
      screen.getByText(/Check whether the AI.s coaching scores roughly agree/),
    ).toBeInTheDocument();
  });

  it('keeps the tabs out of the way in the middle of a review', async () => {
    const user = userEvent.setup();
    mocks.calibration.mockResolvedValue(dto([], { reviewable: [SUMMARY] }));
    renderCalibration();
    await user.click(await screen.findByRole('button', { name: /Score this session/ }));

    expect(await screen.findByText('Blind review')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Studio' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Calibration' })).toBeInTheDocument();
  });
});

describe('Calibration results', () => {
  it('explains how to begin when there are no reviews, without inventing figures', async () => {
    renderCalibration();

    expect(await screen.findByText('No mentor reviews yet')).toBeInTheDocument();
    expect(screen.getByText(/calibration guide in docs\/calibration\.md/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Nothing is waiting for review. Finish a practice call and it will appear here.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sessions reviewed')).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Include sample records/ })).not.toBeChecked();
    expect(screen.getByRole('link', { name: 'Trainer page' })).toHaveAttribute('href', '/trainer');
    expect(mocks.calibration).toHaveBeenCalledWith(false, expect.any(AbortSignal));
  });

  it('puts the number of sessions first and avoids describing a lean on a few reviews', async () => {
    const pairs = clarityHigh(2);
    mocks.calibration.mockResolvedValue(dto(pairs));
    renderCalibration();

    expect(
      await screen.findByText('Based on 2 sessions: too few to draw conclusions.'),
    ).toBeInTheDocument();
    expect(screen.getByText(computeCalibration(pairs).caveat)).toBeInTheDocument();
    expect(screen.getByText('Sessions reviewed').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Overall lean').nextElementSibling).toHaveTextContent(
      'Too few reviews to say',
    );
    expect(screen.queryByText(/AI tends to score/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/evaluator version rules-1\.0\.0 and rubric version rubric-1/),
    ).toBeInTheDocument();
  });

  it('reports agreement by skill and a clear lean once enough sessions support it', async () => {
    mocks.calibration.mockResolvedValue(dto(clarityHigh(6)));
    renderCalibration();

    expect(await screen.findByText('Based on 6 sessions: indicative only.')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /Agreement between AI and mentor scores/ });
    const clarity = within(table).getByRole('row', { name: /Clarity/ });
    expect(clarity).toHaveTextContent('1.0');
    expect(clarity).toHaveTextContent('AI tends to score higher (+1.0)');
    expect(within(table).getByRole('row', { name: /Closing/ })).toHaveTextContent(
      'No consistent bias',
    );
    expect(
      screen.getByText('Within 1 point', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('100%');
  });

  it('marks sample records and only asks for them when the box is ticked', async () => {
    const user = userEvent.setup();
    const sample = record(9, 'sample', pair('sample-1', scoresOf(4), scoresOf(4)));
    mocks.calibration.mockImplementation((includeSamples: boolean) =>
      Promise.resolve(
        includeSamples
          ? dto(clarityHigh(1), { records: [sample], includesSamples: true })
          : dto([]),
      ),
    );
    renderCalibration();

    await screen.findByText('No mentor reviews yet');
    await user.click(screen.getByRole('switch', { name: /Include sample records/ }));

    const records = await screen.findByRole('table', { name: /Calibration records/ });
    expect(mocks.calibration).toHaveBeenLastCalledWith(true, expect.any(AbortSignal));
    expect(within(records).getByText('Sample')).toBeInTheDocument();
    expect(screen.getByText(/Includes 1 sample record\./)).toBeInTheDocument();
  });

  it('says when the data cannot be loaded, and tries again on request', async () => {
    const user = userEvent.setup();
    mocks.calibration
      .mockRejectedValueOnce(new ApiError(0, 'network', 'Cannot reach Firefly.', true))
      .mockResolvedValue(dto([]));
    renderCalibration();

    expect(await screen.findByText('Could not load calibration data')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach Firefly.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('No mentor reviews yet')).toBeInTheDocument();
    expect(mocks.calibration).toHaveBeenCalledTimes(2);
  });
});

describe('Calibration review queue', () => {
  it('lists sessions waiting for review without showing their AI scores', async () => {
    mocks.calibration.mockResolvedValue(
      dto([], {
        reviewable: [SUMMARY, { ...SUMMARY, id: 'session-2', completion: 'ended-early' }],
      }),
    );
    renderCalibration();

    await screen.findAllByRole('button', { name: /Score this session/ });
    const queue = screen
      .getAllByRole('listitem')
      .filter((item) => item.textContent?.includes('Locked out after a password reset'));
    expect(queue).toHaveLength(2);
    expect(document.body).not.toHaveTextContent(String(AI_OVERALL));
    expect(within(queue[1] as HTMLElement).getByText('Ended early')).toBeInTheDocument();
    expect(
      within(queue[1] as HTMLElement).getByText(
        'This call stopped before a wrap-up, so the Closing score rests on limited evidence.',
      ),
    ).toBeInTheDocument();
    expect(within(queue[0] as HTMLElement).queryByText('Ended early')).not.toBeInTheDocument();
  });
});

describe('Calibration blind review', () => {
  const review = async (user: ReturnType<typeof userEvent.setup>) => {
    mocks.calibration.mockResolvedValue(dto([], { reviewable: [SUMMARY] }));
    renderCalibration();
    await user.click(await screen.findByRole('button', { name: /Score this session/ }));
    await screen.findByText('Hi Maya, thanks for calling. What does the sign-in screen say?');
  };

  it('loads only the transcript, names each speaker and never shows the AI scores', async () => {
    const user = userEvent.setup();
    await review(user);

    expect(mocks.transcript).toHaveBeenCalledWith('session-1', expect.any(AbortSignal));
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
    const transcript = screen.getByRole('region', { name: 'Call transcript' });
    expect(within(transcript).getByText(/^Customer/)).toBeInTheDocument();
    expect(within(transcript).getByText(/^Trainee/)).toBeInTheDocument();
    expect(screen.getByText('Maya Lindqvist, Receptionist, Northwind Clinic')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(String(AI_OVERALL));
    expect(
      screen.getByRole('heading', { name: 'Locked out after a password reset' }),
    ).toHaveFocus();
  });

  it('says when the transcript cannot be loaded and tries again on request', async () => {
    const user = userEvent.setup();
    mocks.transcript.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(TRANSCRIPT);
    mocks.calibration.mockResolvedValue(dto([], { reviewable: [SUMMARY] }));
    renderCalibration();
    await user.click(await screen.findByRole('button', { name: /Score this session/ }));

    expect(await screen.findByText('Could not load the transcript')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByText('Hi Maya, thanks for calling. What does the sign-in screen say?'),
    ).toBeInTheDocument();
    expect(mocks.transcript).toHaveBeenCalledTimes(2);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it('needs a reviewer and all six scores, and links each problem to its field', async () => {
    const user = userEvent.setup();
    await review(user);

    await user.click(screen.getByRole('button', { name: 'Save review' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('7 things need attention before you can save.');
    expect(mocks.mentorScore).not.toHaveBeenCalled();
    const reviewer = screen.getByLabelText('Reviewer name or initials');
    expect(reviewer).toBeInvalid();
    expect(reviewer).toHaveAccessibleDescription(/Enter your name or initials\./);
    const clarity = screen.getByRole('radiogroup', { name: 'Clarity' });
    expect(clarity).toBeInvalid();
    expect(clarity).toHaveAccessibleDescription(/Choose a score for Clarity\./);

    await user.click(within(alert).getByRole('link', { name: 'Choose a score for Clarity.' }));
    expect(within(clarity).getByRole('radio', { name: '1 \u2013 Not demonstrated' })).toHaveFocus();
    await user.click(within(alert).getByRole('link', { name: 'Enter your name or initials.' }));
    expect(reviewer).toHaveFocus();

    await user.click(within(clarity).getByRole('radio', { name: '3 \u2013 Developing' }));
    expect(clarity).toBeValid();
    expect(screen.getByRole('alert')).toHaveTextContent('6 things need attention');
  });

  it('names the one field that is missing when the mentor leaves only that one empty', async () => {
    const user = userEvent.setup();
    await review(user);

    await user.type(screen.getByLabelText('Reviewer name or initials'), 'jt');
    for (const group of screen.getAllByRole('radiogroup').slice(0, 5)) {
      await user.click(within(group).getByRole('radio', { name: '3 \u2013 Developing' }));
    }
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'One thing needs attention before you can save.',
    );
    expect(screen.getByRole('link', { name: 'Choose a score for Closing.' })).toBeInTheDocument();
    expect(mocks.mentorScore).not.toHaveBeenCalled();
  });

  it('refuses reviewer names the server would reject', async () => {
    const user = userEvent.setup();
    await review(user);

    await user.type(screen.getByLabelText('Reviewer name or initials'), 'a<b>');
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Reviewer name or initials')).toHaveAccessibleDescription(
      /Use letters, numbers and simple punctuation only\./,
    );
    expect(mocks.mentorScore).not.toHaveBeenCalled();
  });

  it('scores with the keyboard: arrow keys move between the numerals and read the choice out', async () => {
    const user = userEvent.setup();
    await review(user);

    const clarity = screen.getByRole('radiogroup', { name: 'Clarity' });
    await user.click(within(clarity).getByRole('radio', { name: '2 \u2013 Emerging' }));
    expect(clarity).toHaveAccessibleDescription(
      /Emerging: Some attempt was made, but major gaps affected the conversation\./,
    );
    await user.keyboard('{ArrowRight}');
    expect(within(clarity).getByRole('radio', { name: '3 \u2013 Developing' })).toBeChecked();
    expect(clarity).toHaveAccessibleDescription(/Developing: Core behaviour/);
  });

  it('saves the scores, refreshes the metrics and then compares them with the AI', async () => {
    const user = userEvent.setup();
    const aiScores = scoresOf(3, { closing: 1 });
    const mentorScores = scoresOf(3, { 'scoping-discovery': 4 });
    const saved = {
      ...record(1, 'mentor', pair('session-1', aiScores, mentorScores)),
      reviewer: 'jt',
    };
    mocks.calibration
      .mockResolvedValueOnce(dto([], { reviewable: [SUMMARY] }))
      .mockResolvedValue(dto([pair('session-1', aiScores, mentorScores)], { records: [saved] }));
    mocks.mentorScore.mockResolvedValue({ saved: true });
    renderCalibration();
    await user.click(await screen.findByRole('button', { name: /Score this session/ }));
    await screen.findByText('Hi Maya, thanks for calling. What does the sign-in screen say?');

    await user.type(screen.getByLabelText('Reviewer name or initials'), ' jt ');
    const groups = screen.getAllByRole('radiogroup');
    expect(groups).toHaveLength(6);
    await user.click(
      within(groups[1] as HTMLElement).getByRole('radio', { name: '4 \u2013 Strong' }),
    );
    for (const group of groups.filter((_, index) => index !== 1)) {
      await user.click(within(group).getByRole('radio', { name: '3 \u2013 Developing' }));
    }
    await user.type(screen.getByLabelText(/Notes/), 'Clear greeting. ');
    expect(screen.getByText('16 / 500')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    await waitFor(() => expect(mocks.mentorScore).toHaveBeenCalledTimes(1));
    expect(mocks.mentorScore).toHaveBeenCalledWith('session-1', {
      reviewer: 'jt',
      scores: mentorScores,
      notes: 'Clear greeting.',
    });
    const table = await screen.findByRole('table', {
      name: /AI and mentor scores for this session/,
    });
    expect(mocks.calibration).toHaveBeenCalledTimes(2);
    expect(within(table).getByRole('columnheader', { name: 'Mentor (jt)' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Scoping & Discovery/ })).toHaveTextContent(
      'AI 1 point lower',
    );
    expect(within(table).getByRole('row', { name: /Clarity/ })).toHaveTextContent('Same score');
    expect(within(table).getByRole('row', { name: /Closing/ })).toHaveTextContent(
      'AI 2 points lower',
    );
    expect(
      screen.getByText('Difference is the AI score minus the mentor score.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/On average they differ by 0\.5 points, and 5 of 6 skills are/),
    ).toBeVisible();
  });

  it('reads identical scores as agreement', async () => {
    const user = userEvent.setup();
    const same = scoresOf(4);
    const saved = { ...record(1, 'mentor', pair('session-1', same, same)), reviewer: 'jt' };
    mocks.calibration
      .mockResolvedValueOnce(dto([], { reviewable: [SUMMARY] }))
      .mockResolvedValue(dto([pair('session-1', same, same)], { records: [saved] }));
    mocks.mentorScore.mockResolvedValue({ saved: true });
    renderCalibration();
    await user.click(await screen.findByRole('button', { name: /Score this session/ }));
    await screen.findByText('Hi Maya, thanks for calling. What does the sign-in screen say?');
    await user.type(screen.getByLabelText('Reviewer name or initials'), 'jt');
    for (const group of screen.getAllByRole('radiogroup')) {
      await user.click(within(group).getByRole('radio', { name: '4 \u2013 Strong' }));
    }
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    const table = await screen.findByRole('table', { name: /AI and mentor scores/ });
    expect(within(table).getAllByText('Same score')).toHaveLength(6);
    expect(
      screen.getByText(/On average they differ by 0\.0 points, and all six skills are/),
    ).toBeVisible();
    // Nothing is claimed beyond the numbers: the picture is hidden, the words say it all.
    expect(table.querySelectorAll('.cal-pair[aria-hidden="true"]')).toHaveLength(6);
  });

  it('says so when the comparison cannot be loaded after saving, and keeps the review safe', async () => {
    const user = userEvent.setup();
    mocks.calibration
      .mockResolvedValueOnce(dto([], { reviewable: [SUMMARY] }))
      .mockRejectedValue(new Error('offline'));
    mocks.mentorScore.mockResolvedValue({ saved: true });
    renderCalibration();
    await user.click(await screen.findByRole('button', { name: /Score this session/ }));
    await screen.findByText('Hi Maya, thanks for calling. What does the sign-in screen say?');
    await user.type(screen.getByLabelText('Reviewer name or initials'), 'jt');
    for (const group of screen.getAllByRole('radiogroup')) {
      await user.click(within(group).getByRole('radio', { name: '3 \u2013 Developing' }));
    }
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    expect(
      await screen.findByText('Your review was saved, but the comparison could not be loaded.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(mocks.mentorScore).toHaveBeenCalledTimes(1);
  });

  it('keeps the form and says so when saving fails', async () => {
    const user = userEvent.setup();
    mocks.mentorScore.mockRejectedValue(new Error('offline'));
    await review(user);

    await user.type(screen.getByLabelText('Reviewer name or initials'), 'jt');
    for (const group of screen.getAllByRole('radiogroup')) {
      await user.click(within(group).getByRole('radio', { name: '3 \u2013 Developing' }));
    }
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.getByLabelText('Reviewer name or initials')).toHaveValue('jt');
    expect(screen.getByRole('button', { name: 'Save review' })).toBeInTheDocument();
  });

  it('asks before discarding scores that have not been saved', async () => {
    const user = userEvent.setup();
    await review(user);

    await user.click(
      within(screen.getAllByRole('radiogroup')[0] as HTMLElement).getByRole('radio', {
        name: '2 \u2013 Emerging',
      }),
    );
    await user.click(
      screen.getAllByRole('button', { name: /Back to the queue/ })[0] as HTMLElement,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Leave this review?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep reviewing' }));
    expect(
      screen.getByRole('heading', { name: 'Locked out after a password reset', level: 2 }),
    ).toBeInTheDocument();

    await user.click(
      screen.getAllByRole('button', { name: /Back to the queue/ })[0] as HTMLElement,
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard and leave' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Sessions waiting for review' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Score this session/ })).toHaveFocus();
  });

  it('leaves at once when nothing has been entered', async () => {
    const user = userEvent.setup();
    await review(user);

    await user.click(
      screen.getAllByRole('button', { name: /Back to the queue/ })[0] as HTMLElement,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Sessions waiting for review' }),
    ).toBeInTheDocument();
  });
});

describe('Calibration records', () => {
  const many = (n: number): CalibrationRecordDTO[] =>
    Array.from({ length: n }, (_, i) => ({
      ...record(i + 1, 'mentor', pair(`s${i}`, scoresOf(3, { clarity: 1 + (i % 5) }), scoresOf(3))),
      scenarioTitle: `Scenario ${String(i + 1).padStart(3, '0')}`,
      reviewer: i % 2 === 0 ? 'AB' : 'ZK',
      createdAt: new Date(Date.UTC(2026, 10, 1 + (i % 28), 9, i % 60)).toISOString(),
      notes: i === 0 ? 'A very long note. '.repeat(40).trim() : null,
    }));

  it('shows 200 records as a real table, newest first, and sorts when a heading is pressed', async () => {
    const user = userEvent.setup();
    const records = many(200);
    mocks.calibration.mockResolvedValue(dto(clarityHigh(6), { records }));
    renderCalibration();

    const table = await screen.findByRole('table', { name: /Calibration records/ });
    const rows = () => [...table.querySelectorAll('tbody tr')];
    expect(rows()).toHaveLength(200);
    expect(within(table).getByRole('columnheader', { name: /^Date/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await user.click(within(table).getByRole('button', { name: 'Scenario' }));
    const scenario = within(table).getByRole('columnheader', { name: /^Scenario/ });
    expect(scenario).toHaveAttribute('aria-sort', 'ascending');
    expect(rows()[0]).toHaveTextContent('Scenario 001');

    await user.click(within(table).getByRole('button', { name: 'Scenario' }));
    expect(scenario).toHaveAttribute('aria-sort', 'descending');
    expect(rows()[0]).toHaveTextContent('Scenario 200');
  }, 30_000);

  it('says each skill in words for the one who cannot see the numerals, and the average gap', async () => {
    const records = many(3);
    mocks.calibration.mockResolvedValue(dto(clarityHigh(1), { records }));
    renderCalibration();

    const table = await screen.findByRole('table', { name: /Calibration records/ });
    const first = within(table).getByRole('row', { name: /Scenario 001/ });
    expect(first).toHaveTextContent('AI 1, mentor 3. AI 2 points lower.');
    expect(first).toHaveTextContent('0.3');
    expect(first).toHaveTextContent('A very long note.');
  });
});
