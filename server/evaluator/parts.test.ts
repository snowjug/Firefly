import { describe, expect, it } from 'vitest';
import type { TurnClassification } from '#shared/domain/classification.ts';
import { CoachingReportSchema } from '#shared/domain/report.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import {
  buildCallView,
  buildCompletion,
  buildCurveball,
  buildDiscovery,
  buildJourney,
  dimensionSufficiency,
  evidenceLevel,
  lowestDimension,
  nextDifficulty,
  pickScenario,
  verifiedQuote,
} from './parts.ts';
import { evaluateWithRules } from './rules.ts';
import { FIXTURE_ID } from './fixture.ts';
import {
  LIBRARY,
  buildInput,
  makeScenario,
  simpleCall,
  strongCall,
  weakCall,
  type Step,
} from './testing.ts';

const turn = (
  say: string,
  cls: Partial<TurnClassification> = {},
  evidence: Step['evidence'] = [],
  more: Partial<Step> = {},
): Step => ({ say, cls, evidence, ...more });
const filler = (text = 'Let me look into that.'): Step => turn(text);
const run = (input: EvaluationInput) =>
  evaluateWithRules(input, { now: new Date('2026-03-01T10:00:00Z') });

describe('verifiedQuote', () => {
  const text = 'Hello Maya, this is Sam. Can you read me exactly what the message says?';

  it('accepts a verbatim quote, ignoring case, punctuation and spacing', () => {
    expect(verifiedQuote(text, 'Hello Maya, this is Sam.')).toBe('Hello Maya, this is Sam.');
    expect(verifiedQuote(text, 'hello   maya this is sam')).toBe('hello maya this is sam');
  });

  it('strips wrapping quotation marks', () => {
    expect(verifiedQuote(text, '\u201cCan you read me exactly what the message says?\u201d')).toBe(
      'Can you read me exactly what the message says?',
    );
  });

  it('rejects text that is not in the turn, is empty or is too short to verify', () => {
    expect(verifiedQuote(text, 'Good morning and welcome')).toBeNull();
    expect(verifiedQuote(text, '')).toBeNull();
    expect(verifiedQuote(text, null)).toBeNull();
    expect(verifiedQuote('Hi', 'Hi')).toBeNull();
  });

  it('shortens a long quote at a word boundary and keeps it verifiable', () => {
    const long = `${'word '.repeat(60)}end`;
    const quote = verifiedQuote(long, long, 80);
    expect(quote).not.toBeNull();
    expect(quote?.length).toBeLessThanOrEqual(80);
    expect(verifiedQuote(long, quote)).not.toBeNull();
  });
});

describe('completion and evidence sufficiency', () => {
  const calls = (n: number, endedEarly = false) =>
    buildInput(
      makeScenario(),
      Array.from({ length: n }, (_, i) => filler(`Step number ${i + 1}.`)),
      { endedEarly },
    );
  const completion = (n: number, endedEarly = false) =>
    buildCompletion(buildCallView(calls(n, endedEarly)));

  it('follows the trainee turn count: 5+ sufficient, 3-4 limited, up to 2 insufficient', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(evidenceLevel)).toEqual([
      'insufficient',
      'insufficient',
      'insufficient',
      'limited',
      'limited',
      'sufficient',
      'sufficient',
    ]);
    expect(completion(2).evidence).toBe('insufficient');
    expect(completion(4).evidence).toBe('limited');
    expect(completion(5).evidence).toBe('sufficient');
  });

  it('records the number of trainee turns and whether the call ended early', () => {
    expect(completion(6)).toMatchObject({ status: 'completed', traineeTurns: 6, note: null });
    expect(completion(6, true).status).toBe('ended-early');
  });

  it('explains limited, insufficient and early-ended calls in plain words', () => {
    for (const n of [2, 4, 7]) {
      for (const early of [false, true]) {
        if (n === 7 && !early) continue; // a full call needs no note
        expect(completion(n, early).note, `${n} turns, early ${early}`).toMatch(
          /reflects only what was said/,
        );
        expect(completion(n, early).note, `${n} turns, early ${early}`).toMatch(
          /More turns would give firmer coaching/,
        );
      }
    }
    expect(completion(4).note).toMatch(/limited evidence/);
    expect(completion(2).note).toMatch(/first look/);
    expect(completion(2, true).note).toMatch(/ended early, after only 2 trainee turns/);
    expect(completion(7, true).note).toMatch(/ended before a natural close/);
    expect(completion(0).note).toMatch(/nothing to evaluate/);
  });

  it('treats closing as insufficient for a three-turn call that was ended with no closing behaviour', () => {
    const early = buildCallView(calls(3, true));
    expect(dimensionSufficiency(early, 'closing')).toBe('insufficient');
    expect(dimensionSufficiency(early, 'clarity')).toBe('limited');

    const finished = buildCallView(calls(3, false));
    expect(dimensionSufficiency(finished, 'closing')).toBe('limited');
  });

  it('treats closing as at most limited for a longer call that was ended before any closing behaviour', () => {
    expect(dimensionSufficiency(buildCallView(calls(4, true)), 'closing')).toBe('limited');
    expect(dimensionSufficiency(buildCallView(calls(8, true)), 'closing')).toBe('limited');
    expect(dimensionSufficiency(buildCallView(calls(8, true)), 'clarity')).toBe('sufficient');
    // finished calls, and calls where something closing-like happened, are judged by length
    expect(dimensionSufficiency(buildCallView(calls(8, false)), 'closing')).toBe('sufficient');
    const closed = buildInput(
      makeScenario(),
      [
        ...Array.from({ length: 5 }, (_, i) => filler(`Step number ${i + 1}.`)),
        turn('Just to recap.', { summarises: true }, [['summary', 'Just to recap.']]),
      ],
      { endedEarly: true },
    );
    expect(dimensionSufficiency(buildCallView(closed), 'closing')).toBe('sufficient');
  });
});

describe('short calls', () => {
  const weakShort = buildInput(
    makeScenario(),
    [
      turn(
        'Reset your password again.',
        { troubleshooting: true },
        [['troubleshooting', 'Reset your password again.']],
        {
          events: [
            [
              'premature-troubleshooting',
              'temperature',
              52,
              57,
              'Jumped into fixes before understanding the situation',
            ],
          ],
        },
      ),
      turn("That's not a big deal.", { dismissive: true }, [
        ['dismissive', "That's not a big deal."],
      ]),
    ],
    { endedEarly: true },
  );

  it('does not fabricate a full evaluation from two trainee turns', () => {
    const report = run(weakShort);
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    expect(report.completion).toMatchObject({
      status: 'ended-early',
      traineeTurns: 2,
      evidence: 'insufficient',
    });
    expect(report.completion.note).toMatch(/reflects only what was said/);
    expect(report.summary.overallScore).toBeNull();
    expect(report.dimensions.every((d) => d.sufficiency === 'insufficient')).toBe(true);
    expect(report.summary.overall).toMatch(/too few to score with confidence/);
  });

  it('invents no strengths and calls out no gaps that never had time to happen', () => {
    const report = run(weakShort);
    expect(report.strengths).toEqual([]);
    // only things the trainee actually said: no "missed fact", "no closing" or "no ownership" items
    const titles = report.improvements.map((i) => i.title).join(' | ');
    expect(titles).not.toMatch(/Did not find out|recap|owner|next step/i);
    expect(report.improvements.every((i) => i.quote !== null)).toBe(true);
  });

  it('keeps the next practice difficulty the same when there is no overall score', () => {
    expect(run(weakShort).nextPractice.suggestedDifficulty).toBe('standard');
  });

  it('marks a three or four turn call as limited and says so in the summary', () => {
    const fourTurns: Step[] = [
      turn('Reset your password again and clear your cache.', { troubleshooting: true }),
      turn('You should have read the email.', { blame: true }, [
        ['blame', 'You should have read the email.'],
      ]),
      turn('What is the problem again?', { askedQuestion: true }),
      turn('It will be fixed soon.'),
    ];
    const report = run(buildInput(makeScenario(), fourTurns, { endedEarly: true }));
    expect(report.completion.evidence).toBe('limited');
    expect(report.dimensions.every((d) => d.sufficiency === 'limited')).toBe(true);
    expect(report.summary.overallScore).not.toBeNull();
    expect(report.summary.overall).toMatch(/limited evidence/);
  });
});

describe('discovery results', () => {
  const found = buildInput(makeScenario(), [
    turn(
      'Thanks for that. Can you read me exactly what the message says? Is anything else signed in on your phone?',
      { askedQuestion: true },
      [
        ['discovery-question', 'Can you read me exactly what the message says?'],
        ['discovery-question', 'Is anything else signed in on your phone?'],
      ],
      { finds: { 'hf-lockout-message': 'discovered', 'hf-phone-old-password': 'partial' } },
    ),
    filler(),
  ]);
  const discovery = buildDiscovery(buildCallView(found));
  const byId = Object.fromEntries(discovery.results.map((r) => [r.factId, r]));

  it('reports one result per hidden fact with counts', () => {
    expect(discovery.results).toHaveLength(4);
    expect(discovery).toMatchObject({ found: 1, partial: 1, missed: 2, total: 4 });
  });

  it('reports discovered, partial and missed statuses with the turn that revealed each', () => {
    expect(byId['hf-lockout-message']).toMatchObject({ status: 'discovered', revealedAtTurn: 2 });
    expect(byId['hf-phone-old-password']).toMatchObject({ status: 'partial', revealedAtTurn: 2 });
    expect(byId['hf-reset-timing']).toMatchObject({
      status: 'missed',
      revealedAtTurn: null,
      revealingQuestion: null,
    });
  });

  it('picks the sentence that addressed each fact as the revealing question', () => {
    expect(byId['hf-lockout-message']?.revealingQuestion).toBe(
      'Can you read me exactly what the message says?',
    );
    expect(byId['hf-phone-old-password']?.revealingQuestion).toBe(
      'Is anything else signed in on your phone?',
    );
  });

  it('copies what was hidden and the better question, and explains the consequence', () => {
    const missed = byId['hf-reset-timing'];
    const scenarioFact = makeScenario().hiddenFacts.find((f) => f.id === 'hf-reset-timing');
    expect(missed?.whatWasHidden).toBe(scenarioFact?.statement);
    expect(missed?.betterQuestion).toBe(scenarioFact?.betterQuestion);
    expect(missed?.consequence).toBe(scenarioFact?.missedConsequence);
    expect(byId['hf-phone-old-password']?.consequence).toBe(
      makeScenario().hiddenFacts.find((f) => f.id === 'hf-phone-old-password')?.missedConsequence,
    );
    expect(byId['hf-lockout-message']?.consequence).toMatch(/^Found at turn 2\./);
  });

  it('only lists the facts that exist at the scenario difficulty', () => {
    const starter = buildDiscovery(
      buildCallView(simpleCall([filler()], { difficulty: 'starter' })),
    );
    expect(starter.total).toBe(3);
    expect(starter.results.map((r) => r.factId)).not.toContain('hf-tried-colleague');
  });
});

describe('temperature journey', () => {
  const steps: Step[] = [
    turn('Hello Maya, this is Sam.', {}, [], {
      events: [
        [
          'rapport',
          'temperature',
          52,
          50,
          'Opened with a greeting and an offer to help',
          'Not in this turn at all',
        ],
      ],
    }),
    turn(
      "I'm sorry about this. That sounds stressful for the whole front desk.",
      { empathy: 'specific' },
      [['empathy-specific', "I'm sorry about this."]],
      {
        events: [
          ['empathy', 'trust', 40, 46, 'Showed specific empathy'],
          ['empathy', 'temperature', 50, 43, 'Showed specific empathy', "I'm sorry about this."],
        ],
      },
    ),
    turn('When did it start?', {}, [], {
      events: [
        [
          'discovery',
          'temperature',
          43,
          39,
          'Asked a focused question that uncovered new information',
        ],
      ],
    }),
    filler('Still checking.'),
    turn('I understand the deadline.', {}, [], {
      events: [['curveball', 'temperature', 39, 45, 'Curveball: customer imposes a deadline']],
    }),
    turn('I will update you at nine.', {}, [], {
      events: [['next-steps', 'temperature', 45, 44, 'Gave specific next steps with a time']],
    }),
  ];
  const journey = buildJourney(buildCallView(buildInput(makeScenario(), steps)));
  const point = (turnIndex: number) => {
    const found = journey.points.find((p) => p.turnIndex === turnIndex);
    if (!found) throw new Error(`no point at ${turnIndex}`);
    return found;
  };

  it('starts with the customer opening and has one point per trainee turn', () => {
    expect(journey.points.map((p) => p.turnIndex)).toEqual([1, 2, 4, 6, 8, 10, 12]);
    expect(point(1)).toMatchObject({
      kind: 'start',
      temperature: 52,
      band: 'Frustrated',
      delta: 0,
      reason: null,
      quote: null,
    });
  });

  it('takes the temperature after each turn from the last temperature event, carrying it forward when nothing changed', () => {
    expect(journey.points.map((p) => p.temperature)).toEqual([52, 50, 43, 39, 39, 45, 44]);
    expect(point(8)).toMatchObject({ temperature: 39, delta: 0, reason: null, quote: null });
  });

  it('marks turning points by a swing of 6 or more, or a change of band', () => {
    expect(point(2)).toMatchObject({ kind: 'turn', delta: -2 });
    expect(point(4)).toMatchObject({ kind: 'turning-point', delta: -7 }); // swing of 7, same band
    expect(point(6)).toMatchObject({ kind: 'turning-point', delta: -4, band: 'Concerned' }); // band changed
  });

  it('marks the turn that caused a curveball and the final turn', () => {
    expect(point(10)).toMatchObject({
      kind: 'curveball',
      delta: 6,
      reason: 'Curveball: customer imposes a deadline',
      quote: null,
    });
    expect(point(12)).toMatchObject({ kind: 'end', temperature: 44, delta: -1 });
  });

  it('gives each point the reason of its biggest temperature change and a verbatim trainee quote', () => {
    expect(point(4).reason).toBe('Showed specific empathy');
    expect(point(4).quote).toBe("I'm sorry about this.");
    // a recorded quote that is not in the turn is replaced by a sentence that is
    expect(point(2).quote).toBe('Hello Maya, this is Sam.');
  });

  it('reports the start, end, peak and lowest temperature', () => {
    expect(journey).toMatchObject({ start: 52, end: 44, peak: 52, lowest: 39 });
  });

  it('never puts a raw number in a reason: a count is written out and a raw state value is dropped', () => {
    const odd = buildJourney(
      buildCallView(
        simpleCall([
          turn('Checking.', {}, [], {
            events: [
              [
                'impact',
                'temperature',
                52,
                55,
                'The impact still had not been acknowledged after 3 replies',
              ],
            ],
          }),
          turn('Still checking.', {}, [], {
            events: [['impact', 'temperature', 55, 58, "Maya's temperature went from 55 to 58"]],
          }),
        ]),
      ),
    );
    expect(odd.points[1]?.reason).toBe(
      'The impact still had not been acknowledged after three replies',
    );
    expect(odd.points[2]?.reason).toBeNull();
    for (const p of journey.points) expect(p.reason ?? '').not.toMatch(/\d/);
  });

  it('reads the weak call as a steady rise', () => {
    const rising = buildJourney(buildCallView(weakCall()));
    expect(rising.points.map((p) => p.temperature)).toEqual([52, 64, 84, 89, 91, 91, 91]);
    expect(rising).toMatchObject({ start: 52, end: 91, peak: 91, lowest: 52 });
    expect(rising.points[1]?.kind).toBe('turning-point');
    expect(rising.points[2]).toMatchObject({ kind: 'turning-point', band: 'Escalating' });
  });
});

describe('curveball assessment', () => {
  const fired = (status: 'resolved' | 'unresolved' | 'active', extra = {}) =>
    ({
      status,
      type: 'deadline',
      firedAtTurn: 6,
      resolvedAtTurn: status === 'resolved' ? 8 : null,
      firedCount: 1,
      ...extra,
    }) as const;
  const base = (): Step[] => [
    turn('Hello Maya, this is Sam.', {}, [], {
      events: [['rapport', 'temperature', 52, 49, 'Opened with a greeting and an offer to help']],
    }),
    filler('Let me look into that.'),
    turn('Can you read me what the screen says?', { askedQuestion: true }, [], {
      events: [['curveball', 'temperature', 49, 55, 'Curveball: customer imposes a deadline']],
    }),
  ];

  it('is null when no curveball fired', () => {
    expect(buildCurveball(buildCallView(simpleCall(base())))).toBeNull();
  });

  it('describes what the trainee did when the curveball was resolved', () => {
    const answer = turn(
      "I can see the first patients arrive at nine. I'll call you back at ten with an update.",
      { acknowledgesImpact: true, nextSteps: 'specific' },
      [
        ['impact-acknowledged', 'I can see the first patients arrive at nine.'],
        ['next-steps-specific', "I'll call you back at ten with an update."],
      ],
      {
        events: [
          [
            'curveball',
            'temperature',
            55,
            49,
            'Handled the curveball well (customer imposes a deadline)',
          ],
        ],
      },
    );
    const input = buildInput(makeScenario(), [...base(), answer], { curveball: fired('resolved') });
    const result = buildCurveball(buildCallView(input));
    expect(result).toMatchObject({ type: 'deadline', firedAtTurn: 6, status: 'resolved' });
    expect(result?.assessment).toContain('After turn 6, Maya introduced a hard deadline.');
    expect(result?.assessment).toContain(
      'At turn 8 you acknowledged the impact and gave a specific next step',
    );
    expect(result?.assessment).toContain(
      '\u201cI can see the first patients arrive at nine.\u201d',
    );
    expect(result?.assessment).toContain("it was resolved; Maya's temperature eased a little.");
    expect(result?.assessment).not.toMatch(/\d\d/);
  });

  it('says what a stronger response looks like when the curveball was not resolved', () => {
    const miss = turn('Please restart your laptop.', { troubleshooting: true }, [], {
      events: [
        [
          'curveball',
          'temperature',
          55,
          63,
          'The curveball was not addressed (customer imposes a deadline)',
        ],
      ],
    });
    const input = buildInput(makeScenario(), [...base(), miss], { curveball: fired('unresolved') });
    const result = buildCurveball(buildCallView(input));
    const expected = makeScenario().curveballs.find((c) => c.type === 'deadline')?.expectedResponse;
    expect(result?.status).toBe('unresolved');
    expect(result?.assessment).toContain('was not resolved');
    expect(result?.assessment).toContain(
      'Your reply at turn 8 (\u201cPlease restart your laptop.\u201d) did not address it.',
    );
    expect(result?.assessment).toContain("Maya's temperature rose a little (Frustrated to Angry).");
    expect(expected).toBeTruthy();
    expect(result?.assessment).toContain(`A stronger response: ${expected}`);
  });

  it('says nothing about the customer\u2019s mood when it barely moved', () => {
    const miss = turn('Please restart your laptop.', { troubleshooting: true }, [], {
      events: [['curveball', 'temperature', 55, 58, 'The curveball was not addressed']],
    });
    const input = buildInput(makeScenario(), [...base(), miss], { curveball: fired('unresolved') });
    expect(buildCurveball(buildCallView(input))?.assessment).not.toMatch(/temperature/);
  });

  it('uses the generic expected response for a curveball type the scenario did not author', () => {
    const input = buildInput(makeScenario(), base(), {
      curveball: { status: 'unresolved', type: 'ask-manager', firedAtTurn: 6, firedCount: 1 },
    });
    expect(buildCurveball(buildCallView(input))?.assessment).toMatch(
      /A stronger response: Acknowledge the request/,
    );
  });

  it('says there is nothing to judge when the curveball was still open at the end', () => {
    const input = buildInput(makeScenario(), base(), { curveball: fired('active') });
    const result = buildCurveball(buildCallView(input));
    expect(result?.status).toBe('active');
    expect(result?.assessment).toMatch(/the call ended before you could respond/);
    expect(result?.assessment).toMatch(/A strong response:/);
  });

  it('mentions when more than one curveball came up', () => {
    const input = buildInput(makeScenario(), base(), {
      curveball: fired('active', { firedCount: 2 }),
    });
    expect(buildCurveball(buildCallView(input))?.assessment).toMatch(
      /A second curveball also came up/,
    );
  });

  it('reads the strong call curveball as resolved with the trainee response', () => {
    const result = buildCurveball(buildCallView(strongCall()));
    expect(result?.status).toBe('resolved');
    expect(result?.assessment).toMatch(/At turn 10 you acknowledged the impact/);
  });
});

describe('what to practise next', () => {
  it('steps the difficulty up at an average of 4 and down at 2.5, within the three levels', () => {
    expect(nextDifficulty('starter', 4.2)).toBe('standard');
    expect(nextDifficulty('standard', 4)).toBe('challenge');
    expect(nextDifficulty('challenge', 4.8)).toBe('challenge');
    expect(nextDifficulty('standard', 2.5)).toBe('starter');
    expect(nextDifficulty('starter', 1.5)).toBe('starter');
    expect(nextDifficulty('challenge', 2.4)).toBe('standard');
    expect(nextDifficulty('standard', 3.9)).toBe('standard');
    expect(nextDifficulty('standard', 2.6)).toBe('standard');
    expect(nextDifficulty('standard', null)).toBe('standard');
  });

  it('chooses the lowest scoring dimension, breaking ties by the scenario focus and then the usual order', () => {
    const scores = {
      'opening-rapport': 3,
      'scoping-discovery': 2,
      'empathy-deescalation': 2,
      clarity: 2,
      'ownership-next-steps': 4,
      closing: 5,
    };
    expect(lowestDimension(scores, ['clarity', 'scoping-discovery'])).toBe('clarity');
    expect(lowestDimension(scores, ['closing'])).toBe('scoping-discovery');
    expect(lowestDimension({ ...scores, 'scoping-discovery': 1 }, ['clarity'])).toBe(
      'scoping-discovery',
    );
  });

  it('picks a different scenario at the suggested difficulty when one covers the dimension', () => {
    expect(pickScenario(LIBRARY, FIXTURE_ID, 'empathy-deescalation', 'standard')).toEqual({
      id: 'sharepoint-site-access-denied-for-a-team',
      title: 'A team is denied access to a shared site',
    });
  });

  it('falls back to the closest difficulty, then to the same scenario, then to nothing', () => {
    expect(
      pickScenario(
        LIBRARY,
        'sharepoint-site-access-denied-for-a-team',
        'empathy-deescalation',
        'starter',
      )?.id,
    ).toBe('azure-checkout-outage-before-a-launch');
    expect(pickScenario(LIBRARY, FIXTURE_ID, 'scoping-discovery', 'challenge')?.id).toBe(
      FIXTURE_ID,
    );
    expect(pickScenario(LIBRARY, FIXTURE_ID, 'closing', 'standard')?.id).toBe(
      'azure-checkout-outage-before-a-launch',
    );
    expect(pickScenario([], 'x', 'closing', 'standard')).toBeNull();
    expect(pickScenario(LIBRARY.slice(0, 1), 'x', 'closing', 'standard')).toBeNull();
  });

  it('suggests a step up after a strong call and a step down after a weak one', () => {
    const strong = run(strongCall());
    expect(strong.nextPractice.suggestedDifficulty).toBe('challenge');
    const weak = run(weakCall());
    expect(weak.nextPractice.suggestedDifficulty).toBe('starter');
    expect(weak.nextPractice.dimension).toBe('scoping-discovery');
  });

  it('suggests a stretch rather than a repair when every area scored well', () => {
    expect(run(strongCall()).nextPractice.recommendation).toMatch(/^Every area scored well/);
  });

  it('suggests a scenario from the library whose focus includes the dimension', () => {
    const weak = run(weakCall());
    expect(weak.nextPractice.suggestedScenarioId).toBe(FIXTURE_ID);
    expect(weak.nextPractice.suggestedScenarioTitle).toBe('Locked out after a password change');
    const noLibrary = run({ ...weakCall(), library: [] });
    expect(noLibrary.nextPractice.suggestedScenarioId).toBeNull();
    expect(noLibrary.nextPractice.suggestedScenarioTitle).toBeNull();
  });

  it('ties the recommendation to the weakest area and one concrete question from this call', () => {
    const { recommendation } = run(weakCall()).nextPractice;
    expect(recommendation).toMatch(/three different areas before you suggest any fix/);
    expect(recommendation).toContain(
      'Is your work email signed in on any other device, like a phone or tablet, that might still have your old password?',
    );
    expect(recommendation.length).toBeLessThanOrEqual(500);
  });
});
