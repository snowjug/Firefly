import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario. Everything here is fictional: people, organisation and case. The product is
// real, so the customer only describes what he sees and was told, in everyday words.
//
// Root cause (hidden from the trainee; plausible, not validated product behaviour): the analytics team
// deployed a pilot with a group of large virtual machines in the middle of last month. The pilot
// finished after about a week, but nobody switched the machines off, so they keep running and next
// month's charges may be higher. Nobody set a budget alert, so the invoice was the first sign. The
// pilot sits in the shared subscription, so its charges are mixed in with other workloads. On the
// second contact Marek was promised a call back with a breakdown that never came, which is why he
// is angrier than the money alone explains. He believes the bill is wrong.
//
// A strong call does not guess a pricing answer or promise a credit. It acknowledges the third
// contact and the broken promise, owns the case, reads the case notes instead of re-asking, asks which
// invoice lines have grown and whether the project is still in use, brings the project team into the
// next step, handles the threat to move the workload calmly, and gives a specific time for the next
// update.

const scenario = {
  id: 'azure-unexpected-charges',
  version: 1,
  title: 'Azure bill far above budget after a team deployed a new project',
  shortTitle: 'Bill far above budget',
  listSummary:
    'A finance controller wants an explanation for a much higher Azure bill, on his third contact.',
  summary:
    'A finance controller at Humongous Insurance is calling for the third time about an Azure charge far above what he budgeted, after a team deployed a new project. Earlier contacts did not explain it. He wants a clear answer and a named owner, and he has to account for the overspend.',
  tags: ['azure', 'billing', 'escalated', 'finance', 'cost'],
  estimatedMinutes: 11,

  product: { id: 'azure', area: 'Billing' },
  caseReference: 'SIM-440002',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    revisedOn: '2026-11-22',
    productFamily: 'azure',
    sourceCategories: ['microsoft-learn'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    review: 'assistant-reviewed',
    notes:
      "Checked on 22 Nov 2026 against current public Microsoft Learn pages on Cost Management, VM states and billing, and analysing unexpected charges. Billing timeline and earlier-contact wording made consistent; next-bill claim hedged. AI-assisted review, not a mentor's.",
  },

  issueType: 'billing-licence',
  impact: 'medium',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'demanding',
  callStage: 'escalated',
  difficulty: 'standard',

  persona: {
    name: 'Marek Sobolewski',
    speaker: 'male',
    role: 'Finance Controller',
    organisation: 'Humongous Insurance',
    background:
      "Marek owns the cloud budget for Humongous Insurance's claims and analytics systems. He knows invoices and variances inside out but not the technical side, and he has already explained this problem twice. He has to account for the overspend at a finance review.",
    voice:
      'Direct and businesslike, in short, complete sentences. Wants names, dates and commitments, and challenges vague answers. Annoyed rather than abusive. Eases when someone owns the problem and gives a specific time; turns cold if he is handed general advice he has heard before.',
  },
  environment: {
    details: [
      'The insurer runs several workloads in Azure for claims, analytics and internal systems.',
      'Marek manages the cloud budget and the monthly invoices, not the technical side.',
      'Each team has an IT contact who looks after its own workloads.',
      'The analytics team deployed a new project last month.',
      'Finance reviews the monthly Azure invoice later in the following month.',
    ],
  },
  affectedUsers: {
    low: { count: 2, summary: 'The finance controller and the budget holder for the project.' },
    medium: {
      count: 6,
      summary: 'The finance team and the project sponsors who must explain the overspend.',
    },
    high: { count: 45, summary: 'Budget holders and teams whose cloud work the CFO may pause.' },
  },
  customerObjective:
    'Understand what is behind the Azure charge, find out whether it is right, and get a named owner and a clear plan before he has to account for it.',
  customerExpectation:
    'A straight explanation of what the charge is for, an owner who stays with the case, and dates he can hold people to, without more general pricing advice.',
  desiredOutcome:
    'He knows which part of the bill has grown and why, who brings the project team into the next step and when, and when he will next hear back. No credit or refund is promised.',
  previousTroubleshooting: [
    'Marek checked the cost reports himself: the total matches the invoice but shows no reason for the increase.',
    "He asked the analytics team's IT contact whether anything unusual was running and was told only the new project.",
    'A general guide to understanding Azure charges was sent after the second contact.',
  ],
  recentChanges: ['The analytics team deployed a new project last month.'],

  publicBrief: {
    issue: 'The monthly Azure charge is far higher than expected after a new project was deployed.',
    impact: {
      low: "One month's overspend he can absorb, but he still wants an explanation.",
      medium: 'The overspend breaks the monthly budget and must be explained at a finance review.',
      high: 'The CFO is asking questions and may pause cloud projects until the charge is explained.',
    },
    objective:
      'Rebuild trust, take ownership, understand what drives the charge, and agree what happens next.',
    knownContext:
      'A team deployed a new project last month. The customer is a finance controller who sees invoices, not the technical details.',
    previousContact:
      'Told charges follow usage; cost reports match invoice. A guide was sent, but no one reviewed the account.',
    environment:
      'Azure workloads run for several teams at Humongous Insurance. The customer manages budgets and invoices.',
  },
  brief: {
    situation:
      'A finance controller at an insurance company is calling about an Azure charge far above what he budgeted, after a team deployed a new project. He wants a clear explanation and an owner, and he has to account for the overspend.',
    goal: 'Find out what is behind the charge, take ownership, avoid promising what you cannot confirm, and agree what happens next and when he will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      "You cannot see the customer's account in this practice call, so rely on what he tells you.",
    ],
  },

  openingCore:
    "Our Azure bill for last month is far higher than we budgeted. I need to know what it's for.",
  impactVariants: {
    low: {
      summary: 'It dents my budget, but we can absorb it for a month.',
      detail:
        "It's one month's overspend and we can cover it from reserves. I just need to understand it before the next invoice arrives.",
      deadline: "I'd like an answer before the next billing run, but there's no hard date.",
    },
    medium: {
      summary:
        "It's blown through our monthly budget, and I have to account for it at the finance review.",
      detail:
        "The overspend is more than my whole quarter's contingency. The finance team and the project sponsors are asking me about it, and I have to explain it to the CFO.",
      deadline: 'I have to explain the variance at the finance review on Friday.',
    },
    high: {
      summary: "The CFO has seen the invoice, and she's talking about pausing our cloud projects.",
      detail:
        "The CFO wants every cloud project paused until this is explained. Several teams are waiting on that decision, and it's holding up their work.",
      deadline: 'She wants an explanation by tomorrow morning, or the pause starts.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case I raised about our Azure bill. I still haven't had an explanation, and I need to know where it stands.",
      brief:
        'Marek raised a case about the higher-than-expected charge and is still waiting for an explanation.',
    },
    escalated: {
      opening:
        "I'm calling about our Azure bill. This is my third call, and nobody has explained what's behind it. I need someone to take ownership.",
      brief:
        'Two earlier contacts have not explained the charge. Trust is low and he has no patience for repeated questions or general advice.',
    },
    closure: {
      opening:
        "I'm calling about the Azure charge on our bill, to confirm we've understood it so we can close the case. I also want to be sure it won't happen again.",
      brief:
        'Marek expects a wrap-up: what drove the charge, what was agreed, and what will warn him sooner next time.',
    },
  },
  priorHistory: [
    {
      when: 'Three weeks ago',
      summary:
        'Marek contacted support about a charge far above budget. He was told charges follow usage and was pointed to the cost reports. No invoice breakdown was reviewed with him.',
    },
    {
      when: 'Last week',
      summary:
        'Second contact. A general guide to understanding Azure charges was sent. Nobody reviewed the account with him, and the case stayed open.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-what',
      text: "Our Azure bill for last month is far higher than we budgeted. Nobody has told me what it's for.",
      intents: ['problem_description'],
      elaboration: "It's the first time our cloud spend has jumped like this.",
      simple: 'Our Azure bill for last month is much higher than planned. Nobody has told me why.',
    },
    {
      id: 'kf-amount',
      text: 'We budgeted about eleven thousand dollars for the month. The bill came to just under forty-five thousand.',
      intents: ['business_impact', 'account_details'],
      cues: [
        'how much',
        'how big',
        'how far',
        'budget',
        'amount',
        'figure',
        'total',
        'overspend',
        'cost',
        'what was the bill',
      ],
      simple:
        'We planned about eleven thousand dollars. The bill is nearly forty-five thousand dollars.',
    },
    {
      id: 'kf-first-high-bill',
      text: "It started with last month's invoice.",
      intents: ['timing_onset'],
      cues: [
        'when did this',
        'when did it',
        'when did the problem',
        'when did the charge',
        'when did the bill',
        'since when',
        'how long',
      ],
      simple: 'It started with the invoice for last month.',
    },
    {
      id: 'kf-new-project',
      text: "The analytics team deployed a new project last month. It's the only big change I know of.",
      intents: ['recent_changes'],
      cues: [
        'change',
        'new project',
        'anything new',
        'since last month',
        'what happened',
        'deployed',
        'what did the team do',
      ],
      simple:
        'The analytics team started a new project last month. It is the only big change I know of.',
    },
    {
      id: 'kf-told-before',
      text: "I've been told it depends on usage. Nobody has looked at our account.",
      intents: ['already_tried', 'previous_contact'],
      cues: [
        'told',
        'earlier contacts',
        'earlier calls',
        'last time',
        'what did they say',
        'what have you tried',
        'already tried',
        'what have you done',
        'before',
        'previous',
        'so far',
        'spoken to',
      ],
      simple: 'I was told it depends on usage. Nobody has looked at our account.',
    },
    {
      id: 'kf-own-check',
      text: "I've checked the cost reports myself. The total matches the invoice, but I can't see what's behind it.",
      intents: ['already_tried'],
      cues: [
        'checked',
        'looked at',
        'reviewed',
        'cost report',
        'cost view',
        'your own',
        'investigated',
      ],
      simple:
        'I checked the cost reports myself. The total matches the invoice, but I cannot see the reason.',
    },
    {
      id: 'kf-role',
      text: "I'm the finance controller. I manage the budget and the invoices, not the technical side.",
      intents: ['account_details'],
      cues: [
        'your role',
        'who are you',
        'what do you do',
        'who is responsible',
        'who owns',
        'your responsibility',
        'who looks after',
        'who manages',
      ],
      simple:
        'I am the finance controller. I look after the budget and the invoices, not the technical side.',
    },
    {
      id: 'kf-outcome',
      text: "I want a straight answer on what this charge is for, and whether it's right.",
      intents: ['expected_outcome'],
      simple: 'I want a clear answer. What is the charge for, and is it correct?',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-project-start',
      intents: ['timing_onset'],
      cues: [
        'when did the project',
        'when was it deployed',
        'when did they start',
        'when was it switched on',
        'start date',
        'went live',
        'switched on',
        'deployed when',
      ],
      text: "Around the middle of last month, I think. Or maybe a bit later. I'd have to check the date.",
      confirmedText: 'Their IT contact says it went live on the sixteenth, yes.',
    },
    {
      id: 'vf-budget-basis',
      intents: ['account_details', 'expected_outcome'],
      cues: [
        'how was the budget',
        'where did the budget',
        'budget based',
        'estimate',
        'forecast',
        'planned for',
        'how did you plan',
      ],
      text: "I think the budget came from an estimate the team gave us before they started, but I don't have it in front of me.",
      confirmedText: "Yes, it came from the team's own estimate, which assumed a small trial.",
    },
  ],
  checkableFacts: [
    {
      id: 'cf-previous-months',
      intents: ['timing_onset', 'reproducibility'],
      cues: [
        'previous months',
        'earlier months',
        'before this month',
        'happened before',
        'been this high',
        'usually',
        'normally',
        'trend',
        'compared',
        'last few months',
        'in the past',
        'history',
      ],
      checking: 'Let me look at the earlier months.',
      text: 'The three months before this one were each within a few hundred dollars of budget.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-resources',
      intents: ['environment', 'problem_description'],
      cues: [
        'what exactly did they',
        'what did they set up',
        'what did they build',
        'what did they deploy',
        'what was deployed',
        'which resources',
        'what resources',
        'what machines',
        'what size',
        'how large',
        'what configuration',
        'what services',
      ],
      text: "I don't know exactly what they set up. I only see the totals on the invoice.",
      whoKnows: 'the analytics team lead',
    },
    {
      id: 'uf-pricing',
      intents: ['account_details'],
      cues: ['priced', 'pricing', 'rate', 'tier', 'reservation', 'discount', 'how is it charged'],
      text: "I couldn't tell you how that's priced. I just see what lands on the invoice.",
      whoKnows: 'our cloud administrator',
    },
    {
      id: 'uf-subscription-name',
      intents: ['account_details', 'environment'],
      cues: ['which subscription', 'subscription name', 'which account', 'account name', 'tenant'],
      text: "I couldn't give you the subscription name off the top of my head. That's one for our cloud administrator.",
      whoKnows: 'our cloud administrator',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-close',
      text: "We're in the middle of the quarter-end close, so my week is already full.",
    },
    {
      id: 'if-claims',
      text: 'I ran the budget for our claims system before this, and that always came in on target.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-pilot-finished-left-running',
      importance: 'critical',
      label: 'Project finished, machines left running',
      statement:
        "The pilot only ran for about a week, and it finished a while ago. As far as I know, nobody switched off the machines the analytics team set up for it, so they're still running.",
      revealWhen:
        'Asks whether the new project is still in use, or whether what the team built has finished, been shut down or been cleaned up.',
      intents: ['recent_changes', 'environment'],
      cues: [
        'still running',
        'still in use',
        'still being used',
        'still used',
        'still need',
        'finished',
        'ended',
        'switched off',
        'shut down',
        'turned off',
        'decommission',
        'cleaned up',
      ],
      hint: 'I think the project itself wrapped up a while ago.',
      minDifficulty: 'starter',
      statementTerse:
        "The pilot finished a while ago. I don't think anyone switched its machines off.",
      statementSimple:
        'The pilot ended a while ago. I think nobody turned off its machines, so they are still running.',
      missedConsequence:
        'The call never reaches the most likely reason for the charge, so he leaves with another general answer after his third contact.',
      betterQuestion:
        'Is the project the team deployed still in use, or did it finish and get switched off?',
    },
    {
      id: 'hf-no-spending-alert',
      importance: 'important',
      label: 'No budget alert was set',
      statement:
        "We didn't have any budget or spending alert on it. The first we knew was when the invoice arrived.",
      revealWhen:
        'Asks how or when the customer first noticed the charge, or whether any budget, spending limit or alert was in place.',
      intents: ['timing_onset'],
      cues: [
        'budget alert',
        'spending alert',
        'alert',
        'warning',
        'first notice',
        'first noticed',
        'find out',
        'found out',
        'how did you spot',
        'spending limit',
        'notified',
        'how did you know',
      ],
      hint: 'I only saw it when the invoice landed.',
      minDifficulty: 'starter',
      statementTerse: 'No budget alert was set. We saw it when the invoice landed.',
      statementSimple: 'We had no budget alert. We only saw the problem when the invoice came.',
      missedConsequence:
        'The engineer misses how the overspend went unnoticed, so there is nothing to put in place to warn him sooner next time.',
      betterQuestion:
        'How did you first notice the charge, and was there any budget alert in place?',
    },
    {
      id: 'hf-callback-promise',
      importance: 'important',
      label: 'A promised call back never came',
      stages: ['follow-up', 'escalated', 'closure'],
      statement:
        'On the second contact, I was promised a call back with a breakdown of the charge by the end of that week. Nobody called.',
      revealWhen:
        'Asks what the customer was told or promised on the earlier contacts, or whether anyone agreed to come back to them.',
      intents: ['previous_contact'],
      cues: [
        'what were you told',
        'what have you been told',
        'promised',
        'agreed',
        'call back',
        'callback',
        'come back to you',
        'followed up',
        'last time',
        'earlier contacts',
        'earlier calls',
        'what did they say',
      ],
      minDifficulty: 'standard',
      minTrust: 35,
      statementTerse: 'I was promised a call back with a breakdown. Nobody called.',
      statementSimple:
        'On my second contact I was promised a call back with a breakdown. Nobody called me.',
      missedConsequence:
        'The specific broken promise behind his anger stays hidden, so the apology stays generic and the engineer risks another call-back promise with no time attached.',
      betterQuestion: 'Did anyone promise a further update, and did it happen?',
    },
    {
      id: 'hf-increase-is-compute',
      importance: 'important',
      label: 'Nearly all the increase is one line',
      knowledge: 'after-checking',
      checking: "Give me a moment, I'll open the invoice.",
      statement:
        'Almost all of the increase is on one line, virtual machines, with some storage that goes with it. Everything else is in line with other months.',
      revealWhen:
        'Asks which part of the bill has grown, what the biggest charge lines are, or asks the customer to look at the invoice breakdown.',
      intents: ['account_details'],
      cues: [
        'breakdown',
        'which line',
        'which lines',
        'which service',
        'line item',
        'biggest',
        'which part',
        'what is the charge',
        "what's the charge",
        'what makes up',
        'cost report',
        'invoice',
      ],
      minDifficulty: 'standard',
      statementTerse:
        'Nearly all of it is virtual machines, plus some storage. The rest is normal.',
      statementSimple:
        'Almost all of the extra cost is on one line, virtual machines, with a little storage. The other lines are normal.',
      missedConsequence:
        'Nobody looks at the breakdown, so the call stays at the level of general advice that earlier contacts already gave.',
      betterQuestion: 'Can you open the invoice and tell me which lines have grown the most?',
    },
    {
      id: 'hf-shared-subscription',
      importance: 'helpful',
      label: 'Project charges are mixed in with others',
      statement:
        "The pilot ran in the same subscription as our other workloads, so its charges are mixed in with everyone else's on the invoice.",
      revealWhen:
        'Asks whether the new project has its own account, subscription or tags, or how its charges can be told apart from other workloads.',
      intents: ['account_details'],
      cues: [
        'subscription',
        'separate account',
        'its own',
        'tags',
        'tagged',
        'told apart',
        'split by',
        'split the',
        'cost centre',
        'resource group',
        'shared',
      ],
      minDifficulty: 'challenge',
      statementTerse:
        'It ran in our shared subscription, so its charges are mixed in with the rest.',
      statementSimple:
        'The pilot used the same subscription as our other work. Its charges are mixed in with the others.',
      missedConsequence:
        'The engineer does not learn why the project charges are hard to separate, so the plan to trace them is vague.',
      betterQuestion:
        'Does the new project have its own subscription, or do its charges sit alongside other workloads?',
    },
  ],
  incorrectAssumptions: [
    {
      id: 'ia-bill-wrong',
      statement: "I think the bill's wrong. There's no way we used that much.",
      truth:
        'In this scenario there is no sign of a billing error. The charge reflects what the new project left running. A strong call explores the invoice breakdown instead of agreeing or arguing.',
    },
  ],
  curveballs: [
    {
      id: 'cb-move-the-workload',
      type: 'threaten-cancel',
      trigger: { earliestTurn: 5, latestTurn: 9, whenTemperatureAtLeast: 45 },
      statement:
        "If I can't get a straight answer, I'll recommend we move this workload to another provider. I've had two contacts already.",
      followUp: "I'm serious about moving it. I need to hear what will actually change.",
      expectedResponse:
        'Take it seriously without arguing or offering discounts. Acknowledge the earlier contacts and the business risk, own the next step and give a specific time for the next update.',
      minDifficulty: 'starter',
    },
    {
      id: 'cb-credit-yes-or-no',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Will we get this charge credited back? I need a yes or no.',
      followUp: 'So is it a yes or a no?',
      expectedResponse:
        'Do not promise a credit or an outcome you cannot confirm. Say what you can commit to, such as reviewing the charges with him and a time for the next update, and what the review depends on.',
      minDifficulty: 'standard',
    },
    {
      id: 'cb-finance-review',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 7, whenImpactUnacknowledged: true },
      statement:
        'I should be clear about timing. I need an explanation I can take to finance. What can you commit to?',
      followUp: 'What exactly will you do, and when will I hear back?',
      expectedResponse:
        'Acknowledge the pressure, be honest about what can and cannot be committed to, say what you will do first and by when, and agree a time for the next update.',
      minDifficulty: 'standard',
    },
  ],
  allowedCurveballs: [
    'threaten-cancel',
    'unsupported-guarantee',
    'deadline',
    'ask-manager',
    'previous-bad-experience',
    'challenge-credibility',
  ],

  expectedDiscoveryAreas: [
    'Which parts of the bill have grown',
    'What the new project built and whether it is still needed',
    'How and when the charge was first noticed',
    'Whether a further update was promised and delivered',
    'What he needs, and by when',
  ],
  successCriteria: [
    'Acknowledges the earlier contacts and what they did not deliver, without defending anyone.',
    'Takes ownership and says what happens next and when, instead of repeating general pricing advice.',
    'Asks which invoice lines have grown and whether what the new project built is still in use.',
    'Finds whether a further update was promised and delivered, and how he first noticed the charge.',
    'Does not promise a refund, credit or outcome that cannot be confirmed.',
    'Answers the threat to move the workload with calm, specific commitments rather than defensiveness or discounts.',
  ],
  coachingFocus: ['empathy-deescalation', 'ownership-next-steps', 'scoping-discovery'],
  careExpectations: {
    communicate: [
      'Explains in plain finance language, avoids technical terms he cannot use, and confirms back what Marek can take to his CFO.',
    ],
    accountable: [
      'Owns the case from now on, says what happens next and by when, and does not promise a credit or refund.',
    ],
    resourceful: [
      'Uses what the case notes already say, asks to look at the biggest invoice lines together, and brings the project team into the next step.',
    ],
    empathetic: [
      'Names the specific strain (a third contact, an overspend to explain, a promise that was not kept) instead of a generic apology.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Repeating general advice about usage and pricing that earlier contacts already gave.',
    'Promising a refund, credit or discount, or saying the charge is an error, without any basis.',
    'Blaming his team for leaving things running, or defending the earlier contacts.',
    'Asking him to tell the whole story again instead of reading the case notes.',
    'Answering the threat to move the workload with a discount offer or an argument.',
  ],
  goodBehaviours: [
    'Opening by acknowledging that this is the third contact and that nobody has yet explained the charge.',
    'Asking which invoice lines have grown and whether the project the team deployed is still in use.',
    'Asking whether a further update was promised and delivered, then committing to something specific that can be kept.',
    'Offering to bring the project team into the next conversation, and agreeing a time for the next update.',
  ],
  expectedOutcome:
    'Marek leaves knowing which part of the bill has grown and why, who will bring the project team into the next step and when, and that no credit has been promised. He has a time for the next update and a way to be warned sooner next time.',
  evaluatorNotes:
    "Root cause (plausible, not validated product behaviour): the analytics team deployed a pilot with a group of large virtual machines in the middle of last month. The pilot finished after about a week, but nobody switched the machines off, so they keep running and next month's charges may be higher. There was no budget alert, and the pilot sits in the shared subscription. On the second contact Marek was promised a call back that never came. A strong call acknowledges the third contact and the broken promise, owns the case, reads the notes instead of re-asking, asks which lines grew and whether the project is still in use, promises no credit, and gives a specific time for the next update.",
} satisfies ScenarioInput;

export default scenario;
