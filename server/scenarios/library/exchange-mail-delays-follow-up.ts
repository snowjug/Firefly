import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario, set at a follow-up call. Everything here is fictional: people, organisation and
// case. Exchange Online is a real product, so the scenario describes only what the customer sees and
// was told, never how mail flow works.
//
// Case context in the story (hidden from the trainee): only mail to and from two outside companies,
// Elena's payroll provider and her main supplier, has been delayed for about a week. Adventure Works
// changed nothing. The supplier says it moved to a new email security provider and the payroll
// provider has not replied. Nothing on this call proves where the delay lies, and the engineer should
// not guess. Elena was promised a call back yesterday and none came, so that fact is limited to
// follow-up and escalated calls (stages). The examples fact is the one that depends on how many
// people are affected, so it carries byImpact wordings for low and high.
//
// A strong call apologises for any missed update without excuses, owns the case, finds the pattern,
// the timing and the examples without making her start again, stays honest about what is unknown and
// agrees a first step, an owner and a time for the next update.

const scenario = {
  id: 'exchange-mail-delays-follow-up',
  version: 1,
  title: 'Email to and from some recipients arrives late',
  shortTitle: 'Email arriving late',
  listSummary: 'An IT service manager chases a case about late email to and from some recipients.',
  summary:
    'Elena Vasquez runs the IT service desk at Adventure Works. Email to and from some recipients arrives late, and staff are asking for answers. Own the case, find out what she knows and agree what happens next and when she will hear from you.',
  tags: ['mail flow', 'follow-up', 'no update', 'ownership'],
  estimatedMinutes: 12,

  product: { id: 'exchange-online', area: 'Mail flow' },
  caseReference: 'SIM-410003',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    revisedOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-learn'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    review: 'assistant-reviewed',
    notes:
      "Checked on 22 Nov 2026 against current public Microsoft Learn pages on message trace and its FAQ. Terms are current; the supplier change is kept as a lead, and missed-update and low-impact wording made consistent across stages. AI-assisted review, not a mentor's.",
  },
  issueType: 'service-outage',
  impact: 'medium',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'demanding',
  callStage: 'follow-up',
  difficulty: 'standard',

  persona: {
    name: 'Elena Vasquez',
    speaker: 'female',
    role: 'IT Service Manager',
    organisation: 'Adventure Works',
    background:
      'Elena leads the service desk at a mid-sized company and is the person staff and executives turn to when something breaks. She knows enough about email to ask good questions, but a colleague runs the mail setup day to day. She has been fielding complaints for days and is tired of chasing.',
    voice:
      'Direct, organised and clipped. Asks for names, times and commitments, and notices vague answers. Not rude, but visibly worn down by chasing. Softens when someone owns the case, apologises for the silence without excuses and gives a specific time; sharpens if she has to repeat herself.',
  },
  environment: {
    details: [
      'Adventure Works uses Exchange Online for all staff mailboxes, and most people read their mail in Outlook on company laptops.',
      'Elena runs the service desk. A colleague looks after the mail setup day to day.',
      'Staff exchange mail with many outside companies every day.',
      'As far as the service desk knows, no change has been made to the company mail setup in the last month.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'One procurement officer who emails outside companies all day.' },
    medium: {
      count: 12,
      summary: 'Twelve people in finance and procurement whose replies are held up.',
    },
    high: {
      count: 60,
      summary: 'Sixty people across finance, procurement and HR, with time-sensitive mail held up.',
    },
  },
  customerObjective:
    'Find out what is causing the delays, who is working on them, and when mail will be back to normal.',
  customerExpectation:
    'A named engineer who already knows her case, apologises for any missed update, says plainly what is known and not known, and commits to times for the next update.',
  desiredOutcome:
    'Elena knows who owns the case, what will be checked and by when, what examples are needed from her, and what she can tell her users and managers in the meantime.',
  previousTroubleshooting: [
    'The service desk compared sent and received times on several delayed messages and put them in a spreadsheet.',
    'Elena checked the public service status page on both days. It showed no problems.',
    'She asked the colleague who runs the mail setup, who found nothing wrong on their side.',
  ],
  recentChanges: [
    'As far as Elena knows, nothing was changed in the company mail setup in the last month.',
    'Her contact at the main supplier said they moved to a new email security provider a few weeks ago. The payroll provider has not replied.',
  ],

  publicBrief: {
    issue: 'Email to and from some recipients is arriving late.',
    impact: {
      low: 'A few delayed replies are annoying people, but nothing urgent depends on them.',
      medium: 'Several teams are waiting on late mail, and managers are asking for updates.',
      high: 'Late mail is holding up business processes, and executives are demanding answers.',
    },
    objective: 'Own the case, find out what she knows and agree what happens next, with a time.',
    knownContext:
      'Elena Vasquez runs the IT service desk at Adventure Works. Mail to and from some recipients is arriving late, and staff are asking her for answers.',
    previousContact:
      'Elena raised a case yesterday afternoon. No update has been sent and no engineer has contacted her.',
    environment:
      'Adventure Works uses Exchange Online for staff mail, mostly read in Outlook on company laptops.',
  },
  brief: {
    situation:
      'An IT service manager is calling because email to and from some recipients arrives late. She wants someone who will own the case.',
    goal: 'Own the case, find out what she knows without making her start from scratch, and agree what happens next and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'The case notes are thin in this practice call, so rely on what she tells you.',
    ],
  },

  openingCore:
    "Email to and from some of our contacts is arriving late. It's not all of it, but it's enough that people are noticing.",
  impactVariants: {
    low: {
      summary: "It's only one person so far, but she's getting impatient.",
      detail:
        "It's one of our procurement officers, who emails outside companies all day. Her replies are late, and she's started copying her manager into everything.",
      deadline:
        'It would be good to have an answer today, but nothing breaks if it takes a bit longer.',
    },
    medium: {
      summary: 'People are starting to chase me, and a couple of managers want answers today.',
      detail:
        "It's about twelve people across finance and procurement. Their replies are sitting waiting, and two managers have asked me for an update.",
      deadline: 'I need to tell the managers something by the end of today.',
    },
    high: {
      summary:
        "Executives are asking me for updates every hour, and it's starting to hurt the business.",
      detail:
        "It's about sixty people across finance, procurement and HR. Time-sensitive mail is held up, and our finance director has asked me for an update twice today.",
      deadline: 'The finance director wants something to tell the executive team this afternoon.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I raised a case yesterday afternoon about the email delays, and I haven't had a word since.",
      brief:
        'Elena raised a case yesterday about delayed email. No update has been sent and no engineer has contacted her.',
    },
    escalated: {
      opening:
        'This is my second call since yesterday about the email delays, and nobody has taken charge of the case.',
      brief:
        'Elena has contacted support more than once since raising the case. She feels nobody owns it.',
    },
    closure: {
      opening:
        "I'm calling to check that mail is arriving normally again, so we can close the case.",
      brief:
        'Elena expects to confirm that mail is back to normal and to understand what was found before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday afternoon',
      summary:
        'Elena raised a case about email arriving late for some recipients. An automatic acknowledgement was sent.',
    },
    {
      when: 'Yesterday evening',
      summary:
        'The case was queued for review. No engineer was assigned and no update has been sent since.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: 'Messages take far longer to arrive than they should, and nobody can tell when to expect a reply.',
      intents: ['problem_description'],
      elaboration: "I keep getting asked whether it's fixed, and I don't have a good answer.",
      simple: 'Some email arrives very late. Nobody knows when to expect a reply.',
    },
    {
      id: 'kf-environment',
      text: "We're on Exchange Online, and most people read their mail in Outlook on their laptops.",
      intents: ['environment'],
      simple: 'We use Exchange Online. Most people read mail in Outlook on laptops.',
    },
    {
      id: 'kf-role',
      text: "I run the service desk, so I'm the one fielding the complaints. A colleague looks after the mail setup day to day.",
      intents: ['account_details'],
      cues: [
        'who looks after',
        'who manages',
        'who runs',
        'mail setup',
        'your role',
        'your colleague',
        'who is responsible',
      ],
      simple: 'I run the service desk. A colleague looks after the mail setup every day.',
    },
    {
      id: 'kf-no-change',
      text: "We haven't touched the mail setup, as far as I know.",
      intents: ['recent_changes'],
      simple: 'We did not change the mail setup, as far as I know.',
    },
    {
      id: 'kf-outcome',
      text: "I want to know what's causing it, who's working on it and when mail will be back to normal.",
      intents: ['expected_outcome'],
      simple: 'I want to know the cause, who is working on it, and when mail will be normal again.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-last-change',
      intents: ['recent_changes'],
      cues: ['last change', 'when was the last', 'last time anything', 'last time you changed'],
      text: "I think the last change to our mail setup was a couple of months ago, but I'd need to check the change calendar.",
      confirmedText: 'Yes, the change calendar says the last mail change was about two months ago.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-status-page',
      intents: ['already_tried'],
      cues: [
        'status page',
        'service health',
        'service status',
        'outage',
        'known issue',
        'incident',
      ],
      checking: 'Let me look at the status page again.',
      text: 'It shows nothing wrong for mail at the moment. It showed nothing yesterday either.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-cause',
      intents: ['problem_description', 'reproducibility'],
      cues: ['root cause', 'what is causing', "what's causing", 'the cause', 'the reason'],
      text: "I don't know what's causing it. I can't see inside anyone's mail systems, which is why I need your help.",
      whoKnows: 'the engineer and my mail setup colleague',
    },
    {
      id: 'uf-routing',
      intents: ['environment', 'account_details'],
      cues: ['routing', 'route', 'connector', 'gateway', 'mx record', 'filtering'],
      text: "I couldn't tell you how our mail is routed. My colleague who runs the mail setup would know.",
      whoKnows: 'my colleague who runs the mail setup',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-laptop-refresh',
      text: "We're also in the middle of a laptop refresh, so the service desk is flat out.",
    },
    {
      id: 'if-board-report',
      text: "I've got a board report due on Friday that I haven't touched.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-two-partners',
      importance: 'critical',
      label: 'Only two outside companies are affected',
      statement:
        "It's only mail with two outside companies, our payroll provider and our main supplier, in both directions. Internal mail is instant and everyone else's mail is fine.",
      partialStatement: 'There does seem to be a pattern to the delays.',
      revealWhen:
        'Asks which recipients or senders are affected, whether it is internal or external mail, or what the delayed messages have in common.',
      intents: ['affected_scope', 'reproducibility'],
      partialIntents: ['problem_description'],
      cues: [
        'which recipients',
        'which senders',
        'which contacts',
        'which companies',
        'in common',
        'internal mail',
        'internal email',
        'external mail',
        'external email',
        'outside companies',
        'certain recipients',
        'pattern',
      ],
      hint: "It doesn't seem to be all of our mail, just certain contacts.",
      statementTerse:
        'Only mail with our payroll provider and our main supplier. Internal mail is fine.',
      statementSimple:
        'Only mail with two outside companies is late: our payroll provider and our main supplier. Mail inside the company is fast.',
      missedConsequence:
        'The pattern stays hidden, so the case is treated as a general mail outage and the engineer cannot say what will be checked or who needs to be involved.',
      betterQuestion:
        'Is it all mail, or only to and from certain recipients, and what do the delayed messages have in common?',
    },
    {
      id: 'hf-delay-length',
      importance: 'important',
      label: 'How late the messages are',
      statement:
        'The delays vary. Some messages arrive about 40 minutes late and some take 3 hours or more, and it comes and goes through the day.',
      revealWhen:
        'Asks how late the messages are, how long the delay is, or whether the delay is the same every time.',
      intents: ['error_message', 'reproducibility'],
      cues: [
        'how late',
        'how long is the delay',
        'how long are the delays',
        'how delayed',
        'length of the delay',
        'how many minutes',
        'how many hours',
        'minutes late',
        'hours late',
        'how long does it take',
      ],
      hint: "It's not the same every time. Sometimes it's an hour or so, sometimes much longer.",
      statementTerse: 'From about 40 minutes to 3 hours or more.',
      statementSimple: 'The delay changes. Sometimes about 40 minutes, sometimes 3 hours or more.',
      missedConsequence:
        'Without the size and pattern of the delay, the engineer cannot judge urgency or tell her what to expect, and her users get no useful message from her.',
      betterQuestion: 'How late are the delayed messages, and is it the same every time?',
    },
    {
      id: 'hf-started-last-week',
      importance: 'important',
      label: 'It began about a week ago',
      statement:
        'It started last Thursday, about a week ago. Before that, everything was arriving normally.',
      revealWhen:
        'Asks when the delays started, when mail last arrived normally, or what the first sign was.',
      intents: ['timing_onset'],
      statementTerse: 'Last Thursday, about a week ago.',
      statementSimple: 'It started last Thursday, one week ago. Before that, mail was normal.',
      missedConsequence:
        'The start date is the anchor for any investigation and for comparing notes with the other companies; without it the engineer cannot ask anyone the right questions.',
      betterQuestion:
        'When did you first notice the delays, and when was mail last arriving normally?',
    },
    {
      id: 'hf-partner-change',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'The supplier changed its email security',
      statement:
        "We haven't changed anything that I know of. My contact at our main supplier said they moved to a new email security provider a few weeks ago, and the payroll provider hasn't replied to me.",
      revealWhen:
        'Asks whether anything changed recently, on the customer side or at the other organisations involved.',
      intents: ['recent_changes'],
      statementTerse:
        'No changes that I know of. The supplier moved to a new email security provider a few weeks ago.',
      statementSimple:
        'We changed nothing that I know of. Our supplier told me they changed their email security provider a few weeks ago. The payroll provider has not replied.',
      missedConsequence:
        'The one lead she has, a change at another company, never comes up, so the plan does not include contacting them or sharing evidence with them.',
      betterQuestion:
        'Has anything changed recently, either on your side or at the companies you exchange mail with?',
    },
    {
      id: 'hf-examples',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'She has sample messages with times',
      knowledge: 'after-checking',
      checking: "Give me a moment, I'll look at what my team logged.",
      statement:
        'My team logged five examples with the time each message was sent and the time it arrived. I can read them out or send them over.',
      revealWhen:
        'Asks whether she has sample messages with sent and received times, or any evidence of the delay.',
      intents: ['reproducibility', 'already_tried'],
      cues: [
        'example message',
        'example email',
        'example of a delayed',
        'sample message',
        'sample email',
        'sent and received',
        'time it was sent',
        'timestamp',
        'specific message',
        'specific email',
        'evidence',
      ],
      statementTerse: 'Yes. My team logged five examples with sent and arrival times.',
      statementSimple:
        'My team wrote down five examples. They have the time sent and the time arrived. I can read them to you.',
      byImpact: {
        low: {
          statement:
            'The procurement officer logged two examples, with the time each message was sent and the time it arrived. I can read them out or send them over.',
          statementTerse: 'Yes. She logged two examples with sent and arrival times.',
          statementSimple:
            'The procurement officer wrote down two examples. They have the time sent and the time arrived. I can read them to you.',
        },
        high: {
          statement:
            'My team logged a dozen examples from different people, with the time each message was sent and the time it arrived. I can read them out or send them over.',
          statementTerse:
            'Yes. A dozen examples from different people, with sent and arrival times.',
          statementSimple:
            'My team wrote down about twelve examples from different people. They have the time sent and the time arrived. I can read them to you.',
        },
      },
      missedConsequence:
        'The most useful evidence for any investigation is left on her desk, so the next step stays vague and she has to chase again.',
      betterQuestion:
        'Do you have a few example messages, with the time each was sent and the time it arrived?',
    },
    {
      id: 'hf-callback-promise',
      importance: 'important',
      minDifficulty: 'standard',
      stages: ['follow-up', 'escalated'],
      label: 'She was promised a call back',
      statement:
        "When I raised it yesterday I was told someone would call me back by the end of the day. Nobody did, and I've had nothing in writing.",
      revealWhen:
        'Asks what she was told when she raised the case, or what has happened since she contacted support.',
      intents: ['previous_contact'],
      cues: [
        'what were you told',
        'what did they say',
        'when you raised',
        'when you called',
        'call back',
        'callback',
        'promised',
        'since you raised',
      ],
      statementTerse: 'I was told I would get a call by the end of the day. Nobody called.',
      statementSimple:
        'Yesterday they told me someone would call me by the end of the day. No one called. I have nothing in writing.',
      missedConsequence:
        'The broken promise goes unacknowledged, so the apology and ownership she needs never come and her trust keeps falling.',
      betterQuestion:
        'What were you told when you raised the case yesterday, and what has happened since?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-fault-at-your-end',
      statement:
        "I'm convinced this is a fault at your end. Our mail setup is exactly as it was, so what else could it be?",
      truth:
        'Nothing confirms a fault with the service. Only mail with two outside companies is late, and one of them has changed its own email security, so the cause may lie outside Adventure Works. It has not been established.',
    },
  ],

  curveballs: [
    {
      id: 'cb-last-time',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        "The last time we raised something like this with you, it sat for over a week before anyone looked. I won't go through that again.",
      followUp: 'So what will be different this time?',
      expectedResponse:
        'Acknowledge the earlier experience without defending it, then show what is different now: say you own the case, what you will do first and when she will hear next.',
      minDifficulty: 'standard',
      effects: { temperature: 6, trust: -8 },
    },
    {
      id: 'cb-promise-today',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        'Can you promise me this will be sorted by the end of the day? I need something I can tell my managers.',
      followUp: 'So can you commit to that, yes or no?',
      expectedResponse:
        'Do not promise a fix time you cannot control. Say what you will do first, who will do it and when she will next hear from you, and ask what she needs to tell her managers.',
      minDifficulty: 'challenge',
      effects: { temperature: 5, patience: -5 },
    },
  ],
  allowedCurveballs: [
    'previous-bad-experience',
    'unsupported-guarantee',
    'ask-manager',
    'challenge-credibility',
  ],

  expectedDiscoveryAreas: [
    'Which recipients are affected',
    'How late the messages are',
    'When it started',
    'What has changed recently',
    'What evidence she already has',
    'What she has been told so far',
  ],
  successCriteria: [
    'Opens by acknowledging any missed update and takes responsibility without excuses or blaming a colleague.',
    'Asks for the case facts without making Elena repeat everything, and finds which recipients are affected.',
    'Establishes when the delays began, how long they last and what changed recently, including at the companies involved.',
    'Asks for example messages with sent and arrival times, so the next step is concrete.',
    'Sets honest expectations without promising a fix, agrees who does what by when and gives a specific time for the next update.',
    'Summarises the agreement and gives her something to tell her managers.',
  ],
  coachingFocus: ['ownership-next-steps', 'scoping-discovery', 'empathy-deescalation'],
  careExpectations: {
    communicate: [
      'Gives a short summary of what is known and not known and avoids guessing the cause, so she can brief her managers.',
      'Confirms the plan in order: what happens first, who does it and when she hears next.',
    ],
    accountable: [
      'Acknowledges any missed call back, owns the case and does not blame an earlier contact or a colleague.',
      'Promises only what is in their control, such as their own actions and the time of the next update.',
    ],
    resourceful: [
      'Asks for example messages with times and for the recipients involved, so the next step is concrete.',
      'Asks what changed recently, including at the other companies, and offers to help her prepare what to ask them.',
    ],
    empathetic: [
      'Recognises the days of chasing and the pressure from her managers in specific words, not a stock apology.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Asking her to explain everything again from the beginning, as if the case had never been raised.',
    'Blaming the earlier handling, a colleague or "the system" for any missing update instead of owning it.',
    'Promising that mail will be back to normal today, or saying it is "definitely" the other companies, without evidence.',
    'Asking only about Outlook on her laptop, when the pattern is about who the mail goes to and comes from.',
    'Ending with "we will look into it" and no named person or time.',
  ],
  goodBehaviours: [
    'Apologising specifically for any missing update or missed call back, then taking ownership in plain words.',
    'Asking which recipients are affected, when it began and how late the messages are.',
    'Asking what has changed recently and whether she has example messages with sent and arrival times.',
    'Staying honest about what is not yet known, and avoiding a promised fix time.',
    'Agreeing a plan with a named person, a first step and a time for the next update, then summarising it.',
  ],
  expectedOutcome:
    'Elena knows who owns the case and has had an apology for any missed update. The engineer has the pattern, the timing and the example messages, and has agreed what will be checked first, who will do it and when Elena will hear next. She has something concrete to tell her managers.',
  evaluatorNotes:
    'Case context in the story: only mail to and from two outside companies, the payroll provider and the main supplier, has been delayed for about a week. Adventure Works changed nothing; the supplier says it moved to a new email security provider and the payroll provider has not answered. On follow-up and escalated calls, Elena was promised a call back yesterday and none came. Nothing on this call proves where the delay lies, and the engineer should not guess. A strong call apologises for any missed update, owns the case, finds the pattern, the timing and the examples without making her start again, stays honest about what is unknown and agrees a first step, an owner and a time for the next update.',
} satisfies ScenarioInput;

export default scenario;
