import type { Page } from '@playwright/test';
import type { SessionDTO } from '../shared/domain/api.ts';
import { expect, test } from './support/fixtures.ts';

// The coaching report on paper. A printed report is complete (nothing closed, nothing that only
// works on a screen), light whatever the app looked like, and cut at sensible places. Playwright's
// print emulation applies the print styles but does not send the page the `beforeprint` event that a
// real print does (it opens what is closed), so the tests send it, as the browser would.

test.describe.configure({ timeout: 90_000 });

const DEFENDER = 'defender-invoices-quarantined';

const CALL = [
  'Hello, my name is Sam. Can you tell me what is happening?',
  "I'm sorry, I can hear how stressful the payment run is. What does the message in quarantine say exactly about why they were held?",
  'When did it last work, and did anything change on your side just before it stopped?',
  'Who else is affected, and is it the same suppliers each time?',
  'What have you already tried so far?',
  "I'll take ownership of this and I will check the quarantine policy and call you back by two o'clock with an update. Let me summarise: your genuine supplier invoices are held as suspected phishing, it started about a week ago, and the payment run is tomorrow. Is there anything else I can help with?",
];

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

async function openReport(page: Page, call: SessionDTO) {
  await page.goto(`/sessions/${call.id}/report`);
  await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
  // The chart is drawn by its own chunk: the page is complete once it is there.
  await expect(
    page.getByRole('group', { name: /^Customer temperature through the call/ }),
  ).toBeVisible();
}

/** What the browser does just before it makes the printed page, as it does it. */
const beforePrint = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
const afterPrint = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

/** Red, green and blue of a computed colour, 0 to 255. */
const channels = (colour: string): number[] =>
  (/\(([^)]+)\)/.exec(colour)?.[1] ?? '')
    .split(/[ ,/]+/)
    .slice(0, 3)
    .map(Number);
const lightness = (colour: string): number => {
  const [red = 0, green = 0, blue = 0] = channels(colour);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
};

test.describe('the printed better wording', () => {
  test('is still struck through and underlined, in black, so it reads without colour', async ({
    page,
    api,
  }) => {
    const call = await api.completedCall({
      lines: [
        'Hello, thanks for calling Microsoft support. My name is Sam. How can I help you today?',
        'It will definitely be fixed in 10 minutes.',
      ],
    });
    await openReport(page, call);
    await page.emulateMedia({ media: 'print' });
    await beforePrint(page);
    const marks = region(page, 'Improvement opportunities').locator('del, ins');
    expect(await marks.count()).toBeGreaterThan(0);
    const looks = await marks.evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        return { line: style.textDecorationLine, colour: style.color };
      }),
    );
    for (const look of looks) {
      expect(look.line).toMatch(/underline|line-through/);
      expect(lightness(look.colour)).toBeLessThan(0.3);
    }
    await afterPrint(page);
    await page.emulateMedia({ media: 'screen' });
  });
});

test.describe('the printed report', () => {
  let call: SessionDTO;

  test.beforeEach(async ({ api, page }) => {
    call = await api.completedCall({
      scenarioId: DEFENDER,
      overrides: { curveballs: ['ask-manager'] },
      lines: CALL,
    });
    await openReport(page, call);
  });

  test('is black on white, even when the app is dark', async ({ page }) => {
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const onScreen = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(lightness(onScreen), 'the app is dark on screen').toBeLessThan(0.3);

    await page.emulateMedia({ media: 'print' });
    await beforePrint(page);
    const paper = await page.evaluate(() => ({
      page: getComputedStyle(document.querySelector('.rp-page') as Element).backgroundColor,
      text: getComputedStyle(document.querySelector('.rp-page') as Element).color,
      body: getComputedStyle(document.body).backgroundColor,
      heading: getComputedStyle(document.querySelector('h1') as Element).color,
    }));
    expect(lightness(paper.body)).toBeGreaterThan(0.95);
    expect(lightness(paper.text)).toBeLessThan(0.3);
    expect(lightness(paper.heading)).toBeLessThan(0.3);
    await afterPrint(page);
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  });

  test('hides what only works on a screen, and says what the report is and when it was printed', async ({
    page,
  }) => {
    await page.emulateMedia({ media: 'print' });
    await beforePrint(page);
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeHidden();
    await expect(page.getByRole('banner')).toBeHidden();
    await expect(page.getByRole('contentinfo')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Print report' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Try another call' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
    await expect(region(page, 'Actions')).toBeHidden();
    await expect(page.getByText('Firefly: coaching report')).toBeVisible();
    await expect(page.getByText(/Practice coaching, not performance assessment\./)).toBeVisible();
    await expect(page.getByText(/^Printed \d/)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    await afterPrint(page);
    await page.emulateMedia({ media: 'screen' });
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible();
  });

  test('is complete: nothing is left closed, and every part is on the page', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });
    await beforePrint(page);

    await test.step('every score is open, with its evidence', async () => {
      const scores = region(page, 'Scores');
      await expect(scores.getByText('Evidence from your call')).toHaveCount(6);
      await expect(scores.getByText('To improve')).toHaveCount(6);
      await expect(scores.getByText('Evidence confidence')).toHaveCount(6);
      await expect(scores.getByRole('button', { name: /details$/ })).toHaveCount(0);
    });

    await test.step('the call journey is a list of every moment, with no selector', async () => {
      const journey = region(page, 'Call journey');
      await expect(journey.getByRole('tablist')).toHaveCount(0);
      const items = journey.locator('.rp-tl__printitem');
      expect(await items.count()).toBeGreaterThanOrEqual(5);
      await expect(items.first()).toBeVisible();
      await expect(items.last()).toBeVisible();
    });

    await test.step('all four CARE principles are on the page, one under another', async () => {
      const care = region(page, 'CARE review');
      // Three of them are out of the accessibility tree on screen (only the chosen one is read); on
      // paper they are all there, which is what is checked, by what is drawn.
      const panels = care.locator('.rp-care__panel');
      await expect(panels).toHaveCount(4);
      for (const panel of await panels.all()) {
        await expect(panel.getByRole('heading', { level: 3, includeHidden: true })).toBeVisible();
        await expect(panel).toBeVisible();
      }
      await expect(care.locator('[role="tablist"]')).toBeHidden();
      await expect(care.getByText('Next action', { exact: true })).toHaveCount(4);
      await expect(care.locator('.rp-behaviour').first()).toBeVisible();
    });

    await test.step('the customer experience, with its table, and the unexpected turn', async () => {
      const experience = region(page, 'Customer experience');
      await expect(experience.getByRole('table')).toBeVisible();
      await expect(
        experience.getByRole('heading', { level: 3, name: 'Unexpected turn' }),
      ).toBeVisible();
    });

    await test.step('what was missed, and what the customer would have said', async () => {
      const hidden = region(page, 'Discovery review').locator('.rp-fact__hidden');
      expect(await hidden.count()).toBeGreaterThan(0);
      for (const text of await hidden.all()) await expect(text).toBeVisible();
    });

    await test.step('the better wording, whole', async () => {
      const wording = region(page, 'Improvement opportunities').getByRole('group', {
        name: 'Better wording',
      });
      await expect(wording.first()).toBeVisible();
      await expect(wording.first().locator('.rp-bw__line--after')).toBeVisible();
    });

    await test.step('the explanation of the report is open', async () => {
      await expect(
        region(page, 'About this report').getByText('CBCF mapping is not applied'),
      ).toBeVisible();
    });

    await test.step('every turn of the transcript is there', async () => {
      const turns = region(page, 'Transcript')
        .getByRole('list', { name: 'Transcript' })
        .locator(':scope > li');
      await expect(turns).toHaveCount(call.turns.length);
      await expect(turns.first()).toBeVisible();
      await expect(turns.last()).toBeVisible();
    });

    await afterPrint(page);
    await page.emulateMedia({ media: 'screen' });
    // Back as it was: the scores are closed again.
    await expect(
      region(page, 'Scores').getByRole('button', { name: /Expand details$/ }),
    ).toHaveCount(6);
  });

  test('keeps a quote, a fact, a moment and a better wording whole, and a heading with what follows it', async ({
    page,
  }) => {
    await page.emulateMedia({ media: 'print' });
    await beforePrint(page);
    const rules = await page.evaluate(() => {
      const pick = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).breakInside : 'missing';
      };
      return {
        quote: pick('.rp-quote'),
        fact: pick('.rp-fact'),
        moment: pick('.rp-moment'),
        wording: pick('.rp-bw'),
        turn: pick('.rp-turn'),
        row: pick('.rp-skill'),
        title: getComputedStyle(document.querySelector('.rp-section__title') as Element).breakAfter,
      };
    });
    expect(rules).toEqual({
      quote: 'avoid',
      fact: 'avoid',
      moment: 'avoid',
      wording: 'avoid',
      turn: 'avoid',
      row: 'avoid',
      title: 'avoid',
    });
    await afterPrint(page);
    await page.emulateMedia({ media: 'screen' });
  });

  test('makes a PDF of several pages, from the whole report', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });
    await beforePrint(page);
    const pdf = await page.pdf({ format: 'A4', printBackground: false });
    await afterPrint(page);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // A page object is `/Type /Page`, as the page tree is `/Type /Pages`.
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
    expect(pages, 'a report is more than a page').toBeGreaterThanOrEqual(3);
    // Everything is open on paper, so a report is long; it is not allowed to sprawl.
    expect(pages, 'and not a sprawl').toBeLessThanOrEqual(30);
  });
});
