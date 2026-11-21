import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARE_LABELS, DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { api } from '../../lib/api.ts';
import { CONTRIBUTORS_URL, ISSUES_URL, REPOSITORY_URL } from './links.ts';
import { mockConfig, renderPublicPage } from './test-support.tsx';

vi.setConfig({ testTimeout: 30_000 });

describe('the About page', () => {
  beforeEach(() => mockConfig());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('names itself and sets the document title', async () => {
    await renderPublicPage('/about');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About Firefly');
    expect(
      screen.getByText(
        'Firefly is a practice environment for customer-facing support conversations.',
      ),
    ).toBeVisible();
    await waitFor(() => expect(document.title).toBe('About · Firefly'));
  });

  it('says what it is: product-agnostic practice, for new engineers, and not an assessment', async () => {
    await renderPublicPage('/about');
    const what = screen.getByRole('region', { name: 'What Firefly is' });
    expect(what).toHaveTextContent('new technical-support engineers and apprentices');
    expect(what).toHaveTextContent('It is product-agnostic');
    expect(what).toHaveTextContent('not employee-performance assessment');
  });

  it('credits the project to its contributors without inventing a name or a role', async () => {
    await renderPublicPage('/about');
    const who = screen.getByRole('region', { name: 'Who made it' });
    expect(who).toHaveTextContent('Firefly is a collaborative FY27 apprentice project.');
    const link = within(who).getByRole('link', { name: /Contributors on GitHub/ });
    expect(link).toHaveAttribute('href', CONTRIBUTORS_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(who.querySelectorAll('a')).toHaveLength(1);
  });

  it('explains how it works in one paragraph', async () => {
    await renderPublicPage('/about');
    const how = screen.getByRole('region', { name: 'How it works' });
    expect(how.querySelectorAll('p')).toHaveLength(1);
    expect(how).toHaveTextContent('scenario engine');
    expect(how).toHaveTextContent('rules engine');
    expect(how).toHaveTextContent('language-model provider');
    expect(how).toHaveTextContent('checks every quote in the report against your transcript');
  });

  it('lists the six coaching skills with the words and CARE behaviours from the vocabulary', async () => {
    await renderPublicPage('/about');
    const skills = screen.getByRole('region', { name: 'The six coaching skills' });
    const rows = [...skills.querySelectorAll<HTMLElement>('dl > div')];
    expect(rows).toHaveLength(DIMENSION_IDS.length);
    DIMENSION_IDS.forEach((id, index) => {
      const row = within(rows[index] as HTMLElement);
      expect(row.getByText(DIMENSIONS[id].label)).toBeVisible();
      expect(row.getByText(DIMENSIONS[id].description)).toBeVisible();
      for (const behaviour of DIMENSIONS[id].care) {
        expect(row.getByText(CARE_LABELS[behaviour])).toBeVisible();
      }
    });
    expect(skills).toHaveTextContent(
      'The mapping to the CARE behaviours is a working aid for coaching conversations, not an official standard.',
    );
  });

  it('shows the version the server reports, with where it runs and the licence', async () => {
    await renderPublicPage('/about');
    const status = screen.getByRole('region', { name: 'Status' });
    expect(await within(status).findByText('0.1.0')).toBeVisible();
    expect(within(status).getByText('Version')).toBeVisible();
    expect(status).toHaveTextContent('Runs on your own machine. Not deployed.');
    expect(status).toHaveTextContent('The repository does not currently specify a licence.');
  });

  it('shows nothing about the version when the configuration is unavailable', async () => {
    vi.restoreAllMocks();
    mockConfig(null);
    await renderPublicPage('/about');
    await waitFor(() => expect(api.config).toHaveBeenCalled());
    const status = screen.getByRole('region', { name: 'Status' });
    expect(within(status).queryByText('Version')).not.toBeInTheDocument();
    expect(status).toHaveTextContent('Runs on your own machine. Not deployed.');
  });

  it('links to Responsible AI, the source and the place to report a problem', async () => {
    await renderPublicPage('/about');
    const more = screen.getByRole('region', { name: 'More information' });
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
});
