import type { TurnClassification } from '#shared/domain/classification.ts';
import { applyConfig, type EffectiveScenario, type TimeOfDay } from '#shared/domain/config.ts';
import {
  ScenarioDefinitionSchema,
  type ScenarioDefinition,
  type ScenarioInput,
  type ScenarioOverrides,
} from '#shared/domain/scenario.ts';
import type { CommunicationStyle, StartTemperature } from '#shared/domain/vocab.ts';
import type { MatchingMode } from './discovery.ts';
import { mockClassifier } from './mock/index.ts';
import { processTraineeTurn, type CustomerGenerationContext } from './pipeline.ts';
import { createInitialRuntime, openingMessage } from './session.ts';
import type { TranscriptTurn } from './types.ts';

// Fixtures shared by the engine, prompt and provider tests. The engine is a core area: it must not
// import anything from server/scenarios, so the scenario used by tests is written out here. It is
// a small but complete Microsoft scenario that uses every class of fact (known, vague, checkable,
// unknown, irrelevant and hidden), and it is checked against the real schema when it is built.
//
// Everything in it is fictional: the people, the organisation and the case number. Outlook is a
// real product, so the scenario only describes what a customer sees and says.

export const FIXTURE_ID = 'fixture-outlook-sign-in-after-password-change';

export const FIXTURE_INPUT = {
  id: FIXTURE_ID,
  version: 1,
  title: 'Outlook will not sign in after a password change',
  listSummary: 'A front-desk coordinator cannot sign in to Outlook after changing her password.',
  summary:
    'A front-desk coordinator changed her password this morning and now Outlook will not let her in. She is polite, a little worried about her morning, and not technical.',
  tags: ['outlook', 'sign-in', 'password'],
  estimatedMinutes: 8,

  product: { id: 'outlook', area: 'Sign-in' },
  caseReference: 'SIM-990001',

  issueType: 'sign-in-access',
  impact: 'low',
  startingTemperature: 'calm',
  proficiency: 'novice',
  style: 'talkative',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Maya Okafor',
    speaker: 'female',
    role: 'Front-desk coordinator',
    organisation: 'Fabrikam Dental Group',
    background:
      'Maya books and checks in patients all day. She is confident with the tools she uses every day but has never thought about how sign-in works behind the scenes.',
    voice:
      'Friendly and chatty. Apologises for not being technical. Describes what she sees rather than naming it, and explains what she was doing step by step.',
  },
  environment: {
    details: [
      'Work laptop running Windows with the usual browser',
      'Work email is also set up on her personal phone',
      'Passwords expire every 90 days and staff get a reminder email',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Only Maya' },
    medium: { count: 3, summary: 'Three people on the front desk' },
    high: { count: 12, summary: 'The whole front desk across two sites' },
  },
  customerObjective: 'Get back into Outlook before the first appointments of the day.',
  customerExpectation:
    'Someone who listens, explains what is wrong in plain words and gets her back in.',
  desiredOutcome: 'Maya is back in Outlook, knows why it happened and what to change on her phone.',
  previousTroubleshooting: [
    'Typed the new password again several times',
    'Restarted the laptop once',
  ],
  recentChanges: ['Changed the password this morning after the reminder email'],

  publicBrief: {
    issue: 'Maya cannot sign in to Outlook after changing her password this morning.',
    impact: {
      low: 'Only Maya is affected, but she cannot start her morning tasks.',
      medium: 'A few people on the front desk are locked out of bookings.',
      high: 'The whole front desk is locked out and patients are waiting.',
    },
    objective: 'Find out what is happening and agree how Maya gets back in.',
  },
  brief: {
    situation:
      'A front-desk coordinator is calling because she cannot sign in to Outlook. She is polite and a little worried about holding up her morning.',
    goal: 'Understand what is happening and why, then agree how she will get back in.',
    groundRules: [
      'The customer, organisation and case number are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
    ],
  },

  openingCore:
    "I can't sign in to Outlook. It stopped letting me in this morning, just after I reset my password.",
  impactVariants: {
    low: {
      summary: "It's only me, but I can't start my morning tasks.",
      detail:
        "It's just my account. A colleague at the next desk can sign in fine, and I can still read messages on my phone, so it's more of a hold-up than an emergency.",
      deadline: 'I would like to be in before the first appointments at nine.',
    },
    medium: {
      summary: 'Three of us at the front desk are stuck, and we need Outlook for bookings.',
      detail:
        "Three of us changed our passwords after the reminder email, and all three of us are locked out now. We can't process this morning's bookings properly.",
      deadline: 'We need to be back in before the nine o clock appointments.',
    },
    high: {
      summary: "The whole front desk can't sign in and patients are already waiting.",
      detail:
        "Everyone on the front desk is locked out, about twelve of us across two sites. Patients are queuing and we're writing details on paper.",
      deadline: 'We needed this fixed ten minutes ago. Patients are waiting right now.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the Outlook sign-in problem I reported yesterday. It's still happening, and I haven't had an update.",
      brief: 'Maya called yesterday about the same problem and has not had an update.',
    },
    escalated: {
      opening:
        "I need help with an ongoing Outlook problem. We've contacted support twice, and I need someone to take ownership now.",
      brief: 'Maya has contacted support twice about this problem without a resolution.',
    },
    closure: {
      opening:
        "I'm calling back about the Outlook sign-in problem. It seems to be working now, but I want to understand what changed before we close the case.",
      brief: 'Maya expects to confirm that she can sign in and to hear what changed.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday afternoon',
      summary: 'Maya reported not being able to sign in. A case was logged and no update was sent.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-laptop',
      text: "I'm trying to sign in on my work laptop, with the usual browser.",
      intents: ['problem_description', 'environment'],
      elaboration: "It's the same laptop I use every day, and everything else on it works fine.",
    },
    {
      id: 'kf-new-password',
      text: "I'm typing the new password I just made, so I don't understand why it won't let me in.",
      intents: ['problem_description', 'already_tried'],
      simple: 'I type my new password. It does not let me in.',
    },
    {
      id: 'kf-outcome',
      text: 'I just want to be able to sign in again so I can start checking people in.',
      intents: ['expected_outcome'],
      simple: 'I want to sign in again and start work.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-outlook-app',
      intents: ['environment'],
      cues: [
        'which outlook',
        'new outlook',
        'classic',
        'which version',
        'what version',
        'which app',
      ],
      text: "I think it's the newer Outlook, but I couldn't swear to it.",
      confirmedText: "Yes, I've just had another look and it's the newer Outlook.",
    },
  ],
  checkableFacts: [
    {
      id: 'cf-others-affected',
      intents: ['affected_scope'],
      cues: ['how many', 'anyone else', 'who else', 'colleagues', 'others', 'whole team'],
      checking: "Give me a second, I'll ask the others.",
      text: "Okay, so it's me and one colleague on the front desk who can't get in.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-sign-in-rules',
      intents: ['account_details', 'recent_changes'],
      cues: ['policy', 'policies', 'administrator', 'admin', 'it department', 'it team', 'rules'],
      text: "I don't have that to hand. Our administrator looks after the sign-in rules, not me.",
      whoKnows: 'our administrator',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-parking',
      text: 'The parking at the office has been a nightmare this week, honestly.',
    },
    { id: 'if-printer', text: 'And the printer on our floor has been jammed since Monday.' },
  ],

  hiddenFacts: [
    {
      id: 'hf-phone-old-password',
      importance: 'critical',
      label: 'Phone still using the old password',
      statement:
        "My work email is on my personal phone too, and it keeps asking me to re-enter my password. I've just been tapping it away.",
      revealWhen:
        'Asks whether any other device, phone, tablet or app is signed in with the account or might still be using the old password.',
      intents: ['environment', 'already_tried', 'recent_changes'],
      cues: [
        'phone',
        'mobile',
        'other device',
        'another device',
        'tablet',
        'signed in anywhere',
        'signed in elsewhere',
        'mail app',
        'email app',
        'old password',
      ],
      hint: 'My phone has been acting up this morning too.',
      statementTerse: 'My work email on my phone keeps asking for the password. I ignored it.',
      statementSimple:
        'My work email is also on my phone. It keeps asking for my password. I did not enter it.',
      missedConsequence:
        'Without finding the phone, the account may be unlocked but locked again within minutes, and the customer is left confused.',
      betterQuestion:
        'Is your work email signed in on any other device, like a phone or tablet, that might still have your old password?',
    },
    {
      id: 'hf-lockout-message',
      importance: 'important',
      label: 'The message says the account is locked',
      statement:
        'Now that I look at it properly, the message says my account has been temporarily locked because of too many sign-in attempts.',
      partialStatement: 'It says something about waiting and trying again later, I think.',
      revealWhen:
        'Asks what the sign-in message says exactly, or asks the customer to read or describe the error.',
      intents: ['error_message'],
      partialIntents: ['problem_description'],
      hint: "There's something on the screen about waiting before I try again.",
      statementTerse: 'It says my account is temporarily locked after too many attempts.',
      statementSimple:
        'The message says my account is locked for a short time because of too many tries.',
      missedConsequence:
        'Without the exact message, the engineer may suggest repeated password resets that do not address the lockout.',
      betterQuestion: 'Can you read me exactly what the sign-in screen says when it stops you?',
    },
    {
      id: 'hf-reset-timing',
      importance: 'helpful',
      label: 'Started right after the password change',
      statement:
        'It started right after I changed my password at about ten past eight, because the system said it was about to expire.',
      revealWhen: 'Asks when the problem started or what happened just before it.',
      intents: ['timing_onset', 'recent_changes'],
      cues: [
        'when did',
        'when was',
        'when it',
        'start',
        'began',
        'begin',
        'last work',
        'worked before',
        'just before',
        'happened before',
        'first notice',
      ],
      hint: 'It was fine yesterday.',
      statementTerse: 'It started right after I changed my password at about ten past eight.',
      statementSimple: 'It started after I changed my password at about eight ten this morning.',
      missedConsequence:
        'The link between the password change and the lockout stays unclear, which makes the cause harder to explain.',
      betterQuestion: 'When did it last work, and what happened between then and now?',
    },
    {
      id: 'hf-tried-colleague',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'Already tried several times, including a colleague',
      statement:
        "I tried about six times, and I asked a colleague to try my new password on her computer. That didn't work either.",
      revealWhen: 'Asks what the customer has already tried to fix it.',
      intents: ['already_tried', 'reproducibility'],
      cues: ['tried', 'try', 'attempt', 'already done', 'so far', 'steps'],
      statementTerse: 'I tried six times. A colleague tried too. It failed.',
      statementSimple:
        'I tried six times. My colleague tried on her computer. It also did not work.',
      missedConsequence:
        'Repeating steps the customer has already tried costs trust, and the repeated attempts are part of why the account is locked.',
      betterQuestion: 'What have you already tried, and what happened each time?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-password-not-saved',
      statement: "I think the system just didn't save my new password properly.",
      truth:
        'The password was saved correctly. The account locked because an old saved password kept being tried from another device.',
    },
  ],

  curveballs: [
    {
      id: 'cb-opening-time-pressure',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 8, whenImpactUnacknowledged: true },
      statement:
        "I'm sorry to rush you, but the first patients arrive at nine and I can't check anyone in without Outlook.",
      followUp:
        'Do you have any idea how long this will take? I need to tell the dentists something.',
      expectedResponse:
        'Acknowledge the time pressure, say what you can do right now, and give an honest time for the next update instead of promising a fix time.',
      minDifficulty: 'standard',
    },
  ],
  allowedCurveballs: [
    'deadline',
    'ask-manager',
    'threaten-cancel',
    'go-silent',
    'previous-bad-experience',
    'unsupported-guarantee',
    'challenge-credibility',
  ],

  expectedDiscoveryAreas: [
    'The exact message on screen',
    'Other devices using the account',
    'When it started',
    'What has been tried',
  ],
  successCriteria: [
    'Greets Maya, introduces themselves and checks what she needs.',
    'Finds the exact lockout message before suggesting fixes.',
    'Discovers that her phone is still using the old password.',
    'Explains the cause in plain language without unexplained jargon.',
    'Confirms what happens next and checks that she can sign in.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity'],
  careExpectations: {
    communicate: ['Explains the lockout in everyday words and checks Maya has understood it.'],
    accountable: ['Says who will unlock the account and when Maya will hear back.'],
    resourceful: ['Asks about other devices and the exact message before suggesting a fix.'],
    empathetic: ['Recognises that Maya has patients waiting and a morning to start.'],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Telling Maya to reset the password again without asking why it failed.',
    'Using terms such as "lockout policy" or "cached credentials" without explaining them.',
    'Jumping to fixes before finding out what the screen says.',
    'Asking for her new password.',
  ],
  goodBehaviours: [
    'Asking what the screen says, in her words.',
    'Asking about any other devices or apps that use her account.',
    'Explaining the lockout in everyday language.',
    'Checking she can sign in before ending the call.',
  ],
  expectedOutcome:
    'Maya understands that her account was temporarily locked by repeated attempts from an old saved password, the engineer arranges the unlock, she updates the password on her phone, and she confirms she can sign in.',
  evaluatorNotes:
    "Root cause: after the password change, the work email app on Maya's personal phone kept retrying the old password and locked the account. A strong call discovers the lockout message and the phone, explains the cause in plain language, arranges the unlock, tells Maya to update or remove the account on her phone, and confirms that she can sign in.",
} satisfies ScenarioInput;

/** The fixture as the schema parses it. `patch` replaces whole top-level fields. */
export function makeDefinition(patch: Partial<ScenarioInput> = {}): ScenarioDefinition {
  return ScenarioDefinitionSchema.parse({ ...FIXTURE_INPUT, ...patch });
}

/**
 * The fixture with the settings of one call applied. Standard difficulty unless the overrides say
 * otherwise, and a fixed seed so a test sees the same conversation every time.
 */
export function makeScenario(
  overrides: ScenarioOverrides = {},
  seed = 7,
  options: { timeOfDay?: TimeOfDay } = {},
): EffectiveScenario {
  return applyConfig(
    makeDefinition(),
    { difficulty: 'standard', ...overrides },
    { seed, timeOfDay: options.timeOfDay ?? 'morning' },
  );
}

export interface ScriptedLine {
  text: string;
  /** Overrides applied on top of the rules classifier's result for this line. */
  classification?: Partial<TurnClassification>;
  /** What the customer says in reply, so later turns have realistic history. */
  reply?: string;
}

/**
 * One context per line, as the customer generator would receive it, from running the lines through
 * the real pipeline: tests see genuine state, discovery and curveball results rather than
 * hand-built objects. `matching: 'model'` is how a live call is run: the line's classification
 * (scripted, or the rules') says which facts a question was about, and cues are not applied.
 */
export async function captureContexts(
  scenario: EffectiveScenario,
  lines: (string | ScriptedLine)[],
  options: { matching?: MatchingMode } = {},
): Promise<CustomerGenerationContext[]> {
  let runtime = createInitialRuntime(scenario);
  const history: TranscriptTurn[] = [
    { index: 1, role: 'customer', text: openingMessage(scenario) },
  ];
  const rules = mockClassifier(scenario);
  const seen: CustomerGenerationContext[] = [];

  for (const line of lines) {
    const scripted: ScriptedLine = typeof line === 'string' ? { text: line } : line;
    const turnIndex = history.length + 1;
    const result = await processTraineeTurn({
      scenario,
      runtime,
      traineeText: scripted.text,
      turnIndex,
      history,
      ...(options.matching ? { matching: options.matching } : {}),
      classify: async (text, turn) => ({
        ...(await rules(text, turn)),
        ...scripted.classification,
      }),
      generate: (ctx) => {
        seen.push(ctx);
        return Promise.resolve({ text: scripted.reply ?? 'Okay.', source: 'live' });
      },
    });
    runtime = result.runtime;
    history.push(
      { index: turnIndex, role: 'trainee', text: scripted.text },
      { index: turnIndex + 1, role: 'customer', text: result.customerText },
    );
  }
  return seen;
}

// ---------------------------------------------------------------------------------------
// A call in which the engineer earns how many people are affected, and asks again

const COUNT_FACT: ScenarioInput['hiddenFacts'][number] = {
  id: 'hf-count',
  importance: 'important',
  label: 'How many people are affected',
  statement:
    "It isn't only me. I make it 27 people across sales and the executive office who can't sign in.",
  statementTerse: 'I make it 27 people, across sales and the executive office.',
  revealWhen: 'Asks how many people are affected, or who else is affected.',
  intents: ['affected_scope'],
  cues: ['how many', 'who else', 'who is affected', 'how many people'],
  missedConsequence: 'The scale of the problem stays unknown, so it is treated as one person.',
  betterQuestion: 'How many people are affected?',
};

// Another fact on the same topic, which the customer also gives when first asked who is affected.
const REST_WORKS_FACT: ScenarioInput['knownFacts'][number] = {
  id: 'kf-rest-works',
  text: 'Email and chat all work normally. It is only the sign-in that fails.',
  intents: ['problem_description', 'affected_scope'],
  cues: ['email', 'chat'],
};

export function makeScopeScenario(
  style: CommunicationStyle = 'talkative',
  startingTemperature: StartTemperature = 'calm',
): EffectiveScenario {
  return applyConfig(
    makeDefinition({
      checkableFacts: [],
      knownFacts: [...FIXTURE_INPUT.knownFacts, REST_WORKS_FACT],
      hiddenFacts: [...FIXTURE_INPUT.hiddenFacts, COUNT_FACT],
    }),
    { difficulty: 'standard', startingTemperature, style, curveballs: [] },
    { seed: 7, timeOfDay: 'morning' },
  );
}

/**
 * The engineer asks who is affected, and the customer gives the count and that the rest works. Then
 * the engineer asks about it twice more. A model that reads those questions says what they are
 * about and names no fact, because the count has been earned already.
 */
export const SCOPE_LINES: ScriptedLine[] = [
  {
    text: 'Who is affected, and are email and chat working for them?',
    classification: {
      askedQuestion: true,
      discoveryIntents: ['problem_description', 'affected_scope'],
      factTargets: [{ id: 'hf-count', strength: 'full' }],
    },
    reply: `${COUNT_FACT.statement} ${REST_WORKS_FACT.text}`,
  },
  {
    text: 'How many people does this affect?',
    classification: { askedQuestion: true, discoveryIntents: ['affected_scope'], factTargets: [] },
  },
  {
    text: 'How many people did you say are affected?',
    classification: { askedQuestion: true, discoveryIntents: ['affected_scope'], factTargets: [] },
  },
];
