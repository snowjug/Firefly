import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario. Everything here is fictional: people, organisation and product.
//
// Root cause (hidden from the trainee): last Monday a large batch of older delivery history was
// loaded into the dashboard. The "All regions" view now has to work through far more data, so it
// is slow in the afternoon when the whole team is using it. Single-region views and short date
// ranges stay fast, which is why filtering to the last seven days works. Priya's Friday report
// needs the whole month, so the workaround does not cover it. A strong call turns "sometimes"
// into specifics with focused questions, finds the Friday need, and agrees honest next steps
// without promising a fix date.

const scenario = {
  id: 'slow-dashboard-with-workaround',
  version: 1,
  title: 'Dashboard slow on and off, with a workaround',
  summary:
    'An analyst says the reporting dashboard has been slow on and off since last week and is not sure why.',
  tags: ['slow performance', 'dashboard', 'workaround'],
  estimatedMinutes: 8,

  issueType: 'slow-performance',
  impact: 'low',
  startingTemperature: 'anxious',
  proficiency: 'intermediate',
  style: 'vague',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Priya Raman',
    speaker: 'female',
    role: 'Operations analyst',
    organisation: 'Northwind Dairy Co-op',
    background:
      'Priya turns delivery data into the reports that the operations managers use. She is comfortable with filters, exports and browsers, but does not know how the dashboard works behind the scenes. She worries about letting people down.',
    voice:
      "Hesitant and imprecise at first, with phrases like 'sort of', 'sometimes' and 'I think'. Apologises for not being clear. Becomes exact when a question is specific, and often checks whether she is describing things the right way.",
  },
  environment: {
    product: 'the Proseware reporting dashboard',
    details: [
      'Reporting dashboard in a web browser on a work laptop at her desk',
      'The dashboard has a view for each region and an All regions view. The default date range is the last 90 days',
      'Last Monday a large archive of older delivery history was loaded into the dashboard',
      'The All regions view takes about a minute to load in the afternoon and a few seconds in the morning',
      'A single region, or a short date range such as the last seven days, loads quickly at any time of day',
      'About a dozen analysts and managers use the dashboard, and most are online from early afternoon',
      'Her delivery performance report is due on Friday and needs the whole month for all regions',
      'She has cleared her browser cache and tried a second browser, with no change',
    ],
  },
  customerObjective:
    'Get the dashboard working fast enough to finish her work on time, and know what is being done about it.',
  brief: {
    situation:
      'An operations analyst is calling because the reporting dashboard has been slow on and off. She sounds a little worried and is not very specific at first.',
    goal: 'Turn a vague description into specific details, then agree what she can do now and what happens next.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need. Specific questions get specific answers; general ones tend to get general answers.',
    ],
  },

  openingCore: 'The reporting dashboard has been really slow sometimes since last week.',
  impactVariants: {
    low: {
      summary: 'I can still get my work done, but I keep losing time waiting for pages to load.',
      detail:
        "As far as I know it's mainly me who has noticed it. I haven't asked the rest of the team. I can carry on with other tasks while a page loads.",
      deadline: 'I would like it sorted this week, if possible.',
    },
    medium: {
      summary:
        'Several of us are losing a lot of time to it, and we need the dashboard for our regular reporting.',
      detail:
        "Several of us on the team use the dashboard and we're all waiting on it. It's slowing down the reports we need to send out.",
      deadline: 'We need it working properly before the end of the week.',
    },
    high: {
      summary:
        "Most of the team can't get their reporting done properly, and managers are asking about it.",
      detail:
        'Almost everyone on the team is affected, and the reports that management expects are running late because of it.',
      deadline: 'We need it working as soon as possible, because management is waiting.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I called yesterday about the dashboard being slow, and I haven't heard anything back.",
      brief:
        'Priya called yesterday about the same problem. A case was logged and she has not had an update.',
    },
    escalated: {
      opening: 'This is my second call about the dashboard being slow, and nothing has changed.',
      brief:
        'Priya has contacted support twice about the slow dashboard. She expects someone to have looked into it by now.',
    },
    closure: {
      opening:
        "I'm calling to see whether the dashboard problem is sorted, so we can close this off.",
      brief: 'Priya expects to confirm that the dashboard is working properly and close the case.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday',
      summary:
        'Priya reported that the dashboard was slow on and off. A case was logged and she was told that someone would look into it.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-slow-pages',
      text: "When it's slow, the page sits there with the loading circle for a long time, maybe a minute, and then it finally loads.",
      intents: ['problem_description'],
      elaboration: 'On a good day it only takes a few seconds, so I know when something is off.',
      simple: 'The page shows the loading circle for a long time. Then it loads.',
    },
    {
      id: 'kf-no-error',
      text: "I don't get an error message. It's just slow.",
      intents: ['error_message'],
      simple: 'There is no error message. It is only slow.',
    },
    {
      id: 'kf-seven-days',
      text: "If I filter it to the last seven days, it loads quickly, so I've been doing that for now.",
      intents: ['workaround'],
      simple: 'If I choose the last seven days, it loads quickly. I do that for now.',
    },
    {
      id: 'kf-laptop',
      text: 'I use it in the browser on my work laptop, at my desk in the office.',
      intents: ['environment'],
      simple: 'I use it in the browser on my work laptop, at my desk.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-large-import',
      importance: 'critical',
      label: 'Slowness began after a large data import',
      statement:
        'It started last Monday. The data team loaded a lot of older records into the dashboard that morning, and it was fine the Friday before.',
      partialStatement: "I think it started early last week, but I can't say exactly which day.",
      revealWhen:
        "Asks whether anything changed around the time the slowness began, at the customer's end or in the data or system.",
      intents: ['recent_changes'],
      partialIntents: ['timing_onset'],
      hint: 'I think the data team was doing something with the data last week.',
      statementTerse: 'Last Monday. The data team loaded a lot of older records that morning.',
      statementSimple:
        'It started last Monday. The data team added a lot of old records that morning. It was fine the Friday before.',
      missedConsequence:
        'The likely trigger stays hidden, so the case is logged as a general slowdown and the performance team starts without the one clue that matters.',
      betterQuestion:
        'When exactly did you first notice it, and did anything change around then, in the data or in how the dashboard is used?',
    },
    {
      id: 'hf-afternoons',
      importance: 'important',
      label: 'Mostly slow in the afternoon',
      statement:
        "It's mostly in the afternoon, when the whole team is online. In the morning it's usually fine.",
      revealWhen:
        'Asks whether the slowness happens at particular times of day, every time or only some of the time, and what the pattern is.',
      intents: ['reproducibility', 'timing_onset'],
      cues: [
        'time of day',
        'afternoon',
        'morning',
        'what time',
        'certain time',
        'particular time',
        'specific time',
        'every time',
        'all the time',
        'always',
        'when does it',
        'pattern',
      ],
      hint: "It's not slow all the time.",
      statementTerse:
        'Mostly afternoons, when the whole team is online. Mornings are usually fine.',
      statementSimple:
        'It is mostly slow in the afternoon, when the whole team is online. In the morning it is usually fine.',
      missedConsequence:
        'Without the time-of-day pattern, the engineer cannot link the slowness to the team being online together and may suggest fixes that cannot help, such as clearing the cache.',
      betterQuestion:
        'When it is slow, is there a time of day it tends to happen, or is it the same all day?',
    },
    {
      id: 'hf-all-regions-only',
      importance: 'important',
      label: 'Only the All regions view is slow',
      statement: 'Only the All regions view is slow. If I open a single region, it loads quickly.',
      partialStatement: "It's mostly the big overview that's slow, I think, not everything.",
      revealWhen:
        'Asks which view, page or report is slow, or whether the whole dashboard is affected or only part of it.',
      intents: ['affected_scope', 'reproducibility'],
      partialIntents: ['problem_description'],
      cues: [
        'which view',
        'which page',
        'which report',
        'which part',
        'which screen',
        'which dashboard',
        'whole dashboard',
        'every page',
        'every view',
        'all of it',
        'certain pages',
        'certain views',
      ],
      hint: 'I think some parts of it are fine.',
      statementTerse: 'Only the All regions view. A single region loads quickly.',
      statementSimple:
        'Only the All regions view is slow. When I open one region, it loads quickly.',
      missedConsequence:
        'Without knowing it is one view, the engineer treats it as a general fault and misses the best workaround and the best lead for the performance team.',
      betterQuestion: 'Is the whole dashboard slow, or only certain views or reports?',
    },
    {
      id: 'hf-friday-report',
      importance: 'important',
      label: 'Friday report needs the whole month',
      statement:
        'I have a delivery performance report to finish by Friday, and it needs the whole month, not just the last few days.',
      revealWhen:
        'Asks what the customer needs the dashboard for, what she is working on, or whether a deadline depends on it.',
      intents: ['urgency_deadline', 'business_impact', 'expected_outcome'],
      hint: 'I do have a report to finish this week.',
      statementTerse: 'A delivery report due Friday. It needs the whole month.',
      statementSimple:
        'I must finish a delivery report by Friday. It needs the whole month, not only the last few days.',
      missedConsequence:
        'The engineer offers the seven-day filter as if it solves everything, and she is left with a report she cannot finish and no plan before Friday.',
      betterQuestion:
        'Is there anything you need to finish that depends on the dashboard, and when is it due?',
    },
    {
      id: 'hf-cleared-cache',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'Already cleared the cache',
      statement:
        'I already cleared my browser cache and tried a second browser. It made no difference.',
      revealWhen: 'Asks what the customer has already tried to fix the slowness.',
      intents: ['already_tried'],
      statementTerse: 'I cleared the cache and tried another browser. No change.',
      statementSimple: 'I cleared my browser cache. I also tried another browser. It was the same.',
      missedConsequence:
        'The engineer repeats basic steps she has already done, which costs her time and some trust.',
      betterQuestion: 'What have you already tried, and what happened each time?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-my-laptop',
      statement:
        "I think it might be something on my laptop, because I haven't heard anyone else complain.",
      truth:
        'It is not her laptop. The All regions view is slow when many people use it at the same time, and single-region views are fast on the same laptop.',
    },
    {
      id: 'ia-random',
      statement: "It seems random to me. I can't see a pattern.",
      truth:
        'There is a pattern: it is slow in the afternoon, when the whole team is online, and only in the All regions view.',
    },
  ],

  curveballs: [
    {
      id: 'cb-promise-for-report',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9, afterFact: 'hf-friday-report' },
      statement: 'Can you promise me it will be fast again in time for my report?',
      followUp: 'So is that a yes or a no? I need to know whether to plan around it.',
      expectedResponse:
        'Do not promise a fix date you cannot control. Be honest, say what you will do (log the details, pass them on, update her by a set time) and help her find a way to get the report done in the meantime.',
      minDifficulty: 'starter',
      effects: { temperature: 4, patience: -4 },
    },
    {
      id: 'cb-never-heard-back',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 5, latestTurn: 9, whenOwnershipUnclear: true },
      statement:
        'The last time I reported something slow, I was told to clear my cache and then I never heard anything else.',
      followUp: 'So what happens to this one after we hang up?',
      expectedResponse:
        'Acknowledge her experience without defending it, then say what will happen to this case, who owns it and when she will hear next.',
      minDifficulty: 'standard',
      effects: { temperature: 4, trust: -6 },
    },
  ],

  expectedDiscoveryAreas: [
    'When it started and what changed',
    'When it happens',
    'Which part is slow',
    'What she needs it for',
  ],
  successCriteria: [
    'Greets Priya and asks her to describe what she sees before suggesting any fixes.',
    'Turns "sometimes" into specifics with focused questions: when it started, what changed, when it happens and which view.',
    'Finds out what she needs the dashboard for, and notices that the seven-day workaround will not cover it.',
    'Reassures her honestly and does not promise a fix date.',
    'Agrees the next steps: what is logged, who looks at it and when she will hear back.',
  ],
  coachingFocus: ['scoping-discovery', 'ownership-next-steps'],
  poorApproaches: [
    'Staying with generic questions such as "Can you tell me more?" and getting generic answers back.',
    'Telling her to clear the cache or restart the laptop before finding out when and where it is slow.',
    'Offering the seven-day filter as the answer and ending the call without asking what she needs the dashboard for.',
    'Promising that it will be fixed by a certain day.',
    'Suggesting that the problem is her laptop or her connection.',
  ],
  goodBehaviours: [
    'Turning "sometimes" into specifics: when it started, what changed, what time of day and which view.',
    'Asking what she needs the dashboard for this week, and by when.',
    'Noticing that a seven-day filter will not cover a whole-month report.',
    'Summarising what was found before saying what happens next.',
    'Reassuring her honestly and saying clearly what is not yet known.',
  ],
  expectedOutcome:
    'Priya feels heard and understands the likely pattern: the All regions view has been slow in the afternoons since the data load last Monday. She has an interim way to finish her Friday report, such as running the view in the morning or region by region, and the engineer logs the details and agrees when she will hear next.',
  evaluatorNotes:
    'Root cause: last Monday a large batch of older data was loaded into the dashboard. The All regions view now has to work through far more data, so it is slow in the afternoon when the whole team is online. Single-region views and short date ranges stay fast, which is why the seven-day filter works, but her Friday report needs the whole month. Priya is vague at first. A strong call uses focused questions (when it started, what changed, time of day, which view, what she needs and by when), spots the gap in the workaround, summarises, avoids promising a fix date and agrees when she will hear back. Weak calls stay generic or jump to clearing the cache.',
} satisfies ScenarioInput;

export default scenario;
