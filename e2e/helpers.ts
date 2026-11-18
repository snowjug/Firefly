import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export interface CreatedCall {
  id: string;
  persona: string;
}

/** Starts a call through the API (the same request the Brief page makes) and returns its id. */
export async function createCall(
  page: Page,
  scenarioId = 'locked-out-after-password-reset',
  difficulty: 'starter' | 'standard' | 'challenge' = 'starter',
  overrides: Record<string, unknown> = {},
): Promise<CreatedCall> {
  const response = await page.request.post('/api/sessions', {
    data: { scenarioId, overrides: { difficulty, ...overrides }, clientRequestId: randomUUID() },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { session } = (await response.json()) as {
    session: { id: string; scenario: { persona: { name: string } } };
  };
  return { id: session.id, persona: session.scenario.persona.name };
}

/** Makes the next customer reply, classification or evaluation fail (server-wide test hook). */
export async function failNext(page: Page, target: 'customer' | 'classifier' | 'evaluator') {
  const response = await page.request.post('/api/test/fail-next', { data: { target, count: 1 } });
  expect(response.ok()).toBeTruthy();
}

export function composer(page: Page) {
  return page.getByLabel('Your reply to the customer');
}

/** Types into the composer and sends with the keyboard, as a trainee would. */
export async function say(page: Page, text: string) {
  const box = composer(page);
  await box.fill(text);
  await box.press('Enter');
}

/** Sends a message through the API so a test can set up a conversation quickly. */
export async function sayViaApi(page: Page, id: string, text: string) {
  const response = await page.request.post(`/api/sessions/${id}/messages`, {
    data: { text, clientMessageId: randomUUID() },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

export async function endViaApi(page: Page, id: string) {
  const response = await page.request.post(`/api/sessions/${id}/end`, { data: {} });
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect
    .poll(
      async () => {
        const session = (await (await page.request.get(`/api/sessions/${id}`)).json()) as {
          session: { status: string };
        };
        return session.session.status;
      },
      { timeout: 15_000 },
    )
    .toBe('completed');
}

/** Serious or critical automated accessibility violations on the current page, as readable lines. */
export async function seriousA11yViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes, e.g. ${v.nodes[0]?.target})`);
}

/** Fails the test on any serious or critical automated accessibility violation. */
export async function expectNoSeriousA11yViolations(page: Page, context?: string) {
  expect(await seriousA11yViolations(page), context).toEqual([]);
}
