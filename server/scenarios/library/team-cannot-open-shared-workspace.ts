import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Spotlight scenario for the live demo. Everything here is fictional: people, organisation and product.
//
// Root cause (hidden from the trainee): Helen Voss, who owns the shared workspace, reorganised the
// access groups last night before starting her leave and moved the workspace into a new group. The
// team's old group lost access. Helen and two designers who joined last month (already in the new
// group) can still open it. Nothing is broken; it is a permissions change an administrator can
// reverse. Daniel has been sent back and forth between his own IT team and the vendor's help page.
// A strong call takes ownership early, finds the pattern with plain questions, protects the
// deliverable with the offline copy and gives a specific time for the next update.

const scenario = {
  id: 'team-cannot-open-shared-workspace',
  version: 1,
  spotlight: true,
  title: 'Team cannot open the shared project workspace',
  summary:
    'A project lead says nobody on his six-person team can open their shared project workspace, and a client deliverable is due today.',
  tags: ['access', 'team', 'deadline', 'ownership', 'demo'],
  estimatedMinutes: 10,

  issueType: 'sign-in-access',
  impact: 'medium',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'demanding',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Daniel Osei',
    role: 'Project lead',
    organisation: 'Proseware Consulting',
    background:
      'Daniel leads a delivery team of six at a mid-sized consultancy. He is not an IT specialist but knows the tools his team uses all day. He has been at his desk since early morning with a client report to finish, and he wants one person to take charge.',
    voice:
      'Direct and brisk, in short sentences. Asks for names, times and commitments. Not rude, but worn down. Eases noticeably when someone owns the problem and gives him a specific time; gets curt if he is sent somewhere else again.',
  },
  environment: {
    product: 'the Contoso project workspace',
    details: [
      'A shared workspace that holds the drafts, data and notes for the Adventure Works report',
      'Six people on the team use it every day, on laptops, with their normal work sign-ins',
      'Access to each workspace is managed through groups that the workspace owner sets up',
      'Email, the calendar and the other tools all work normally for the team',
      'The company has its own IT team that looks after accounts and devices',
    ],
  },
  customerObjective:
    'Get the whole team back into the workspace so the Adventure Works report can go out today, and have one person who owns the problem until it is fixed.',
  brief: {
    situation:
      'A project lead is calling because nobody on his six-person team can open their shared project workspace. A client deliverable is due today. He is short on patience and wants someone to take charge.',
    goal: 'Find out what is happening and who is affected, take ownership of the problem, and make sure he knows exactly what happens next and when he will hear from you.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see his workspace in this practice call, so rely on what he tells you.',
    ],
  },

  openingCore:
    "Nobody on my team can open our shared project workspace, and we can't get to any of our files.",
  impactVariants: {
    low: {
      summary:
        "Six of us are shut out, but what's due today is only a progress update, so it's more of a hold-up than an emergency.",
      detail:
        "Everyone on the team works in that workspace, so all six of us are stuck. The progress update for Adventure Works is due at five this afternoon, but they've said a few hours late would be fine.",
      deadline: "I'd still like to be back in well before five.",
    },
    medium: {
      summary: 'Six of us are stuck, and a client deliverable is due by the end of today.',
      detail:
        'The final Adventure Works report is in that workspace, with the data, the charts and the sign-off notes. Two of my team have worked late all week on it, and the client has already moved the date once for us.',
      deadline: 'It has to be with the client by five this afternoon.',
    },
    high: {
      summary: "Six of us are stuck, and our biggest client's report is due this afternoon.",
      detail:
        'The Adventure Works board meets first thing tomorrow, our director has promised them the report by five today, and she wants to see it at midday. If it is late, the client has said they will look at other suppliers for the next phase.',
      deadline:
        'Our director wants to see it by midday, and the client needs it by five at the latest.',
    },
  },
  stageFrames: {
    'first-contact': {
      opening: 'I need to report a problem.',
      brief:
        'This is the first time the customer has spoken to your team about this problem. No case has been logged yet.',
    },
    'follow-up': {
      opening: "I'm following up on the case I logged earlier today, and nobody has been in touch.",
      brief: 'Daniel logged a case earlier today about the same problem and has not heard back.',
    },
    escalated: {
      opening: 'This is my second call about this today, and nobody has told me who owns it.',
      brief:
        'Daniel has already contacted your team once today. The problem is not fixed and he feels passed around.',
    },
    closure: {
      opening:
        "I'm calling to confirm that my team can open the workspace again, so we can close this off.",
      brief:
        'Daniel expects to confirm that his team has access again and to understand what happened before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier today',
      summary:
        'Daniel called to report that his team could not open a shared project workspace. A case was logged and he was told someone would look at it.',
    },
    {
      when: 'Mid-morning',
      summary:
        'An automatic acknowledgement was sent. No engineer has been assigned or has contacted him.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-team',
      text: 'There are six of us on the team, and we all use that workspace every day.',
      intents: ['problem_description', 'affected_scope'],
      elaboration:
        'Every draft, chart and note for the Adventure Works report is in there, so there is nothing for us to work on without it.',
      simple: 'There are six people on my team. We all use the workspace every day.',
    },
    {
      id: 'kf-everything-else',
      text: 'Everything else works. Our email and the other tools are fine, and it is the same on laptops and on phones. It is only this workspace.',
      intents: ['problem_description', 'environment', 'reproducibility'],
      simple: 'Email and our other tools work. Only this workspace does not open.',
    },
    {
      id: 'kf-usual-way',
      text: 'We open it the way we always do, from the link on our team page, with our normal work sign-in.',
      intents: ['environment', 'account_details'],
    },
    {
      id: 'kf-outcome',
      text: 'I want everyone back in, and I want to know who is looking after this until it is done.',
      intents: ['expected_outcome'],
      simple: 'I want my team back in the workspace. I want one person to look after this.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-access-changed-last-night',
      importance: 'critical',
      label: 'Access was reorganised last night',
      statement:
        'Last night at about eight, Helen, who owns the workspace, posted in our team chat that she was reorganising the access groups before her leave started. She did not say what she was changing, and nobody thought it would affect us.',
      revealWhen:
        'Asks whether anything changed recently before the problem began, such as settings, permissions, people, or something a colleague or administrator did.',
      intents: ['recent_changes'],
      hint: 'There was a message in our team chat last night about access, now that I think of it.',
      statementTerse:
        'Helen, who owns it, posted last night that she was reorganising the access groups before her leave.',
      statementSimple:
        'Last night Helen wrote in our team chat that she was changing the access groups. She owns the workspace. Her leave started after that.',
      missedConsequence:
        'The cause stays hidden and the case looks like an outage, so Daniel is sent back to his own IT team and loses more of the day.',
      betterQuestion:
        'Did anything change recently, either with the workspace itself or with who has access to it?',
    },
    {
      id: 'hf-exact-message',
      importance: 'important',
      label: 'The exact permission message',
      statement:
        'It says, "You do not have permission to open this workspace. Contact the workspace owner to request access."',
      partialStatement: 'It says something about permission, and then it will not open.',
      revealWhen:
        'Asks for the exact wording of the message or error shown when the workspace will not open, or asks the customer to read it out.',
      intents: ['error_message'],
      partialIntents: ['problem_description'],
      hint: 'The screen gives a message about access, not just a blank page.',
      statementTerse: 'It says we do not have permission and to contact the workspace owner.',
      statementSimple:
        'The message says we do not have permission to open the workspace. It says to contact the workspace owner.',
      missedConsequence:
        'Without the wording, the engineer may treat this as an outage or a sign-in fault and start the wrong checks.',
      betterQuestion: 'Can you read me exactly what the message says when you try to open it?',
    },
    {
      id: 'hf-when-it-started',
      importance: 'helpful',
      label: 'Worked last evening, blocked this morning',
      statement:
        'It was working at about six last night, when Lena saved her last changes. The first person to try this morning, at about half past eight, was already blocked.',
      revealWhen:
        'Asks when the problem started, when it last worked, or when it was first noticed.',
      intents: ['timing_onset'],
      hint: 'It was fine when we finished yesterday.',
      statementTerse:
        'It worked at about six last night and was blocked by half past eight this morning.',
      statementSimple:
        'It worked at six last night. At half past eight this morning it did not work.',
      missedConsequence:
        'Without the time window, the start of the problem cannot be matched to the change made the evening before.',
      betterQuestion:
        'When did you last open it successfully, and when did you first notice it was blocked?',
    },
    {
      id: 'hf-who-can-open',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Some people can still open it',
      statement:
        'It still opens for Helen, who said so in the team chat before she went offline for her leave, and for two designers who joined last month, Tariq and Fatima. It is only the six of us who cannot.',
      revealWhen:
        'Asks whether anyone at all can still open the workspace, or whether everyone is affected or only some people, including people outside the team.',
      intents: ['affected_scope', 'reproducibility'],
      cues: [
        'anyone',
        'anybody',
        'everyone',
        'everybody',
        'who else',
        'who can',
        'others',
        'other people',
        'other teams',
        'other users',
        'colleagues',
        'exception',
      ],
      statementTerse:
        'It still opens for Helen and for two designers who joined last month. Not for us.',
      statementSimple:
        'Helen can still open it. Two designers who joined last month can also open it. The six of us cannot.',
      missedConsequence:
        'The pattern that points to a change in who has access stays hidden, and the engineer keeps hunting for a general fault while the team stays locked out.',
      betterQuestion: 'Is there anyone at all who can still open it?',
    },
    {
      id: 'hf-already-tried',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Already sent back and forth between IT and the vendor',
      statement:
        'I called our internal IT team first thing, and they said it was a problem with the workspace service and told me to contact you. The help page on your site then told me to speak to my own IT administrator.',
      revealWhen:
        'Asks what the customer has already tried, or who they have already spoken to or contacted about the problem.',
      intents: ['already_tried', 'previous_contact'],
      statementTerse:
        'Our IT team said it is a service problem. Your help page said to ask our IT administrator.',
      statementSimple:
        'I called our own IT team first. They said it is a service problem and told me to call you. Your help page said to ask our IT administrator.',
      missedConsequence:
        'Daniel is sent back to his own IT team a second time, which repeats the runaround that has already worn his patience down.',
      betterQuestion: 'What have you already tried, and who have you spoken to so far?',
    },
    {
      id: 'hf-offline-copy',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'Lena has an offline copy',
      statement:
        'Lena has an offline copy of the report folder on her laptop from yesterday afternoon. It is missing her last couple of hours of changes, and only one person can work on it at a time.',
      revealWhen:
        'Asks whether there is a workaround, or any way to keep the work moving in the meantime, such as a saved or offline copy of the files.',
      intents: ['workaround'],
      statementTerse:
        'Lena has an offline copy from yesterday afternoon. It is a little out of date.',
      statementSimple:
        'Lena has a copy of the files on her laptop from yesterday afternoon. It does not have her last changes.',
      missedConsequence:
        'The deliverable stays at risk for as long as access takes to restore, when a stop-gap copy could keep the report moving.',
      betterQuestion:
        'Is there any way to keep the report moving in the meantime, such as a copy of the files someone saved?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-service-fault',
      statement:
        'I think this is a fault with your service, because none of us have done anything to the workspace.',
      truth:
        "The service is working normally. Access to the workspace was changed last night, so the team's old group lost permission. This is a change to who has access, not a fault.",
    },
  ],

  curveballs: [
    {
      id: 'cb-ask-for-manager',
      type: 'ask-manager',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        "I'd like to speak to your manager, or to whoever can actually take charge of this. I need one person who owns it.",
      followUp: 'I still want a name, and a way to reach that person directly.',
      expectedResponse:
        'Acknowledge the frustration without defending anyone, say plainly that you will own the case from here, explain what you will do first and by when, and offer a manager route only if he still wants one.',
      minDifficulty: 'starter',
      effects: { temperature: 8, trust: -8, patience: -6 },
    },
    {
      id: 'cb-hard-deadline',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 7, whenImpactUnacknowledged: true },
      statement:
        'I should be clear about the time. The report has to be with the client at five this afternoon, and I need to know what you can do before then.',
      followUp: "I'm running out of afternoon. What exactly can you do in the next hour?",
      expectedResponse:
        'Acknowledge the deadline, say honestly what can and cannot be promised, agree what you will do first and give a specific time for the next update. Ask about a stop-gap for the report if one has not come up.',
      minDifficulty: 'starter',
      effects: { temperature: 6, patience: -8 },
    },
  ],

  expectedDiscoveryAreas: [
    'When it last worked and when it stopped',
    'What the screen says when it is blocked',
    'Anything that changed recently',
    'Who can and cannot open the workspace',
    'What has already been tried',
    'How to keep the deliverable moving',
  ],
  successCriteria: [
    'Acknowledges the deadline and how long the morning has been before asking questions.',
    'Finds the exact message, when it last worked, and what changed last night.',
    'Discovers that the owner and two newer colleagues can still open the workspace, and reads that as a change in access rather than a fault.',
    "Takes clear ownership and does not send him back to his IT team or the vendor's help page.",
    'Agrees a stop-gap for the report and a specific time for the next update.',
    'Summarises the cause and the next steps in plain language before ending the call.',
  ],
  coachingFocus: ['scoping-discovery', 'empathy-deescalation', 'ownership-next-steps'],
  poorApproaches: [
    "Telling him to go back to his IT team or to the vendor's help page, which repeats the runaround he is already tired of.",
    'Starting generic fixes (clear the cache, try another browser, reset passwords) before asking what the message says or who is affected.',
    'Saying "I understand" without doing anything about it, or ending the call with no time for the next update.',
    'Promising the problem will be fixed by five without knowing the cause.',
    'Asking him to tell the whole story again without recognising that he has already had a long morning.',
  ],
  goodBehaviours: [
    'Acknowledging the deadline and the hassle early, then saying plainly "I will look after this".',
    'Asking when it last worked and whether anything changed, including anything a colleague or administrator did.',
    'Asking whether anyone at all can still open the workspace, then explaining what that pattern suggests.',
    'Asking about a stop-gap for the report, such as a saved or offline copy.',
    'Giving a first step, who will do it, and a specific time for the next update.',
  ],
  expectedOutcome:
    "Daniel understands that the service is not down: access to the workspace was changed last night and his team's group lost it. The engineer owns the case, agrees the first step and a specific time for the next update, and helps him protect the client report with Lena's offline copy in the meantime.",
  evaluatorNotes:
    "Root cause: Helen, the workspace owner, reorganised the access groups last night before her leave and moved the workspace into a new group. The team's old group lost access; Helen and two designers who joined last month (already in the new group) can still open it. Nothing is broken, and an administrator can restore the old group. Daniel has been sent between his own IT team and the vendor's help page. A strong call acknowledges the deadline early, owns the case in plain words, finds the message, the timing, the change and who can still open it, does not send him back to IT, protects the report with the offline copy, and gives a specific next-update time.",
} satisfies ScenarioInput;

export default scenario;
