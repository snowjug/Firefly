// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { getScenarioLibrary } from '#server/scenarios/index.ts';
import { toPublicScenario } from '#server/services/dto.ts';
import { ScenarioCard } from './ScenarioCard.tsx';

// The cards are drawn for the REAL library, not for test data: whatever the library holds, a card
// must stay quick to scan. These render each real scenario to markup (no browser needed) and count
// what a person would read.

const scenarios = getScenarioLibrary().map((definition) => toPublicScenario(definition));

/** The words a person reads: runs of letters or digits, not the dots between phrases. */
const words = (text: string) =>
  text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

const textOf = (markup: string) =>
  markup
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;/g, '\u00b7')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&');

describe.each(scenarios.map((scenario) => [scenario.id, scenario] as const))(
  '%s',
  (_id, scenario) => {
    it('has a card title of two to six words', () => {
      const title = scenario.shortTitle;
      expect(words(title)).toBeGreaterThanOrEqual(2);
      expect(words(title)).toBeLessThanOrEqual(6);
    });

    it('keeps its choosing card to eighteen words in all', () => {
      const markup = renderToStaticMarkup(
        <ScenarioCard
          scenario={scenario}
          mode="select"
          name="gallery"
          selected={false}
          onSelect={() => undefined}
        />,
      );
      expect(words(textOf(markup))).toBeLessThanOrEqual(18);
    });

    it('keeps its link card to eighteen words in all, and leaves the summary out', () => {
      const markup = renderToStaticMarkup(
        <MemoryRouter>
          <ScenarioCard scenario={scenario} mode="link" />
        </MemoryRouter>,
      );
      const text = textOf(markup);
      expect(words(text)).toBeLessThanOrEqual(18);
      expect(text).not.toContain(scenario.listSummary);
      expect(markup).toContain(`href="/scenarios?scenario=${scenario.id}"`);
    });
  },
);

describe('the library as a whole', () => {
  it('has a card for every scenario, and no two cards with the same title', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(16);
    expect(new Set(scenarios.map((scenario) => scenario.shortTitle.toLowerCase())).size).toBe(
      scenarios.length,
    );
  });
});
