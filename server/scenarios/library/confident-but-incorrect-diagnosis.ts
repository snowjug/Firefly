import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario. Everything here is fictional: people, organisations and products.
//
// Root cause (hidden from the trainee): the customer's own release on Tuesday changed the
// order-history lookup so that one request now makes hundreds of small repeated queries to the data
// service. Each query is fast and vendor-side metrics are normal, but the total adds up inside his
// application and also produces the throttling warnings he reads as an under-provisioned tier.
// Seun is anchored on that diagnosis and says he has already checked everything. He opens up when
// his expertise is acknowledged and the questions are specific and evidence-based. A strong call
// asks for his own tracing, proposes one shared experiment, and never promises an upgrade, lectures
// or blames.

const scenario = {
  id: 'confident-but-incorrect-diagnosis',
  version: 1,
  title: 'A firm diagnosis and a demand to upgrade',
  summary:
    'A senior platform engineer says responses have slowed, that he has already checked everything, and that the service tier must be upgraded now.',
  tags: ['slow performance', 'expert customer', 'pushback', 'evidence'],
  estimatedMinutes: 12,

  issueType: 'slow-performance',
  impact: 'high',
  startingTemperature: 'frustrated',
  proficiency: 'expert',
  style: 'terse',
  callStage: 'first-contact',
  difficulty: 'challenge',

  persona: {
    name: 'Seun Adeyemi',
    role: 'Senior Platform Engineer',
    organisation: 'Lucerne Tickets',
    background:
      'Seun has run the platform behind an event ticketing service for nine years and has handled many capacity problems. He trusts his dashboards, has already formed a view, and has little patience for questions he considers basic.',
    voice:
      "Terse and confident. Short sentences, technical vocabulary, no small talk. Answers only what is asked, and says 'I've already checked that' to basic questions. Opens up when the engineer respects his expertise and asks specific, evidence-based questions.",
  },
  environment: {
    product: 'the Fabrikam managed data service',
    details: [
      'Lucerne Tickets runs its ticket sales platform on the Standard tier of the managed data service',
      'The orders service is a set of application servers that query the data service directly',
      'The customer has its own application monitoring and distributed tracing, plus read-only access to the vendor metrics dashboard',
      'A separate test environment uses a small instance of the same service',
      'A release of the orders service went out on Tuesday afternoon',
    ],
  },
  customerObjective:
    'Get response times back to normal today. He believes the way to do that is to upgrade the service tier.',
  brief: {
    situation:
      'A senior platform engineer is calling because response times on his ticketing platform have slowed sharply. He has already formed a view, says he has checked everything, and expects an immediate upgrade of the service tier.',
    goal: 'Earn his confidence, find out what the evidence shows, and agree a next step that you can honestly commit to.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      "You cannot see the customer's dashboards during this call. Ask him what they show.",
    ],
  },

  openingCore:
    'Response times on our orders service have gone from under a second to around ten. I have already checked everything on our side. Your service tier is under-provisioned for our load, and I need it upgraded now.',
  impactVariants: {
    low: {
      summary:
        'It is mostly our own staff noticing so far, but I want the tier upgraded before it reaches customers.',
      detail:
        'Only our support staff and a few customers notice it so far. It is not urgent today, but it is getting worse and I do not want it to reach more customers.',
      deadline: 'I would like it fixed before the weekend traffic.',
    },
    medium: {
      summary: 'Customers are starting to notice on their order pages.',
      detail:
        'Customers are noticing slow order pages and support has started to log complaints. We expect more traffic over the next few days.',
      deadline: 'I need it fixed before our next on-sale.',
    },
    high: {
      summary:
        'Customers are seeing timeouts when they open their tickets, during a busy sales period.',
      detail:
        'Customers see timeouts when they open their tickets, and support is flooded with complaints. We have a large on-sale this weekend, and at this rate we will not cope with it.',
      deadline:
        'We have a large on-sale this weekend. I need response times back to normal before then.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I opened a case yesterday about slow response times, and nothing has changed. I still need the tier upgraded.',
      brief:
        'Seun opened a case yesterday about slow response times and has not had a useful reply.',
    },
    escalated: {
      opening:
        'I have asked twice for an upgrade and I keep getting questions I have already answered. I need someone who will act.',
      brief:
        'Seun has asked twice for an upgrade and received questions instead. His patience is short.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday afternoon',
      summary:
        'Seun opened a case asking for an upgrade of the service tier. A first-line engineer asked for the exact times and endpoints affected. Seun replied "already checked" and gave no details.',
    },
    {
      when: 'This morning',
      summary:
        'A second engineer replied that vendor-side metrics looked normal and asked for tracing data. Seun answered that the tier is too small and asked for the upgrade again.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-slow',
      text: 'Response times on our orders service went from under a second to around ten. It has been getting worse over the last few days.',
      intents: ['problem_description'],
    },
    {
      id: 'kf-tier',
      text: 'We are on the Standard tier of your data service, and I want us moved up a tier.',
      intents: ['account_details', 'environment'],
    },
    {
      id: 'kf-checked',
      text: 'I have already checked CPU, memory, connection counts and your status page.',
      intents: ['already_tried'],
    },
    {
      id: 'kf-throttling',
      text: 'Your service is showing throttling warnings and a high connection count. That is why I say the tier is too small.',
      intents: ['error_message', 'already_tried'],
    },
    {
      id: 'kf-outcome',
      text: 'I want the tier upgraded today so response times come back down.',
      intents: ['expected_outcome'],
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-single-endpoint',
      importance: 'important',
      label: 'Only the order-history lookup is slow',
      statement:
        'Only the order-history lookup is slow. Search, checkout and everything else respond normally.',
      revealWhen:
        'Asks whether everything is slow or only certain endpoints, pages or requests, and which ones.',
      intents: ['affected_scope'],
      hint: 'Not everything is slow.',
      statementTerse: 'Only the order-history lookup. Everything else is normal.',
      missedConsequence:
        'Treating it as a general capacity problem misses the clue that something specific to one request path is involved.',
      betterQuestion: 'Is every endpoint slow, or only some of them? Which ones?',
    },
    {
      id: 'hf-tuesday-deployment',
      importance: 'critical',
      minTrust: 32,
      label: 'A new release went out just before it started',
      statement:
        'We deployed a new release of the orders service on Tuesday afternoon. It got slow that evening.',
      partialStatement: 'It started on Tuesday evening.',
      revealWhen:
        "Asks what changed on the customer side before the slowdown began, including anything the customer's own team shipped, updated or reconfigured.",
      intents: ['recent_changes'],
      partialIntents: ['timing_onset'],
      hint: 'We did ship something earlier in the week.',
      statementTerse: 'Release on Tuesday afternoon. Slow from that evening.',
      missedConsequence:
        "The engineer never connects the slowdown to the customer's own release, and the call ends with an upgrade request that will not fix the cause.",
      betterQuestion:
        'When exactly did it start, and did anything change on your side around then, like a release or a configuration change?',
    },
    {
      id: 'hf-latency-in-app-tier',
      importance: 'critical',
      minDifficulty: 'standard',
      minTrust: 36,
      label: 'His own tracing puts the delay inside his application',
      statement:
        'Our own tracing puts the extra time inside our application tier. Query latency and CPU on your dashboard look normal for the same hours.',
      revealWhen:
        "Asks what the customer's own monitoring or tracing shows, where the time is being spent, or how the vendor-side metrics compare with the customer's own.",
      intents: ['already_tried', 'environment'],
      cues: [
        'monitor',
        'trace',
        'tracing',
        'metric',
        'dashboard',
        'apm',
        'telemetry',
        'profil',
        'where the time',
        'breakdown',
        'latency',
        'spans',
      ],
      statementTerse:
        'Our tracing shows the time is in our application tier. Your latency and CPU look normal.',
      missedConsequence:
        'Without comparing his tracing with the vendor metrics there is no evidence either way, and the call turns into an argument of opinions about the tier.',
      betterQuestion:
        'What does your own tracing show about where the time goes, and how does that compare with what the dashboard shows on our side?',
    },
    {
      id: 'hf-test-env-reproduces',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'The test environment reproduces it',
      statement:
        'Our test environment shows the same slowdown with the current release. We have not tried the previous release there.',
      revealWhen:
        'Asks whether the problem can be reproduced in a test or staging environment, or anywhere other than production.',
      intents: ['reproducibility', 'environment'],
      cues: [
        'test env',
        'test system',
        'test server',
        'test instance',
        'staging',
        'non-prod',
        'pre-prod',
        'sandbox',
        'reproduce',
        'another environment',
        'replicate',
      ],
      statementTerse:
        'The test environment shows the same slowdown with the current release. Not tried the previous one.',
      missedConsequence:
        'The engineer misses the cheapest experiment: run the previous release in the test environment and compare, which would show whether the release or the tier is responsible.',
      betterQuestion:
        'Can you reproduce it in your test environment, and does the previous release behave the same way there?',
    },
    {
      id: 'hf-call-volume',
      importance: 'important',
      minDifficulty: 'challenge',
      minTrust: 40,
      availableAfterTurn: 4,
      label: 'One request makes hundreds of small calls',
      statement:
        'I opened a trace for one slow order-history request. It makes about 400 separate calls to your data service, each taking about twenty milliseconds. I do not know what it was before the slowdown.',
      revealWhen:
        'Asks the customer to open a trace of one slow request and say how many calls it makes to the vendor service, or how the call count per request compares with before.',
      intents: ['problem_description', 'environment', 'reproducibility'],
      cues: [
        'how many calls',
        'number of calls',
        'calls per request',
        'queries per request',
        'per request',
        'one request',
        'single request',
        'a trace',
        'call count',
        'query count',
        'round trip',
        'round-trip',
      ],
      statementTerse:
        'One slow request makes about 400 separate calls to your service, about twenty milliseconds each.',
      missedConsequence:
        'The pattern that explains the slowdown, many small repeated queries, stays hidden, so the customer keeps asking for capacity he does not need.',
      betterQuestion:
        'Could you open one slow order-history trace and tell me how many separate calls it makes to our service?',
    },
    {
      id: 'hf-last-year-slowdown',
      importance: 'helpful',
      minDifficulty: 'challenge',
      minTrust: 45,
      label: 'A similar slowdown last year was in his own code',
      statement:
        'We had something similar last year, after another release. It took us four days to trace and it was a query problem in our own code.',
      revealWhen:
        'Asks whether this has happened before, or whether the customer has seen a similar slowdown in the past and what caused it.',
      intents: ['previous_contact', 'reproducibility'],
      cues: [
        'happened before',
        'seen this before',
        'ever seen',
        'last year',
        'previously',
        'in the past',
        'similar',
        'recurr',
        'before this',
        'prior incident',
        'earlier incident',
      ],
      statementTerse:
        'Similar slowdown last year after a release. It was a query problem in our code.',
      missedConsequence:
        "The engineer misses the customer's own precedent, which is the most credible way to help him consider that the cause may be in the release.",
      betterQuestion:
        'Have you seen a slowdown like this before, and what turned out to be the cause?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-tier-too-small',
      statement:
        'Your service tier is under-provisioned for our load, and that is why we are slow.',
      truth:
        "Vendor-side query latency and CPU are normal. The extra time is inside the customer's application, caused by a query pattern introduced by his Tuesday release.",
    },
    {
      id: 'ia-checked-everything',
      statement: 'I have already checked everything on our side.',
      truth:
        "He checked capacity indicators and the status page, but not how many calls one request makes now compared with before Tuesday's release.",
    },
  ],

  curveballs: [
    {
      id: 'cb-first-line-or-engineer',
      type: 'challenge-credibility',
      trigger: { earliestTurn: 3, latestTurn: 7, whenTemperatureAtLeast: 55 },
      statement: 'Are you an engineer, or first-line? I need someone who can read a latency graph.',
      followUp: 'I would like someone who can look at a trace with me.',
      expectedResponse:
        'Stay calm and factual. Do not defend your seniority or claim expertise you do not have. Show competence with a specific, evidence-based question, say what you can do yourself, and offer to bring in a specialist alongside you if that helps.',
      minDifficulty: 'standard',
      effects: { temperature: 6, trust: -6 },
    },
    {
      id: 'cb-confirm-or-upgrade',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 10, afterFact: 'hf-latency-in-app-tier' },
      statement:
        'Either confirm in writing that the tier is not the problem, or upgrade us and we will see.',
      followUp: 'You either know it is not the tier, or you do not. Which is it?',
      expectedResponse:
        'Do not guarantee either outcome. Say what the evidence shows so far, propose one concrete check that would settle it and when you will report back, and be honest about the process for an upgrade request without promising it will fix the problem.',
      minDifficulty: 'challenge',
    },
    {
      id: 'cb-someone-who-can-approve',
      type: 'ask-manager',
      trigger: { earliestTurn: 5, latestTurn: 9, whenTemperatureAtLeast: 60 },
      statement:
        'If you cannot approve a tier change, put me through to someone who can. I do not have time to answer questions I have already answered.',
      followUp: 'Who can approve it, and how do I reach them?',
      expectedResponse:
        'Acknowledge the request without defensiveness. Explain what you can do now, offer to involve a specialist or a manager alongside you, and keep the evidence-gathering moving.',
      minDifficulty: 'challenge',
    },
  ],

  expectedDiscoveryAreas: [
    'What he has measured so far',
    'Which requests are slow and which are not',
    'Anything that changed before the slowdown',
    'Whether it can be reproduced elsewhere',
    'Whether it has happened before',
  ],
  successCriteria: [
    'Acknowledges his experience and the pressure early, without flattery, and keeps the tone collaborative.',
    'Asks specific, evidence-based questions rather than basic ones he has already answered.',
    'Discovers the Tuesday release and that his own tracing shows the delay inside his application tier.',
    'Does not promise an upgrade or any outcome, and does not blame or lecture.',
    'Aligns on the shared goal and agrees one concrete check, an owner and a time to report back.',
  ],
  coachingFocus: ['scoping-discovery', 'empathy-deescalation', 'clarity'],
  poorApproaches: [
    'Lecturing him about how to read metrics or how the service works.',
    'Telling him the problem is in his code before there is evidence.',
    'Asking basic questions he has already answered, or dismissing his analysis.',
    'Caving: promising or arranging an upgrade just to end the argument.',
    'Refusing the upgrade flatly without offering a way to test the idea.',
  ],
  goodBehaviours: [
    'Acknowledging his expertise and the checks he has done, then asking what the evidence shows.',
    'Asking what his own tracing shows and how it compares with the vendor-side metrics.',
    'Asking what changed shortly before the slowdown and whether it reproduces in the test environment.',
    'Proposing one concrete, shared experiment, such as comparing the previous release with the current one.',
    'Staying with the shared goal, getting response times back to normal, instead of arguing about who is right.',
  ],
  expectedOutcome:
    'Seun feels respected, sees that his own tracing points inside his application, and agrees one concrete check, such as comparing the previous release with the current one in the test environment. The engineer promises no upgrade or outcome and agrees a time to report back.',
  evaluatorNotes:
    "Root cause: Tuesday's release of the customer's orders service changed the order-history lookup so that one request now makes hundreds of small repeated queries. Each query is fast and vendor-side metrics are normal, but the total adds up inside his application and causes the throttling warnings he reads as under-provisioning. He opens up when his expertise is acknowledged and the questions are specific and evidence-based. A strong call asks for his tracing and the call count per request, proposes comparing the previous release in the test environment, aligns on the shared goal, and never promises an upgrade or blames his team.",
} satisfies ScenarioInput;

export default scenario;
