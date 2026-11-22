import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario, set at a follow-up call. Everything here is fictional: people, organisation and
// case. Power Apps is a real product, so the scenario describes only what the customer sees and was
// told, never how an app is connected to its data.
//
// Root cause in the story (hidden from the trainee; plausible, and never confirmed on the call):
// the group departures app is used only for the winter programme. Its link to the departures data
// was set up by Tomasz, under his own sign-in, when he built the app last winter. Nobody has opened
// the app since the last group went home in March, so the link may have lapsed while it sat unused.
// Nothing else changed. Tomasz is on leave until the end of the month, the company's IT team has
// said apps like this are not theirs, and the first groups of the new season arrive soon. This is a
// different story from the approval process that stopped after its builder moved teams: here nobody
// did anything, and the gap is time. The departures information itself opens fine, which only a
// question about other ways to reach it brings out. Helena is anxious and vague. She is calling back
// with some of last week's questions answered. The facts that depend on how many people are affected
// and how soon the first group arrives (who is affected, the launch date) carry byImpact wordings for
// low (only Helena) and high (about twenty people), matching affectedUsers and impactVariants.detail.
//
// A strong call reads last week's notes, recognises what she found out, turns "it shows an error" into
// specifics one question at a time, finds that the app has not been used since March and that nothing
// changed, finds who built it and who else could act, explains one possibility without stating it as
// fact, promises no date, and agrees who does what next and when she will hear.

const scenario = {
  id: 'power-apps-connection-error-follow-up',
  version: 1,
  title: 'A shared app the team relies on shows a connection error',
  shortTitle: 'App shows a connection error',
  listSummary:
    'An operations analyst calls back about a shared app her team relies on, which shows a connection error.',
  summary:
    "Helena Barroso is an operations analyst at Margie's Travel. A shared app that her team relies on shows a connection error, and she is calling back after a first attempt. She is anxious and a little vague. Use what she has found, scope the error calmly and agree what happens next.",
  tags: ['power apps', 'connection error', 'follow-up', 'anxious customer', 'ownership'],
  estimatedMinutes: 11,

  product: { id: 'power-platform', area: 'Power Apps' },
  caseReference: 'SIM-410502',
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
      "Re-read Learn pages on broken connections (expiry after inactivity is listed for the SharePoint connector; removed owner account) and expired tokens. Not confirmed for shared Power Apps apps, so the cause stays the story's own. AI-assisted review, not a mentor's.",
  },
  issueType: 'feature-not-working',
  impact: 'medium',
  startingTemperature: 'anxious',
  proficiency: 'intermediate',
  style: 'vague',
  callStage: 'follow-up',
  difficulty: 'standard',

  persona: {
    name: 'Helena Barroso',
    speaker: 'female',
    role: 'Operations Analyst',
    organisation: "Margie's Travel",
    background:
      "Helena analyses bookings and keeps the operations team's schedules for a mid-sized travel company. She uses the team's apps all the time but has never built one, and she worries about being the person who gets blamed when something stops. She took last week's questions seriously and has done what she could.",
    voice:
      "Polite and a little rushed when she worries about the clock. Starts a sentence, stops, and corrects herself ('I think it was March, or maybe April?'). Apologises when she does not know and asks if she has done something wrong. Gets specific when asked one simple question at a time.",
  },
  environment: {
    details: [
      "Margie's Travel uses a shared Power Apps app, built in house, to track which coach and driver is assigned to each group departure.",
      'The operations team uses the app on laptops and on phones.',
      'A colleague built the app last winter. Helena uses it but has never opened it for editing.',
      "Margie's Travel has a small IT team that looks after accounts and laptops.",
      'Helena names things loosely and is not sure how the app gets its information.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Helena, who is the only person to have tried the app so far.' },
    medium: { count: 6, summary: 'The six people on the operations team.' },
    high: {
      count: 20,
      summary:
        'About twenty people across operations, the airport desks and the driver supervisors.',
    },
  },
  customerObjective:
    'Get the group departures app working again before the next groups arrive, and find out who should look after it from now on.',
  customerExpectation:
    "Someone who has read last week's notes, makes good use of what she found out, and tells her plainly what happens next and when.",
  desiredOutcome:
    'The engineer uses what Helena found, learns when the app was last used and that nothing has changed, finds who built it and who else could act, and agrees who does what next and when the next update comes.',
  previousTroubleshooting: [
    'Helena tried the app again on her laptop and on her phone, and the error was the same.',
    'She took a photo of the error screen.',
  ],
  recentChanges: [],

  publicBrief: {
    issue: "A shared app that Helena's team relies on shows a connection error.",
    impact: {
      low: 'The app is not working, but nothing depends on it yet.',
      medium: 'The app is not working, and group bookings are waiting on it.',
      high: 'The app is not working, and group arrivals depend on it.',
    },
    objective:
      'Scope the error calmly, use anything she has already found, and agree who acts next and when.',
    knownContext:
      "Helena Barroso is an operations analyst at Margie's Travel. Her team uses a shared app to coordinate group travel, and she is worried about it.",
    previousContact:
      'Helena called last week. She was asked to find out who built the app, when it last worked and what the error says, then ring back.',
    environment:
      "Margie's Travel runs its group departures from a shared Power Apps app. You cannot see the app in this practice call.",
  },
  brief: {
    situation:
      'An operations analyst is calling back about a shared app that shows a connection error for her team. She was asked to find out a few things last week and has some of the answers. She is anxious and a little vague about how the app works.',
    goal: 'Use what she has found, scope the problem one question at a time, take ownership, and agree who does what next and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; she is anxious and will not volunteer everything.',
      'You cannot see the app or the case system in this practice call, so rely on what she tells you.',
      'Helena is not technical about how the app is built, so use plain words.',
    ],
  },

  openingCore:
    "Our group departures app is showing an error about a connection, and the team can't use it.",
  impactVariants: {
    low: {
      summary:
        "It's only me who's tried it so far, so it isn't urgent, but I'd like some reassurance.",
      detail:
        "So far it's just been me trying it. Nobody is waiting on it yet, but I want it sorted before that changes.",
      deadline: "Nothing is due for a few weeks, but I'd like it sorted well before then.",
    },
    medium: {
      summary:
        "The whole operations team is stuck, because the app is how we keep track of who's meeting which group.",
      detail:
        'The team has not been able to use it, and we have groups coming that we need to plan for.',
      deadline: 'We need it back within a few days.',
    },
    high: {
      summary: 'Nobody in operations can use it, and other teams rely on it as well.',
      detail:
        'A lot of people rely on it, and without it nobody can see who is meeting which group.',
      deadline: 'We need it back before the next big group arrives.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm calling back about the case I opened last week, about our group departures app. I found out some of what I was asked, and it still shows the same error.",
      brief:
        'Helena opened a case last week about an app that shows a connection error. She was asked to find out who built it, when it last worked and what the error says, and to ring back.',
    },
    escalated: {
      opening:
        'This is my second call about our group departures app showing an error, and I was told someone would look at it. Nothing has happened since.',
      brief:
        'Helena has contacted support twice about the app. Nothing has changed, and she is worried about the groups that are coming.',
    },
    closure: {
      opening:
        "I'm calling to check that our group departures app is working again, so you can close my case.",
      brief:
        'Helena expects to confirm that the app works for the whole team and to understand what was wrong before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Last week',
      summary:
        'Helena reported that the group departures app shows a connection error. The engineer asked her to find out who built it, when it last worked and what the error says, and to ring back with the answers.',
    },
    {
      when: 'Since then',
      summary: 'No further contact is recorded.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-what-happens',
      text: 'Our group departures app shows an error about a connection, and we can no longer use it.',
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration: "I'm sorry, I'm not very good at describing it.",
      simple: 'Our group departures app shows an error about a connection. We cannot use it.',
    },
    {
      id: 'kf-problem-closure',
      text: "Our group departures app showed an error about a connection, and we couldn't use it. I'd like to understand what it was before you close my case.",
      intents: ['problem_description'],
      stages: ['closure'],
      simple:
        'Our group departures app showed an error about a connection. We could not use it. I want to understand what it was before you close my case.',
    },
    {
      id: 'kf-what-it-does',
      text: "It's how we keep track of which coach and driver go with each group, and when the group lands.",
      intents: ['environment', 'business_impact'],
      cues: [
        'what is it',
        'what does it',
        'what do you use',
        'what is the app',
        'used for',
        'what is it for',
      ],
      simple: 'It shows which coach and driver go with each group, and when the group arrives.',
    },
    {
      id: 'kf-homework',
      text: "I found out who built it, and I took a photo of the error. I couldn't find out much else.",
      intents: ['previous_contact', 'already_tried'],
      stages: ['follow-up', 'escalated', 'closure'],
      simple: 'I found out who built it. I took a photo of the error. I could not find out more.',
    },
    {
      id: 'kf-outcome',
      text: "I'd like it working again before the next groups arrive, and I'd like to know who looks after it from now on.",
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple:
        'I want the app to work again before the next groups arrive. I want to know who looks after it.',
    },
    {
      id: 'kf-outcome-closure',
      text: "I'd like to be sure it will keep working before the next groups arrive, and to know who looks after it from now on.",
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple:
        'I want to be sure the app will keep working before the next groups arrive. I want to know who looks after it.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-last-worked',
      intents: ['timing_onset'],
      text: "I think it was working at the end of last season, in the spring? I couldn't give you the date.",
      confirmedText: 'The last group I remember entering was in the middle of March.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-error-photo',
      intents: ['error_message'],
      cues: ['say', 'read', 'exact', 'wording', 'photo', 'screenshot', 'picture', 'message'],
      checking: 'Let me look at the photo I took.',
      text: "It says something like there's a problem with a connection, and to check it and try again. There's a button to try again, but it makes no difference.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-how-connected',
      intents: ['environment', 'account_details'],
      cues: [
        'how is it connected',
        'where does the data',
        'data source',
        'connection',
        'connector',
        'sign in',
        'sign-in',
        'whose',
      ],
      text: "I don't know how it's connected to our information, or whose sign-in it uses. That was all down to whoever built it.",
      whoKnows: 'the person who built it',
    },
    {
      id: 'uf-who-else-can-open',
      intents: ['account_details'],
      cues: ['who else', 'anyone else', 'someone else', 'administrator', 'admin', 'owner', 'edit'],
      text: "I don't know who else could open it up and look at how it's set up. I've never opened it that way.",
      whoKnows: 'the person who built it, or whoever manages Power Apps for us',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-trade-fair',
      text: 'Half the office is at a travel trade fair this week, so it is very quiet.',
    },
    {
      id: 'if-brochures',
      text: 'The new brochures only arrived yesterday, and they are already out of date.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-seasonal-gap',
      importance: 'critical',
      label: 'The app has not been opened for months',
      statement:
        'We only use it for the winter programme. After the last group went home in March nobody opened it, until we tried this week.',
      revealWhen:
        'Asks how often the app is used, when it was last used successfully or whether anyone has opened it recently.',
      intents: ['timing_onset', 'reproducibility'],
      cues: [
        'how often',
        'how regularly',
        'last work',
        'last use',
        'last open',
        'been used',
        'used since',
        'opened since',
        'used it since',
        'opened it since',
        'in between',
        'all year',
      ],
      hint: "It's not something we use all year round.",
      statementTerse: 'We only use it in winter. Nobody opened it between March and this week.',
      statementSimple:
        'We use the app only for the winter programme. The last group went home in March. After that nobody opened the app until this week.',
      missedConsequence:
        'The engineer never finds the long gap since the app was last used, so a search for a recent change that does not exist takes the place of the likeliest explanation.',
      betterQuestion:
        'How often does the team use the app, and when was it last used successfully before this week?',
    },
    {
      id: 'hf-which-part',
      importance: 'important',
      label: 'Only the first screen opens',
      statement:
        'The first screen opens, but as soon as anyone taps a group, or tries to assign a driver, the error comes up and nothing loads.',
      revealWhen:
        'Asks what exactly happens when she uses the app, or which screens or actions fail.',
      intents: ['problem_description', 'reproducibility'],
      cues: [
        'which screen',
        'which part',
        'what happens when',
        'what exactly happens',
        'what do you see',
        'where does it',
        'at what point',
        'when does the error',
        'when does it show',
        'when you open',
        'when you try',
      ],
      statementTerse: 'The first screen opens. Tapping a group brings up the error.',
      statementSimple:
        'The first screen opens. When anyone taps a group or tries to add a driver, the error appears and nothing loads.',
      missedConsequence:
        'Without the exact point where it fails, the engineer cannot tell her what to look at, and the problem stays "the app is broken".',
      betterQuestion:
        'What exactly happens when you open the app, and at what point does the error come up?',
    },
    {
      id: 'hf-who-affected',
      importance: 'important',
      label: 'Everyone who tries gets the error',
      statement:
        "It's everyone who has tried, so the six of us on the operations team. It's the same on the laptops and on the phones.",
      revealWhen:
        'Asks who is affected, how many people have tried the app or whether it is the same for everyone.',
      intents: ['affected_scope'],
      cues: [
        'who is affected',
        "who's affected",
        'who else',
        'how many people',
        'how many of you',
        'everyone',
        'same for',
        'whole team',
        'your team',
        'colleague',
        'phone',
        'laptop',
      ],
      statementTerse: 'Everyone who tried. Six of us, laptops and phones.',
      statementSimple:
        'It is everyone who has tried, the six people on the operations team. It is the same on laptops and on phones.',
      byImpact: {
        low: {
          statement:
            "As far as I know it's only me, because I'm the only one who has tried it. It's the same on my laptop and on my phone.",
          statementTerse: 'Only me, as far as I know. Laptop and phone the same.',
          statementSimple:
            'As far as I know it is only me, because I am the only one who tried it. It is the same on my laptop and my phone.',
        },
        high: {
          statement:
            "It's everyone who has tried: operations, the airport desks and the driver supervisors, about twenty of us. It's the same on the laptops and on the phones.",
          statementTerse: 'Everyone who tried, about twenty of us. Laptops and phones the same.',
          statementSimple:
            'It is everyone who has tried: operations, the airport desks and the driver supervisors, about twenty people. It is the same on laptops and phones.',
        },
      },
      missedConsequence:
        'Without knowing that everyone is affected equally, the engineer may chase a problem with one person or one device instead of the app itself.',
      betterQuestion: 'Who else has tried the app, and is it the same for everyone on the team?',
    },
    {
      id: 'hf-nothing-changed',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Nothing has changed that she knows of',
      statement:
        "As far as I know nobody has changed anything. IT haven't touched it, and Tomasz was the only person who ever edited it.",
      revealWhen:
        'Asks whether anything has changed recently, either in the app itself or around it.',
      intents: ['recent_changes'],
      cues: [
        'change',
        'anything new',
        'anything been',
        'updated',
        'edited',
        'touched',
        'modif',
        'anything happen',
      ],
      statementTerse: 'Nothing changed that I know of. Only Tomasz ever edited it.',
      statementSimple:
        'I do not think anyone changed anything. IT did not touch it. Only Tomasz ever edited the app.',
      missedConsequence:
        'The engineer never hears that nothing changed, so a lot of time goes on a search for a change that never happened.',
      betterQuestion:
        'Has anything changed recently, either in the app itself or anywhere around it?',
    },
    {
      id: 'hf-builder-away',
      importance: 'important',
      label: 'Who built it, and that he is away',
      statement:
        "Tomasz built it, last winter. He's on leave until the end of the month, and he isn't answering messages.",
      revealWhen:
        'Asks who built or set up the app, who looks after it, or whether that person can be reached.',
      intents: ['account_details'],
      cues: [
        'who built',
        'who made',
        'who created',
        'who set up',
        'built it',
        'maker',
        'who owns',
        'who looks after',
        'able to reach',
        'able to contact',
        'get hold of',
        'on leave',
      ],
      statementTerse: "Tomasz built it. He's on leave until the end of the month.",
      statementSimple:
        'Tomasz built the app last winter. He is on leave until the end of the month. He is not answering messages.',
      missedConsequence:
        'The one person who knows how the app is set up is never named, and the engineer plans around someone who is out of reach without knowing it.',
      betterQuestion: 'Who built the app, and have you been able to reach them?',
    },
    {
      id: 'hf-it-said',
      importance: 'important',
      minDifficulty: 'standard',
      stages: ['follow-up', 'escalated', 'closure'],
      label: 'Her IT team said it is not theirs',
      statement:
        "I asked our IT team since we spoke. They said apps like this aren't theirs to look after, and I should go back to whoever built it.",
      revealWhen:
        'Asks whether she has spoken to anyone else since the last contact, such as her own IT team.',
      intents: ['already_tried', 'previous_contact'],
      cues: [
        'since we spoke',
        'since we last spoke',
        'since last week',
        'since the last call',
        'since you called',
        'your it',
        'it team',
        'it department',
        'spoken to',
        'talked to',
        'helpdesk',
        'help desk',
      ],
      statementTerse: "IT said it isn't theirs. Go back to whoever built it.",
      statementSimple:
        'I asked our IT team. They said they do not look after apps like this. They said to ask the person who built it.',
      missedConsequence:
        'The engineer suggests she go back to a team that has already said no, and she feels passed around again.',
      betterQuestion: 'Since we last spoke, have you talked to your own IT team about it?',
    },
    {
      id: 'hf-launch-date',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'When she needs the app by',
      statement:
        "The first big group of the winter lands next Thursday, and I need their drivers and coaches loaded by Tuesday. After that we'd be doing it on paper.",
      revealWhen:
        'Asks when she needs the app working by, or what depends on it in the next few days.',
      intents: ['urgency_deadline', 'business_impact'],
      cues: [
        'deadline',
        'by when',
        'when do you need',
        'need it by',
        'how urgent',
        'what depends',
        'what happens if',
        'first group',
        'next group',
        'time pressure',
      ],
      statementTerse: 'The first big group lands next Thursday. I need it loaded by Tuesday.',
      statementSimple:
        'The first big group of the winter arrives next Thursday. I need the drivers and coaches in the app by Tuesday. After that we would use paper.',
      byImpact: {
        low: {
          statement:
            "The first group of the winter isn't until after the new year, so there's some room. I'd just like to know it will be ready.",
          statementTerse: "The first group is after the new year. There's some room.",
          statementSimple:
            'The first group of the winter comes after the new year. There is some time. I want to know it will be ready.',
        },
        high: {
          statement:
            "The first big group of the winter, a conference party, lands on Monday morning, and I need their drivers and coaches loaded by Friday. After that we'd be doing it on paper.",
          statementTerse: 'A conference group lands Monday. I need it loaded by Friday.',
          statementSimple:
            'A big conference group arrives on Monday morning. I need the drivers and coaches in the app by Friday. After that we would use paper.',
        },
      },
      missedConsequence:
        'The engineer never finds the real deadline, so the next update is set for a time that does not fit and she cannot plan around it.',
      betterQuestion:
        'When do you need the app working by, and what depends on it between now and then?',
    },
    {
      id: 'hf-data-fine',
      importance: 'helpful',
      minDifficulty: 'challenge',
      label: 'The information behind the app still opens',
      statement:
        "The departures list itself still opens fine for us in the browser, so the information is still there. It's only the app that complains.",
      revealWhen:
        'Asks whether the information behind the app can still be reached another way while it is down.',
      intents: ['workaround', 'affected_scope'],
      cues: [
        'another way',
        'other way',
        'still reach',
        'still get to',
        'other tools',
        'other apps',
        'workaround',
        'work around',
        'in the meantime',
        'meanwhile',
      ],
      statementTerse: 'The departures list still opens in the browser. Only the app complains.',
      statementSimple:
        'The departures list still opens in the browser. The information is still there. The problem is only in the app.',
      missedConsequence:
        'The engineer never finds out that the information is untouched, so no stop-gap is discussed and she stays more worried than she needs to be.',
      betterQuestion:
        'Can the team still get to the departures information another way while the app is down?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-someone-broke-it',
      statement:
        "I'm fairly sure somebody must have changed something. Apps don't just stop on their own.",
      truth:
        'Nothing suggests a change. In this story the app simply was not used for months, and the link it relies on may have lapsed in that time. That has not been confirmed.',
    },
    {
      id: 'ia-phones-need-reinstall',
      statement: 'Maybe the app needs reinstalling on our phones.',
      truth:
        'Nothing suggests the phones are at fault. The error is the same on laptops and phones.',
    },
  ],

  curveballs: [
    {
      id: 'cb-promise-monday',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: "Will it definitely be working by Monday? I'd like to tell my manager it will be.",
      followUp: 'So will it be working by Monday or not?',
      expectedResponse:
        'Do not promise a date. Say what you will do, who needs to be involved and when she will next hear from you, and ask what she needs to tell her manager.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -4 },
    },
    {
      id: 'cb-goes-quiet',
      type: 'go-silent',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Oh. Right. I see.',
      followUp: 'Sorry, I lost track for a moment. Could you say that again, more simply?',
      expectedResponse:
        'Notice the pause, check in gently, and say it again in plainer words instead of adding more detail.',
      minDifficulty: 'standard',
      effects: { patience: -2 },
    },
    {
      id: 'cb-second-app',
      type: 'change-issue',
      trigger: { earliestTurn: 5, latestTurn: 10, afterFact: 'hf-seasonal-gap' },
      statement:
        "There's another one, actually. The driver check-in app does the same thing, and the same person built that one too.",
      followUp: 'I should have said so sooner. Does that matter?',
      expectedResponse:
        'Treat it as part of the same case, not a new one. Ask what the two apps have in common, such as who built them and when they were last used, and do not promise that both will be fixed together.',
      minDifficulty: 'standard',
      effects: { temperature: 4, trust: -2, patience: -6 },
    },
  ],
  allowedCurveballs: [
    'unsupported-guarantee',
    'go-silent',
    'change-issue',
    'ask-manager',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'What happens when she opens the app',
    'Who is affected',
    'When the app was last used',
    'Whether anything has changed',
    'Who built it and whether they can be reached',
    'When she needs it working by',
  ],
  successCriteria: [
    "Greets Helena, reads last week's notes and uses what she found out instead of asking her to repeat it.",
    'Turns "it shows an error" into specifics: what happens, who is affected and what the message says.',
    'Finds that the app is only used for part of the year and has not been opened since March.',
    'Finds who built it, that he is away, and that her IT team has said it is not theirs.',
    'Explains one possibility without stating it as fact or promising a date, in plain words.',
    'Agrees who does what next, what Helena can do meanwhile and a specific time for the next update, then summarises.',
  ],
  coachingFocus: ['scoping-discovery', 'empathy-deescalation', 'ownership-next-steps'],
  careExpectations: {
    communicate: [
      'Uses plain words and asks one question at a time, checking that she follows a term before relying on it.',
      'Summarises what is known so far, what is not and what happens next, in words she can pass on to her manager.',
    ],
    accountable: [
      "Reads last week's notes first, recognises what she did since without making her feel she got it wrong, and takes ownership in their own name.",
      'Commits only to what they control, such as who contacts whom and when she hears next, and does not promise a date.',
    ],
    resourceful: [
      'Asks when the app was last used and how often, instead of assuming that something changed.',
      'Finds who built the app, whether they can be reached and who else could act, rather than sending her back to a team that has already said no.',
    ],
    empathetic: [
      'Recognises in specific words that she is worried about the groups that are coming and about having done something wrong.',
      'Slows down and stays gentle when she hesitates or goes quiet.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    "Asking her to start from the beginning when last week's notes already hold the story.",
    'Using terms such as connector, token or environment without explaining them.',
    'Telling her what is wrong with the app as if it were certain, or promising that it will work by a date.',
    'Sending her back to her IT team or to the builder without saying what to ask or who will follow up.',
    'Asking her to look for a change that nobody made, which leaves her feeling she missed something.',
  ],
  goodBehaviours: [
    'Opening by recognising the effort she put in since last week and reading the case history.',
    'Asking what happens on screen, who is affected and when the app was last used, in plain words and one at a time.',
    'Asking whether anything changed and whether the builder can be reached.',
    'Explaining one possibility without presenting it as fact, and saying who needs to look at what.',
    'Agreeing who contacts whom, what she can do meanwhile and when she will hear next, then summarising.',
  ],
  expectedOutcome:
    'Helena knows that her notes were read and her effort valued. She understands in plain words that nothing is known to be damaged and that the app may simply have stopped working after months unused. She knows who needs to look at it and has agreed what happens meanwhile and when she will hear next.',
  evaluatorNotes:
    "Root cause in the story (plausible, not confirmed on the call): the group departures app is used only for the winter programme. Its link to the departures information was set up by Tomasz under his own sign-in, and nobody has opened the app since March, so the link may have lapsed. Nothing else changed. Tomasz is on leave, IT has said apps like this are not theirs, and the first groups arrive soon. A strong call reads last week's notes, finds the long gap and that nothing changed, finds who built it and who else can act, explains one possibility without stating it as fact, promises no date and agrees who does what and when she hears next.",
} satisfies ScenarioInput;

export default scenario;
