import { describe, expect, it } from 'vitest';
import type { TurnClassification } from '#shared/domain/classification.ts';
import { CoachingReportSchema, type CoachingReport } from '#shared/domain/report.ts';
import { DIMENSION_IDS, STYLES, type DimensionId } from '#shared/domain/vocab.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { evaluateWithRules } from './rules.ts';
import {
  buildInput,
  expectQuotesVerified,
  makeScenario,
  simpleCall,
  type Step,
} from './testing.ts';

const run = (input: EvaluationInput): CoachingReport =>
  evaluateWithRules(input, { now: new Date('2026-03-01T10:00:00Z') });
const scores = (report: CoachingReport) => report.dimensions.map((d) => d.score);

// The same three-and-a-bit moments said three ways. The classifier recorded the same behaviours
// each time, so the evaluation must be identical: how long, short or polished the wording is
// does not decide a score.
const FLAGS: Partial<TurnClassification>[] = [
  {
    introduces: true,
    empathy: 'specific',
    acknowledgesImpact: true,
    askedQuestion: true,
    discoveryIntents: ['problem_description'],
  },
  { askedQuestion: true, discoveryIntents: ['error_message'] },
  { ownership: 'clear', nextSteps: 'specific', confirmsNextContact: true },
  { summarises: true, wrapsUp: true, asksAnythingElse: true },
];
const FINDS: Step['finds'][] = [{}, { 'hf-lockout-message': 'discovered' }, {}, {}];

const step = (i: number, say: string, evidence: Step['evidence']): Step => ({
  say,
  cls: FLAGS[i],
  evidence,
  finds: FINDS[i],
});

const VERBOSE: Step[] = [
  step(
    0,
    "Hello Maya, this is Sam from the Northwind support team. I'm so sorry you're stuck, especially with the front desk waiting on bookings. Could you please tell me everything that happens when you try to sign in?",
    [
      ['greeting', 'Hello Maya, this is Sam from the Northwind support team.'],
      ['introduction', 'Hello Maya, this is Sam from the Northwind support team.'],
      [
        'empathy-specific',
        "I'm so sorry you're stuck, especially with the front desk waiting on bookings.",
      ],
      [
        'impact-acknowledged',
        "I'm so sorry you're stuck, especially with the front desk waiting on bookings.",
      ],
      [
        'discovery-question',
        'Could you please tell me everything that happens when you try to sign in?',
      ],
    ],
  ),
  step(
    1,
    'Thank you for that. Could you read me exactly what the message says on the sign-in screen, word for word?',
    [
      [
        'discovery-question',
        'Could you read me exactly what the message says on the sign-in screen, word for word?',
      ],
    ],
  ),
  step(
    2,
    "I will take ownership of this, and I'll unlock the account now and call you back at nine tomorrow to check that you can sign in.",
    [
      ['ownership-clear', 'I will take ownership of this'],
      [
        'next-steps-specific',
        "I'll unlock the account now and call you back at nine tomorrow to check that you can sign in.",
      ],
      [
        'next-contact',
        "I'll unlock the account now and call you back at nine tomorrow to check that you can sign in.",
      ],
    ],
  ),
  step(
    3,
    "To summarise, I've unlocked the account, and I'll call you back at nine tomorrow. Is there anything else I can help you with today? Thank you so much for your patience, goodbye.",
    [
      [
        'summary',
        "To summarise, I've unlocked the account, and I'll call you back at nine tomorrow.",
      ],
      [
        'wrap-up',
        "To summarise, I've unlocked the account, and I'll call you back at nine tomorrow.",
      ],
      ['anything-else', 'Is there anything else I can help you with today?'],
      ['thanks', 'Thank you so much for your patience, goodbye.'],
    ],
  ),
];

const TERSE: Step[] = [
  step(0, "Hi Maya, Sam from support. Sorry about the front desk. What's happening?", [
    ['greeting', 'Hi Maya, Sam from support.'],
    ['introduction', 'Hi Maya, Sam from support.'],
    ['empathy-specific', 'Sorry about the front desk.'],
    ['impact-acknowledged', 'Sorry about the front desk.'],
    ['discovery-question', "What's happening?"],
  ]),
  step(1, 'What does the screen say?', [['discovery-question', 'What does the screen say?']]),
  step(2, "I'll unlock it and call at nine.", [
    ['ownership-clear', "I'll unlock it"],
    ['next-steps-specific', "I'll unlock it and call at nine."],
    ['next-contact', "I'll unlock it and call at nine."],
  ]),
  step(3, 'Recap: unlocked, call at nine. Anything else? Thanks.', [
    ['summary', 'Recap: unlocked, call at nine.'],
    ['wrap-up', 'Recap: unlocked, call at nine.'],
    ['anything-else', 'Anything else?'],
    ['thanks', 'Thanks.'],
  ]),
];

const NON_NATIVE: Step[] = [
  step(
    0,
    'Hello Maya, I am Sam from support team. I am sorry you are stuck, the front desk waiting for booking. Please tell me what happen when you sign in?',
    [
      ['greeting', 'Hello Maya, I am Sam from support team.'],
      ['introduction', 'Hello Maya, I am Sam from support team.'],
      ['empathy-specific', 'I am sorry you are stuck, the front desk waiting for booking.'],
      ['impact-acknowledged', 'I am sorry you are stuck, the front desk waiting for booking.'],
      ['discovery-question', 'Please tell me what happen when you sign in?'],
    ],
  ),
  step(1, 'Please you read me exactly what message say on the screen?', [
    ['discovery-question', 'Please you read me exactly what message say on the screen?'],
  ]),
  step(
    2,
    'I will take this problem and unlock account now. I call you back at nine tomorrow, then you can sign in.',
    [
      ['ownership-clear', 'I will take this problem and unlock account now.'],
      ['next-steps-specific', 'I call you back at nine tomorrow, then you can sign in.'],
      ['next-contact', 'I call you back at nine tomorrow, then you can sign in.'],
    ],
  ),
  step(
    3,
    'I tell again: account is unlock, and I call you at nine. Anything else I can help? Thank you, goodbye.',
    [
      ['summary', 'I tell again: account is unlock, and I call you at nine.'],
      ['wrap-up', 'I tell again: account is unlock, and I call you at nine.'],
      ['anything-else', 'Anything else I can help?'],
      ['thanks', 'Thank you, goodbye.'],
    ],
  ),
];

describe('what is never penalised', () => {
  const verbose = run(buildInput(makeScenario(), VERBOSE));

  it('scores a terse trainee exactly as it scores a wordy one who did the same things', () => {
    const terse = run(buildInput(makeScenario(), TERSE));
    expect(scores(terse)).toEqual(scores(verbose));
    expect(terse.summary.overallScore).toBe(verbose.summary.overallScore);
    expect(terse.strengths.map((s) => s.title)).toEqual(verbose.strengths.map((s) => s.title));
    expect(terse.improvements).toEqual(verbose.improvements);
  });

  it('scores non-native phrasing and grammar mistakes exactly as it scores fluent wording', () => {
    const input = buildInput(makeScenario(), NON_NATIVE);
    const nonNative = run(input);
    expect(scores(nonNative)).toEqual(scores(verbose));
    expect(nonNative.improvements).toEqual(verbose.improvements);
    expectQuotesVerified(nonNative, input);
  });

  it('never criticises accent, grammar, spelling or fluency in any report text', () => {
    const report = run(buildInput(makeScenario(), NON_NATIVE));
    const everything = JSON.stringify([
      report.dimensions.map((d) => [d.rationale, d.guidance]),
      report.strengths.map((s) => [s.title, s.whyItHelped]),
      report.improvements,
      report.summary,
    ]);
    expect(everything).not.toMatch(
      /accent|grammar|spelling|fluen|broken english|non-native|native speaker/i,
    );
  });

  it('says that length, grammar and phrasing are not scored whenever it comments on clarity', () => {
    const jargon = simpleCall([
      {
        say: 'Clear your cache.',
        cls: { jargon: 'unexplained' },
        evidence: [['jargon-unexplained', 'Clear your cache.']],
      },
    ]);
    const clarity = run(jargon).dimensions.find((d) => d.id === 'clarity');
    expect(clarity?.rationale).toContain(
      'Length, grammar and phrasing are not part of this score.',
    );
  });

  it.each(STYLES)('does not change anything because the customer\u2019s style is %s', (style) => {
    const input = buildInput(makeScenario({ style }), VERBOSE);
    const report = run(input);
    expect(scores(report)).toEqual(scores(verbose));
    expect(report.improvements).toEqual(verbose.improvements);
    expect(report.strengths).toEqual(verbose.strengths);
  });

  it('does not treat very short replies as a clarity or effort problem when the behaviour was right', () => {
    const terse = run(buildInput(makeScenario(), TERSE));
    const clarity = terse.dimensions.find((d) => d.id === 'clarity');
    expect(clarity?.score).toBeGreaterThanOrEqual(4);
    // the only gap is the hidden fact that this short call never asked about
    expect(terse.improvements.map((i) => i.dimension)).toEqual(['scoping-discovery']);
  });

  it('does not depend on the wording at all: the same words with different recorded behaviour score differently', () => {
    const silent = VERBOSE.map((s) => ({ ...s, cls: {}, finds: {} }));
    const flat = run(buildInput(makeScenario(), silent));
    expect(scores(flat)).not.toEqual(scores(verbose));
  });

  it('judges the same call the same way whichever dimension labels or customer is configured', () => {
    const calm = run(
      buildInput(makeScenario({ startingTemperature: 'calm', impact: 'low' }), VERBOSE),
    );
    expect(calm.dimensions.find((d) => d.id === 'scoping-discovery')?.score).toBe(
      verbose.dimensions.find((d) => d.id === 'scoping-discovery')?.score,
    );
  });
});

describe('dimension order and ids', () => {
  it('always returns the six dimensions once each, in the canonical order', () => {
    const report = run(buildInput(makeScenario(), VERBOSE));
    expect(report.dimensions.map((d) => d.id)).toEqual([...DIMENSION_IDS]);
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
  });

  it('keeps every score an integer from 1 to 5', () => {
    const report = run(buildInput(makeScenario(), TERSE));
    for (const d of report.dimensions) {
      expect(Number.isInteger(d.score)).toBe(true);
      expect(d.score).toBeGreaterThanOrEqual(1);
      expect(d.score).toBeLessThanOrEqual(5);
    }
    const ids: DimensionId[] = report.dimensions.map((d) => d.id);
    expect(new Set(ids).size).toBe(6);
  });
});
