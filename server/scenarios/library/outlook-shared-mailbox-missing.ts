import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario. Everything here is fictional: people, organisation and case. Outlook is a real
// product, so the scenario describes only what the customer sees and was told, never how Outlook works.
//
// Root cause in the story (hidden from the trainee): while Marcus was on leave for three weeks, the
// office manager tidied the access lists for the shared mailboxes and his name was left off, so the
// Cellar Door Bookings mailbox no longer appears in his Outlook. Jen, who stayed in the office, can
// still see it and has been sending him the urgent enquiries. Nothing is wrong with his Outlook.
// Hidden facts that depend on how many people lost the mailbox (who can still see it, who was away,
// who covers) carry byImpact wordings for medium (five people) and high (seventeen), matching
// affectedUsers and impactVariants.detail.
//
// Marcus is calm, brief and not technical. A strong call uses everyday words, finds the timing, the
// colleague who can still see it and the access tidy-up with simple questions, does not blame Outlook
// or promise a time, and agrees who will act and when Marcus will hear next.

const scenario = {
  id: 'outlook-shared-mailbox-missing',
  version: 1,
  title: 'Shared team mailbox missing from Outlook',
  shortTitle: 'Shared mailbox missing',
  listSummary:
    "An office coordinator cannot see his team's shared mailbox in Outlook and wants it back.",
  summary:
    'Marcus Bell coordinates the office at Coho Winery. The shared mailbox his team uses for visitor and tasting enquiries is no longer listed in his Outlook. Find out what he sees, explain things in plain words and agree what happens next.',
  tags: ['shared mailbox', 'access', 'plain language', 'short answers'],
  estimatedMinutes: 8,

  product: { id: 'outlook', area: 'Shared mailbox' },
  caseReference: 'SIM-410002',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    revisedOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-learn', 'microsoft-support'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    review: 'assistant-reviewed',
    notes:
      "Checked on 22 Nov 2026 against current public pages on creating a shared mailbox, removing automapping and shared mailbox settings in new Outlook. Terms and story are plausible; one coaching line corrected. AI-assisted review, not a mentor's.",
  },
  issueType: 'permissions',
  impact: 'low',
  startingTemperature: 'calm',
  proficiency: 'novice',
  style: 'terse',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Marcus Bell',
    speaker: 'male',
    role: 'Office Coordinator',
    organisation: 'Coho Winery',
    background:
      'Marcus keeps the office running at a family winery: post, supplies, rotas and the visitor bookings inbox. He uses Outlook every day for mail and his calendar but has never thought about how it is set up. He is polite and patient, and not at ease with technical words.',
    voice:
      'Calm, polite and brief. Answers what he is asked in a few words and adds nothing unless asked. Describes what he sees in everyday words, not product names, and says so if a word confuses him. Relaxed about the problem; warms up when things are explained simply.',
  },
  environment: {
    details: [
      'Marcus uses Outlook on a work computer in the winery office, for mail and his calendar.',
      'The visitor team shares one mailbox, called Cellar Door Bookings, for tasting bookings and visitor enquiries.',
      'Jen, a colleague on the visitor team, works from the same shared mailbox.',
      'The office manager looks after access for the shared mailboxes. Marcus does not.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Marcus only, as far as he knows.' },
    medium: {
      count: 5,
      summary: 'Five people who were left off the access list, so enquiries are building up.',
    },
    high: {
      count: 17,
      summary: 'Seventeen people on the visitor and events teams; weekend bookings go unanswered.',
    },
  },
  customerObjective:
    'See the Cellar Door Bookings shared mailbox in his Outlook again, so he can help with the visitor enquiries.',
  customerExpectation:
    'Someone who explains in plain words what is going on, tells him what he needs to do, if anything, and says when it should be back.',
  desiredOutcome:
    'Marcus understands in plain words that this looks like a change to who has access, knows who will arrange it and roughly when he will hear, and has agreed how to check that the mailbox is back.',
  previousTroubleshooting: [
    'Marcus closed and reopened Outlook and restarted the computer. The mailbox is still not listed.',
  ],
  recentChanges: [
    'Marcus was away on leave for three weeks and came back on a Monday. The mailbox was in his list before he left.',
    'While he was away the office manager tidied the access lists for the shared mailboxes.',
  ],

  publicBrief: {
    issue: 'Marcus cannot see the shared team mailbox in his Outlook.',
    impact: {
      low: 'Some visitor enquiries are waiting, but nothing is urgent.',
      medium: 'Visitor enquiries are building up and people are waiting for replies.',
      high: 'Weekend tasting bookings are going unanswered and visitors are noticing.',
    },
    objective: 'Explain things in plain words, find out what changed and agree what happens next.',
    knownContext:
      'Marcus Bell is an office coordinator at Coho Winery. He uses Outlook every day for mail and his calendar.',
    environment:
      'Marcus uses Outlook on a work computer. The visitor team shares one mailbox for tasting bookings and enquiries.',
  },
  brief: {
    situation:
      'An office coordinator is calling because a shared team mailbox is no longer listed in his Outlook. He uses Outlook every day but does not manage how it is set up.',
    goal: 'Understand what he sees, explain things in everyday words, and agree what happens next and when he will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'Ask questions to find out what you need; he answers briefly and will not volunteer much.',
      'You cannot see his mailbox in this practice call, so rely on what he tells you.',
    ],
  },

  openingCore:
    "The team's shared mailbox isn't showing in my Outlook any more. I can't find it in my list.",
  impactVariants: {
    low: {
      summary: "It's not urgent, but I can't help with the enquiries.",
      detail:
        "As far as I know it's just me. I can't help with the daily booking enquiries until I can see it again, and I'm falling behind.",
      deadline: "There's no rush today, but it would be good to have it back this week.",
    },
    medium: {
      summary: "Enquiries are building up, and we've got visitors waiting for replies.",
      detail:
        "There are five of us who can't see it. Booking enquiries are piling up, and some visitors have emailed twice already.",
      deadline: "We'd like it sorted today, before the evening rush of enquiries.",
    },
    high: {
      summary:
        'The weekend tasting bookings are going unanswered, and visitors are starting to notice.',
      detail:
        "Seventeen of us can't see it, and this is our busiest weekend of the harvest. We can't confirm bookings, and people have started phoning the cellar door.",
      deadline: 'We need it back before the weekend bookings close tomorrow.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening: "I rang yesterday about the shared mailbox, and I haven't heard anything since.",
      brief:
        'Marcus called yesterday about the missing shared mailbox. A case was logged and he has not had an update.',
    },
    escalated: {
      opening: "This is my second call about the shared mailbox, and it's still missing.",
      brief: 'Marcus has contacted support twice about the missing mailbox without a fix.',
    },
    closure: {
      opening: "I'm ringing to check I can see the shared mailbox again, so we can close the case.",
      brief:
        'Marcus expects to confirm that the mailbox is back and to understand what happened before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday',
      summary:
        'Marcus reported that the shared mailbox was missing from Outlook. A case was logged and no update has been sent.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: "It's not in my list any more. I don't get an error, it's just not there.",
      intents: ['problem_description', 'error_message'],
      elaboration: "I've looked a few times in case I'd missed it, but it's definitely not there.",
      simple: 'It is not in my list any more. There is no error. It is just not there.',
    },
    {
      id: 'kf-which-mailbox',
      text: "It's called Cellar Door Bookings. It's the one we all use for tasting bookings and visitor enquiries.",
      intents: ['problem_description', 'environment'],
      simple:
        'It is called Cellar Door Bookings. We use it for tasting bookings and visitor questions.',
    },
    {
      id: 'kf-computer',
      text: "I use Outlook on my work computer in the office. It's the same one I always use.",
      intents: ['environment'],
      simple: 'I use Outlook on my work computer, at the office.',
    },
    {
      id: 'kf-own-mail-fine',
      text: "My own mail and calendar are fine. It's only the shared one that's missing.",
      intents: ['problem_description', 'affected_scope'],
      cues: [
        'anything else',
        'everything else',
        'other mailbox',
        'own mail',
        'calendar',
        'rest of',
      ],
      simple: 'My own mail and calendar work. Only the shared mailbox is missing.',
    },
    {
      id: 'kf-outcome',
      text: 'I just want to see it again so I can help with the enquiries.',
      intents: ['expected_outcome'],
      simple: 'I want to see the mailbox again. I want to help with the enquiries.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-how-appeared',
      intents: ['account_details', 'environment'],
      cues: [
        'how did it get',
        'how was it added',
        'who added',
        'who set it up',
        'added to your',
        'set up for you',
      ],
      text: "I never added it myself. I think it just appeared in my list when I started, but I couldn't say how.",
      confirmedText: 'It was there from my first week, so someone must have set it up for me.',
    },
  ],
  unknownFacts: [
    {
      id: 'uf-what-changed',
      intents: ['recent_changes'],
      cues: [
        'what exactly changed',
        'what was changed',
        'what did they change',
        'was i removed',
        'what did she change',
      ],
      text: "I don't know exactly what was changed, or whether it affected me. I wouldn't know where to look.",
      whoKnows: 'whoever looks after the shared mailboxes',
    },
    {
      id: 'uf-setup-details',
      intents: ['account_details', 'environment'],
      cues: ['how is it set up', 'how is it configured', 'what type', 'what kind of mailbox'],
      text: "I couldn't tell you how it's set up. I just open it and use it.",
      whoKnows: 'IT or the office manager',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-harvest',
      text: "We've got the harvest starting soon, so everyone's busy out in the cellar and the vineyard.",
    },
    {
      id: 'if-printer',
      text: 'The office printer has been jamming all week, which is a different headache.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-after-leave',
      importance: 'important',
      label: 'It went missing while he was on leave',
      statement:
        "It was there before I went on leave. I was away three weeks, and it wasn't in my list when I got back on Monday.",
      partialStatement: "It used to be there. It's only gone lately.",
      revealWhen:
        'Asks when the problem started, when he last saw the mailbox, or what happened just before it went missing.',
      intents: ['timing_onset'],
      partialIntents: ['problem_description'],
      hint: 'It was all there before I went away.',
      statementTerse: 'It was there before my leave. It was gone when I got back on Monday.',
      statementSimple:
        'It was there before my leave. I was away for three weeks. It was not there when I came back on Monday.',
      missedConsequence:
        'Without the timing, the engineer never learns that something changed while he was away and may suggest generic fixes for Outlook itself.',
      betterQuestion:
        'When did you last see the mailbox, and what had happened between then and now?',
    },
    {
      id: 'hf-colleague-sees',
      importance: 'important',
      label: 'A colleague can still see it',
      statement:
        "Jen can still see it in her Outlook. She stayed in the office the whole time, and she's been sending me the urgent ones.",
      revealWhen:
        'Asks whether anyone else can see the mailbox, whether others are affected, or whether there is any way to get at the enquiries in the meantime.',
      intents: ['affected_scope', 'workaround'],
      hint: 'I can only speak for my own Outlook.',
      statementTerse: 'Jen can still see it. She sends me the urgent ones.',
      statementSimple: 'Jen can still see the mailbox. She sends me the urgent emails.',
      byImpact: {
        medium: {
          statement:
            "Jen can still see it in her Outlook. She stayed in the office the whole time, and she's been passing the urgent ones on to us.",
          statementTerse: 'Jen can still see it. She passes the urgent ones on.',
          statementSimple: 'Jen can still see the mailbox. She passes the urgent emails on to us.',
        },
        high: {
          statement:
            "Jen can still see it, and so can a couple of others who stayed in the office. They're passing the urgent ones on, but they can't keep up.",
          statementTerse: "Jen and a couple of others can still see it. They can't keep up.",
          statementSimple:
            'Jen and two other people can still see the mailbox. They pass on the urgent emails, but they cannot keep up.',
        },
      },
      missedConsequence:
        'The engineer never learns that some colleagues can still see it, so it sounds like a general Outlook fault and enquiries keep depending on a few people.',
      betterQuestion:
        'Can anyone else on the team still see the mailbox, and how are the enquiries being handled for now?',
    },
    {
      id: 'hf-access-tidy',
      importance: 'critical',
      label: 'The access lists were tidied while he was away',
      statement:
        "Our office manager mentioned she'd been tidying up who has access to the shared mailboxes while I was off.",
      revealWhen:
        'Asks whether anything changed while he was away, or who looks after access to the shared mailboxes.',
      intents: ['recent_changes'],
      cues: [
        'changed',
        'anything change',
        'any changes',
        'anything new',
        'different',
        'access',
        'permission',
        'who looks after',
        'who manages',
        'who owns',
        'who gave you',
        'who set it up',
      ],
      hint: 'I think the office manager was doing something with the shared mailboxes.',
      statementTerse:
        'The office manager was tidying up who has access to the shared mailboxes while I was off.',
      statementSimple:
        'The office manager changed who can open the shared mailboxes. She did it while I was away.',
      byImpact: {
        medium: {
          statement:
            "Our office manager mentioned she'd been tidying up who has access to the shared mailboxes while some of us were off.",
          statementTerse:
            'The office manager was tidying up who has access to the shared mailboxes while some of us were off.',
          statementSimple:
            'The office manager changed who can open the shared mailboxes. She did it while some of us were away.',
        },
        high: {
          statement:
            "Our office manager mentioned she'd been tidying up who has access to the shared mailboxes while a lot of us were away.",
          statementTerse:
            'The office manager was tidying up who has access to the shared mailboxes while a lot of us were away.',
          statementSimple:
            'The office manager changed who can open the shared mailboxes. She did it while many of us were away.',
        },
      },
      missedConsequence:
        'The likely reason it vanished is never found, so he leaves without knowing who to ask and the case stays with Outlook instead of with whoever looks after access.',
      betterQuestion:
        'Did anything change while you were away, for example who has access to the shared mailbox?',
    },
    {
      id: 'hf-tried-restart',
      importance: 'helpful',
      label: 'He has already restarted things',
      statement:
        "I've closed Outlook and opened it again, and I've restarted the computer. It's still not there.",
      revealWhen: 'Asks what he has already tried to fix it.',
      intents: ['already_tried'],
      statementTerse: 'I restarted Outlook and the computer. Still not there.',
      statementSimple:
        'I closed Outlook and opened it again. I restarted the computer. The mailbox is still not there.',
      missedConsequence:
        'The engineer asks him to repeat steps he has already done, which wastes time and makes him feel unheard.',
      betterQuestion: 'What have you already tried, and what happened each time?',
    },
    {
      id: 'hf-cover-ends',
      importance: 'helpful',
      minDifficulty: 'challenge',
      label: 'Jen is away from Friday',
      statement:
        "Jen's off from Friday for a week, and she's the one covering for me. After that I don't know who'd cover.",
      revealWhen:
        'Asks whether there is a deadline, how long the team can cope as things are, or what happens if it is not sorted soon.',
      intents: ['urgency_deadline', 'business_impact'],
      cues: [
        'deadline',
        'how long can',
        'what happens if',
        'how urgent',
        'when do you need',
        'by when',
      ],
      statementTerse: "Jen's off from Friday for a week. Then nobody can cover.",
      statementSimple:
        'Jen is away from Friday for one week. After that I do not know who can cover.',
      byImpact: {
        medium: {
          statement:
            "Jen's off from Friday for a week, and she's the one covering for the five of us. After that I don't know who'd cover.",
          statementTerse: "Jen's off from Friday for a week. Then nobody can cover us.",
          statementSimple:
            'Jen is away from Friday for one week. She covers for the five of us. After that I do not know who can cover.',
        },
        high: {
          statement:
            "Jen's off from Friday for a week, and she's covering for all of us. After that I don't know who'd cover.",
          statementTerse: "Jen's off from Friday for a week. Then nobody can cover us.",
          statementSimple:
            'Jen is away from Friday for one week. She covers for all of us. After that I do not know who can cover.',
        },
      },
      missedConsequence:
        'The one real time limit is missed, so the case is treated as no rush when it needs fixing before Friday.',
      betterQuestion:
        'Is there a date by which you really need it back, and what happens if it is not sorted by then?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-outlook-broken',
      statement: 'I think my Outlook has gone wrong somehow. Maybe it needs reinstalling.',
      truth:
        'Nothing suggests Outlook is faulty. In this story the mailbox went missing after a change to who has access to the shared mailboxes.',
    },
  ],

  curveballs: [
    {
      id: 'cb-will-it-be-back',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: "Will it definitely be back today? I'd like to tell the others it will be.",
      followUp: 'So will it be back today or not?',
      expectedResponse:
        'Do not promise that it will be back today. Say what you will do, who needs to be involved and when he will next hear from you, and ask what he needs to tell his colleagues.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -4 },
    },
    {
      id: 'cb-goes-quiet',
      type: 'go-silent',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: 'Mm. Right. I see.',
      followUp: 'Sorry, I lost track for a moment. Could you say that more simply?',
      expectedResponse:
        'Notice the pause, check in gently, and say it again in plainer words instead of adding more detail.',
      minDifficulty: 'standard',
      effects: { patience: -2 },
    },
  ],
  allowedCurveballs: [
    'unsupported-guarantee',
    'go-silent',
    'previous-bad-experience',
    'ask-manager',
  ],

  expectedDiscoveryAreas: [
    'What he sees on screen',
    'When he last saw the mailbox',
    'Who else can see it',
    'Anything that changed in the meantime',
    'What he has already tried',
  ],
  successCriteria: [
    'Greets Marcus, introduces themselves and asks what he sees, in plain words.',
    'Finds out when he last saw the mailbox and whether anyone else can still see it.',
    'Learns that the office manager has been changing who has access, and treats it as an access question, not an Outlook fault.',
    'Explains what is likely going on without jargon and without promising a time.',
    'Agrees who will do what and when he will hear next, and summarises before ending.',
  ],
  coachingFocus: ['clarity', 'scoping-discovery', 'closing'],
  careExpectations: {
    communicate: [
      'Uses everyday words such as "the shared mailbox" and "your list", and explains any other term before using it.',
      'Gives short steps one at a time and checks that Marcus has understood.',
    ],
    accountable: [
      'Says clearly what they will do and who else needs to be involved, and gives a realistic time for the next update.',
    ],
    resourceful: [
      'Asks whether anyone else can still see the mailbox and how the enquiries are being handled in the meantime.',
      'Works out who looks after access to the shared mailboxes, so the case reaches the right person.',
    ],
    empathetic: [
      'Recognises that not being able to help the team is frustrating, even though the problem is not urgent.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Using terms such as "profile", "delegate" or "permissions" without explaining them, which confuses a customer who is not technical.',
    'Asking him to reinstall Outlook or rebuild his profile before finding out what changed.',
    'Taking his short answers as a sign that nothing more is needed and ending without next steps.',
    'Promising that the mailbox will be back today without knowing who controls access.',
  ],
  goodBehaviours: [
    'Asking when he last saw the mailbox and what happened since, in everyday words.',
    'Asking whether anyone else on the team can still see it.',
    'Asking whether anything changed while he was away, including who has access.',
    'Explaining what is probably happening and who needs to act, then giving a time for the next contact.',
    'Checking that he is happy with the plan before ending.',
  ],
  expectedOutcome:
    'Marcus understands in plain words that the mailbox is probably missing because of a change to who has access, not because Outlook is broken. The engineer has agreed who will check and arrange access and when Marcus will hear next, and Jen keeps covering the urgent enquiries until then.',
  evaluatorNotes:
    'Root cause in the story: while Marcus was on leave, the office manager tidied the access lists for the shared mailboxes and his name was left off, so the mailbox no longer appears in his Outlook. Jen, who stayed in the office, can still see it. Marcus is calm, brief and not technical, and will not volunteer much. A strong call uses plain words, finds the timing, the colleague who can still see it and the access tidy-up with simple questions, does not blame Outlook or promise a time, and agrees who will act and when Marcus will hear.',
} satisfies ScenarioInput;

export default scenario;
