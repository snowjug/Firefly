import { expect, test, type Locator, type Page } from '@playwright/test';
import { createCall, endViaApi, sayViaApi, seriousA11yViolations } from './helpers.ts';

const SPOTLIGHT = 'team-cannot-open-shared-workspace';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/** A finished call, so the report, history, progress and calibration pages have real content. */
async function finishedCall(page: Page) {
  const call = await createCall(page);
  await sayViaApi(
    page,
    call.id,
    "Hello, I'm Sam. I'm sorry you're locked out, let's get you back in. What error do you see?",
  );
  await sayViaApi(
    page,
    call.id,
    'Thanks. When did this start, and has anything changed on the account recently?',
  );
  await sayViaApi(
    page,
    call.id,
    "I'll stay with this and call you back at 3pm with an update. Is there anything else I can help with?",
  );
  await endViaApi(page, call.id);
  return call;
}

async function loadSamples(page: Page) {
  const response = await page.request.post('/api/demo/samples', { data: {} });
  expect(response.ok(), await response.text()).toBeTruthy();
}

interface Stop {
  name: string;
  path: string;
  /** What shows the page has finished loading. Defaults to the page heading. */
  ready?: (page: Page) => Locator;
  /** Brings the page into the state worth checking, for example with samples switched on. */
  prepare?: (page: Page) => Promise<void>;
}

/** Every page a trainee, mentor or trainer can reach, in a state with something to look at. */
function stops(finished: string, live: string): Stop[] {
  return [
    { name: 'Start', path: '/' },
    { name: 'Library', path: '/scenarios' },
    { name: 'Setup', path: `/scenarios/${SPOTLIGHT}/setup` },
    { name: 'Brief', path: `/scenarios/${SPOTLIGHT}/brief` },
    {
      name: 'Live call',
      path: `/calls/${live}`,
      ready: (page) => page.getByRole('region', { name: 'Conversation' }),
    },
    { name: 'Report', path: `/sessions/${finished}/report` },
    { name: 'Transcript', path: `/sessions/${finished}/transcript` },
    { name: 'History', path: '/history' },
    {
      name: 'Progress with samples',
      path: '/progress',
      prepare: async (page) => {
        await page.getByRole('switch', { name: 'Include sample sessions' }).check({ force: true });
        await expect(page.getByText('Sample sessions are included.')).toBeVisible();
      },
    },
    {
      name: 'Calibration with samples',
      path: '/calibration',
      prepare: async (page) => {
        await page.getByLabel(/Include sample records/).check({ force: true });
        await expect(page.getByText('No mentor reviews yet')).toHaveCount(0);
      },
    },
    { name: 'Trainer', path: '/trainer' },
    { name: 'About', path: '/about' },
    { name: 'Settings', path: '/settings' },
    { name: 'Not found', path: '/no-such-page' },
    // Links go out of date, so the missing-thing states are pages too.
    { name: 'Unknown call', path: `/calls/${UNKNOWN_ID}` },
    { name: 'Unknown report', path: `/sessions/${UNKNOWN_ID}/report` },
    { name: 'Unknown transcript', path: `/sessions/${UNKNOWN_ID}/transcript` },
    { name: 'Unknown scenario (setup)', path: '/scenarios/no-such-scenario/setup' },
    { name: 'Unknown scenario (brief)', path: '/scenarios/no-such-scenario/brief' },
  ];
}

async function visit(page: Page, stop: Stop) {
  await page.goto(stop.path);
  await expect(stop.ready?.(page) ?? page.locator('h1').first()).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await stop.prepare?.(page);
}

/** Seeds the data the sweep needs: a finished call, a call in progress and the sample sessions. */
async function seed(page: Page) {
  const finished = await finishedCall(page);
  const live = await createCall(page, SPOTLIGHT, 'standard');
  await loadSamples(page);
  return stops(finished.id, live.id);
}

for (const theme of ['light', 'dark'] as const) {
  test(`every page passes the automated accessibility checks in the ${theme} theme`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.addInitScript(
      (value) => localStorage.setItem('firefly.theme', JSON.stringify(value)),
      theme,
    );
    await page.emulateMedia({ colorScheme: theme });
    const problems: string[] = [];
    for (const stop of await seed(page)) {
      await visit(page, stop);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const violation of await seriousA11yViolations(page)) {
        problems.push(`${stop.name}: ${violation}`);
      }
    }
    expect(problems).toEqual([]);
  });
}

for (const width of [320, 1440]) {
  test(`no page scrolls sideways at ${width}px wide`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: width < 600 ? 640 : 900 });
    const problems: string[] = [];
    for (const stop of await seed(page)) {
      await visit(page, stop);
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      if (scrollWidth > innerWidth) {
        problems.push(`${stop.name}: content is ${scrollWidth}px wide in a ${innerWidth}px window`);
      }
    }
    expect(problems).toEqual([]);
  });
}

test.describe('display preferences', () => {
  const animating = (page: Page) =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('*')].filter((el) =>
          getComputedStyle(el)
            .animationIterationCount.split(',')
            .some((v) => v.trim() === 'infinite'),
        ).length,
    );

  test('motion stops when the device asks for less, and when the app is told to', async ({
    page,
  }) => {
    // With nothing asked for, the start page has looping animation (so the checks below mean something).
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    expect(await animating(page)).toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await animating(page)).toBe(0);

    // The in-app switch works on a device that asks for nothing, and survives a reload.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/settings');
    await page.getByRole('radio', { name: 'On', exact: true }).check({ force: true });
    await expect(page.getByText('Animation and transitions are reduced.')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
    expect(await animating(page)).toBe(0);
  });

  test('the theme applies at once and is still there after a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/settings');
    await page.getByRole('radio', { name: 'Dark', exact: true }).check({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  });
});

test.describe('setup with the keyboard', () => {
  /** Presses Tab until the control has focus, as a keyboard user would. */
  async function tabTo(page: Page, target: Locator, limit = 80) {
    for (let presses = 0; presses <= limit; presses++) {
      if (await target.evaluate((el) => el === document.activeElement)) return;
      await page.keyboard.press('Tab');
    }
    throw new Error('The control cannot be reached with the Tab key');
  }

  test('a call can be set up and begun without a pointer', async ({ page }) => {
    await page.goto('/scenarios/locked-out-after-password-reset/setup');
    const step = page.locator('h2.stp-heading');
    await expect(step).toHaveText('Is this the issue you want to practise?');

    for (let steps = 0; steps < 10; steps++) {
      const current = (await step.textContent()) ?? '';
      if (current.includes('Review your call')) break;
      if (current.includes('How much is the business affected?')) {
        // Radio groups are changed with the arrow keys, from the option Tab lands on.
        await tabTo(page, page.locator('input[type="radio"]:checked').first());
        await page.keyboard.press('ArrowDown');
      }
      await tabTo(page, page.getByRole('button', { name: 'Next' }));
      await page.keyboard.press('Enter');
      await expect(step).not.toHaveText(current);
    }

    await expect(step).toHaveText('Review your call');
    await expect(page.getByText('Changed from default').first()).toBeVisible();
    await tabTo(page, page.getByRole('button', { name: 'Continue to brief' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 2, name: 'Your goal' })).toBeVisible();
    await tabTo(page, page.getByRole('button', { name: 'Begin call' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/calls\/[\w-]+$/);
  });
});

test.describe('mentor calibration', () => {
  const SKILLS = [
    'Opening & Rapport',
    'Scoping & Discovery',
    'Empathy & De-escalation',
    'Clarity',
    'Ownership & Next Steps',
    'Closing',
  ];

  test('a mentor scores a call blind, then sees how the AI compared', async ({ page }) => {
    const call = await finishedCall(page);
    const requests: string[] = [];
    page.on('request', (request) =>
      requests.push(`${request.method()} ${new URL(request.url()).pathname}`),
    );

    const queue = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/calibration',
    );
    await page.goto('/calibration');
    const waiting = (await (await queue).json()) as { reviewable: Record<string, unknown>[] };
    // The queue names the call but carries nothing of the AI's scoring.
    expect(waiting.reviewable).toHaveLength(1);
    expect(waiting.reviewable[0]).not.toHaveProperty('overallScore');
    expect(waiting.reviewable[0]).not.toHaveProperty('dimensionScores');

    await page.getByRole('button', { name: /^Score this session/ }).click();
    await expect(page.getByText('Blind review', { exact: true })).toBeVisible();
    await expect(page.getByText("I'm sorry you're locked out")).toBeVisible();
    // Only the transcript is fetched: not the session and not the report.
    expect(requests).toContain(`GET /api/sessions/${call.id}/transcript`);
    expect(requests).not.toContain(`GET /api/sessions/${call.id}`);
    expect(requests.filter((request) => request.includes('/report'))).toEqual([]);

    // A review needs a name and all six scores, and says what is missing.
    await page.getByRole('button', { name: 'Save review' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /things need attention before you can save/ }),
    ).toBeVisible();

    await page.getByLabel('Reviewer name or initials').fill('AB');
    for (const skill of SKILLS) {
      await page
        .getByRole('radiogroup', { name: skill, exact: true })
        .getByRole('radio', { name: /^3 / })
        .check({ force: true });
    }
    await page.getByRole('button', { name: 'Save review' }).click();

    // The comparison appears only now that the mentor's scores are saved.
    await expect(page.getByText('Review saved', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Mentor (AB)' })).toBeVisible();
    await expect(
      page.getByText('Difference is the AI score minus the mentor score.'),
    ).toBeVisible();
    expect(requests.filter((request) => request.includes('/report'))).toEqual([]);

    await page.getByRole('button', { name: 'Back to calibration' }).click();
    await expect(page.getByText('Nothing is waiting for review.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Review records' })).toBeVisible();
  });
});

test.describe('trainer data tools', () => {
  const sampleCount = (page: Page) =>
    page.locator('dl.tr-counts > div', { hasText: 'Sample sessions' }).locator('dd');
  const practiceCount = (page: Page) =>
    page.locator('dl.tr-counts > div', { hasText: 'Practice sessions' }).locator('dd');

  test('sample sessions are loaded, labelled, kept out of progress and removable', async ({
    page,
  }) => {
    await createCall(page);
    await page.goto('/trainer');
    await expect(sampleCount(page)).toHaveText('0');
    await expect(practiceCount(page)).toHaveText('1');

    await page.getByRole('button', { name: 'Load sample sessions' }).click();
    await page
      .getByRole('dialog', { name: 'Load sample sessions?' })
      .getByRole('button', { name: 'Load sample sessions' })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: /Loaded \d+ sample sessions?, tagged Sample/ }),
    ).toBeVisible();
    await expect(sampleCount(page)).not.toHaveText('0');

    // History labels them. Progress leaves them out until asked.
    await page.goto('/history');
    await expect(page.locator('.chip', { hasText: 'Sample' }).first()).toBeVisible();
    await page.goto('/progress');
    await expect(page.getByText('No completed practice calls yet')).toBeVisible();
    await page.getByRole('switch', { name: 'Include sample sessions' }).check({ force: true });
    await expect(page.getByText('Sample sessions are included.')).toBeVisible();

    // Removing samples leaves the trainee's own call alone.
    await page.goto('/trainer');
    await page.getByRole('button', { name: 'Remove sample sessions' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove sample sessions' }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Removed \d+ sample/ })).toBeVisible();
    await expect(sampleCount(page)).toHaveText('0');
    await expect(practiceCount(page)).toHaveText('1');

    // Reset everything asks first, then clears the data for a clean start.
    await page.getByRole('button', { name: 'Reset everything' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Reset complete/ })).toBeVisible();
    await expect(practiceCount(page)).toHaveText('0');
    await page.goto('/history');
    await expect(page.getByText('No practice sessions yet')).toBeVisible();
  });

  test('cancelling a destructive action changes nothing', async ({ page }) => {
    await createCall(page);
    await page.goto('/trainer');
    await page.getByRole('button', { name: 'Delete my practice sessions' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(practiceCount(page)).toHaveText('1');
  });
});
