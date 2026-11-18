import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario (closure call). Everything here is fictional: people, organisation and product.
//
// Timeline: three weeks ago the report emails stopped. Last Friday support changed how they are
// sent. The reports arrived on Monday and Tuesday. On Tuesday Elias told his director it was fixed.
// On Wednesday (yesterday) the morning sales summary failed. The call is on Thursday morning.
//
// Root cause (hidden from the trainee): last week's change restored the report emails for Elias,
// head office and most regions, so the case looks finished. In fact the East team has received
// nothing since the change (the cause is not yet known; a filter on their own mailboxes is likely)
// and the sales summary failed again yesterday. Elias has told his director that the problem is
// permanently fixed, and the quarterly report runs on the 30th while he is on leave. A strong call
// does not simply close the case: it verifies, finds the gaps, summarises what is and is not
// confirmed, keeps the case open with a named follow-up before the quarterly run, helps him word an
// accurate message and declines to guarantee that it will never happen again.

const scenario = {
  id: 'closure-call-report-fix-unconfirmed',
  version: 1,
  title: 'Closing out a case where the fix is not fully confirmed',
  summary:
    'A regional operations manager calls about a case on scheduled report emails. He believes the change made last week fixed them.',
  tags: ['closure', 'ownership', 'scheduled reports', 'expectations'],
  estimatedMinutes: 12,

  issueType: 'feature-not-working',
  impact: 'medium',
  startingTemperature: 'calm',
  proficiency: 'intermediate',
  style: 'talkative',
  callStage: 'closure',
  difficulty: 'standard',

  persona: {
    name: 'Elias Lindqvist',
    role: 'Regional operations manager',
    organisation: 'Adventure Works Retail Group',
    background:
      'Elias oversees day-to-day operations for four regional store teams, and they come to him when the morning reports go missing. He has a long list of things to get through and likes to tick items off. He knows the reporting service well enough to set up a schedule, but not how it sends email.',
    voice:
      'Warm, chatty and unhurried. Gives background and small stories before getting to the point, and thanks people often. Tends to say things are "fine" before he has checked. Open and straightforward when asked a direct question.',
  },
  environment: {
    product: 'the Wingtip reporting service',
    details: [
      'Scheduled report emails go out every weekday morning to head office and four regional teams: North, South, East and West',
      'A larger quarterly summary report is also scheduled and goes to every region on the 30th',
      'Last Friday support changed how the scheduled reports are sent and re-sent the missed ones',
      'Head office and the North, South and West teams have received the reports since the change',
      'The East team has received none of the emails since the change. Its team lead told Elias this morning',
      'Yesterday morning the sales summary was not delivered to anyone. It arrived normally today',
      'On Tuesday Elias told his director that the problem was permanently fixed',
      'Elias is on leave from the 25th for two weeks. Nadia Petrova on his team covers for him',
    ],
  },
  customerObjective:
    'Confirm that the report emails are fixed so the case can be closed, and be able to say so with confidence.',
  brief: {
    situation:
      'A regional operations manager relies on scheduled report emails reaching his teams every morning. Support changed how the reports are sent last week. He is friendly and chatty.',
    goal: 'Work out with him where the case really stands, and agree clear next steps.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'What has actually been confirmed is for you to find out.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
    ],
  },

  openingCore:
    'The scheduled report emails stopped reaching my teams a few weeks ago, and I want to be sure they are working properly now.',
  impactVariants: {
    low: {
      summary:
        'The reports are useful rather than critical, because people can open the same figures online if an email is late.',
      detail:
        'If an email is late, people can still look at the same numbers in the reporting service, so nothing stops. I would still like it to work properly.',
      deadline: 'No fixed date, but I would like to close this off soon.',
    },
    medium: {
      summary:
        'The regional teams read these reports every morning to plan their day, so I need them to be reliable.',
      detail:
        'The regional teams read the reports first thing and plan their day from them. When one is late they start without their numbers and have to ask around.',
      deadline: 'I would like to close this off this week.',
    },
    high: {
      summary:
        'Every region places its daily orders from these reports, so a missing one costs us money.',
      detail:
        'Each region places its orders based on the morning report. If it is missing or late, they either guess or order late, and that has a real cost for the stores.',
      deadline: 'I need to know today that it is properly fixed.',
    },
  },
  stageFrames: {
    closure: {
      opening:
        "I'm calling to confirm that we can close the case about the report emails, since the change last week.",
      brief:
        'This is a closure call. Support changed how the reports are sent last week, and Elias expects to confirm that the problem is fixed so the case can be closed.',
    },
    'follow-up': {
      opening:
        "I'm following up on the report emails case. A change was made last week and I wanted to check where things stand.",
      brief:
        "This is a follow-up call. Elias wants an update on the report emails case after last week's change.",
    },
    escalated: {
      opening:
        'This is my third call about the scheduled report emails. I was told last week that it was fixed, and I need to be sure this time.',
      brief:
        'Elias has contacted support several times about the report emails. Trust is strained and he expects a clear answer.',
    },
  },
  priorHistory: [
    {
      when: 'Three weeks ago',
      summary:
        'Elias reported that scheduled report emails had stopped reaching his teams. A case was opened.',
    },
    {
      when: 'Last Friday',
      summary:
        'Support changed how the scheduled reports are sent, re-sent the missed reports and asked Elias to watch the next few runs.',
    },
    {
      when: 'Tuesday',
      summary:
        'Elias emailed to say the reports were arriving for him and that he would call to confirm the case could be closed.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-change-last-week',
      text: 'Your team made a change last week, and I was asked to watch the next few runs before we closed the case.',
      intents: ['problem_description', 'previous_contact'],
      elaboration:
        'I put a note on my list for the week, so I have been watching for them ever since.',
      simple:
        'Your team made a change last week. I was asked to watch the next few reports before we close the case.',
    },
    {
      id: 'kf-arriving-for-me',
      text: 'The reports have been arriving in my inbox since the change.',
      intents: ['problem_description'],
      elaboration: 'I was at my desk early on the first morning just to see one come in.',
      simple: 'The reports arrive in my inbox since the change.',
    },
    {
      id: 'kf-recipients',
      text: 'The reports go to me and to the four regional teams, every weekday morning.',
      intents: ['affected_scope'],
      simple: 'The reports go to me and to four regional teams every weekday morning.',
    },
    {
      id: 'kf-outcome',
      text: "I'd like to close the case today if we can, and get on with the rest of my week.",
      intents: ['expected_outcome'],
      elaboration: "I have a long list this week, and this is the one I'd most like to cross off.",
      simple: 'I want to close the case today.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-east-team-missing',
      importance: 'critical',
      label: 'East team still receives nothing',
      statement:
        'The East region team has not received any of the reports since the change. Their team lead told me this morning, and I have not looked into it yet.',
      partialStatement:
        'As far as I know it is working. I have not heard back from every team yet.',
      revealWhen:
        'Asks whether every team or recipient has confirmed they are receiving the reports, or whether anyone has said they are still missing them.',
      intents: ['affected_scope', 'reproducibility'],
      partialIntents: ['problem_description'],
      cues: [
        'everyone',
        'everybody',
        'anyone',
        'each team',
        'each region',
        'all four',
        'other teams',
        'confirmed',
        'heard from',
        'all the teams',
        'all recipients',
        'checked with',
      ],
      hint: "I haven't actually heard from every team yet.",
      statementTerse:
        'The East team has had none since the change. Their lead told me this morning.',
      statementSimple:
        'The East team has not received any reports since the change. Their lead told me this morning. I have not looked into it yet.',
      missedConsequence:
        'The case is closed while a whole region is still missing its reports. The problem returns as a new complaint and the customer loses trust.',
      betterQuestion:
        'Have all four regional teams confirmed that they are receiving the reports since the change?',
    },
    {
      id: 'hf-failed-yesterday',
      importance: 'important',
      label: 'Sales summary failed again yesterday',
      statement:
        "It worked well for two days. Then yesterday morning's sales summary did not arrive at all. This morning's one came through, so I thought it was a one-off.",
      revealWhen:
        'Asks whether any report has failed, been late or gone missing since the change, or whether the problem has happened again.',
      intents: ['reproducibility', 'error_message', 'problem_description'],
      cues: [
        'again',
        'happen again',
        'recur',
        'missed',
        'missing',
        'failed',
        'fail',
        'any problems',
        'any issues',
        'not arrive',
        'late',
        'gone wrong',
      ],
      hint: 'Well, there was one odd day, but I think it was a one-off.',
      statementTerse: "It worked for two days. Then yesterday's sales summary did not arrive.",
      statementSimple:
        "It worked for two days. Yesterday the sales summary did not arrive. Today's report came, so I thought it was a one-off.",
      missedConsequence:
        'A failure after only two good days is a sign that the fix may not be complete, and it goes unrecorded on the case.',
      betterQuestion:
        'Since the change, has any report failed, arrived late or not arrived at all?',
    },
    {
      id: 'hf-director-told',
      importance: 'important',
      minDifficulty: 'standard',
      minTrust: 50,
      label: 'Director already told it is permanently fixed',
      statement:
        'On Tuesday I told my director that the problem was fixed for good. I was quite sure of it at the time.',
      revealWhen:
        'Asks who else has been told the problem is fixed, who is waiting for confirmation, or how the customer plans to communicate the outcome.',
      intents: ['business_impact', 'expected_outcome'],
      cues: [
        'who else',
        'anyone else',
        'told anyone',
        'told your',
        'let know',
        'inform',
        'communicate',
        'management',
        'director',
        'boss',
        'waiting on',
        'report back',
      ],
      statementTerse: 'On Tuesday I told my director it was fixed for good.',
      statementSimple:
        'On Tuesday I told my director the problem was fixed for good. I was sure at that time.',
      missedConsequence:
        'He has already promised his director something. If the engineer simply closes the case, he is exposed when the next failure happens, and his trust in support falls.',
      betterQuestion:
        'Who else knows the problem was fixed, and is anyone waiting on you for confirmation?',
    },
    {
      id: 'hf-quarterly-30th',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'Quarterly report due on the 30th',
      statement:
        'The next quarterly report is due to be sent on the 30th. It is a big one and goes to every region.',
      revealWhen:
        'Asks whether anything coming up depends on these reports, such as an important scheduled run or a deadline.',
      intents: ['urgency_deadline'],
      cues: [
        'coming up',
        'upcoming',
        'next',
        'deadline',
        'scheduled',
        'quarter',
        'month-end',
        'due',
        'depend',
        'important',
        'soon',
        'later this',
      ],
      statementTerse: 'The quarterly report is due on the 30th. It goes to every region.',
      statementSimple:
        'The next quarterly report goes out on the 30th. It is a big report for every region.',
      missedConsequence:
        'The next big run is the first real test of the fix. Without the date, the engineer cannot plan a check before it.',
      betterQuestion:
        'Is there anything coming up that depends on these reports, like a larger scheduled run?',
    },
    {
      id: 'hf-away-contact',
      importance: 'helpful',
      minDifficulty: 'challenge',
      label: 'On leave from the 25th, deputy covers',
      statement:
        'I am on leave from the 25th for two weeks. Nadia Petrova on my team would be the contact while I am away.',
      revealWhen:
        'Asks who the best contact is for follow-up, whether the customer will be available, or who else could be contacted.',
      intents: ['account_details'],
      cues: [
        'best contact',
        'who should',
        'contact',
        'reach you',
        'available',
        'away',
        'holiday',
        'leave',
        'out of office',
        'back-up',
        'someone else',
        'follow-up call',
      ],
      statementTerse: 'On leave from the 25th for two weeks. Nadia Petrova covers for me.',
      statementSimple:
        'I am on leave from the 25th for two weeks. Nadia Petrova on my team will be the contact then.',
      missedConsequence:
        'The next quarterly run falls while he is away. If the follow-up goes only to him, nobody sees it.',
      betterQuestion:
        'Who is the best person to contact for the follow-up, and will you be available around the next scheduled run?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-two-good-days',
      statement: 'Since the change it has been working, so I think it is fixed for good.',
      truth:
        'A short run of good days is not proof. One report has already failed again and one region still receives nothing.',
    },
    {
      id: 'ia-their-side',
      statement:
        'If a report goes missing for someone, I assume it is a filter on their side and not part of our case.',
      truth:
        "A missing report for one region began with last week's change, so it belongs to this case, even if a filter on their side is involved.",
    },
  ],

  curveballs: [
    {
      id: 'cb-guarantee',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9, afterFact: 'hf-failed-yesterday' },
      statement:
        "Before we finish, can you guarantee this will not happen again? I'd like to be able to tell people it is permanent.",
      followUp: 'So can I say it is permanently fixed, yes or no?',
      expectedResponse:
        'Do not promise it will never happen again. Be honest about what is not yet confirmed, say what you will check and when you will update him, and offer wording he can use that is accurate.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -4 },
    },
    {
      id: 'cb-closed-too-early',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 5, latestTurn: 10, whenOwnershipUnclear: true },
      statement:
        'The last time one of our cases was closed, the same problem came back a week later and I had to start again from the beginning. I would rather not go through that again.',
      followUp: 'So if it comes back, who do I talk to, and how quickly will it be picked up?',
      expectedResponse:
        'Acknowledge the earlier experience without defending it. Show what is different this time: a named owner, specific check dates and a quick route to reopen the case if the problem returns.',
      minDifficulty: 'challenge',
      effects: { temperature: 4, trust: -6 },
    },
    {
      id: 'cb-director-note',
      type: 'deadline',
      trigger: { earliestTurn: 5, afterFact: 'hf-director-told' },
      statement:
        'My director has asked me for a short note by the end of the day saying where this stands. What can I tell them?',
      followUp: 'I need something I can send today. What would you say in my place?',
      expectedResponse:
        'Help him write an accurate note: what is fixed, what is still being checked and when the next update will be. Do not let him describe it as permanently fixed, and do not promise things support cannot control.',
      minDifficulty: 'challenge',
      effects: { temperature: 4, patience: -6 },
    },
  ],

  expectedDiscoveryAreas: [
    'Who receives the reports',
    'Any problems since the change',
    'Who is relying on the outcome',
    'What depends on these reports',
  ],
  successCriteria: [
    'Greets Elias and asks what he has seen since the change, instead of accepting "it has been fine" and closing.',
    'Asks whether every recipient has confirmed delivery and whether any report has failed since the change.',
    'Finds out who has been told it is fixed and what is coming up that depends on it.',
    'Summarises clearly what is confirmed, what is not and what happens next.',
    'Agrees a specific follow-up (who, what and when, before the next quarterly run) and does not promise it will never happen again.',
  ],
  coachingFocus: ['closing', 'ownership-next-steps'],
  poorApproaches: [
    'Accepting "it has been fine" and closing the case without asking who else receives the reports or whether anything has failed.',
    'Telling Elias that the fix is permanent, or promising that it will never happen again.',
    'Ending with "let us know if there are any problems" instead of agreeing who will check what, and when.',
    'Running through a closing script and thanking him without summarising what is and is not confirmed.',
    "Treating the East team's missing reports as a separate matter that is not part of this case.",
  ],
  goodBehaviours: [
    'Asking for specifics before agreeing to close: every recipient, every report, every day since the change.',
    'Asking who else has been told the problem is fixed, and what is coming up that depends on the reports.',
    'Summarising what is confirmed, what is not and what will happen next, in plain words.',
    'Offering a specific follow-up date before the next quarterly run, and naming who will check.',
    'Helping him word an accurate message for his director, for example "fixed for most reports, two items still being checked".',
    'Asking who to contact if he is unavailable around the next run.',
  ],
  expectedOutcome:
    "The case stays open instead of being closed. Elias understands what is fixed and what is not, and the engineer owns the next steps: check delivery to the East team and yesterday's failure, agree a follow-up before the quarterly run, and confirm who to contact while he is away. No promises about the future are made.",
  evaluatorNotes:
    'Root cause: the change made last week restored the report emails for Elias, head office and most regions, so the case looks finished. In fact the East team has received nothing since the change (cause not yet known, perhaps a filter on their mailboxes) and the sales summary failed again yesterday. Elias has told his director it is permanently fixed, and the quarterly report runs on the 30th while he is on leave. A strong call does not simply close. It verifies with focused questions, finds the gaps, summarises what is and is not confirmed, keeps the case open with a named follow-up before the quarterly run, helps him word an accurate message and declines to guarantee that the problem will never return. Weak calls accept that it has been fine and close.',
} satisfies ScenarioInput;

export default scenario;
