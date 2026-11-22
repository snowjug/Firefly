import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario, set at a follow-up call. Everything here is fictional: people, organisation and
// case. Exchange Online is a real product, so the scenario describes only what the customer sees and
// was told, never how mail delivery works.
//
// Root cause in the story (hidden from the trainee): about two weeks ago the dispatch team at A. Datum
// moved to a new shared dispatch address when the team was renamed, and nobody told the freight
// partner. About a week ago the partner's IT tightened its filtering. Since then every message sent
// from the dispatch address to that one partner bounces, while mail from staff mailboxes to the same
// partner, and mail from the dispatch address to other companies, goes through. Stefan's diagnosis is
// the partner's filter and "nothing changed on our side": he does not count a rename as a change. The
// people who got the bounces deleted them, he saw one for a moment on the first day and kept nothing,
// and his own test from his own mailbox went through, so he has no exact wording to give. The message
// trace he ran only listed the messages as failed, and he did not open each one. The one
// email he had from support asked for the bounce text. He said he had none and nobody answered. Nothing
// on this call proves the cause, and only the partner's own administrators can change what the partner
// accepts, so nobody on the call can promise when it will work. The earlier-email fact exists only on
// a follow-up or an escalated call (stages), and so do the lines that say the mail is still bouncing,
// which a closure call replaces with its own (kf-problem-closure, kf-outcome-closure). The deadline
// fact depends on how many people are affected, so it carries byImpact wordings for low and medium.
//
// Stefan is an expert and demanding. A strong call owns the stalled case and the silence without
// blaming anyone, keeps up with him, finds the single-sender pattern and the address change, works out
// a way to capture a fresh bounce instead of asking again for one he has not got, commits only to their
// own actions and a time for the next update, says honestly what depends on the partner, will not
// guarantee what the partner will do, and offers to help him put precise evidence in front of them.

const scenario = {
  id: 'exchange-partner-email-bounced-follow-up',
  version: 1,
  title: 'Email to a business partner keeps bouncing back',
  shortTitle: 'Partner email bouncing',
  listSummary:
    'An IT operations lead chases a case about email to a business partner that keeps bouncing back.',
  summary:
    'Stefan Aaltonen leads IT operations at A. Datum. Email to a business partner keeps bouncing back, and he wants owners, commitments and times. Own the case, find out what he knows and agree what you can honestly promise.',
  tags: ['bounced email', 'mail delivery', 'follow-up', 'expert customer', 'commitments'],
  estimatedMinutes: 14,

  product: { id: 'exchange-online', area: 'Mail delivery' },
  caseReference: 'SIM-410301',
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
      "Re-read current public pages on non-delivery reports (sent to the sender; the rejecting server's administrators fix it) and on message trace. Terms fit; the cause is the story's own. Stage-limited closure lines and made the bounce-text gap believable. AI-assisted review, not a mentor's.",
  },
  issueType: 'feature-not-working',
  impact: 'high',
  startingTemperature: 'frustrated',
  proficiency: 'expert',
  style: 'demanding',
  callStage: 'follow-up',
  difficulty: 'challenge',

  persona: {
    name: 'Stefan Aaltonen',
    speaker: 'male',
    role: 'IT Operations Lead',
    organisation: 'A. Datum',
    background:
      'Stefan runs IT operations for a manufacturer with two sites and looks after mail, accounts and devices himself. He knows Exchange Online well, keeps careful notes and has already settled on a view of the cause. He has chased this case for days, and a director is waiting for an answer from him.',
    voice:
      'Direct, precise and unhurried. Uses technical terms and expects the engineer to keep up. Asks for names, times and commitments, and notices vague answers. Never rude, but cool and exact. He eases when someone owns the case, is straight about what is not known and gives a time they can keep.',
  },
  environment: {
    details: [
      'A. Datum makes industrial parts at two sites and uses Exchange Online for all staff mailboxes.',
      'Most people read their mail in Outlook on company laptops.',
      'Stefan looks after mail, accounts and devices. There is no separate mail administrator.',
      'The company exchanges mail with many outside business partners every day, including freight and customs partners.',
    ],
  },
  affectedUsers: {
    low: { count: 3, summary: 'Three people on the dispatch desk, with a few documents held up.' },
    medium: {
      count: 8,
      summary:
        "Eight people on the dispatch desk, with this week's shipments waiting on paperwork.",
    },
    high: {
      count: 24,
      summary: 'Twenty-four people across dispatch and customs at both sites, with shipments held.',
    },
  },
  customerObjective:
    'Get mail to the partner delivered again, and leave this call with a named owner, a plan and a time for every next step.',
  customerExpectation:
    'A named engineer who owns the case, has read it, does not make him start again, says plainly what is known and not known, and commits to specific times for the next update.',
  desiredOutcome:
    'Stefan knows who owns the case, what will be checked first and by when, what evidence he still has to get, and what he can tell his director and the partner in the meantime.',
  previousTroubleshooting: [
    "Stefan checked the company's mail setup for anything obvious and found nothing wrong.",
    'Stefan ran a message trace for the failed messages and saw them listed as failed.',
  ],
  recentChanges: [
    'About two weeks ago the dispatch team moved to a new shared address, and the old one was retired.',
  ],

  publicBrief: {
    issue: 'Email to a business partner keeps bouncing back.',
    impact: {
      low: 'A few messages are affected and nothing urgent depends on them.',
      medium: 'Several messages bounce and one team is waiting on the partner.',
      high: 'Time-sensitive business documents cannot reach the partner, and a director wants an answer.',
    },
    objective: 'Own the case, find out what he knows and agree what you can honestly commit to.',
    knownContext:
      'Stefan Aaltonen leads IT operations at A. Datum. He knows email well and wants clear owners, commitments and times.',
    previousContact:
      'Stefan raised a case four days ago. The record shows an automatic acknowledgement and no named owner.',
    environment:
      'A. Datum uses Exchange Online for staff mail, mostly read in Outlook. Many teams exchange mail with outside business partners.',
  },
  brief: {
    situation:
      'An IT operations lead is calling because email to a business partner keeps bouncing back. He knows email well, has a firm view of the cause and wants someone to own the case.',
    goal: 'Find out what he knows without making him start again, take ownership, and agree what you can honestly commit to and when he will hear next.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'The case notes are thin in this practice call, so rely on what he tells you.',
    ],
  },

  openingCore:
    "Email to one of our business partners keeps bouncing back, and it's costing us. I want a named owner and a plan.",
  impactVariants: {
    low: {
      summary:
        'A small number of messages to the partner are bouncing. Nothing is due yet, but I want the cause understood before it grows.',
      detail:
        "It's the three people on the dispatch desk, and a handful of documents are waiting. None of it is due for a while.",
      deadline: "There's no hard deadline, but I want a time for the next update.",
    },
    medium: {
      summary:
        'Messages to the partner keep bouncing, and a whole team is waiting on them. I need this moving this week.',
      detail:
        "It's the eight people on the dispatch desk. The paperwork for this week's shipments can't get to the partner.",
      deadline: 'I need it moving by the end of the week, and a time for each step.',
    },
    high: {
      summary:
        "Our paperwork can't reach the partner, and it's holding up shipments. My director wants an answer today.",
      detail:
        "It's the dispatch and customs teams at both sites, about twenty-four people. Their paperwork to that partner is held up.",
      deadline: 'I need something I can tell my director today, and a time for each next step.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I raised a case four days ago about email to a business partner bouncing back. I still have no named owner and no plan, and I want to know what happens next.',
      brief:
        'Stefan raised a case four days ago about email to a business partner bouncing back. No owner is named and he has had no real update. He expects an owner, a plan and times.',
    },
    escalated: {
      opening:
        'This is my second call about our email to a business partner bouncing back, and nobody owns the case. I need a name, a plan and a time for each step today.',
      brief:
        'Stefan has contacted support twice about the bounced email and nobody has taken the case on. He is cool, exact and short of patience.',
    },
    closure: {
      opening:
        "I'm calling about the bounced email to our business partner, to check we are really finished before the case is closed.",
      brief:
        'Stefan expects to confirm that mail to the partner is going through again and to understand what was found before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Four days ago',
      summary:
        'Stefan raised a case about email to a business partner bouncing back. An automatic acknowledgement was sent.',
    },
    {
      when: 'Three days ago',
      summary: 'The case was queued for review. No engineer was named as owner.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: 'Messages from us to one of our business partners keep coming back as undeliverable. Real work is not arriving.',
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration:
        'The sender gets a bounce back, and as far as I can tell the message never reaches the partner.',
      simple: 'Our messages to one business partner come back as not delivered.',
    },
    {
      id: 'kf-problem-closure',
      text: 'Messages from us to our freight partner were coming back as undeliverable. They seem to be going through now, and I want to be sure we are really finished.',
      intents: ['problem_description'],
      stages: ['closure'],
      simple:
        'Our messages to our freight partner came back as not delivered. They seem to go through now. I want to be sure we are finished.',
    },
    {
      id: 'kf-partner',
      text: "It's our freight partner. We swap documents with them all day, so this isn't a rare route.",
      intents: ['problem_description', 'affected_scope', 'environment'],
      cues: [
        'which partner',
        'which company',
        'who is the partner',
        'which business',
        'who is it',
        'who are they',
        'what kind of partner',
        'about the partner',
      ],
      simple: 'It is our freight partner. We send them documents all day.',
    },
    {
      id: 'kf-environment',
      text: "We're on Exchange Online, and most people use Outlook on company laptops. I look after mail myself, so this one is mine.",
      intents: ['environment', 'account_details'],
      simple:
        'We use Exchange Online. Most people use Outlook on company laptops. I look after mail.',
    },
    {
      id: 'kf-tried',
      text: "I've been through our mail setup and the message trace. Nothing in our setup looks wrong to me.",
      intents: ['already_tried'],
      elaboration:
        "I don't like asking for help before I've looked, so I did the obvious checks first.",
      simple: 'I checked our mail setup and the message trace. I did not find anything wrong.',
    },
    {
      id: 'kf-outcome',
      text: 'I want mail to the partner delivered again, and I want a named person and a time for every next step.',
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple:
        'I want our mail to the partner delivered again. I want a named person and a time for each next step.',
    },
    {
      id: 'kf-outcome-closure',
      text: 'I want to be sure mail to the partner keeps going through, and to know what was found and what to do if it stops.',
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple:
        'I want to be sure our mail to the partner keeps going through. I want to know what was found, and what to do if it stops.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-first-failure',
      intents: ['timing_onset'],
      text: "About a week and a bit ago, I think. I'd have to look at the first trace to be sure.",
      confirmedText: 'The first failure I can find is nine days ago, in the afternoon.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-failed-list',
      intents: ['problem_description', 'affected_scope', 'reproducibility'],
      cues: [
        'list of',
        'log of',
        'which messages',
        'recorded',
        'written down',
        'logged',
        'sample',
        'examples',
      ],
      checking: 'Let me see what the team wrote down.',
      text: "They keep a running list of what came back, with the date and the shipment reference. It's a spreadsheet, and I can send it.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-bounce-text',
      intents: ['error_message'],
      cues: [
        'exact wording',
        'exactly what does',
        'bounce say',
        'bounce message say',
        'what does the message say',
        'what does it say',
        'what did it say',
        'read me',
        'wording',
        'status code',
        'text of the',
      ],
      text: "I can't give you the exact wording. I saw one for a few seconds on the first day and didn't keep it, and the people who got them deleted theirs. The trace only told me they'd failed, and I assumed I could make a new one.",
    },
    {
      id: 'uf-partner-setup',
      intents: ['environment', 'account_details'],
      cues: [
        'their filter',
        'their filtering',
        'their setup',
        'their gateway',
        'their configuration',
        'their mail system',
        'how does the partner',
        'their security',
        'their rules',
      ],
      text: "I can't see how the partner's mail is set up or what their filtering does. Only their administrators can.",
      whoKnows: "the partner's mail administrators",
    },
    {
      id: 'uf-partner-timing',
      intents: ['urgency_deadline', 'expected_outcome'],
      cues: [
        'when will the partner',
        'when will they',
        'will they fix',
        'when can the partner',
        'how long will they',
        'partner fix',
        'partner respond',
        'partner reply',
      ],
      stages: ['first-contact', 'follow-up', 'escalated'],
      text: "I've no idea when the partner will act. I can't speak for them, and nobody there has given me a date.",
      whoKnows: "the partner's IT team",
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-audit',
      text: "We've also got a security audit next month, so everything is being documented twice.",
    },
    {
      id: 'if-laptops',
      text: "We're replacing some older laptops at the second site, which is eating my week.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-one-sender',
      importance: 'critical',
      label: 'Only the shared dispatch address is affected',
      statement:
        "It's only mail sent from our shared dispatch address that bounces. People who write to the same partner from their own mailboxes get through, and the dispatch address is fine to everyone else.",
      partialStatement: "There's a pattern. It isn't every message to them.",
      revealWhen:
        'Asks which senders or mailboxes are affected, or whether every message to the partner fails or only some of them.',
      intents: ['affected_scope', 'reproducibility'],
      partialIntents: ['problem_description'],
      cues: [
        'sender',
        'which mailbox',
        'which address',
        'who is sending',
        'who sends',
        'every message',
        'all messages',
        'only some',
        'in common',
        'pattern',
        'other companies',
        'other people',
      ],
      hint: "It isn't every message to them that comes back.",
      statementTerse:
        "Only mail from the shared dispatch address. People's own mailboxes get through.",
      statementSimple:
        "Only mail from our shared dispatch address comes back. Mail from people's own mailboxes goes to the partner without a problem. The dispatch address works for other companies.",
      missedConsequence:
        'The single-sender pattern stays hidden, so the case is treated as a general failure to reach the partner and the first check is aimed at the wrong place.',
      betterQuestion:
        'Which senders or mailboxes are affected, and is it every message to the partner or only some?',
    },
    {
      id: 'hf-address-change',
      importance: 'critical',
      minDifficulty: 'standard',
      label: 'The dispatch address is new',
      statement:
        "We did change one thing, though I didn't count it. About two weeks ago the dispatch team moved to a new shared address when they were renamed, and the old one was retired. I don't think anyone told the partner.",
      revealWhen:
        "Asks whether anything changed on the company's side recently, including mailboxes, addresses or teams.",
      intents: ['recent_changes'],
      cues: [
        'anything change',
        'what changed',
        'what has changed',
        'any change',
        'anything new',
        'anything different',
        'before it started',
        'before this started',
        'before the first',
        'renamed',
        'new address',
        'new mailbox',
      ],
      statementTerse:
        'We renamed the dispatch team two weeks ago and moved them to a new shared address.',
      statementSimple:
        'About two weeks ago the dispatch team got a new shared address when they were renamed. The old address was closed. I do not think the partner was told.',
      missedConsequence:
        'The one change on his side stays hidden, so the engineer accepts his view that nothing changed and never asks whether the partner knows the new address.',
      betterQuestion:
        'Has anything changed on your side recently, for example a mailbox, an address or a team that was renamed or replaced?',
    },
    {
      id: 'hf-partner-said',
      importance: 'important',
      label: "What the partner's IT has said",
      statement:
        "I rang their IT contact. He said their security team had tightened some filtering last week, and that he'd look into it. He hasn't told me what, if anything, he changed.",
      revealWhen:
        "Asks whether he has spoken to the partner's IT team, or what the partner has said about the bounces.",
      intents: ['already_tried', 'previous_contact'],
      cues: [
        'their it',
        'their helpdesk',
        'spoken to the partner',
        'spoken to anyone at',
        'spoken to their',
        'talked to the partner',
        'contacted the partner',
        'contact the partner',
        'in touch with the partner',
        'partner said',
        'partner say',
        'partner told',
      ],
      hint: 'I did speak to someone at their end.',
      statementTerse:
        'Their IT contact said they tightened some filtering last week. He has not said what he changed.',
      statementSimple:
        'I phoned the IT contact at the partner. He said their security team made their filtering stricter last week. He said he would look into it. He has not told me what he changed.',
      missedConsequence:
        'The only lead from the other side stays hidden, so nobody plans how to take it forward with the partner and Stefan is left chasing them alone.',
      betterQuestion: "Have you spoken to the partner's IT team, and what did they tell you?",
    },
    {
      id: 'hf-earlier-email',
      importance: 'important',
      minDifficulty: 'standard',
      stages: ['follow-up', 'escalated'],
      label: 'The only email he has had',
      statement:
        "I did get one email, the day after I raised it, asking me for the bounce message. I told them I hadn't kept one, and nobody has written back since.",
      revealWhen:
        'Asks what has happened on the case since he raised it, or what he has been told or asked for so far.',
      intents: ['previous_contact'],
      cues: [
        'since you raised',
        'since you called',
        'since the case',
        'what were you told',
        'what have you been told',
        'what did they ask',
        'what happened after',
        'what has happened since',
        'what happened since',
        'heard from us',
        'contacted you',
        'were you asked',
      ],
      statementTerse:
        'One email, asking for the bounce message. I said I had none. Nobody replied.',
      statementSimple:
        'The day after I raised the case, I got one email asking for the bounce message. I said I did not have one. Nobody has written to me since.',
      missedConsequence:
        'The reason the case stalled never comes out, so the engineer asks him again for a bounce he has already said he lacks, and he feels nobody has read the case.',
      betterQuestion:
        'What has happened on the case since you raised it, and what were you asked for or told?',
    },
    {
      id: 'hf-deadline',
      importance: 'important',
      minDifficulty: 'standard',
      requiresImpactAck: true,
      label: 'What depends on the documents',
      statement:
        "A large customer's shipment loads at the port on Friday morning. If the customs documents aren't with the partner by Thursday evening, the container misses its sailing and we pay for it. The urgent ones are going by courier.",
      revealWhen:
        'Asks whether there is a deadline, what depends on the partner receiving the mail, or what happens if it does not get through soon.',
      intents: ['urgency_deadline', 'business_impact'],
      cues: [
        'deadline',
        'how urgent',
        'depends on',
        'by when',
        'when do you need',
        'at stake',
        'cut-off',
        'is due',
        'how soon',
        'consequence',
        'at risk',
        'time pressure',
      ],
      statementTerse:
        'Friday morning a shipment loads at the port. The documents must be with the partner by Thursday evening.',
      statementSimple:
        "A large customer's shipment loads at the port on Friday morning. The partner needs our customs documents by Thursday evening. If not, the container misses its ship. The urgent ones go by courier.",
      byImpact: {
        low: {
          statement:
            "Nothing is due for about a week. The dispatch team are holding back whatever isn't urgent until it's sorted.",
          statementTerse: 'Nothing due for about a week. The team are holding what they can.',
          statementSimple:
            'Nothing is due for about one week. The team is holding back what it can until this is fixed.',
        },
        medium: {
          statement:
            'Two shipments load this week. The customs documents have to be with the partner by Thursday evening, so the urgent ones are going by courier.',
          statementTerse:
            'Two shipments this week. Documents due with the partner by Thursday evening.',
          statementSimple:
            'Two shipments load this week. The partner needs our customs documents by Thursday evening. The urgent ones go by courier.',
        },
      },
      missedConsequence:
        'The real deadline never comes out, so the plan is built around no particular time and the case is not treated as the Friday problem it is.',
      betterQuestion:
        'Is there a deadline, and what depends on the partner receiving these messages?',
    },
    {
      id: 'hf-own-test',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'His own test went through',
      statement:
        "I sent a test to the partner from my own mailbox and it was delivered. So I couldn't make it fail, and I never had a fresh bounce to keep.",
      revealWhen:
        'Asks whether he has tried to reproduce the problem, for example by sending a test message himself.',
      intents: ['reproducibility', 'already_tried'],
      cues: [
        'test message',
        'test email',
        'send a test',
        'sent a test',
        'try sending',
        'tried sending',
        'reproduce',
        'recreate',
        'make it fail',
        'own mailbox',
        'test it',
        'test from',
      ],
      statementTerse: 'My own test went through, so I never got a fresh bounce.',
      statementSimple:
        'I sent a test to the partner from my own mailbox. It was delivered. So I could not make it fail, and I never had a new bounce to keep.',
      missedConsequence:
        'The reason he has no bounce to show is never understood, and nobody works out how a fresh one could be captured from the affected sender.',
      betterQuestion:
        'Have you tried to reproduce it yourself, for example by sending a test message to the partner?',
    },
    {
      id: 'hf-partner-contact',
      importance: 'helpful',
      minDifficulty: 'challenge',
      availableAfterTurn: 3,
      label: 'Who at the partner can act',
      statement:
        "The man I spoke to is on their helpdesk. The person who actually runs their filtering is somebody else, and I don't have a name or a number for them.",
      revealWhen:
        'Asks who at the partner could change what it accepts, or whether he knows the right person to speak to there.',
      intents: ['account_details', 'environment'],
      cues: [
        'who at the partner',
        'contact at the partner',
        'right person at',
        'who runs their',
        'who changes their',
        'responsible at the partner',
        'their administrator',
        'their security team',
        'who can change what',
        'who could change what',
        'who decides what',
        'who controls their',
      ],
      statementTerse:
        "My contact is on their helpdesk. I don't have the name of whoever runs the filtering.",
      statementSimple:
        'My contact is at their helpdesk. The person who runs their filtering is somebody else. I do not have that name or number.',
      missedConsequence:
        'The evidence is aimed at a helpdesk that cannot act on it, so the partner side stays stuck while the engineer waits for an answer.',
      betterQuestion:
        'Who at the partner, such as an administrator, could change what their system accepts, and do you have a way to reach them?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-nothing-changed',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        "Nothing has changed on our side. It's the partner's filter, so I need you to get them to fix it.",
      truth:
        'Two things changed around the same time: the dispatch address is new on his side, and the partner says it tightened its filtering. Nothing shows which one matters.',
    },
    {
      id: 'ia-partner-quick-fix',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        'The partner can switch this off in a minute, so there is no need for a long investigation.',
      truth:
        "In this story the partner's own administrators decide what the partner accepts. Nobody on the call can say when they will act or what they will change.",
    },
  ],

  curveballs: [
    {
      id: 'cb-guarantee',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        'Can you guarantee the partner will accept our mail from now on? I need something definite I can give my director.',
      followUp: 'So is that a yes or a no?',
      expectedResponse:
        'Do not promise what only the partner can deliver. Say what you will do and by when, say plainly what depends on the partner, and offer help with the evidence he can give them and with what he can tell his director today.',
      minDifficulty: 'standard',
      effects: { temperature: 5, patience: -5 },
    },
    {
      id: 'cb-manager',
      type: 'ask-manager',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        'I want someone who can make commitments. Who is your manager, and can I speak to them today?',
      followUp: "I'd like a name, and a way to reach them.",
      expectedResponse:
        'Do not get defensive, and do not suggest that a manager could make the partner act. Say what you can commit to yourself now, explain how to reach a manager if he still wants one, and keep ownership of the case.',
      minDifficulty: 'standard',
      effects: { temperature: 8, trust: -8, patience: -6 },
    },
    {
      id: 'cb-credibility',
      type: 'challenge-credibility',
      trigger: { earliestTurn: 5, latestTurn: 10 },
      statement:
        "Have you handled rejections like this before? I don't want to spend this call explaining mail flow to you.",
      followUp: 'I just need to know this is in capable hands.',
      expectedResponse:
        'Stay calm and factual. Do not claim experience you cannot show. Keep up with his terms, say what you will check and when, and offer to bring in a colleague if he wants one.',
      minDifficulty: 'challenge',
      effects: { temperature: 6, trust: -6 },
    },
  ],
  allowedCurveballs: [
    'unsupported-guarantee',
    'ask-manager',
    'challenge-credibility',
    'previous-bad-experience',
  ],

  expectedDiscoveryAreas: [
    'Which mail is affected',
    'When it started',
    'What changed recently',
    'What the bounce says',
    'What has been tried',
    'What the partner has said',
    'What depends on it',
    'What has happened on the case',
  ],
  successCriteria: [
    'Opens by acknowledging the days without an owner, and takes the case on in plain words without blaming anyone.',
    'Finds out which mail is affected, when it began and what changed recently, without making Stefan start again.',
    'Learns why there is no bounce text and agrees a concrete way to get a fresh one, instead of asking again for one he has not got.',
    'Commits only to what is theirs to do, such as their own checks and the time of the next update, and says plainly what depends on the partner.',
    'Does not promise when the partner will accept the mail, even when pressed for a date.',
    'Summarises the owner, the first step, the time and what Stefan will do before then.',
  ],
  coachingFocus: ['ownership-next-steps', 'clarity', 'empathy-deescalation'],
  careExpectations: {
    communicate: [
      'Keeps up with his technical terms and says plainly what is known and not known, without padding the answer with generic advice.',
      'Confirms the plan in order: what happens first, who does it and when he hears next.',
    ],
    accountable: [
      'Acknowledges the days without an owner and owns the case without blaming an earlier contact, a colleague or the partner.',
      'Promises only what is in their control: their own checks and the time of the next update, never what the partner will do or when.',
    ],
    resourceful: [
      'Finds which mail bounces, who sends it and what changed, and works out how to capture a fresh bounce so the next step is concrete.',
      'Offers to help him put precise evidence in front of the right person at the partner.',
    ],
    empathetic: [
      'Recognises the pressure from his director and the cost of the lost days in specific words, not a stock apology.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Asking him again to send the bounce message when he has already said he has none.',
    "Promising that the partner will accept the mail by a given time, or agreeing that it is certainly the partner's fault.",
    'Blaming the earlier handling, a colleague or the partner instead of owning the case.',
    'Explaining basic mail delivery to an expert, or giving generic advice before asking which mail is affected.',
    'Ending with "we will look into it" and no named person or time.',
  ],
  goodBehaviours: [
    'Apologising specifically for the days without an owner, then taking the case on in plain words.',
    'Asking which senders and mailboxes are affected, when it began and what changed on his side.',
    'Asking what has happened on the case since it was raised, and what the partner has said.',
    'Agreeing a way to get a fresh bounce and what Stefan and the engineer each do before the next update.',
    'Staying honest that the partner decides what it accepts, and offering to help prepare the evidence for them.',
    'Giving a specific time for the next update and summarising the plan before ending.',
  ],
  expectedOutcome:
    'Stefan knows who owns the case and has had a specific apology for the silence. The engineer has the sender pattern, the address change and the reason there is no bounce text, and has agreed a way to get a fresh one, what each of them does first and when he will hear next. No promise has been made about what the partner will do.',
  evaluatorNotes:
    'Root cause in the story: about two weeks ago the dispatch team moved to a new shared address and nobody told the freight partner, and about a week ago the partner tightened its filtering. Since then everything sent from the dispatch address to that partner bounces, while mail from staff mailboxes to the partner goes through. Stefan blames the partner and says nothing changed on his side. He has no bounce text (the trace he ran only listed the messages as failed), and the one email he had from support asked for it. Nothing proves the cause, and only the partner can change what it accepts. A strong call owns the stalled case, finds the pattern, the address change and the reason there is no bounce, commits only to its own actions and the next update, and will not guarantee the partner.',
} satisfies ScenarioInput;

export default scenario;
