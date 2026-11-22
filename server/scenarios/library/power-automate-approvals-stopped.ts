import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario, set as a follow-up call. Everything here is fictional: people, organisation and
// case number.
//
// Root cause (hidden from the trainee; plausible, and never confirmed on the call): the manuscript
// approval process uses a SharePoint connection under Mira's sign-in. A few weeks ago she moved to
// the marketing team and her access to the editorial team's shared sites was removed, so requests
// stopped and no one else is looking after the process. The contracts approval process, built by
// Tove, still runs.
// Joseph does not know what the tools are called, did not build the process and has never opened
// it. A strong call is gentle and plain: it reads the case history first, asks one question at a
// time, finds the builder and the move, avoids jargon, owns the case, and agrees who contacts Mira
// and by when, with a time for the next update.

const scenario = {
  id: 'power-automate-approvals-stopped',
  version: 1,
  title: 'An approval process that used to run by itself has stopped',
  shortTitle: 'Approvals stopped running',
  listSummary:
    'An editorial assistant says an approval process that used to run by itself has stopped.',
  summary:
    'An editorial assistant reports that an approval process that used to run by itself has stopped, and he is worried about sign-off. He is polite but vague about what it is called and how it works. Help him describe it simply and agree who will look after it.',
  tags: ['automation', 'approvals', 'follow-up', 'plain language', 'ownership'],
  estimatedMinutes: 9,

  product: { id: 'power-platform', area: 'Automated flows' },
  caseReference: 'SIM-430002',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    revisedOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-learn'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    review: 'assistant-reviewed',
    notes:
      "Checked on 22 Nov 2026 against current public Microsoft Learn pages on approval workflows, connection failures, sharing a flow and changing its owner. Terms current; low-impact text made neutral so it no longer gives away the workaround. AI-assisted review, not a mentor's.",
  },

  issueType: 'feature-not-working',
  impact: 'medium',
  startingTemperature: 'calm',
  proficiency: 'novice',
  style: 'vague',
  callStage: 'follow-up',
  difficulty: 'starter',

  persona: {
    name: 'Joseph Adeyemi',
    speaker: 'male',
    role: 'Editorial Assistant',
    organisation: 'Lucerne Publishing',
    background:
      'Joseph joined the editorial team a few months ago and keeps the manuscript tracking list up to date. He uses the approval process every day but did not build it and has never opened the tool behind it. He is conscientious and does not like to bother people, so he tends to wait before asking for help.',
    voice:
      "Polite, soft-spoken and a little unsure. Describes things loosely, such as 'the approvals thing' or 'the automatic emails', and mixes up tool names like Power Apps, Power Automate and Teams. Apologises for not being technical. Gets specific when asked one simple question at a time.",
  },
  environment: {
    details: [
      'Lucerne Publishing keeps a shared list of manuscripts. Each new entry used to trigger an approval request to a commissioning editor automatically.',
      'Once an editor approved an entry, its status updated and the production team was told, without anyone doing it by hand.',
      'Joseph adds the entries and chases approvals. He did not build the process and has never opened the tool behind it.',
      'A colleague built the process last year. A second approval process, for contracts, was built by someone else and still runs.',
      'Joseph names the tools loosely and often mixes them up.',
    ],
  },
  affectedUsers: {
    low: {
      count: 1,
      summary: 'Joseph is the only person adding new entries, and he sends requests by hand.',
    },
    medium: {
      count: 8,
      summary:
        'Four commissioning editors and three production colleagues wait on requests, plus Joseph.',
    },
    high: {
      count: 20,
      summary: 'The whole editorial and production team, about twenty people, waits on approvals.',
    },
  },
  customerObjective:
    'Get the approvals running by themselves again, or at least know who is looking after it and when it will be back.',
  customerExpectation:
    'Someone to take the case on, explain in plain words what is going on, and tell him what happens next and when.',
  desiredOutcome:
    'The engineer reads the case history, helps Joseph describe the process in his own words, finds who built it and who could look after it now, and agrees who does what next and when the next update comes.',
  previousTroubleshooting: [
    'Joseph checked that new entries are still being added to the list as normal.',
    'He has been emailing the commissioning editors himself each time he adds an entry.',
    'He has not opened the tool behind the process, because he did not build it.',
  ],
  recentChanges: [
    'The colleague who built the process moved to the marketing team a few weeks ago.',
    "The colleague who built the process was taken off the editorial team's shared sites when they moved.",
  ],

  publicBrief: {
    issue:
      'An approval process that used to run by itself has stopped, and Joseph is worried about sign-off.',
    impact: {
      low: 'Joseph is the only person adding new entries and is doing extra work.',
      medium: 'Several editors are not getting requests, so manuscripts are waiting for sign-off.',
      high: 'The whole editorial schedule is waiting on approvals, and authors are asking questions.',
    },
    objective:
      'Understand what he is describing in plain words, own the case, and agree who does what next.',
    knownContext:
      'Joseph is an editorial assistant, not a technical user. He may name the tools loosely, so check what he means.',
    environment:
      'Lucerne Publishing uses Power Platform to automate its manuscript approvals. You cannot see their setup in this practice call.',
  },
  brief: {
    situation:
      'An editorial assistant is calling about an approval process that used to run by itself and has stopped. He is worried about sign-off. He is polite, a little unsure, and vague about how the process works or what it is called.',
    goal: 'Help him describe the problem in plain words, take ownership of the case, and agree clearly what happens next and when he will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see the process in this practice call, so rely on what Joseph tells you.',
      'Joseph is not a technical user, so use plain words.',
    ],
  },

  openingCore:
    "The approvals thing for our manuscripts has stopped working. It used to send everything out by itself, and now it doesn't.",
  impactVariants: {
    low: {
      summary: "It's mostly just me so far, and I'm finding a way to keep things moving.",
      detail:
        "I'm the only one adding new entries. Nothing is stuck yet, but keeping things moving takes a while.",
      deadline: "No hard deadline, but I'd like it working before the next batch comes in.",
    },
    medium: {
      summary:
        "Our editors aren't getting their approval requests, so a few manuscripts are waiting for sign-off.",
      detail:
        "Four commissioning editors normally get the requests, and three people in production wait for the sign-offs, so it's about eight of us. A few manuscripts for the spring list are waiting, and I'm chasing people by email.",
      deadline: 'The spring list meeting is on Friday, and they want those signed off before it.',
    },
    high: {
      summary:
        'Nothing is getting signed off, and authors have started to ask where their manuscripts are.',
      detail:
        "Every manuscript needs a sign-off before it goes to production, and none are moving. It's the whole editorial and production team, about twenty of us, and a printing slot is booked for next week.",
      deadline: "The printer's slot can't move, so we need approvals flowing again by Monday.",
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm calling about the approvals thing for our manuscripts, the case I opened last week. I got an email with some questions, but I wasn't sure how to answer, so I thought I'd ring.",
      brief:
        'Joseph opened this case last week. Support emailed him some questions about the process, and he has not replied.',
    },
    escalated: {
      opening:
        'This is my second call about the approvals thing for our manuscripts. I was told someone would look into it.',
      brief:
        'Joseph has been in touch twice about this. The approvals are still not running, and he feels he is getting nowhere.',
    },
    closure: {
      opening:
        "I'm calling about the approvals thing for our manuscripts, to see where things have got to so you can close my case.",
      brief:
        'Joseph expects to confirm that the approvals run by themselves again and to understand what changed.',
    },
  },
  priorHistory: [
    {
      when: 'Last week',
      summary:
        'Joseph opened a case saying an approval process had stopped sending requests by itself. An automatic acknowledgement was sent.',
    },
    {
      when: 'A few days later',
      summary:
        'A support engineer emailed to ask what the process is called and who built it. No reply has been received.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-calls-it',
      text: "I just call it the approvals thing. I don't really know what it's called.",
      intents: ['problem_description', 'environment'],
      simple: 'I call it the approvals thing. I do not know its real name.',
    },
    {
      id: 'kf-what-it-did',
      text: "It's for our manuscripts. When I add a new one to the list, a request used to go to the commissioning editor by itself.",
      intents: ['problem_description'],
      elaboration:
        'Then, when the editor said yes, the list updated and production got an email. I never had to do any of it.',
      simple:
        'When I add a new manuscript, a request went to the editor by itself. Now it does not.',
    },
    {
      id: 'kf-did-not-build',
      text: "I didn't build it. I just use it, and I've never opened whatever it runs in.",
      intents: ['account_details', 'environment'],
      simple: 'I did not build it. I only use it. I have never opened it.',
    },
    {
      id: 'kf-spring-list',
      text: "We're working on the spring list at the moment, so there are a lot of manuscripts going through.",
      intents: ['business_impact'],
    },
    {
      id: 'kf-outcome',
      text: "I'd like it to just run by itself again, like it used to. And I'd like to know who to ask next time.",
      intents: ['expected_outcome'],
      simple: 'I want it to run by itself again. I want to know who to ask next time.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-last-worked',
      intents: ['timing_onset'],
      text: "I think it last worked about three weeks ago. Maybe a bit more? I'd have to look at my emails to be sure.",
      confirmedText:
        'Looking back, the last request that went out by itself was for the poetry collection, about three weeks ago.',
    },
    {
      id: 'vf-tool-name',
      intents: ['environment'],
      cues: [
        'which tool',
        'what tool',
        'which app',
        'what app',
        'power apps',
        'power automate',
        'what is it called',
        'what it is called',
      ],
      text: "I think it's in Power Apps, or maybe it's part of Teams. I always mix them up.",
      confirmedText:
        "Now you say it, I think someone called it a flow once. So maybe it's Power Automate.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-how-built',
      intents: ['environment', 'already_tried'],
      cues: [
        'how is it built',
        'how was it built',
        'how does it work',
        'how it works',
        'where does it run',
        'where it runs',
        'run history',
        'open the process',
      ],
      text: "I don't know how it's built or where it runs. I've never opened it.",
      whoKnows: 'the person who built it',
    },
    {
      id: 'uf-admin',
      intents: ['account_details'],
      cues: [
        'administrator',
        'admin',
        'it team',
        'it department',
        'licence',
        'license',
        'permissions',
      ],
      text: "I don't know who our administrator is for this sort of thing. I'd only be guessing.",
      whoKnows: 'our IT team',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-poetry',
      text: "We've got a lot of poetry on the spring list this year, which is nice.",
    },
    {
      id: 'if-new-here',
      text: "I only moved to the editorial team a few months ago, so I'm still learning where things are.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-builder-moved',
      importance: 'critical',
      label: 'The person who built it has moved teams',
      statement:
        'Mira built it last year, and she moved to the marketing team a few weeks ago. As far as I know, nobody took it over when she went.',
      revealWhen: 'Asks who built or set up the process, who looks after it now, or who owns it.',
      intents: ['account_details', 'recent_changes'],
      cues: [
        'who built',
        'who set',
        'who made',
        'who created',
        'who owns',
        'who looks after',
        'who manages',
        'who runs',
        'owner',
        'built it',
        'created it',
        'maker',
      ],
      hint: "A colleague set it up originally, so I don't really know how it works.",
      statementTerse:
        "Mira built it. She moved to the marketing team a few weeks ago. I don't think anyone took it over.",
      statementSimple:
        'My colleague Mira built it last year. She moved to the marketing team a few weeks ago. I think nobody took it over when she went.',
      missedConsequence:
        'Without knowing who built it and that she has moved, the engineer cannot work out who can open or fix the process, and the case stays without an owner.',
      betterQuestion: 'Who set this process up, and is that person still looking after it?',
    },
    {
      id: 'hf-only-this-process',
      importance: 'important',
      label: 'Only the manuscript process stopped',
      statement:
        "It's only the manuscript approvals that stopped. The contracts approvals, which Tove built, still run fine.",
      revealWhen:
        'Asks whether other automatic processes or approvals still work, or whether everything has stopped or only this one process.',
      intents: ['affected_scope', 'reproducibility'],
      cues: [
        'other process',
        'other approvals',
        'other flows',
        'other automatic',
        'others still',
        'anything else stopped',
        'anything else affected',
        'anything else not working',
        'still working',
        'still work',
        'only this',
        'just this',
      ],
      hint: 'Some of our other automatic things seem fine.',
      statementTerse: 'Only the manuscript one stopped. The contracts approvals still run.',
      statementSimple:
        'Only the manuscript approvals stopped. The contracts approvals still work. A colleague called Tove built those.',
      missedConsequence:
        'The engineer cannot tell a problem with this one process from a wider outage, and may raise the wrong alarm or look in the wrong place.',
      betterQuestion:
        'Are your other automatic approvals still working, or has everything stopped?',
    },
    {
      id: 'hf-nothing-happens',
      importance: 'important',
      label: 'What he sees when he adds a manuscript',
      // Once the approvals run again (a closure call) this is no longer what he sees.
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement:
        "Whenever I put a new manuscript on the list, nothing happens. The status stays blank and no request goes to the editors. I don't see any error.",
      revealWhen:
        'Asks what happens when a new manuscript is added, what the customer sees, or whether there is any error or message.',
      intents: ['error_message', 'reproducibility'],
      cues: [
        'what happens when',
        'what do you see',
        'what you see',
        'error',
        'message',
        'when you add',
        'when you submit',
        'new manuscript',
        'new entry',
        'new row',
        'status',
        'try it',
      ],
      knowledge: 'after-checking',
      checking: "Hold on, I'll open the list and have a look.",
      hint: "It doesn't show me an error, it just goes quiet.",
      statementTerse: "Nothing happens when I add one. The status stays blank. There's no error.",
      statementSimple:
        'When I put a new manuscript on the list, nothing happens. The status stays blank. No request goes to the editors. I do not see an error.',
      missedConsequence:
        'The exact symptom stays vague, so the engineer cannot tell whether requests fail, never start or go somewhere else, and has less to pass on.',
      betterQuestion:
        'What do you see on the list when you add a new manuscript, and is there any message?',
    },
    {
      id: 'hf-access-removed',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Her access to the team sites was removed',
      statement:
        "Mira told me IT took her off our team's shared sites when she moved. I don't know if that matters.",
      revealWhen:
        'Asks whether anything changed recently around the person who built the process, such as access, accounts or permissions.',
      intents: ['recent_changes', 'account_details'],
      cues: [
        'access',
        'permission',
        'removed',
        'her account',
        'left the team',
        'moved teams',
        'changed team',
        'get into',
        'sign in',
        'sign-in',
        'shared sites',
        'taken off',
      ],
      statementTerse:
        "Mira said IT took her off our shared sites when she moved. I don't know if it matters.",
      statementSimple:
        'Mira told me IT took her off our team sites when she moved. I do not know if this matters.',
      missedConsequence:
        "The most plausible link between the colleague's move and the stopped process is missed, so the next step stays a guess.",
      betterQuestion:
        'Did anything change around the person who built it, such as their team or what they can get into?',
    },
    {
      id: 'hf-builder-reachable',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'Mira can still be reached',
      statement:
        'Mira is still here, in the marketing team on the floor above. She said I could ask her anything about it.',
      revealWhen:
        'Asks whether the person who built the process can still be reached, or whether anyone could explain how it works.',
      intents: ['account_details', 'workaround'],
      cues: [
        'mira',
        'contact her',
        'reach her',
        'ask her',
        'speak to her',
        'still at',
        'still here',
        'still with',
        'still around',
        'still in the company',
        'where is she',
        'new team',
      ],
      statementTerse: 'Mira is still here, in marketing upstairs. She said to ask her anything.',
      statementSimple:
        'Mira still works here. She is in the marketing team upstairs. She said I can ask her anything about it.',
      missedConsequence:
        'The quickest route to understanding how the process was built goes unused, and the engineer may send Joseph down a longer path.',
      betterQuestion:
        'Can the person who built it still be reached, and would she be able to explain how it works?',
    },
    {
      id: 'hf-by-hand',
      importance: 'helpful',
      minDifficulty: 'challenge',
      label: 'Sending requests by hand, and missing some',
      statement:
        "I've been emailing the commissioning editors myself each morning with the new titles. It takes a while, and I'm sure I've missed a couple.",
      byImpact: {
        low: {
          statement:
            "Whenever I add a title, I send the editor a message by hand. It's slow, and I can't be sure I haven't forgotten one.",
          statementTerse:
            "I send the editor a message by hand each time. It's slow, and I might have forgotten one.",
          statementSimple:
            'Each time I add a title, I send the editor a message myself. It takes time. I am not sure I did not forget one.',
        },
        high: {
          statement:
            "I've been emailing all the editors and production myself each morning with the new titles. It takes most of an hour, and I'm sure I've missed quite a few.",
          statementTerse:
            "I email all the editors and production myself each morning. It takes most of an hour, and I've missed quite a few.",
          statementSimple:
            'Every morning I send an email to all the editors and to production myself. It takes most of an hour. I think I missed quite a few.',
        },
      },
      revealWhen:
        'Asks how the customer is coping in the meantime, or whether there is a workaround.',
      intents: ['workaround'],
      statementTerse:
        "I email the editors myself each morning. It's slow, and I've probably missed a couple.",
      statementSimple:
        'I send an email to the editors myself every morning with the new titles. It takes time. I think I missed some.',
      missedConsequence:
        'The engineer does not learn that new titles may already have been missed, so the cost of waiting is never raised and nobody checks for gaps.',
      betterQuestion:
        'Is there anything you are doing by hand in the meantime, and could anything have slipped through?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-nobody-touched',
      statement: 'Nobody here has touched it, so I think Microsoft must have changed something.',
      truth:
        'Nothing is confirmed on the Microsoft side. Something did change at Lucerne: the person who built the process moved teams, even though nobody edited the process itself.',
    },
  ],

  curveballs: [
    {
      id: 'cb-goes-quiet',
      type: 'go-silent',
      trigger: { earliestTurn: 5, latestTurn: 9, whenOwnershipUnclear: true },
      statement:
        "Sorry... I'm not sure what that means. I don't want to give you the wrong answer.",
      followUp: "Sorry. I'm still here. I just don't know if I'm the right person to ask.",
      expectedResponse:
        'Notice that he has gone quiet, slow down, and check gently in plain words what he did not follow. Rephrase without jargon, ask one simple question at a time, and reassure him that not knowing is fine.',
      minDifficulty: 'starter',
    },
    {
      id: 'cb-end-of-week-deadline',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 8, whenImpactUnacknowledged: true },
      statement:
        'I should have said. My manager has asked me whether this will be working by the end of the week. What should I tell her?',
      followUp: "She's asked again. Can I tell her it will be working by then?",
      expectedResponse:
        'Acknowledge the pressure from his manager, be honest that you cannot promise it will be working by then, and give him something he can pass on: what you will do first and when he will hear from you next.',
      minDifficulty: 'standard',
    },
  ],
  allowedCurveballs: ['go-silent', 'deadline'],

  expectedDiscoveryAreas: [
    'What the process did and what it does now',
    'Who built it and who looks after it',
    'When it last worked',
    'Whether other automatic processes still run',
    'What changed recently',
    'How the team is coping in the meantime',
  ],
  successCriteria: [
    'Reads the case history, greets Joseph by name and does not make him repeat what is already on the case.',
    'Asks one simple question at a time and checks what Joseph means by the names he uses.',
    'Finds out who built the process, when it last worked and what changed around that time.',
    'Tells him honestly what is and is not known, and does not blame the colleague who moved teams.',
    'Takes ownership, agrees who needs to be involved and by when, and gives a specific time for the next update.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity', 'ownership-next-steps'],
  careExpectations: {
    communicate: [
      'Uses plain words, explains any term the first time it is used, and checks that Joseph has followed.',
      'Asks one simple question at a time rather than a list.',
    ],
    accountable: [
      'Takes the case on, says what happens next and by when, and does not leave Joseph to chase.',
    ],
    resourceful: [
      'Reads the history first and uses what is already known, then asks how the process is used day to day.',
      "Works out who built or owns the process and who could help from Lucerne's side.",
    ],
    empathetic: [
      'Reassures Joseph that not knowing the names or how it is built is fine, without making him feel at fault.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    "Using terms such as 'flow owner', 'connection' or 'run history' without explaining them.",
    'Asking Joseph to open the tool behind the process or to read out settings he has never seen.',
    'Asking several questions at once, so that Joseph loses track.',
    "Treating the unanswered email as Joseph's fault.",
    'Telling him to ask the colleague who built it, and leaving it there.',
  ],
  goodBehaviours: [
    'Starting with what is already on the case, then asking Joseph to describe in his own words what used to happen.',
    "Checking what he means by 'the approvals thing' and the tool names he uses.",
    'Asking who built it and who looks after it now.',
    'Asking whether other automatic processes still run.',
    'Giving him something simple he can tell his manager, with a time for the next update.',
  ],
  expectedOutcome:
    'Joseph understands what is known and what happens next: the process had one builder who has moved teams, so the engineer owns the case, agrees who at Lucerne must be involved and by when, and gives a specific time for the next update.',
  evaluatorNotes:
    "Root cause (plausible, not confirmed on the call): the approval process uses a SharePoint connection under Mira's sign-in. After she moved, her editorial-site access was removed and requests stopped. No one else is looking after it. Only the manuscript process is affected; the contracts one, built by Tove, still runs. A strong call is gentle and plain: it reads the history, asks one question at a time, finds the builder and the move, avoids jargon, owns the case, agrees who contacts Mira and by when, and gives a time for the next update.",
} satisfies ScenarioInput;

export default scenario;
