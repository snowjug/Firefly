import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario, set at an escalated call. Everything here is fictional: people, organisation
// and case. Word is a real product, so the scenario describes only what the customer sees and was
// told, never how Word saves or merges a document.
//
// Root cause in the story (hidden from the trainee; plausible, and never confirmed on the call):
// the annual filing is one document in the legal team's shared folder, and copies of it came from
// two routes. When Word could not save Rosalind's changes it offered to keep them as a copy, she
// took that and carried on editing the copy for a day. Pieter edits on trains and in court waiting
// rooms with no signal, and when he is back online a second file with something like his laptop's
// name on the end appears (public pages document that for non-Office files, so for Word it stays
// the customer's own observation). Their changes sit in those copies, nobody has looked at earlier
// versions of the file, and Desmond believes Word is simply losing people's changes. The first
// earlier contact told him to open the file from one place; the second asked for a list of the
// copies and promised a call back that never came. The earlier-advice fact exists only after a
// first contact (stages follow-up, escalated, closure). The facts that depend on how many people
// edit (who edits, the sign-off time) carry byImpact wordings for low (two people) and medium
// (four), matching affectedUsers and impactVariants.detail; Rosalind and Pieter edit at every level.
//
// Desmond is frustrated and demanding, and precise in the way of someone from a legal background.
// A strong call acknowledges the third contact and the missed call back without defending anyone,
// takes ownership, asks what people saw and how each person edits instead of repeating the advice
// to use one folder, finds what seems to be missing without promising to recover it, learns the
// sign-off time, and agrees what to gather, who does what by when and a time for the next update.

const scenario = {
  id: 'word-document-duplicate-copies-escalated',
  version: 1,
  title: 'Shared Word document creates copies and edits go missing',
  shortTitle: 'Document copies and missing edits',
  listSummary:
    'A legal operations manager says a shared Word document keeps producing copies and edits have gone missing.',
  summary:
    "Desmond Achterberg runs legal operations at Lucerne Publishing. A Word document that several colleagues edit keeps producing copies, and some people's changes seem to have gone missing, with a filing deadline ahead. This is his third contact. Take ownership, find out what he knows and agree a plan with times.",
  tags: ['word', 'copies', 'missing edits', 'escalated', 'ownership', 'deadline'],
  estimatedMinutes: 14,

  product: { id: 'm365-apps', area: 'Word' },
  caseReference: 'SIM-410501',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-support', 'microsoft-learn'],
    behaviourCheck: 'checked-partly',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read the current Support page on common co-authoring errors (error bar, Save a Copy) and the Learn page on OneDrive sync conflicts. Device-name copies are documented for non-Office files, so the second route is unconfirmed for Word. Causes are the story's own. AI-assisted review, not a mentor's.",
  },
  issueType: 'data-missing',
  impact: 'high',
  startingTemperature: 'frustrated',
  proficiency: 'intermediate',
  style: 'demanding',
  callStage: 'escalated',
  difficulty: 'challenge',

  persona: {
    name: 'Desmond Achterberg',
    speaker: 'male',
    role: 'Legal Operations Manager',
    organisation: 'Lucerne Publishing',
    background:
      'Desmond runs legal operations for a mid-sized publisher: contracts, rights schedules and the annual filing. He is careful and organised, and used to tracked changes and exact dates from his years in practice. He uses Word every day but is not an IT person, and he has now spent two calls being given advice that did not hold.',
    voice:
      'Precise, measured and a little formal; asks for exact wording, names and dates. Never shouts, but turns cold and short when he feels managed. Repeats back what he is told so he can hold people to it. Eases when someone owns the case and commits to specific times.',
  },
  environment: {
    details: [
      'Lucerne Publishing keeps its contracts, rights schedules and filings in shared team folders, and staff open them in Word on company laptops.',
      'The annual filing is one long Word document that the legal team drafts and reviews over about three weeks.',
      'Legal operations has no IT staff of its own. An outside IT provider looks after the shared folders and accounts.',
      'An outside lawyer also reviews and edits the filing, and the finance and compliance teams contribute sections.',
    ],
  },
  affectedUsers: {
    low: { count: 2, summary: 'Two paralegals who edit the document, while Desmond reviews it.' },
    medium: { count: 4, summary: 'Four people across legal and finance who edit the document.' },
    high: {
      count: 7,
      summary: 'Seven people across legal, finance, compliance and outside counsel.',
    },
  },
  customerObjective:
    'Have one copy that everyone agrees is the master, find every change that seems to be missing and get them back in before the filing.',
  customerExpectation:
    'Someone who has read the case, owns it in their own name, says plainly what is known and not known, and commits to times he can hold them to.',
  desiredOutcome:
    'Desmond has a named owner, understands that the missing changes may sit in separate copies rather than be lost, knows what to gather and by when, and has a time for the next update that fits his own deadline.',
  previousTroubleshooting: [
    'Desmond asked everyone to open the document only from the team folder and to stop making their own copies.',
    'He started a list of the copies he could find, with their dates.',
  ],
  recentChanges: [
    'More people joined the drafting when the filing work started about three weeks ago.',
  ],

  publicBrief: {
    issue:
      "A shared Word document keeps producing copies, and some people's edits seem to have gone missing.",
    impact: {
      low: 'People are unsure which copy is current, but the filing is weeks away.',
      medium: 'The drafting team is unsure which copy is right, and the filing is due next week.',
      high: 'Nobody can say which copy is right, and the filing is due on Friday.',
    },
    objective: 'Take ownership, find out what he knows and agree a plan with times.',
    knownContext:
      'Desmond Achterberg runs legal operations at Lucerne Publishing. Several colleagues edit one Word document, and copies of it have started to appear.',
    previousContact:
      'Two earlier contacts gave advice. The copies kept appearing, and the case history names no owner.',
    environment:
      'Lucerne Publishing keeps its legal documents in shared team folders and uses Word every day. You cannot see the files in this practice call.',
  },
  brief: {
    situation:
      'A legal operations manager is calling for the third time because a shared Word document keeps producing copies and some edits seem to have disappeared. A filing deadline is close, and he wants someone to own the case.',
    goal: 'Take ownership, find out who works on the document and how, learn what seems to be missing, and agree a plan with times and a time for the next update.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see his files or the case system in this practice call, so rely on what he tells you.',
    ],
  },

  openingCore:
    "One of our shared Word documents keeps turning into several copies, and some people's changes have gone missing.",
  impactVariants: {
    low: {
      summary:
        "It's only a couple of us so far, but a filing has to be accurate, so I want it sorted before it spreads.",
      detail:
        "We've each found changes in a different place. The filing isn't due for a few weeks, but I want this settled properly.",
      deadline:
        "The filing goes in at the end of next month. There's time, but I want it settled this week.",
    },
    medium: {
      summary:
        'A few of us edit it, and nobody can say with confidence which copy is the right one.',
      detail:
        "Everyone has been working from whichever copy they last had open, and I want to be sure we don't file the wrong one.",
      deadline: 'The filing goes in next Wednesday.',
    },
    high: {
      summary: 'The filing goes in on Friday, and nobody can say which copy is the right one.',
      detail:
        "A senior person has to approve what goes in, and I can't put an unchecked version in front of her.",
      deadline: 'The filing has to go in on Friday afternoon.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case I raised last week about our shared Word document. It keeps turning into copies, and the advice I was given didn't help. I haven't had a proper update since.",
      brief:
        'Desmond raised a case last week about a shared Word document that keeps producing copies. He was given advice, it did not help and he has had no proper update.',
    },
    escalated: {
      opening:
        "This is the third time I've rung about our shared Word document, and nobody has taken ownership. It still keeps turning into copies, and some people's changes are missing.",
      brief:
        'Desmond has contacted support twice before about the same document. The copies kept appearing, and he says nobody has owned the case.',
    },
    closure: {
      opening:
        "I'm calling to confirm that our shared Word document is back to a single copy, so we can close the case.",
      brief:
        'Desmond expects to confirm that one agreed copy exists and that every change is accounted for, and to understand what happened, before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Ten days ago',
      summary:
        'Desmond first contacted support about copies of a shared Word document. Advice was given and the case was updated.',
    },
    {
      when: 'Earlier this week',
      summary:
        'Desmond called again. Support asked him to send details of what he had found, the case was set to pending and no named owner is recorded.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-what-happens',
      text: 'Our annual filing is one Word document, and copies of it keep turning up. Nobody can say which one is the right one.',
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration: "I've started keeping a list of the copies myself.",
      simple:
        'Our yearly filing is one Word document. New copies keep appearing. Nobody knows which copy is correct.',
    },
    {
      id: 'kf-changes-missing',
      text: "People are telling me that changes they made aren't in the main document any more.",
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'People tell me their changes are not in the main document any more.',
    },
    {
      id: 'kf-problem-closure',
      text: "Our annual filing is one Word document, and copies of it kept turning up. Some people's changes weren't in the main one, and I want to understand why before we close this.",
      intents: ['problem_description'],
      stages: ['closure'],
      simple:
        'Our yearly filing is one Word document. Copies of it kept appearing, and some changes were not in the main one. I want to understand why before we close this.',
    },
    {
      id: 'kf-where-it-lives',
      text: "It's in the legal team's shared folder, and that's where everyone is meant to work on it.",
      intents: ['environment'],
      cues: ['where is', 'where does', 'where do', 'stored', 'saved', 'shared folder', 'library'],
      simple: 'It is in the legal team shared folder. That is where everyone should work on it.',
    },
    {
      id: 'kf-asked-people',
      text: "I've asked everyone to open it only from the shared folder and to stop making their own copies. It hasn't changed anything.",
      intents: ['already_tried'],
      simple:
        'I asked everyone to open it only from the shared folder and to stop making copies. Nothing changed.',
    },
    {
      id: 'kf-third-contact',
      text: "This is my third contact about this. I got advice both times, and I haven't had an update either time.",
      intents: ['previous_contact'],
      stages: ['follow-up', 'escalated', 'closure'],
      simple:
        'This is my third contact about this. I got advice both times. I got no update either time.',
    },
    {
      id: 'kf-outcome',
      text: "I want one copy that everyone agrees is the master, every change accounted for, and someone who owns this until it's done.",
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple:
        'I want one copy that everyone agrees is the master. I want every change accounted for. I want one person to own this.',
    },
    {
      id: 'kf-outcome-closure',
      text: "I want to be sure there's one master that everyone agrees on, and that every change is accounted for.",
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple:
        'I want to be sure there is one master copy that everyone agrees on. I want every change accounted for.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-first-copy',
      intents: ['timing_onset'],
      text: "I think the first extra copy turned up about three weeks ago, when we started on this year's filing. I'd have to look at the file dates to be sure.",
      confirmedText:
        'Looking at the dates, the first extra copy is from the first week of drafting.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-copy-count',
      intents: ['problem_description', 'environment'],
      cues: ['copies', 'how many', 'list', 'file names', 'called'],
      checking: 'Let me open my list of the copies.',
      text: "I can find five. They've all been changed in the last week, and I can't tell from the names which is which.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-why-copies',
      intents: ['problem_description', 'reproducibility'],
      cues: ['why', 'cause', 'reason', 'how does it happen', 'how come'],
      text: "I don't know why it makes copies. That's what I'm hoping you can tell me.",
      whoKnows: 'the engineer',
    },
    {
      id: 'uf-folder-admin',
      intents: ['account_details'],
      cues: [
        'who looks after',
        'who manages',
        'who administers',
        'it team',
        'it provider',
        'administrator',
        'admin',
        'permissions',
      ],
      text: "I don't know who sets up the shared folders. I think it's our outside IT provider, but I couldn't swear to it.",
      whoKnows: 'our outside IT provider',
    },
    {
      id: 'uf-exact-words',
      intents: ['error_message'],
      cues: ['exact words', 'exact wording', 'word for word', 'exactly what it said', 'screenshot'],
      text: "I couldn't give you the exact words. I wasn't there when it came up.",
      whoKnows: 'the colleague who saw it',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-author-event',
      text: "We've also got an author event next month, so everyone's stretched.",
    },
    {
      id: 'if-floor-move',
      text: "The office is moving floors at the weekend, so I can't find half my papers.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-bar-and-save-copy',
      importance: 'critical',
      label: 'What came up when the first copy was made',
      statement:
        "Rosalind told me a bar came up across the top of Word, saying it couldn't save her changes and offering to save a copy. She took that, so she wouldn't lose her work, and carried on editing the copy for a day.",
      revealWhen:
        'Asks whether anyone saw a message or prompt on screen at the moment a copy was made.',
      intents: ['error_message'],
      cues: [
        'message',
        'warning',
        'prompt',
        'pop up',
        'popup',
        'notification',
        'on screen',
        'autosave',
        'error',
        'what did they see',
        'what did she see',
        'what did it say',
      ],
      hint: "One of the team said something odd came up on her screen, but I didn't ask what.",
      statementTerse:
        "Rosalind's Word said it couldn't save her changes and offered to save a copy. She took it and kept editing the copy.",
      statementSimple:
        'Rosalind saw a bar at the top of Word. It said it could not save her changes. It offered to make a copy. She chose that and worked in the copy for a day.',
      missedConsequence:
        'The engineer never learns where the first copy came from, so the plan can only repeat advice about using one folder and the copies keep arriving.',
      betterQuestion:
        'When a new copy appears, does anyone see a message or a prompt on screen just before it happens?',
    },
    {
      id: 'hf-who-edits',
      importance: 'helpful',
      label: 'Who edits the document',
      statement:
        'Seven of us have been editing it: me, Rosalind and Pieter, a finance colleague, a compliance colleague, our outside lawyer Wouter, and the director, who adds comments.',
      revealWhen: 'Asks who is editing the document or how many people work on it.',
      intents: ['affected_scope', 'recent_changes'],
      cues: [
        'who is editing',
        'who edits',
        'who has been editing',
        'who is working',
        'who works',
        'who else',
        'who is affected',
        "who's affected",
        'how many people',
        'how many of you',
        'who is involved',
        'who has access',
      ],
      statementTerse:
        'Seven of us: me, two paralegals, finance, compliance, outside counsel and the director.',
      statementSimple:
        'Seven people edit it. They are me, Rosalind, Pieter, a finance colleague, a compliance colleague, our outside lawyer Wouter and the director.',
      byImpact: {
        low: {
          statement:
            'Two people have been editing it, Rosalind and Pieter. They are the paralegals, and I only review.',
          statementTerse: 'Rosalind and Pieter, the paralegals. I only review.',
          statementSimple:
            'Two people edit it, Rosalind and Pieter. They are the paralegals. I only review it.',
        },
        medium: {
          statement:
            'Four of us have been editing it: me, Rosalind and Pieter, and a finance colleague.',
          statementTerse: 'Four of us: me, Rosalind, Pieter and finance.',
          statementSimple:
            'Four people edit it. They are me, Rosalind, Pieter and a finance colleague.',
        },
      },
      missedConsequence:
        'Without knowing who edits, the engineer cannot tell whom to ask about or who needs to stop editing before the filing.',
      betterQuestion:
        'Who has been editing the document, and is anyone from outside your team working on it?',
    },
    {
      id: 'hf-what-is-missing',
      importance: 'important',
      label: 'Which changes seem to be missing',
      statement:
        "The ones I could point to were Rosalind's amendments to the payment terms section from last Wednesday, and a couple of days of Pieter's edits from last week. Neither showed in the version I was looking at.",
      revealWhen: 'Asks which changes seem to be missing, whose they are or when they were made.',
      intents: ['problem_description', 'affected_scope', 'recent_changes'],
      cues: [
        'missing',
        'lost',
        'gone',
        'disappear',
        'vanish',
        'which changes',
        'what changes',
        'whose changes',
        'whose edits',
        'which edits',
        'what edits',
        'what has gone',
      ],
      statementTerse:
        "Rosalind's payment terms amendments from last Wednesday, and a couple of days of Pieter's edits.",
      statementSimple:
        'Rosalind changed the payment terms section last Wednesday. Those changes were missing. Pieter also made changes last week, and those were missing too.',
      missedConsequence:
        'The engineer never finds out what is missing, so nobody knows which copies to look in and the plan stays vague.',
      betterQuestion:
        'Which changes seem to be missing, whose are they and roughly when were they made?',
    },
    {
      id: 'hf-earlier-advice',
      importance: 'important',
      stages: ['follow-up', 'escalated', 'closure'],
      label: 'What the earlier contacts told him',
      statement:
        'The first person told me to make sure everyone opened the file from the same place. The second asked for a list of every copy and said someone would ring me back by the end of Tuesday. Nobody did.',
      revealWhen:
        'Asks what he was told on the earlier contacts, what advice he was given or what happened after.',
      intents: ['previous_contact', 'already_tried'],
      cues: [
        'what were you told',
        'what did they say',
        'what did they tell',
        'what advice',
        'earlier contact',
        'previous contact',
        'earlier call',
        'previous call',
        'previous engineer',
        'did anyone call',
        'did anybody call',
        'did anyone ring',
      ],
      statementTerse:
        'Open it from one place. Then send a list of the copies. A call back by Tuesday never came.',
      statementSimple:
        'The first person said everyone must open the file from the same place. The second asked for a list of the copies and said someone would call me by the end of Tuesday. No one called.',
      missedConsequence:
        'The engineer repeats advice that has already failed, and the missed call back goes unacknowledged, so his trust and patience fall further.',
      betterQuestion:
        'What were you told on the two earlier contacts, and what happened after you followed that advice?',
    },
    {
      id: 'hf-offline-laptop',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'One person edits with no signal',
      statement:
        "Pieter does a lot of his editing on trains and in court waiting rooms, where he has no signal. When he's back online there's a second file next to it, with something like his laptop's name on the end, and I assume it holds his changes.",
      revealWhen:
        'Asks how and where each person works on the document, such as at a desk, at home or while travelling.',
      intents: ['environment'],
      cues: [
        'how do they',
        'how does everyone',
        'how does each',
        'how are people',
        'where do they',
        'on the move',
        'travel',
        'offline',
        'laptop',
        'browser',
        'desktop',
        'from home',
      ],
      statementTerse:
        "Pieter edits on trains with no signal. A second file with a name like his laptop's appears afterwards.",
      statementSimple:
        'Pieter edits on trains and at court. Often he has no signal. Afterwards a second file appears with something like his laptop name at the end.',
      missedConsequence:
        'The engineer never learns the second route by which copies appear, so copies keep arriving whenever Pieter travels even if the first route is dealt with.',
      betterQuestion:
        'How and where does each person work on the document, for example at a desk, at home or on the move?',
    },
    {
      id: 'hf-signoff',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'When he needs one agreed copy',
      statement:
        'Our director signs the filing off on Thursday afternoon, so I need one agreed master by Thursday morning. Friday is too late for me.',
      revealWhen:
        'Asks when he needs one agreed copy by, who signs the filing off or what happens if the date is missed.',
      intents: ['urgency_deadline'],
      cues: [
        'deadline',
        'by when',
        'when do you need',
        'need it by',
        'sign off',
        'who signs',
        'who approves',
        'approval',
        'cut off',
        'time limit',
        'how urgent',
        'when is it due',
      ],
      statementTerse:
        'She signs it off Thursday afternoon. I need one agreed master by Thursday morning.',
      statementSimple:
        'The director signs the filing on Thursday afternoon. I need one agreed copy by Thursday morning.',
      byImpact: {
        low: {
          statement:
            "Our director signs the filing off about a week before it goes in. I'd like one agreed master well before then, so there's room, but I want to start now.",
          statementTerse:
            'She signs it off a week before filing. I want one master well before then.',
          statementSimple:
            'The director signs the filing about one week before it goes in. I want one agreed copy well before that.',
        },
        medium: {
          statement:
            'Our director signs the filing off on Monday evening, so I need one agreed master by Monday morning.',
          statementTerse: 'She signs it off Monday evening. I need one master by Monday morning.',
          statementSimple:
            'The director signs the filing on Monday evening. I need one agreed copy by Monday morning.',
        },
      },
      missedConsequence:
        'The engineer never finds the real time limit, so the next update is set for a time that does not fit and he cannot plan around it.',
      betterQuestion:
        'When do you need one agreed copy by, and who signs the filing off before it goes in?',
    },
    {
      id: 'hf-no-version-check',
      importance: 'helpful',
      minDifficulty: 'challenge',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'Nobody has looked at earlier versions',
      statement:
        "Nobody has looked at earlier versions of the file. I wouldn't know where to find them, or whether that's even possible.",
      revealWhen:
        'Asks whether anyone has looked at earlier versions of the document or tried to get a version back.',
      intents: ['already_tried'],
      cues: [
        'earlier version',
        'previous version',
        'older version',
        'version history',
        'restore',
        'go back to',
        'history of the',
        'recover',
        'get it back',
      ],
      statementTerse: "Nobody has looked. I don't know where earlier versions would be.",
      statementSimple:
        'Nobody has looked at earlier versions of the file. I do not know where they would be, or if it is possible.',
      missedConsequence:
        'The engineer never raises a simple place to look for the missing changes, so the plan relies only on finding the copies.',
      betterQuestion:
        'Has anyone looked at the earlier versions of the document to see what changed and when?',
    },
    {
      id: 'hf-meantime',
      importance: 'helpful',
      minDifficulty: 'challenge',
      requiresImpactAck: true,
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'How the team is working meanwhile',
      statement:
        "In the meantime Pieter is retyping his changes into the main document by hand. I don't like that for a legal document.",
      revealWhen:
        'Asks how people are working in the meantime, or what is being done to keep the document usable.',
      intents: ['workaround', 'business_impact'],
      cues: [
        'in the meantime',
        'meanwhile',
        'work around',
        'workaround',
        'how is the team working',
        'how are people working',
        'how are you working',
        'carry on',
        'keep working',
        'what are people doing',
        'what is everyone doing',
      ],
      statementTerse: "Pieter is retyping his changes into the main document. I don't like it.",
      statementSimple:
        'For now Pieter types his changes into the main document again by hand. I do not like this for a legal document.',
      missedConsequence:
        'The engineer never finds the risky stop-gap of retyping legal text, so the plan misses the one thing that could introduce errors before the filing.',
      betterQuestion:
        'How is everyone working on the document in the meantime, and does that worry you?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-word-loses-changes',
      statement:
        "I'm fairly sure Word is simply losing people's changes. I can't see any other explanation.",
      truth:
        'Nothing confirms that changes were lost. In this story the missing edits sit in copies that were saved separately, so they may be recoverable, but nobody has checked.',
    },
    {
      id: 'ia-newest-is-right',
      statement: 'I assume the copy with the latest date on it is the right one.',
      truth:
        'In this story the newest copy is missing changes that sit in others, so its date does not show that it is complete.',
    },
  ],

  curveballs: [
    {
      id: 'cb-guarantee-recover',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        'Can you guarantee that every change from every copy is accounted for? I need to be able to tell my director that.',
      followUp: 'A straight answer, please. Can you guarantee it?',
      expectedResponse:
        'Do not promise that every change will be accounted for or recovered. Say what you will do first, who will do it and by when, what you need from his side, and when he will hear next.',
      minDifficulty: 'standard',
      effects: { temperature: 6, patience: -6 },
    },
    {
      id: 'cb-ask-manager',
      type: 'ask-manager',
      trigger: { earliestTurn: 4, latestTurn: 9, whenOwnershipUnclear: true },
      statement:
        "I'd like to speak to your manager. I want someone senior to hear this, and to own it.",
      followUp: 'Please tell me who that would be and how I reach them.',
      expectedResponse:
        'Do not get defensive. Say what you can do now, offer a clear route to a senior colleague if he still wants one, and keep the focus on the first action and the time of the next update.',
      minDifficulty: 'challenge',
      effects: { temperature: 7, trust: -7, patience: -6 },
    },
    {
      id: 'cb-director-earlier',
      type: 'deadline',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        "I've just had a message from my director. She wants to see the final version a day earlier than planned.",
      followUp: 'So what can you actually do, and by when?',
      expectedResponse:
        'Acknowledge the pressure and do not promise an outcome. Agree specific steps with times that fit the earlier date, and ask what he needs to tell his director and when.',
      minDifficulty: 'challenge',
      effects: { temperature: 5, patience: -8 },
    },
    {
      id: 'cb-told-to-be-careful',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        "The last time we had something like this, we were told to be more careful with our files. I don't want to hear that again.",
      followUp: 'So what will be different this time?',
      expectedResponse:
        'Acknowledge it without defending it and do not hint that his team caused the copies. Show what is different now: your ownership, the first step and when he will hear next.',
      minDifficulty: 'challenge',
      effects: { temperature: 6, trust: -8 },
    },
  ],
  allowedCurveballs: [
    'unsupported-guarantee',
    'ask-manager',
    'deadline',
    'previous-bad-experience',
    'challenge-credibility',
  ],

  expectedDiscoveryAreas: [
    'What people saw when a copy was made',
    'Who works on the document, and how',
    'Which changes seem to be missing',
    'What earlier contacts advised',
    'When he needs one agreed copy',
    'How the team is working meanwhile',
  ],
  successCriteria: [
    'Opens by acknowledging that this is the third contact and the missed call back, without defending anyone, and takes ownership in their own name.',
    'Finds what people saw when a copy was made and how each person edits, rather than repeating the advice to open the file from one place.',
    'Establishes which changes seem to be missing, whose they are and when they were made, without promising that they can be recovered.',
    'Learns when he needs one agreed copy and sets the plan and the next update to fit it.',
    'Handles requests for a guarantee, a manager or an earlier date calmly, with honest commitments.',
    'Agrees what to gather, who does what by when and a specific time for the next update, then summarises.',
  ],
  coachingFocus: ['ownership-next-steps', 'scoping-discovery', 'empathy-deescalation'],
  careExpectations: {
    communicate: [
      'Summarises what is known, what is not and what happens next, in an order he can pass to his director, and avoids jargon he did not use.',
      'Checks that he follows any term used, such as AutoSave or version history, before relying on it.',
    ],
    accountable: [
      'Takes ownership in the first minutes, acknowledges the missed call back and the earlier contacts, and does not blame a colleague.',
      'Commits only to actions in their control, such as who gathers what by when and the time of the next update, and does not promise that every change will be recovered.',
    ],
    resourceful: [
      'Asks what people saw on screen when a copy was made and how and where each person edits, instead of repeating the advice to use one folder.',
      'Asks whether anyone has looked at earlier versions and how the team is working in the meantime.',
    ],
    empathetic: [
      'Names the pressure of the filing and the third contact specifically, before asking anything.',
      'Stays composed and respectful when he is sharp or asks for a manager.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Repeating the advice to open the document from one folder, which he has already followed.',
    'Asking him to tell the whole story again as if the case notes did not exist.',
    'Promising that every change will be recovered, or that one master will exist by a time the engineer cannot control.',
    'Suggesting that his team caused the copies by being careless, or blaming the earlier contacts.',
    'Ending with "we will look into it" and no named owner, action or time.',
  ],
  goodBehaviours: [
    'Acknowledging the third contact and the missed call back, and taking ownership early.',
    'Asking what people saw on screen when a copy appeared, and how and where each person edits.',
    'Asking which changes seem to be missing and whose they are, without promising to recover them.',
    'Asking when he needs one agreed copy and who signs the filing off.',
    'Agreeing what to gather, who does what and when the next update comes, then summarising.',
  ],
  expectedOutcome:
    'Desmond has a named owner and an apology for the missed call back. He understands that the missing changes may sit in separate copies rather than be lost, and knows what to gather and by when. He has a time for the next update that fits his sign-off, and no promise that cannot be kept.',
  evaluatorNotes:
    "Root cause in the story (plausible, not confirmed on the call): copies came from two routes. When Word could not save Rosalind's changes it offered to keep them as a copy, and she kept editing that copy. Pieter edits offline while travelling, so a second file that points at his laptop appeared. Their changes sit in those copies, and nobody has looked at earlier versions, so the edits may not be lost. Desmond believes Word is losing changes. A strong call acknowledges the third contact and the missed call back, finds what people saw and how each person edits, finds what seems missing without promising recovery, learns the sign-off time, and agrees an owner, actions and a next update that fits it.",
} satisfies ScenarioInput;

export default scenario;
