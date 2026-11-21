import { expect, test } from './support/fixtures.ts';

// The landing page and the pages around it, as someone arriving for the first time.

const WORKSPACE = { level: 1, name: 'Scenarios' } as const;

test.describe('landing', () => {
  test('has one heading, three steps, the products, one piece of evidence and a responsible-use note, and asks the server only for the app settings', async ({
    page,
  }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });

    await test.step('open the address', async () => {
      await page.goto('/');
      await expect(page).toHaveTitle('Firefly: practise Microsoft support calls');
    });

    await test.step('one h1 with the promise, and the way in', async () => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Practise Microsoft support calls safely.',
      );
      const hero = page.getByRole('region', { name: 'Practise Microsoft support calls safely.' });
      await expect(hero.getByRole('link', { name: 'Start call' })).toBeVisible();
      await expect(hero.getByRole('link', { name: 'View scenarios' })).toBeVisible();
    });

    await test.step('a call preview that says it is an example with a synthetic customer', async () => {
      const preview = page.getByRole('figure', {
        name: 'Example call. The customer is synthetic.',
      });
      await expect(preview).toBeVisible();
      await expect(preview.getByRole('tab')).toHaveText(['Teams', 'Outlook', 'Entra ID']);
    });

    await test.step('three steps', async () => {
      const steps = page.getByRole('region', { name: 'How it works' });
      await expect(steps.getByRole('heading', { level: 2 })).toHaveText('How it works');
      await expect(steps.getByRole('listitem')).toHaveText([
        /Choose scenario/,
        /Speak naturally/,
        /Review coaching/,
      ]);
    });

    await test.step('the products it practises, as names', async () => {
      const products = page.getByRole('region', { name: 'Microsoft products' });
      await expect(products.getByRole('listitem')).toHaveText([
        'Teams',
        'Outlook',
        'Entra ID',
        'OneDrive',
        'SharePoint',
        'Windows',
        'Azure',
        'Intune',
      ]);
    });

    await test.step('one example of coaching evidence: what was said, and what the coaching made of it', async () => {
      const evidence = page.getByRole('region', { name: 'Coaching evidence' });
      await expect(evidence.getByText('You said')).toBeVisible();
      await expect(evidence.getByRole('blockquote')).toBeVisible();
      await expect(evidence.getByText('Coaching', { exact: true })).toBeVisible();
    });

    await test.step('says plainly that it is a training aid and not an assessment', async () => {
      const note = page.getByRole('region', { name: 'Responsible use' });
      await expect(note).toContainText('Synthetic scenarios only.');
      await expect(note).toContainText('Coaching, not performance assessment.');
      await expect(note.getByRole('link', { name: /^Learn more/ })).toHaveAttribute(
        'href',
        '/responsible-ai',
      );
    });

    await test.step('a final call to action under its own heading', async () => {
      const final = page.getByRole('region', { name: 'Start a Microsoft support call' });
      await expect(final.getByRole('heading', { level: 2 })).toHaveText(
        'Start a Microsoft support call',
      );
      await expect(final.getByRole('link', { name: 'Start call' })).toBeVisible();
    });

    await test.step('a landing page asks the server for the app settings and nothing else', async () => {
      await page.waitForLoadState('networkidle');
      // The settings are read once for the whole app. No scenario, call or speech request is made.
      expect(apiRequests.map((url) => new URL(url).pathname)).toEqual(['/api/config']);
    });
  });

  test('the header offers Scenarios, Responsible AI and Start call, and no section links', async ({
    page,
  }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Firefly home' })).toBeVisible();
    const primary = header.getByRole('navigation', { name: 'Primary' });
    await expect(primary.getByRole('link')).toHaveText(['Scenarios', 'Responsible AI']);
    await expect(header.getByRole('link', { name: 'Start call' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    // The page is short: there is no Overview or How it works link, and no anchor for one.
    await expect(header.getByRole('link', { name: 'Overview' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'How it works' })).toHaveCount(0);
    await expect(page.locator('#overview, #how-it-works')).toHaveCount(0);
  });

  test('the header links reach their pages, and the wordmark goes home', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');

    await test.step('Scenarios opens the scenario workspace', async () => {
      await header.getByRole('link', { name: 'Scenarios' }).click();
      await expect(page).toHaveURL(/\/scenarios(\?.*)?$/);
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });

    await test.step('the wordmark goes home', async () => {
      await page.getByRole('banner').getByRole('link', { name: 'Firefly home' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Practise Microsoft support calls safely.',
      );
    });

    await test.step('Responsible AI opens its page', async () => {
      await page.getByRole('banner').getByRole('link', { name: 'Responsible AI' }).click();
      await expect(page).toHaveURL(/\/responsible-ai$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Responsible AI' })).toBeVisible();
      await expect(page).toHaveTitle(/Responsible AI/);
    });
  });

  test('Start call and View scenarios reach the scenarios in one click, from the header, the hero and the closing call to action', async ({
    page,
  }) => {
    await page.goto('/');

    await test.step('the header button', async () => {
      await page.getByRole('banner').getByRole('link', { name: 'Start call' }).click();
      await expect(page).toHaveURL(/\/scenarios(\?.*)?$/);
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Practise Microsoft support calls safely.',
    );

    const hero = page.getByRole('region', { name: 'Practise Microsoft support calls safely.' });
    await test.step('the hero button', async () => {
      await hero.getByRole('link', { name: 'Start call' }).click();
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });

    await page.goBack();
    await test.step('the hero "View scenarios" link', async () => {
      await hero.getByRole('link', { name: 'View scenarios' }).click();
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });

    await page.goBack();
    await test.step('the closing call to action', async () => {
      const closing = page
        .getByRole('region', { name: 'Start a Microsoft support call' })
        .getByRole('link', { name: 'Start call' });
      await closing.scrollIntoViewIfNeeded();
      await closing.click();
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });
  });

  test('the example call can be switched between products', async ({ page }) => {
    await page.goto('/');
    const preview = page.getByRole('figure', { name: 'Example call. The customer is synthetic.' });
    await expect(preview.getByRole('tab', { name: 'Teams' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await preview.getByRole('tab', { name: 'Outlook' }).click();
    await expect(preview.getByRole('tab', { name: 'Outlook' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const panel = preview.getByRole('tabpanel', { name: 'Outlook' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Daniel Reyes');
    // The people in the examples are made up, and the preview says so.
    await expect(preview).toContainText('Example call. The customer is synthetic.');
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

    await footer.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole('heading', { level: 1, name: 'About Firefly' })).toBeVisible();
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
    await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
  });

  test('the web app keeps nothing in the browser but each page’s scroll position, and one flag once the microphone notice has been read', async ({
    page,
  }) => {
    const stored = () =>
      page.evaluate(async () => ({
        local: Object.fromEntries(Object.entries(localStorage)),
        session: Object.fromEntries(Object.entries(sessionStorage)),
        databases: (await indexedDB.databases()).length,
        caches: (await caches.keys()).length,
        workers: (await navigator.serviceWorker.getRegistrations()).length,
      }));

    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Start call' }).click();
    await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    await page.getByRole('link', { name: 'Review brief' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    // The router saves scroll positions as a page is hidden.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));

    await test.step('reading a scenario and a brief stores nothing', async () => {
      const before = await stored();
      expect(before.local).toEqual({});
      expect(before.databases).toBe(0);
      expect(before.caches).toBe(0);
      expect(before.workers).toBe(0);
      // Only React Router's scroll offsets (page positions, as numbers), never text.
      expect(Object.keys(before.session)).toEqual(['react-router-scroll-positions']);
      const positions = JSON.parse(before.session['react-router-scroll-positions']!) as Record<
        string,
        unknown
      >;
      for (const value of Object.values(positions)) expect(typeof value).toBe('number');
    });

    await test.step('"Got it" remembers that the notice was read, and nothing else', async () => {
      await page.getByRole('button', { name: 'Got it' }).click();
      const after = await stored();
      expect(after.local).toEqual({ 'firefly.voice-notice-seen': '1' });
      expect(after.databases).toBe(0);
      expect(after.caches).toBe(0);
      expect(after.workers).toBe(0);
    });
  });
});
