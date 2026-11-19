import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario. Everything here is fictional: people, organisation and product.
//
// Root cause (hidden from the trainee): the finance team switched on a scheduled daily export of the
// order data about three weeks ago. It runs at about eleven on weekdays and slows the system for
// about twenty minutes. The east office, connected over a VPN, is hit hardest. The slowdowns began
// two days after fifteen new users were added, so Rhys blames the new users. He knows finance has an
// export but not when it runs or that it matters. A strong call keeps a talkative, anxious customer
// organised: it steers gently, summarises often, finds the daily pattern and what else runs then,
// tests the new-users idea against the dates, and agrees a concrete first step.

const scenario = {
  id: 'recurring-midday-slowdowns',
  version: 1,
  title: 'Order entry slows down at certain times',
  summary:
    'An IT coordinator says the order-entry system has been slowing down for his staff, on and off, for a few weeks. He has a lot of background to share.',
  tags: ['slow performance', 'intermittent', 'two offices', 'talkative customer'],
  estimatedMinutes: 12,

  issueType: 'slow-performance',
  impact: 'medium',
  startingTemperature: 'anxious',
  proficiency: 'intermediate',
  style: 'talkative',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Rhys Pritchard',
    role: 'IT coordinator and office manager',
    organisation: 'Woodgrove Building Supplies',
    background:
      'Rhys looks after IT on top of running the office for a building-supplies distributor with two sites. He taught himself most of what he knows and wants to do right by his colleagues. About thirty people use the order-entry system all day, and he is the person they message when it misbehaves.',
    voice:
      'Chatty and warm. Answers with stories and drifts into tangents about the offices, past problems and who said what, then apologises for rambling. Useful details are buried in the stories. Worried that IT will get the blame, and relaxes when someone keeps things organised.',
  },
  environment: {
    product: 'the Litware order-entry system',
    details: [
      'A web-based order-entry system used by about thirty people across two offices',
      'Head office is on the local network; the east office connects to head office over a VPN',
      'Fifteen new order-entry users were added about three weeks ago for a new trade-counter contract',
      'Other teams, including finance, also use the system and its data',
      'Rhys has administrator access but does not look at scheduled tasks or logs regularly',
    ],
  },
  customerObjective:
    'Find out why order entry slows down and what can be done about it, and have something clear to tell the sales manager.',
  brief: {
    situation:
      'An IT coordinator is calling because the order-entry system has been slow for his staff, on and off, for a few weeks. He is worried and has a lot to say, so the call can easily wander.',
    goal: 'Find the pattern behind the slowdowns, keep the call organised and on track, and agree clear next steps and a time for the next update.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'Summarising what you have heard is a good way to keep a long conversation on track.',
    ],
  },

  openingCore:
    'Our order-entry staff keep running into slow screens, and it has been going on for a few weeks.',
  impactVariants: {
    low: {
      summary: "It's mostly a nuisance so far, because orders do still go through, only slowly.",
      detail:
        'Orders still go through; they just take much longer for a while, and people are getting impatient with it. Nobody has complained to a customer yet.',
      deadline: 'I would like to understand it before it turns into something bigger.',
    },
    medium: {
      summary:
        'It is costing my staff a lot of time, and the sales manager has started asking me about it.',
      detail:
        "At the worst of it, saving an order takes so long that some staff write orders down and enter them later, and I'm worried about mistakes. The sales manager wants an explanation and I don't have one.",
      deadline: 'I would like an answer I can give the sales manager this week.',
    },
    high: {
      summary:
        'Order entry almost stops for a while at times, and customers on the phone are starting to notice.',
      detail:
        'Staff are putting customers on hold and writing orders on paper, and a few orders have been entered twice. The sales director has asked for a written explanation.',
      deadline: 'The sales director wants an explanation by the end of this week.',
    },
  },
  stageFrames: {
    'first-contact': {
      opening:
        "Thanks for taking my call. I'd like to report a problem, and I'll try to keep it short.",
      brief:
        'This is the first time the customer has contacted support about the slowdowns. He is keen to give the full background.',
    },
    'follow-up': {
      opening:
        "I reported our slowdowns last week and haven't heard anything back, so I thought I'd check in.",
      brief: 'Rhys reported the slowdowns last week and has not had an update.',
    },
    escalated: {
      opening:
        "This is my second call about the slowdowns. Nothing has changed since the first one, and I'm getting worried.",
      brief:
        'Rhys has called before about the same slowdowns and nothing has changed. He is anxious and wants reassurance as well as answers.',
    },
    closure: {
      opening:
        "I'm calling to see whether we can close this off, because I think the slowdowns have stopped.",
      brief:
        'Rhys expects to confirm that the slowdowns are fixed and to understand what caused them.',
    },
  },
  priorHistory: [
    {
      when: 'Last week',
      summary:
        'Rhys emailed to report slow order entry. A case was logged as a general performance question.',
    },
    {
      when: 'Two days later',
      summary:
        'A reply asked for times and examples of the slowdowns. Rhys sent a long email describing the problem in general terms, without times.',
    },
    {
      when: 'Since then',
      summary: 'No engineer has picked up the case.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-slow-screens',
      text: 'Saving an order or opening a customer record takes far longer than it should, and sometimes the screen just waits.',
      intents: ['problem_description'],
      elaboration:
        'Marisol on the order desk says it feels like the system is thinking about something else. She has a way of putting things.',
      simple: 'Saving an order or opening a customer takes much too long.',
    },
    {
      id: 'kf-sites',
      text: 'We have two offices, head office and a second one across town, and about thirty people do order entry across both.',
      intents: ['environment', 'affected_scope'],
      elaboration:
        'The second office is in a converted warehouse annex that we moved into a couple of years ago. The heating there is a saga of its own.',
      simple: 'We have two offices. About thirty people enter orders across both.',
    },
    {
      id: 'kf-restarts',
      text: "I've restarted a few computers and one of the routers when people complained, and it made no difference.",
      intents: ['already_tried'],
      elaboration:
        'I also updated a couple of the printers while I was at it, because the driver prompts were irritating people, though that had nothing to do with this.',
      simple: 'I restarted some computers and a router. It did not help.',
    },
    {
      id: 'kf-outcome',
      text: 'I want to understand what is causing it, and I want something clear I can tell the sales manager.',
      intents: ['expected_outcome'],
      simple: 'I want to know the cause. I want to give the sales manager a clear answer.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-daily-pattern',
      importance: 'critical',
      label: 'Same time every weekday for about twenty minutes',
      statement:
        'It happens every weekday, starting at about eleven in the morning and lasting about twenty minutes. Then it is back to normal, and we have not seen it at any other time of day.',
      partialStatement:
        'It comes and goes. The staff say it is mostly in the morning, but I have not written it down.',
      revealWhen:
        'Asks what time of day it happens, whether it follows a pattern, how long it lasts, or whether it happens every day.',
      intents: ['reproducibility', 'timing_onset'],
      partialIntents: ['problem_description'],
      cues: [
        'time of day',
        'what time',
        'same time',
        'particular time',
        'certain time',
        'specific time',
        'pattern',
        'every day',
        'each day',
        'daily',
        'how long does it',
        'when does it happen',
      ],
      hint: 'The staff keep saying it is a morning thing.',
      statementTerse: 'Every weekday at about eleven, for about twenty minutes.',
      statementSimple:
        'It happens every weekday at about eleven in the morning. It lasts about twenty minutes. Then it is normal again.',
      missedConsequence:
        'Without the fixed daily window, the slowdown looks random, and the engineer cannot connect it to anything scheduled at that time.',
      betterQuestion:
        'What time does it start and stop, and does it happen at the same time every day?',
    },
    {
      id: 'hf-finance-export',
      importance: 'critical',
      label: 'Finance switched on a daily order export',
      statement:
        'Finance switched on an automatic daily export of the order data around the time the new users started. Anil, their analyst, mentioned it to me at lunch, but I do not know what time it runs.',
      revealWhen:
        'Asks whether anything else runs or is scheduled at that time, such as reports, exports, backups or jobs started by other teams.',
      intents: ['recent_changes', 'environment'],
      cues: [
        'else running',
        'running at',
        'runs at',
        'schedule',
        'job',
        'backup',
        'other team',
        'finance',
        'export',
        'report',
        'automatic',
        'batch',
      ],
      hint: 'Finance did something with the order data around then, I think.',
      statementTerse:
        'Finance switched on a daily order export about three weeks ago. I do not know when it runs.',
      statementSimple:
        'Finance switched on an automatic daily export of the orders. Anil told me at lunch. I do not know what time it runs.',
      missedConsequence:
        'The likely cause is never found, so the new users keep the blame and the slowdowns carry on every morning.',
      betterQuestion:
        'Does anything else run or get scheduled around that time, like reports, exports or backups, maybe from another team?',
    },
    {
      id: 'hf-east-office-vpn',
      importance: 'important',
      label: 'The east office on the VPN is hit hardest',
      statement:
        'The east office, our second site, is hit hardest, and they connect to head office over the VPN. Head office people only notice a short pause.',
      revealWhen:
        'Asks whether everyone is affected equally, which office or location is most affected, or how the affected people connect to the system.',
      intents: ['affected_scope', 'environment'],
      cues: [
        'office',
        'site',
        'location',
        'where',
        'vpn',
        'remote',
        'network',
        'everyone',
        'everybody',
        'all users',
        'some users',
        'which users',
      ],
      hint: 'It seems worse for some people than for others.',
      statementTerse: 'The east office, which connects over the VPN, is hit hardest.',
      statementSimple:
        'The east office is hit the worst. They connect to head office over the VPN. Head office only sees a short pause.',
      missedConsequence:
        'The engineer misses that the slowdown is worst on one network path, and looks at the whole system instead of the east office connection.',
      betterQuestion:
        'Is everyone affected equally, or is it worse for some people or some offices?',
    },
    {
      id: 'hf-first-slow-morning',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'The first slow morning came two days after the new users',
      statement:
        'The fifteen new users started on a Monday three weeks ago, and the first slow morning was that Wednesday. It was fine on the Monday and the Tuesday, when they were already working.',
      revealWhen:
        'Asks when the slowdowns first started, how that lines up with other changes such as new users, or whether it was fine before.',
      intents: ['timing_onset', 'recent_changes'],
      cues: [
        'when did',
        'since when',
        'first',
        'start',
        'began',
        'how long has',
        'how long ago',
        'new users',
        'added',
        'before that',
      ],
      statementTerse: 'The first slow morning was two days after the new users started.',
      statementSimple:
        'Fifteen new users started on a Monday three weeks ago. The first slow morning was that Wednesday. Monday and Tuesday were fine.',
      missedConsequence:
        'The new users keep the blame, and the engineer never tests the idea that adding users caused the slowdown.',
      betterQuestion:
        'When did it first happen, and how does that line up with the new users being added?',
    },
    {
      id: 'hf-hotspot-works',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'Working off the VPN avoids it',
      statement:
        "Chloe, in the east office, tried her phone's hotspot instead of the office VPN during one of the slow spells, and everything ran normally. She said it felt like a different system.",
      revealWhen:
        'Asks whether anything has helped, whether anyone has found a workaround, or what has been tried or tested so far.',
      intents: ['workaround', 'already_tried'],
      statementTerse:
        "Chloe in the east office used her phone's hotspot instead of the VPN, and it was fine.",
      statementSimple:
        'Chloe works in the east office. She used her phone hotspot instead of the VPN during a slow time. Everything was normal.',
      missedConsequence:
        'A useful stop-gap for the worst-hit staff is missed, and the engineer loses a clue that the VPN path is involved.',
      betterQuestion: 'Has anyone found anything that helps, even something small?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-new-users',
      statement: 'I think we simply put too many people on the system when we added the new users.',
      truth:
        'The new users are a coincidence of timing. The slowdown happens at a fixed time on weekdays and comes from a scheduled job switched on that same week. The new users worked normally for two days before the first slow morning.',
    },
  ],

  curveballs: [
    {
      id: 'cb-second-problem',
      type: 'change-issue',
      trigger: { earliestTurn: 5, latestTurn: 10 },
      statement:
        "Sorry, while I have you, there's something else. Two of the new users still can't print their delivery notes, and I've been meaning to ask about that.",
      followUp: 'Should I raise that separately, or is it part of the same thing?',
      expectedResponse:
        'Acknowledge the second item, agree to log it separately or return to it at the end, and bring the conversation back to the daily pattern without dismissing him.',
      minDifficulty: 'standard',
    },
    {
      id: 'cb-explanation-deadline',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 8, whenImpactUnacknowledged: true },
      statement:
        "I should mention that the sales side have asked me for an explanation by the end of the week. I'd like to be able to tell them something sensible.",
      followUp: 'What can I realistically tell them, and by when?',
      expectedResponse:
        'Acknowledge the deadline, be honest about what can and cannot be said yet, agree what you will find out first and when you will report back, and offer a short plain-language summary he can pass on.',
      minDifficulty: 'starter',
      effects: { temperature: 6, patience: -8 },
    },
  ],

  expectedDiscoveryAreas: [
    'What time of day it happens',
    'How long it lasts and how often',
    'Who is affected most',
    'Anything else running at that time',
    'When it started and what changed then',
    'What has helped so far',
  ],
  successCriteria: [
    'Keeps the conversation organised: summarises every few turns and gently returns to the question when the customer wanders.',
    'Establishes the exact daily pattern: weekdays, start time and how long it lasts.',
    'Asks what else runs at that time and finds the finance export.',
    'Finds that the east office, on the VPN, is hit hardest.',
    'Tests the new-users explanation by comparing the start date with when the users were added.',
    'Agrees a specific next step, such as asking finance when the export runs, and a time for the next update.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity'],
  poorApproaches: [
    'Letting the story run without steering, then asking everything at the end in one long list.',
    'Cutting him off or telling him to get to the point, which makes an anxious person talk more.',
    'Accepting the new-users explanation without checking when the slowdowns actually began.',
    'Suggesting capacity upgrades or more licences before finding the pattern.',
    'Promising a fix without knowing the cause.',
  ],
  goodBehaviours: [
    'Acknowledging his effort and his worry, then steering politely: "Can I stop you there and check one thing?"',
    'Asking for the exact time it starts and stops, and whether it happens every day.',
    'Asking what else runs or is scheduled at that time, including jobs started by other teams.',
    'Summarising what has been learned every few turns and checking it with him.',
    'Agreeing a clear next step and a time for the next update, such as asking finance when their export runs.',
  ],
  expectedOutcome:
    "Rhys understands that the slowdown follows a fixed daily pattern and is more likely tied to something scheduled than to the new users. The engineer has agreed a short summary with him, a first step (find out when finance's export runs and compare it with the slow window) and a specific time for the next update.",
  evaluatorNotes:
    'Root cause: finance switched on a scheduled daily export of the order data about three weeks ago. It runs at about eleven on weekdays and slows the system for about twenty minutes, and the east office, connected over the VPN, is hit hardest. The slowdown began two days after fifteen new users were added, so Rhys blames them; he does not know when the export runs or that it matters. A strong call keeps a talkative, anxious customer organised: acknowledges him, steers gently, summarises often, finds the daily pattern, asks what else runs then, finds the east office detail, tests the new-users idea against the dates, and agrees a first step (confirm the export time with finance) with a next-update time.',
} satisfies ScenarioInput;

export default scenario;
