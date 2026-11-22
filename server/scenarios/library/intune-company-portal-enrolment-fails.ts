import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario (first contact). Everything here is fictional: people, organisation and case.
// Microsoft Intune is a real product, so the scenario describes only what the customer sees and was
// told, never how Intune works.
//
// Root cause in the story (hidden from the trainee; plausible, never confirmed on the call): Federica
// started two weeks ago as a seasonal accounts assistant. Her company laptop has not arrived, so she
// is setting up her own iPhone for work. She is following a list of steps that Emil, who also works
// in accounts, sent in the team chat; he wrote it last year for the company phones. The first step on
// the list asks IT to add the phone to a list before starting, which makes sense for a company phone.
// Federica skipped it, because the phone is hers and she does not know who IT is. A circle then turns
// for a long time and the app says that something went wrong. She has tried five times, at the
// office and at home, and has taken the app off and put it back. Nobody has told her whether personal
// phones are allowed, and the call cannot show that, which step matters or what her company's rules
// say. In the story it is her own organisation's administrator who knows which steps apply to a
// personal phone. Emil says that it worked for him last year. The scenario never says that the
// Company Portal asks who owns a phone: public pages say ownership follows how a device is enrolled.
//
// Federica is calm, careful and new, and English is her second language. A strong call uses short
// plain sentences and checks that she has understood, never makes the language the problem, finds that
// it is her own phone and where the list came from, finds which steps she followed without leading
// her, does not ask her to keep trying or to remove anything, says who can say what applies to her
// phone, gives her one sentence to pass on, promises no time, and agrees when she will hear next.

const scenario = {
  id: 'intune-company-portal-enrolment-fails',
  version: 1,
  title: 'Company Portal enrolment fails when setting up a device for work',
  shortTitle: 'Company Portal enrolment fails',
  listSummary:
    'An accounts assistant cannot finish setting up her device for work with the Company Portal app.',
  summary:
    'Federica Ruggeri is an accounts assistant at Alpine Ski House. She is setting up a device for work with the Company Portal app, and it does not finish. English is her second language, so simple words and checking she has understood will help. Find out what she has done and agree what happens next.',
  tags: ['device setup', 'Company Portal', 'non-native speaker', 'plain language', 'first contact'],
  estimatedMinutes: 9,

  product: { id: 'intune', area: 'Device enrolment' },
  caseReference: 'SIM-410403',
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
      "Re-read current Learn pages on iOS enrolment, enrolment restrictions and enrolment troubleshooting. Ownership follows how a device is enrolled, so the screen asking who owns the phone was removed. Why setup fails is the story's own. AI-assisted review, not a mentor's.",
  },
  issueType: 'setup-deployment',
  impact: 'low',
  startingTemperature: 'calm',
  proficiency: 'novice',
  style: 'non-native',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Federica Ruggeri',
    speaker: 'female',
    role: 'Accounts Assistant',
    organisation: 'Alpine Ski House',
    background:
      'Federica joined the accounts team two weeks ago for the winter season. She is careful and organised, and comfortable with spreadsheets and the accounting system. She has not set up a phone for work before. She works in English every day, but it is her second language.',
    voice:
      'Polite and careful. Uses short, simple sentences and everyday words, and avoids idioms. Sometimes asks the engineer to say a word again or to explain it, and repeats back what she has understood to check. Calm and patient, and glad when things are explained step by step.',
  },
  environment: {
    details: [
      'Federica works in the accounts office at the resort, mainly on the accounting system and spreadsheets.',
      'She joined two weeks ago for the winter season, along with a number of other new seasonal staff.',
      'The company manages its devices with a central tool, and a small team looks after it.',
      'She is using the Company Portal app, which she got from the app store.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Federica only, as far as she knows.' },
    medium: {
      count: 4,
      summary: 'Four new seasonal staff who were sent the same list, two of them stuck.',
    },
    high: {
      count: 25,
      summary: 'About twenty-five new seasonal staff who were sent the same list.',
    },
  },
  customerObjective:
    'Finish setting up her device for work, so that she can see her work email and the rota on it.',
  customerExpectation:
    'Someone who explains in plain, simple words what is going on, takes ownership, and says when she will hear back.',
  desiredOutcome:
    'Federica understands in simple words what the next step is and who has to answer it, knows what to tell them, and does not keep trying again and again in the meantime. She knows when she will hear back.',
  previousTroubleshooting: [
    'Federica tried the setup five times, at the office and at home.',
    'She removed the Company Portal app and installed it again, with the same result.',
  ],
  recentChanges: [
    'Federica joined two weeks ago, and her company laptop has not arrived yet.',
    'A colleague sent her a list of steps to follow.',
  ],

  publicBrief: {
    issue: 'Federica cannot finish setting up her device for work with the Company Portal app.',
    impact: {
      low: 'Federica cannot see her work email on her device yet, but nothing is urgent.',
      medium: 'Setting up devices for work is holding people up, and some need them this week.',
      high: 'Setting up devices for work is holding people up, and the season opens soon.',
    },
    objective:
      'Use simple words, check she has understood, find out what she has tried, and agree the next step.',
    knownContext:
      'Federica speaks English as a second language and is new to the company. Simple words, and checking that she has understood, will help.',
    environment:
      'Federica is using the Company Portal app. Her company manages its devices with Intune. You cannot see her device in this call.',
  },
  brief: {
    situation:
      'An accounts assistant who is new to the company is calling because the Company Portal app will not finish setting up her device for work. English is her second language, and she is calm and polite.',
    goal: 'Find out what she has done and what she sees, using simple words and checking that she has understood, and agree what happens next and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'You cannot see her device in this practice call, so rely on what she tells you.',
      'Ask questions to find out what you need; she answers what she is asked and will not volunteer everything.',
      'Her English is not the problem: use simple words and be patient, and do not make her feel that her English is the difficulty.',
    ],
  },

  openingCore:
    'I am trying to set up my phone for work with the Company Portal app. It starts, but it does not finish.',
  impactVariants: {
    low: {
      summary: 'I cannot see my work email on my phone yet, but it is not urgent.',
      detail:
        'As far as I know, it is only me. I can use the computer at the office, so I can still work there. Email on my phone is the part I am missing.',
      deadline:
        'There is no rush today, but my manager would like it ready by the end of the week.',
    },
    medium: {
      summary:
        'I cannot finish setting up my phone for work, and some of the other new people cannot either.',
      detail:
        'There are four of us who are new this season. Two of us got stuck at the same point, and the others have not tried yet.',
      deadline: 'We would like it ready before the staff meeting on Thursday.',
    },
    high: {
      summary: 'Many of the new seasonal staff cannot set up their phones for work.',
      detail:
        'About twenty-five of us are new this season. Some of us got stuck, and the manager has been asking about the rota on our phones.',
      deadline: 'The season opens on Thursday, and everyone must see the rota on their phone.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I called before about setting up my phone for work with the Company Portal app. It still does not finish, and I have not heard anything.',
      brief:
        'Federica called before about the Company Portal app not finishing the setup of her device. She has not had an update.',
    },
    escalated: {
      opening:
        'This is my second call about setting up my phone for work. It still does not work, and I do not know what to do next.',
      brief:
        'Federica has called once already and still cannot finish the setup. She is calm and polite, but she wants to know what happens next.',
    },
    closure: {
      opening:
        'I am calling about setting up my phone for work. I think it is working now, and I want to check before you close the case.',
      brief:
        'This is a closure call. Federica thinks the setup now works and wants to be sure, and to understand what was wrong, before the case closes.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier this week',
      summary:
        'Federica phoned about the Company Portal app not finishing the setup of her device for work. A case was opened and she was told someone would look at it.',
    },
    {
      when: 'Since then',
      summary: 'She tried again with the same result. No engineer has been assigned.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: 'I am trying to set up my phone for work with the Company Portal app. It starts, but it does not finish.',
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration: 'A circle goes round and round for a long time. Then I have to start again.',
      simple:
        'I try to set up my phone for work with the Company Portal app. It starts, but it does not finish.',
    },
    {
      id: 'kf-problem-closure',
      text: 'I was trying to set up my phone for work with the Company Portal app, and it did not finish. I think it is working now, and I would like to know what was wrong.',
      intents: ['problem_description'],
      stages: ['closure'],
      simple:
        'I tried to set up my phone for work with the Company Portal app, and it did not finish. I think it works now. I would like to know what was wrong.',
    },
    {
      id: 'kf-new',
      text: 'I started at the company two weeks ago, for the winter season. I work in accounts.',
      intents: ['environment', 'account_details'],
      cues: [
        'when did you start',
        'when did you join',
        'how long have you',
        'are you new',
        'which team',
        'what team',
      ],
      simple: 'I started at the company two weeks ago, for the winter season. I work in accounts.',
    },
    {
      id: 'kf-app',
      text: 'I got the Company Portal app from the app store. I signed in with my work email address and my password.',
      intents: ['environment', 'already_tried'],
      cues: [
        'where did you get',
        'where did you download',
        'installed',
        'downloaded',
        'which app',
        'signed in',
      ],
      simple:
        'I got the Company Portal app from the app store. I signed in with my work email address and my password.',
    },
    {
      id: 'kf-first-time',
      text: 'No. It is the first time I set up a phone for work.',
      intents: ['reproducibility'],
      cues: ['happened before', 'before', 'first time', 'done this before', 'ever'],
      simple: 'No. It is the first time I set up a phone for work.',
    },
    {
      id: 'kf-phone-type',
      text: 'It is an iPhone.',
      intents: ['environment'],
      cues: [
        'iphone',
        'android',
        'what phone',
        'which phone',
        'what kind of phone',
        'what type of phone',
        'which model',
      ],
      simple: 'It is an iPhone.',
    },
    {
      id: 'kf-office-computer',
      text: 'I can use the computer at the office for my work. Only the phone does not work.',
      intents: ['workaround'],
      cues: [
        'in the meantime',
        'work around',
        'workaround',
        'what can you do',
        'can you still',
        'manage without',
      ],
      simple: 'I can use the computer at the office for my work. Only the phone does not work.',
    },
    {
      id: 'kf-outcome',
      text: 'I want my work email on my phone, so I can see messages from my manager and the rota.',
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple:
        'I want my work email on my phone. I want to see messages from my manager and the rota.',
    },
    {
      id: 'kf-outcome-closure',
      text: 'I want to be sure it works, and I want to know what to do if it stops.',
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple: 'I want to be sure it works. I want to know what to do if it stops.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-when',
      intents: ['timing_onset'],
      cues: ['when did', 'since when', 'how long', 'when did you first', 'when was'],
      text: 'I think I started to try on Monday or Tuesday.',
      confirmedText: 'It was Tuesday, after work. I have tried a few times since then.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-message',
      intents: ['error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      checking: 'One moment, please. I will open the app and read it.',
      text: 'It says something went wrong, and I should try again later. There is no other message.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-allowed',
      intents: ['account_details', 'environment'],
      cues: [
        'allowed',
        'permitted',
        'policy',
        'rules',
        'does the company allow',
        'personal phones',
        'supports',
      ],
      text: 'I do not know what the company allows for this. Nobody told me.',
      whoKnows: 'our IT administrator',
    },
    {
      id: 'uf-who-it',
      intents: ['account_details'],
      cues: [
        'who looks after',
        'who manages',
        'it team',
        'administrator',
        'it person',
        'who is your it',
        'who runs',
      ],
      text: 'I do not know who looks after the devices here. It is a small office, and I never met an IT person.',
      whoKnows: 'my manager',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-bus',
      text: 'I take the bus to work, and it takes forty minutes, so I try to do these things on the bus.',
    },
    {
      id: 'if-view',
      text: 'The office has a nice view of the mountains, but the coffee machine is always broken.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-own-phone',
      importance: 'critical',
      label: 'It is her own phone, not a company one',
      statement: 'It is my own phone. I bought it last year, and the company did not give me one.',
      revealWhen: 'Asks whether the device belongs to her or to the company, or whose phone it is.',
      intents: ['environment', 'account_details'],
      cues: [
        'your own',
        'personal',
        'company phone',
        'company-owned',
        'belong',
        'whose',
        'who owns',
        'yours or',
        'did the company give',
        'work phone',
        'own phone',
        'private',
      ],
      hint: 'It is the phone I already had.',
      statementTerse: 'My own phone. Not from the company.',
      statementSimple:
        'It is my own phone. I bought it myself. The company did not give me a phone.',
      missedConsequence:
        'The engineer never learns that the phone is her own, so the steps and the advice assume a company phone, and the real question, whether personal phones are allowed, is never asked.',
      betterQuestion: 'Is the phone your own, or was it given to you for work?',
    },
    {
      id: 'hf-instruction-list',
      importance: 'important',
      label: 'She uses a list from a colleague',
      statement:
        'I am following a list of steps from Emil, who also works in accounts. He sent it in the team chat, and he wrote it last year for the company phones.',
      revealWhen:
        'Asks where she got the instructions she is following, or who told her to do it this way.',
      intents: ['already_tried', 'previous_contact'],
      cues: [
        'instructions',
        'guide',
        'the list',
        'where did you get',
        'who told you',
        'who sent',
        'who wrote',
        'document',
        'steps are you following',
        'steps you are following',
        'what are you following',
        'tutorial',
      ],
      hint: 'I have a list of steps from a colleague.',
      statementTerse: 'A list from Emil, in accounts. He wrote it last year, for company phones.',
      statementSimple:
        'I follow a list of steps from Emil. He also works in accounts. He sent it in the team chat. He wrote it last year, for the company phones.',
      missedConsequence:
        'The engineer never learns where the steps came from, so nobody checks whether they were written for her kind of phone, and she keeps repeating them.',
      betterQuestion: 'Where did you get the steps you are following, and who wrote them?',
    },
    {
      id: 'hf-first-step',
      importance: 'important',
      label: 'She skipped the first step on the list',
      statement:
        'The first step on the list says IT must add the phone to a list before I start. I did not ask IT, because the phone is mine and I do not know who IT is.',
      revealWhen:
        'Asks which steps on the list she followed, whether she left any out, or whether any step was unclear.',
      intents: ['already_tried', 'reproducibility'],
      cues: [
        'which steps',
        'which of the steps',
        'every step',
        'all the steps',
        'first step',
        'skip',
        'missed any',
        'miss any',
        'left out',
        'not sure about',
        'step by step',
        'walk me through',
      ],
      statementTerse: 'Step one says IT must add the phone first. I did not ask IT.',
      statementSimple:
        'The first step on the list says that IT must add the phone to a list. I must do this before I start. I did not ask IT. The phone is mine, and I do not know who IT is.',
      missedConsequence:
        'The engineer never finds the step meant for company phones that she skipped, so nobody can tell her organisation what she did and did not follow.',
      betterQuestion:
        'Which of the steps have you done, and was there any step you skipped or were not sure about?',
    },
    {
      id: 'hf-colleague-worked',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'A colleague did this last year',
      statement:
        'Emil did it last year, and he says it worked. I have not asked anyone else, so I do not know if others have the same problem.',
      byImpact: {
        medium: {
          statement:
            'Emil did it last year, and he says it worked. Three other new people had the list on Monday, and one of them says it fails for her too.',
          statementTerse:
            'Emil says it worked last year. One of three other new people is stuck too.',
          statementSimple:
            'Emil did it last year. He says it worked. Three other new people had the list on Monday. One of them says it does not work for her too.',
        },
        high: {
          statement:
            'Emil did it last year, and he says it worked. About twenty-five new people have the list, and I heard that some of them are stuck too.',
          statementTerse: 'Emil says it worked last year. Some of the new people are stuck too.',
          statementSimple:
            'Emil did it last year. He says it worked. About twenty-five new people have the list. I heard that some of them are stuck too.',
        },
      },
      revealWhen:
        'Asks whether anyone else has managed it, or whether other people have the same problem.',
      intents: ['affected_scope'],
      cues: [
        'anyone else',
        'anybody else',
        'someone else',
        'other people',
        'how many people',
        'everyone',
        'your colleagues',
        'the others',
        'same problem',
        'managed it',
        'worked for',
        'affected',
      ],
      statementTerse: 'Emil says it worked last year. I have not asked anyone else.',
      statementSimple:
        'Emil did it last year. He says it worked. I did not ask anyone else. I do not know if others have the same problem.',
      missedConsequence:
        'The engineer treats it as one person with one phone, and misses that others with the same list may be stuck, which her organisation would want to know.',
      betterQuestion: 'Has anyone else set up their phone this way, and did it work for them?',
    },
    {
      id: 'hf-tried-again',
      importance: 'helpful',
      label: 'She has made several attempts already',
      statement:
        'I tried five times, at the office and at home. I even took the app off and put it back, and the same thing happens.',
      revealWhen: 'Asks what she has already tried.',
      intents: ['already_tried'],
      cues: [
        'tried',
        'attempt',
        'what have you done',
        'so far',
        'reinstall',
        'restart',
        'how many times',
      ],
      statementTerse: 'Five times, at the office and at home. I put the app back. The same.',
      statementSimple:
        'I tried five times, at the office and at home. I removed the app and put it back. The same thing happens.',
      missedConsequence:
        'The engineer asks her to repeat steps she has already done, which wastes her time and makes her feel unheard.',
      betterQuestion: 'What have you already tried, and what happened each time?',
    },
    {
      id: 'hf-laptop-coming',
      importance: 'helpful',
      label: 'Her company laptop is not here yet',
      statement:
        'My manager, Maren, said my company laptop will come next week. She did not say what to use until then, so I tried my phone.',
      revealWhen:
        'Asks why she is setting this up now, or whether she has another device for work.',
      intents: ['recent_changes', 'environment'],
      cues: [
        'why now',
        'why are you setting',
        'another device',
        'other device',
        'company laptop',
        'work laptop',
        'work computer',
        'when will you get',
        'what do you use at work',
      ],
      statementTerse: 'My company laptop comes next week. I tried my phone until then.',
      statementSimple:
        'My manager, Maren, said my company laptop will come next week. She did not say what to use before that. So I tried my phone.',
      missedConsequence:
        'The engineer misses why she is using her phone, and the laptop that may make the whole question easier.',
      betterQuestion:
        'Why are you setting this up on your phone now, and do you have another device for work?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-list-correct',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement: 'I think the list is correct, because Emil did it and it worked for him.',
      truth:
        "In this story the list was written last year for company-owned phones. It may not fit her phone, and nothing here says that it is wrong in itself. Her organisation's own administrator can say which steps apply to a personal phone.",
    },
  ],

  curveballs: [
    {
      id: 'cb-by-thursday',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 8, whenImpactUnacknowledged: true },
      statement:
        'I forgot to say. My manager wants my work email on my phone before Thursday. Will that be all right?',
      followUp: 'Do you think that will be all right?',
      expectedResponse:
        'Acknowledge the date and do not promise that it will be ready. Say in simple words what happens next, who has to act and when she will hear from you, and check that she has understood.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -4 },
    },
    {
      id: 'cb-will-it-work',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Will it work for sure? Please tell me yes.',
      followUp: 'So it will work?',
      expectedResponse:
        'Do not promise that it will work. Say simply what you know and what you do not, who has to answer the question about her phone, and when you will be in touch.',
      minDifficulty: 'standard',
      effects: { temperature: 3, patience: -3 },
    },
    {
      id: 'cb-reading',
      type: 'go-silent',
      trigger: { earliestTurn: 4, latestTurn: 8 },
      statement: 'One moment, please.',
      followUp: 'Sorry. I am still here. I was reading the screen.',
      expectedResponse:
        'Wait, then check gently that she is still following, and offer to say it again in simpler words.',
      minDifficulty: 'standard',
      effects: { patience: -2 },
    },
  ],
  allowedCurveballs: ['deadline', 'unsupported-guarantee', 'go-silent'],

  expectedDiscoveryAreas: [
    'What she sees on her screen',
    'Which device she is using',
    'Where she got the steps she follows',
    'Which steps she followed',
    'What she has already tried',
    'Whether others have managed it',
    'What she can use for work meanwhile',
  ],
  successCriteria: [
    'Greets Federica warmly, uses short plain sentences, and checks that she has understood.',
    'Finds out which device it is and whose it is, and what she sees on the screen.',
    'Finds where her steps came from and which of them she followed or skipped, without leading her.',
    'Does not ask her to keep trying, or to remove anything, before the right person has answered.',
    'Says in simple words who can say what applies to her device, and gives her one sentence to pass on.',
    'Agrees what happens next and when she will hear from them, and summarises in simple words.',
  ],
  coachingFocus: ['clarity', 'scoping-discovery', 'closing'],
  careExpectations: {
    communicate: [
      'Uses short sentences and common words, avoids idioms and jargon, and checks understanding with a simple question instead of assuming it.',
      'Repeats or rephrases patiently when she asks, and summarises the plan in plain words at the end.',
    ],
    accountable: [
      'Says clearly what they will do and who else has to answer, and gives a specific time when she will hear from them.',
      'Is honest that the cause is not yet known, and does not promise that it will work next time.',
    ],
    resourceful: [
      'Asks which device it is and where the steps came from before suggesting any fix.',
      'Finds out who looks after devices at her company and what she can use for work in the meantime.',
    ],
    empathetic: [
      'Acknowledges that setting up something new at a new job can be stressful, in simple, sincere words.',
      'Stays patient and unhurried when she asks for a word to be explained.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Using idioms, jargon or fast speech, and moving on without checking that she has understood.',
    'Speaking down to her, or treating her English as the problem, because it is her second language.',
    'Asking her to remove the app, reset the phone or try again and again before finding out whose phone it is.',
    'Blaming her colleague or the list, or saying her company rules are wrong, without knowing them.',
    'Promising that it will work after another try, or by Thursday.',
  ],
  goodBehaviours: [
    'Using simple, clear words and checking understanding often.',
    "Asking which device it is, and whether it is her own or the company's.",
    'Asking where she got the steps, and which of them she followed or skipped.',
    'Asking whether anyone else has managed it and what she can use for work in the meantime.',
    'Telling her in simple words who has to answer the question about her phone and what to tell them.',
    'Agreeing a time when she will hear next and summarising the plan in simple words.',
  ],
  expectedOutcome:
    "Federica understands in simple words that her own phone and the steps she was given may not match, that her company's administrator has to say which steps apply to her phone, and what to tell them. She does not keep trying in the meantime, and the engineer has given a specific time when she will hear back, without promising that it will work.",
  evaluatorNotes:
    "Root cause in the story (plausible, not confirmed on the call): Federica is setting up her own iPhone for work because her company laptop has not arrived. She follows a list that a colleague wrote last year for the company phones, and she skipped its first step, which asks IT to add the phone to a list, because the phone is hers. The app then says that something went wrong. Her organisation's own administrator can say which steps apply to a personal phone. A strong call uses simple words, checks understanding, finds the device, the list and the step she skipped, does not ask her to keep trying, and agrees who answers and when she will hear.",
} satisfies ScenarioInput;

export default scenario;
