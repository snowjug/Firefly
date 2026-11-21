import { expect, test } from '@playwright/test';

// An optional smoke test against a REAL provider. It is skipped unless FIREFLY_E2E_REAL=1, and it
// must never run in CI: the pipeline has no credentials and does not set that variable.
//
// How to run it: start Firefly yourself with real credentials (see docs/ai-providers.md), for
// example the Azure OpenAI and Azure AI Speech settings in .env, build the web app, then:
//
//   npm run build
//   npm start                                  (in one terminal, on its own port)
//   $env:FIREFLY_E2E_REAL = '1'
//   $env:E2E_BASE_URL = 'http://127.0.0.1:8787'
//   npx playwright test e2e/real-provider.spec.ts
//
// What it checks, and no more: that the provider names the pages show (the brief's details, the
// call's pre-flight and badge, the report's explanation) are the ones /api/config reports, that one typed
// exchange with the real customer returns a non-empty reply, and that ending the call gives a
// report. It does not judge the quality of anything the model writes. It never uses the microphone.
//
// It does not use the shared fixtures: the console may carry a provider's own warnings, and the
// failure hooks and the mock speech script do not exist on a real server.

const real = process.env.FIREFLY_E2E_REAL === '1';

test.describe('a real provider (set FIREFLY_E2E_REAL=1 and start a server with real credentials)', () => {
  test.skip(!real, 'Only run against a server the operator started with real credentials.');
  test.setTimeout(240_000);

  test('the provider names shown match /api/config, one exchange gets a reply, and the call gets a report', async ({
    page,
    request,
  }) => {
    const settings = (await (await request.get('/api/config')).json()) as {
      provider: { label: string; demo: boolean };
      speech: { label: string; transcribe: boolean; synthesize: boolean };
    };
    expect(settings.provider.label.length).toBeGreaterThan(0);

    await test.step('the brief says who plays the customer and who handles speech', async () => {
      await page.goto('/scenarios/outlook-shared-mailbox-missing/brief');
      await page.getByRole('button', { name: 'How your voice is handled' }).first().click();
      const brief = page.getByRole('main');
      await expect(brief).toContainText(
        settings.provider.demo
          ? "Demo mode: the customer is played by Firefly's built-in rules engine."
          : `Live model: ${settings.provider.label}`,
      );
      if (settings.speech.transcribe || settings.speech.synthesize) {
        await expect(brief).toContainText(settings.speech.label);
      }
    });

    await test.step('a typed call shows the same provider in the pre-flight and in the call bar', async () => {
      await page.getByRole('button', { name: 'Start a text-only call' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Ready to call?' })).toBeVisible();
      await expect(page.getByRole('list', { name: 'What is ready' })).toContainText(
        settings.provider.demo
          ? "Demo mode: Firefly's built-in rules engine"
          : `Live model: ${settings.provider.label}`,
      );
      await page.getByRole('button', { name: 'Start text call' }).click();
      await expect(
        page
          .getByText(settings.provider.demo ? 'Demo mode' : 'Live model', { exact: true })
          .first(),
      ).toBeVisible();
    });

    await test.step('one exchange with the customer gets a reply', async () => {
      const log = page.getByRole('log', { name: 'Call transcript' });
      await page
        .getByRole('textbox', { name: 'Your reply' })
        .fill('Hello, my name is Sam. Can you tell me what is happening?');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(log.getByRole('listitem')).toHaveCount(3, { timeout: 90_000 });
      expect((await log.getByRole('listitem').last().innerText()).trim().length).toBeGreaterThan(
        10,
      );
    });

    await test.step('ending the call gives a report that names the evaluator', async () => {
      await page.getByRole('button', { name: 'End call', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'End the call?' })
        .getByRole('button', { name: 'End and review' })
        .click();
      await expect(page.getByRole('region', { name: 'Summary', exact: true })).toBeVisible({
        timeout: 150_000,
      });
      // The explanation is folded away until it is wanted; its text is in the page all the same.
      await expect(page.getByRole('region', { name: 'About this report' })).toContainText(
        settings.provider.demo ? /demo mode/i : settings.provider.label,
      );
    });
  });
});
