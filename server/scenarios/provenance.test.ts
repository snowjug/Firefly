import { describe, expect, it, vi } from 'vitest';
import {
  BEHAVIOUR_CHECKS,
  GroundingSchema,
  PROVENANCE_KEYS,
  REVIEW_STATES,
  SOURCE_CATEGORIES,
  type ScenarioDefinition,
} from '#shared/domain/scenario.ts';
import { createLogger } from '../log.ts';
import { getScenarioLibrary, loadScenarios, semanticIssues } from './index.ts';
import { provenanceLeaks, provenanceTable } from './provenance.ts';

// Every scenario carries an internal record of when it was written and how far its product wording
// was checked. It has to say something true (nothing defaults), and it has to stay inside: it is
// printed by `npm run validate:scenarios` and by nothing a trainee, a browser or a log can see.

const library = getScenarioLibrary();
const first = library[0] as ScenarioDefinition;

const record = (patch: Record<string, unknown> = {}) => ({
  authoredOn: '2026-11-21',
  productFamily: 'microsoft-365',
  sourceCategories: ['author-experience'],
  behaviourCheck: 'not-checked',
  syntheticConfirmed: true,
  review: 'unreviewed',
  ...patch,
});
const problems = (patch: Record<string, unknown>) => {
  const result = GroundingSchema.safeParse(record(patch));
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('the provenance record', () => {
  it('accepts an honest first record: written, never checked, not reviewed', () => {
    expect(GroundingSchema.safeParse(record()).success).toBe(true);
    expect(GroundingSchema.safeParse(record({ revisedOn: '2026-11-21' })).success).toBe(true);
  });

  it('has no defaults, so nothing is claimed that nobody wrote', () => {
    expect(GroundingSchema.safeParse({}).success).toBe(false);
    for (const field of [
      'authoredOn',
      'productFamily',
      'sourceCategories',
      'behaviourCheck',
      'syntheticConfirmed',
      'review',
    ]) {
      const partial = record();
      delete (partial as Record<string, unknown>)[field];
      expect(GroundingSchema.safeParse(partial).success, field).toBe(false);
    }
  });

  it('wants real calendar dates, and a revision that is not before the first writing', () => {
    for (const authoredOn of ['2026-02-30', '2026-13-01', '21-11-2026', '2026-11-21T09:00', '']) {
      expect(problems({ authoredOn }).join(), authoredOn).toMatch(/authoredOn/);
    }
    expect(problems({ authoredOn: '2024-02-29' })).toEqual([]);
    expect(problems({ authoredOn: '2026-02-29' }).join()).toMatch(/authoredOn/);
    expect(problems({ revisedOn: '2026-11-20' }).join()).toMatch(/revisedOn is before authoredOn/);
  });

  it('wants at least one source category, each once, and only the known ones', () => {
    expect(problems({ sourceCategories: [] }).join()).toMatch(/sourceCategories/);
    expect(
      problems({ sourceCategories: ['author-experience', 'author-experience'] }).join(),
    ).toMatch(/listed twice/);
    expect(problems({ sourceCategories: ['internal-wiki'] }).join()).toMatch(/sourceCategories/);
  });

  it('wants the invented-data confirmation to be exactly true', () => {
    expect(problems({ syntheticConfirmed: false }).join()).toMatch(/syntheticConfirmed/);
    expect(problems({ syntheticConfirmed: 'yes' }).join()).toMatch(/syntheticConfirmed/);
  });

  it('never lets a check without a date, or a check against nothing public, stand', () => {
    expect(problems({ behaviourCheck: 'checked-partly' }).join()).toMatch(/checkedOn is needed/);
    expect(problems({ behaviourCheck: 'checked-partly', checkedOn: '2026-11-22' }).join()).toMatch(
      /at least one public source category/,
    );
    expect(
      problems({
        behaviourCheck: 'checked-partly',
        checkedOn: '2026-11-22',
        sourceCategories: ['microsoft-learn'],
      }),
    ).toEqual([]);
  });

  it('never lets "checked-current" or "mentor-reviewed" stand without saying what they rest on', () => {
    const current = {
      behaviourCheck: 'checked-current',
      checkedOn: '2026-11-22',
      sourceCategories: ['microsoft-learn', 'microsoft-support'],
    };
    expect(problems(current).join()).toMatch(/notes are needed/);
    expect(
      problems({ ...current, notes: 'Two current pages agree with the customer report.' }),
    ).toEqual([]);
    expect(problems({ review: 'mentor-reviewed' }).join()).toMatch(/notes are needed/);
    expect(
      problems({ review: 'mentor-reviewed', notes: 'Read for realism and data safety.' }),
    ).toEqual([]);
    expect(problems({ notes: 'x'.repeat(301) }).join()).toMatch(/notes/);
  });

  it('is required of every scenario, and names the field when it is missing or wrong', () => {
    const without = structuredClone(first) as unknown as Record<string, unknown>;
    delete without.grounding;
    expect(loadScenarios([without]).errors.join('\n')).toMatch(/grounding/);
    const wrong = structuredClone(first) as unknown as { grounding: Record<string, unknown> };
    wrong.grounding.review = 'finished';
    expect(loadScenarios([wrong]).errors.join('\n')).toMatch(/grounding\.review/);
  });

  it('must name the family of the scenario’s own product', () => {
    const wrong = structuredClone(first);
    wrong.grounding.productFamily = 'azure';
    expect(semanticIssues(wrong).join('\n')).toMatch(
      /grounding\.productFamily "azure" is not the family of outlook \("microsoft-365"\)/,
    );
    expect(semanticIssues(first)).toEqual([]);
  });

  it('keeps web addresses, and so internal links, out of its notes', () => {
    const linked = structuredClone(first);
    linked.grounding.notes = 'Read the page at https://example.test/internal/page first.';
    expect(semanticIssues(linked).join('\n')).toMatch(/a web address in grounding\.notes/);
  });
});

describe('the provenance table', () => {
  it('has one line for each scenario under a header, with the columns lined up', () => {
    const lines = provenanceTable(library);
    expect(lines).toHaveLength(library.length + 1);
    expect(lines[0]).toMatch(/^id\s+family\s+authoredOn\s+behaviourCheck\s+review$/);
    const dateColumn = (lines[0] as string).indexOf('authoredOn');
    for (const s of library) {
      const line = lines.find((l) => l.startsWith(`${s.id} `));
      expect(line, s.id).toBeDefined();
      expect(line, s.id).toContain(s.grounding.authoredOn);
      expect(line, s.id).toContain(s.grounding.behaviourCheck);
      expect(line, s.id).toContain(s.grounding.review);
      expect((line as string).indexOf(s.grounding.authoredOn), s.id).toBe(dateColumn);
    }
  });
});

describe('keeping the record internal', () => {
  it('finds a provenance field at any depth, in objects and in lists', () => {
    expect(provenanceLeaks({ a: { b: [{ review: 'x' }] }, grounding: {} })).toEqual([
      '$.a.b[0].review',
      '$.grounding',
    ]);
    for (const key of PROVENANCE_KEYS)
      expect(provenanceLeaks({ deep: { [key]: 1 } })).toHaveLength(1);
    expect(provenanceLeaks({ title: 'A review of the call', items: [1, 'grounding'] })).toEqual([]);
  });

  it('is never written to a log line, even when a caller passes it', () => {
    const lines: string[] = [];
    createLogger((line) => lines.push(line)).info('x', {
      route: 'GET /api/scenarios',
      ...Object.fromEntries(PROVENANCE_KEYS.map((key) => [key, 'leaked'])),
    });
    expect(lines.join('')).toContain('GET /api/scenarios');
    expect(lines.join('')).not.toContain('leaked');
  });

  it('is not printed by the loader, whether the library loads or a record is wrong', () => {
    const printed: string[] = [];
    const capture = (...args: unknown[]) => void printed.push(args.map(String).join(' '));
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(capture),
    );
    const stdout = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(((chunk: unknown) => (printed.push(String(chunk)), true)) as never);
    try {
      expect(loadScenarios().errors).toEqual([]);
      expect(getScenarioLibrary()).toHaveLength(library.length);
      const wrong = structuredClone(first) as unknown as { grounding: Record<string, unknown> };
      wrong.grounding.review = 'a-value-nobody-should-see';
      wrong.grounding.notes = 'x'.repeat(301);
      const { errors } = loadScenarios([wrong]);
      // The error says which field is wrong, and never repeats what was written in it.
      expect(errors.join('\n')).toMatch(/grounding\.review/);
      expect(errors.join('\n')).not.toContain('a-value-nobody-should-see');
    } finally {
      for (const spy of spies) spy.mockRestore();
      stdout.mockRestore();
    }
    expect(printed).toEqual([]);
  });

  it('uses values that never occur as ordinary words in what a trainee reads', () => {
    const publicText = JSON.stringify(library.map(({ grounding: _grounding, ...rest }) => rest));
    for (const value of [...SOURCE_CATEGORIES, ...BEHAVIOUR_CHECKS, ...REVIEW_STATES]) {
      expect(publicText, value).not.toContain(value);
    }
  });
});
