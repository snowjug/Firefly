import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AZURE_SPEECH_LOGGING_URL,
  AZURE_SPEECH_PRIVACY_URL,
  GEMINI_TERMS_URL,
  ISSUES_URL,
} from './links.ts';
import { mockConfig, renderPublicPage, visibleWords } from './test-support.tsx';

// The Responsible AI page makes promises, so these tests pin the ones that must stay true and the
// ones that must never be made. The page shows a few short bullets per section and folds the detail
// away: the budgets apply to what is on screen, the promises to everything on the page. The wording
// is the contract: when a sentence has to change because the product changed, change the test in the
// same commit.

vi.setConfig({ testTimeout: 30_000 });

const SECTIONS = [
  ['Practice only', 'More about practice use'],
  ['Microphone and speech', 'How speech is handled'],
  ['AI customer and coaching', 'How the AI and coaching work'],
  ['What is kept', 'What is stored, and security'],
  ['Limits', 'Known limits and reporting'],
] as const;

/** Opens one section's detail, and returns the region of that section. */
async function open(user: ReturnType<typeof userEvent.setup>, section: string, control: string) {
  const region = screen.getByRole('region', { name: section });
  await user.click(within(region).getByRole('button', { name: control }));
  return region;
}

describe('the Responsible AI page', () => {
  beforeEach(() => mockConfig());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('names itself, leads with one short line and sets the document title', async () => {
    await renderPublicPage('/responsible-ai');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Responsible AI');
    const lead = screen.getByText(
      'Firefly is a training aid. Here is how it treats your words and voice.',
    );
    expect(lead).toBeVisible();
    expect(visibleWords(lead)).toBeLessThanOrEqual(18);
    await waitFor(() => expect(document.title).toBe('Responsible AI · Firefly'));
  });

  it('has five short sections, each a region with a few brief bullets', async () => {
    await renderPublicPage('/responsible-ai');
    expect(
      screen.getAllByRole('region').map((region) => region.getAttribute('aria-labelledby')),
    ).toHaveLength(5);
    for (const [name] of SECTIONS) {
      const region = screen.getByRole('region', { name });
      expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent(name);
      const bullets = within(within(region).getByRole('list')).getAllByRole('listitem');
      expect(bullets.length, name).toBeGreaterThanOrEqual(3);
      expect(bullets.length, name).toBeLessThanOrEqual(4);
      for (const bullet of bullets)
        expect(visibleWords(bullet), bullet.textContent ?? '').toBeLessThanOrEqual(16);
    }
  });

  it('shows far fewer words than the page it replaced (1562), because the detail is folded away', async () => {
    await renderPublicPage('/responsible-ai');
    const main = screen.getByRole('main');
    expect(visibleWords(main)).toBeLessThan(230);
    expect((main.textContent ?? '').split(/\s+/).length).toBeGreaterThan(900);
  });

  it('folds each detail into a button with its own name, closed until it is asked for', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const names = SECTIONS.map(([, control]) => control);
    expect(new Set(names).size).toBe(names.length);
    for (const control of names) {
      expect(screen.getByRole('button', { name: control, expanded: false })).toBeInTheDocument();
    }
    const region = await open(user, 'Practice only', 'More about practice use');
    expect(
      screen.getByRole('button', { name: 'More about practice use', expanded: true }),
    ).toHaveFocus();
    expect(within(region).getByText(/Take each report to a mentor/)).toBeVisible();
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('button', { name: 'More about practice use', expanded: false }),
    ).toBeInTheDocument();
    expect(within(region).getByText(/Take each report to a mentor/)).not.toBeVisible();
  });

  it('is practice only: fictional, never an assessment, and says what the safety net cannot do', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const region = await open(user, 'Practice only', 'More about practice use');
    expect(region).toHaveTextContent('Customers, organisations and cases are fictional.');
    expect(region).toHaveTextContent('Scores are practice signals, not an assessment of you.');
    expect(region).toHaveTextContent('Never say or type real customer information.');
    expect(region).toHaveTextContent('not an employee-performance assessment');
    expect(region).toHaveTextContent(
      'nothing it produces should be used to judge, rank or compare people',
    );
    expect(region).toHaveTextContent('This is pattern matching and will not catch everything.');
    expect(region).toHaveTextContent('it cannot filter audio');
  });

  it('states plainly how speech is handled, in each of the three set-ups', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const speech = await open(user, 'Microphone and speech', 'How speech is handled');
    expect(
      within(speech)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      'Typed call',
      'Browser speech (Chrome and Edge)',
      'Server speech provider (when configured)',
      'Your microphone',
      'The customer’s voice',
    ]);
    expect(speech).toHaveTextContent('Nothing is recorded.');
    expect(speech).toHaveTextContent('may be processed in that company’s cloud');
    expect(speech).toHaveTextContent('Firefly receives the text only, never the audio.');
    expect(speech).toHaveTextContent('never written to disk or logged');
    expect(speech).toHaveTextContent('It opens only after you start a voice call.');
    expect(speech).toHaveTextContent('You can mute or stop it at any time');
    expect(speech).toHaveTextContent(
      'Firefly does not analyse your voice for emotion, tone, accent or pace.',
    );
    expect(speech).toHaveTextContent(
      'not a real person, not a clone and not an imitation of anyone',
    );
  });

  it('gives Microsoft’s statement as Microsoft’s, with its sources and the administrator caveat', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const speech = await open(user, 'Microphone and speech', 'How speech is handled');
    expect(speech).toHaveTextContent(
      'If an administrator has configured Azure AI Speech, Microsoft states that, for real-time speech to text, audio is processed in memory with no storage at rest by default, unless logging is enabled.',
    );
    expect(speech).toHaveTextContent('which Firefly cannot check');
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
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const ai = await open(user, 'AI customer and coaching', 'How the AI and coaching work');
    expect(ai).toHaveTextContent('Demo mode is labelled wherever the provider shows.');
    expect(ai).toHaveTextContent('labelled “Demo mode”, never presented as a model');
    expect(ai).toHaveTextContent(
      'The server, not the model, decides what the customer may reveal.',
    );
    expect(ai).toHaveTextContent('with personal data replaced');
    expect(ai).toHaveTextContent('Facts held back are left out of what the model receives');
  });

  it('says how reports are kept honest, and what is never penalised', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const ai = await open(user, 'AI customer and coaching', 'How the AI and coaching work');
    expect(ai).toHaveTextContent('Every quote in a report is checked against your transcript.');
    expect(ai).toHaveTextContent('A quote that cannot be found is dropped.');
    expect(ai).toHaveTextContent(
      'a 4 needs at least one verified quote and a 5 needs at least two',
    );
    expect(ai).toHaveTextContent('Coaching can be wrong. Review it with a mentor.');
    expect(ai).toHaveTextContent(
      'Scores are never lowered for accent, non-native phrasing, grammar or spelling slips',
    );
  });

  it('says what is kept and where, how to delete it, and what a provider receives', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const kept = await open(user, 'What is kept', 'What is stored, and security');
    expect(kept).toHaveTextContent(
      'Transcripts and reports stay on the machine that runs Firefly.',
    );
    expect(kept).toHaveTextContent('stored in a SQLite database on the machine that runs Firefly');
    expect(kept).toHaveTextContent('No accounts, analytics or tracking.');
    expect(kept).toHaveTextContent('never contain transcripts, messages or audio');
    expect(kept).toHaveTextContent('You can delete a call from its report.');
    expect(kept).toHaveTextContent('Demo mode sends nothing to a model provider.');
    expect(within(kept).getByRole('link', { name: /Gemini API terms/ })).toHaveAttribute(
      'href',
      GEMINI_TERMS_URL,
    );
    expect(kept).toHaveTextContent('keep every call fictional');
  });

  it('lists the protections that exist in the code', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const kept = await open(user, 'What is kept', 'What is stored, and security');
    expect(within(kept).getByRole('heading', { level: 3, name: 'Security' })).toBeVisible();
    expect(kept).toHaveTextContent('stay on the server');
    expect(kept).toHaveTextContent('strict content security policy');
    expect(kept).toHaveTextContent('same-origin check');
  });

  it('is honest about its limits and says where to report a problem without customer data', async () => {
    const user = userEvent.setup();
    await renderPublicPage('/responsible-ai');
    const limits = await open(user, 'Limits', 'Known limits and reporting');
    expect(limits).toHaveTextContent('Coaching can be wrong.');
    expect(limits).toHaveTextContent('Speech recognition can mishear words.');
    expect(limits).toHaveTextContent('Demo mode is pattern based.');
    expect(limits).toHaveTextContent('No official CBCF mapping is applied.');
    const issues = within(limits).getByRole('link', { name: /Open an issue on GitHub/ });
    expect(issues).toHaveAttribute('href', ISSUES_URL);
    expect(limits).toHaveTextContent('Please do not paste customer information');
  });

  it('claims no certification, no compliance and no CBCF alignment, and says nothing about where Firefly is deployed', async () => {
    await renderPublicPage('/responsible-ai');
    const text = screen.getByRole('main').textContent ?? '';
    expect(text).toContain('Firefly makes no claim of compliance with any standard or regulation');
    expect(text).toContain('no CBCF mapping is applied');
    expect(text).not.toMatch(/\b(ISO|SOC ?2|HIPAA|FedRAMP|PCI)\b|certified|accredited|GDPR/i);
    expect(text).not.toMatch(/deploy|hosted|our servers|in production/i);
    expect(text).not.toMatch(/CBCF[- ](aligned|compliant|certified)/i);
  });

  it('prints every detail: a printed page cannot be clicked', () => {
    const css = readFileSync(
      join(process.cwd(), 'web/src/design/primitives/disclosure.css'),
      'utf8',
    );
    expect(css).toMatch(
      /@media print\s*\{[^}]*\.ff-disclosure__panel\[hidden\]\s*\{\s*display:\s*block\s*!important/,
    );
  });
});
