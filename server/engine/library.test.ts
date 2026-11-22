import { describe, expect, it } from 'vitest';
import { applyConfig, type EffectiveScenario } from '#shared/domain/config.ts';
import type { ScenarioDefinition } from '#shared/domain/scenario.ts';
import { fold, sentences } from '#shared/domain/text.ts';
import { CALL_STAGES, STYLES } from '#shared/domain/vocab.ts';
import { getScenarioLibrary } from '../scenarios/index.ts';
import { AI_POLITENESS, addressesBy, sentenceCount } from './conform.ts';
import { expectationsOf } from './expectation.ts';
import { fullStatement } from './plan.ts';
import { openingMessage } from './session.ts';
import { simulate } from './simulate.ts';
import { inCustomerVoice, pronounOf, recordNotes, restatesHiddenFact } from './record.ts';
import { expandContractions, questionWords } from './textutil.ts';

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
    // A library, not a handful: the other library-wide tests hold their floor at twelve as well.
    expect(library.length).toBeGreaterThanOrEqual(12);
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

describe('a customer who sounds like a person, in every scenario, style and stage', () => {
  // A whole call to its end: the case, a recap, an owner and a time, then the closing questions and
  // a goodbye. What is checked is what must hold whatever the scenario says.
  const CALL = [
    'Good morning, this is Alex from Microsoft support. How can I help?',
    'Can you tell me your name and your role, please?',
    'What exactly is happening, and what does the message say?',
    'How many people are affected, and how is it affecting your work?',
    'When did it start, and did anything change before that?',
    'What have you already tried?',
    "I'm sorry about that, that sounds really frustrating.",
    'So just to summarise, it started after a change and it affects only you. Is that right?',
    "I'll look into it.",
    "I'll take ownership of this and update you by 3 PM today.",
    "Yes, that's right.",
    'Is there anything you need from your side before then?',
    'Is there anything else I can help with?',
    'Thank you. Have a good day.',
  ];
  const TEMPERATURES = ['calm', 'anxious', 'frustrated', 'angry'] as const;
  const NOT_SAID = [
    /great question|good (?:troubleshooting|diagnostic) (?:step|question)|good thinking|well done/i,
    /hidden facts?\b/i,
    /(?:^|\n)\s*(?:[-*\u2022]|\d+[.)])\s/,
  ];
  const tokens = (text: string) => expandContractions(text).toLowerCase().replace(/\s+/g, ' ');
  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  it('gives the reason for the call in its own words when asked, in every style, and says it plainly', async () => {
    const lost: string[] = [];
    for (const definition of library) {
      for (const style of STYLES) {
        const scenario = at(definition, { callStage: 'first-contact', style });
        const sim = await simulate(scenario, [CALL[0] as string]);
        const reply = sim.turns[0]?.customer ?? '';
        const where = `${definition.id}/${style}: ${sim.opening} => ${reply}`;
        if (!/\bis this\b[^.?!]*\bsupport\b/i.test(sim.opening)) lost.push(`no greeting: ${where}`);
        // The problem is in the reply, not only a lead into it ("Yes. I need some help.").
        const words = questionWords(firstSentence(scenario.openingCore));
        const heard = new Set(questionWords(reply));
        const covered = words.filter((w) => heard.has(w)).length / Math.max(1, words.length);
        if (covered < 0.5) lost.push(`problem missing (${covered.toFixed(2)}): ${where}`);
        if (sentenceCount(reply) > 4) lost.push(`too long: ${where}`);
      }
    }
    expect(lost.slice(0, 8)).toEqual([]);
  });

  it('never praises, announces, lists, repeats itself or calls the engineer by name in every reply, from the first to the goodbye', async () => {
    const found: string[] = [];
    let replies = 0;
    let combo = 0;
    for (const definition of library) {
      for (const callStage of CALL_STAGES) {
        for (const style of STYLES) {
          const startingTemperature = TEMPERATURES[
            combo++ % TEMPERATURES.length
          ] as (typeof TEMPERATURES)[number];
          const scenario = at(definition, { callStage, style, startingTemperature });
          const sim = await simulate(scenario, CALL);
          const said = [sim.opening, ...sim.turns.map((t) => t.customer)];
          const where = `${definition.id}/${callStage}/${style}/${startingTemperature}`;
          replies += sim.turns.length;
          for (const [i, text] of said.entries()) {
            for (const pattern of NOT_SAID) {
              if (pattern.test(text)) found.push(`${where} [${i}] ${pattern}: ${text}`);
            }
            if (sentences(text).some((s) => AI_POLITENESS.test(s)))
              found.push(`${where} [${i}] assistant: ${text}`);
            if (i > 0 && text === said[i - 1]) found.push(`${where} [${i}] same twice: ${text}`);
            // No longer than the whole-call test above allows, whatever the style or the stage.
            if (sentenceCount(text) > 6 || wordCount(text) > 80)
              found.push(`${where} [${i}] long: ${text}`);
            // The engineer's name once in any five replies, and none the customer might say to anyone.
            if (i >= 4) {
              const named = said.slice(i - 4, i + 1).filter((t) => addressesBy(t, 'Alex')).length;
              if (named > 1)
                found.push(
                  `${where} [${i}] name x${named}: ${said.slice(i - 4, i + 1).join(' | ')}`,
                );
            }
          }
        }
      }
    }
    expect(replies).toBe(library.length * CALL_STAGES.length * STYLES.length * CALL.length);
    expect(found.slice(0, 8)).toEqual([]);
  }, 60_000);

  it('answers the closing questions and the goodbye in a few words, and does not start the case over', async () => {
    const found: string[] = [];
    let combo = 0;
    for (const definition of library) {
      for (const style of STYLES) {
        const startingTemperature = TEMPERATURES[
          combo++ % TEMPERATURES.length
        ] as (typeof TEMPERATURES)[number];
        const scenario = at(definition, { style, startingTemperature });
        const sim = await simulate(scenario, CALL);
        const where = `${definition.id}/${style}/${startingTemperature}`;
        const [fromOurSide, anythingElse, goodbye] = [11, 12, 13].map(
          (i) => sim.turns[i]?.customer ?? '',
        );
        for (const [kind, text] of [
          ['our side', fromOurSide],
          ['anything else', anythingElse],
          ['goodbye', goodbye],
        ] as const) {
          if (sentenceCount(text) > 3) found.push(`${where} [${kind}] too long: ${text}`);
          if (wordCount(text) > 40) found.push(`${where} [${kind}] too many words: ${text}`);
        }
        // Nothing the engineer did not ask about again: no new problem raised at the end of the call.
        for (const fact of scenario.hiddenFacts) {
          const marker = tokens(firstSentence(fullStatement(fact, style)));
          for (const text of [fromOurSide, anythingElse, goodbye]) {
            if (tokens(text ?? '').includes(marker))
              found.push(`${where} restates ${fact.id}: ${text}`);
          }
        }
      }
    }
    expect(found.slice(0, 8)).toEqual([]);
  }, 60_000);
});

describe('a curveball on the way out of a call', () => {
  const OPEN = [
    'Good morning, this is Alex from Microsoft support. How can I help?',
    'What exactly is happening, and what does the message say?',
    'When did it start, and was anything changed just before that?',
    'Who else is affected by this?',
    "I'll take ownership of this and update you by 3 PM today.",
  ];
  const ENDINGS = [
    ['says goodbye', "Thank you. I'll call you at 3 PM. Have a good day."],
    ['wraps up', 'So to recap, I will call you back by 3 PM.'],
    ['asks if that is all', 'Is there anything else I can help with?'],
    ['asks what the customer has to do', 'Is there anything you need to do from your side first?'],
  ] as const;
  const ASKS = 'What browser are you using?';
  const spoken = (text: string) => fold(expandContractions(text));

  it('is never said on the turn the engineer ends the call, or after it, though it is due on that very turn', async () => {
    const found: string[] = [];
    let raised = 0;
    let said = 0;
    for (const definition of library) {
      for (const seed of [1, 5, 9]) {
        const base = at(definition, { callStage: 'first-contact', difficulty: 'challenge' }, seed);
        // The engineer's turn number the call has reached when it ends: every curveball is due then.
        const dry = await simulate(base, [...OPEN, ASKS]);
        const due = dry.runtime.traineeTurns - dry.runtime.greetingTurns;
        const scenario = {
          ...base,
          curveballs: base.curveballs.map((c) => ({
            ...c,
            trigger: { earliestTurn: due, latestTurn: due },
          })),
        };
        const markers = scenario.curveballs
          .map((c) => spoken(firstSentence(c.statement)))
          .filter((m) => m.split(' ').length >= 3);
        const where = `${definition.id}/seed ${seed}`;

        // The same call that goes on instead of ending does raise it, so it was due.
        const goingOn = await simulate(scenario, [...OPEN, ASKS]);
        if (scenario.curveballs.length > 0) {
          if (goingOn.runtime.customer.curveball.firedCount !== 1) found.push(`${where}: not due`);
          else raised += 1;
          const last = spoken(goingOn.turns.at(-1)?.customer ?? '');
          if (markers.some((m) => last.includes(m))) said += 1;
        }

        for (const [kind, ending] of ENDINGS) {
          const sim = await simulate(scenario, [...OPEN, ending, ASKS, 'And which version is it?']);
          const there = `${where}, ${kind}`;
          for (const t of sim.turns) {
            const reply = spoken(t.customer);
            if (markers.some((m) => reply.includes(m))) found.push(`${there}: ${t.customer}`);
          }
          const { runtime } = sim;
          if (runtime.customer.curveball.firedCount !== 0 || runtime.firedCurveballs.length > 0)
            found.push(`${there}: recorded as fired`);
          if (
            runtime.customer.curveball.status !== 'none' ||
            runtime.customer.curveball.firedAtTurn
          )
            found.push(`${there}: state ${JSON.stringify(runtime.customer.curveball)}`);
          if (sim.events.some((e) => e.category === 'curveball'))
            found.push(`${there}: a curveball event`);
        }
      }
    }
    expect(found.slice(0, 8)).toEqual([]);
    // The check was a real one: most of the calls did have a curveball due, and said it when going on.
    expect(raised).toBeGreaterThan(30);
    expect(said).toBeGreaterThan(20);
  }, 60_000);
});
