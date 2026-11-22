import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario (first contact), with a non-native English speaker. Everything here is fictional:
// people, organisation and case. Microsoft 365 Apps is a real product, so the scenario describes only
// what the customer sees and was told, never how licensing or activation works.
//
// Case context in the story (hidden from the trainee, and not confirmed): two weeks ago Agata
// moved from the sales office to the finance team and IT said it would update her access, so her
// licence may have changed. A personal account that she added once to open a family file is also
// signed in on the same computer, so the apps may be using the wrong account. People who moved with
// her have the same message, and those who were always in finance do not. She can edit in the
// browser, which fits either possibility: a changed licence that no longer covers the desktop apps
// but still covers the web apps, or desktop apps signed in with the personal account while the
// browser uses the work account. The accounts are looked after by a part-time IT person who is in two
// days a week, and the VAT return is due on Friday. Nothing on the call proves which cause applies,
// and the engineer should not guess or state licensing rules as fact.
//
// Agata is anxious and careful, and English is her second language. She uses simple words and may
// ask for a word to be explained. A strong call uses short, plain sentences with no idioms, checks
// understanding, finds the role change and the second account without leading her, finds who looks
// after the accounts, promises no time, and agrees who does what and when she will hear next.

const scenario = {
  id: 'm365-apps-licence-not-found',
  version: 1,
  title: 'Word and Excel say a licence cannot be found',
  shortTitle: 'Licence not found',
  listSummary:
    'A bookkeeper says Word and Excel cannot find a licence for her, so she cannot edit her files.',
  summary:
    'Agata Wojcik keeps the books at Tailspin Toys. Word and Excel say they cannot find a licence for her, and she cannot edit her files. English is her second language, and she is worried. Find out what is happening and agree what happens next.',
  tags: ['licence', 'activation', 'non-native speaker', 'anxious customer', 'first contact'],
  estimatedMinutes: 11,

  product: { id: 'm365-apps', area: 'Activation' },
  caseReference: 'SIM-410304',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-support', 'microsoft-learn'],
    behaviourCheck: 'checked-partly',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read current public pages on unlicensed-product errors, signing in with the right account and reduced functionality. The role-change link, the second-account cause and browser editing are the story's own, not confirmed. Stage-limited closure lines. AI-assisted review, not a mentor's.",
  },
  issueType: 'billing-licence',
  impact: 'medium',
  startingTemperature: 'anxious',
  proficiency: 'intermediate',
  style: 'non-native',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Agata Wojcik',
    speaker: 'female',
    role: 'Bookkeeper',
    organisation: 'Tailspin Toys',
    background:
      'Agata keeps the books for a toy company, including the monthly VAT return. She uses Excel and Word all day and is confident with her own tools, but she does not manage accounts or licences. English is her second language, which she speaks carefully. She worries about deadlines and checks every number twice.',
    voice:
      'Polite and careful. Uses simple words and short sentences, and avoids idioms. Asks the engineer to repeat or explain a word when she is not sure, and says so when she has not understood. Anxious about deadlines; she settles when she is given a clear plan and a time.',
  },
  environment: {
    details: [
      'Agata uses a desktop computer at the Tailspin Toys office, with Word and Excel open all day.',
      'The company has about fifty staff in an office and a warehouse, and a small finance team.',
      'The accounts and the VAT return are done in Excel.',
      'Agata does not look after accounts or licences herself.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Only Agata, as far as she knows.' },
    medium: { count: 3, summary: 'Three people who came to finance from the sales office.' },
    high: {
      count: 15,
      summary:
        'About fifteen people who came to finance from the sales office in the reorganisation.',
    },
  },
  customerObjective:
    'Edit her files in Word and Excel again, and know when it will work and what happens next.',
  customerExpectation:
    'Someone who speaks simply, explains what is going on without rushing her, takes the case on, and says when she will hear back.',
  desiredOutcome:
    'Agata understands in simple words what will be checked and by whom, knows when she will hear back, and has a way to keep working in the meantime.',
  previousTroubleshooting: [
    'Agata closed Word and Excel and opened them again.',
    'Agata restarted the computer, with the same result.',
  ],
  recentChanges: [
    'Agata moved from the sales office to the finance team two weeks ago, and IT said it would update her access.',
  ],

  publicBrief: {
    issue: 'Word and Excel say they cannot find a licence for her, so she cannot edit her files.',
    impact: {
      low: 'One person cannot edit her files, but there is some time.',
      medium: 'A few people cannot edit their files, and work is waiting.',
      high: "Many people cannot edit their files, and the team's work has stopped.",
    },
    objective: 'Speak simply, find out what happened and agree what happens next, with a time.',
    knownContext:
      'Agata Wojcik is a bookkeeper at Tailspin Toys. English is her second language, so simple words and checking that she has understood will help.',
    environment:
      'Agata uses a desktop computer at the office, with Word and Excel open all day for the accounts.',
  },
  brief: {
    situation:
      'A bookkeeper is calling because Word and Excel on her work computer say they cannot find a licence for her, and she cannot edit her files. She is anxious, and English is her second language.',
    goal: 'Find out what is happening without leading her, explain in simple words, and agree what happens next and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see her computer in this practice call, so rely on what she tells you.',
    ],
  },

  openingCore:
    'Word and Excel say they cannot find a licence for me. I can open my files, but I cannot change them.',
  impactVariants: {
    low: {
      summary:
        'I think it is only my computer, but I cannot edit my files, and I am a little worried.',
      detail:
        'It is my computer that has the problem, and I cannot edit anything in Word or Excel.',
      deadline: 'I would like it to work as soon as possible, please.',
    },
    medium: {
      summary:
        'I cannot edit my files in Word and Excel, and I am worried because I have work to finish.',
      detail: 'The monthly accounts are waiting, because we cannot edit our spreadsheets.',
      deadline: 'I need it to work soon, because my work is waiting.',
    },
    high: {
      summary:
        'Many of us cannot edit our files in Word and Excel, and the finance work is stopped.',
      detail: 'The finance work is waiting, because nobody in the team can edit the spreadsheets.',
      deadline: 'We need it to work today, because the finance work cannot wait.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I called yesterday about Word and Excel saying they cannot find a licence for me. I have not had any news since then.',
      brief:
        'Agata called yesterday about a licence message in Word and Excel. A case was logged and she has had no update.',
    },
    escalated: {
      opening:
        'This is my second call about Word and Excel saying they cannot find a licence for me. It is still not working, and I am worried.',
      brief:
        'Agata has contacted support twice about the licence message, and it is still not fixed. She is anxious.',
    },
    closure: {
      opening:
        'I am calling to check that Word and Excel work for me now, so we can close the case.',
      brief:
        'Agata expects to confirm that she can edit her files again and to understand what happened before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday',
      summary:
        'Agata reported that Word and Excel say they cannot find a licence for her. A case was logged and no update has been sent.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: 'There is a message at the top of Word and Excel about a licence. I can open and read my files, but I cannot change them.',
      intents: ['problem_description', 'error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration: 'I have looked at it many times, and it is always the same.',
      simple:
        'There is a message about a licence at the top of Word and Excel. I can read my files. I cannot change them.',
    },
    {
      id: 'kf-problem-closure',
      text: 'Word and Excel do not show the licence message now. I can edit my files, and I want to be sure it will stay like this.',
      intents: ['problem_description', 'error_message'],
      stages: ['closure'],
      simple:
        'Word and Excel do not show the licence message now. I can edit my files. I want to be sure it will stay like this.',
    },
    {
      id: 'kf-apps',
      text: 'It is Word and Excel. I have not looked at the other programs.',
      intents: ['problem_description', 'environment'],
      cues: [
        'which apps',
        'which programs',
        'which programmes',
        'what apps',
        'which office',
        'all the apps',
        'every app',
      ],
      simple: 'It is Word and Excel. I have not looked at the other programs.',
    },
    {
      id: 'kf-computer',
      text: 'I use the same desktop computer at the office every day. It is a company computer.',
      intents: ['environment'],
      simple: 'I use the same desktop computer at the office every day. It is a company computer.',
    },
    {
      id: 'kf-role',
      text: 'I am the bookkeeper. I keep the accounts, and I do the VAT return every month.',
      intents: ['account_details'],
      cues: [
        'what do you do',
        'what is your job',
        'what is your role',
        'your job title',
        'what work do you do',
        'what is your position',
      ],
      simple: 'I am the bookkeeper. I keep the accounts. I do the VAT return every month.',
    },
    {
      id: 'kf-tried',
      text: 'I closed Word and Excel and opened them again, and I restarted the computer. It is the same.',
      intents: ['already_tried'],
      simple:
        'I closed Word and Excel and opened them again. I restarted the computer. It is the same.',
    },
    {
      id: 'kf-outcome',
      text: 'I want to edit my files again, and I want to know when it will work.',
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'I want to edit my files again. I want to know when it will work.',
    },
    {
      id: 'kf-outcome-closure',
      text: 'I want to be sure I can keep editing my files, and to know what to do if the message comes back.',
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple:
        'I want to be sure I can keep editing my files. I want to know what to do if the message comes back.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-start',
      intents: ['timing_onset'],
      text: 'I think it was Monday, or maybe Tuesday. I am not sure.',
      confirmedText: 'It was Monday morning. On Friday everything worked.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-banner',
      intents: ['error_message'],
      cues: [
        'exact',
        'read me',
        'read it',
        'wording',
        'at the top',
        'message say',
        'it say',
        'bar say',
        'what words',
      ],
      stages: ['first-contact', 'follow-up', 'escalated'],
      checking: 'One moment, I will look at the top of the window.',
      text: 'It says Unlicensed Product at the top, and there is a bar with a button. I have not pressed it.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-licence-type',
      intents: ['account_details'],
      cues: [
        'which licence',
        'what licence',
        'type of licence',
        'licence do you have',
        'subscription',
        'what plan',
        'which plan',
      ],
      text: 'I do not know what licence I have. I never saw it, and nobody told me.',
      whoKnows: 'whoever looks after our accounts',
    },
    {
      id: 'uf-admin-settings',
      intents: ['account_details', 'environment'],
      cues: [
        'admin centre',
        'admin center',
        'admin portal',
        'admin settings',
        'can you check the licence',
        'assigned to you',
      ],
      text: 'I cannot see the company settings for licences. I think only the administrator can.',
      whoKnows: 'whoever looks after our accounts',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-catalogue',
      text: 'The toy catalogue for the autumn is nearly finished, so everyone is busy.',
    },
    {
      id: 'if-marathon',
      text: 'I am training for a half marathon, so I get up very early.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-role-change',
      importance: 'critical',
      label: 'She changed role recently',
      statement:
        'Two weeks ago I moved from the sales office to the finance team. IT said they would update my access, but I do not know what they changed.',
      revealWhen:
        'Asks whether anything changed recently, including anything about her job, her team or her access.',
      intents: ['recent_changes', 'account_details'],
      cues: [
        'anything change',
        'what changed',
        'any change',
        'anything new',
        'anything different',
        'before it started',
        'before this started',
        'job changed',
        'role changed',
        'new role',
        'new team',
        'moved to',
      ],
      hint: 'My job changed a little while ago.',
      statementTerse:
        'I moved from sales to finance two weeks ago. IT said they would update my access.',
      statementSimple:
        'Two weeks ago I moved from the sales office to the finance team. IT said they would update my access. I do not know what they changed.',
      missedConsequence:
        'The change in her role stays hidden, so the case is treated as a fault in the apps on her computer and nobody asks what may have changed in what she is allowed to use.',
      betterQuestion:
        'Has anything changed recently, for example in your job, your team or your access?',
    },
    {
      id: 'hf-second-account',
      importance: 'critical',
      label: 'A second account is on the computer',
      statement:
        'There are two accounts on this computer. My work one, and my personal one, which I added once to open a file from my family.',
      revealWhen:
        'Asks which accounts or email addresses are signed in on the computer, or whether she uses more than one account.',
      intents: ['account_details', 'environment'],
      cues: [
        'which account',
        'what account',
        'which email',
        'what email',
        'more than one account',
        'another account',
        'other account',
        'second account',
        'personal account',
        'signed in with',
        'sign in with',
        'which address',
      ],
      statementTerse: 'Two accounts on this computer: my work one and my personal one.',
      statementSimple:
        'There are two accounts on this computer. One is my work account. One is my personal account. I added it once to open a family file.',
      missedConsequence:
        'The second account stays hidden, so nobody checks which account the apps are using, and the case is about the work licence alone.',
      betterQuestion:
        'Which accounts or email addresses are signed in to Word and Excel on this computer?',
    },
    {
      id: 'hf-colleagues',
      importance: 'important',
      label: 'Who else has the message',
      statement:
        'Three of us who came from the sales office got the message. The colleagues who were always in finance could edit.',
      revealWhen:
        'Asks who else has the message, or whether colleagues in her team can still edit their files.',
      intents: ['affected_scope', 'workaround'],
      cues: [
        'anyone else',
        'anybody else',
        'someone else',
        'other people',
        'your colleagues',
        'who else',
        'how many people have',
        'how many people are affected',
        'how many of you',
        'any others',
        'same message',
        'same problem',
      ],
      statementTerse:
        'Three of us who came from the sales office. Colleagues who were always in finance are fine.',
      statementSimple:
        'Three of us who came from the sales office got the message. The colleagues who were always in finance could edit.',
      byImpact: {
        low: {
          statement:
            'As far as I know it is only me. My colleagues in finance can all edit their files.',
          statementTerse: 'Only me, as far as I know. My colleagues in finance can edit.',
          statementSimple:
            'As far as I know it is only me. My colleagues in finance can all edit their files.',
        },
        high: {
          statement:
            'About fifteen of us who came from the sales office got the message. The colleagues who were always in finance could edit.',
          statementTerse:
            'About fifteen of us who came from the sales office. Colleagues who were always in finance are fine.',
          statementSimple:
            'About fifteen of us who came from the sales office got the message. The colleagues who were always in finance could edit.',
        },
      },
      missedConsequence:
        'The pattern that follows the move from the sales office is missed, so the case is handled as one computer and not as something that may affect a whole group.',
      betterQuestion:
        'Does anyone else have the same message, and can your colleagues in finance still edit?',
    },
    {
      id: 'hf-deadline',
      importance: 'important',
      requiresImpactAck: true,
      label: 'When the work is due',
      statement:
        'The VAT return is due on Friday, and I need to edit my spreadsheets to finish it. If it is late, the company pays a penalty.',
      revealWhen:
        'Asks whether there is a deadline, what she needs to finish, or what depends on being able to edit her files.',
      intents: ['urgency_deadline', 'business_impact'],
      cues: [
        'deadline',
        'how urgent',
        'by when',
        'when do you need',
        'how soon',
        'is due',
        'work due',
        'need it by',
        'time pressure',
        'what depends on',
        'to finish',
        'at stake',
      ],
      statementTerse: 'VAT return due Friday. I must edit my spreadsheets to finish it.',
      statementSimple:
        'The VAT return is due on Friday. I must edit my spreadsheets to finish it. If it is late, the company pays a penalty.',
      byImpact: {
        low: {
          statement:
            'The month-end summary is due next week, so I have some time, but I want to finish it early.',
          statementTerse: 'Month-end summary due next week. I want to finish early.',
          statementSimple:
            'The month-end summary is due next week. I have some time, but I want to finish it early.',
        },
        high: {
          statement:
            'The VAT return is due on Friday, and nobody in finance can edit the spreadsheets. If it is late, the company pays a penalty.',
          statementTerse:
            'VAT return due Friday. Nobody in finance can edit. A late return costs a penalty.',
          statementSimple:
            'The VAT return is due on Friday. Nobody in finance can edit the spreadsheets. If it is late, the company pays a penalty.',
        },
      },
      missedConsequence:
        'The real time limit never comes out, so the plan is made without the Friday limit and she leaves anxious.',
      betterQuestion:
        'Is there a deadline, and what do you need to finish that depends on editing your files?',
    },
    {
      id: 'hf-it-person',
      importance: 'important',
      label: 'Who looks after accounts',
      statement:
        'A part-time IT person looks after our accounts. He is only in on Tuesdays and Thursdays, and I only have his email.',
      revealWhen:
        'Asks who looks after accounts or licences at the company, or how she could reach them.',
      intents: ['account_details'],
      cues: [
        'who looks',
        'who manages',
        'who is responsible',
        'who administers',
        'administrator',
        'it department',
        'it person',
        'your it',
        'who assigns',
        'who gave you',
        'who set up',
        'who can change',
      ],
      statementTerse: 'A part-time IT person. In on Tuesdays and Thursdays. I only have his email.',
      statementSimple:
        'A part-time IT person looks after our accounts. He is only in on Tuesdays and Thursdays. I only have his email.',
      missedConsequence:
        'Nobody asks who looks after the accounts, so the plan depends on someone she cannot reach on most days, and she has no clear message to send him.',
      betterQuestion:
        'Who looks after accounts and licences at your company, and how can you reach them?',
    },
    {
      id: 'hf-web-works',
      importance: 'helpful',
      minDifficulty: 'standard',
      knowledge: 'after-checking',
      checking: 'Please wait, I will try it now.',
      label: 'She can edit in the browser',
      statement:
        'It works in the browser. I opened the same spreadsheet there and I can edit it, but I do not want to do the whole return that way.',
      revealWhen:
        'Asks whether she can edit in a web browser, or whether there is any other way to keep working in the meantime.',
      intents: ['workaround'],
      cues: [
        'in the browser',
        'on the web',
        'web version',
        'online version',
        'in a browser',
        'office for the web',
        'web app',
        'in the meantime',
        'work around',
        'workaround',
      ],
      statementTerse: 'In the browser I can edit. I do not want to do the whole return there.',
      statementSimple:
        'It works in the browser. I opened the same spreadsheet there and I can edit it. I do not want to do the whole return that way.',
      missedConsequence:
        'A way to keep working before the deadline is missed, and she waits with no way to edit anything.',
      betterQuestion:
        'Can you edit the same files in a web browser, or is there another way to keep working in the meantime?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-computer-broken',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        'I think something is wrong with my computer, or with the programs. Maybe they need to be installed again.',
      truth:
        'Nothing shows that the computer or the programs are faulty. In this story the message may follow a change to what she is allowed to use, or a second account on the same computer. Neither is confirmed.',
    },
  ],

  curveballs: [
    {
      id: 'cb-promise-today',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Can you promise it will work? I cannot be late with my work.',
      followUp: 'So will it work, yes or no?',
      expectedResponse:
        'Do not promise a time you cannot know. Say honestly what you will do, who else has to act and when she will hear from you, and ask what she needs to tell her manager.',
      minDifficulty: 'standard',
      effects: { temperature: 5, patience: -5 },
    },
    {
      id: 'cb-someone-else',
      type: 'ask-manager',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement: 'Is there somebody else I can speak to? I am not sure I explained it well.',
      followUp: 'I would feel better if I could speak to somebody with more experience.',
      expectedResponse:
        'Do not take it as an insult. Reassure her that you understood, repeat the key points in simple words, say what you will do and when, and offer a route to a colleague if she still wants one.',
      minDifficulty: 'standard',
      effects: { temperature: 6, trust: -6, patience: -4 },
    },
  ],
  allowedCurveballs: [
    'unsupported-guarantee',
    'ask-manager',
    'go-silent',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'What she sees on screen',
    'When it started',
    'What changed recently',
    'Which accounts are in use',
    'Who else is affected',
    'Deadlines and ways to keep working',
    'Who looks after accounts',
  ],
  successCriteria: [
    'Greets Agata warmly, speaks in short, plain sentences with no idioms, and checks that she has understood.',
    'Finds out what the message says, when it began and who else has it, without leading her.',
    'Discovers the recent change to her role and the second account on the computer through open questions.',
    'States no licensing rule as fact, is honest that the cause is not yet known and does not promise a time.',
    'Finds out who looks after accounts and agrees who does what, including a way to keep working before the deadline.',
    'Summarises the plan in simple words and checks that she is comfortable with it.',
  ],
  coachingFocus: ['clarity', 'scoping-discovery', 'ownership-next-steps'],
  careExpectations: {
    communicate: [
      'Uses short sentences and common words, avoids idioms and jargon, explains a word such as "licence" simply when she asks, and checks understanding with a short question.',
      'Repeats the plan in order in plain words at the end: what happens first, who does it and when she hears next.',
    ],
    accountable: [
      'Says clearly what they will do, who else has to act and when she will hear back, and is honest that the cause is not yet known.',
      'Does not promise when she will be able to edit again, because the engineer cannot yet see what is behind it.',
    ],
    resourceful: [
      'Finds out what she sees, when it began and what changed, and asks which accounts are signed in, without leading her.',
      'Finds out who looks after accounts, and gives her a short, clear note to pass to them.',
    ],
    empathetic: [
      'Recognises the worry about the deadline in simple, sincere words, and slows down when she is anxious.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Using idioms or jargon such as "tenant", "provisioned" or "assigned a SKU", and moving on without checking she has understood.',
    'Stating how licences work as if it were certain, or telling her the cause before asking what changed.',
    'Asking her to uninstall or reinstall the programs before finding out what changed and which accounts are in use.',
    'Promising that it will work today or by Friday.',
    'Treating her English as the problem instead of simply using clear words.',
  ],
  goodBehaviours: [
    'Using simple, clear words and checking understanding often.',
    'Asking what the message says, when it started and what changed recently, one question at a time.',
    'Asking which accounts or email addresses are signed in, without suggesting the answer.',
    'Asking who else has the message and who looks after accounts.',
    'Agreeing who does what, a way to keep working in the meantime and a time for the next contact.',
  ],
  expectedOutcome:
    'Agata understands that the cause is not yet known, that her role changed recently and that a second account is on the computer, and that the person who looks after accounts needs to check. She knows who does what, has a way to keep working in the meantime and knows when she will hear back. She ends the call calmer.',
  evaluatorNotes:
    'Case context in the story, not confirmed: two weeks ago Agata moved from the sales office to the finance team and IT said it would update her access, so her licence may have changed. A personal account that she added once is also signed in on the same computer, so the apps may be using the wrong account. People who came from the sales office have the same message, and she can edit in the browser, which fits either cause. A part-time IT person looks after accounts two days a week, and the VAT return is due on Friday. Nothing proves which cause applies. A strong call uses simple words, finds the role change and the second account without leading, finds who looks after accounts, states no licensing rule as fact, promises no time and agrees who does what.',
} satisfies ScenarioInput;

export default scenario;
