import { describe, expect, it } from 'vitest';
import type { TurnClassification } from '#shared/domain/classification.ts';
import { CoachingReportSchema, type CoachingReport } from '#shared/domain/report.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { EVALUATOR_NAME, EVALUATOR_VERSION, evaluateWithRules } from './rules.ts';
import {
  expectQuotesVerified,
  makeScenario,
  simpleCall,
  strongCall,
  weakCall,
  type Step,
} from './testing.ts';

const NOW = new Date('2026-03-01T10:00:00Z');
const run = (input: EvaluationInput): CoachingReport => evaluateWithRules(input, { now: NOW });

function dim(report: CoachingReport, id: DimensionId) {
  const found = report.dimensions.find((d) => d.id === id);
  if (!found) throw new Error(`missing dimension ${id}`);
  return found;
}
const scoreOf = (input: EvaluationInput, id: DimensionId): number => dim(run(input), id).score;

const turn = (
  say: string,
  cls: Partial<TurnClassification> = {},
  evidence: Step['evidence'] = [],
  more: Partial<Step> = {},
): Step => ({ say, cls, evidence, ...more });

const empathic = (text: string, kind: 'specific' | 'generic' = 'specific'): Step =>
  turn(text, { empathy: kind }, [
    [kind === 'specific' ? 'empathy-specific' : 'empathy-generic', text],
  ]);
const acknowledges = (text: string): Step =>
  turn(text, { acknowledgesImpact: true }, [['impact-acknowledged', text]]);
const blames = (text: string): Step => turn(text, { blame: true }, [['blame', text]]);
const filler = (text = 'Let me think about that.'): Step => turn(text);

// ---------------------------------------------------------------------------------------

describe('evaluateWithRules: contract', () => {
  it('returns a valid report that identifies the rules evaluator and the provider', () => {
    const report = run(strongCall());
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    expect(report.version).toBe(2);
    expect(report.evaluator).toEqual({
      kind: 'rules',
      name: 'Firefly rules evaluator',
      version: 'rules-2.0.0',
      providerLabel: 'Demo mode (no live model)',
    });
    expect(EVALUATOR_NAME).toBe('Firefly rules evaluator');
    expect(EVALUATOR_VERSION).toBe('rules-2.0.0');
    expect(report.generatedAt).toBe(NOW.toISOString());
    expect(report.dimensions.map((d) => d.id)).toEqual([...DIMENSION_IDS]);
  });

  it('is deterministic and does not change its input', () => {
    const input = weakCall();
    const before = JSON.stringify(input);
    expect(run(input)).toEqual(run(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it('puts the scenario coaching focus in the summary', () => {
    expect(run(strongCall()).summary.coachingFocus).toEqual(['scoping-discovery', 'clarity']);
  });

  it('labels each score with the shared rubric label', () => {
    expect(new Set(run(strongCall()).dimensions.map((d) => d.label))).toEqual(
      new Set(['Excellent']),
    );
    expect(run(weakCall()).dimensions.find((d) => d.score === 1)?.label).toBe('Not demonstrated');
  });

  it('keeps every quote a short, verbatim part of the trainee turn it cites', () => {
    for (const input of [strongCall(), weakCall()]) expectQuotesVerified(run(input), input);
  });

  it('cuts a long recorded quote to a short, still verbatim quote', () => {
    const long =
      'I want to start by saying how sorry I am that this has happened to you this morning, especially with the whole front desk waiting on you and the patients already arriving, and I will do everything I can to help.';
    const input = simpleCall([turn(long, { empathy: 'specific' }, [['empathy-specific', long]])]);
    const report = run(input);
    expect(dim(report, 'empathy-deescalation').evidence[0]?.quote.length).toBeLessThanOrEqual(160);
    expectQuotesVerified(report, input);
  });

  it('ignores a recorded quote that is not really in the turn and uses the turn text instead', () => {
    const input = simpleCall([
      turn('Hello Maya, this is Sam.', { introduces: true }),
      turn('Can you tell me what is happening?', { askedQuestion: true }),
    ]);
    const recorded = input.classifications[2];
    if (recorded) {
      recorded.evidence = [
        { behaviour: 'greeting', quote: 'Good morning and welcome to premium support' },
      ];
    }
    const report = run(input);
    expectQuotesVerified(report, input);
    expect(dim(report, 'opening-rapport').evidence.map((e) => e.quote)).toContain(
      'Hello Maya, this is Sam.',
    );
  });

  it('copes with a trainee turn that has no classification', () => {
    const input = strongCall();
    delete input.classifications[4];
    expect(CoachingReportSchema.safeParse(run(input)).success).toBe(true);
  });
});

describe('a strong call against a weak call', () => {
  const strong = run(strongCall());
  const weak = run(weakCall());

  it('scores higher on every one of the six dimensions', () => {
    for (const id of DIMENSION_IDS) {
      expect(dim(strong, id).score, id).toBeGreaterThan(dim(weak, id).score);
    }
  });

  it('gives the strong call 5 everywhere and the weak call little', () => {
    expect(strong.dimensions.map((d) => d.score)).toEqual([5, 5, 5, 5, 5, 5]);
    expect(strong.summary.overallScore).toBe(5);
    expect(weak.dimensions.map((d) => d.score)).toEqual([1, 1, 1, 2, 2, 1]);
    expect(weak.summary.overallScore).toBe(1.3);
  });
});

describe('removing a good behaviour never raises a score', () => {
  const base = run(strongCall());
  const patch = (input: EvaluationInput, index: number, change: Partial<TurnClassification>) => {
    const current = input.classifications[index];
    if (!current) throw new Error(`no classification at ${index}`);
    input.classifications[index] = { ...current, ...change };
  };

  const degrade: [string, DimensionId, (input: EvaluationInput) => void][] = [
    ['clear ownership', 'ownership-next-steps', (i) => patch(i, 12, { ownership: 'none' })],
    ['a specific next step', 'ownership-next-steps', (i) => patch(i, 12, { nextSteps: 'none' })],
    [
      'an unverified promise added',
      'ownership-next-steps',
      (i) => patch(i, 12, { promise: 'unverified' }),
    ],
    [
      'the closing summary and checks',
      'closing',
      (i) =>
        patch(i, 14, {
          summarises: false,
          wrapsUp: false,
          asksAnythingElse: false,
          confirmsNextContact: false,
        }),
    ],
    [
      'empathy and impact acknowledgement',
      'empathy-deescalation',
      (i) => {
        for (const index of [2, 10, 12]) {
          patch(i, index, { empathy: 'none', acknowledgesImpact: false });
        }
      },
    ],
    ['blame added', 'empathy-deescalation', (i) => patch(i, 4, { blame: true })],
    [
      'the greeting and introduction',
      'opening-rapport',
      (i) => patch(i, 2, { introduces: false, evidence: [] }),
    ],
    ['every discovery', 'scoping-discovery', (i) => (i.discovery = {})],
    ['jargon explained -> unexplained', 'clarity', (i) => patch(i, 10, { jargon: 'unexplained' })],
  ];

  it.each(degrade)('%s', (_name, target, mutate) => {
    const input = strongCall();
    mutate(input);
    const report = run(input);
    for (const id of DIMENSION_IDS) {
      expect(dim(report, id).score, id).toBeLessThanOrEqual(dim(base, id).score);
    }
    expect(dim(report, target).score).toBeLessThan(dim(base, target).score);
  });
});

describe('Opening & Rapport', () => {
  const hello = turn('Hello Maya.', { introduces: true }, [['greeting', 'Hello Maya.']]);
  const helloSam = turn('Hello Maya, this is Sam from support.', { introduces: true }, [
    ['greeting', 'Hello Maya, this is Sam from support.'],
    ['introduction', 'Hello Maya, this is Sam from support.'],
  ]);
  const invite = turn(
    'Tell me what is happening.',
    { askedQuestion: true, discoveryIntents: ['problem_description'] },
    [['discovery-question', 'Tell me what is happening.']],
  );
  const inviteWithSorry = turn(
    "I'm sorry about this. Tell me what is happening.",
    { empathy: 'generic', askedQuestion: true, discoveryIntents: ['problem_description'] },
    [
      ['empathy-generic', "I'm sorry about this."],
      ['discovery-question', 'Tell me what is happening.'],
    ],
  );
  const opening = (...steps: Step[]) => scoreOf(simpleCall(steps), 'opening-rapport');

  it('starts at 1 and adds a point for each of: greeting, introduction, open question, empathy', () => {
    expect(opening(filler('Right.'), filler())).toBe(1);
    expect(opening(hello, filler())).toBe(2);
    expect(opening(helloSam, filler())).toBe(3);
    expect(opening(helloSam, invite)).toBe(4);
    expect(opening(helloSam, inviteWithSorry)).toBe(5);
  });

  it('counts a question that cannot be answered with yes or no, but not a closed one', () => {
    const closed = turn(
      'Is the laptop plugged in?',
      { askedQuestion: true, discoveryIntents: ['environment'] },
      [['discovery-question', 'Is the laptop plugged in?']],
    );
    const wh = turn(
      'Which device are you using?',
      { askedQuestion: true, discoveryIntents: ['environment'] },
      [['discovery-question', 'Which device are you using?']],
    );
    expect(opening(helloSam, closed)).toBe(3);
    expect(opening(helloSam, wh)).toBe(4);
  });

  it('counts an offer of help as introducing yourself', () => {
    const offer = turn(
      'Hello Maya. How can I help today?',
      { introduces: true, askedQuestion: true },
      [
        ['greeting', 'Hello Maya.'],
        ['offers-help', 'How can I help today?'],
      ],
    );
    expect(opening(offer, filler())).toBe(4); // greeting + offer of help + open question
  });

  it('takes a point off when the first turn goes straight into troubleshooting', () => {
    const fixFirst = turn(
      'Hello Maya, this is Sam. Please restart your laptop.',
      { introduces: true, troubleshooting: true },
      [
        ['introduction', 'Hello Maya, this is Sam.'],
        ['troubleshooting', 'Please restart your laptop.'],
      ],
    );
    const sorry = empathic("I'm sorry about this.", 'generic');
    const withoutFix = { ...fixFirst, cls: { introduces: true } };
    expect(opening(withoutFix, sorry)).toBe(4);
    expect(opening(fixFirst, sorry)).toBe(3);
  });

  it('does not penalise a fix that comes alongside an invitation to explain the problem', () => {
    const both = turn(
      'Hello Maya, this is Sam. What is happening? Meanwhile, restart your laptop.',
      {
        introduces: true,
        askedQuestion: true,
        discoveryIntents: ['problem_description'],
        troubleshooting: true,
      },
      [
        ['introduction', 'Hello Maya, this is Sam.'],
        ['discovery-question', 'What is happening?'],
      ],
    );
    expect(opening(both, filler())).toBe(4);
  });

  it('takes a point off for blame or dismissive language in the first turn', () => {
    const rude = turn(
      'Hello Maya, this is Sam. You should have read the email.',
      { introduces: true, blame: true },
      [
        ['introduction', 'Hello Maya, this is Sam.'],
        ['blame', 'You should have read the email.'],
      ],
    );
    expect(opening(rude, filler())).toBe(2);
  });

  it('only looks at the first two trainee turns', () => {
    const late = empathic("I'm sorry about this.", 'generic');
    expect(opening(helloSam, invite, late)).toBe(opening(helloSam, invite, filler()));
  });

  it('for follow-up calls, acknowledging the history or the wait earns the empathy point', () => {
    const history = turn(
      'I can see you called yesterday about this and heard nothing back. Tell me what is happening.',
      { askedQuestion: true, discoveryIntents: ['problem_description'] },
      [['discovery-question', 'Tell me what is happening.']],
    );
    expect(
      scoreOf(simpleCall([helloSam, history], { callStage: 'follow-up' }), 'opening-rapport'),
    ).toBe(5);
    expect(
      scoreOf(simpleCall([helloSam, history], { callStage: 'first-contact' }), 'opening-rapport'),
    ).toBe(4);
  });

  it('for closure calls, confirming the purpose of the call earns the empathy point', () => {
    const purpose = turn("I understand you're calling to check this is sorted so we can close it.");
    const steps = [helloSam, purpose];
    expect(scoreOf(simpleCall(steps, { callStage: 'closure' }), 'opening-rapport')).toBe(5);
    expect(scoreOf(simpleCall(steps, { callStage: 'first-contact' }), 'opening-rapport')).toBe(4);
  });

  it('never awards a 4 without a quote to show for it', () => {
    const bare = turn('Hi', {
      introduces: true,
      acknowledgesImpact: true,
      askedQuestion: true,
      discoveryIntents: ['problem_description'],
    });
    const report = run(simpleCall([bare, filler()]));
    expect(dim(report, 'opening-rapport').score).toBe(3);
    expect(dim(report, 'opening-rapport').rationale).toMatch(/Capped at 3/);
  });
});

describe('Scoping & Discovery', () => {
  const FACTS = {
    critical: 'hf-phone-old-password',
    important: 'hf-lockout-message',
    helpful: 'hf-reset-timing',
    helpful2: 'hf-tried-colleague',
  } as const;
  const ask = (
    text: string,
    intents: TurnClassification['discoveryIntents'],
    finds: Step['finds'] = {},
  ): Step =>
    turn(text, { askedQuestion: true, discoveryIntents: intents }, [['discovery-question', text]], {
      finds,
    });
  const THREE = ['problem_description', 'timing_onset', 'environment'] as const;
  const scoping = (finds: Step['finds']) =>
    scoreOf(
      simpleCall([
        ask('Can you tell me what is happening and when it started?', [...THREE], finds),
      ]),
      'scoping-discovery',
    );

  it('scores the importance-weighted share of hidden facts found', () => {
    expect(scoping({})).toBe(1);
    expect(scoping({ [FACTS.helpful]: 'discovered' })).toBe(1); // 1 of 7
    expect(scoping({ [FACTS.important]: 'discovered' })).toBe(2); // 2 of 7
    expect(scoping({ [FACTS.critical]: 'discovered' })).toBe(3); // 3 of 7
    expect(scoping({ [FACTS.critical]: 'discovered', [FACTS.important]: 'discovered' })).toBe(4); // 5 of 7
  });

  it('counts a partly found fact as half', () => {
    expect(scoping({ [FACTS.critical]: 'partial' })).toBe(2); // 1.5 of 7
    expect(scoping({ [FACTS.critical]: 'discovered', [FACTS.important]: 'partial' })).toBe(3); // 4 of 7
  });

  it('needs at least two quoted questions for a 5', () => {
    const everything = {
      [FACTS.critical]: 'discovered',
      [FACTS.important]: 'discovered',
      [FACTS.helpful]: 'discovered',
      [FACTS.helpful2]: 'discovered',
    } as const;
    const oneQuestion = run(
      simpleCall([
        ask('Can you tell me what is happening and when it started?', [...THREE], everything),
      ]),
    );
    expect(dim(oneQuestion, 'scoping-discovery').score).toBe(4);
    expect(dim(oneQuestion, 'scoping-discovery').rationale).toMatch(/Capped at 4/);

    const twoQuestions = run(
      simpleCall([
        ask('Can you tell me what is happening and when it started?', [...THREE], {
          [FACTS.critical]: 'discovered',
          [FACTS.important]: 'discovered',
        }),
        ask('Did anything change, and what have you tried?', ['recent_changes', 'already_tried'], {
          [FACTS.helpful]: 'discovered',
          [FACTS.helpful2]: 'discovered',
        }),
      ]),
    );
    expect(dim(twoQuestions, 'scoping-discovery').score).toBe(5);
  });

  it('takes a point off when fewer than three core topics were asked about', () => {
    const found = { [FACTS.critical]: 'discovered', [FACTS.important]: 'discovered' } as const;
    const narrow = ask('What is happening?', ['problem_description'], found);
    const wide = ask('What is happening, and when did it start?', [...THREE], found);
    expect(scoreOf(simpleCall([narrow]), 'scoping-discovery')).toBe(3);
    expect(scoreOf(simpleCall([wide]), 'scoping-discovery')).toBe(4);
  });

  describe('deductions on top of a 5', () => {
    const first = ask('Can you tell me what is happening and when it started?', [...THREE], {
      [FACTS.critical]: 'discovered',
      [FACTS.important]: 'discovered',
    });
    const second = ask(
      'Did anything change, and what have you tried?',
      ['recent_changes', 'already_tried'],
      {
        [FACTS.helpful]: 'discovered',
      },
    );
    const repeated = (text: string): Step => ({
      ...ask(text, ['problem_description']),
      events: [
        [
          'repetition',
          'temperature',
          40,
          45,
          'Asked about something the customer had already answered',
        ],
      ],
    });

    it('starts from a 5', () => {
      expect(scoreOf(simpleCall([first, second]), 'scoping-discovery')).toBe(5);
    });

    it('takes a point off for two or more repeated questions, but not for one', () => {
      expect(
        scoreOf(
          simpleCall([first, second, repeated('What is the problem again?')]),
          'scoping-discovery',
        ),
      ).toBe(5);
      expect(
        scoreOf(
          simpleCall([
            first,
            second,
            repeated('What is the problem again?'),
            repeated('And what exactly is wrong?'),
          ]),
          'scoping-discovery',
        ),
      ).toBe(4);
    });

    it('takes a point off when there was premature troubleshooting', () => {
      const fix = turn('Restart your laptop first.', { troubleshooting: true }, [], {
        events: [
          [
            'premature-troubleshooting',
            'temperature',
            52,
            57,
            'Jumped into fixes before understanding the situation',
          ],
        ],
      });
      expect(scoreOf(simpleCall([fix, first, second]), 'scoping-discovery')).toBe(4);
    });

    it('never goes below 1', () => {
      const fix = turn('Restart your laptop first.', { troubleshooting: true }, [], {
        events: [
          [
            'premature-troubleshooting',
            'temperature',
            52,
            57,
            'Jumped into fixes before understanding the situation',
          ],
        ],
      });
      expect(
        scoreOf(simpleCall([fix, repeated('Again?'), repeated('Once more?')]), 'scoping-discovery'),
      ).toBe(1);
    });
  });

  it('uses the questions that revealed facts as its evidence', () => {
    const report = run(
      simpleCall([
        ask('Can you tell me what is happening and when it started?', [...THREE], {
          [FACTS.critical]: 'discovered',
        }),
      ]),
    );
    expect(dim(report, 'scoping-discovery').evidence).toEqual([
      { turnIndex: 2, quote: 'Can you tell me what is happening and when it started?' },
    ]);
  });
});

describe('Empathy & De-escalation', () => {
  const sorry = empathic("I'm sorry, that sounds really stressful for the front desk.");
  const hard = empathic('That must be hard with patients arriving.');
  const generic = empathic('I understand.', 'generic');
  const ack = acknowledges('I can see how much is riding on this for the team.');
  const rude = (n: number) => blames(`You should have read notice number ${n}.`);
  const resolved = {
    status: 'resolved',
    type: 'deadline',
    firedAtTurn: 2,
    resolvedAtTurn: 4,
    firedCount: 1,
  } as const;
  const empathy = (
    steps: Step[],
    options: Parameters<typeof simpleCall>[2] = {},
    overrides: Parameters<typeof simpleCall>[1] = {},
  ) => scoreOf(simpleCall(steps, overrides, options), 'empathy-deescalation');

  it('starts at 2', () => {
    expect(empathy([filler()], { finalTemperature: 52 })).toBe(2);
  });

  it('adds a point for one specific empathy turn or two general ones', () => {
    expect(empathy([sorry], { finalTemperature: 52 })).toBe(3);
    expect(empathy([generic], { finalTemperature: 52 })).toBe(2);
    expect(empathy([generic, empathic('I do get it.', 'generic')], { finalTemperature: 52 })).toBe(
      3,
    );
  });

  it('adds a point for acknowledging the impact', () => {
    expect(empathy([ack], { finalTemperature: 52 })).toBe(3);
  });

  it('adds a point when the customer ends at least 8 points cooler than they started', () => {
    expect(empathy([filler()], { finalTemperature: 44 })).toBe(3);
    expect(empathy([filler()], { finalTemperature: 45 })).toBe(2);
  });

  it('adds a point when a calm customer ends at 30 or less and nothing harmful was said', () => {
    const calm = { startingTemperature: 'calm' } as const;
    expect(empathy([filler()], { finalTemperature: 12 }, calm)).toBe(3);
    expect(empathy([rude(1)], { finalTemperature: 12 }, calm)).toBe(1);
  });

  it('takes a point off for each blaming or dismissive turn, up to two', () => {
    const good = [sorry, hard, ack];
    const withRude = (n: number) =>
      empathy([...good, ...Array.from({ length: n }, (_, i) => rude(i))], { finalTemperature: 40 });
    expect(withRude(0)).toBe(5);
    expect(withRude(1)).toBe(4);
    expect(withRude(2)).toBe(3);
    expect(withRude(3)).toBe(3);
  });

  it('counts a turn that both blames and dismisses once', () => {
    const both = turn(
      "That's your fault. It's not a big deal.",
      { blame: true, dismissive: true },
      [
        ['blame', "That's your fault."],
        ['dismissive', "It's not a big deal."],
      ],
    );
    expect(empathy([both], { finalTemperature: 52 })).toBe(1);
  });

  it('adds a point for a resolved curveball, takes one off for an unresolved one and ignores an open one', () => {
    const base = empathy([filler()], { finalTemperature: 52 });
    expect(empathy([filler()], { finalTemperature: 52, curveball: resolved })).toBe(base + 1);
    expect(
      empathy([filler()], {
        finalTemperature: 52,
        curveball: { ...resolved, status: 'unresolved' },
      }),
    ).toBe(base - 1);
    expect(
      empathy([filler()], { finalTemperature: 52, curveball: { ...resolved, status: 'active' } }),
    ).toBe(base);
  });

  it('gives a 5 only for repeated specific empathy, nothing harmful and no net rise in temperature', () => {
    expect(empathy([sorry, hard, ack], { finalTemperature: 40 })).toBe(5);
    // one specific empathy turn only
    expect(empathy([sorry, ack], { finalTemperature: 40, curveball: resolved })).toBe(4);
    // two specific turns, but the customer ended hotter than they started
    expect(empathy([sorry, hard, ack], { finalTemperature: 60, curveball: resolved })).toBe(4);
  });

  it('never awards a high score on temperature and a curveball alone', () => {
    const report = run(simpleCall([filler()], {}, { finalTemperature: 30, curveball: resolved }));
    // 2 + cooler + resolved curveball = 4, but there is no empathy to quote
    expect(dim(report, 'empathy-deescalation').score).toBe(3);
  });

  it('quotes blame and dismissal when they happened', () => {
    const both = turn(
      "That's your fault. It's not a big deal.",
      { blame: true, dismissive: true },
      [
        ['blame', "That's your fault."],
        ['dismissive', "It's not a big deal."],
      ],
    );
    const report = run(simpleCall([both]));
    expect(dim(report, 'empathy-deescalation').evidence.map((e) => e.quote)).toEqual([
      "That's your fault.",
      "It's not a big deal.",
    ]);
  });
});

describe('Clarity', () => {
  const clearTurn = (text: string): Step => turn(text, { clarity: 'clear' });
  const summary = (text: string): Step => turn(text, { summarises: true }, [['summary', text]]);
  const jargon = (text: string): Step =>
    turn(text, { jargon: 'unexplained' }, [['jargon-unexplained', text]]);
  const explained = (text: string): Step =>
    turn(text, { jargon: 'explained' }, [['jargon-explained', text]]);
  const unclear = (text: string): Step => turn(text, { clarity: 'unclear' });
  const clarity = (steps: Step[], overrides: Parameters<typeof simpleCall>[1] = {}) =>
    scoreOf(simpleCall(steps, overrides), 'clarity');

  it('starts at 3', () => {
    expect(clarity([filler()])).toBe(3);
  });

  it('adds a point for two clear turns or one summary', () => {
    expect(clarity([clearTurn('First I will unlock it.'), filler()])).toBe(3);
    expect(
      clarity([clearTurn('First I will unlock it.'), clearTurn('Then you update the phone.')]),
    ).toBe(4);
    // a lone summary would reach 5, but one quote is not enough evidence for a 5
    expect(clarity([summary('So your phone kept trying the old password.')])).toBe(4);
  });

  it('adds another point for a summary with no unexplained jargon and no unclear turns', () => {
    expect(
      clarity([
        summary('So your phone kept trying the old password.'),
        explained('The account locked, which is called a lockout.'),
      ]),
    ).toBe(5);
  });

  it('takes a point off per unexplained-jargon turn for a novice, up to two', () => {
    expect(clarity([jargon('Clear your cache.')])).toBe(2);
    expect(clarity([jargon('Clear your cache.'), jargon('Check the DNS.')])).toBe(1);
    expect(
      clarity([jargon('Clear your cache.'), jargon('Check the DNS.'), jargon('Reset the token.')]),
    ).toBe(1);
  });

  it('weighs jargon half as much for an intermediate customer and not at all for an expert', () => {
    const two = [jargon('Clear your cache.'), jargon('Check the DNS.')];
    expect(clarity([jargon('Clear your cache.')], { proficiency: 'intermediate' })).toBe(3);
    expect(clarity(two, { proficiency: 'intermediate' })).toBe(2);
    expect(clarity([...two, jargon('Reset the token.')], { proficiency: 'expert' })).toBe(3);
  });

  it('takes a point off for two or more unclear turns', () => {
    expect(clarity([unclear('Well, maybe it could be that or something.')])).toBe(3);
    expect(
      clarity([unclear('Well, maybe it could be that.'), unclear('Or perhaps it is the other.')]),
    ).toBe(2);
  });

  it('does not count low-effort replies as unclear writing', () => {
    const terse = (text: string): Step => turn(text, { clarity: 'unclear', lowEffort: true });
    expect(clarity([terse('ok'), terse('yes'), terse('sure')])).toBe(3);
  });

  it('quotes the jargon it penalised', () => {
    const report = run(simpleCall([jargon('Clear your cache.')]));
    expect(dim(report, 'clarity').evidence).toEqual([{ turnIndex: 2, quote: 'Clear your cache.' }]);
  });
});

describe('Ownership & Next Steps', () => {
  const owner = (text: string): Step =>
    turn(text, { ownership: 'clear' }, [['ownership-clear', text]]);
  const vagueOwner = (text: string): Step =>
    turn(text, { ownership: 'vague' }, [['ownership-vague', text]]);
  const steps = (text: string): Step =>
    turn(text, { nextSteps: 'specific' }, [['next-steps-specific', text]]);
  const vagueSteps = (text: string): Step =>
    turn(text, { nextSteps: 'vague' }, [['next-steps-vague', text]]);
  const contact = (text: string): Step =>
    turn(text, { confirmsNextContact: true }, [['next-contact', text]]);
  const promise = (text: string): Step =>
    turn(text, { promise: 'unverified' }, [['promise-unverified', text]]);
  const ownership = (list: Step[]) => scoreOf(simpleCall(list), 'ownership-next-steps');

  it('maps points to scores: 0 -> 1, 1 -> 2, 2-3 -> 3, 4 -> 4, 5 -> 5', () => {
    const o = owner("I'll take this on myself.");
    const s = steps("I'll call you back at nine.");
    expect(ownership([filler()])).toBe(1);
    expect(ownership([vagueOwner('Someone will look at it.')])).toBe(2);
    expect(ownership([o])).toBe(3);
    expect(ownership([o, vagueSteps('We will get back to you soon.')])).toBe(3);
    expect(ownership([o, s])).toBe(4);
    expect(ownership([o, s, contact('I will check in again at ten.')])).toBe(5);
  });

  it('takes a point off for each unverified promise, up to two', () => {
    const base = [owner("I'll take this on myself."), steps("I'll call you back at nine.")];
    const p1 = promise('It will definitely be fixed today.');
    const p2 = promise('I guarantee it.');
    const p3 = promise('Absolutely, no problem.');
    expect(ownership(base)).toBe(4);
    expect(ownership([...base, p1])).toBe(3);
    expect(ownership([...base, p1, p2])).toBe(3);
    expect(ownership([...base, p1, p2, p3])).toBe(3);
  });

  it('cannot go below 1', () => {
    const p = promise('It will definitely be fixed today.');
    expect(ownership([p, promise('I guarantee it.')])).toBe(1);
  });

  it('quotes the ownership, the next step and the promise', () => {
    const report = run(
      simpleCall([
        owner("I'll take this on myself."),
        steps("I'll call you back at nine."),
        promise('It will definitely be fixed today.'),
      ]),
    );
    expect(dim(report, 'ownership-next-steps').evidence.map((e) => e.quote)).toEqual([
      "I'll take this on myself.",
      "I'll call you back at nine.",
      'It will definitely be fixed today.',
    ]);
  });
});

describe('Closing', () => {
  const recapAndTime = turn(
    "Just to recap, I've unlocked the account and you'll update your phone. I'll call you back at nine to check.",
    { summarises: true, wrapsUp: true, confirmsNextContact: true },
    [
      ['summary', "Just to recap, I've unlocked the account and you'll update your phone."],
      ['next-contact', "I'll call you back at nine to check."],
    ],
  );
  const recap = turn(
    "Just to recap, I've unlocked the account and you'll update your phone.",
    { summarises: true, wrapsUp: true },
    [['summary', "Just to recap, I've unlocked the account and you'll update your phone."]],
  );
  const time = turn("I'll call you back at nine to check.", { confirmsNextContact: true }, [
    ['next-contact', "I'll call you back at nine to check."],
  ]);
  const anything = turn('Is there anything else I can help with?', { asksAnythingElse: true }, [
    ['anything-else', 'Is there anything else I can help with?'],
  ]);
  const thanks = turn('Thanks, Maya, take care.', {}, [['thanks', 'Thanks, Maya, take care.']]);
  const anythingAndThanks = turn(
    'Is there anything else I can help with? Thanks, Maya, take care.',
    { asksAnythingElse: true },
    [
      ['anything-else', 'Is there anything else I can help with?'],
      ['thanks', 'Thanks, Maya, take care.'],
    ],
  );
  const work = [filler('One moment.'), filler('Still looking.')];
  const closing = (list: Step[]) => scoreOf(simpleCall(list), 'closing');

  it('says so plainly when the call ended without a summary or confirmation of next steps', () => {
    const closingDimension = dim(
      run(simpleCall([...work, filler('I have to go now.')])),
      'closing',
    );
    expect(closingDimension.score).toBe(1);
    expect(closingDimension.rationale).toBe(
      'The call ended without a summary or confirmation of next steps.',
    );
    expect(closingDimension.evidence).toEqual([]);
  });

  it('scores 1 plus a point each for a recap, a confirmed next contact, a check for anything else and a polite close', () => {
    expect(closing([...work, thanks])).toBe(2);
    expect(closing([...work, anything, thanks])).toBe(3);
    expect(closing([...work, time, anythingAndThanks])).toBe(4);
    expect(closing([...work, recapAndTime, anythingAndThanks])).toBe(5);
  });

  it('weights the final two trainee turns: earlier agreements count half and need confirming at the end', () => {
    expect(closing([recap, ...work])).toBe(1); // half a point rounds down
    expect(closing([recap, time, ...work])).toBe(2); // two halves make one
    expect(closing([recap, ...work, thanks])).toBe(2);
    expect(dim(run(simpleCall([recap, time, ...work])), 'closing').rationale).toMatch(
      /counts half/,
    );
  });

  it('does not count a first-turn "thanks for calling" or a mid-call "thanks" as a goodbye', () => {
    const greeting = turn('Thanks for calling, this is Sam.', { introduces: true }, [
      ['thanks', 'Thanks for calling, this is Sam.'],
    ]);
    expect(closing([greeting, filler('Right.')])).toBe(1);
    const midCall = turn('Thanks for that. Let me check.', {}, [['thanks', 'Thanks for that.']]);
    expect(closing([filler('One moment.'), midCall, filler('Still looking.')])).toBe(1);
  });

  it('counts a polite close only in the final turn', () => {
    expect(closing([...work, thanks, filler('Checking.')])).toBe(1);
  });

  it('counts a specific next step with a time as confirming the next contact', () => {
    const step = turn("I'll check the logs by nine tomorrow morning.", { nextSteps: 'specific' }, [
      ['next-steps-specific', "I'll check the logs by nine tomorrow morning."],
    ]);
    expect(closing([...work, step])).toBe(2);
  });
});

describe('nothing was said', () => {
  it('scores every dimension 1 with insufficient evidence instead of inventing a result', () => {
    const report = run(simpleCall([]));
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    expect(report.dimensions.every((d) => d.score === 1 && d.sufficiency === 'insufficient')).toBe(
      true,
    );
    expect(report.summary.overallScore).toBeNull();
    expect(report.strengths).toEqual([]);
    expect(report.improvements).toEqual([]);
    expect(report.completion.traineeTurns).toBe(0);
    expect(report.journey.points).toHaveLength(1);
  });
});

describe('scenario setup', () => {
  it('can evaluate a call against a scenario configured for other settings', () => {
    const scenario = makeScenario({
      proficiency: 'expert',
      style: 'terse',
      callStage: 'escalated',
    });
    expect(scenario.config.proficiency).toBe('expert');
    expect(
      scoreOf(simpleCall([filler(), filler(), filler()], { proficiency: 'expert' }), 'clarity'),
    ).toBe(3);
  });
});
