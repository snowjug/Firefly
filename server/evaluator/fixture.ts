import type { ScenarioInput } from '#shared/domain/scenario.ts';
import type { EvaluationInput } from '#server/engine/types.ts';

// An inline, schema-valid Microsoft-shaped scenario for the evaluator tests. It is deliberately
// independent of the scenario library, which other people are rewriting, so these tests keep
// passing whatever the library holds. Everything in it is fictional: people, organisations and the
// case number. The product is real, and the customer describes only what she sees.
//
// Root cause (hidden from the trainee): the password change worked, but Maya's phone kept trying
// the OLD password in the background and the account locked after repeated failures.

export const FIXTURE_ID = 'entra-sign-in-lockout-after-password-change';

export const FIXTURE_SCENARIO = {
  id: FIXTURE_ID,
  version: 1,
  title: 'Locked out after a password change',
  listSummary:
    'A front-desk coordinator cannot sign in to her work account after changing her password.',
  summary:
    'A front-desk coordinator cannot sign in to her Microsoft work account after changing her password this morning. Her colleagues need the same account type for bookings.',
  tags: ['sign-in', 'password', 'single user'],
  estimatedMinutes: 8,

  product: { id: 'entra-id', area: 'Sign-in' },
  caseReference: 'SIM-482913',

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
      'Work laptop running Windows 11 with the usual browser',
      'Work email is also set up in a mail app on her personal phone',
      'Passwords expire every 90 days and staff get a reminder email',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Maya only' },
    medium: { count: 3, summary: 'Three people at the front desk' },
    high: { count: 12, summary: 'The whole front desk across two sites' },
  },
  customerObjective: 'Get back into her work account before the first appointments of the day.',
  customerExpectation: 'To be told what went wrong and to be back in quickly.',
  desiredOutcome:
    'The account is unlocked, the old password is removed from the phone and she can sign in.',
  previousTroubleshooting: [
    'Typed the new password about six times',
    'A colleague tried the new password on her own computer',
  ],
  recentChanges: ['Changed her password at about ten past eight this morning'],

  publicBrief: {
    issue: 'A coordinator cannot sign in after changing her password this morning.',
    impact: {
      low: 'One person is blocked and can still read mail on her phone.',
      medium: 'Three people at the front desk are blocked from bookings.',
      high: 'The whole front desk is blocked and patients are waiting.',
    },
    objective: 'Understand what is happening, then agree how she gets back in.',
    previousContact: 'A case was logged yesterday afternoon and no update was sent.',
  },
  brief: {
    situation:
      'A front-desk coordinator is calling because she cannot sign in to her work account. She is polite and a little worried about holding up her morning.',
    goal: 'Understand what is happening and why, then agree how she will get back in.',
    groundRules: [
      'The customer, organisation and case number are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
    ],
  },

  openingCore:
    "I can't sign in to my work account. It stopped letting me in after I changed my password this morning.",
  impactVariants: {
    low: {
      summary: "It's only me, but I can't start my morning tasks.",
      detail:
        "It's just my account. A colleague at the next desk can sign in fine, and I can still read messages on my phone, so it's more of a hold-up than an emergency.",
      deadline: 'I would like to be in before the first appointments at nine.',
    },
    medium: {
      summary: 'Three of us at the front desk are stuck, and we need our accounts for bookings.',
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
        "I called yesterday about not being able to sign in, and I haven't heard anything since.",
      brief: 'Maya called yesterday about the same problem and has not had an update.',
    },
    escalated: {
      opening:
        "This is my second call about being locked out. I was told it would be sorted and it isn't.",
      brief: 'Maya has contacted support twice about this problem without a resolution.',
    },
    closure: {
      opening: "I'm calling to check that my sign-in is all sorted so we can close this off.",
      brief: 'Maya expects to confirm that she can sign in and close the case.',
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
      id: 'vf-password-age',
      intents: ['recent_changes'],
      text: "I think it had been about three months since I last changed it, but I'm not sure.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-account-settings',
      intents: ['account_details'],
      text: "I don't know how the account settings are set up. That's our IT administrator.",
      whoKnows: 'our IT administrator',
    },
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
        "I'm sorry to rush you, but the first patients arrive at nine and I can't check anyone in without my account.",
      followUp:
        'Do you have any idea how long this will take? I need to tell the dentists something.',
      expectedResponse:
        'Acknowledge the time pressure, say what you can do right now, and give an honest time for the next update instead of promising a fix time.',
      minDifficulty: 'standard',
    },
  ],
  allowedCurveballs: ['deadline', 'ask-manager'],

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
    communicate: [
      'Introduces themselves by name and team and explains the lockout in everyday words.',
      'Checks that Maya has followed the explanation before moving on.',
    ],
    accountable: [
      'Takes ownership of getting the account unlocked and says when Maya will hear next.',
    ],
    resourceful: [
      'Asks what the sign-in screen says and which other devices or apps use the account.',
      'Asks what has already been tried before suggesting another reset.',
    ],
    empathetic: [
      'Acknowledges that the front desk is waiting on bookings before the nine o clock appointments.',
    ],
  },
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

/** The summary of the scenario library that a report uses to suggest what to practise next. */
export const FIXTURE_LIBRARY: EvaluationInput['library'] = [
  {
    id: FIXTURE_ID,
    title: 'Locked out after a password change',
    difficulty: 'starter',
    coachingFocus: ['scoping-discovery', 'clarity'],
  },
  {
    id: 'sharepoint-site-access-denied-for-a-team',
    title: 'A team is denied access to a shared site',
    difficulty: 'standard',
    coachingFocus: ['empathy-deescalation', 'ownership-next-steps'],
  },
  {
    id: 'azure-checkout-outage-before-a-launch',
    title: 'Checkout outage before a launch',
    difficulty: 'challenge',
    coachingFocus: ['empathy-deescalation', 'closing'],
  },
  {
    id: 'dynamics-report-export-missing',
    title: 'The report export option is missing',
    difficulty: 'starter',
    coachingFocus: ['clarity', 'opening-rapport'],
  },
];
