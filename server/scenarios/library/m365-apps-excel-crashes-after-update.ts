import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario (first contact). Everything here is fictional: people, organisation and case.
//
// Case pattern (hidden from the trainee): the IT team's regular update went onto Rafael's laptop over
// the weekend. Since then Excel closes within a minute whenever he presses the refresh button of a
// reporting plug-in inside the large forecast workbook he shares with the team. Small files and new
// blank workbooks are fine. Yesterday it closed before he had saved and he lost about two hours of
// work. His colleague Marta, whose laptop has not had the update yet, can open and refresh the same
// workbook, but she is away from tomorrow, and his quarter-end report is due on Friday morning.
// The finance systems team installed and looks after the plug-in. Nobody on the call needs to find
// the fix. A strong call uses simple words and checks understanding, finds the one-workbook pattern
// and the refresh moment, acknowledges the lost work and the deadline as his worry grows, does not
// promise Friday, protects his work in the meantime, and agrees a specific time for the next contact.

const scenario = {
  id: 'm365-apps-excel-crashes-after-update',
  version: 1,
  title: 'Excel keeps closing since an update',
  shortTitle: 'Excel keeps closing',
  listSummary: 'An analyst says Excel closes by itself on his work laptop since a recent update.',
  summary:
    'Rafael is a financial analyst whose Excel has started closing by itself on his work laptop since a recent update. English is his second language, so simple, clear wording will help. He is calm at the start but may become worried as the call goes on. Find out what is happening and agree what happens next.',
  tags: ['crash', 'Excel', 'after an update', 'non-native speaker', 'first contact'],
  estimatedMinutes: 10,

  product: { id: 'm365-apps', area: 'Excel' },
  caseReference: 'SIM-420002',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    revisedOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-support', 'microsoft-learn'],
    behaviourCheck: 'checked-partly',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    review: 'assistant-reviewed',
    notes:
      "Reviewed on 22 Nov 2026 against current public pages on Excel closing or freezing, known issues and add-in troubleshooting. The update, workbook and refresh combination is not verified; cause and refresh-habit wording hedged. AI-assisted review, not a mentor's.",
  },
  issueType: 'feature-not-working',
  impact: 'medium',
  startingTemperature: 'calm',
  proficiency: 'intermediate',
  style: 'non-native',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Rafael Moreno',
    speaker: 'male',
    role: 'Financial Analyst',
    organisation: 'Wide World Importers',
    background:
      'Rafael builds forecasts and quarter-end reports for an importer, and Excel is open on his laptop all day. He is comfortable with the tools he uses and with basic troubleshooting such as restarting. He works in English every day, but it is his second language.',
    voice:
      'Polite and a little formal. Uses simple, everyday words and short sentences, and avoids idioms. Sometimes asks the engineer to repeat something or to explain a word more simply. Calm at first, then quietly more worried as his deadline gets closer, and asks for a clear plan.',
  },
  environment: {
    details: [
      'A company laptop managed by the IT team, which installs updates over the weekend',
      'Excel is open all day. The main file is a large forecast workbook that the finance team shares',
      'The workbook is used with a reporting plug-in that the finance systems team installed, and Rafael presses its refresh button after opening the file',
      'Small files and new blank workbooks open normally on his laptop',
      'His colleague Marta, who sits next to him, has not had the update yet and can open and refresh the same workbook',
      'Rafael works from the office most days',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: "Only Rafael's laptop; nobody else has reported it" },
    medium: {
      count: 4,
      summary: "Four analysts on Rafael's team, who all had the update and use the same workbook",
    },
    high: {
      count: 35,
      summary: 'About thirty-five people in the finance department, who all use the same workbook',
    },
  },
  customerObjective:
    'Stop Excel closing by itself so he can finish his reports without losing work, and know what will happen next.',
  customerExpectation:
    'To be understood the first time, to be told clearly what will happen next and when, and to have a way to protect his work in the meantime.',
  desiredOutcome:
    'Rafael understands the plan, knows who is doing what and when he will hear back, and has a safe way to keep working until the cause is found.',
  previousTroubleshooting: [
    'Restarted the laptop twice, with no change',
    'Ran the repair option described in the IT team guide, with no change',
    'Saves his work every few minutes since losing two hours of changes yesterday',
  ],
  recentChanges: [
    "The IT team's regular update was installed over the weekend, and his laptop restarted by itself on Sunday night",
    'No other change to the laptop or the workbook that he knows of',
  ],

  publicBrief: {
    issue: 'Excel closes by itself on his work laptop since a recent update.',
    impact: {
      low: 'Only Rafael is affected, and he can still do other work.',
      medium: "Rafael and some colleagues are slowed down, and the team's reporting is at risk.",
      high: 'Most of the finance department is slowed down and company reporting is at risk.',
    },
    objective:
      'Understand the problem, take ownership, speak clearly and agree next steps he can rely on.',
    knownContext:
      'Rafael speaks English as a second language. Simple words and checking that he has understood will help.',
    environment: 'A company laptop managed by the IT team, with Excel used all day.',
  },
  brief: {
    situation:
      'Rafael is a financial analyst at an importer. Excel has started closing by itself on his work laptop since a recent update. He is polite and calm at the start, and English is his second language.',
    goal: 'Find out what is happening, who is affected and what it is costing him, take ownership, and agree what happens next, using simple and clear words.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'You cannot see his laptop in this practice call, so rely on what he tells you.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
    ],
  },

  openingCore: 'Excel keeps closing by itself on my work laptop. It started after an update.',
  impactVariants: {
    low: {
      summary: 'It is only my laptop, and I can do other work while I wait, but it is annoying.',
      detail:
        'I think it is only my laptop, because nobody else has told me about this. I can do some other work, but I lose time each time Excel closes.',
      deadline: 'I would like it fixed this week, but it is not urgent today.',
    },
    medium: {
      summary: 'It happens many times a day, and it is slowing me and some of my colleagues.',
      detail:
        'Four of us in the finance team have this problem. Each time, we open the file again and wait. It takes a lot of time every day.',
      deadline: 'The quarter-end report is due on Friday morning.',
    },
    high: {
      summary: 'Most of the finance department has this problem now, and our reports are late.',
      detail:
        'About thirty-five people in finance use the same workbook, and most of them have this problem now. Reports are late, and the managers ask me for news every hour.',
      deadline:
        'The quarter-end reports are due on Friday morning, and the finance director is waiting.',
    },
  },
  stageFrames: {
    'first-contact': {
      opening: 'I am calling about a problem with Excel.',
      brief: 'This is the first time Rafael has contacted your team about this problem.',
    },
    'follow-up': {
      opening:
        'I am calling about Excel closing by itself on my work laptop. I have not had an update since I reported it, and I would like to hear what has been done.',
      brief:
        'This is a follow-up call. Rafael reported the problem earlier and has not had an update. He expects to hear what has been done.',
    },
    escalated: {
      opening:
        'This is my second call about Excel closing by itself on my work laptop, and it is still not fixed. I need a clear answer about what will happen.',
      brief:
        'Rafael has already contacted support about this and it is not fixed. He is polite but is now worried about time.',
    },
    closure: {
      opening:
        'I am calling about Excel closing by itself on my work laptop, to see whether we can close the case.',
      brief:
        'This is a closure call. Rafael expects to confirm that Excel stays open and to understand what was done before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday evening',
      summary:
        'Rafael phoned support about Excel closing by itself on his work laptop. A case was opened and he was asked to restart the laptop and try again.',
    },
    {
      when: 'This morning',
      summary: 'An engineer was assigned to the case, but has not yet been in touch with him.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-closes-no-message',
      text: 'Excel just closes. There is no error message. The window goes away, and I have to open it again.',
      intents: ['problem_description', 'error_message'],
      simple: 'Excel closes by itself. I do not see a message. I must open it again.',
    },
    {
      id: 'kf-laptop',
      text: 'I use a company laptop, and the IT team looks after it. I use Excel all day for my reports.',
      intents: ['environment', 'account_details'],
      simple: 'I use a company laptop. The IT team looks after it. I use Excel all day.',
    },
    {
      id: 'kf-update',
      text: 'I think the update came from the IT team. I did not choose it.',
      intents: ['recent_changes'],
      simple: 'I think the IT team sent the update. I did not choose it.',
    },
    {
      id: 'kf-tried',
      text: 'I restarted the laptop two times, and I ran the repair that the IT team guide describes. Nothing changed.',
      intents: ['already_tried'],
      simple:
        'I restarted the laptop two times. I ran the repair from the IT guide. Nothing changed.',
    },
    {
      id: 'kf-outcome',
      text: 'I want Excel to stay open, so I can finish my work. I also want to know what will happen next.',
      intents: ['expected_outcome'],
      simple:
        'I want Excel to stay open. I want to finish my work. I want to know what happens next.',
    },
  ],

  vagueFacts: [
    {
      id: 'vf-update-when',
      intents: ['timing_onset', 'recent_changes'],
      text: 'I think the update was at the weekend, but I am not sure. Maybe Friday.',
      confirmedText:
        'Yes, it was the weekend. My laptop restarted on Sunday night by itself, and on Monday morning Excel began to close.',
    },
    {
      id: 'vf-how-often',
      intents: ['reproducibility'],
      cues: ['how often', 'how many times', 'every day', 'each day'],
      text: 'Many times since Monday. Maybe ten? I did not count.',
      confirmedText:
        'I think eight or ten times in total, with more on Tuesday. I did not write it down.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-it-email',
      intents: ['recent_changes', 'timing_onset'],
      cues: ['email', 'announcement', 'message from it', 'notice', 'which update', 'what update'],
      checking: 'One moment, I will find the email from the IT team.',
      text: 'The email says a regular update for the Microsoft apps was installed on laptops over the weekend, and that we should restart when asked. It says nothing else.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-what-update-changed',
      intents: ['recent_changes'],
      cues: ['what changed in', 'what was in the update', 'what the update', 'what did the update'],
      text: 'I do not know what was in the update. The IT team handles that, and I only saw that it was installed.',
      whoKnows: 'the IT team',
    },
    {
      id: 'uf-version-licence',
      intents: ['environment', 'account_details'],
      cues: ['which version', 'what version', 'what licence', 'what license', 'subscription'],
      text: 'I do not know exactly which version of Excel I have, or what licence the company has. I never needed to know.',
      whoKnows: 'the IT team',
    },
    {
      id: 'uf-other-laptops',
      intents: ['affected_scope'],
      cues: ['other laptops', 'which laptops', 'who got the update', 'everyone got'],
      text: 'I do not know who received the update across the company. The IT team would know.',
      whoKnows: 'the IT team',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-window',
      text: 'My desk is near a window, so in the afternoon the sun is on my screen and it is hard to read.',
    },
    {
      id: 'if-years',
      text: 'I have worked in this company for two years, and before that I worked for a bank.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-one-workbook',
      importance: 'critical',
      label: 'Only one large workbook is affected',
      statement:
        'It only happens with our big forecast workbook. Small files are fine, and a new empty workbook is fine too.',
      partialStatement: 'It does not happen with every file, I think.',
      revealWhen:
        'Asks whether it happens with every file or only some, or whether it has been tried with a different workbook.',
      intents: ['reproducibility', 'affected_scope'],
      partialIntents: ['problem_description'],
      cues: [
        'every file',
        'every workbook',
        'all files',
        'other files',
        'another file',
        'different file',
        'other workbook',
        'new workbook',
        'blank workbook',
        'one file',
        'which file',
        'which workbook',
      ],
      hint: 'Some of my files seem to be fine.',
      statementTerse: 'Only our big forecast workbook. Small files and new blank ones are fine.',
      statementSimple:
        'It happens only with our big forecast workbook. Small files are fine. A new empty workbook is also fine.',
      missedConsequence:
        'Without knowing that only one workbook is affected, the engineer treats it as a general fault on the laptop and misses the clue that makes the next step practical.',
      betterQuestion: 'Does it happen with every file, or only with some of your workbooks?',
    },
    {
      id: 'hf-lost-work',
      importance: 'important',
      requiresImpactAck: true,
      label: 'He lost two hours of unsaved work',
      statement:
        'Yesterday it closed when I had not saved for a long time, and I lost about two hours of work. Now I save every few minutes, but it is slow.',
      revealWhen:
        'Asks whether he has lost any work or unsaved changes, or what it has cost him so far.',
      intents: ['business_impact'],
      cues: [
        'lost',
        'you lose',
        'did you lose',
        'unsaved',
        'not saved',
        'saved your work',
        'recover',
        'autorecover',
        'data loss',
      ],
      hint: 'I have already lost some work, and that is the worst part.',
      statementTerse: 'Yesterday I lost about two hours of work. It closed before I saved.',
      statementSimple:
        'Yesterday Excel closed before I saved. I lost about two hours of work. Now I save every few minutes, but it is slow.',
      byImpact: {
        low: {
          statement:
            'Yesterday it closed when I had not saved for a while, and I lost about twenty minutes of work. Now I save every few minutes, but it is slow.',
          statementTerse:
            'Yesterday I lost about twenty minutes of work. It closed before I saved.',
          statementSimple:
            'Yesterday Excel closed before I saved. I lost about twenty minutes of work. Now I save every few minutes, but it is slow.',
        },
        high: {
          statement:
            'Yesterday it closed when I had not saved for a long time, and I lost about two hours of work. Some of my colleagues lost work too. Now we all save every few minutes, but it is slow.',
          statementTerse: 'Yesterday I lost about two hours of work, and so did some colleagues.',
          statementSimple:
            'Yesterday Excel closed before I saved. I lost about two hours of work. Some colleagues lost work too. Now we all save every few minutes, but it is slow.',
        },
      },
      missedConsequence:
        'The real cost of the problem stays hidden, so the engineer misses how worried he is and does not suggest ways to protect his work while the cause is found.',
      betterQuestion:
        'Have you lost any work because of this, and how are you protecting your work at the moment?',
    },
    {
      id: 'hf-refresh-plugin',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'It closes when he refreshes with the reporting plug-in',
      statement:
        'It closes when I press the refresh button of our reporting plug-in inside that workbook. I usually press it after I open the file, so it can close within a minute.',
      revealWhen:
        'Asks what he is doing at the moment Excel closes, or whether it closes at a particular step or when he uses a particular tool.',
      intents: ['reproducibility'],
      cues: [
        'what are you doing',
        'what were you doing',
        'at what point',
        'which step',
        'moment before',
        'just before',
        'right before',
        'refresh',
        'plug-in',
        'plugin',
        'add in',
        'button',
      ],
      statementTerse:
        'When I press refresh in our reporting plug-in. I usually press it after opening, so it can close within a minute.',
      statementSimple:
        'It closes when I press the refresh button of our reporting plug-in in that workbook. I usually press it after I open the file. Then it can close within one minute.',
      missedConsequence:
        'The moment of failure, and the plug-in that is involved, stay unknown, so the next step is a guess and the case may be passed on without the detail others will need.',
      betterQuestion: 'What exactly are you doing in the moment before Excel closes?',
    },
    {
      id: 'hf-colleague-works',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'A colleague can still use the workbook',
      statement:
        'Marta, who sits next to me, opens the same workbook and refreshes it without any problem. Her laptop has not had the update yet. She could run it for me, but she is away from tomorrow.',
      revealWhen:
        'Asks whether anyone else is affected or can still use the file, or whether there is any way to keep the work moving in the meantime.',
      intents: ['workaround', 'affected_scope'],
      cues: [
        'colleague',
        'anyone else',
        'someone else',
        'other people',
        'other laptop',
        'teammate',
        'workaround',
        'work around',
        'another computer',
        'other computer',
        'in the meantime',
      ],
      statementTerse:
        'Marta, next to me, can open and refresh it. Her laptop has no update yet. She is away from tomorrow.',
      statementSimple:
        'My colleague Marta can open the same workbook and refresh it. Her laptop did not get the update yet. She is away from tomorrow.',
      missedConsequence:
        'A practical way to keep the report moving is missed, and so is the fact that it will only be available for one more day.',
      betterQuestion:
        'Is anyone else able to open and refresh that workbook, and is there a way to keep your report moving in the meantime?',
    },
    {
      id: 'hf-plugin-owner',
      importance: 'helpful',
      minDifficulty: 'challenge',
      availableAfterTurn: 3,
      label: 'The finance systems team looks after the plug-in',
      statement:
        'The reporting plug-in is not from the IT team. The finance systems team installed it for us, and they look after it.',
      revealWhen:
        'Asks who installed or looks after the extra tools used in the workbook, or who else should be involved.',
      intents: ['account_details', 'environment'],
      cues: [
        'who installed',
        'who looks after',
        'who owns',
        'who manages',
        'who supports',
        'who set up',
        'who else should',
        'finance systems',
      ],
      statementTerse: 'The finance systems team installed and looks after the plug-in, not IT.',
      statementSimple:
        'The IT team did not install the plug-in. The finance systems team installed it. They look after it.',
      missedConsequence:
        'The people who may be able to explain the plug-in are never contacted, so the next step is slower than it needs to be.',
      betterQuestion: 'Who installed the reporting plug-in, and who looks after it?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-whole-laptop',
      statement: 'I think the update damaged Excel on my whole laptop.',
      truth:
        'Only one large workbook, used with a reporting plug-in, makes Excel close. Small files and new workbooks are fine, but the cause is not yet known.',
    },
  ],

  curveballs: [
    {
      id: 'cb-friday-deadline',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 8, whenImpactUnacknowledged: true },
      statement:
        'I should tell you something. My quarter-end report is due on Friday morning, and now I am starting to worry. Can you tell me what will happen?',
      followUp: 'I am worried about Friday. What can you do before then?',
      expectedResponse:
        'Acknowledge the deadline and the worry in simple words, say honestly what can be done before Friday and what cannot be promised, agree one first step and a specific time for the next contact, and ask how his work can be kept safe and moving, for example through a colleague who can run the refresh.',
      minDifficulty: 'standard',
      effects: { temperature: 12, patience: -6 },
    },
    {
      id: 'cb-promise-friday',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 6, latestTurn: 11, afterFact: 'hf-lost-work' },
      statement:
        'Can you promise that it will work again before Friday? I need to be sure, because I cannot lose more work.',
      followUp: 'So can you promise, or not?',
      expectedResponse:
        'Do not promise a fix time that cannot be known. Say honestly what you can commit to, such as the next action and when he will hear from you, and what he can do now to protect his work.',
      minDifficulty: 'standard',
      effects: { temperature: 6, patience: -5 },
    },
  ],
  allowedCurveballs: ['deadline', 'unsupported-guarantee', 'previous-bad-experience'],

  expectedDiscoveryAreas: [
    'Which files and tasks are affected',
    'When it started and what changed',
    'What he is doing when it closes',
    'What it has cost him so far',
    'Who else is affected',
    'Deadlines and how to protect his work',
  ],
  successCriteria: [
    'Greets Rafael warmly, speaks in simple words, and checks that he has understood.',
    'Finds out when it started, what changed, which files are affected, and what Excel does when it closes.',
    'Discovers that only one workbook is affected and the moment in which Excel closes.',
    'Asks what it has cost him so far and acknowledges the pressure of the report before moving to solutions.',
    'Agrees a way to protect his work in the meantime and a specific time for the next contact, without promising a fix.',
    'Summarises the plan in simple words and checks that he is comfortable with it.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity', 'ownership-next-steps'],
  careExpectations: {
    communicate: [
      'Uses short sentences and common words, avoids idioms and jargon, and checks understanding with a simple question instead of assuming it.',
      'Repeats or rephrases patiently when Rafael asks, and summarises the plan in plain words at the end.',
    ],
    accountable: [
      'Says clearly that they will own the case, what they will do first, and when Rafael will hear from them.',
      'Is honest that the cause is not yet known and does not promise a fix before Friday.',
    ],
    resourceful: [
      'Asks whether every file or only one workbook is affected, and what he is doing when Excel closes, before suggesting generic fixes.',
      'Finds out whether a colleague or another route can keep the report moving, and how he can protect unsaved work.',
    ],
    empathetic: [
      'Acknowledges the lost work and the worry about the deadline in simple, sincere words.',
      'Stays calm and unhurried as he becomes more worried, and does not treat his questions about words as a problem.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Using idioms, jargon or fast speech, and moving on without checking that Rafael has understood.',
    'Starting with generic fixes, such as reinstalling, before asking which file is affected and when it began.',
    'Promising that it will be fixed before Friday.',
    'Speaking down to him because English is his second language, instead of simply using clear words.',
    'Ending the call without a time for the next contact or a way to protect his unsaved work.',
  ],
  goodBehaviours: [
    'Using simple, clear words and checking understanding often.',
    'Asking when it started, what changed and what Excel does when it closes.',
    'Asking whether every file or only one workbook is affected, and what he is doing when it closes.',
    'Asking about lost work and the deadline, and acknowledging both.',
    'Asking whether a colleague can keep the work moving in the meantime.',
    'Agreeing a first step, an owner and a specific time for the next contact.',
  ],
  expectedOutcome:
    'Rafael understands that the cause is not yet known, that it happens with one workbook and a reporting plug-in since the update, and that the engineer owns the case. He has a way to protect his work and keep his report moving, and a specific time when he will hear back. He ends the call calmer.',
  evaluatorNotes:
    "Case pattern: the IT team's weekend update restarted Rafael's laptop. Since then Excel closes within a minute whenever he presses the refresh button of a reporting plug-in in the large forecast workbook. Small files and new workbooks are fine, and a colleague whose laptop has not had the update can use the same file. He lost two hours of work yesterday, and the report is due on Friday morning. A strong call uses simple words and checks understanding, finds the one-workbook pattern and the refresh step, acknowledges the lost work and the deadline, does not guess the fix or promise Friday, and agrees how to protect his work and a specific time for the next contact.",
} satisfies ScenarioInput;

export default scenario;
