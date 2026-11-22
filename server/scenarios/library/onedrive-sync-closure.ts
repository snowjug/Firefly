import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario (closure call). Everything here is fictional: people, organisation and case.
//
// Root cause (hidden from the trainee): on the Monday Ingrid moved a whole year of scanned invoices,
// thousands of files, into her work folder for the audit. Syncing then spent days working through
// them, and in the meantime her month-end workbook did not show up online, which a colleague
// noticed on Tuesday. On Thursday an engineer told her to leave the laptop switched on and plugged
// in, not to close the lid and to keep an eye on the cloud icon, and the files caught up by the
// weekend. Nothing she did was wrong. This is a plausible story for the case, not a claim about how
// the product works. Two things are still open and she has not said so: while the files were not
// showing online she emailed the month-end workbook to her manager, who has been editing that copy,
// and she has only looked at the little cloud icon on her own laptop. A strong call confirms the
// fix with evidence, explains what changed in plain words without blame or guessing, finds the
// second copy, does not promise it will never happen again, and closes with a short summary and a
// clear route back to support.

const scenario = {
  id: 'onedrive-sync-closure',
  version: 1,
  title: 'Closing a case on files that stopped syncing',
  shortTitle: 'Files stopped syncing',
  listSummary:
    'A finance assistant calls back to understand what changed after her files started syncing again.',
  summary:
    'Ingrid is a finance assistant whose work files stopped syncing between her laptop and her online folder. They seem to work again, and she has called back before the case is closed. She wants to know what changed. Expect a friendly, chatty customer who is not very technical.',
  tags: ['closure', 'file sync', 'plain language', 'starter'],
  estimatedMinutes: 8,

  product: { id: 'onedrive-business', area: 'File sync' },
  caseReference: 'SIM-420001',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    productFamily: 'microsoft-365',
    sourceCategories: ['author-experience'],
    behaviourCheck: 'not-checked',
    syntheticConfirmed: true,
    review: 'unreviewed',
  },
  issueType: 'data-missing',
  impact: 'low',
  startingTemperature: 'calm',
  proficiency: 'novice',
  style: 'talkative',
  callStage: 'closure',
  difficulty: 'starter',

  persona: {
    name: 'Ingrid Solheim',
    speaker: 'female',
    role: 'Finance Assistant',
    organisation: 'Alpine Ski House',
    background:
      'Ingrid keeps the accounts in order for a busy ski and outdoor shop, and month-end is her busiest time. She uses her work folders every day but has never thought about how files get from her laptop to the online copy. She would rather ask than guess.',
    voice:
      "Warm and chatty. Gives background and small stories before the point, and apologises for not being technical. Describes what she sees in her own words, such as 'the little cloud'. Says so politely when a term loses her, and relaxes when things are explained simply.",
  },
  environment: {
    details: [
      'A company laptop that Ingrid uses every day, with her month-end files in a work folder that is meant to match her online folder',
      'She can also open the same files in a web browser, and she shares the month-end workbook with her manager',
      'The finance and purchasing teams were all adding a year of scanned invoices to their folders for the audit that week',
      'Month-end is the busiest time of the month for the finance team',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: "Only Ingrid's laptop was affected" },
    medium: {
      count: 3,
      summary:
        'Three people in the finance team, who were all adding scanned invoices for the audit',
    },
    high: {
      count: 14,
      summary:
        'The finance and purchasing teams, about fourteen people, who were all adding scans for the audit',
    },
  },
  customerObjective:
    'Be sure her files are syncing properly again, understand in plain words what changed, and have the case closed with confidence.',
  customerExpectation:
    'A clear answer on whether it is fixed, a short explanation she can follow, a chance to ask her own questions, and a polite close.',
  desiredOutcome:
    'Ingrid has confirmed her files are updating, understands what happened in plain words, has no worries left open, and agrees to close the case.',
  previousTroubleshooting: [
    'Restarted the laptop on Wednesday, which made no difference',
    'Emailed the month-end workbook to her manager while the files were not showing online',
    'On Thursday an engineer told her to leave the laptop switched on and plugged in, not to close the lid, and to keep an eye on the cloud icon; the files caught up over the next two days',
  ],
  recentChanges: [
    'On the Monday she moved a whole year of scanned invoices, thousands of files, into her work folder for the audit',
    'She thinks tidying her folders may have broken something, which is not so',
  ],

  publicBrief: {
    issue:
      'Her files had stopped syncing. They seem fine now and the case is waiting to be closed.',
    impact: {
      low: 'Only Ingrid was affected. Low urgency, but she wants it properly closed off.',
      medium:
        'Several colleagues were affected too, and they are waiting to hear that it is fixed.',
      high: 'Two departments were affected, so closing the case too early could be costly.',
    },
    objective:
      'Confirm it is resolved, explain what changed in plain words, check for concerns, and close well.',
    knownContext:
      'Ingrid is not technical and likes a simple explanation. She is friendly and tends to give background before getting to the point.',
    previousContact:
      'Ingrid called last Thursday when her files stopped updating. An engineer helped her over the phone and the files began to catch up. The case is open.',
    environment:
      'A company laptop with her work files in a folder that is meant to match her online folder.',
  },
  brief: {
    situation:
      'Ingrid is a finance assistant. Last week her work files stopped syncing between her laptop and her online folder, and an engineer helped her over the phone. She is friendly, chatty and not very technical.',
    goal: 'Confirm the problem is really resolved, explain what changed in plain words, check she has no remaining concerns, and close the case professionally.',
    groundRules: [
      'The customer, organisation and case are fictional.',
      'You cannot see her laptop in this practice call. Ask what she sees and rely on what she tells you.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
    ],
  },

  openingCore:
    "I've had trouble with my work files syncing between my laptop and my online folder.",
  impactVariants: {
    low: {
      summary: "It only affects me, so it isn't urgent, but I'd like it properly sorted.",
      detail:
        "It was only my laptop, as far as I know. I could still get on with most of my work, but it was a hassle for a few days, and I'd rather it was properly settled.",
      deadline: "Nothing fixed, but I'd like to know it's settled soon.",
    },
    medium: {
      summary: "A few of us in the finance team are affected, so I'd like it properly sorted.",
      detail:
        "Three of us in the finance team had the same trouble. I'm fine now, but I'm not sure about the other two, and they're waiting for me to say it's all clear.",
      deadline: "I'd like to tell them today if I can.",
    },
    high: {
      summary: 'A lot of us in finance and purchasing are affected, so it needs sorting properly.',
      detail:
        "Finance and purchasing were both hit, about fourteen of us. Mine is fine now, but I've heard some of the others are still waiting, and people keep asking me what's going on.",
      deadline: "People are asking me every hour, so I'd like to tell them today.",
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on my case about my work files not syncing. I haven't had an update since last Thursday, so could you tell me where it's got to?",
      brief:
        'This is a follow-up call. Ingrid wants to know what was done about her files and whether the problem is resolved.',
    },
    escalated: {
      opening:
        "This is my second call about my work files not syncing, and nobody has really explained what happened. Could you tell me what's going on?",
      brief:
        'Ingrid has called twice about the same problem and still has no clear explanation. She is polite but wants a straight answer.',
    },
    closure: {
      opening:
        "I'm calling back about my case, the one about my work files that stopped syncing. They seem to be working again now, so before you close it, could you tell me what changed?",
      brief:
        'This is a closure call. Ingrid expects confirmation that her files are working, a short explanation of what changed, and a chance to raise any last concerns before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Last Thursday',
      summary:
        'Ingrid phoned support because changes she saved on her laptop were not showing online. A case was opened and an engineer advised her over the phone.',
    },
    {
      when: 'Last Thursday',
      summary:
        'The engineer asked her to leave the laptop switched on and plugged in, not to close the lid, and to keep an eye on the cloud icon. The case was left open for her to confirm.',
    },
    {
      when: 'Last Friday',
      summary:
        'Ingrid emailed to say that things looked better. Support replied that the case would stay open until she confirmed by phone.',
    },
    {
      when: 'Since then',
      summary: 'Ingrid asked for a call back to understand what changed before the case is closed.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-files-and-folder',
      text: "My month-end files are in a work folder on my laptop, and they're meant to match the online copy so I can open them from anywhere.",
      intents: ['problem_description', 'environment'],
      elaboration: 'I use the same workbook all month, and it gets busier towards the end.',
      simple: 'My files are in a work folder on my laptop. They should also be online.',
    },
    {
      id: 'kf-stopped-updating',
      text: "Last week the changes I saved stopped showing up online. Well, I think it was last week. A colleague said he couldn't see my latest work.",
      intents: ['problem_description', 'timing_onset'],
      elaboration: 'I only found out because he asked me why the workbook looked so old.',
      simple:
        'Last week my saved changes did not show online. A colleague could not see my newest work.',
    },
    {
      id: 'kf-looks-fine-now',
      text: 'It looks fine now. The icon in the corner of my screen looks normal again, and my files seem to be updating.',
      intents: ['problem_description', 'error_message'],
      stages: ['closure'],
      elaboration: "It's a relief, honestly, because it was a worry for a few days.",
      simple: 'It looks fine now. The icon looks normal. My files seem to update.',
    },
    {
      id: 'kf-rang-before',
      text: 'I rang last Thursday, and an engineer talked me through some steps on the phone.',
      intents: ['previous_contact'],
      stages: ['follow-up', 'escalated', 'closure'],
      elaboration: "He explained it all slowly, and I didn't understand half of it, to be honest.",
      simple: 'I called last Thursday. An engineer helped me on the phone.',
    },
    {
      id: 'kf-outcome',
      text: "I'd like to be sure it's properly sorted, and to understand what changed, so I'm not caught out again.",
      intents: ['expected_outcome'],
      elaboration: "I'm not technical, so a simple explanation would help me most.",
      simple: 'I want to be sure it is fixed. I want to understand what changed.',
    },
  ],

  vagueFacts: [
    {
      id: 'vf-thursday-steps',
      intents: ['already_tried', 'previous_contact'],
      cues: [
        'thursday',
        'steps',
        'walked you through',
        'talked you through',
        'what did you do',
        'what did he',
        'what did the engineer',
      ],
      stages: ['follow-up', 'escalated', 'closure'],
      text: "He told me to leave the laptop on and plugged in, and not to close the lid, I think. And something about keeping an eye on the cloud. I'd have to think.",
      confirmedText:
        "Yes, that's right: leave it on and plugged in, don't close the lid, and keep an eye on the cloud. It looked caught up by the weekend.",
    },
    {
      id: 'vf-when-stopped',
      intents: ['timing_onset'],
      text: "It was early last week, I think. Monday or Tuesday? I'd have to think about when my colleague first mentioned it.",
      confirmedText:
        "I noticed on Tuesday, because that's when my colleague said the workbook looked old. It might have stopped on Monday.",
    },
  ],
  checkableFacts: [
    {
      id: 'cf-engineer-email',
      intents: ['previous_contact', 'already_tried'],
      cues: ['email', 'told you', 'advice', 'afterwards', 'after the call', 'what you were told'],
      stages: ['follow-up', 'escalated', 'closure'],
      checking: "Hold on, there's an email from after the call. Let me find it.",
      text: "It says the case stays open until I confirm everything's working, and that I can ring back if anything looks odd.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-why-it-stopped',
      intents: ['problem_description', 'recent_changes'],
      cues: [
        'why did it stop',
        'why it stopped',
        'what caused',
        'the cause',
        'root cause',
        'the reason',
      ],
      text: "I honestly don't know why it stopped in the first place. I was hoping you could tell me.",
      whoKnows: 'the engineer who helped me',
    },
    {
      id: 'uf-which-version',
      intents: ['environment', 'account_details'],
      cues: ['which version', 'what version', 'which account', 'what licence', 'what plan'],
      text: "I don't know which version of the app I have, or anything like that. It's whatever IT put on my laptop.",
      whoKnows: 'our IT team',
    },
    {
      id: 'uf-how-it-works',
      intents: ['environment', 'problem_description'],
      cues: ['how does it work', 'how it works', 'how syncing works', 'do you know how'],
      text: "I don't really know how the syncing works. I just save my files and trust they'll turn up online.",
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-desks',
      text: "We're all moving desks next month, so my screen is balanced on a pile of boxes at the moment.",
    },
    {
      id: 'if-season',
      text: "It's getting busy at the shop because the ski season's about to start, and everyone's ordering stock.",
    },
    {
      id: 'if-buns',
      text: 'Ragnhild from purchasing brings cinnamon buns in on Fridays, which is the highlight of my week.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-emailed-copy',
      importance: 'critical',
      label: 'A second copy of the workbook exists',
      statement:
        "While it wasn't syncing I emailed the month-end workbook to Mattias, my manager, so he could carry on. He's been making changes in that copy, and now I'm not sure which one is the latest. I didn't like to say.",
      partialStatement:
        "There's something I did while it wasn't working, but I'm not sure it matters.",
      revealWhen:
        'Asks how she managed in the meantime, whether she shared the files another way, or whether anything is still unresolved or worrying her before the case is closed.',
      intents: ['workaround', 'already_tried'],
      partialIntents: ['problem_description'],
      cues: [
        'workaround',
        'work around',
        'in the meantime',
        'meantime',
        'it wasn',
        'how did you manage',
        'emailed',
        'anything still',
        'still outstanding',
        'worr',
        'concern',
        'bothering',
      ],
      hint: "I've had to send a few things round by email in the meantime.",
      statementTerse:
        'I emailed the workbook to Mattias, my manager. He edited that copy, so I am not sure which is the latest.',
      statementSimple:
        'While syncing did not work, I sent the month-end workbook to my manager, Mattias, by email. He changed his copy. Now I do not know which copy is the newest. I did not want to say.',
      missedConsequence:
        'The case is closed while two versions of the month-end workbook exist, and Ingrid is left to sort out which one is current on her own, just before month-end.',
      betterQuestion:
        "Is there anything you're still unsure about, or anything you did while it wasn't working that we should talk through before we close this?",
    },
    {
      id: 'hf-only-checked-icon',
      importance: 'important',
      label: 'Only checked the icon on her own laptop',
      statement:
        "To be honest, I've only been going by the little cloud on my laptop. I haven't opened my files in the browser or on my phone, so I haven't actually seen the latest changes arrive online.",
      revealWhen:
        'Asks how she knows it is working now, what she has checked since, or whether she has looked at her files anywhere other than her laptop.',
      intents: ['reproducibility', 'already_tried', 'environment'],
      cues: [
        'how do you know',
        'how can you tell',
        'how did you check',
        'how have you checked',
        'have you checked',
        'have you looked',
        'have you tested',
        'other device',
        'your phone',
        'the browser',
        'online',
        'another device',
      ],
      hint: "I've mostly been going by the little cloud, to be honest.",
      statementTerse:
        "I've only looked at the cloud icon on my laptop. Not online, not on my phone.",
      statementSimple:
        'I only looked at the cloud icon on my laptop. I did not open my files in the browser or on my phone.',
      missedConsequence:
        "Without asking how she knows it works, the engineer accepts 'it looks fine' as proof, and the case closes on an assumption nobody has tested.",
      betterQuestion:
        "How have you checked that it's working now, and have you looked at your files anywhere other than your laptop?",
    },
    {
      id: 'hf-big-batch',
      importance: 'important',
      label: 'A very large batch of scans went into the folder',
      statement:
        "On the Monday I moved a whole year of scanned invoices into my work folder for the audit. There must have been thousands of them. I didn't think anything of it.",
      revealWhen:
        'Asks whether anything changed on her laptop or in her folder shortly before the files stopped, such as new files, a big move or a tidy-up.',
      intents: ['recent_changes'],
      hint: 'I did put a lot of scanned invoices in my folder before this started, though I doubt that matters.',
      statementTerse:
        'On Monday I moved a year of scanned invoices into my folder. Thousands of files.',
      statementSimple:
        'On Monday I moved one whole year of scanned invoices into my work folder for the audit. There were thousands of files. I did not think it was important.',
      byImpact: {
        medium: {
          statement:
            'On the Monday I moved a whole year of scanned invoices into my work folder for the audit, and two others on the team did the same with theirs. There must have been thousands of files between us. None of us thought anything of it.',
          statementTerse:
            'On Monday three of us moved a year of scanned invoices into our folders. Thousands of files.',
          statementSimple:
            'On Monday I moved one whole year of scanned invoices into my work folder for the audit. Two other people on the team did the same. There were thousands of files. We did not think it was important.',
        },
        high: {
          statement:
            'On the Monday I moved a whole year of scanned invoices into my work folder for the audit, and so did most of finance and purchasing. There must have been tens of thousands of files between us. Nobody thought anything of it.',
          statementTerse:
            'On Monday most of finance and purchasing moved a year of scanned invoices into their folders. Tens of thousands of files.',
          statementSimple:
            'On Monday I moved one whole year of scanned invoices into my work folder for the audit. Most of finance and purchasing did the same. There were tens of thousands of files. Nobody thought it was important.',
        },
      },
      missedConsequence:
        'The only clue to what was happening stays hidden, so the explanation becomes a guess and Ingrid still does not understand what happened or whether she did something wrong.',
      betterQuestion:
        'Did anything change on your laptop or in your folder shortly before the files stopped syncing, like new files, a big move or a tidy-up?',
    },
    {
      id: 'hf-month-end-worry',
      importance: 'important',
      minDifficulty: 'standard',
      availableAfterTurn: 2,
      requiresImpactAck: true,
      label: 'Month-end is close and she fears a repeat',
      statement:
        "What worries me is that month-end close is this Friday. If the files stop again then, I'd be stuck, and I wouldn't know what to do or who to ring.",
      revealWhen:
        'Asks whether anything is coming up where it matters most that the files work, or what she would do if the files stopped again.',
      intents: ['urgency_deadline', 'business_impact'],
      cues: [
        'month end',
        'month-end',
        'coming up',
        'this week',
        'deadline',
        'happens again',
        'stops again',
        'if it stops',
        'what would you do',
        'next few days',
      ],
      statementTerse: "Month-end close is this Friday. If it stops again, I'm stuck.",
      statementSimple:
        'Month-end close is this Friday. If the files stop again, I will be stuck. I would not know who to call.',
      byImpact: {
        medium: {
          statement:
            'What worries me is that month-end close is this Friday. If the files stop again then, all three of us would be stuck, and none of us would know what to do or who to ring.',
          statementTerse:
            'Month-end close is this Friday. If it stops again, all three of us are stuck.',
          statementSimple:
            'Month-end close is this Friday. If the files stop again, all three of us will be stuck. None of us would know who to call.',
        },
        high: {
          statement:
            'What worries me is that month-end close is this Friday. If the files stop again then, the whole of finance and purchasing would be stuck, and nobody would know what to do or who to ring.',
          statementTerse:
            'Month-end close is this Friday. If it stops again, finance and purchasing are stuck.',
          statementSimple:
            'Month-end close is this Friday. If the files stop again, all of finance and purchasing will be stuck. Nobody would know who to call.',
        },
      },
      missedConsequence:
        'Ingrid ends the call still worried and with no plan for the busiest days of her month, so a small repeat becomes a new complaint.',
      betterQuestion:
        'Is there anything coming up in the next few days where it matters most that your files are working?',
    },
    {
      id: 'hf-manager-away',
      importance: 'helpful',
      minDifficulty: 'challenge',
      availableAfterTurn: 3,
      label: 'Her manager is away from tomorrow',
      statement:
        "Mattias, my manager, is away from tomorrow for a week. Anything I need to check with him has to be today, or I'll be on my own.",
      revealWhen:
        'Asks about her manager, who else needs to know it is fixed, or whether anyone else is waiting on those files.',
      intents: ['affected_scope', 'urgency_deadline'],
      cues: [
        'mattias',
        'your manager',
        'who else needs',
        'who else is waiting',
        'anyone waiting',
        'anyone else need',
      ],
      statementTerse: 'Mattias, my manager, is away from tomorrow for a week.',
      statementSimple:
        'My manager, Mattias, is away from tomorrow for one week. I must check with him today. After that I am alone.',
      missedConsequence:
        'The chance to settle things with her manager before he leaves is lost, and Ingrid has to handle it alone while he is away.',
      betterQuestion:
        "Who else needs to know it's working, and is anyone away or waiting on those files?",
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-broke-it',
      statement: 'I think I might have broken it myself when I tidied up my folders last week.',
      truth:
        'Tidying her folders did not break anything. Moving a very large batch of scans into the folder kept syncing busy for days, and the files caught up once the laptop was left switched on.',
    },
  ],

  curveballs: [
    {
      id: 'cb-promise-it-wont-happen',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 4, latestTurn: 10, afterFact: 'hf-big-batch' },
      statement:
        "So can you promise it won't do this again? I really don't want to go through that again.",
      followUp: "I just need to know it's sorted for good. Can you say that?",
      expectedResponse:
        'Do not promise it will never happen again. Say honestly that nobody can guarantee that, say what you can commit to, and explain in plain words what she should do and who to contact if the files stop updating again.',
      minDifficulty: 'starter',
      effects: { temperature: 4, patience: -3 },
    },
    {
      id: 'cb-another-folder',
      type: 'change-issue',
      trigger: { earliestTurn: 5, latestTurn: 10 },
      statement:
        "While I've got you, there's one more thing. A shared folder from the purchasing team isn't showing on my laptop at all. Is that the same problem?",
      followUp: "I don't want to leave it, because I need that folder next week.",
      introducesFacts: [
        {
          id: 'kf-shared-folder',
          text: "The folder is one the purchasing team shared with me a while ago. It's not on my laptop, but I can see it when I use the browser.",
          intents: ['problem_description', 'affected_scope'],
          simple:
            'The purchasing team shared a folder with me. It is not on my laptop. I can see it in the browser.',
        },
      ],
      expectedResponse:
        'Acknowledge it without dismissing it, ask what she sees, and say honestly whether it looks related. Agree how it will be dealt with, for example by logging it separately, rather than letting it slide, and do not promise a fix before it is understood.',
      minDifficulty: 'standard',
      effects: { temperature: 3, patience: -3 },
    },
  ],
  allowedCurveballs: ['unsupported-guarantee', 'change-issue'],

  expectedDiscoveryAreas: [
    'How she knows it is working now',
    'What she did while it was not working',
    'Anything that changed before it stopped',
    'What she remembers from the last call',
    'Upcoming deadlines and worries',
  ],
  successCriteria: [
    'Greets Ingrid, confirms why she called and what she expects from the call.',
    'Confirms the files really are working by asking what she has checked, rather than assuming it from the icon.',
    'Gives a short explanation of what changed in plain words, without jargon and without blaming her, and is honest about what is not known.',
    'Asks whether anything is still worrying her and finds the second copy of the workbook before closing.',
    'Does not promise it will never happen again, and agrees what she should do and who to contact if it does.',
    'Summarises, checks she is comfortable, and closes the case politely.',
  ],
  coachingFocus: ['closing', 'clarity', 'scoping-discovery'],
  careExpectations: {
    communicate: [
      'Explains what changed in two or three plain sentences, avoids jargon, and checks that Ingrid has understood before moving on.',
      'Finishes with a short summary of the outcome and of what happens next.',
    ],
    accountable: [
      'Does not close the case until Ingrid has said what she has checked and has no worries left open.',
      'Says what will be recorded on the case, and what Ingrid should do and who she should contact if the files stop updating again.',
    ],
    resourceful: [
      'Asks how she has verified the syncing and suggests one simple way to confirm that the latest changes are in the online copy.',
      'Uses what she says about the big batch of scans and the emailed copy to explain the likely cause and the practical risk, without guessing beyond it.',
    ],
    empathetic: [
      'Reassures her that nothing she did caused the problem, and acknowledges the worry about month-end.',
      'Stays patient with a chatty, non-technical customer and lets her finish before steering the call.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Closing the case as soon as she says it looks fine, without asking how she knows or whether anything is still bothering her.',
    'Explaining the cause with technical terms, or suggesting that she caused it.',
    'Promising that the problem will never come back.',
    'Rushing her or cutting across her stories, which makes a chatty customer less likely to mention what worries her.',
    'Listing steps for her to check without saying why or confirming she can follow them.',
  ],
  goodBehaviours: [
    'Confirming why she called and what she hopes to get from the call.',
    'Asking how she has checked that the files are working, and whether she has looked anywhere other than her laptop.',
    'Asking what changed before the files stopped and what she did in the meantime.',
    'Explaining what changed in plain words and saying plainly what is not known.',
    'Agreeing what she will do if it happens again and who she should contact.',
    'Summarising and checking she is comfortable before closing.',
  ],
  expectedOutcome:
    'Ingrid knows her files are updating because she has checked them beyond the icon, understands that a very large batch of files kept syncing busy and that nothing she did was wrong, has a plan for the two copies of the workbook, knows what to do if it happens again, and agrees to close the case.',
  evaluatorNotes:
    'Root cause (a plausible story, not a product claim): on the Monday Ingrid moved a year of scanned invoices into her work folder, syncing was busy with them for days, and her month-end workbook did not show up online until the laptop was left switched on, as an engineer advised on Thursday. Nothing she did was wrong. Still open: she emailed the workbook to her manager, who has edited that copy, and she has only checked the cloud icon on her own laptop. A strong call confirms the fix with evidence, explains in plain words without blame or guessing, finds the second copy, avoids promising it will not recur, and closes with a clear summary.',
} satisfies ScenarioInput;

export default scenario;
