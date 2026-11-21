import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AZURE_SPEECH_LOGGING_URL,
  AZURE_SPEECH_PRIVACY_URL,
  GEMINI_TERMS_URL,
  ISSUES_URL,
} from './links.ts';
import { RESPONSIBLE_AI_TOC } from './ResponsibleAiSections.tsx';
import { mockConfig, renderPublicPage } from './test-support.tsx';

// The Responsible AI page makes promises, so these tests pin the ones that must stay true and the
// ones that must never be made. The wording is the contract: when a sentence has to change because
// the product changed, change the test in the same commit.

vi.setConfig({ testTimeout: 30_000 });

function stubWideScreen() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 64em'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }),
  });
}

describe('the Responsible AI page', () => {
  beforeEach(() => mockConfig());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('names itself, leads with its purpose and sets the document title', async () => {
    await renderPublicPage('/responsible-ai');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Responsible AI');
    expect(
      screen.getByText(
        'Firefly is a training aid. This page explains what it does with your words, your voice and the AI models behind it.',
      ),
    ).toBeVisible();
    await waitFor(() => expect(document.title).toBe('Responsible AI · Firefly'));
  });

  it('has seven sections, each reachable from "On this page" by a link that names it', async () => {
    await renderPublicPage('/responsible-ai');
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(
      RESPONSIBLE_AI_TOC.map((item) => item.label),
    );
    for (const link of links) {
      const section = document.getElementById(link.getAttribute('href')?.split('#')[1] ?? '');
      expect(section?.tagName).toBe('SECTION');
      expect(within(section as HTMLElement).getByRole('heading', { level: 2 })).toHaveTextContent(
        link.textContent ?? '',
      );
    }
  });

  it('folds "On this page" into a disclosure on a narrow screen, and folds it again after a choice', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    const details = nav.querySelector('details') as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    const summary = within(nav).getByText('On this page', { selector: 'summary span' });
    expect(summary).toBeVisible();

    await user.click(summary);
    expect(details.open).toBe(true);
    await user.click(within(nav).getByRole('link', { name: 'Security' }));
    expect(details.open).toBe(false);
  });

  it('keeps "On this page" open as a plain list on a wide screen', async () => {
    stubWideScreen();
    await renderPublicPage('/responsible-ai');
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    expect(nav.querySelector('details')).toBeNull();
    expect(within(nav).getAllByRole('link')).toHaveLength(RESPONSIBLE_AI_TOC.length);
  });

  it('states plainly the three ways a call can work', async () => {
    await renderPublicPage('/responsible-ai');
    const speech = screen.getByRole('region', { name: 'Speech and audio' });
    expect(
      within(speech)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      'Typed call',
      'Browser speech (Chrome and Edge)',
      'Server speech provider (when configured)',
      'Your microphone and your voice',
      'The customer’s voice',
    ]);
    expect(speech).toHaveTextContent('Nothing is recorded.');
    expect(speech).toHaveTextContent(
      'the browser maker’s online speech service, so your audio may be processed in that company’s cloud',
    );
    expect(speech).toHaveTextContent(
      'Firefly receives the text only. It never receives the audio.',
    );
    expect(speech).toHaveTextContent('your browser sends short audio clips to Firefly’s server');
    expect(speech).toHaveTextContent('Firefly keeps no audio');
    expect(speech).toHaveTextContent('never written to disk and never logged');
  });

  it('describes the microphone and the customer’s voice without overclaiming', async () => {
    await renderPublicPage('/responsible-ai');
    const speech = screen.getByRole('region', { name: 'Speech and audio' });
    expect(speech).toHaveTextContent('The microphone opens only after you start a voice call.');
    expect(speech).toHaveTextContent('You can mute or stop it at any time');
    expect(speech).toHaveTextContent('Firefly does not analyse your voice for emotion');
    expect(speech).toHaveTextContent(
      'not a real person, not a clone and not an imitation of anyone',
    );
  });

  it('gives Microsoft’s statement as Microsoft’s, with its source and the administrator caveat', async () => {
    await renderPublicPage('/responsible-ai');
    const speech = screen.getByRole('region', { name: 'Speech and audio' });
    expect(speech).toHaveTextContent(
      'If your administrator has configured Azure AI Speech, Microsoft states that, for real-time speech to text, audio is processed in memory with no storage at rest by default, unless logging is enabled.',
    );
    expect(speech).toHaveTextContent('Firefly cannot check');
    const link = within(speech).getByRole('link', {
      name: /Data, privacy and security for Speech to text/,
    });
    expect(link).toHaveAttribute('href', AZURE_SPEECH_PRIVACY_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAccessibleName(/opens in a new tab/);
    expect(
      within(speech).getByRole('link', { name: /How to log audio and transcriptions/ }),
    ).toHaveAttribute('href', AZURE_SPEECH_LOGGING_URL);
  });

  it('labels demo mode as demo mode, and says what a live model does and does not receive', async () => {
    await renderPublicPage('/responsible-ai');
    const ai = screen.getByRole('region', { name: 'The AI customer and the coaching' });
    expect(ai).toHaveTextContent('It is labelled “Demo mode” and is never presented as a model.');
    expect(ai).toHaveTextContent(
      'The server, not the model, decides what the customer may reveal in each reply.',
    );
    expect(ai).toHaveTextContent('with personal data replaced');
    expect(ai).toHaveTextContent(
      'Facts the customer is holding back are left out of what the model receives',
    );
  });

  it('says how reports are kept honest, and what is never penalised', async () => {
    await renderPublicPage('/responsible-ai');
    const ai = screen.getByRole('region', { name: 'The AI customer and the coaching' });
    expect(ai).toHaveTextContent('a quote that cannot be found is dropped');
    expect(ai).toHaveTextContent(
      'a 4 needs at least one verified quote and a 5 needs at least two',
    );
    expect(ai).toHaveTextContent(
      'Scores are never lowered for accent, non-native phrasing, grammar or spelling slips',
    );
  });

  it('says what is kept and where, and how to delete it', async () => {
    await renderPublicPage('/responsible-ai');
    const kept = screen.getByRole('region', { name: 'What is kept' });
    expect(kept).toHaveTextContent('stored in a SQLite database on the machine that runs Firefly');
    expect(kept).toHaveTextContent('There are no accounts, no analytics and no tracking.');
    expect(kept).toHaveTextContent('never contain transcripts, messages or audio');
    expect(kept).toHaveTextContent('You can delete any call from its report.');
    expect(kept).toHaveTextContent('Demo mode sends nothing to a model provider.');
    const terms = within(kept).getByRole('link', { name: /Gemini API terms/ });
    expect(terms).toHaveAttribute('href', GEMINI_TERMS_URL);
    expect(kept).toHaveTextContent('keep every call fictional');
  });

  it('lists the protections that exist in the code', async () => {
    await renderPublicPage('/responsible-ai');
    const security = screen.getByRole('region', { name: 'Security' });
    expect(security).toHaveTextContent('stay on the server');
    expect(security).toHaveTextContent('strict content security policy');
    expect(security).toHaveTextContent('same-origin check');
  });

  it('is honest about its limits and says where to report a problem without customer data', async () => {
    await renderPublicPage('/responsible-ai');
    const limits = screen.getByRole('region', { name: 'Known limits and reporting a problem' });
    expect(limits).toHaveTextContent('Coaching can be wrong.');
    expect(limits).toHaveTextContent('Speech recognition can mishear words.');
    expect(limits).toHaveTextContent('Demo mode is pattern based.');
    const issues = within(limits).getByRole('link', { name: /Open an issue on GitHub/ });
    expect(issues).toHaveAttribute('href', ISSUES_URL);
    expect(limits).toHaveTextContent('Please do not paste customer information');
  });

  it('claims no certification and says nothing about where Firefly is deployed', async () => {
    await renderPublicPage('/responsible-ai');
    const text = screen.getByRole('main').textContent ?? '';
    expect(text).toContain('Firefly makes no claim of compliance with any standard or regulation');
    expect(text).not.toMatch(/\b(ISO|SOC ?2|HIPAA|FedRAMP|PCI)\b|certified|accredited|GDPR/i);
    expect(text).not.toMatch(/deploy|hosted|our servers|in production/i);
  });
});
