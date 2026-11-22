import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario (first contact), and the library's first how-to call. Everything here is
// fictional: people, organisation and case. OneDrive is a real product, so the scenario describes only
// what the customer sees and was told, never how it stores files.
//
// Root cause in the story (hidden from the trainee): about two weeks ago Walter's old laptop stopped
// working and a contractor set up a new one. On it the files in his work folder are kept online and
// shown with a small cloud, and are not stored on the laptop. Nothing was deleted. Walter is flying to
// a trade fair next Thursday with no reliable internet and needs the supplier price lists and the
// order forms with him, but he has not said so: he calls to ask what the little cloud means because he
// fears his files are gone. The laptop does not have much space, so he cannot keep everything on it.
// The contractor said something about saving space that he did not follow.
//
// Walter is anxious, vague and not technical. He gives a general answer first and becomes specific
// when asked one focused question at a time. A strong call reassures him in a plain sentence, finds
// what he sees and what changed, finds the trip and which files matter, explains one step at a time
// without jargon and checks that he can follow, promises nothing it cannot see, and agrees what he
// will do before he travels and when he will hear back.

const scenario = {
  id: 'onedrive-files-show-cloud-icons',
  version: 1,
  title: 'Files show a small cloud icon beside their names',
  shortTitle: 'Files show cloud icons',
  listSummary:
    'An office manager sees a cloud beside his files and asks whether they are still on his laptop.',
  summary:
    'Walter Okafor is the office manager at Fourth Coffee. A small cloud has appeared beside many of the files on his laptop, and he does not know what it means. He is worried and not technical. Reassure him in plain words, find out what he needs and agree what happens next.',
  tags: ['how-to', 'cloud icon', 'reassurance', 'plain language', 'vague answers'],
  estimatedMinutes: 9,

  product: { id: 'onedrive-business', area: 'Files and storage' },
  caseReference: 'SIM-410303',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-support'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read the current public page on OneDrive Files On-Demand (cloud and green-tick icons, online-only files, no opening without internet). Terms fit; the laptop set-up and the trip are the story's own. Stage-limited closure lines. AI-assisted review, not a mentor's.",
  },
  issueType: 'how-to',
  impact: 'low',
  startingTemperature: 'anxious',
  proficiency: 'novice',
  style: 'vague',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Walter Okafor',
    speaker: 'male',
    role: 'Office Manager',
    organisation: 'Fourth Coffee',
    background:
      'Walter runs the office for a small coffee company with five shops. He looks after orders, rotas, supplier lists and the accounts folder, and he uses his laptop every day but has never thought about how it stores things. He worries easily about losing work, and he checks twice before he deletes anything.',
    voice:
      'Anxious and polite, with a habit of giving a general answer first. Says "a little cloud" and "the pictures next to the files" rather than technical words. Becomes specific when the engineer asks one focused question at a time, and calms down when told clearly what is safe.',
  },
  environment: {
    details: [
      'Walter uses a laptop at the Fourth Coffee head office, with his work files in a folder that is also kept online.',
      'Five shops send their orders and rotas to the head office every week.',
      'The company keeps a few shared folders for supplier lists, rotas and accounts.',
      'There is no IT team. Outside help is called in when something needs setting up.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Only Walter, as far as he knows.' },
    medium: { count: 4, summary: 'Four people at the head office, who all see the cloud marks.' },
    high: { count: 20, summary: 'About twenty people across the head office and the five shops.' },
  },
  customerObjective:
    'Understand what the little cloud means, be sure his files are safe and know what to do next.',
  customerExpectation:
    'Someone who explains in plain words what the cloud means, tells him calmly whether his files are safe, and says what he should do and when he will hear back.',
  desiredOutcome:
    'Walter understands what the clouds mean and knows his files are safe. He has what he needs, knows what he will do next and knows when he will hear back.',
  previousTroubleshooting: ['Walter looked in the recycle bin and did not find the files there.'],
  recentChanges: [
    "Walter's old laptop stopped working about two weeks ago, and a contractor set up a new one.",
  ],

  publicBrief: {
    issue: 'He sees a small cloud beside his files and is not sure what it means.',
    impact: {
      low: 'One person is worried, but nothing has stopped working.',
      medium: 'Several people are asking what it means and want an answer.',
      high: 'Many people are asking whether their files have gone and need reassurance.',
    },
    objective: 'Reassure him in plain words, find out what he needs and agree what happens next.',
    knownContext:
      'Walter Okafor is the office manager at Fourth Coffee. He is not technical, worries about losing work and tends to answer in general terms.',
    environment:
      'Walter uses a laptop at the head office, with his work files in a folder that is also kept online.',
  },
  brief: {
    situation:
      'An office manager is calling because a small cloud has appeared beside many of the files on his laptop. He is not technical and is worried that something has happened to his files. He asks what it means.',
    goal: 'Reassure him in plain words, find out what he is trying to do, explain simply, and agree what happens next and when he will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; he answers in general terms until you ask something specific.',
      'You cannot see his laptop in this practice call, so rely on what he tells you.',
    ],
  },

  openingCore:
    "There's a little cloud next to a lot of my files now, and I don't know what it means.",
  impactVariants: {
    low: {
      summary:
        "It's probably nothing, but I'd like to understand it, because I'm worried about my files.",
      detail:
        "As far as I know it's only my laptop. I've been careful not to touch the files with the cloud.",
      deadline: "There's no rush, but I'd rather know soon, because I don't like not knowing.",
    },
    medium: {
      summary: "Several of us have it now, and everyone's asking me what it means.",
      detail:
        "It's four of us at the head office. They all ask me, because I'm the office manager.",
      deadline: "I'd like to give them an answer this week.",
    },
    high: {
      summary:
        "People in the head office and the shops keep asking me whether their files are gone, and I can't tell them.",
      detail:
        "About twenty people see it, in the head office and the shops, and they're all asking me.",
      deadline: 'I need something to tell them today.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I rang earlier this week about the little clouds next to my files, and nobody has told me anything yet. I'm still worried about them.",
      brief:
        'Walter called earlier this week about cloud marks beside his files. A case was logged and he has not had an update.',
    },
    escalated: {
      opening:
        "This is the second time I'm ringing about the little clouds next to my files, and I'm still worried.",
      brief:
        'Walter has contacted support twice about cloud marks beside his files, and he is still worried about them.',
    },
    closure: {
      opening:
        "I'm calling about the little clouds next to my files, to make sure my files are safe before you close the case.",
      brief:
        'Walter expects to confirm that his files are safe and to understand what the clouds meant before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier this week',
      summary:
        'Walter reported small cloud marks beside his files and asked what they meant. A case was logged and no update has been sent.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: "There's a little cloud next to a lot of my files now. I'd like to know what it means.",
      intents: ['problem_description', 'error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration:
        "Not all of them. A few have a different little picture, but I don't know what that one means either.",
      simple: 'There is a little cloud next to many of my files. I want to know what it means.',
    },
    {
      id: 'kf-problem-closure',
      text: 'I was told what the little cloud means. I want to check my files are safe, and that I can still open them when I need to.',
      intents: ['problem_description', 'error_message'],
      stages: ['closure'],
      simple:
        'I was told what the little cloud means. I want to check my files are safe. I want to be able to open them when I need to.',
    },
    {
      id: 'kf-where',
      text: 'I see it when I open my work folder on the laptop, in the list of my files.',
      intents: ['environment', 'reproducibility'],
      cues: [
        'where do you see',
        'where are you seeing',
        'where is it',
        'which screen',
        'which program',
        'which app',
      ],
      simple:
        'I see it when I open my work folder on the laptop. It is next to the names of my files.',
    },
    {
      id: 'kf-files',
      text: 'Mostly my supplier price lists, the weekly orders and the accounts folder.',
      intents: ['problem_description', 'affected_scope'],
      cues: ['which files', 'what files', 'what kind of files', 'which folder', 'what folder'],
      simple: 'Mostly my supplier price lists, the weekly orders and the accounts folder.',
    },
    {
      id: 'kf-laptop',
      text: 'I use a laptop at our head office. It works fine otherwise.',
      intents: ['environment'],
      simple: 'I use a laptop at our head office. Everything else works.',
    },
    {
      id: 'kf-tried',
      text: "I looked in the recycle bin in case they were deleted, and the files aren't in there. I haven't moved or deleted anything, because I don't want to make it worse.",
      intents: ['already_tried'],
      simple:
        'I looked in the recycle bin in case they were deleted. The files are not in there. I have not moved or deleted anything. I do not want to make it worse.',
    },
    {
      id: 'kf-outcome',
      text: 'I just want to be sure my files are safe, and to know if I have to do something.',
      intents: ['expected_outcome'],
      simple: 'I want to be sure my files are safe. I want to know if I have to do something.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-since-when',
      intents: ['timing_onset'],
      text: "I noticed it about a week ago. Perhaps longer, I'm not sure.",
      confirmedText: 'I think it was about ten days ago, on a Monday morning.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-look-at-file',
      intents: ['problem_description', 'error_message', 'reproducibility'],
      cues: [
        'look at',
        'open one',
        'pick a file',
        'pick one',
        'one of the files',
        'what do you see',
        'tell me what you see',
        'what is next to',
      ],
      checking: "Give me a moment, I'll look at one.",
      text: 'The price list has the little cloud. The files I use every day have a green tick next to them instead.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-cloud-meaning',
      intents: ['problem_description'],
      cues: ['what do you think', 'what does it mean', 'do you know what', 'any idea'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      text: "I don't know what the little cloud means. That's why I'm calling.",
    },
    {
      id: 'uf-settings',
      intents: ['environment', 'account_details'],
      cues: [
        'settings',
        'on demand',
        'on-demand',
        'turned on',
        'switched on',
        'configured',
        'how is it set up',
      ],
      text: "I don't know what the settings are for this on the laptop. I never needed to look.",
      whoKnows: 'whoever set the laptop up',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-blend',
      text: "We're launching a new blend next month, so the whole office is busy.",
    },
    {
      id: 'if-desktop',
      text: 'My desktop is full of old pictures. I have been meaning to tidy it for a year.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-trip',
      importance: 'critical',
      label: 'He is about to travel',
      statement:
        "I'm flying out next Thursday for a trade fair abroad. I won't have a reliable internet connection on the way or at the stand, and I need my price lists and order forms with me.",
      partialStatement: "It matters because I'll be away soon, and I need my files with me.",
      revealWhen:
        'Asks whether he needs the files at a particular time or place, or whether anything is coming up where they matter.',
      intents: ['urgency_deadline', 'business_impact', 'expected_outcome'],
      partialIntents: ['business_impact'],
      cues: [
        'offline',
        'without internet',
        'no internet',
        'travel',
        'trip',
        'abroad',
        'going anywhere',
        'going away',
        'coming up',
        'what do you need them for',
        'why do you need',
        'where will you be',
      ],
      hint: 'I need to have my files with me soon.',
      statementTerse:
        'I fly on Thursday for a trade fair. No reliable internet there. I need my price lists and order forms.',
      statementSimple:
        'I am flying next Thursday to a trade fair abroad. I will not have a good internet connection. I need my price lists and my order forms with me.',
      missedConsequence:
        'The real reason he is worried never comes out, so the cloud is explained in general but he is never prepared for a trip without internet, and he leaves unsure.',
      betterQuestion:
        'Is there something coming up where you will need these files, and where will you be?',
    },
    {
      id: 'hf-new-laptop',
      importance: 'important',
      label: 'The laptop is new',
      statement:
        "The laptop is new. My old one stopped working about two weeks ago, and a contractor set this one up for me. I didn't touch the files myself.",
      revealWhen: 'Asks whether anything changed recently, or who set up the laptop and when.',
      intents: ['recent_changes', 'environment'],
      cues: [
        'anything change',
        'what changed',
        'any change',
        'anything new',
        'anything different',
        'new laptop',
        'new computer',
        'who set up',
        'before you noticed',
        'before it started',
      ],
      statementTerse: 'New laptop. A contractor set it up about two weeks ago.',
      statementSimple:
        'The laptop is new. My old laptop stopped working about two weeks ago. A contractor set up this one. I did not touch the files.',
      missedConsequence:
        'The one real change, a new laptop set up by someone else, stays hidden, so the engineer cannot say why the files look different now and he keeps thinking he did something wrong.',
      betterQuestion:
        'Did anything change before you noticed the clouds, such as a new computer or someone setting something up?',
    },
    {
      id: 'hf-which-files',
      importance: 'important',
      label: 'Which files he really needs',
      statement:
        "The files I really need are the supplier price lists and the order forms. The rest can stay where it is, because the laptop doesn't have much space.",
      revealWhen:
        'Asks which files or folders he needs most, or how much he needs to have with him.',
      intents: ['expected_outcome', 'affected_scope'],
      cues: [
        'which files do you need',
        'which folders do you need',
        'need most',
        'most important',
        'important files',
        'which ones do you need',
        'need with you',
        'what files do you need',
        'which of these',
        'which of the files',
      ],
      statementTerse:
        'The price lists and the order forms. The rest can stay put; there is not much space.',
      statementSimple:
        'I really need the supplier price lists and the order forms. The rest can stay where it is. The laptop does not have much space.',
      missedConsequence:
        'Without knowing which files matter, the engineer suggests keeping everything on a small laptop, or leaves him unsure which ones to prepare.',
      betterQuestion: 'Which of these files do you really need to have with you?',
    },
    {
      id: 'hf-contractor',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'What the contractor said',
      statement:
        "The contractor said something about saving space on the laptop. I didn't really follow it, and I didn't like to ask again.",
      revealWhen:
        'Asks what the person who set up the laptop said or did, or whether anyone explained how it keeps his files.',
      intents: ['recent_changes', 'environment'],
      cues: [
        'contractor',
        'the person who set',
        'did anyone explain',
        'anyone tell you',
        'what did they tell you',
        'told you about',
        'what did they say',
        'who set it up',
      ],
      statementTerse: "The contractor said something about saving space. I didn't follow it.",
      statementSimple:
        'The contractor said something about saving space on the laptop. I did not follow it, and I did not want to ask again.',
      missedConsequence:
        'A useful clue about how the laptop was set up is missed, and he stays unsure whether someone changed something on purpose.',
      betterQuestion: 'Did anyone explain how the laptop keeps your files when it was set up?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-files-gone',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        'I think the files have gone from my laptop, or someone has moved them away. Did something delete them?',
      truth:
        'In this story nothing has been deleted: the files are kept online, and the laptop shows them with a cloud while they are not stored on it.',
    },
  ],

  curveballs: [
    {
      id: 'cb-files-safe',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: "Can you promise me my files will still be there? I can't lose them.",
      followUp: 'So are they safe, yes or no?',
      expectedResponse:
        'Do not promise what you cannot see. Say what you can check and do, what he should do himself and when he will hear from you, in plain words, and ask what he needs to be sure of.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -4 },
    },
    {
      id: 'cb-goes-quiet',
      type: 'go-silent',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Mm. Okay. Right.',
      followUp: 'Sorry, I got lost. Can you say that again, slowly?',
      expectedResponse:
        'Notice the pause, slow down, and check gently what was unclear before saying it again in smaller steps.',
      minDifficulty: 'standard',
      effects: { patience: -2 },
    },
  ],
  allowedCurveballs: ['unsupported-guarantee', 'go-silent', 'previous-bad-experience'],

  expectedDiscoveryAreas: [
    'What he sees on screen',
    'How many files show it',
    'When he first noticed it',
    'Anything that changed before',
    'What he needs the files for',
    'What he has already tried',
  ],
  successCriteria: [
    'Greets Walter warmly, speaks in plain words and does not rush him.',
    'Reassures him early without over-promising, then finds out what he sees and what changed.',
    'Finds out what he needs the files for, instead of answering only the question about the cloud.',
    'Explains in plain words what the cloud means and how to have the files he needs ready, one step at a time, checking that he can follow.',
    'Agrees what Walter will do before he travels and when he will hear back if anything is unclear.',
    'Summarises in plain words and checks that he is comfortable.',
  ],
  coachingFocus: ['empathy-deescalation', 'scoping-discovery', 'clarity'],
  careExpectations: {
    communicate: [
      'Uses everyday words such as "little cloud" and "your files", explains one idea at a time and checks that Walter is following.',
      'Gives steps one at a time, only after finding out what he needs, and asks him to say back what he will do.',
    ],
    accountable: [
      'Says clearly what they will do, what Walter will do and when he will hear back, without promising what they cannot see.',
    ],
    resourceful: [
      'Asks what he sees and whether anything changed, then finds out what he needs the files for before explaining.',
      'Finds out which files he really needs, so that the advice is small and clear.',
    ],
    empathetic: [
      'Recognises the worry about losing work before explaining anything, and slows down when he is anxious.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Using terms such as "online-only", "sync" or "on demand" without explaining them.',
    'Giving a list of steps straight away, before asking what he needs the files for.',
    'Telling him there is nothing to worry about without saying why, or promising that nothing can go wrong.',
    'Speaking quickly or giving several steps at once to an anxious customer.',
    'Ending without checking that he can do it himself and knows when he will hear back.',
  ],
  goodBehaviours: [
    'Reassuring him in one plain sentence before asking questions.',
    'Asking what he sees, how many files show it and what changed, one question at a time.',
    'Asking what he needs the files for and where he will be.',
    'Explaining one step at a time and asking him to say it back.',
    'Agreeing what he will do next and when he will hear back, then summarising in plain words.',
  ],
  expectedOutcome:
    'Walter understands in plain words that his files are still there and why the little cloud appears. He knows how to make sure the files he needs are on the laptop before he travels, has done or agreed the first step, and knows when he will hear back. He ends the call calmer.',
  evaluatorNotes:
    "Root cause in the story: Walter's laptop was replaced about two weeks ago and a contractor set it up. On it the files in his work folder are kept online and shown with a small cloud, and are not stored on the laptop. Nothing was deleted. He is flying to a trade fair next Thursday with no reliable internet and needs the price lists and order forms, but he has not said so. He asks what the cloud means because he fears the files are gone. A strong call reassures calmly, finds the trip and which files matter, explains one step at a time in plain words, promises nothing it cannot see, and agrees what he will do and when he will hear back.",
} satisfies ScenarioInput;

export default scenario;
