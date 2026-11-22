import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario (first contact). Everything here is fictional: people, organisation and case.
// Outlook is a real product, so the scenario describes only what the customer sees and was told,
// never how Outlook signs in or stores a password.
//
// Possible cause in the story (hidden from the trainee; plausible, never confirmed on the call):
// Fabrikam changed its email address format over the summer, and an old account entry stayed in
// Maeve's Outlook. She changed her password last Wednesday, as the company asked everyone to, and
// the prompts started the next morning. The box names her old address, so typing the new password may
// never settle it. Her mail works in Outlook on the web and on her phone, and Teams is fine. Two
// colleagues who changed their passwords the same day are fine. The company service desk had her
// restart everything, said they would look next week and told her to ring Microsoft. How many people
// have the prompts is the one fact that depends on the impact level (hf-others-fine carries byImpact
// wordings for medium and high, matching affectedUsers and impactVariants).
//
// Maeve is frustrated and terse, and answers exactly what she is asked. A strong call is brief and
// specific: it acknowledges the interruption, asks what the box says and what changed just before it
// began, scopes where it does and does not happen, finds what the service desk already did so that
// nothing is repeated, avoids guessing the cause or promising that the prompts will stop, and agrees an
// owner, a first step and a time for the next update.

const scenario = {
  id: 'outlook-keeps-asking-for-password',
  version: 1,
  title: 'Outlook keeps asking for a password',
  shortTitle: 'Outlook asking for password',
  listSummary:
    'A finance analyst says Outlook keeps asking for her password and is short of patience.',
  summary:
    'Maeve Fennelly is a finance analyst at Fabrikam. Outlook keeps asking for her password, and she has little patience for questions she thinks are obvious. She gives very little unless asked well. Find the story, show you are listening and agree what happens next.',
  tags: ['password prompt', 'sign-in', 'terse customer', 'frustrated customer', 'first contact'],
  estimatedMinutes: 10,

  product: { id: 'outlook', area: 'Sign-in prompts' },
  caseReference: 'SIM-410203',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-learn'],
    behaviourCheck: 'checked-partly',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read public Learn pages on repeated Outlook password prompts and stored sign-in details after a password change; they cover older Outlook builds, so current behaviour and the old-address story are unconfirmed. Split stage lines and tightened cues. AI-assisted review, not a mentor's.",
  },
  issueType: 'sign-in-access',
  impact: 'low',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'terse',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Maeve Fennelly',
    speaker: 'female',
    role: 'Finance Analyst',
    organisation: 'Fabrikam',
    background:
      'Maeve builds the monthly reports and forecasts for a manufacturing company, and she lives in Outlook and Excel. She is comfortable with everyday tools and has already tried the obvious fixes, so a basic question sounds to her like not being listened to.',
    voice:
      'Clipped and dry. Answers exactly what is asked and not a word more. Sceptical of questions she thinks are obvious, and quick to say she has already done that. Not rude, but visibly short of patience. Gives more when a question shows the engineer has listened.',
  },
  environment: {
    details: [
      'Maeve uses Outlook on a company Windows laptop for her work mail and calendar.',
      'She also uses Teams and OneDrive on the same laptop.',
      "The finance team closes the month on a fixed timetable, and Maeve's reports are due in the first working days.",
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Maeve only, as far as she knows.' },
    medium: {
      count: 4,
      summary: 'Four people in the finance team, who all changed their passwords last week.',
    },
    high: {
      count: 30,
      summary: 'Most of the finance department, about 30 people, in the middle of month-end close.',
    },
  },
  customerObjective:
    'Stop the password prompts, so that she can work without being interrupted and does not have to chase the service desk again.',
  customerExpectation:
    'Someone who asks sharp, specific questions instead of reading a script, takes charge of the case and says when she will hear back.',
  desiredOutcome:
    'Maeve knows what will be checked first and who is doing it, has a way to keep working in the meantime, and knows when she will hear back.',
  previousTroubleshooting: [
    'Maeve typed her password into the prompt every time, and ticked the box to remember it.',
    'Maeve closed and reopened Outlook, and restarted her laptop.',
    'Maeve was told by the company service desk to restart everything, and that it would look at it next week. It then told her to ring Microsoft.',
  ],
  recentChanges: [
    'Maeve changed her password last Wednesday, after the company asked everyone to.',
    'The company changed its email address format over the summer.',
  ],

  publicBrief: {
    issue:
      "Maeve's Outlook keeps asking her to sign in with her password, even after she types it.",
    impact: {
      low: 'One person is interrupted all day by the prompts, but she can still work.',
      medium: 'Several people in her team are interrupted all day by the same prompts.',
      high: 'A whole department keeps being interrupted in the middle of month-end close.',
    },
    objective:
      'Draw out the story with short, specific questions, and agree what happens next, with a time.',
    knownContext:
      'Maeve Fennelly is a finance analyst at Fabrikam. She is short of patience, answers briefly and does not like being asked things twice.',
    environment:
      'Maeve uses Outlook on a company laptop for her work mail and calendar. You cannot see her laptop in this practice call.',
  },
  brief: {
    situation:
      'A finance analyst is calling because Outlook keeps asking for her password. She is short on patience and gives very little unless she is asked well.',
    goal: 'Ask short, specific questions to get the story, show that you are listening, and agree a clear next step and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer gives short answers and will not volunteer much.',
      'You cannot see her laptop in this practice call, so rely on what she tells you.',
    ],
  },

  openingCore:
    'Outlook keeps asking me for my password. I type it in and a bit later it asks again.',
  impactVariants: {
    low: {
      summary: "It's only me, but it's a real nuisance.",
      detail: "The box pops up every few minutes, and I can't get through a report without it.",
      deadline: "I'd like it gone before month-end close starts next week.",
    },
    medium: {
      summary: "It's not just me. Several of us in finance have it.",
      detail:
        "There are four of us now, all in finance. We keep being interrupted when we're trying to get the reports out.",
      deadline: 'We need it sorted before month-end close on Monday.',
    },
    high: {
      summary: "Most of the finance department has it, and we're in the middle of month-end close.",
      detail:
        "It's about thirty of us, the whole department. Nobody can get through the close without the box popping up.",
      deadline: 'We need it sorted today, or the close will slip.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I called a few days ago about Outlook asking for my password all the time. Nobody has been in touch.',
      brief:
        'Maeve called a few days ago about Outlook asking for her password. A case was logged, and she has had no update.',
    },
    escalated: {
      opening:
        "This is my second call about Outlook asking for my password. It's still doing it, and I've already explained it once.",
      brief:
        'Maeve has called twice about the prompts. They are still happening, and she is short of patience.',
    },
    closure: {
      opening:
        "I'm ringing about the Outlook password prompts. They've stopped, so I wanted to check with you before the case is closed.",
      brief:
        'Maeve expects to confirm that the prompts have stopped and to know what to do if they come back.',
    },
  },
  priorHistory: [
    {
      when: 'A few days ago',
      summary:
        'Maeve called to say Outlook kept asking for her password. A case was logged and no update has been sent.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-prompt',
      text: "Outlook asks me for my password. I type it in and it's fine for a bit, then it asks again.",
      intents: ['problem_description', 'error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration:
        "It's a box with a little padlock picture. It's come up about twenty times today.",
      simple:
        'Outlook asks me for my password. I type it in. It is fine for a bit, then it asks again.',
    },
    {
      id: 'kf-prompt-stopped',
      text: "The prompts seem to have stopped. I haven't had one for a day or two.",
      intents: ['problem_description', 'error_message'],
      stages: ['closure'],
      simple: 'The prompts seem to have stopped. I have not had one for a day or two.',
    },
    {
      id: 'kf-few-days',
      text: "It's been going on for a few days now.",
      intents: ['timing_onset'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'It has been going on for a few days now.',
    },
    {
      id: 'kf-laptop',
      text: "It's on my work laptop. Windows, in the office.",
      intents: ['environment'],
      simple: 'It is on my work laptop. Windows, in the office.',
    },
    {
      id: 'kf-bottom-message',
      text: 'At the bottom of the Outlook window it says it needs a password.',
      intents: ['error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      cues: [
        'bottom',
        'status bar',
        'corner',
        'anywhere else',
        'elsewhere on the screen',
        'on the screen',
      ],
      simple: 'At the bottom of the Outlook window it says it needs a password.',
    },
    {
      id: 'kf-one-account',
      text: 'Just my work one, as far as I know.',
      intents: ['account_details'],
      cues: [
        'more than one',
        'other account',
        'another account',
        'second account',
        'other email',
        'multiple accounts',
        'other mailbox',
      ],
      simple: 'Just my work one, as far as I know.',
    },
    {
      id: 'kf-rang-before',
      text: 'I called about this before, and a case was logged.',
      intents: ['previous_contact'],
      stages: ['follow-up', 'escalated', 'closure'],
      simple: 'I called about this before, and a case was logged.',
    },
    {
      id: 'kf-outcome',
      text: 'I want it to stop asking, so I can get on with my work.',
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'I want it to stop asking, so I can get on with my work.',
    },
    {
      id: 'kf-outcome-closure',
      text: 'I want to be sure it stays stopped, so I can get on with my work.',
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple: 'I want to be sure it stays stopped, so I can get on with my work.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-how-often',
      intents: ['reproducibility', 'timing_onset'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      cues: [
        'how often',
        'how frequently',
        'every time',
        'when you first',
        'when you start',
        'when you open',
        'start outlook',
        'open outlook',
        'after the laptop',
        'in the morning',
        'certain times',
      ],
      text: "Every few minutes, I think. Maybe every half hour. It's irritating whichever.",
      confirmedText:
        "It always comes up when I first open Outlook in the morning, and again after the laptop's been asleep.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-why',
      intents: ['problem_description', 'recent_changes'],
      cues: [
        'why is it',
        'why does it',
        'why it',
        'what is causing',
        "what's causing",
        'the cause',
        'the reason',
        'root cause',
      ],
      stages: ['first-contact', 'follow-up', 'escalated'],
      text: "I've no idea why it's doing it. That's why I'm ringing.",
    },
    {
      id: 'uf-why-closure',
      intents: ['problem_description', 'recent_changes'],
      cues: [
        'why is it',
        'why does it',
        'why did it',
        'why it',
        'what was causing',
        'what caused',
        'the cause',
        'the reason',
        'root cause',
      ],
      stages: ['closure'],
      text: "I've no idea why it was doing it. Nobody has told me.",
    },
    {
      id: 'uf-sign-in-setup',
      intents: ['environment', 'account_details'],
      cues: [
        'sign-in settings',
        'authentication',
        'multifactor',
        'two-step',
        'extra check',
        'policy',
        'conditional',
        'modern',
      ],
      text: "I couldn't tell you how our sign-in is set up. The service desk would know.",
      whoKnows: 'our service desk',
    },
    {
      id: 'uf-which-outlook',
      intents: ['environment'],
      cues: ['which version', 'what version', 'which outlook', 'new outlook', 'classic'],
      text: "I don't know which kind of Outlook it is. It's whatever the service desk installed.",
      whoKnows: 'our service desk',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-timetable',
      text: 'Our month-end timetable changed again this quarter, which has made everyone short with each other.',
    },
    { id: 'if-milk', text: 'The kitchen on our floor has been out of milk since Monday.' },
  ],

  hiddenFacts: [
    {
      id: 'hf-old-address',
      importance: 'critical',
      label: 'The box shows an old email address',
      knowledge: 'after-checking',
      checking: "Hang on, I'll read out what it says.",
      statement:
        "It shows my old email address, the one from before we changed our addresses over the summer. I don't use that one any more.",
      revealWhen:
        'Asks what the sign-in box says, which email address or account it shows, or what exactly she sees.',
      intents: ['error_message'],
      cues: [
        'what does the box',
        'what does the prompt',
        'what does the message',
        'what does it show',
        'what does it say',
        'which email',
        'what email',
        'which account is',
        'which account does',
        'wording',
        'read out',
        'what name is',
      ],
      hint: "The box looks a bit odd, though I haven't paid much attention to the details.",
      statementTerse: 'It shows my old email address, from before the summer change.',
      statementSimple:
        'The box shows my old email address, from before we changed our addresses in the summer. I do not use that address any more.',
      missedConsequence:
        'What the box actually names is never asked, so the one clue to what is going on stays hidden, and the case turns to generic fixes.',
      betterQuestion: 'What does the box say, and which email address does it show?',
    },
    {
      id: 'hf-after-password-change',
      importance: 'important',
      label: 'It began after her password change',
      statement:
        'I changed my password last Wednesday, because the company made everyone. The prompts started the next morning.',
      revealWhen:
        'Asks whether anything changed just before the prompts began, including her password or account.',
      intents: ['recent_changes', 'timing_onset'],
      cues: [
        'change',
        'reset',
        'new password',
        'anything different',
        'just before',
        'before it started',
        'before it began',
        'anything new',
        'anything happen',
        'what happened before',
      ],
      hint: 'It was all fine until sometime last week.',
      statementTerse: 'Changed my password last Wednesday. Prompts started the next morning.',
      statementSimple:
        'I changed my password last Wednesday, because the company asked everyone to. The prompts started the next morning.',
      missedConsequence:
        'The timing is missed, so the engineer never learns that the prompts began right after a password change, which is the natural place to start looking.',
      betterQuestion:
        'Did anything change just before the prompts started, for example your password?',
    },
    {
      id: 'hf-web-fine',
      importance: 'important',
      label: 'Mail works in the browser and Teams is fine',
      statement:
        "Outlook on the web is fine with my password. So is the mail on my phone, and Teams. It's only the Outlook app on my laptop.",
      revealWhen:
        'Asks whether the same thing happens in the web version, on her phone or in other apps such as Teams.',
      intents: ['workaround', 'affected_scope', 'environment'],
      cues: [
        'web version',
        'on the web',
        'in the browser',
        'in a browser',
        'on your phone',
        'on a phone',
        'on mobile',
        'in teams',
        'other apps',
        'other device',
        'another device',
        'webmail',
      ],
      hint: "I can get at my mail some other way, so it's not that my password is wrong.",
      statementTerse: "Web version's fine. Phone's fine. Teams is fine. Only the app.",
      statementSimple:
        'Outlook on the web works with my password. The mail on my phone works too, and so does Teams. Only the Outlook app on my laptop has the problem.',
      missedConsequence:
        'The engineer never learns that her account works everywhere except the app on her laptop, so the search stays on her account and password instead of on that one app.',
      betterQuestion: 'Does the same thing happen in the web version, on your phone or in Teams?',
    },
    {
      id: 'hf-service-desk-tried',
      importance: 'important',
      label: 'The service desk sent her on',
      statement:
        "Our service desk had me restart everything and said they'd look at it next week. Then they told me to ring Microsoft.",
      revealWhen:
        'Asks whether she has spoken to anyone in her company about it, or what her own IT or service desk did.',
      intents: ['previous_contact', 'already_tried'],
      cues: [
        'service desk',
        'it team',
        'it department',
        'help desk',
        'helpdesk',
        'your it',
        'spoken to anyone',
        'talked to anyone',
        'who have you',
        'contacted anyone',
        'raised it',
        'reported it',
      ],
      statementTerse:
        'Service desk had me restart everything. Said next week. Told me to ring you.',
      statementSimple:
        'Our service desk had me restart everything. They said they would look at it next week. Then they told me to call Microsoft.',
      missedConsequence:
        'The engineer repeats what her service desk already did and never learns they sent her on, so she feels unheard and the case starts from nothing.',
      betterQuestion: 'Have you spoken to anyone at your company about it, and what did they do?',
    },
    {
      id: 'hf-others-fine',
      importance: 'important',
      label: 'Others who changed passwords are fine',
      statement:
        "From what I can tell it's only me. Two others in finance changed their passwords the same day, and they're fine.",
      revealWhen:
        'Asks whether anyone else has the same prompts, how many people are affected, or whether colleagues are fine.',
      intents: ['affected_scope'],
      cues: [
        'anyone else',
        'anybody else',
        'your colleagues',
        'other colleagues',
        'who else',
        'how many people have',
        'how many people are affected',
        'how many of you',
        'only you',
        'just you',
        'same problem',
        'everyone else',
      ],
      byImpact: {
        medium: {
          statement:
            "It's four of us in finance now. Others changed their passwords that day and they're fine, so it isn't everyone.",
          statementTerse: 'Four of us. Others who changed theirs are fine.',
          statementSimple:
            'It is four of us in finance now. Other people changed their passwords that day and they are fine, so it is not everyone.',
        },
        high: {
          statement:
            "It's most of finance. A few people changed their passwords that day and they're fine, so it isn't everyone.",
          statementTerse: 'Most of finance. A few who changed theirs are fine.',
          statementSimple:
            'It is most of finance. A few people changed their passwords that day and they are fine, so it is not everyone.',
        },
      },
      statementTerse: "Only me, as far as I can tell. Two others changed theirs and they're fine.",
      statementSimple:
        'I think it is only me. Two other people in finance changed their passwords the same day, and they are fine.',
      missedConsequence:
        'It never comes out that colleagues who changed their passwords the same day are fine, which points to something specific to her setup, so the call treats it as a general sign-in fault.',
      betterQuestion: 'Is anyone else getting the same prompts, and what do you have in common?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-account-fault',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        "I think Microsoft has broken something on my account. I'm typing the right password every time.",
      truth:
        'Nothing confirms a fault in the service or the account. In this story the box names an address her mail no longer uses, so typing the right password for her current address may never settle it.',
    },
  ],

  curveballs: [
    {
      id: 'cb-seen-this-before',
      type: 'challenge-credibility',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        "Have you actually dealt with this before? Because our service desk clearly hadn't.",
      followUp: "I just need to know I'm talking to someone who knows what they're doing.",
      expectedResponse:
        'Stay calm and factual, and do not claim experience you cannot show or get defensive. Say what you will do for her, show that you have listened by using what she has told you, and offer to bring in a colleague if she would like that.',
      minDifficulty: 'standard',
      effects: { temperature: 6, trust: -6 },
    },
    {
      id: 'cb-goes-quiet',
      type: 'go-silent',
      trigger: { earliestTurn: 5, latestTurn: 9, whenTemperatureAtLeast: 45 },
      statement: 'Hm. Right. Go on.',
      followUp: "Sorry. I'm still here.",
      expectedResponse:
        'Notice the silence, check in gently with a short open question, and avoid filling the gap with a list of steps.',
      minDifficulty: 'standard',
      effects: { patience: -4 },
    },
  ],
  allowedCurveballs: [
    'challenge-credibility',
    'go-silent',
    'ask-manager',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'What the box says',
    'When it started and what changed',
    'Where it happens and where it does not',
    'Who else has it',
    'What she and her service desk have tried',
    'What she needs by when',
  ],
  successCriteria: [
    'Opens with a brief acknowledgement of the interruption and one focused question, rather than a script.',
    'Asks what the box says and which address it shows, and what changed just before the prompts began.',
    'Finds where it does and does not happen, for example in the web version, on her phone and in Teams, and who else has it.',
    'Finds what the service desk already did, so that nothing is repeated.',
    'Avoids guessing why it happens, and does not promise that the prompts will stop.',
    'Agrees an owner, a first step and a time for the next update, and summarises it briefly.',
  ],
  coachingFocus: ['scoping-discovery', 'empathy-deescalation', 'ownership-next-steps'],
  careExpectations: {
    communicate: [
      'Asks one short, specific question at a time and plays back what she says, so that she knows it was heard.',
      'Keeps the language plain and avoids jargon such as "credentials" or "authentication" unless she uses it first.',
    ],
    accountable: [
      'Says early that they will own the case, names the first thing they will do and gives a specific time for the next update.',
      'Does not say why the prompts happen, or promise that they will stop, before the facts are in.',
    ],
    resourceful: [
      'Asks what the box says and what changed just before it began, instead of starting with generic steps.',
      'Finds where it does and does not happen, for example in the web version or on her phone, to narrow the search.',
    ],
    empathetic: [
      'Acknowledges the interruption and the month-end pressure in specific words, without over-apologising.',
      'Does not take her short answers or her impatience personally, and does not ask for the same thing twice.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Starting with "have you tried restarting?" when she has already done that, which tells her she is not being heard.',
    'Reading out a long list of steps before finding out what she sees and when it began.',
    'Telling her it is probably her password, or that her account is locked, without any evidence.',
    'Asking several questions at once, so that she answers only the last one.',
    'Ending with "I will look into it" and no named person or time.',
  ],
  goodBehaviours: [
    'Acknowledging the interruption in one sentence, then asking a single focused question.',
    'Asking what the box says and which address it shows.',
    'Asking what changed just before it started, including her password.',
    'Asking where it does and does not happen, for example in a browser, on her phone or in Teams.',
    'Finding out what her service desk has already done, so that nothing is repeated.',
    'Agreeing a first step, an owner and a time for the next update.',
  ],
  expectedOutcome:
    'Maeve has been heard and has not been asked to repeat herself. The engineer has found that the prompts began after her password change, that the box names an old address, that the web version, her phone and Teams are fine, and what her service desk already tried. A first step, an owner and a time for the next update are agreed, without promising that the prompts will stop.',
  evaluatorNotes:
    "Possible cause in the story (hidden, plausible, not confirmed on the call): when Fabrikam changed its email address format over the summer, an old account entry stayed in Maeve's Outlook. Her password change last Wednesday may have left that old entry unable to sign in, so Outlook keeps asking. Her main mailbox, Outlook on the web, her phone and Teams all work. A strong call is brief and specific, asks what the box says and what changed, scopes where it does and does not happen, and agrees an owner, a first step and a time without guessing the cause.",
} satisfies ScenarioInput;

export default scenario;
