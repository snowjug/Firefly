import { describe, expect, it } from 'vitest';
import { applyConfig, type EffectiveScenario } from '#shared/domain/config.ts';
import type { ScenarioDefinition } from '#shared/domain/scenario.ts';
import { CALL_STAGES } from '#shared/domain/vocab.ts';
import { getScenarioLibrary } from '../scenarios/index.ts';
import { sentenceCount } from './conform.ts';
import { expectationsOf } from './expectation.ts';
import { fullStatement } from './plan.ts';
import { openingMessage } from './session.ts';
import { simulate } from './simulate.ts';
import { inCustomerVoice, pronounOf, recordNotes, restatesHiddenFact } from './record.ts';
import { questionWords } from './textutil.ts';

// The engine against every scenario in the shipped library, in every stage of a call. The rules are
// the same for all of them, so what is checked here is what must hold whatever an author wrote.

const library = getScenarioLibrary();
const at = (
  definition: ScenarioDefinition,
  overrides: Parameters<typeof applyConfig>[1] = {},
  seed = 7,
): EffectiveScenario =>
  applyConfig(definition, { difficulty: 'standard', ...overrides }, { seed, timeOfDay: 'morning' });

const SCRIPT = [
  'Good morning, this is Sam from Microsoft support. How can I help?',
  'Can you tell me exactly what happens when you try, and what the message says?',
  'When did it first start, and was anything changed just before that?',
  'Who else is affected by this?',
  'How is this affecting your work?',
  'What have you already tried?',
  "I'm sorry about that. I'll take ownership of this and call you back by 3pm with an update.",
  'So to recap, I will call you back by 3pm. Is there anything else I can help with?',
];

const firstSentence = (text: string) => text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;

describe('the library is there to test against', () => {
  it('holds the Microsoft scenarios, each with the data the engine reads', () => {
    expect(library.length).toBeGreaterThanOrEqual(16);
    for (const s of library) {
      expect(s.hiddenFacts.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.unknownFacts.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.stageFrames['follow-up'].opening, s.id).not.toBe('');
      expect(s.customerExpectation, s.id).not.toBe('');
    }
  });
});

describe('the first words of a call', () => {
  it('are a short greeting that says nothing a hidden fact holds, for every scenario, stage and mood', () => {
    for (const definition of library) {
      for (const callStage of CALL_STAGES) {
        for (const startingTemperature of ['calm', 'anxious', 'frustrated', 'angry'] as const) {
          const scenario = at(definition, { callStage, startingTemperature });
          const opening = openingMessage(scenario);
          const where = `${definition.id}/${callStage}/${startingTemperature}: ${opening}`;
          expect(opening.trim(), where).not.toBe('');
          expect(sentenceCount(opening), where).toBeLessThanOrEqual(
            callStage === 'first-contact' ? 4 : 3,
          );
          for (const fact of scenario.hiddenFacts) {
            expect(opening, where).not.toContain(firstSentence(fact.statement));
          }
        }
      }
    }
  });

  it('never state the first-contact problem as if it were new when the call is a call back', () => {
    for (const definition of library) {
      for (const callStage of ['follow-up', 'escalated', 'closure'] as const) {
        const scenario = at(definition, { callStage });
        const opening = openingMessage(scenario);
        expect(opening, `${definition.id}/${callStage}`).toContain(
          firstSentence(scenario.stageFrame.opening),
        );
        expect(opening, `${definition.id}/${callStage}`).not.toContain(
          firstSentence(scenario.openingCore),
        );
      }
    }
  });
});

describe('what the customer has on the case', () => {
  it("lets most notes be said in the customer's own voice, and keeps back any that give away an unearned fact", () => {
    let total = 0;
    let spokenTotal = 0;
    for (const definition of library) {
      const scenario = at(definition);
      const pronoun = pronounOf(scenario.persona);
      expect(pronoun, definition.id).not.toBeNull();
      for (const kind of ['tried', 'changes'] as const) {
        const notes = kind === 'tried' ? scenario.previousTroubleshooting : scenario.recentChanges;
        total += notes.length;
        const spoken = recordNotes(kind, scenario, { discovery: {} });
        spokenTotal += spoken.length;
        for (const line of spoken) {
          expect(line, `${definition.id}: ${line}`).not.toMatch(
            /\b(?:he|she|him|his|hers|himself|herself)\b/i,
          );
          expect(line.endsWith('.'), `${definition.id}: ${line}`).toBe(true);
        }
        // Whatever was left out of what the customer can say was left out for a reason.
        for (const note of notes) {
          const voice = inCustomerVoice(note, scenario.persona.name, pronoun);
          if (voice !== null && !spoken.includes(voice)) {
            expect(
              restatesHiddenFact(note, scenario, { discovery: {} }),
              `${definition.id}: ${note}`,
            ).toBe(true);
          }
        }
      }
    }
    expect(spokenTotal / total).toBeGreaterThan(0.6);
  });

  it('reads at least one thing the customer expects from the call, in every scenario', () => {
    for (const definition of library) {
      expect(expectationsOf(at(definition)).size, definition.id).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('a whole call, whatever the scenario and the stage', () => {
  it('stays short, plain and in character, and only ever says what has been earned', async () => {
    let held = 0;
    let earned = 0;
    for (const definition of library) {
      for (const callStage of CALL_STAGES) {
        const scenario = at(definition, {
          callStage,
          startingTemperature: 'frustrated',
          style: 'talkative',
        });
        const sim = await simulate(scenario, SCRIPT);
        const where = `${definition.id}/${callStage}`;

        for (const t of sim.turns) {
          expect(t.customer.trim(), where).not.toBe('');
          expect(t.customer, `${where}: ${t.customer}`).not.toMatch(
            /\n|undefined|\[object|\{\w+\}/,
          );
          expect(sentenceCount(t.customer), `${where}: ${t.customer}`).toBeLessThanOrEqual(6);
          expect(t.customer.split(/\s+/).length, `${where}: ${t.customer}`).toBeLessThanOrEqual(80);
          expect(t.runtime.customer.temperature, where).toBeGreaterThanOrEqual(0);
          expect(t.runtime.customer.temperature, where).toBeLessThanOrEqual(100);
        }

        // A hidden fact the engineer has not earned is never said, word for word.
        const said = sim.turns.map((t) => t.customer);
        for (const fact of scenario.hiddenFacts) {
          const record = sim.runtime.discovery[fact.id];
          const marker = firstSentence(fullStatement(fact, 'talkative'));
          if (!record) {
            held += 1;
            for (const reply of said) expect(reply, `${where}: ${fact.id}`).not.toContain(marker);
          } else if (record.status === 'discovered') {
            // ...and one that counts as found was really in the reply of that turn.
            earned += 1;
            const turn = sim.turns.find(
              (t) => t.runtime.discovery[fact.id]?.status === 'discovered',
            );
            const words = questionWords(fullStatement(fact, 'talkative'));
            const heard = new Set(questionWords(turn?.customer ?? ''));
            const covered = words.filter((w) => heard.has(w)).length / Math.max(1, words.length);
            expect(covered, `${where}: ${fact.id}`).toBeGreaterThanOrEqual(0.5);
          }
        }
      }
    }
    // Both branches above were really exercised.
    expect(held).toBeGreaterThan(20);
    expect(earned).toBeGreaterThan(20);
  });

  it('answers "have you contacted us before?" on a call back with what its own case says', async () => {
    for (const definition of library) {
      for (const callStage of ['follow-up', 'escalated', 'closure'] as const) {
        const scenario = at(definition, {
          callStage,
          startingTemperature: 'frustrated',
          style: 'talkative',
        });
        const sim = await simulate(scenario, [
          SCRIPT[0] as string,
          'Have you contacted us before?',
        ]);
        const reply = sim.turns[1]?.customer ?? '';
        const wanted = firstSentence(scenario.stageFrame.opening).replace(/\.$/, '');
        expect(reply.toLowerCase(), `${definition.id}/${callStage}: ${reply}`).toContain(
          wanted.toLowerCase(),
        );
      }
    }
  });

  it('is calmed by ownership with a time and angered by blame in every scenario', async () => {
    for (const definition of library) {
      const scenario = at(definition, { startingTemperature: 'frustrated' });
      const owned = await simulate(scenario, [
        SCRIPT[0] as string,
        "I'll take ownership of this and call you back by 3pm with an update.",
      ]);
      const blamed = await simulate(scenario, [
        SCRIPT[0] as string,
        'You should have read the instructions before you changed anything.',
      ]);
      const start = owned.turns[0]?.temperature ?? 0;
      expect(owned.turns[1]?.temperature, definition.id).toBeLessThan(start);
      expect(blamed.turns[1]?.temperature, definition.id).toBeGreaterThan(
        blamed.turns[0]?.temperature ?? 100,
      );
    }
  });

  it('speaks plainly, with no contractions, when the customer speaks a second language', async () => {
    // "customer's" is a possessive; the contractions a customer might use all end in one of these.
    const contraction =
      /\b[A-Za-z]+n't\b|\b(?:I|you|we|they|he|she)'(?:m|ve|ll|d|re)\b|\b(?:it|that|there|what|who|here|how|where|let)'s\b/i;
    for (const definition of library) {
      for (const callStage of CALL_STAGES) {
        for (const startingTemperature of ['calm', 'angry'] as const) {
          const scenario = at(definition, { callStage, startingTemperature, style: 'non-native' });
          const sim = await simulate(scenario, SCRIPT);
          for (const text of [sim.opening, ...sim.turns.map((t) => t.customer)]) {
            expect(text, `${definition.id}/${callStage}: ${text}`).not.toMatch(contraction);
          }
        }
      }
    }
  });
});
