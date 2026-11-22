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
import {
  leakedSecrets,
  secretsBesidesAreas,
  secretsOf,
} from '../../e2e/support/scenario-library.ts';
import { toPublicScenario } from '../services/dto.ts';
import {
  distinctiveTokens,
  getScenarioLibrary,
  loadScenarios,
  semanticIssues,
  sharedPhrase,
} from './index.ts';
import { provenanceLeaks } from './provenance.ts';

// The library as a whole: what it covers, what a trainee can read before a call, and the checks
// that keep authored text honest. How the customer behaves on these scenarios is tested in
// server/engine/library.test.ts.

const library = getScenarioLibrary();

/** A scenario of the library, by id: the checks on authored text are written against these. */
const scenarioOf = (id: string): ScenarioDefinition => {
  const found = library.find((s) => s.id === id);
  if (!found) throw new Error(`The library has no scenario "${id}", which these checks need.`);
  return found;
};
// The smallest scenario, named by its id so that adding or reordering scenarios cannot change what
// the checks on authored text are run against.
const exemplar = scenarioOf('outlook-shared-mailbox-missing');

/** Every string in a value. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/** Every string in a value, and where it is, so that a failure says which field shows what. */
function leaves(value: unknown, path = ''): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      leaves(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

/**
 * Where what a trainee can read before a call (`toPublicScenario`) says something the customer keeps
 * back, ignoring case and spacing. The areas to explore are published on purpose, so a secret that is
 * exactly one of them is not one; a secret that is only part of an area ("Who edits the document" in
 * "Who edits the document, and how") is. The secrets and the rule are those of the call-page checks in
 * the browser specs (e2e/support/scenario-library.ts), so that a leak they would find is found here.
 */
function secretsShown(s: ScenarioDefinition): string[] {
  const secrets = secretsBesidesAreas({
    secrets: secretsOf(s),
    areas: [...s.expectedDiscoveryAreas],
  });
  return leaves(toPublicScenario(s)).flatMap(({ path, text }) =>
    leakedSecrets(text, secrets).map((secret) => `${path} shows "${secret}"`),
  );
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
  const clone = structuredClone(exemplar);
  patch(clone);
  return clone;
};

// On 22 November 2026 an AI assistant read the sixteen scenarios the library held then (the first
// sixteen: the ones in this table) against current public Microsoft pages and revised the wording it
// could not stand behind. That was not a mentor's review, and the internal supportability wiki was
// not available to it. These are the verdicts it reached, so that none of those sixteen provenance
// records can claim more, or less, than that review found. A scenario written after the review is not
// in the table: "what a record may claim" below says what its record may say.
const GROUNDING_REVIEW: Record<string, { check: string; sources: string[] }> = {
  'teams-cannot-join-external-meetings': {
    check: 'checked-partly',
    sources: ['microsoft-learn', 'microsoft-support'],
  },
  'outlook-shared-mailbox-missing': {
    check: 'checked-current',
    sources: ['microsoft-learn', 'microsoft-support'],
  },
  'exchange-mail-delays-follow-up': { check: 'checked-current', sources: ['microsoft-learn'] },
  'defender-invoices-quarantined': { check: 'checked-current', sources: ['microsoft-learn'] },
  'sharepoint-site-access-escalated': { check: 'checked-current', sources: ['microsoft-learn'] },
  'onedrive-sync-closure': {
    check: 'checked-current',
    sources: ['microsoft-learn', 'microsoft-support'],
  },
  'm365-apps-excel-crashes-after-update': {
    check: 'checked-partly',
    sources: ['microsoft-support', 'microsoft-learn'],
  },
  'power-automate-approvals-stopped': { check: 'checked-current', sources: ['microsoft-learn'] },
  'entra-new-hires-blocked-sign-in': { check: 'checked-current', sources: ['microsoft-learn'] },
  'intune-devices-not-compliant-closure': {
    check: 'checked-partly',
    sources: ['microsoft-learn'],
  },
  'windows-11-slow-after-update': {
    check: 'checked-partly',
    sources: ['microsoft-support', 'microsoft-learn'],
  },
  'windows-bitlocker-recovery-prompt': {
    check: 'checked-current',
    sources: ['microsoft-learn', 'microsoft-support'],
  },
  'azure-deployment-fails-permissions': { check: 'checked-current', sources: ['microsoft-learn'] },
  'azure-unexpected-charges': { check: 'checked-current', sources: ['microsoft-learn'] },
  'azure-vm-unreachable-production': { check: 'checked-current', sources: ['microsoft-learn'] },
  'dynamics-records-not-visible-after-role-change': {
    check: 'checked-partly',
    sources: ['microsoft-learn'],
  },
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

  it('has a how-to question, and more than one customer who speaks English as a second language', () => {
    // The first sixteen had neither a how-to question nor more than one such customer; the second
    // batch was written to bring them, so the library is not to lose them again.
    const howTo = library.filter((s) => s.issueType === 'how-to').map((s) => s.id);
    const secondLanguage = library.filter((s) => s.style === 'non-native').map((s) => s.id);
    expect(howTo.length, `how-to scenarios: ${howTo.join(', ')}`).toBeGreaterThanOrEqual(1);
    expect(
      secondLanguage.length,
      `non-native speakers: ${secondLanguage.join(', ')}`,
    ).toBeGreaterThanOrEqual(4);
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

  it('tells the trainee that the customer and organisation are invented and that the product is real', () => {
    for (const scenario of library) {
      expect(scenario.brief.groundRules[0], scenario.id).toBe(
        'The customer and organisation are fictional; the product is real.',
      );
      // The products are real Microsoft products, so no ground rule may call one fictional.
      expect(scenario.brief.groundRules.join(' '), scenario.id).not.toMatch(
        /product (?:is|are) fictional/i,
      );
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

  it('words every hidden fact trigger so it still reads once the coaching turns "Asks ..." into advice', () => {
    // The summary says "The biggest opportunity is to ask ..." with the trigger's own words, so a
    // second question word straight after "looks after" ("who looks after who can ...") would show.
    for (const scenario of library) {
      for (const fact of scenario.hiddenFacts) {
        expect(fact.revealWhen, `${scenario.id} ${fact.id}`).not.toMatch(
          /\b(?:looks after|look after|manages|owns)\s+(?:who|what|which)\b/i,
        );
      }
    }
  });
});

describe('the grounding review', () => {
  it('records the assistant review of 22 November 2026 for each scenario it covered (the sixteen in the table), and never claims a mentor', () => {
    for (const [id, expected] of Object.entries(GROUNDING_REVIEW)) {
      const scenario = library.find((s) => s.id === id);
      expect(scenario, id).toBeDefined();
      const { grounding } = scenario as ScenarioDefinition;
      expect(grounding.authoredOn, id).toBe('2026-11-21');
      expect(grounding.revisedOn, id).toBe('2026-11-22');
      expect(grounding.checkedOn, id).toBe('2026-11-22');
      expect(grounding.review, id).toBe('assistant-reviewed');
      expect(grounding.behaviourCheck, id).toBe(expected.check);
      expect([...grounding.sourceCategories].sort(), id).toEqual([...expected.sources].sort());
      expect(grounding.syntheticConfirmed, id).toBe(true);
      // The notes say whose review it was, so that nobody reads it as a mentor's.
      expect(grounding.notes, id).toMatch(/AI-assisted review, not a mentor's\.$/);
    }
  });
});

describe('what a provenance record may claim', () => {
  // The day the latest scenarios were written. A record dated after it claims what has not happened
  // yet; a scenario written on a later day raises this on purpose.
  const LATEST_RECORD_DATE = '2026-11-22';
  const isRealDate = (date: string) => {
    const parsed = new Date(`${date}T00:00:00Z`);
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().startsWith(date)
    );
  };
  const overclaims = (s: ScenarioDefinition): string[] => {
    const g = s.grounding;
    const problems: string[] = [];
    for (const [field, date] of [
      ['authoredOn', g.authoredOn],
      ['revisedOn', g.revisedOn],
      ['checkedOn', g.checkedOn],
    ] as const) {
      if (date === undefined) continue;
      if (!isRealDate(date)) problems.push(`${field} ${date} is not a real date`);
      else if (date > LATEST_RECORD_DATE) problems.push(`${field} ${date} is in the future`);
    }
    if (g.syntheticConfirmed !== true) problems.push('syntheticConfirmed is not true');
    if (g.review === 'mentor-reviewed') problems.push('says a mentor reviewed it');
    if (g.review === 'assistant-reviewed') {
      if (!g.revisedOn) problems.push('says an assistant reviewed it, with no revisedOn');
      if (!g.notes || !/AI-assisted review, not a mentor's\.$/.test(g.notes)) {
        problems.push("says an assistant reviewed it, but its notes do not end as an assistant's");
      }
    }
    if (g.behaviourCheck !== 'not-checked') {
      if (!g.checkedOn) problems.push(`says ${g.behaviourCheck}, with no checkedOn`);
      if (g.sourceCategories.every((category) => category === 'author-experience')) {
        problems.push(`says ${g.behaviourCheck}, against no public source`);
      }
    }
    if (g.behaviourCheck === 'checked-current' && !g.notes) {
      problems.push('says checked-current, with no notes to say what showed it');
    }
    return problems;
  };

  it('holds for every scenario that the review of 22 November 2026 did not cover', () => {
    // A scenario written later starts unreviewed, and is raised only by work that was done: an
    // assistant's review leaves a revision date and its closing words, and a check leaves a date and
    // a public source. Nobody has given a mentor's review to any.
    for (const s of library.filter((item) => !Object.hasOwn(GROUNDING_REVIEW, item.id))) {
      expect(overclaims(s), s.id).toEqual([]);
    }
  });

  it('refuses a record that says more than was done, and accepts one that says what was', () => {
    const say = (patch: Partial<ScenarioDefinition['grounding']>) => {
      const clone = copy((s) => void (s.grounding = { ...s.grounding, ...patch }));
      return overclaims(clone).join('\n');
    };
    // The reviewed Outlook scenario says exactly what its review found.
    expect(overclaims(exemplar)).toEqual([]);
    // A new scenario's honest record: written today, never checked, not reviewed.
    expect(
      say({
        authoredOn: '2026-11-22',
        revisedOn: undefined,
        behaviourCheck: 'not-checked',
        checkedOn: undefined,
        sourceCategories: ['author-experience'],
        review: 'unreviewed',
        notes: undefined,
      }),
    ).toBe('');
    expect(say({ review: 'mentor-reviewed' })).toMatch(/a mentor reviewed it/);
    expect(say({ authoredOn: '2026-11-23' })).toMatch(/authoredOn 2026-11-23 is in the future/);
    expect(say({ checkedOn: '2026-02-30' })).toMatch(/checkedOn 2026-02-30 is not a real date/);
    expect(say({ revisedOn: undefined })).toMatch(/an assistant reviewed it, with no revisedOn/);
    expect(say({ notes: 'Two current pages agree with the report.' })).toMatch(
      /notes do not end as an assistant's/,
    );
    expect(say({ checkedOn: undefined })).toMatch(/checked-current, with no checkedOn/);
    expect(say({ sourceCategories: ['author-experience'] })).toMatch(
      /checked-current, against no public source/,
    );
    expect(say({ review: 'unreviewed', revisedOn: undefined, notes: undefined })).toMatch(
      /checked-current, with no notes/,
    );
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

  it('shows nothing the customer keeps back, unless it is exactly an area to explore', () => {
    for (const s of library) {
      expect(secretsOf(s).length, `${s.id} has nothing to look for`).toBeGreaterThan(0);
      expect(secretsShown(s), s.id).toEqual([]);
    }
  });

  it('finds a hidden fact inside a longer area or any other field, whatever its case and spacing, and lets an area that is exactly its words stand', () => {
    const shown = (patch: (s: ScenarioDefinition) => void) => secretsShown(copy(patch));
    expect(shown(() => {})).toEqual([]);
    // As the Word scenario once had it: the label of a fact is the start of a longer area.
    expect(
      shown((s) => {
        s.hiddenFacts[0].label = 'Who edits the document';
        s.expectedDiscoveryAreas[2] = 'Who edits the document, and how';
      }),
    ).toEqual(['expectedDiscoveryAreas[2] shows "Who edits the document"']);
    // The same words as an area, apart from case and spacing, are the area and nothing else.
    expect(
      shown((s) => {
        s.hiddenFacts[0].label = 'WHO edits  the document, and how';
        s.expectedDiscoveryAreas[2] = 'Who edits the document, and how';
      }),
    ).toEqual([]);
    // Case and spacing do not hide a secret in a field that is not an area.
    expect(
      shown((s) => {
        s.summary = `${s.summary}   ${s.hiddenFacts[1].label.toUpperCase()}`;
      }),
    ).toEqual([`summary shows "${exemplar.hiddenFacts[1].label}"`]);
  });

  it('presents no customer claim as fact and gives away no workaround in what is shown or said at the start', () => {
    // Wording the review of 22 November 2026 found in the brief, the title or the opening impact lines.
    const flagged = [
      'sending requests by hand',
      'emailing the commissioning editor',
      'genuine supplier invoices',
    ];
    for (const s of library) {
      const early = [
        ...strings(toPublicScenario(s)),
        ...strings(s.impactVariants),
        ...strings(s.stageFrames),
        s.openingCore,
      ]
        .join(' \n ')
        .toLowerCase();
      for (const phrase of flagged) expect(early, `${s.id}: ${phrase}`).not.toContain(phrase);
    }
  });

  it('keeps the executive presentation out of every field that does not depend on the impact level', () => {
    for (const s of library) {
      const {
        affectedUsers: _users,
        impactVariants: _variants,
        grounding: _grounding,
        ...rest
      } = s;
      const neutral = {
        ...rest,
        publicBrief: { ...s.publicBrief, impact: undefined },
        hiddenFacts: s.hiddenFacts.map(({ byImpact: _byImpact, ...fact }) => fact),
      };
      expect(strings(neutral).join(' \n ').toLowerCase(), s.id).not.toContain(
        'executive presentation',
      );
    }
  });

  it('shows a trainee who is told to read the case record what it holds, because only the brief is on screen', () => {
    const s = library.find(
      (item) => item.id === 'azure-deployment-fails-permissions',
    ) as ScenarioDefinition;
    expect(s.brief.groundRules.join(' ')).toMatch(/read the case history/i);
    const shown = toPublicScenario(s).publicBrief.previousContact ?? '';
    // The error, what was tried and when it first failed: what the customer will not repeat.
    for (const detail of ['not authorised', 'twice', 'credentials', 'admin', 'Thursday']) {
      expect(shown, detail).toContain(detail);
    }
  });

  it('names the product from one place, and never from free text', () => {
    for (const s of library) {
      const dto = toPublicScenario(s);
      expect(dto.product.name, s.id).toBe(PRODUCT_INFO[s.product.id].name);
      expect(applyConfig(s).environment.product, s.id).toBe(PRODUCT_INFO[s.product.id].name);
    }
  });

  it('gives each scenario card a short title, and keeps the provenance record out of every public form', () => {
    for (const s of library) {
      const dto = toPublicScenario(s);
      expect(dto.shortTitle, s.id).toBe(s.shortTitle);
      expect(wordCount(dto.shortTitle), s.id).toBeGreaterThanOrEqual(2);
      expect(wordCount(dto.shortTitle), s.id).toBeLessThanOrEqual(6);
      expect(provenanceLeaks(dto), s.id).toEqual([]);
      // A saved call snapshots the effective scenario, which carries neither new field, so a call
      // saved before they existed reads exactly like one saved after.
      const effective = applyConfig(s);
      expect(effective, s.id).not.toHaveProperty('shortTitle');
      expect(provenanceLeaks(effective), s.id).toEqual([]);
    }
    const shorts = library.map((s) => s.shortTitle.toLowerCase());
    expect(new Set(shorts).size).toBe(shorts.length);
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
    const fact = exemplar.hiddenFacts[0] as ScenarioDefinition['hiddenFacts'][number];
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
      const raw = structuredClone(exemplar) as unknown as Record<string, unknown>;
      patch(raw);
      return ScenarioDefinitionSchema.safeParse(raw).success;
    };
    expect(missing((s) => delete s.product)).toBe(false);
    expect(missing((s) => delete s.allowedCurveballs)).toBe(false);
    expect(missing((s) => delete (s.stageFrames as Record<string, unknown>).escalated)).toBe(false);
    expect(missing((s) => (s.cbcfBehaviours = ['anything']))).toBe(false);
    expect(missing((s) => (s.listSummary = 'word '.repeat(19).trim()))).toBe(false);
    expect(missing((s) => delete s.shortTitle)).toBe(false);
    expect(missing((s) => delete s.grounding)).toBe(false);
    // A card title is two to six words, in sentence case, with no full stop.
    expect(missing((s) => (s.shortTitle = 'Mailbox'))).toBe(false);
    expect(missing((s) => (s.shortTitle = 'Shared team mailbox is missing from Outlook'))).toBe(
      false,
    );
    expect(missing((s) => (s.shortTitle = 'Shared mailbox missing.'))).toBe(false);
    expect(missing((s) => (s.shortTitle = 'shared mailbox missing'))).toBe(false);
    expect(missing(() => undefined)).toBe(true);
  });

  it('rejects a short title that is longer than the title, shares no word with it or adds to what it says', () => {
    const issuesFor = (shortTitle: string, id = exemplar.id) => {
      const s = structuredClone(library.find((item) => item.id === id) as ScenarioDefinition);
      s.shortTitle = shortTitle;
      return semanticIssues(s).join('\n');
    };
    // The exemplar's title is "Shared team mailbox missing from Outlook".
    expect(issuesFor('Shared mailbox missing')).toBe('');
    expect(issuesFor('The shared team mailbox is missing from Outlook again')).toMatch(
      /longer than the title/,
    );
    expect(issuesFor('Calendar not syncing')).toMatch(/shares no content word/);
    expect(issuesFor('Shared mailbox gone after migration')).toMatch(/adds "gone", "migration"/);
    // Its words may come from the brief's issue line as well as the title, in another form.
    expect(issuesFor('Cannot see mailbox')).toBe('');
    // The Teams scenario's hidden facts are about guests from outside the company, and nothing
    // public says so, so a card must not either.
    const teams = 'teams-cannot-join-external-meetings';
    expect(issuesFor('External users cannot join', teams)).toMatch(/adds "external", "users"/);
    expect(issuesFor('Cannot join meetings', teams)).toBe('');
  });

  it('refuses a library that reuses a persona name, a curveball outside the allowlist or a missing case reference', () => {
    const twin = copy((s) => {
      s.id = 'a-second-scenario';
      s.caseReference = 'SIM-999999';
    });
    expect(loadScenarios([exemplar, twin]).errors.join('\n')).toMatch(/persona name/);
    // Two cards with the same short title could not be told apart.
    const lookalike = copy((s) => {
      s.id = 'a-third-scenario';
      s.caseReference = 'SIM-999998';
      s.persona.name = 'Someone Else';
    });
    expect(loadScenarios([exemplar, lookalike]).errors.join('\n')).toMatch(
      /shortTitle "Shared mailbox missing" is already used by outlook-shared-mailbox-missing/,
    );
    const outside = copy((s) => {
      s.allowedCurveballs = ['go-silent'];
    });
    expect(ScenarioDefinitionSchema.safeParse(outside).success).toBe(
      exemplar.curveballs.every((c) => c.type === 'go-silent'),
    );
    const noRef = copy((s) => {
      delete (s as { caseReference?: string }).caseReference;
    });
    expect(semanticIssues(noRef).join('\n')).toMatch(/caseReference is needed/);
  });

  it('refuses an earlier contact on a scenario written for a first contact, which would be shown at every stage', () => {
    const firstContact = library.find((s) => s.callStage === 'first-contact') as ScenarioDefinition;
    const callBack = library.find((s) => s.callStage !== 'first-contact') as ScenarioDefinition;
    const withContact = (s: ScenarioDefinition) =>
      semanticIssues({
        ...s,
        publicBrief: { ...s.publicBrief, previousContact: 'No earlier contact.' },
      });
    expect(withContact(firstContact).join('\n')).toMatch(
      /first-contact scenario has no earlier contact/,
    );
    expect(withContact(callBack).join('\n')).not.toMatch(/first-contact scenario/);
  });
});
