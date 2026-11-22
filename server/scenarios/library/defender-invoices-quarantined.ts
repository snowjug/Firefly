import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario. Everything here is fictional: people, organisation and case number.
//
// Root cause (hidden from the trainee; plausible, and never confirmed on the call): a few of
// Proseware's regular suppliers recently moved to a new invoicing system, so their invoices now
// arrive differently. Just before that, Proseware's own IT team tightened email protection after
// someone nearly paid a fake invoice, and the quarantine list shows the held invoices as suspected
// phishing. The IT manager is on leave, so nobody inside Proseware has looked at the held messages,
// and the service desk told Sofia to call Microsoft. Nothing in the call depends on knowing where a
// setting lives. A strong call acknowledges the payment run early, scopes by supplier and timing,
// finds the change and the reason shown, never blames IT or promises a release, looks for a
// temporary way to protect the payment run, agrees who acts and by when, and stays steady when
// Sofia threatens to move to another provider.

const scenario = {
  id: 'defender-invoices-quarantined',
  version: 1,
  title: 'Genuine supplier invoices held in quarantine before a payment run',
  shortTitle: 'Invoices held in quarantine',
  listSummary:
    'A finance director says genuine supplier invoices are held in quarantine, putting a payment run at risk.',
  summary:
    'A finance director reports that invoices from regular suppliers are being held in quarantine instead of reaching her accounts payable team, and a supplier payment run depends on them. She is short on patience and wants clear commitments and times.',
  tags: [
    'quarantine',
    'supplier invoices',
    'payment run',
    'security policy',
    'ownership',
    'threat to leave',
  ],
  estimatedMinutes: 12,

  product: { id: 'defender-office-365', area: 'Quarantine' },
  caseReference: 'SIM-430001',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    productFamily: 'microsoft-365',
    sourceCategories: ['author-experience'],
    behaviourCheck: 'not-checked',
    syntheticConfirmed: true,
    review: 'unreviewed',
  },

  issueType: 'policy-security',
  impact: 'high',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'demanding',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Sofia Lindqvist',
    speaker: 'female',
    role: 'Finance Director',
    organisation: 'Proseware',
    background:
      'Sofia runs finance at a regional distributor, including the accounts payable team and the weekly supplier payment run. She is comfortable with the tools her team uses and with email, but email protection is run by the IT team and she has never looked at it. Suppliers and cash timing are her responsibility, and she is used to straight answers.',
    voice:
      'Precise and brisk, in short sentences. Talks in dates, amounts and names, and asks who will do what by when. Challenges vague or scripted answers. Not rude, but impatient. Settles when someone owns the problem and gives a specific time; cools quickly if she is sent somewhere else.',
  },
  environment: {
    details: [
      'Supplier invoices arrive by email in a shared invoices mailbox that the accounts payable team works from every day.',
      'Proseware pays its suppliers in a weekly payment run, which Sofia approves once the invoices have been matched to orders.',
      "Email protection is set up and managed by Proseware's own IT team, not by finance.",
      'Some suppliers attach their invoices as PDF files. Others send a link to the invoice on their own system.',
      'The wider finance team is about fourteen people across accounts payable, procurement and treasury.',
    ],
  },
  affectedUsers: {
    low: { count: 2, summary: 'Two accounts payable clerks who handle the one affected supplier.' },
    medium: {
      count: 6,
      summary: 'The six-person accounts payable team, who all work from the shared mailbox.',
    },
    high: {
      count: 14,
      summary: 'About fourteen people across accounts payable, procurement and treasury.',
    },
  },
  customerObjective:
    'Get the held supplier invoices through to her team, safely, before the payment run, and understand why it happened and what stops it happening again.',
  customerExpectation:
    'A named engineer who owns the case, straight answers about what can and cannot be done, and a specific time for the next update.',
  desiredOutcome:
    'The engineer owns the case, finds the pattern and the recent change, agrees who at Proseware must review the held messages and what happens by when, and does not promise a release or that it will never recur.',
  previousTroubleshooting: [
    'The accounts payable team looked in quarantine and found the missing invoices there.',
    'Nobody has released or deleted any of the held messages.',
    'Sofia phoned the Proseware IT service desk first and was told to contact Microsoft.',
  ],
  recentChanges: [
    "Proseware's IT team tightened its email protection settings just before the invoices went missing, after a near miss with a fake invoice.",
    'Several suppliers have recently moved to a new invoicing system.',
  ],

  publicBrief: {
    issue:
      'Genuine supplier invoices are being held in quarantine instead of reaching the accounts payable team.',
    impact: {
      low: 'A few invoices from one supplier are held. The next payment run is not close.',
      medium: "Invoices from several suppliers are held, and this week's payment run may slip.",
      high: 'Invoices from many suppliers are held, and the next payment run is at risk.',
    },
    objective: 'Find out what is held and why, own the case, and agree next steps with times.',
    knownContext:
      "Sofia is in finance, not IT. Her team receives supplier invoices by email, and Proseware's IT team manages email protection.",
    environment:
      'Proseware uses Defender for Office 365 for email protection. You cannot see its settings in this call, so rely on what Sofia says.',
  },
  brief: {
    situation:
      'A finance director is calling because invoices from regular suppliers are being held in quarantine and are not reaching her accounts payable team. A supplier payment run depends on them. She is short on patience and wants a clear owner and clear times.',
    goal: 'Find out what is held and why, take ownership, and make sure she knows exactly what happens next and when she will hear from you.',
    groundRules: [
      'The customer and organisation are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      "You cannot see Proseware's email settings in this practice call, so rely on what Sofia tells you.",
      'Be honest about what you can and cannot do on this call.',
    ],
  },

  openingCore:
    "Our supplier invoices are being held in quarantine, and my accounts payable team isn't getting them. They're genuine invoices from regular suppliers.",
  impactVariants: {
    low: {
      summary: "It's only one supplier so far, but I don't want it to spread.",
      detail:
        "At the moment it's one supplier's invoices, and two people in my accounts payable team are affected. The next payment run isn't for a week, so there's time. I'd still like it understood before it grows.",
      deadline: "I'd like it understood well before next week's payment run.",
    },
    medium: {
      summary:
        "Invoices from several of our suppliers are stuck, and this week's payment run is at risk.",
      detail:
        "It's invoices from several suppliers, and all six people in my accounts payable team are affected because they work from the same mailbox. I can't approve a payment run for invoices I can't see.",
      deadline: "This week's run goes out on Friday, so I need this sorted before then.",
    },
    high: {
      summary: "I've got a supplier payment run tomorrow, and I can't pay invoices I can't see.",
      detail:
        "It's dozens of invoices from many suppliers, and about fourteen of us in finance are affected. Two suppliers have already phoned to chase payment, and one has said they'll pause deliveries if they're not in tomorrow's run.",
      deadline: 'The run closes at noon tomorrow.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case my team raised yesterday about our quarantined supplier invoices. Nobody has been in touch.",
      brief:
        "Sofia's team raised a case yesterday about the same problem and nobody has contacted her since.",
    },
    escalated: {
      opening:
        'This is my second call about our quarantined supplier invoices. I was told someone would act, and nothing has changed.',
      brief:
        'Sofia has already contacted support once about this. The invoices are still held, and she expects a named owner.',
    },
    closure: {
      opening:
        "I'm calling about our quarantined supplier invoices, to confirm where we've got to so we can close the case.",
      brief:
        'Sofia expects to confirm that the held invoices have reached her team and to understand what happens if it recurs.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday',
      summary:
        'The accounts payable team raised a case about supplier invoices held in quarantine. An automatic acknowledgement was sent.',
    },
    {
      when: 'Since then',
      summary: 'No engineer has been assigned and nobody has contacted Sofia.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-held-in-quarantine',
      text: "My team found the invoices sitting in quarantine. They're from suppliers we've paid for years, so I know they're genuine.",
      intents: ['problem_description', 'error_message'],
      simple:
        'My team found the invoices in quarantine. They are from suppliers we have paid for years. They are genuine.',
    },
    {
      id: 'kf-shared-mailbox',
      text: 'Our supplier invoices all go to one shared mailbox. My accounts payable team works from it every day.',
      intents: ['environment', 'affected_scope'],
    },
    {
      id: 'kf-payment-run',
      text: 'We pay our suppliers in a payment run every week, and I approve it myself.',
      intents: ['business_impact', 'urgency_deadline'],
    },
    {
      id: 'kf-it-manages',
      text: "Our own IT team looks after email protection. I don't touch any of it, and neither does my team.",
      intents: ['account_details', 'environment'],
    },
    {
      id: 'kf-outcome',
      text: "I want those invoices delivered safely and the payment run protected. And I want to know this won't keep happening.",
      intents: ['expected_outcome'],
      simple:
        'I want the invoices delivered safely. I want the payment run protected. I want to know it will not happen again.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-start',
      intents: ['timing_onset'],
      text: "I think it started about a week ago. Maybe a bit longer. I'd need to ask my team to be sure.",
      confirmedText:
        'My accounts payable lead says the earliest held invoice came in about nine days ago.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-nothing-released',
      intents: ['already_tried'],
      cues: ['released', 'release any', 'release them', 'deleted', 'touched', 'tried to release'],
      checking: "Give me a moment, I'll ask my accounts payable lead.",
      text: "She says nobody's touched them. There's been no releasing and no deleting.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-which-setting',
      intents: ['recent_changes', 'account_details'],
      cues: [
        'which setting',
        'what setting',
        'which policy',
        'what policy',
        'which rule',
        'what rule',
        'what caught',
        'what is holding',
      ],
      text: "I couldn't tell you which setting caught them, or what any of the settings do. That's a question for our IT team.",
      whoKnows: 'our IT manager',
    },
    {
      id: 'uf-sender-details',
      intents: ['environment', 'problem_description'],
      cues: [
        'sending address',
        'sender address',
        'sender domain',
        'where are they sent from',
        'what address',
        'which address',
        'what domain',
      ],
      text: "I couldn't tell you what address the invoices are sent from. My team might know, or the suppliers do.",
      whoKnows: 'my accounts payable lead',
    },
    {
      id: 'uf-licence',
      intents: ['account_details'],
      cues: ['licence', 'license', 'which plan', 'what plan', 'subscription', 'tenant'],
      text: "I don't know which plan or licence we have for email protection. IT handles all of that.",
      whoKnows: 'our IT manager',
    },
    {
      id: 'uf-who-can-release',
      intents: ['account_details'],
      cues: ['who can release', 'who is able to release', 'who has permission', 'who can review'],
      text: "I don't know who is allowed to release held messages. I'd assumed IT, but I couldn't swear to it.",
      whoKnows: 'our IT team',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-office-move',
      text: "We're also moving the accounts payable team to another floor next month, so half of them are already surrounded by boxes.",
    },
    {
      id: 'if-auditors',
      text: 'The auditors arrive next month, so this week was always going to be busy.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-same-suppliers',
      importance: 'critical',
      label: 'Only suppliers who changed invoicing system',
      statement:
        'Every held invoice is from a supplier that recently moved to a new invoicing system. Invoices from our other suppliers are still arriving without any trouble.',
      partialStatement: "It isn't all of our invoices. Some are still getting through.",
      revealWhen:
        'Asks whether all suppliers or invoices are affected or only some, what the held invoices have in common, or whether any invoices are still getting through.',
      intents: ['affected_scope', 'reproducibility'],
      partialIntents: ['affected_scope'],
      cues: [
        'all suppliers',
        'every supplier',
        'some suppliers',
        'which suppliers',
        'same suppliers',
        'in common',
        'every invoice',
        'all invoices',
        'still getting through',
        'still arriving',
        'only some',
        'pattern',
      ],
      hint: "It's not every invoice that's gone missing, to be fair.",
      statementTerse:
        'Each held invoice is from a supplier that recently changed invoicing system. The rest still arrive.',
      statementSimple:
        'Each held invoice is from a supplier that changed to a new invoicing system. Invoices from our other suppliers still arrive.',
      missedConsequence:
        'Without the pattern, the call treats this as a general failure, and the engineer cannot narrow where to look or tell Sofia anything specific about which invoices are affected.',
      betterQuestion:
        'Are all of your suppliers affected, or only some, and do the held invoices have anything in common?',
    },
    {
      id: 'hf-protection-tightened',
      importance: 'critical',
      label: 'IT tightened email protection just before',
      statement:
        'Our IT team tightened the email protection settings just before this started. It was after one of my team nearly paid a fake invoice.',
      revealWhen:
        'Asks whether anything changed recently or just before the problem began, including anything IT or an administrator did, or whether something prompted it.',
      intents: ['recent_changes'],
      hint: 'I did hear that IT changed something with email recently.',
      statementTerse:
        'IT tightened the email protection just before it started, after a near miss with a fake invoice.',
      statementSimple:
        'Our IT team made the email protection stricter just before this started. One of my team almost paid a fake invoice.',
      missedConsequence:
        "The most useful lead stays hidden, so the engineer cannot link the held invoices to a change on Proseware's side and may blame the service.",
      betterQuestion:
        'Has anything changed on your side recently, such as a setting your IT team adjusted, just before the invoices were held?',
    },
    {
      id: 'hf-reason-shown',
      importance: 'important',
      label: 'Reason shown against the held messages',
      statement: 'Against each one it says they were held as suspected phishing.',
      revealWhen:
        'Asks what the quarantine list says about why the messages were held, or what reason or wording is shown against them.',
      intents: ['error_message'],
      cues: [
        'what reason',
        'reason given',
        'reason shown',
        'why they were held',
        'why are they held',
        'why they are held',
        'why were they held',
        'says against',
        'say against',
        'quarantine list',
        'what does it say',
        'what does the list say',
      ],
      knowledge: 'after-checking',
      checking: "Hold on, I'll open the list and read what it says.",
      hint: "There's some sort of reason shown next to each one.",
      statementTerse: 'It says suspected phishing against each one.',
      statementSimple: 'The list says each message was held as suspected phishing.',
      missedConsequence:
        "Without the reason shown, the engineer cannot tell what kind of protection held the invoices, and may point Sofia's IT team in the wrong direction.",
      betterQuestion:
        'What does the quarantine list say against these messages, as the reason they were held?',
    },
    {
      id: 'hf-it-manager-away',
      importance: 'important',
      minDifficulty: 'standard',
      requiresImpactAck: true,
      label: 'IT manager on leave, service desk passed it on',
      statement:
        "I rang our IT service desk first. They said only our IT manager can change those settings, and she's on leave until the end of the week. They told me to call you.",
      revealWhen:
        "Asks who at the customer's organisation looks after or can change the settings, whether IT knows about it, or who has already been contacted.",
      intents: ['already_tried', 'previous_contact', 'account_details'],
      cues: [
        'it team',
        'it service desk',
        'service desk',
        'help desk',
        'administrator',
        'admin',
        'who looks after',
        'who manages',
        'who can change',
        'who else have you',
        'spoken to anyone',
        'contacted anyone',
      ],
      statementTerse:
        "I rang IT first. Only our IT manager can change them, and she's on leave until the end of the week.",
      statementSimple:
        'I called our IT help desk first. They said only our IT manager can change these settings. She is away until the end of the week. They told me to call you.',
      missedConsequence:
        'The engineer plans actions that nobody at Proseware can take before the payment run, and Sofia hears yet another suggestion to go back to IT.',
      betterQuestion:
        'Who at Proseware looks after the email protection settings, and have you been able to speak to them yet?',
    },
    {
      id: 'hf-portal-workaround',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Some invoices can be downloaded from supplier portals',
      statement:
        "Where we have a login, my team can download the invoices from the supplier's own portal. It's slow, and with this many suppliers we don't have a login for most of them.",
      byImpact: {
        low: {
          statement:
            "We have a login for that supplier's own portal, so my team can download their invoices from there. It's slow, but it works.",
          statementTerse:
            "We have a login for that supplier's portal. We can download the invoices from there. It's slow.",
          statementSimple:
            "We have a login for that supplier's own website. My team can download the invoices from there. It is slow, but it works.",
        },
        medium: {
          statement:
            "For some of those suppliers we have a login for their own portal, so my team can download the invoices that way. It's slow, and we don't have a login for all of them.",
          statementTerse:
            "We can download some from the suppliers' own portals. It's slow, and we don't have every login.",
          statementSimple:
            'For some of the suppliers, we have a login for their own website. My team can download the invoices that way. It is slow. We do not have every login.',
        },
      },
      revealWhen:
        'Asks whether there is another way to get the invoices in the meantime, or a workaround that protects the payment run.',
      intents: ['workaround'],
      statementTerse:
        "We can download some from the suppliers' own portals. It's slow, and we don't have most of the logins.",
      statementSimple:
        "Where we have a login, my team can download the invoices from the supplier's own website. It is slow. With so many suppliers, we do not have a login for most of them.",
      missedConsequence:
        'A temporary way to cover the most urgent payments goes unexplored, so the payment run stays at risk for as long as the held messages take to be reviewed.',
      betterQuestion:
        "Is there any other way to get the most urgent invoices in the meantime, so the payment run isn't held up?",
    },
    {
      id: 'hf-leave-alone',
      importance: 'helpful',
      minDifficulty: 'challenge',
      availableAfterTurn: 3,
      minTrust: 40,
      label: 'IT asked the team to leave quarantine alone',
      statement:
        "IT asked my team to leave everything in quarantine alone until they've looked at it.",
      revealWhen:
        'Asks why nothing has been released, whether anyone has tried to release or delete the held messages, or what instructions the team was given.',
      intents: ['already_tried'],
      cues: [
        'instructions',
        'told your team',
        'told to leave',
        'told not to',
        'leave them',
        'why nothing',
        'release any',
        'tried to release',
        'released',
        'release them',
        'deleted',
        'touched',
      ],
      statementTerse: "IT said to leave quarantine alone until they've looked.",
      statementSimple:
        'IT told my team not to touch the held messages until they have looked at them.',
      missedConsequence:
        "The engineer may suggest releasing messages without knowing the team was told to leave them, which cuts across Proseware's own instruction and costs trust.",
      betterQuestion:
        'Has anyone tried to release any of the held messages, and were you given any instructions about them?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-service-fault',
      statement: 'I think your filtering has just gone wrong. It never did this before.',
      truth:
        "Nothing is confirmed as a fault. The held invoices share a pattern, and Proseware's IT team recently tightened protection, so the engineer should neither confirm nor rule out a fault on this call.",
    },
  ],

  curveballs: [
    {
      id: 'cb-threaten-to-leave',
      type: 'threaten-cancel',
      trigger: { earliestTurn: 5, latestTurn: 9, whenTemperatureAtLeast: 50 },
      statement:
        "I'll be honest. If real supplier invoices keep getting held like this, I'll recommend to our board that we stop paying for this protection and move to another provider.",
      followUp: 'I mean it. I need to hear what will actually be different.',
      expectedResponse:
        'Take the concern seriously without defending the product or promising an outcome. Acknowledge the business risk, say what you will do first and what you need from Proseware, and give a specific time for the next update. Do not offer discounts or credits.',
      minDifficulty: 'standard',
    },
    {
      id: 'cb-release-guarantee',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 6, latestTurn: 11 },
      statement:
        "Then I need you to guarantee those invoices will be released before the run, and that this can't happen again. Can you promise me that?",
      followUp: 'Yes or no. Can you guarantee it?',
      expectedResponse:
        'Do not promise the release or that it will not recur. Say what you can commit to: the steps you will take, who needs to act at Proseware, and when she will next hear from you.',
      minDifficulty: 'challenge',
    },
  ],
  allowedCurveballs: [
    'threaten-cancel',
    'unsupported-guarantee',
    'ask-manager',
    'challenge-credibility',
  ],

  expectedDiscoveryAreas: [
    'Which suppliers and invoices are held',
    'Whether some invoices still get through',
    'When it started',
    'What changed recently',
    'The reason the list gives for holding them',
    'Who at Proseware can review the settings',
    'How to protect the payment run',
    'What has already been tried',
  ],
  successCriteria: [
    'Introduces themselves and acknowledges the payment run and the pressure on her team before asking questions.',
    'Scopes the problem: which suppliers and invoices are held, since when, and whether others still arrive.',
    "Finds the recent change and the reason shown, without blaming Proseware's IT team or the product.",
    'Finds out who at Proseware can review the held messages and when they are available, and does not send her back to IT.',
    'Is honest about what cannot be promised, and gives a specific next step and a time for the next update.',
    'Stays steady when she threatens to leave: no defensiveness, no discounts, a clear plan.',
  ],
  coachingFocus: ['ownership-next-steps', 'empathy-deescalation', 'scoping-discovery'],
  careExpectations: {
    communicate: [
      'Explains in plain words what is known and not yet known, without a script about how protection works.',
      'Repeats the plan back to Sofia, naming who does what and by when, before the call ends.',
    ],
    accountable: [
      'Says clearly that they will own the case, and names the first action and when she will hear back.',
      'Declines to promise a release or that it will never recur, and says what can be committed to instead.',
    ],
    resourceful: [
      'Asks what the held invoices have in common and what changed, rather than assuming a fault.',
      'Looks for a temporary way to cover the most urgent payments while the held messages are reviewed.',
    ],
    empathetic: [
      'Names the payment run and what is at stake for her suppliers and team, in specific words, before moving to questions.',
      'Stays calm and non-defensive when she threatens to move to another provider.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Telling her to go back to her IT team without taking ownership, which repeats the runaround she has already had.',
    'Promising that the invoices will be released today, or that this will never happen again, without knowing the cause.',
    'Suggesting that protection be relaxed, or every held message be released, without checking they are genuine.',
    'Explaining at length how email protection works before asking about the invoices.',
    'Reacting defensively to the threat to leave, or offering a discount or credit to calm her down.',
  ],
  goodBehaviours: [
    'Acknowledging the payment run and what is at stake for her suppliers early, then saying plainly that they will own the case.',
    'Asking whether every supplier is affected or only some, and what changed on her side just before it started.',
    'Asking what the quarantine list says against the held messages.',
    'Asking who at Proseware looks after the settings and whether they can be reached before the run.',
    'Asking whether the most urgent invoices can reach her team another way in the meantime.',
    'Summarising the plan, with who does what and a specific time for the next update.',
  ],
  expectedOutcome:
    'Sofia understands that nothing has been confirmed as a fault: the held invoices share a pattern, and her IT team recently tightened protection. The engineer owns the case, agrees who at Proseware must review the held messages and a specific time for the next update, and explores a temporary way to protect the payment run, without promising a release or that it will not recur.',
  evaluatorNotes:
    "Root cause (plausible, not confirmed on the call): a few suppliers recently moved to a new invoicing system, so their invoices arrive differently. Just before, Proseware's IT team tightened email protection after a fake invoice was nearly paid, and the quarantine list shows the held invoices as suspected phishing. The IT manager is on leave, so nobody at Proseware has looked at them. A strong call acknowledges the payment run early, scopes by supplier and timing, finds the change and the reason shown, avoids blaming IT, avoids promising a release or that it will not recur, looks for a temporary way to protect the run, agrees who acts and by when, and stays steady when Sofia threatens to move provider.",
} satisfies ScenarioInput;

export default scenario;
