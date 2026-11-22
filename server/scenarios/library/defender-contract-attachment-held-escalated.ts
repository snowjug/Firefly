import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario, set at an escalated call. Everything here is fictional: people, organisation
// and case. Defender for Office 365 is a real product, so the scenario describes only what the
// customer sees and was told, never how it works.
//
// Root cause in the story (hidden from the trainee; plausible, never confirmed on the call): the
// supplier's lawyers send final contracts as password-protected files, with the password in a second
// message, and the final signed renewal from Trey Research arrived that way. The earlier drafts came
// as ordinary files and were delivered. The final copy is held. Graham's own security administrator,
// Ayo, can release it, but will not until the supplier's lawyer has confirmed the file with him by
// phone, and nobody has told him that the contract has to be countersigned by five today, when the
// renewal terms lapse and the claims data feed stops at midnight. The first earlier contact told the
// IT service desk that attachment checks can take a while and to wait. On the second, an engineer
// promised Graham a call by three yesterday with what the checks showed, and none came. He believes
// it is Microsoft's filter, that Microsoft can release it, and that it is a false positive. In the
// story his own administrator, not Microsoft support, decides whether the message is released, and
// nothing confirms that the file is safe or unsafe. The supplier's account manager, Corinne, has said
// that she can send the contract again as a link from the supplier's own signing site if asked
// before four, and Graham has not asked her.
//
// Graham is angry, exact and expert. A strong call owns the history in its own name without blaming a
// colleague, takes ownership, asks what kind of file it is and what is different from earlier
// messages, finds who can release it and what that person is waiting for, promises no release, finds
// the other route and what depends on today, stays calm through the demand for a guarantee, the
// threat to leave and the request for a manager, and agrees actions with times, including its own
// next call.

const scenario = {
  id: 'defender-contract-attachment-held-escalated',
  version: 1,
  title: 'Supplier contract attachment held back',
  shortTitle: 'Contract attachment held back',
  listSummary:
    "A procurement head's supplier contract is held back, and a promised call back never came.",
  summary:
    "Graham Whitlock heads procurement at Humongous Insurance. A supplier's contract attachment is being held back, he needs to sign it, and a call back promised earlier never came. He is angry, exact and expects ownership. Own the history, be honest about what you can and cannot do, and agree actions with times.",
  tags: [
    'quarantine',
    'attachment',
    'escalated',
    'ownership',
    'broken promise',
    'expert customer',
    'threat to leave',
  ],
  estimatedMinutes: 15,

  product: { id: 'defender-office-365', area: 'Safe Attachments' },
  caseReference: 'SIM-410404',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-learn'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read the current Learn pages on Safe Attachments (password-protected attachments held in quarantine, who can release, scan times) and quarantine policies; the story matches. The administrator's wait for the lawyer's phone call is the story's own. AI-assisted review, not a mentor's.",
  },
  issueType: 'policy-security',
  impact: 'high',
  startingTemperature: 'angry',
  proficiency: 'expert',
  style: 'demanding',
  callStage: 'escalated',
  difficulty: 'challenge',

  persona: {
    name: 'Graham Whitlock',
    speaker: 'male',
    role: 'Head of Procurement',
    organisation: 'Humongous Insurance',
    background:
      'Graham runs procurement for a large insurer and signs off its supplier contracts and software renewals. Years of supplier risk reviews have taught him the names of the email protection tools and what the security team says about them, but he has never touched their settings. He has been passed between teams twice already and does not intend to be passed on again.',
    voice:
      'Exact and cold, in short sentences. Uses the technical names and expects the engineer to keep up. Asks for names, times and commitments and challenges anything vague. Never abusive, but does not hide that he is angry. Eases a little when someone owns the history and says plainly what they will do.',
  },
  environment: {
    details: [
      'Humongous Insurance uses Defender for Office 365 for email protection, and a security administrator looks after its settings.',
      'Graham signs off supplier contracts, and the claims team depends on a data service from one of those suppliers.',
      'Supplier contracts normally arrive by email, as documents for signature.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Graham, who needs the one contract.' },
    medium: {
      count: 5,
      summary: 'The five-person procurement team, who need the signed contract.',
    },
    high: {
      count: 40,
      summary: 'About forty claims handlers who rely on the supplier data service.',
    },
  },
  customerObjective:
    "Get the supplier's signed contract into his hands, and know who is dealing with it until it is done.",
  customerExpectation:
    'Someone who has read the case, takes ownership in their own name, tells him plainly what can and cannot be done, and commits to specific actions with times, including when he will hear back.',
  desiredOutcome:
    'Graham has a named owner, understands what is holding the message and who on his own side can release it, and knows what happens first, by when, and when he will hear back, with no promise that the message will be released. He has a way to keep the deadline safe in the meantime.',
  previousTroubleshooting: [
    'Graham checked his inbox and junk folder for the contract, and found only a separate message with the password.',
    'His IT service desk raised a case with Microsoft on the first day.',
    'He asked the supplier to confirm that the contract had been sent, and they did.',
  ],
  recentChanges: [
    "The supplier's lawyers sent the final contract as a password-protected file, where the earlier drafts came as ordinary files.",
    "Nothing changed on Graham's side that he knows of.",
  ],

  publicBrief: {
    issue: "A supplier's contract attachment is being held back, and Graham needs to sign it.",
    impact: {
      low: 'One contract is held up, but signing can wait a few days.',
      medium: 'A contract is held up, and the team needs it signed today.',
      high: 'A contract is held up, and an important service depends on it.',
    },
    objective:
      'Take ownership, be honest about what you can and cannot do, and agree actions with times.',
    knownContext:
      'Graham heads procurement at an insurer. He knows the protection tools by name and expects a named owner.',
    previousContact:
      'Two earlier contacts are logged. After the second, a call back was promised and was not made.',
    environment:
      'Humongous Insurance uses Defender for Office 365 for email protection. You cannot see its settings in this call, so rely on what Graham says.',
  },
  brief: {
    situation:
      'A head of procurement is calling for the third time because a contract from a supplier is being held back and needs to be signed. A call back was promised after his second contact and never came.',
    goal: 'Own the history, find out what is holding the message and who can act, avoid promises you cannot keep, and agree actions with times and a time for your next call.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'You cannot see his email settings in this practice call, so rely on what he tells you.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'Do not promise a release or a time you cannot guarantee.',
    ],
  },

  openingCore:
    "A contract from one of our suppliers is being held back, and I can't get at the attachment.",
  impactVariants: {
    low: {
      summary:
        "It's one contract, and signing can wait a few days, but this has been handled badly.",
      detail:
        "It's just the one contract, and I'm the only one waiting on it. The supplier has said the end of the week is fine, but I still want a straight answer.",
      deadline: 'The end of the week is fine for the supplier.',
    },
    medium: {
      summary: "It's a contract my team needs signed today, and it still hasn't reached me.",
      detail:
        "Five of us in procurement depend on it, and the supplier has asked for the signed copy today. The next step can't start until we have it.",
      deadline: 'The supplier needs the signed copy today.',
    },
    high: {
      summary:
        'A signed contract from a supplier is held back, and it has to be countersigned today.',
      detail:
        "It's the renewal for a service the claims team uses, and about forty people depend on it. The supplier needs it countersigned today, and I've been chasing since yesterday.",
      deadline: 'It has to be countersigned today.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case about the contract that's being held back. I was told someone would ring me, and nobody has.",
      brief:
        'Graham opened a case about a held contract attachment and was promised a call back. It has not come, and he still needs the contract signed.',
    },
    escalated: {
      opening:
        "This is the third time I've contacted you about this held contract. You promised me a call back yesterday and nobody rang. I need an owner and a time, now.",
      brief:
        'Graham has contacted support twice. A call back was promised after the second contact and was never made. He needs the contract signed, and his trust is low.',
    },
    closure: {
      opening:
        "I'm calling about the case on the held contract. I have the signed copy now, and I'd like to understand what happened before this is closed.",
      brief:
        'This is a closure call. Graham has the contract and wants to understand what held it back, and what happens next time, before the case closes.',
    },
  },
  priorHistory: [
    {
      when: 'Two days ago',
      summary:
        "Graham's IT service desk raised a case after a supplier's contract was held back. The first engineer said that attachment checks can take a while and asked them to wait.",
    },
    {
      when: 'Yesterday',
      summary:
        'Graham called. A second engineer said the message was being looked at, and promised a call back by the afternoon with an update.',
    },
    {
      when: 'Since then',
      summary: 'No call back was made. Graham has phoned again.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: "A contract from one of our suppliers hasn't reached me. The email is held back, and I can't get at the attachment.",
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration: "It's the final signed copy, and I need it in my hands.",
      simple:
        'A contract from one of our suppliers has not reached me. The email is held back, and I cannot get the attachment.',
    },
    {
      id: 'kf-problem-closure',
      text: "A contract from one of our suppliers was held back. I have the signed copy now, and I'd like to know exactly what held it, and what happens next time.",
      intents: ['problem_description'],
      stages: ['closure'],
      simple:
        'A contract from one of our suppliers was held back. I have the signed copy now. I would like to know exactly what held it, and what happens next time.',
    },
    {
      id: 'kf-supplier',
      text: "It's the renewal from Trey Research, who supply our claims data. It's the final signed copy.",
      intents: ['problem_description', 'environment'],
      cues: [
        'which supplier',
        'who is it from',
        'what is it',
        'which contract',
        'what contract',
        'what is the message',
        'who sent',
      ],
      simple:
        'It is the renewal from Trey Research, who supply our claims data. It is the final signed copy.',
    },
    {
      id: 'kf-outcome',
      text: "I want the signed contract in my hands today, and I want to know who's dealing with this.",
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple:
        'I want the signed contract in my hands today. I want to know who is dealing with this.',
    },
    {
      id: 'kf-outcome-closure',
      text: "I want to know what held it back, and what's going to be different next time.",
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple: 'I want to know what held it back. I want to know what will be different next time.',
    },
    {
      id: 'kf-mail-app',
      text: 'I use Outlook on my laptop.',
      intents: ['environment'],
      cues: [
        'outlook',
        'which app',
        'which email',
        'what email',
        'email program',
        'email app',
        'mail app',
        'desktop',
      ],
      simple: 'I use Outlook on my laptop.',
    },
    {
      id: 'kf-held-by',
      text: "Our security people say the attachment scanning is what's holding it, Safe Attachments, and that it's in quarantine.",
      intents: ['problem_description', 'error_message'],
      cues: [
        'what is holding',
        'what is blocking',
        'which feature',
        'which protection',
        'what protection',
        'what is stopping',
        'what has held',
      ],
      simple:
        'Our security people say the attachment scanning is holding it, Safe Attachments, and that it is in quarantine.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-when-sent',
      intents: ['timing_onset'],
      cues: [
        'when did',
        'when was it sent',
        'when did it arrive',
        'when did it come',
        'how long',
        'since when',
      ],
      text: "It was sent on Wednesday, I think. Wednesday morning? I'd have to check.",
      confirmedText: "Wednesday, just after nine, according to the supplier's sent copy.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-reason-shown',
      intents: ['error_message', 'account_details'],
      cues: [
        'quarantine reason',
        'what reason',
        'reason given',
        'why is it held',
        'why was it held',
        'what does the entry',
        'what does the quarantine',
        'policy name',
      ],
      text: "I haven't seen the quarantine entry myself. As far as I know, only our security administrator can see it.",
      whoKnows: 'our security administrator',
    },
    {
      id: 'uf-settings',
      intents: ['account_details', 'environment'],
      cues: [
        'how is it set up',
        'how are your',
        'which policy',
        'what policy',
        'which setting',
        'what setting',
        'configured',
        'switched on',
        'turned on',
      ],
      text: "I couldn't tell you how our protection is set up. That's the security side, not mine.",
      whoKnows: 'our security administrator',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-audit',
      text: "We've got a supplier audit next month, so every contract has to be filed properly.",
    },
    {
      id: 'if-week',
      text: "I've spent more of this week on the phone to suppliers than I'd like.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-locked-file',
      importance: 'critical',
      label: 'The contract is a password-protected file',
      statement:
        'The contract is a locked file. Their lawyers always send them with a password, and the password came in a separate message, which did arrive.',
      revealWhen:
        'Asks what kind of file the attachment is, whether it is protected in any way, or what is different about this message.',
      intents: ['problem_description', 'reproducibility'],
      cues: [
        'kind of file',
        'type of file',
        'file type',
        'what kind of attachment',
        'what type of attachment',
        'format',
        'protected',
        'locked',
        'password',
        'encrypted',
        'unusual',
      ],
      hint: "There's something about the file itself, but I'm not the one to explain it.",
      statementTerse: "It's a locked file. The password came separately, and that message arrived.",
      statementSimple:
        'The contract is a locked file. The lawyers send it with a password. The password came in another message, and that message did arrive.',
      missedConsequence:
        'The engineer never finds the one fact that may explain why this message is held, so the case goes round again and his administrator has nothing to go on.',
      betterQuestion:
        'What kind of file is the attachment, and is it protected or locked in any way?',
    },
    {
      id: 'hf-earlier-fine',
      importance: 'important',
      label: 'Earlier drafts from the same sender arrived normally',
      statement:
        "The earlier drafts of this contract arrived without any trouble, as ordinary files. It's only the signed one, the last version, that's held.",
      revealWhen:
        'Asks whether earlier messages from the same sender were delivered, or what is different about this one.',
      intents: ['timing_onset', 'reproducibility'],
      cues: [
        'earlier drafts',
        'earlier messages',
        'earlier emails',
        'previous messages',
        'previous drafts',
        'same sender',
        'from the same',
        'anything else from',
        'other messages from',
        'other emails from',
        'what is different',
        'happened before',
      ],
      statementTerse: 'Earlier drafts arrived fine. Only the last, signed version is held.',
      statementSimple:
        'The earlier drafts arrived without any trouble, as ordinary files. Only the signed one, the last version, is held.',
      missedConsequence:
        "The engineer misses what sets this message apart from the ones that arrived, so the engineer treats it as a general fault with the sender's email.",
      betterQuestion:
        'Did earlier messages from the same sender reach you, and what is different about this one?',
    },
    {
      id: 'hf-who-releases',
      importance: 'critical',
      minTrust: 12,
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'His security administrator is waiting to confirm the sender',
      statement:
        "Our security administrator, Ayo, is the one who can release it. He won't until the supplier's lawyer has confirmed the file with him by phone, and he hasn't been told about today's deadline.",
      revealWhen:
        'Asks who on his own side can release the message, who has looked at it so far, or what the administrator is waiting for.',
      intents: ['account_details', 'already_tried'],
      cues: [
        'who can release',
        'who is able to release',
        'who has looked',
        'administrator',
        'security team',
        'security administrator',
        'your it',
        'who is looking',
        'who at your',
        'what is he waiting',
        'what are they waiting',
        'release it yourself',
      ],
      statementTerse:
        "Ayo, our security administrator, can release it. He's waiting for the lawyer to confirm the file. He doesn't know the deadline.",
      statementSimple:
        'Our security administrator, Ayo, can release it. He will not until the supplier lawyer has confirmed the file with him by phone. He has not been told about the deadline today.',
      missedConsequence:
        'The engineer never learns who can act or what holds that person up, so the plan rests on Microsoft releasing the message, when the decision sits with his own administrator, and nobody tells Ayo about the deadline.',
      betterQuestion: 'Who can release the message on your side, and what are they waiting for?',
    },
    {
      id: 'hf-callback-promise',
      importance: 'important',
      stages: ['follow-up', 'escalated', 'closure'],
      label: 'What was promised on the second contact',
      statement:
        "The second engineer said she'd ring me by three yesterday with what the checks showed. Nobody rang. I sat at my desk until six.",
      revealWhen:
        'Asks what he was promised on the earlier contacts, what happened after the second contact, or what he has been told so far.',
      intents: ['previous_contact'],
      cues: [
        'promised',
        'what were you told',
        'what did they say',
        'earlier contact',
        'previous contact',
        'second contact',
        'first contact',
        'who did you speak',
        'did anyone call',
        'did anybody call',
        'did anyone ring',
        'did anybody ring',
      ],
      statementTerse: 'A call back by three yesterday. Nobody rang. I waited until six.',
      statementSimple:
        'The second engineer said she would call me by three yesterday with what the checks showed. Nobody called. I sat at my desk until six.',
      missedConsequence:
        'The engineer never learns exactly what was promised and missed, so any apology is vague and fails to rebuild trust.',
      betterQuestion:
        'What were you told on the earlier contacts, and what was promised that did not happen?',
    },
    {
      id: 'hf-consequence',
      importance: 'important',
      minDifficulty: 'standard',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'What lapses if it is not signed today',
      statement:
        "If the countersigned copy isn't back by five, their renewal terms lapse. Their claims data feed stops at midnight, and about forty claims handlers lose their reference data.",
      byImpact: {
        low: {
          statement:
            "Nothing lapses today. The supplier would like it by the end of the week, but they've said they can wait.",
          statementTerse: 'Nothing lapses today. The supplier can wait until the end of the week.',
          statementSimple:
            'Nothing lapses today. The supplier would like it by the end of the week. They said they can wait.',
        },
        medium: {
          statement:
            "If it isn't back by five, the supplier's renewal price lapses, and my team of five would have to start the renewal again.",
          statementTerse: 'Not back by five, the price lapses. My team starts again.',
          statementSimple:
            'If it is not back by five, the supplier renewal price lapses. My team of five would have to start the renewal again.',
        },
      },
      revealWhen: 'Asks what happens if the contract is not signed today, or what depends on it.',
      intents: ['business_impact', 'urgency_deadline'],
      cues: [
        'what happens if',
        'what depends',
        'what is riding',
        'consequence',
        'what is at stake',
        'what lapses',
        'what is the risk',
        'what are the risks',
        'who depends',
      ],
      statementTerse: 'Not back by five, their terms lapse. The claims feed stops at midnight.',
      statementSimple:
        'If the countersigned copy is not back by five, their renewal terms lapse. Their claims data feed stops at midnight. About forty claims handlers lose their reference data.',
      missedConsequence:
        'The engineer never learns the real stakes, so the engineer cannot judge what to protect first or what to say to his director.',
      betterQuestion:
        'What is at stake if the contract is not signed today, and who depends on it?',
    },
    {
      id: 'hf-supplier-alternative',
      importance: 'important',
      minDifficulty: 'standard',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'The supplier can send it another way before four',
      statement:
        "Their account manager, Corinne, said she can send the contract again through the supplier's own signing site, as a link, if I ask before four. I haven't asked her yet. I wanted the original for our records.",
      revealWhen:
        'Asks whether there is another way to get the contract today, or whether the supplier could send it differently.',
      intents: ['workaround', 'urgency_deadline'],
      cues: [
        'another way',
        'other way',
        'alternative',
        'resend',
        'send it again',
        'send it differently',
        'different way',
        'ask the supplier',
        'could the supplier',
        'contact the supplier',
        'in the meantime',
        'work around',
      ],
      statementTerse:
        "Corinne, their account manager, can send a link before four. I haven't asked.",
      statementSimple:
        'Their account manager, Corinne, said she can send the contract again as a link, from their own signing site. I must ask before four. I have not asked her yet. I wanted the original for our records.',
      missedConsequence:
        'The engineer never explores the one route that could still get the contract signed today, so everything rests on a release that nobody can promise.',
      betterQuestion:
        'Is there another way to get the contract today, such as asking the supplier to send it differently?',
    },
    {
      id: 'hf-licence-renewal',
      importance: 'helpful',
      minDifficulty: 'challenge',
      minTrust: 15,
      label: 'He signs off this protection licence next quarter',
      statement:
        "I sign off the renewal of this protection licence next quarter. My CIO has already asked me why we're paying for it.",
      revealWhen:
        'Asks what his role is in decisions about the protection, or what he will take back to his own leadership.',
      intents: ['business_impact', 'expected_outcome'],
      cues: [
        'what will you tell',
        'take back',
        'your director',
        'your leadership',
        'your cio',
        'your board',
        'who are you reporting',
        'what do you need to tell',
        'licence renewal',
        'who signs off',
      ],
      statementTerse: 'I sign off this licence renewal next quarter. My CIO is asking why we pay.',
      statementSimple:
        'I sign off the renewal of this protection licence next quarter. My CIO has already asked me why we are paying for it.',
      missedConsequence:
        'The engineer never learns what he has to take back to his own leadership, so the plan lacks a message he can use and the threat to leave is misread.',
      betterQuestion: 'What will you need to tell your director about this, and by when?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-only-microsoft',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        "It's your filter, so you can release it. I don't see why my own people have to be involved.",
      truth:
        'In this story his own security administrator, not Microsoft support, decides whether the message is released, after checking that the file is what it should be. Nothing here shows that Microsoft support could release it.',
    },
    {
      id: 'ia-false-positive',
      statement:
        "It's a false positive. A contract from a supplier we've used for years can't be malicious.",
      truth:
        'Nothing confirms that the file is safe or unsafe. In this story it is a password-protected file that could not be checked, and the sender has not yet been confirmed to his administrator.',
    },
  ],

  curveballs: [
    {
      id: 'cb-threaten-leave',
      type: 'threaten-cancel',
      trigger: { earliestTurn: 4, latestTurn: 9, whenTemperatureAtLeast: 50 },
      statement:
        "I'll be straight with you. If this isn't handled properly, I'll recommend to our board that we look at another provider. I mean that.",
      followUp: 'I mean it. I need to hear what will actually be different.',
      expectedResponse:
        'Take it seriously without defending the product or offering anything you cannot authorise. Own the next step, say who has to act and by when, and give a specific time for your next call.',
      minDifficulty: 'standard',
      effects: { temperature: 8, trust: -8, patience: -6 },
    },
    {
      id: 'cb-guarantee-today',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 10 },
      statement:
        "Then guarantee me this will be dealt with, and that it won't happen to us again. I want that commitment now.",
      followUp: 'A yes or a no. Can you guarantee it?',
      expectedResponse:
        'Do not promise a release, a time or an outcome that depends on his administrator or the supplier. Say what you can commit to, such as the actions you will take, who has to act and when you will next call him.',
      minDifficulty: 'challenge',
      effects: { temperature: 6, patience: -6 },
    },
    {
      id: 'cb-your-manager',
      type: 'ask-manager',
      trigger: { earliestTurn: 6, latestTurn: 11, whenOwnershipUnclear: true },
      statement:
        'I want to speak to your manager. Not a promise of a call back. Your manager, now.',
      followUp: 'Who is your manager, and how do I reach them?',
      expectedResponse:
        'Do not get defensive. Say what you can do now, and offer to bring in a manager alongside you, with a name and a time if you can. Keep the work moving while you do.',
      minDifficulty: 'challenge',
      effects: { temperature: 8, trust: -8, patience: -6 },
    },
  ],
  allowedCurveballs: [
    'threaten-cancel',
    'unsupported-guarantee',
    'ask-manager',
    'challenge-credibility',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'What the earlier contacts promised',
    'What kind of file the attachment is',
    'What is different from earlier messages',
    'Who on his side can release it',
    'What depends on the contract today',
    'How to protect the deadline',
    'What he will tell his leadership',
  ],
  successCriteria: [
    'Opens by acknowledging the two earlier contacts and the call back that never came, in their own name and without blaming anyone.',
    'Takes ownership in the first minutes and says what they will do first and by when.',
    'Asks specific questions that show they have read the case, and finds what kind of file it is and what is different from earlier messages.',
    'Finds who on his own side can release it and what that person is waiting for, and does not promise a release.',
    'Handles the demand for a guarantee, the threat to leave and the request for a manager calmly, with honest commitments.',
    'Agrees who does what by when, including a time for their own next call, and summarises before ending.',
  ],
  coachingFocus: ['ownership-next-steps', 'empathy-deescalation', 'scoping-discovery'],
  careExpectations: {
    communicate: [
      'Speaks plainly and precisely, uses his vocabulary correctly without lecturing, and says what is known and what is not.',
      'Summarises who does what and when in two or three sentences that he can pass to his director.',
    ],
    accountable: [
      'Takes ownership of the history in their own name, including the missed call back, without defending or blaming a colleague.',
      'Commits only to actions they control, gives a time for their own next call, and keeps it.',
    ],
    resourceful: [
      'Finds what kind of file it is, what is different from earlier messages and who can release it, rather than repeating the advice already given.',
      'Looks for a way to protect the deadline without asking anyone to bypass their own checks.',
    ],
    empathetic: [
      'Acknowledges specifically that this is his third contact and that a promised call did not come, before asking anything.',
      'Stays composed and respectful when he is cold, threatens to leave or asks for a manager.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Asking him to explain the whole history again, as if the case notes did not exist.',
    'Blaming the colleague who made the earlier promise, or defending how the earlier contacts went.',
    'Promising that the message will be released, or that the contract will arrive by a time that depends on someone else.',
    'Suggesting that his administrator release the message without confirming the sender, or asking Graham to read out the password, to save time.',
    'Saying "I understand" or apologising repeatedly without naming an owner, an action and a time.',
    'Offering a discount, a credit or a promise about licensing to calm him down.',
  ],
  goodBehaviours: [
    'Opening by acknowledging both earlier contacts and the missed call back, and taking ownership in their own name.',
    'Asking what kind of file the attachment is and how this message differs from earlier ones.',
    'Finding who can release the message and what that person is waiting for, and offering to speak to them.',
    'Asking what depends on the contract today and whether it can reach him another way.',
    'Staying calm when he asks for a guarantee, threatens to cancel or asks for a manager.',
    'Agreeing actions with names and times, including their own next call, and keeping to it.',
  ],
  expectedOutcome:
    'Graham feels that the history has been owned and not defended. He and the engineer have agreed what happens first, who acts and by when, including his security administrator and a way to keep the deadline safe, with no promise that the message will be released. The engineer has given a time for their own next call.',
  evaluatorNotes:
    "Root cause in the story (plausible, not confirmed on the call): the supplier's lawyers sent the final contract as a password-protected file, where the earlier drafts were ordinary files, and it is held. Graham's own security administrator can release it but is waiting for the lawyer to confirm the file, and has not been told the deadline. A call back promised yesterday was never made. Graham believes it is a false positive that Microsoft can release. A strong call owns the history without blaming a colleague, finds the file, the earlier messages and who can act, promises no release, finds the other route, stays calm through the guarantee, the threat to leave and the request for a manager, and agrees actions with times.",
} satisfies ScenarioInput;

export default scenario;
