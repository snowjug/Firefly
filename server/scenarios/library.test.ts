import { describe, expect, it } from 'vitest';
import { applyConfig, availableCurveballTypes } from '#shared/domain/config.ts';
import { ScenarioDefinitionSchema, wordCount } from '#shared/domain/scenario.ts';
import type { ScenarioDefinition } from '#shared/domain/scenario.ts';
import {
  CALL_STAGES,
  DIFFICULTIES,
  IMPACTS,
  PRODUCT_FAMILIES,
  PRODUCT_IDS,
  PRODUCT_INFO,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
} from '#shared/domain/vocab.ts';
import { toPublicScenario } from '../services/dto.ts';
import {
  distinctiveTokens,
  getScenarioLibrary,
  loadScenarios,
  semanticIssues,
  sharedPhrase,
} from './index.ts';

// The library as a whole: what it covers, what a trainee can read before a call, and the checks
// that keep authored text honest. How the customer behaves on these scenarios is tested in
// server/engine/library.test.ts.

const library = getScenarioLibrary();
const first = library[0] as ScenarioDefinition;

/** Every string in a value. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/** Every wording a hidden fact can have, across impact levels. */
function wordings(fact: ScenarioDefinition['hiddenFacts'][number]): string[] {
  return [
    ...strings({
      a: fact.statement,
      b: fact.partialStatement,
      c: fact.statementTerse,
      d: fact.statementSimple,
    }),
    ...strings(fact.byImpact ?? {}),
  ];
}

const copy = (patch: (s: ScenarioDefinition) => void): ScenarioDefinition => {
  const clone = structuredClone(first);
  patch(clone);
  return clone;
};

describe('the library', () => {
  it('loads without any validation errors, with every scenario about a Microsoft product', () => {
    expect(loadScenarios().errors).toEqual([]);
    expect(library.length).toBeGreaterThanOrEqual(12);
    for (const scenario of library) {
      expect(PRODUCT_IDS, scenario.id).toContain(scenario.product.id);
    }
  });

  it('covers every Microsoft product family and every product it promises', () => {
    const families = new Set(library.map((s) => PRODUCT_INFO[s.product.id].family));
    expect([...families].sort()).toEqual([...PRODUCT_FAMILIES].sort());
    const products = new Set(library.map((s) => s.product.id));
    expect([...products].sort()).toEqual([...PRODUCT_IDS].sort());
  });

  it('covers the range of calls the product promises', () => {
    const used = <T>(pick: (s: ScenarioDefinition) => T) => new Set(library.map(pick));
    expect([...used((s) => s.difficulty)].sort()).toEqual([...DIFFICULTIES].sort());
    expect([...used((s) => s.startingTemperature)].sort()).toEqual([...START_TEMPERATURES].sort());
    expect([...used((s) => s.style)].sort()).toEqual([...STYLES].sort());
    expect([...used((s) => s.callStage)].sort()).toEqual([...CALL_STAGES].sort());
    expect([...used((s) => s.impact)].sort()).toEqual([...IMPACTS].sort());
    expect([...used((s) => s.proficiency)].sort()).toEqual([...PROFICIENCIES].sort());
    for (const difficulty of DIFFICULTIES) {
      expect(library.filter((s) => s.difficulty === difficulty).length, difficulty).toBeGreaterThan(
        2,
      );
    }
    expect(used((s) => s.issueType).size).toBeGreaterThanOrEqual(8);
  });

  it('keeps people, organisations and case numbers fictional, distinct and well formed', () => {
    const names = library.map((s) => s.persona.name);
    expect(new Set(names).size).toBe(names.length);
    const refs = library.map((s) => s.caseReference);
    expect(new Set(refs).size).toBe(refs.length);
    for (const scenario of library) {
      expect(scenario.caseReference, scenario.id).toMatch(/^SIM-\d{6}$/);
      const text = JSON.stringify(scenario);
      expect(text, scenario.id).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(text, scenario.id).not.toMatch(/https?:\/\/|www\./i);
      expect(text, scenario.id).not.toMatch(/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/);
    }
  });

  it('gives every scenario the fact classes, the expectations and the empty CBCF list it needs', () => {
    for (const s of library) {
      expect(s.unknownFacts.length, `${s.id} unknown`).toBeGreaterThan(0);
      expect(
        s.vagueFacts.length + s.checkableFacts.length,
        `${s.id} vague/checkable`,
      ).toBeGreaterThan(0);
      expect(s.hiddenFacts.length, `${s.id} hidden`).toBeGreaterThanOrEqual(3);
      for (const principle of [
        'communicate',
        'accountable',
        'resourceful',
        'empathetic',
      ] as const) {
        expect(s.careExpectations[principle].length, `${s.id} ${principle}`).toBeGreaterThan(0);
      }
      // No CBCF material exists, so nothing may be written as if it did.
      expect(s.cbcfBehaviours, s.id).toEqual([]);
      expect(JSON.stringify(s), s.id).not.toMatch(/\bCBCF\b/i);
    }
  });

  it('gives every call stage a stand-alone opening that says what the call is about', () => {
    for (const s of library) {
      for (const stage of ['follow-up', 'escalated', 'closure'] as const) {
        const { opening } = s.stageFrames[stage];
        expect(wordCount(opening), `${s.id} ${stage}`).toBeLessThanOrEqual(60);
        expect(opening.split(/(?<=[.!?])\s+/).length, `${s.id} ${stage}`).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('what a trainee can read before a call', () => {
  it('stays inside the word budgets of the screens that show it', () => {
    for (const s of library) {
      const dto = toPublicScenario(s);
      expect(wordCount(dto.listSummary), `${s.id} listSummary`).toBeLessThanOrEqual(18);
      expect(wordCount(dto.summary), `${s.id} summary`).toBeLessThanOrEqual(60);
      expect(wordCount(dto.publicBrief.issue), `${s.id} issue`).toBeLessThanOrEqual(18);
      expect(wordCount(dto.publicBrief.objective), `${s.id} objective`).toBeLessThanOrEqual(18);
      for (const level of IMPACTS) {
        expect(wordCount(dto.publicBrief.impact[level]), `${s.id} ${level}`).toBeLessThanOrEqual(
          16,
        );
      }
    }
  });

  it('never carries the words or numbers of a hidden fact, in any wording or impact level', () => {
    for (const s of library) {
      const shown = strings(toPublicScenario(s)).join(' \n ');
      const lower = shown.toLowerCase();
      for (const fact of s.hiddenFacts) {
        for (const wording of wordings(fact)) {
          for (const token of distinctiveTokens(wording)) {
            expect(lower, `${s.id} ${fact.id} token ${token}`).not.toContain(token);
          }
          expect(sharedPhrase(wording, shown), `${s.id} ${fact.id}`).toBeNull();
        }
      }
    }
  });

  it('names the product from one place, and never from free text', () => {
    for (const s of library) {
      const dto = toPublicScenario(s);
      expect(dto.product.name, s.id).toBe(PRODUCT_INFO[s.product.id].name);
      expect(applyConfig(s).environment.product, s.id).toBe(PRODUCT_INFO[s.product.id].name);
    }
  });
});

describe('configuring a call', () => {
  it('follows the impact level and the call stage in what exists and what is said', () => {
    for (const s of library) {
      for (const impact of IMPACTS) {
        for (const callStage of CALL_STAGES) {
          const effective = applyConfig(s, { impact, callStage }, { seed: 1 });
          const label = `${s.id} ${impact}/${callStage}`;
          expect(effective.affectedUsers, label).toEqual(s.affectedUsers[impact]);
          expect(effective.impactVariant, label).toEqual(s.impactVariants[impact]);
          for (const fact of effective.hiddenFacts) {
            expect(fact.stages ?? [callStage], label).toContain(callStage);
            const own = fact.byImpact?.[impact];
            if (own) expect(fact.statement, `${label} ${fact.id}`).toBe(own.statement);
          }
          for (const group of [
            effective.knownFacts,
            effective.vagueFacts,
            effective.checkableFacts,
            effective.unknownFacts,
            effective.irrelevantFacts,
            effective.incorrectAssumptions,
          ]) {
            for (const item of group as { id: string; stages?: string[] }[]) {
              expect(item.stages ?? [callStage], `${label} ${item.id}`).toContain(callStage);
            }
          }
          // Whatever the stage, the customer can still say what the problem is.
          expect(
            effective.knownFacts.some((f) => f.intents.includes('problem_description')),
            label,
          ).toBe(true);
        }
      }
    }
  });

  it('offers only the curveballs a scenario allows, and never fires another', () => {
    for (const s of library) {
      expect(availableCurveballTypes(s), s.id).toEqual(s.allowedCurveballs);
      for (const difficulty of DIFFICULTIES) {
        const effective = applyConfig(s, { difficulty }, { seed: 1 });
        for (const type of effective.config.curveballTypes) {
          expect(s.allowedCurveballs, `${s.id} ${difficulty}`).toContain(type);
        }
      }
      const all = applyConfig(s, { curveballs: ['change-issue', 'ask-manager', 'deadline'] });
      for (const type of all.config.curveballTypes) expect(s.allowedCurveballs).toContain(type);
    }
  });
});

describe('the checks on authored text', () => {
  it('accepts every scenario in the library', () => {
    for (const s of library) expect(semanticIssues(s), s.id).toEqual([]);
  });

  it('rejects a hidden fact that is repeated, by wording or by number, in anything shown earlier', () => {
    const fact = first.hiddenFacts[0] as ScenarioDefinition['hiddenFacts'][number];
    const repeated = copy((s) => {
      s.listSummary = `The customer says: ${fact.statement}`.split(/\s+/).slice(0, 16).join(' ');
    });
    expect(semanticIssues(repeated).join('\n')).toMatch(/is repeated/);
    const hinted = copy((s) => {
      const other = s.hiddenFacts[1];
      const own = s.hiddenFacts[0];
      if (own && other) own.hint = other.statement;
    });
    expect(semanticIssues(hinted).join('\n')).toMatch(/gives away hidden fact/);
  });

  it('rejects product claims the scenario has no business making', () => {
    const issuesFor = (text: string) =>
      semanticIssues(copy((s) => void (s.knownFacts[0] && (s.knownFacts[0].text = text)))).join(
        '\n',
      );
    expect(issuesFor('It started after KB5034441 was installed.')).toMatch(/KB article number/);
    expect(issuesFor('It shows error 0x80070005 each time.')).toMatch(/hexadecimal error code/);
    expect(issuesFor('It says AADSTS50076 when we try.')).toMatch(/error code/);
    expect(issuesFor('Please open https://portal.example.com to see it.')).toMatch(/web address/);
    expect(issuesFor('Run Get-Mailbox for the user and check.')).toMatch(/command or cmdlet/);
    expect(issuesFor('It happens on version 22H2 of the app.')).toMatch(/version or build number/);
    expect(issuesFor('Go to Settings > Accounts and look there.')).toMatch(/menu path/);
    expect(issuesFor('Call me on 555-123-4567 about it.')).toMatch(/phone number/);
    // Everyday words that merely look like a command are fine.
    expect(issuesFor('We used a stop-gap, then a set-up that did not help.')).toBe('');
  });

  it('finds shared wording only when it is long enough, and made of more than small words', () => {
    expect(
      sharedPhrase('Only external meetings are affected.', 'only external meetings are affected'),
    ).toBe('only external meetings are');
    expect(sharedPhrase('I think it was fine.', 'I think it was fine')).toBeNull();
    expect(
      sharedPhrase('We had a new approval process built last year', 'a new approval process'),
    ).toBeNull();
    expect(
      sharedPhrase(
        'The policy was changed yesterday afternoon by an administrator',
        'a policy was changed yesterday afternoon',
      ),
    ).not.toBeNull();
  });

  it('requires what the schema promises: a product, a stage opening for call-backs, an allowlist', () => {
    const missing = (patch: (s: Record<string, unknown>) => void) => {
      const raw = structuredClone(first) as unknown as Record<string, unknown>;
      patch(raw);
      return ScenarioDefinitionSchema.safeParse(raw).success;
    };
    expect(missing((s) => delete s.product)).toBe(false);
    expect(missing((s) => delete s.allowedCurveballs)).toBe(false);
    expect(missing((s) => delete (s.stageFrames as Record<string, unknown>).escalated)).toBe(false);
    expect(missing((s) => (s.cbcfBehaviours = ['anything']))).toBe(false);
    expect(missing((s) => (s.listSummary = 'word '.repeat(19).trim()))).toBe(false);
    expect(missing(() => undefined)).toBe(true);
  });

  it('refuses a library that reuses a persona name, a curveball outside the allowlist or a missing case reference', () => {
    const twin = copy((s) => {
      s.id = 'a-second-scenario';
      s.caseReference = 'SIM-999999';
    });
    expect(loadScenarios([first, twin]).errors.join('\n')).toMatch(/persona name/);
    const outside = copy((s) => {
      s.allowedCurveballs = ['go-silent'];
    });
    expect(ScenarioDefinitionSchema.safeParse(outside).success).toBe(
      first.curveballs.every((c) => c.type === 'go-silent'),
    );
    const noRef = copy((s) => {
      delete (s as { caseReference?: string }).caseReference;
    });
    expect(semanticIssues(noRef).join('\n')).toMatch(/caseReference is needed/);
  });
});
