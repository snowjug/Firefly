import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario. Everything here is fictional: people, organisation and case. Dynamics 365 is a
// real product, so the scenario describes only what the customer sees and was told, never how a
// dashboard loads its data.
//
// Story (hidden from the trainee; plausible, and never confirmed on the call): the managers' Regional
// Pipeline dashboard in the Sales Hub app got slow about six weeks ago. Around then three years of
// older opportunities were loaded from the company's previous system, and a colleague, Soraya,
// added more charts and a team leaderboard to the managers' dashboard. It is slowest when many
// managers open it at once, first thing on Monday before the forecast call and at month end, and
// the part that takes longest is the group of charts underneath the list. The reps' own dashboards
// are fine, and it is just as slow from home and in another browser, so it is not her network. The
// facts that depend on how many people are affected (who sees it, how the forecast call suffers) carry
// byImpact wordings for low (mostly Naomi) and high (managers and directors), matching affectedUsers.
//
// Naomi is calm, friendly and talkative, and drifts into tangents (irrelevantFacts). A strong call
// keeps her on track kindly, asks when, for whom and since when it is slow, finds what changed around
// then, does not blame her network or promise a fix, and agrees who needs to look at what and when
// she will hear next.

const scenario = {
  id: 'dynamics-dashboard-slow-to-load',
  version: 1,
  title: 'Sales dashboard in Dynamics 365 is slow to load',
  shortTitle: 'Dashboard slow to load',
  listSummary:
    'A talkative sales operations analyst says a sales dashboard in Dynamics 365 is slow to load.',
  summary:
    'Naomi Berenson is a sales operations analyst at Litware. A sales dashboard in Dynamics 365 is slow to load, and she is happy to tell you a great deal about everything else. Keep the call focused and kind, find out when, for whom and since when it is slow, and agree what happens next.',
  tags: ['dynamics 365', 'dashboard', 'slow performance', 'talkative customer', 'focus'],
  estimatedMinutes: 9,

  product: { id: 'dynamics-365', area: 'Sales dashboards' },
  caseReference: 'SIM-410504',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'dynamics-365',
    sourceCategories: ['microsoft-learn'],
    behaviourCheck: 'checked-partly',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read Learn pages on Sales Hub dashboards, charts and performance guidance; more data and charts slowing a dashboard is plausible, but no current page covers this pattern. The cause is the story's own. Revised impact wording, cues, discoverability. AI-assisted review, not a mentor's.",
  },
  issueType: 'slow-performance',
  impact: 'medium',
  startingTemperature: 'calm',
  proficiency: 'intermediate',
  style: 'talkative',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Naomi Berenson',
    speaker: 'female',
    role: 'Sales Operations Analyst',
    organisation: 'Litware',
    background:
      "Naomi looks after the sales team's dashboards and reports at a software company. She knows the sales data inside out but did not build every chart, and she is used to explaining numbers to people who do not like numbers. She enjoys a chat and means no harm by the tangents.",
    voice:
      "Warm, chatty and quick to digress: she starts on the dashboard and ends up on the sales kickoff or her dog. Apologises for rambling and comes back when gently steered. Describes things in her own words ('it just sits there thinking') and gives plenty of detail when asked a clear question.",
  },
  environment: {
    details: [
      "Litware's sales team uses Dynamics 365 Sales in a web browser, from the office and from home.",
      "Naomi looks after the sales team's dashboards and reports. She did not build every chart.",
      'The sales team has dashboards for the reps and dashboards for the managers.',
      'Litware has a small IT team for laptops and accounts, and an outside partner that looks after Dynamics 365.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: "Naomi, who opens the managers' dashboard more than anyone." },
    medium: { count: 9, summary: 'The eight regional sales managers, and Naomi.' },
    high: {
      count: 25,
      summary: 'About twenty-five people: the regional managers, the sales directors and Naomi.',
    },
  },
  customerObjective:
    "Get the managers' dashboard loading quickly again, and know what changed so that it does not happen again.",
  customerExpectation:
    'Someone who listens, keeps the call on track kindly, asks clear questions and tells her what happens next and when.',
  desiredOutcome:
    'The engineer works out when, for whom and since when the dashboard is slow, finds what changed around then, and agrees a clear next step, who needs to be involved and when Naomi will hear next.',
  previousTroubleshooting: [
    'Naomi refreshed the page and tried the dashboard a few times, with the same result.',
    'She tried it from home and from the office.',
  ],
  recentChanges: [
    'Three years of older opportunities were loaded from the previous system about two months ago.',
    "A colleague added more charts and a leaderboard to the managers' dashboard in October.",
  ],

  publicBrief: {
    issue: 'A sales dashboard in Dynamics 365 is slow to load.',
    impact: {
      low: 'Naomi waits longer than she should, but nothing is held up.',
      medium: 'People lose time waiting for the dashboard, and planning slows down.',
      high: 'Time is being lost waiting for the dashboard before key planning meetings.',
    },
    objective:
      'Keep the call focused and kind, and find out when, for whom and since when it is slow.',
    knownContext:
      "Naomi Berenson is a sales operations analyst at Litware. She looks after the sales team's dashboards in Dynamics 365 and likes to chat.",
    environment:
      "Litware's sales team uses Dynamics 365 Sales in a web browser. You cannot see the dashboard in this practice call.",
  },
  brief: {
    situation:
      'A sales operations analyst is calling because a sales dashboard in Dynamics 365 is slow to load. She is friendly and talkative, and drifts into side topics.',
    goal: 'Keep the call focused and kind, find out when, for whom and since when it is slow, and agree a clear next step and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; she will tell you a lot, not all of it useful.',
      'You cannot see her system in this practice call, so rely on what she tells you.',
    ],
  },

  openingCore:
    'The Regional Pipeline dashboard in Dynamics takes ages to load. It just sits there until everything appears.',
  impactVariants: {
    low: {
      summary: "It's mostly me so far, and it's more of a nuisance than a crisis.",
      detail:
        'I open that dashboard more than anyone, so I notice it first. Each wait has been eating into my morning, but nobody has complained yet.',
      deadline: "There's no deadline, but I'd like to get ahead of it before others notice.",
    },
    medium: {
      summary: 'People are starting to grumble, because they rely on it for their planning.',
      detail:
        "People have been losing time waiting, and it's wearing thin. It was never an outage, but it's been getting in the way of planning.",
      deadline: "I'd like it sorted soon, but there's no hard date.",
    },
    high: {
      summary: 'People are getting impatient, because the dashboard is what they plan from.',
      detail:
        "They plan the whole week from it. They've been losing time, and the directors have started to ask me why.",
      deadline: "I'd like it sorted before the next quarterly review.",
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case I opened a few days ago about our sales dashboard being slow to load. I haven't heard anything since.",
      brief:
        'Naomi opened a case a few days ago about a slow sales dashboard. She has not heard anything since.',
    },
    escalated: {
      opening:
        'This is my second call about our sales dashboard being slow to load, and nothing has improved.',
      brief:
        'Naomi has contacted support before about the slow dashboard. Nothing has improved, though she remains friendly.',
    },
    closure: {
      opening:
        "I'm calling to check that our sales dashboard loads quickly again, so you can close the case.",
      brief:
        'Naomi expects to confirm that the dashboard loads quickly for the managers and to understand what was slow before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'A few days ago',
      summary:
        'Naomi reported that a sales dashboard in Dynamics 365 is slow to load. A case was logged and an automatic acknowledgement was sent.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-what-happens',
      text: 'The Regional Pipeline dashboard in Dynamics takes ages to load. It just sits there until everything has appeared.',
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration:
        "I time it sometimes, mostly out of curiosity, and on a bad day it's more than a minute.",
      simple:
        'The Regional Pipeline dashboard in Dynamics takes a long time to load. It stays on the screen until everything has appeared.',
    },
    {
      id: 'kf-problem-closure',
      text: "The Regional Pipeline dashboard in Dynamics was taking ages to load. I'd like to check it's loading quickly again before you close the case.",
      intents: ['problem_description'],
      stages: ['closure'],
      simple:
        'The Regional Pipeline dashboard in Dynamics was taking a long time to load. I want to check that it loads quickly again before you close the case.',
    },
    {
      id: 'kf-app',
      text: "It's in the Sales Hub app, in the browser.",
      intents: ['environment'],
      cues: [
        'which app',
        'what app',
        'which product',
        'what are you using',
        'what do you use',
        'browser',
      ],
      simple: 'It is in the Sales Hub app, in the browser.',
    },
    {
      id: 'kf-no-error',
      text: "There's no error message. It just keeps loading until everything appears.",
      intents: ['error_message'],
      simple: 'There is no error message. It keeps loading until everything appears.',
    },
    {
      id: 'kf-tried',
      text: "I've refreshed the page and tried again a few times. It doesn't change much.",
      intents: ['already_tried'],
      simple: 'I refreshed the page and tried again a few times. It does not change much.',
    },
    {
      id: 'kf-how-slow',
      text: "I've seen it take more than a minute to finish loading on a bad day.",
      intents: ['problem_description', 'reproducibility', 'timing_onset'],
      cues: [
        'how slow',
        'how long does',
        'how long it',
        'how long is',
        'how long to',
        'how bad',
        'seconds',
      ],
      simple: 'I have seen it take more than one minute to finish loading on a bad day.',
    },
    {
      id: 'kf-outcome',
      text: "I'd like it to open quickly again, and I'd like to know what's going on so that it doesn't happen again.",
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'I want it to open quickly again. I want to know what is going on.',
    },
    {
      id: 'kf-outcome-closure',
      text: "I'd like to know what was going on, so that it doesn't happen again.",
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple: 'I want to know what was going on. I want it not to happen again.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-chart-count',
      intents: ['environment', 'problem_description', 'affected_scope'],
      cues: [
        'how many charts',
        'how many tiles',
        'how much is on',
        'what is on',
        'charts',
        'tiles',
      ],
      text: "There are quite a lot of charts on it, maybe ten? I'd have to count them.",
      confirmedText: 'I counted twelve, plus a couple of lists.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-open-now',
      intents: ['reproducibility', 'problem_description', 'timing_onset'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      cues: ['try it now', 'open it now', 'while we talk', 'time it', 'stopwatch', 'try opening'],
      checking: 'Okay, let me open it now. Bear with me.',
      text: "It's been about forty seconds, and it's still loading.",
    },
    {
      id: 'cf-open-now-closure',
      intents: ['reproducibility', 'problem_description', 'timing_onset'],
      stages: ['closure'],
      cues: ['try it now', 'open it now', 'while we talk', 'time it', 'stopwatch', 'try opening'],
      checking: 'Okay, let me open it now. Bear with me.',
      text: 'That was quick, about five seconds. It opened as fast as I would want.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-chart-setup',
      intents: ['environment', 'account_details'],
      cues: [
        'how is it set up',
        'how is it built',
        'what does each chart',
        'what do the charts',
        'filter',
        'configured',
        'customis',
      ],
      text: "I couldn't tell you how each chart is set up or what it pulls in. A colleague in sales operations built those.",
      whoKnows: 'a colleague in sales operations',
    },
    {
      id: 'uf-why',
      intents: ['problem_description', 'reproducibility'],
      cues: ['why', 'cause', 'reason', 'how come'],
      text: "I don't know why it's slower. That's what I'm hoping you can tell me.",
      whoKnows: 'the engineer',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-holiday',
      text: "I've only just got back from two weeks in Lisbon, so I'm still catching up on everything.",
    },
    {
      id: 'if-dog',
      text: 'My dog has decided that every video call is his cue to bark, so I mute a lot.',
    },
    {
      id: 'if-kickoff',
      text: "The sales kickoff is in January, and I'm in charge of the agenda.",
    },
    {
      id: 'if-coffee',
      text: "We've got a new coffee machine in the sales area, and there's a queue all morning.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-what-changed',
      importance: 'critical',
      label: 'Two things changed around then',
      statement:
        "A couple of things landed around then. We loaded three years of old opportunities from our previous system, and my colleague Soraya added more charts and a team leaderboard to the managers' dashboard.",
      revealWhen:
        'Asks whether anything changed around the time it got slow, or what was done to the system or the dashboard recently.',
      intents: ['recent_changes'],
      cues: [
        'change',
        'anything new',
        'updated',
        'imported',
        'added',
        'loaded',
        'customis',
        'around then',
        'before it got',
        'anything happen',
        'modif',
      ],
      hint: 'We did a couple of things to it around the same time, if that helps.',
      statementTerse: 'We loaded three years of old data, and Soraya added more charts.',
      statementSimple:
        "Two things happened. We loaded three years of old opportunities from our previous system. My colleague Soraya added more charts and a leaderboard to the managers' dashboard.",
      missedConsequence:
        'The engineer never finds the two changes that most plausibly explain the slowdown, so the case stays at "slow" with no lead on what to look at.',
      betterQuestion:
        'Did anything change around the time it got slow, in the data or in how the dashboard is set up?',
    },
    {
      id: 'hf-when-slow',
      importance: 'important',
      label: 'It is worst at busy times',
      statement:
        "It's worst first thing on Monday, when everyone opens it before the forecast call, and at the end of the month. In the middle of the week it's usually fine.",
      revealWhen:
        'Asks when it is slow, whether it follows the time of day or the day of the week, or whether it is always slow.',
      intents: ['reproducibility', 'timing_onset'],
      cues: [
        'when is it',
        'when does it',
        'what time of',
        'time of day',
        'which days',
        'what days',
        'all the time',
        'always',
        'sometimes',
        'pattern',
        'busy',
        'every day',
      ],
      hint: "It's not slow all the time. It depends on the day.",
      statementTerse: 'Monday mornings, and month end. Fine mid-week.',
      statementSimple:
        'It is slowest on Monday morning, when everyone opens it before the forecast call. It is also slow at the end of the month. In the middle of the week it is usually fine.',
      missedConsequence:
        'The engineer never finds the link to busy times, so a slowdown that follows how many people open it at once is treated as a fault that is always there.',
      betterQuestion: 'When is it slow, and does it follow the day of the week or the time of day?',
    },
    {
      id: 'hf-who-slow',
      importance: 'important',
      label: 'The managers see it, the reps do not',
      statement:
        "It's the regional sales managers, eight of them, and me. The reps' own dashboards open quickly, as far as I know.",
      revealWhen:
        'Asks who sees the slowness, how many people are affected or whether it is the same for everyone.',
      intents: ['affected_scope'],
      cues: [
        'who is affected',
        "who's affected",
        'who is impacted',
        'who sees',
        'who else',
        'how many people',
        'how many of you',
        'everyone',
        'same for',
        'other people',
        'whole team',
        'colleagues',
      ],
      statementTerse: 'The regional managers and me. Reps are fine.',
      statementSimple:
        "The eight regional sales managers and I see it. The reps' own dashboards open quickly.",
      byImpact: {
        low: {
          statement:
            "As far as I know it's only me so far, because I'm the one who opens it most. The reps' own dashboards open quickly.",
          statementTerse: "Only me, as far as I know. Reps' dashboards are fine.",
          statementSimple:
            "As far as I know it is only me so far, because I open it most. The reps' own dashboards open quickly.",
        },
        high: {
          statement:
            "It's all the regional managers and the sales directors, about twenty-five of us in all. The reps' own dashboards open quickly, as far as I know.",
          statementTerse: 'Managers and directors, about twenty-five. Reps are fine.',
          statementSimple:
            "The regional managers and the sales directors see it, about twenty-five people. The reps' own dashboards open quickly.",
        },
      },
      missedConsequence:
        'Who sees it is never established, so the engineer cannot tell whether it is a general fault or something about one dashboard.',
      betterQuestion: 'Who else sees it slow, and is it the same for everyone on the sales team?',
    },
    {
      id: 'hf-which-part',
      importance: 'important',
      label: 'The charts underneath take longest',
      statement:
        "The top of the page and the list on the left appear straight away. It's the charts underneath, the pipeline ones, that sit there spinning.",
      revealWhen:
        'Asks which part of the dashboard is slow, or what appears first and what takes longest.',
      intents: ['problem_description', 'reproducibility'],
      cues: [
        'which part',
        'which chart',
        'what appears first',
        'what loads first',
        'what takes longest',
        'whole page',
        'whole dashboard',
        'all of it',
        'part of the',
        'what happens when',
        'what do you see',
        'spinning',
      ],
      statementTerse: 'The charts underneath. The top and the list load fine.',
      statementSimple:
        'The top of the page and the list on the left appear quickly. The charts underneath take a long time.',
      missedConsequence:
        'Without knowing which part is slow, the engineer cannot narrow the problem to the charts and may chase the whole system.',
      betterQuestion:
        'Which part of the dashboard is slow: the whole page, or some parts that appear later?',
    },
    {
      id: 'hf-since-when',
      importance: 'important',
      label: 'It started about six weeks ago',
      statement: 'It started about six weeks ago. Before that, it used to open in a few seconds.',
      revealWhen: 'Asks when it started or how long it has been slow, or how fast it used to be.',
      intents: ['timing_onset'],
      cues: [
        'when did it',
        'when did this',
        'when did you first',
        'when did the problem',
        'since when',
        'how long has',
        'how long ago',
        'first notice',
        'it used to',
        'how fast',
      ],
      statementTerse: 'About six weeks ago. It used to open in seconds.',
      statementSimple: 'It started about six weeks ago. Before that it opened in a few seconds.',
      missedConsequence:
        'The start date is never found, so the engineer cannot match it with anything that changed around then.',
      betterQuestion: 'When did you first notice it, and how fast was it before that?',
    },
    {
      id: 'hf-same-everywhere',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'It is the same from home and in another browser',
      statement:
        "It's just as slow from home on my phone's hotspot as it is at the office, and in a private window. So I don't think it's my network or my browser.",
      revealWhen:
        'Asks whether it is the same on another network, another browser or another device.',
      intents: ['environment', 'workaround'],
      cues: [
        'other browser',
        'another browser',
        'different browser',
        'other network',
        'another network',
        'different network',
        'another device',
        'other device',
        'from home',
        'private window',
        'cache',
        'other computer',
      ],
      statementTerse: 'Same from home on a hotspot, and in a private window.',
      statementSimple:
        'It is just as slow from home on my phone hotspot as at the office, and in a private window. I do not think it is my network or my browser.',
      missedConsequence:
        'The engineer looks at her browser and network although she has already found that it is just as slow elsewhere.',
      betterQuestion:
        'Is it the same in another browser or on another network, for example from home?',
    },
    {
      id: 'hf-forecast-call',
      importance: 'helpful',
      minDifficulty: 'challenge',
      label: 'The forecast call keeps starting late',
      statement:
        'The managers wait for it before the Monday forecast call, so the call keeps starting late. Last week it was a quarter of an hour late.',
      revealWhen:
        'Asks how the slowness affects the team or what they are waiting on the dashboard for.',
      intents: ['business_impact'],
      cues: [
        'business impact',
        'what is the impact',
        'what impact',
        'affecting',
        'what depends',
        'how does it affect',
        'cost you',
        'what are they waiting',
      ],
      statementTerse: 'The Monday forecast call starts late. Last week by a quarter of an hour.',
      statementSimple:
        'The managers wait for the dashboard before the Monday forecast call. So the call starts late. Last week it was fifteen minutes late.',
      byImpact: {
        low: {
          statement:
            "It's mostly me waiting, so I lose a few minutes on Mondays. Nobody else has said anything yet.",
          statementTerse: 'Mostly me. A few minutes on Mondays.',
          statementSimple:
            'Mostly I am the one waiting. I lose a few minutes on Mondays. Nobody else has said anything yet.',
        },
        high: {
          statement:
            'The sales directors wait for it too, so the leadership forecast call keeps starting late, and the director has noticed. Last week it was a quarter of an hour late.',
          statementTerse: 'The leadership forecast call starts late. The director noticed.',
          statementSimple:
            'The sales directors wait for it too. So the leadership forecast call starts late, and the director has noticed. Last week it was fifteen minutes late.',
        },
      },
      missedConsequence:
        'What the delay costs is never found, so the engineer cannot judge how urgent it is or who needs to hear about it.',
      betterQuestion:
        'How is the slowness affecting the managers, and what are they waiting on it for?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-overloaded',
      statement:
        "I assume it's Dynamics itself that's struggling. I can't see how anything we've done would matter.",
      truth:
        'In this story the slowness follows what was done to the dashboard and the data, not a general problem with Dynamics, but that has not been confirmed.',
    },
  ],

  curveballs: [
    {
      id: 'cb-numbers-off',
      type: 'change-issue',
      trigger: { earliestTurn: 4, latestTurn: 9 },
      statement:
        "While I've got you, the forecast numbers on that same dashboard look a bit off to me as well. Could you look at that too?",
      followUp: 'Or is that a different case? I never know which.',
      expectedResponse:
        'Note it, but do not switch topics yet. Ask whether the numbers are wrong or only slow to appear, say you will come back to it once the slow loading is scoped, and do not promise to investigate without a plan.',
      minDifficulty: 'standard',
      effects: { temperature: 3, trust: -2, patience: -4 },
    },
    {
      id: 'cb-quarterly-review',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 8, whenImpactUnacknowledged: true },
      statement:
        "I should mention that the quarterly review is coming up, and I'd love to show the dashboard opening quickly.",
      followUp: 'Is there anything that can be done before then?',
      expectedResponse:
        'Acknowledge the review and be honest about what can and cannot be promised. Agree what happens next and when she will hear, and ask what she needs to have ready.',
      minDifficulty: 'starter',
      effects: { temperature: 4, patience: -4 },
    },
    {
      id: 'cb-cache-last-time',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        'Last time I reported something slow, I was told to clear my browser and that was the end of it. I do hope this will be different.',
      followUp: 'So what will you do differently?',
      expectedResponse:
        'Acknowledge it without defending it, and show what is different: that you are asking when, for whom and since when, and that you will say who needs to look at what and when she will hear next.',
      minDifficulty: 'standard',
      effects: { temperature: 4, trust: -6 },
    },
  ],
  allowedCurveballs: ['change-issue', 'deadline', 'previous-bad-experience'],

  expectedDiscoveryAreas: [
    'When it is slow',
    'Who sees it',
    'Which part is slow',
    'Since when it has been slow',
    'What changed around then',
    'Whether it is the same elsewhere',
  ],
  successCriteria: [
    'Greets Naomi warmly and lets her say what is wrong before steering the call.',
    'Keeps the call on track kindly when she drifts, and comes back to the dashboard without making her feel cut off.',
    'Finds when it is slow, for whom and since when, in plain questions, one at a time.',
    'Finds what changed around the time it got slow.',
    'Does not blame her network or promise a fix, and says who needs to look at what.',
    'Agrees a clear next step and a time for the next update, then summarises.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity', 'closing'],
  careExpectations: {
    communicate: [
      'Steers back to the dashboard with a short, friendly bridge, such as noting a tangent and then asking the next question.',
      'Summarises what was learned in a few plain sentences before ending, so that the call does not end in a ramble.',
    ],
    accountable: [
      'Takes ownership of the next step in their own name and gives a time for the next update.',
    ],
    resourceful: [
      'Asks when, for whom and since when it is slow, and what changed around then, before suggesting fixes.',
      'Asks which part of the dashboard is slow and whether it is the same on another browser or network.',
    ],
    empathetic: [
      'Shows interest in what she says without letting it take over, and recognises that waiting every Monday is wearing.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Cutting her off sharply when she drifts, which makes a friendly customer feel unwelcome.',
    'Following every tangent, so that the call runs long and the useful facts never come up.',
    'Blaming her network or browser before finding out whether it is the same everywhere.',
    'Starting with generic fixes such as clearing the browser cache.',
    'Ending with "we will look into it" and no next step or time.',
  ],
  goodBehaviours: [
    'Letting her finish a thought, then steering back with a friendly bridge and a clear question.',
    'Asking when it is slow, who sees it and since when, in plain words and one at a time.',
    'Asking what changed around the time it got slow, including new data and changes to the dashboard.',
    'Asking which part is slow and whether it is the same in another browser or from home.',
    'Agreeing a next step and a time for the next update, then summarising briefly.',
  ],
  expectedOutcome:
    'Naomi feels heard and has a clear next step. She knows the engineer has found that the slowness follows busy times, the managers and one dashboard, and that two changes landed around the same time, without any promise of a fix. She knows who needs to look at what and when she will hear next.',
  evaluatorNotes:
    "Story (plausible, never confirmed on the call): the managers' Regional Pipeline dashboard got slow about six weeks ago, after three years of older opportunities were loaded and a colleague added more charts and a leaderboard to it. It is slowest when many managers open it at once, first thing on Monday and at month end, and the slow part is the charts underneath. Reps' own dashboards are fine, and it is the same from home and in another browser. Naomi is calm and talkative and drifts into tangents. A strong call keeps her on track kindly, asks when, for whom and since when, finds what changed, does not blame her network or promise a fix, and agrees who looks at what and when she hears next.",
} satisfies ScenarioInput;

export default scenario;
