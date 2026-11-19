import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario. Everything here is fictional: people, organisations and product.
//
// Root cause (hidden from the trainee): Tobias, a new administrator, tidied the region filters on the
// report settings on the Thursday before last. Orders created after that no longer match the
// report's filter, so they are hidden from it; older orders still show. Nothing was deleted and a raw
// export still lists every order. Ingrid believes the data was lost and has already sent the wrong
// numbers to a customer. A strong call turns her approximations into specifics one question at a
// time, finds the change, the pattern and the export, and corrects the lost-data belief gently.

const scenario = {
  id: 'missing-orders-after-settings-change',
  version: 1,
  title: 'Orders missing from the weekly report',
  summary:
    'An operations manager says about two weeks of customer orders are missing from her weekly report, and thinks it began after someone tidied the settings.',
  tags: ['missing data', 'reports', 'settings change', 'vague customer'],
  estimatedMinutes: 10,

  issueType: 'data-missing',
  impact: 'medium',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'vague',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Ingrid Solheim',
    role: 'Operations manager',
    organisation: 'Wingtip Wholesale',
    background:
      "Ingrid runs dispatch planning for a food wholesaler. She builds each week's plan from the Monday orders report and is used to the numbers being right. She is comfortable with reports and spreadsheets but has never seen the settings behind them.",
    voice:
      'Speaks in approximations: "a lot", "a couple of weeks", "some of the bigger ones". Becomes precise when asked one concrete thing at a time, and gets short when she is given a long list of questions.',
  },
  environment: {
    product: 'the Tailspin order reports',
    details: [
      'A weekly orders report is built every Monday morning and goes to the operations team',
      'Dispatch and staffing for the coming week are planned from that report',
      'Orders are entered by the sales desk during the day and are stored straight away',
      'Report settings such as regions and filters are managed by the company administrators',
      'Ingrid has a normal user role and cannot open the settings pages',
    ],
  },
  customerObjective:
    'Get the missing orders back into the weekly report today, and know whether the numbers she has already used can be trusted.',
  brief: {
    situation:
      'An operations manager is calling because customer orders are missing from her weekly report. She is frustrated and is not precise about what is missing or when it began.',
    goal: 'Turn a vague description into specifics, work out whether any data was really lost, and agree a clear next step with a time for the next update.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
    ],
  },

  openingCore:
    'About two weeks of customer orders are missing from my weekly report. I think it started after someone tidied the settings.',
  impactVariants: {
    low: {
      summary: 'My planning numbers are wrong, but I have a few days before the next dispatch run.',
      detail:
        "I plan dispatch from this report. With the numbers this low I can't trust the plan, but the next big run is later in the week, so there is a little time.",
      deadline: "I'd like it sorted before the dispatch run later this week.",
    },
    medium: {
      summary: "I plan dispatch for next week from this report, and I can't use it as it is.",
      detail:
        "The operations team uses the weekly report to plan dispatch and staffing. With the numbers this low we can't plan properly, and I have a planning meeting tomorrow morning.",
      deadline: 'I need usable numbers before the planning meeting tomorrow morning.',
    },
    high: {
      summary:
        'The warehouse schedule for next week is built from this report, and the numbers are far too low to use.',
      detail:
        "Next week's warehouse schedule, agency staffing and customer deliveries are all planned from it. If the numbers are wrong we under-staff and some customers get late deliveries.",
      deadline: 'The schedule has to be locked this afternoon.',
    },
  },
  stageFrames: {
    'first-contact': {
      opening: "I'm calling about a problem I need help with.",
      brief: 'This is the first time the customer has contacted support about the missing orders.',
    },
    'follow-up': {
      opening:
        "I reported missing orders in my weekly report earlier this week, and I haven't heard anything back.",
      brief: 'Ingrid reported the missing orders earlier this week and has not had an update.',
    },
    escalated: {
      opening:
        'This is my second call about orders missing from my report, and nothing has changed since the first one.',
      brief:
        'Ingrid has already called once about this. Nothing has been fixed and she is running short of time.',
    },
    closure: {
      opening:
        "I'm calling to check that the missing orders are back in my report, so we can close this off.",
      brief:
        'Ingrid expects to confirm that the orders are back in the report and to close the case.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier this week',
      summary:
        'Ingrid reported by email that orders were missing from her weekly report. A case was logged with no further detail.',
    },
    {
      when: 'The next day',
      summary: 'An automatic acknowledgement was sent. No engineer has contacted her.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-weekly-report',
      text: 'It is the weekly orders report that goes to the operations team on Monday mornings. I plan dispatch from it.',
      intents: ['problem_description', 'environment'],
      elaboration:
        'I have used it every Monday for years. The numbers have always been right, so I never had a reason to double-check them.',
      simple: 'It is the weekly orders report. I use it every Monday to plan dispatch.',
    },
    {
      id: 'kf-noticed-monday',
      text: 'I first noticed on Monday afternoon that the totals looked low.',
      intents: ['timing_onset', 'problem_description'],
      simple: 'On Monday afternoon I saw that the numbers looked too low.',
    },
    {
      id: 'kf-reran',
      text: "I've run the report again a couple of times and I get the same numbers.",
      intents: ['already_tried', 'reproducibility'],
      simple: 'I ran the report again. I get the same numbers.',
    },
    {
      id: 'kf-sales-desk',
      text: 'The sales desk says they entered everything as usual, so I do not think anyone forgot to enter the orders.',
      intents: ['environment', 'problem_description'],
    },
    {
      id: 'kf-outcome',
      text: 'I want the orders back in the report, and I want to know I can trust the numbers again.',
      intents: ['expected_outcome'],
      simple: 'I want the orders back in the report. I want to trust the numbers again.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-settings-change',
      importance: 'critical',
      label: 'Region filters were tidied on a Thursday afternoon',
      statement:
        'The administrator tidied the region filters on the Thursday before last, in the afternoon. He posted a short note in the operations channel saying it was a routine clean-up.',
      revealWhen:
        'Asks whether anything changed before the problem began, what was changed or when, or when the report last looked right.',
      intents: ['recent_changes', 'timing_onset'],
      hint: 'I think it was a Thursday afternoon, because there was a note in the operations channel.',
      statementTerse:
        'The region filters were tidied on a Thursday afternoon, about two weeks ago.',
      statementSimple:
        'The administrator cleaned up the region filters on a Thursday afternoon. He wrote a short note in the operations channel.',
      missedConsequence:
        'Without the date and the change, the missing orders cannot be tied to one settings change, and the engineer may treat it as lost data.',
      betterQuestion: 'When did the report last look right, and did anything change around then?',
    },
    {
      id: 'hf-only-newer-orders',
      importance: 'important',
      label: 'Only orders after the change are missing',
      statement:
        'Everything entered before that Thursday afternoon is in the report as normal. It is only the orders entered after it that are missing.',
      partialStatement:
        'It seems to be mostly the more recent orders, but I have not gone through them one by one.',
      revealWhen:
        'Asks which orders or dates are missing, whether older orders still show, or what the earliest missing date is.',
      intents: ['affected_scope', 'reproducibility'],
      partialIntents: ['problem_description'],
      cues: [
        'which orders',
        'which ones',
        'all orders',
        'every order',
        'all of the orders',
        'only some',
        'just some',
        'older',
        'earlier',
        'date range',
        'which dates',
        'what dates',
      ],
      hint: 'I think the older orders are fine, actually.',
      statementTerse: 'Orders from before that Thursday are fine. Only the newer ones are missing.',
      statementSimple:
        'The older orders are fine. Only the orders after that Thursday are missing.',
      missedConsequence:
        'Believing every order is affected, the engineer may suspect a major data loss instead of a rule that hides only newer records.',
      betterQuestion:
        'Which dates are missing, and do the older orders still show up in the report?',
    },
    {
      id: 'hf-raw-export',
      importance: 'important',
      label: 'The raw export still shows the orders',
      statement:
        'Wei, our analyst, pulled a raw export of all the orders yesterday, and the missing ones are in it. I was not sure what that meant, so I did not follow it up.',
      revealWhen:
        'Asks whether the missing orders can be seen anywhere else, for example in an export, a download, another screen or the underlying data.',
      intents: ['workaround', 'reproducibility', 'already_tried'],
      cues: [
        'export',
        'raw',
        'download',
        'spreadsheet',
        'elsewhere',
        'somewhere else',
        'another way',
        'other way',
        'different screen',
        'order list',
        'directly',
        'underlying',
      ],
      statementTerse: 'Wei exported all the orders yesterday and the missing ones are there.',
      statementSimple:
        'My analyst Wei took out a full list of the orders yesterday. The missing orders are in that list. I did not know what that meant.',
      missedConsequence:
        'The orders are not lost, but without this the engineer cannot confirm that the data is intact, and she keeps believing it is gone.',
      betterQuestion:
        'Can you see those orders anywhere else, such as an export or a different screen?',
    },
    {
      id: 'hf-report-already-sent',
      importance: 'important',
      minDifficulty: 'standard',
      minTrust: 40,
      label: 'The wrong numbers already went to a customer',
      statement:
        'On Monday morning I sent the weekly summary to Coho Foods using those numbers, before I had noticed anything wrong. Their buyer has written back asking why their orders dropped so much, and I have not replied yet.',
      revealWhen:
        'Asks whether the report has been shared with or used by anyone else, for example customers, or what has already been done with the numbers.',
      intents: ['business_impact', 'previous_contact', 'affected_scope'],
      cues: [
        'sent',
        'shared',
        'forwarded',
        'customer',
        'customers',
        'anyone else',
        'who uses',
        'who sees',
        'who relies',
        'gone out',
        'external',
        'client',
      ],
      statementTerse:
        'I sent the weekly summary to Coho Foods on Monday morning. Their buyer has asked about it.',
      statementSimple:
        'On Monday morning I sent the weekly summary to a customer, Coho Foods. I did not know the numbers were wrong. Their buyer wrote to ask why. I have not replied.',
      missedConsequence:
        'A customer is already holding wrong numbers and waiting for an answer. Missing this leaves her without help on what to say, and the engineer without the real urgency.',
      betterQuestion:
        'Has the report already been shared with anyone outside the team, such as a customer?',
    },
    {
      id: 'hf-new-administrator',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'A new administrator made the change',
      statement:
        'It was Tobias, our new administrator, who made the change. He started last month and was working through a list of old settings to clear up.',
      revealWhen:
        'Asks who made the change, who looks after the settings, or who has been working on the system recently.',
      intents: ['recent_changes', 'account_details'],
      cues: [
        'who ',
        'admin',
        'administrator',
        'someone',
        'person',
        'responsible',
        'looks after',
        'manages',
        'made the change',
        'who changed',
      ],
      statementTerse: 'Tobias, our new administrator, made the change.',
      statementSimple:
        'Our new administrator, Tobias, made the change. He started last month and was cleaning up old settings.',
      missedConsequence:
        'The engineer does not know who can confirm what was changed, so the fix waits on guesswork and the customer chases alone.',
      betterQuestion: 'Who made that change, and can they tell us exactly what they changed?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-data-lost',
      statement: 'I think the system has lost those orders.',
      truth:
        'The orders are still stored. A settings change hides orders created after it from the report, and a raw export still shows them.',
    },
    {
      id: 'ia-reenter-orders',
      statement: 'I expect the sales desk will have to type all the missing orders in again.',
      truth:
        'No re-entry is needed. The orders exist, and the report settings need correcting so that they show again.',
    },
  ],

  curveballs: [
    {
      id: 'cb-promise-not-lost',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        'Can you promise me those orders are not gone for good? I need to tell my general manager something definite today.',
      followUp: 'So can I tell him they are safe, yes or no?',
      expectedResponse:
        'Do not promise before checking. Say what you can confirm so far and what you will check, give a time for the answer, and offer a short plain statement she can pass to her general manager.',
      minDifficulty: 'standard',
      effects: { temperature: 5, patience: -5 },
    },
  ],

  expectedDiscoveryAreas: [
    'Which orders and dates are missing',
    'What changed before it began',
    'Whether the orders show up anywhere else',
    'Who made recent changes',
    'Who has already used the report',
  ],
  successCriteria: [
    'Turns vague descriptions into specifics, one focused question at a time, without cross-examining her.',
    'Finds out when the report last looked right and what changed around then.',
    'Establishes that older orders are fine and only newer ones are missing.',
    'Discovers that the raw export still shows the orders, and gently corrects the belief that data was lost.',
    'Finds out the numbers have already gone to a customer and helps her plan what to say.',
    'Agrees a specific next step and a time for the next update.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity', 'ownership-next-steps'],
  poorApproaches: [
    'Agreeing that the data has been lost, or promising a restore from backup, before checking whether anything is actually gone.',
    'Firing a long list of questions at once, which makes a vague customer vaguer.',
    'Using terms such as "retention rule" or "filter criteria" without explaining them.',
    'Pushing for an exact count of missing orders instead of asking for one concrete example.',
    'Ending the call without saying what she can tell her customer or when she will hear back.',
  ],
  goodBehaviours: [
    'Asking for one concrete example, such as one missing order and the date it was entered.',
    'Asking what changed and when, and who looks after the settings.',
    'Asking whether the missing orders can be seen anywhere else, such as an export.',
    'Asking who has already used or received the report.',
    'Explaining in plain words that the orders look hidden, not lost, and what happens next.',
  ],
  expectedOutcome:
    'Ingrid understands that her orders are very likely hidden by a settings change rather than lost. The engineer has the change date, knows only newer orders are affected and that the export shows them, knows the wrong numbers went to a customer, and agrees a next step, a time for the next update and what she can tell the customer meanwhile.',
  evaluatorNotes:
    "Root cause: Tobias, the new administrator, changed a regional filter on the report settings on the Thursday before last. Orders created after that no longer match the report's filter and are hidden from it, while older orders still show. Nothing was deleted: a raw export still lists every order. Ingrid assumes the data was lost and has already sent the wrong numbers to a customer, Coho Foods. A strong call gets specifics one question at a time, finds the change date, that only newer orders are affected and that the export shows them, gently corrects the lost-data belief, finds out about the customer, and agrees next steps and a next-update time, including what she can tell the customer.",
} satisfies ScenarioInput;

export default scenario;
