import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CARE_LABELS,
  DIMENSION_IDS,
  DIMENSIONS,
  PRODUCT_FAMILIES,
  PRODUCT_FAMILY_LABELS,
} from '#shared/domain/vocab.ts';
import { api } from '../../lib/api.ts';
import { stubIntersection, watching } from '../landing/test-utils.ts';
import { CONTRIBUTORS_URL, ISSUES_URL, REPOSITORY_URL } from './links.ts';
import { mockConfig, renderPublicPage, visibleText, visibleWords } from './test-support.tsx';

vi.setConfig({ testTimeout: 30_000 });

describe('the About page', () => {
  beforeEach(() => mockConfig());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('brings each section in as it scrolls into view, once, and always shows the page’s own heading', async () => {
    stubIntersection();
    await renderPublicPage('/about');
    const title = screen.getByRole('heading', { level: 1 });
    // The heading and its line are the first thing on the page: nothing waits for them.
    expect(title.closest('[data-reveal]')).toBeNull();

    const sections = ['What it is', 'Coaching', 'Status', 'More'].map((name) =>
      screen.getByRole('region', { name }),
    );
    for (const section of sections) {
      expect(section).toHaveAttribute('data-reveal');
      expect(section).not.toHaveAttribute('data-revealed');
    }
    watching(sections[2] as HTMLElement)?.report(true);
    expect(sections[2]).toHaveAttribute('data-revealed');
    // Only the section that was seen: the others wait for their turn, and a seen one is seen for good.
    expect(sections[3]).not.toHaveAttribute('data-revealed');
    expect(watching(sections[2] as HTMLElement)).toBeUndefined();
  });

  it('shows every section at once where the browser cannot say what is in view', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    await renderPublicPage('/about');
    for (const name of ['What it is', 'Coaching', 'Status', 'More']) {
      expect(screen.getByRole('region', { name })).toHaveAttribute('data-revealed');
    }
  });

  it('names itself, leads with one short line and sets the document title', async () => {
    await renderPublicPage('/about');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About Firefly');
    const lead = screen.getByText(
      'A voice-first simulator for practising Microsoft product support calls.',
    );
    expect(lead).toBeVisible();
    expect(visibleWords(lead)).toBeLessThanOrEqual(18);
    await waitFor(() => expect(document.title).toBe('About · Firefly'));
  });

  it('says what it is in a few short bullets, with the product families from the vocabulary', async () => {
    await renderPublicPage('/about');
    const what = screen.getByRole('region', { name: 'What it is' });
    const bullets = within(within(what).getByRole('list')).getAllByRole('listitem');
    expect(bullets).toHaveLength(4);
    for (const bullet of bullets) expect(visibleWords(bullet)).toBeLessThanOrEqual(16);
    expect(what).toHaveTextContent('Practise a support call by voice with a synthetic customer.');
    expect(what).toHaveTextContent(
      `Scenarios cover ${PRODUCT_FAMILIES.slice(0, -1)
        .map((family) => PRODUCT_FAMILY_LABELS[family])
        .join(
          ', ',
        )} and ${PRODUCT_FAMILY_LABELS[PRODUCT_FAMILIES[PRODUCT_FAMILIES.length - 1] as (typeof PRODUCT_FAMILIES)[number]]}.`,
    );
    expect(what).toHaveTextContent('Coaching quotes your transcript, so you can check it.');
  });

  it('credits the project to its contributors without inventing a name or a role', async () => {
    await renderPublicPage('/about');
    const what = screen.getByRole('region', { name: 'What it is' });
    expect(what).toHaveTextContent('A collaborative FY27 apprentice project.');
    const link = within(what).getByRole('link', { name: /Contributors on GitHub/ });
    expect(link).toHaveAttribute('href', CONTRIBUTORS_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(what.querySelectorAll('a')).toHaveLength(1);
  });

  it('keeps the explanation behind a control: product-agnostic practice, and how the customer and coaching are made', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/about');
    const what = screen.getByRole('region', { name: 'What it is' });
    const more = within(what).getByRole('button', { name: 'More about Firefly', expanded: false });
    expect(visibleText(what)).not.toContain('rules engine');
    await user.click(more);
    expect(what).toHaveTextContent('new technical-support engineers and apprentices');
    expect(what).toHaveTextContent('It does not teach product knowledge');
    expect(what).toHaveTextContent('without stating how a product behaves');
    expect(what).toHaveTextContent('scenario engine');
    expect(what).toHaveTextContent('rules engine');
    expect(what).toHaveTextContent('language-model provider');
    expect(what).toHaveTextContent('checks every quote in the report against your transcript');
  });

  it('shows the six coaching skills, and says that the CARE mapping is a working aid', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/about');
    const coaching = screen.getByRole('region', { name: 'Coaching' });
    expect(coaching).toHaveTextContent('Six skills, each scored from 1 to 5.');
    expect(coaching).toHaveTextContent('Scores are practice signals, not an assessment.');
    await user.click(within(coaching).getByRole('button', { name: 'The six skills' }));
    const rows = [...coaching.querySelectorAll<HTMLElement>('dl > div')];
    expect(rows).toHaveLength(DIMENSION_IDS.length);
    DIMENSION_IDS.forEach((id, index) => {
      const row = within(rows[index] as HTMLElement);
      expect(row.getByText(DIMENSIONS[id].label)).toBeVisible();
      expect(row.getByText(DIMENSIONS[id].description)).toBeVisible();
      for (const behaviour of DIMENSIONS[id].care) {
        expect(row.getByText(CARE_LABELS[behaviour])).toBeVisible();
      }
    });
    expect(coaching).toHaveTextContent(
      'The mapping to the CARE behaviours is a working aid for coaching conversations, not an official standard.',
    );
  });

  it('shows the version the server reports, with where it runs and the licence', async () => {
    await renderPublicPage('/about');
    const status = screen.getByRole('region', { name: 'Status' });
    expect(await within(status).findByText('Version 0.1.0.')).toBeVisible();
    expect(status).toHaveTextContent('Runs on your own machine. Not deployed.');
    expect(status).toHaveTextContent('The repository does not currently specify a licence.');
  });

  it('shows nothing about the version when the configuration is unavailable', async () => {
    vi.restoreAllMocks();
    mockConfig(null);
    await renderPublicPage('/about');
    await waitFor(() => expect(api.config).toHaveBeenCalled());
    const status = screen.getByRole('region', { name: 'Status' });
    expect(status).not.toHaveTextContent('Version');
    expect(status).toHaveTextContent('Runs on your own machine. Not deployed.');
  });

  it('links to Responsible AI, the source and the place to report a problem', async () => {
    await renderPublicPage('/about');
    const more = screen.getByRole('region', { name: 'More' });
    expect(within(more).getByRole('link', { name: 'Responsible AI' })).toHaveAttribute(
      'href',
      '/responsible-ai',
    );
    expect(within(more).getByRole('link', { name: /Source on GitHub/ })).toHaveAttribute(
      'href',
      REPOSITORY_URL,
    );
    expect(within(more).getByRole('link', { name: /Report a problem/ })).toHaveAttribute(
      'href',
      ISSUES_URL,
    );
    expect(more).toHaveTextContent('Please do not paste customer information.');
  });

  it('makes no claim of compliance, certification or CBCF alignment', async () => {
    await renderPublicPage('/about');
    const text = screen.getByRole('main').textContent ?? '';
    expect(text).not.toMatch(/\b(ISO|SOC ?2|HIPAA|FedRAMP|PCI)\b|certified|accredited|compliant/i);
    expect(text).not.toMatch(/CBCF/i);
  });
});
