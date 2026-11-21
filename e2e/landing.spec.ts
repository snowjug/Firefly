import { expect, test } from './support/fixtures.ts';

// Journey 1: the landing page and the pages around it, as someone arriving for the first time.

test.describe('landing', () => {
  test('the landing page has one heading and its sections, and asks the server only for the app settings', async ({
    page,
  }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });

    await test.step('open the address', async () => {
      await page.goto('/');
      await expect(page).toHaveTitle('Firefly: practise customer conversations');
    });

    await test.step('one h1, the sections, the preview', async () => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Practise the conversation',
      );
      await expect(page.getByRole('heading', { level: 2, name: 'How it works' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Preview of a call workspace' })).toBeVisible();
      await expect(page.getByText('Example from a fictional call')).toBeVisible();
    });

    await test.step('says plainly that it is a training aid and not an assessment', async () => {
      await expect(
        page.getByText(
          'Every customer is fictional. Scores are for coaching practice, not employee-performance assessment.',
        ),
      ).toBeVisible();
    });

    await test.step('a landing page asks the server for the app settings and nothing else', async () => {
      await page.waitForLoadState('networkidle');
      // The settings are read once for the whole app. No scenario, call or speech request is made.
      expect(apiRequests.map((url) => new URL(url).pathname)).toEqual(['/api/config']);
    });
  });

  test('the header links reach their sections and pages', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');

    await test.step('Overview scrolls to its section', async () => {
      await header.getByRole('link', { name: 'Overview' }).click();
      await expect(page).toHaveURL(/#overview$/);
      await expect(page.locator('#overview')).toBeInViewport();
    });

    await test.step('How it works scrolls to its section', async () => {
      await header.getByRole('link', { name: 'How it works' }).click();
      await expect(page).toHaveURL(/#how-it-works$/);
      await expect(page.locator('#how-it-works')).toBeInViewport();
    });

    await test.step('Responsible AI opens its page', async () => {
      await header.getByRole('link', { name: 'Responsible AI' }).click();
      await expect(page).toHaveURL(/\/responsible-ai$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Responsible AI' })).toBeVisible();
      await expect(page).toHaveTitle(/Responsible AI/);
    });

    await test.step('About opens its page', async () => {
      await header.getByRole('link', { name: 'About' }).click();
      await expect(page).toHaveURL(/\/about$/);
      await expect(page.getByRole('heading', { level: 1, name: 'About Firefly' })).toBeVisible();
    });

    await test.step('the wordmark goes home', async () => {
      await header.getByRole('link', { name: 'Firefly home' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Practise the conversation',
      );
    });
  });

  test('Start simulation reaches the scenarios in one click, from the header and from the closing call to action', async ({
    page,
  }) => {
    await page.goto('/');

    await test.step('the header button', async () => {
      await page.getByRole('banner').getByRole('link', { name: 'Start simulation' }).click();
      await expect(page).toHaveURL(/\/scenarios(\?.*)?$/);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Choose a scenario' }),
      ).toBeVisible();
    });

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Practise the conversation',
    );

    await test.step('the hero button', async () => {
      await page
        .getByRole('main')
        .getByRole('link', { name: 'Start a simulation' })
        .first()
        .click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Choose a scenario' }),
      ).toBeVisible();
    });

    await page.goBack();

    await test.step('the closing call to action', async () => {
      const closing = page
        .getByRole('main')
        .getByRole('link', { name: 'Start a simulation' })
        .last();
      await closing.scrollIntoViewIfNeeded();
      await closing.click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Choose a scenario' }),
      ).toBeVisible();
    });
  });

  test('the footer links to the two content pages and to the source, which opens in a new tab', async ({
    page,
  }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Responsible AI' })).toHaveAttribute(
      'href',
      '/responsible-ai',
    );
    await expect(footer.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    const source = footer.getByRole('link', { name: /Source on GitHub/ });
    await expect(source).toHaveAttribute('target', '_blank');
    await expect(source).toHaveAttribute('rel', /noopener/);
  });

  test('an address that does not exist shows the page-not-found page, with a way on', async ({
    page,
  }) => {
    await page.goto('/this/does/not/exist');
    await expect(page).toHaveTitle(/Page not found/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'We cannot find that page' }),
    ).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: 'Go to scenarios' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
  });

  test('the web app keeps nothing in the browser but each page’s scroll position', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Start a simulation' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
    await page.getByRole('radio').first().click();
    await page.getByRole('link', { name: 'Continue to call brief' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Call brief' })).toBeVisible();
    // The router saves scroll positions as a page is hidden.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));

    const stored = await page.evaluate(async () => ({
      local: Object.keys(localStorage),
      session: Object.fromEntries(Object.entries(sessionStorage)),
      databases: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
      workers: (await navigator.serviceWorker.getRegistrations()).length,
    }));
    expect(stored.local).toEqual([]);
    expect(stored.databases).toBe(0);
    expect(stored.caches).toBe(0);
    expect(stored.workers).toBe(0);
    // Only React Router's scroll offsets (page positions, as numbers), never text.
    expect(Object.keys(stored.session)).toEqual(['react-router-scroll-positions']);
    const positions = JSON.parse(stored.session['react-router-scroll-positions']!) as Record<
      string,
      unknown
    >;
    for (const value of Object.values(positions)) expect(typeof value).toBe('number');
  });
});
