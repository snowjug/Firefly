import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario. Everything here is fictional: people, organisation and case. Teams is a real
// product, so the scenario describes only what the customer sees and was told, never how Teams works.
//
// Root cause in the story (hidden from the trainee): yesterday afternoon an administrator at Tailspin
// Toys changed a policy. Since then people in the sales and executive group are stopped when a
// meeting has someone from outside the company on the invite, while internal meetings are fine and
// the web version still works. Priya heard about the change in passing, does not know which policy
// it was and did not link it to the problem. The desktop app was already reinstalled on a few
// laptops with no change. The count of 27 people is written for the default (high) impact; the two
// facts that depend on how many people are affected (hf-affected-count, hf-reinstalled) carry
// byImpact wordings for low (one person) and medium (eight people), matching affectedUsers.
//
// A strong call is not one that guesses the policy. It names the pressure, scopes the pattern, finds
// the browser route for the presentation, takes ownership, gets the administrator involved and
// agrees when Priya will hear next, and it handles the demand for a manager without defensiveness.

const scenario = {
  id: 'teams-cannot-join-external-meetings',
  version: 1,
  title: 'Colleagues cannot join scheduled Teams meetings',
  shortTitle: 'Cannot join meetings',
  listSummary:
    'An operations manager reports that colleagues cannot join scheduled Teams meetings as an executive presentation nears.',
  summary:
    'Priya Raman manages operations at Tailspin Toys. Colleagues cannot join their scheduled Microsoft Teams meetings, and an executive presentation to a customer is about to start. Understand the problem, take ownership and agree what happens next, with a time for the next update.',
  tags: ['meetings', 'time pressure', 'ownership', 'escalation request'],
  estimatedMinutes: 12,

  product: { id: 'teams', area: 'Meetings' },
  caseReference: 'SIM-410001',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-21',
    productFamily: 'microsoft-365',
    sourceCategories: ['author-experience'],
    behaviourCheck: 'not-checked',
    syntheticConfirmed: true,
    review: 'unreviewed',
  },
  issueType: 'feature-not-working',
  impact: 'high',
  startingTemperature: 'anxious',
  proficiency: 'intermediate',
  style: 'demanding',
  callStage: 'first-contact',
  difficulty: 'standard',

  persona: {
    name: 'Priya Raman',
    speaker: 'female',
    role: 'Operations Manager',
    organisation: 'Tailspin Toys',
    background:
      'Priya keeps day-to-day operations running at a toy company and looks after the sales and executive teams when their tools fail. She is a confident Teams user and knows the basics of troubleshooting, but she does not manage the company settings. She is afraid of letting the executives down in front of a customer.',
    voice:
      'Quick and direct, in short sentences. Anxious underneath, so she asks for names, times and commitments and pushes back on vague answers. Eases when someone takes charge and gives her a specific time; gets sharper if she is asked to repeat herself or is sent elsewhere.',
  },
  environment: {
    details: [
      'Tailspin Toys runs its scheduled meetings in Teams, mostly through the desktop app on company Windows laptops.',
      'Everyone signs in with their normal work account. Email, chat and calendars all work as usual.',
      'The sales team and the executive office hold regular meetings with people outside the company.',
      'A colleague in IT looks after the company settings and policies for Teams. Priya does not.',
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'One account manager with a customer catch-up later in the week.' },
    medium: {
      count: 8,
      summary: 'Eight account managers with customer meetings booked this afternoon.',
    },
    high: {
      count: 27,
      summary: '27 people in sales and the executive office, all with customer meetings today.',
    },
  },
  customerObjective:
    'Get the executive presentation started on time, and have one named person own the problem until everyone can join meetings again.',
  customerExpectation:
    'Someone who takes charge straight away, says what they will do first and by when, and does not send her back to her own IT team.',
  desiredOutcome:
    'Priya has a way to get the presentation going, knows who owns the case and when she will next hear, and the person who looks after her company settings is brought in to check what changed.',
  previousTroubleshooting: [
    'The desktop app was reinstalled on several laptops, with no change.',
    'People retried joining several times and always got the same result.',
    'One team member opened the meeting in a web browser and got in.',
  ],
  recentChanges: [
    'An administrator changed a policy yesterday afternoon. Priya heard about it in passing and does not know which policy it was.',
  ],

  publicBrief: {
    issue: 'Colleagues report that they cannot join scheduled Teams meetings.',
    impact: {
      low: 'A customer catch-up later this week is held up. There is no urgent deadline.',
      medium: 'Customer meetings booked for this afternoon are at risk.',
      high: 'An executive presentation to a customer starts soon and cannot slip.',
    },
    objective:
      'Find out what is blocking meetings, take ownership and agree next steps with a time.',
    knownContext:
      'Priya Raman manages operations at Tailspin Toys. People on her teams cannot join meetings, and she is calling for help.',
    environment:
      'Tailspin Toys uses Teams for scheduled meetings, mostly via the desktop app installed on company Windows laptops.',
  },
  brief: {
    situation:
      'An operations manager is calling because colleagues cannot join their scheduled Teams meetings. She wants someone to take charge.',
    goal: 'Find out what is happening and how far it reaches, take ownership, and make sure she knows what happens next and when she will hear from you.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'You cannot see her settings in this practice call, so rely on what she tells you.',
    ],
  },

  openingCore:
    "My colleagues can't join their scheduled Teams meetings. They click join and it just won't let them in.",
  impactVariants: {
    low: {
      summary:
        "It isn't urgent, but it's holding up a customer catch-up I'd like to go ahead this week.",
      detail:
        "The account manager involved has a catch-up with a customer on Thursday, so there's a little time, but I don't want it to turn into a bigger problem.",
      deadline: 'Before Thursday would be fine, but sooner is better.',
    },
    medium: {
      summary:
        'Some of our account managers have customer meetings booked this afternoon, and they need to be in them.',
      detail:
        "The account managers with customer calls this afternoon can't join. If that carries on, we'll have to rearrange the calls, and one of those customers is already unhappy with us.",
      deadline: 'The first of those calls is at two this afternoon.',
    },
    high: {
      summary: "Our executives are due to present to a customer very shortly, and it can't slip.",
      detail:
        "It's our quarterly review with one of our biggest customers. The CEO and two directors are presenting, and the customer's team is expecting to join. If we can't get in, we look unprepared in front of them.",
      deadline: 'It starts in about forty minutes.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I'm following up on the case I opened earlier today about the Teams meetings, and nobody has called me back.",
      brief:
        'Priya opened a case earlier today about meetings her colleagues cannot join. No one has called her back yet.',
    },
    escalated: {
      opening:
        "This is my second call today about the Teams meetings, and I still don't have anyone in charge.",
      brief:
        'Priya has already contacted support once today. The meetings are still failing and she feels passed around.',
    },
    closure: {
      opening:
        "I'm calling to confirm that people can join their Teams meetings again, so we can close the case.",
      brief:
        'Priya expects to confirm that meetings work again and to understand what happened before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier today',
      summary:
        'Priya called to report that colleagues could not join scheduled Teams meetings. A case was logged.',
    },
    {
      when: 'Mid-morning',
      summary: 'An automatic acknowledgement was sent. No engineer has contacted her yet.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-tried-myself',
      text: "I've tried myself as well, a few times, and I get nowhere. It never puts me into the meeting.",
      intents: ['problem_description', 'reproducibility'],
      elaboration: "I've been trying things for a while now, and none of it has helped.",
      simple: 'I tried myself. It does not work. It never puts me in the meeting.',
    },
    {
      id: 'kf-environment',
      text: 'We use Teams on our company Windows laptops, mostly the desktop app, signed in the usual way.',
      intents: ['environment'],
      simple: 'We use Teams on company laptops. We use the desktop app and sign in as normal.',
    },
    {
      id: 'kf-everything-else',
      text: "Email, chat and calendars all work normally. It's only the joining that fails.",
      intents: ['problem_description', 'affected_scope'],
      cues: ['anything else', 'everything else', 'other features', 'other apps', 'email', 'chat'],
      simple: 'Email, chat and calendars work. Only joining the meetings does not work.',
    },
    {
      id: 'kf-outcome',
      text: "I want everyone able to join, and I want to know who is looking after this until it's done.",
      intents: ['expected_outcome'],
      simple: 'I want everyone to be able to join. I want to know who is looking after this.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-first-complaint',
      intents: ['timing_onset'],
      text: "I think the first complaint came in late yesterday. Actually, it might have been this morning, I'd need to check with my team.",
      confirmedText:
        'Yes, the first message came in late yesterday afternoon, and it has been the same since.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-screenshot',
      intents: ['error_message'],
      checking: 'Hang on, someone sent me a screenshot. Let me find it.',
      text: "It says it can't connect them to the meeting, and suggests trying again later. We've tried again many times.",
    },
    {
      id: 'cf-seen-before',
      intents: ['reproducibility'],
      cues: ['happened before', 'seen this before', 'ever happened', 'before this'],
      checking: 'Let me look at our IT log.',
      text: "I can't see anything like this in our IT log for the last few months.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-which-policy',
      intents: ['recent_changes'],
      cues: [
        'which policy',
        'what policy',
        'what was changed',
        'what exactly changed',
        'what did they change',
        'which setting',
      ],
      text: "I don't know which policy it was or what it does. Our administrator made the change and I wasn't told the details.",
      whoKnows: 'our administrator',
    },
    {
      id: 'uf-licences',
      intents: ['account_details'],
      cues: ['licence', 'license', 'plan', 'subscription'],
      text: "I couldn't tell you which licences people have. That's something our administrator would know.",
      whoKnows: 'our administrator',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-sales-lunch',
      text: "We've got the quarterly sales lunch in the canteen today, so the whole floor is chaotic.",
    },
    {
      id: 'if-laptop-battery',
      text: "My own laptop is nearly four years old and the battery is awful, but that's a separate story.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-external-guests',
      importance: 'critical',
      label: 'Only meetings with outside guests fail',
      statement:
        "Now that you ask, our internal meetings are fine. It's only the ones where someone from outside the company is on the invite.",
      partialStatement: "It doesn't seem to be every single meeting, as far as I can tell.",
      revealWhen:
        'Asks whether every meeting fails or only some, or what the failing meetings have in common, such as who is invited or whether internal meetings work.',
      intents: ['reproducibility', 'affected_scope'],
      partialIntents: ['problem_description'],
      cues: [
        'every meeting',
        'all meetings',
        'all of your meetings',
        'which meetings',
        'some meetings',
        'other meetings',
        'internal meeting',
        'in common',
        'external guest',
        'outside guest',
        'outside the company',
        'someone outside',
      ],
      hint: 'It seems to be the meetings with our customers that give us trouble.',
      statementTerse: 'Internal meetings are fine. Only the ones with someone from outside fail.',
      statementSimple:
        'Meetings inside the company work. Only meetings with a person from outside the company do not work.',
      missedConsequence:
        'The pattern stays hidden, so the call treats this as a general Teams fault and she hears generic fixes while the presentation clock runs down.',
      betterQuestion:
        'Does it happen on every meeting, or only on some, and what do the failing ones have in common?',
    },
    {
      id: 'hf-policy-change',
      importance: 'critical',
      label: 'A policy was changed yesterday',
      statement:
        "Our administrator changed a policy yesterday afternoon. I only heard about it in passing, and I didn't think it was connected.",
      revealWhen:
        'Asks whether anything changed recently or before the problem began, including anything an administrator or another team did.',
      intents: ['recent_changes'],
      hint: "I did hear something from IT about some changes, but I wasn't paying attention.",
      statementTerse: 'Our administrator changed a policy yesterday afternoon.',
      statementSimple:
        'Our administrator changed a policy yesterday afternoon. I heard about it, but I did not think it was the reason.',
      missedConsequence:
        'The likely trigger is never found, so nobody asks the administrator what changed and the engineer has no useful next step to give her.',
      betterQuestion:
        'Did anything change recently, for example a setting or a policy, and did your administrator touch anything?',
    },
    {
      id: 'hf-web-works',
      importance: 'important',
      label: 'The web version still works',
      statement:
        'The web version still works. One of my team opened the meeting in a browser and got straight in.',
      revealWhen:
        'Asks whether there is a workaround or another way to join, or asks about using a browser, a different app or a different device.',
      intents: ['workaround', 'environment'],
      cues: [
        'browser',
        'web version',
        'web app',
        'website',
        'online version',
        'another way',
        'other way',
        'different way',
        'workaround',
        'work around',
        'alternative',
      ],
      hint: 'One of the team said something about trying it a different way.',
      statementTerse: 'The web version still works. A colleague got in through a browser.',
      statementSimple:
        'The web version still works. One person on my team joined in a browser. It worked.',
      missedConsequence:
        'The one route that could get the presentation going is never found, so she is left with no way in and no interim plan while the clock runs down.',
      betterQuestion:
        'Is there any other way people can join at the moment, for example through a browser?',
    },
    {
      id: 'hf-affected-count',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Number of people affected',
      statement:
        "It isn't only me. I make it 27 people across sales and the executive office who can't get into their meetings.",
      revealWhen:
        'Asks how many people are affected, who else has the problem, or how widespread it is across the company.',
      intents: ['affected_scope'],
      statementTerse: 'It is 27 of us, across sales and the executive office.',
      statementSimple:
        'It is not only me. 27 people in sales and the executive office cannot join their meetings.',
      byImpact: {
        low: {
          statement:
            "As far as I know it's just the one person, one of our account managers. I've only heard from her so far.",
          statementTerse: 'Just one person so far, one of our account managers.',
          statementSimple: 'As far as I know it is only one person, one of our account managers.',
        },
        medium: {
          statement:
            "It's eight of our account managers so far, the ones with customer calls booked today.",
          statementTerse: 'Eight of our account managers so far.',
          statementSimple:
            'It is eight of our account managers. They all have customer calls booked today.',
        },
      },
      missedConsequence:
        'The scale stays unknown, so the case is treated as a nuisance for one person and is not prioritised or escalated as the company-wide, time-critical problem it is.',
      betterQuestion: 'How many people are affected, and are they all in the same teams?',
    },
    {
      id: 'hf-reinstalled',
      importance: 'helpful',
      label: 'The desktop app was already reinstalled',
      statement:
        "We've already had the desktop app reinstalled on three laptops, mine included. It made no difference.",
      revealWhen: 'Asks what the customer or her colleagues have already tried to fix the problem.',
      intents: ['already_tried'],
      statementTerse: 'We reinstalled the desktop app on three laptops. No change.',
      statementSimple:
        'We reinstalled the desktop app on three laptops, mine too. It did not help.',
      byImpact: {
        low: {
          statement:
            "We've already had the desktop app reinstalled on her laptop and on mine. It made no difference.",
          statementTerse: 'We reinstalled the desktop app on her laptop and mine. No change.',
          statementSimple:
            'We reinstalled the desktop app on her laptop and on mine. It did not help.',
        },
        medium: {
          statement:
            "We've already had the desktop app reinstalled on a few of the laptops, mine included. It made no difference.",
          statementTerse: 'We reinstalled the desktop app on a few laptops. No change.',
          statementSimple:
            'We reinstalled the desktop app on a few laptops, mine too. It did not help.',
        },
      },
      missedConsequence:
        'The engineer asks her to repeat a reinstall she has already done, which costs trust and time she does not have.',
      betterQuestion:
        'What have you and your colleagues already tried, and what happened each time?',
    },
    {
      id: 'hf-admin-unreachable',
      importance: 'important',
      minDifficulty: 'challenge',
      availableAfterTurn: 3,
      label: 'Her administrator has not replied yet',
      statement:
        "I've messaged our administrator twice since the first complaint and I haven't had an answer. I don't know whether they're at their desk today.",
      revealWhen:
        'Asks whether she has been in touch with her administrator or IT team about it, or whether they can be reached now.',
      intents: ['account_details', 'previous_contact'],
      cues: [
        'administrator',
        'admin',
        'your it team',
        'your it department',
        'who looks after',
        'who manages',
        'who made',
      ],
      statementTerse: "I've messaged our administrator twice and had no answer.",
      statementSimple:
        'I sent two messages to our administrator. I did not get an answer. I do not know if they are at their desk.',
      missedConsequence:
        'The plan relies on an administrator who cannot be reached, and nobody works out how else to get the right person involved today.',
      betterQuestion:
        'Have you been able to reach your administrator, and do you know whether they are available today?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-fault-on-your-side',
      statement:
        "I'd say this has to be a fault on your side. Nothing we've done would stop people joining.",
      truth:
        'Nothing confirms a fault with the service. In this story a policy change made at Tailspin Toys yesterday is the likely trigger, and Priya did not connect it to the problem.',
    },
  ],

  curveballs: [
    {
      id: 'cb-escalate-now',
      type: 'ask-manager',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        "I'm sorry, but I need this escalated right now. Can I speak to your manager? I can't wait on this.",
      followUp:
        'I still want a manager, or at least the name of whoever is taking this on and how I reach them.',
      expectedResponse:
        'Acknowledge the urgency without getting defensive, say plainly that you own the case and what you will do first and by when, and explain how a manager or escalation contact can join if she still wants one.',
      minDifficulty: 'standard',
      effects: { temperature: 8, trust: -8, patience: -6 },
    },
    {
      id: 'cb-hard-deadline',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 7, whenImpactUnacknowledged: true },
      statement:
        'I should be clear about the time. The customer meeting is coming up, and I need to know what you can do before then.',
      followUp: "I'm running out of time. What exactly can you do in the next few minutes?",
      expectedResponse:
        'Acknowledge the deadline, be honest about what can and cannot be promised, say what you will do first and give a specific time for the next update. Ask whether there is any other way to get people into the meeting if that has not come up yet.',
      minDifficulty: 'standard',
      effects: { temperature: 6, patience: -8 },
    },
  ],
  allowedCurveballs: ['ask-manager', 'deadline', 'unsupported-guarantee', 'challenge-credibility'],

  expectedDiscoveryAreas: [
    'What happens when someone tries to join',
    'Which meetings and which people are affected',
    'When it started and what changed',
    'What has already been tried',
    'A way to keep the meeting going',
    'The deadline and what depends on it',
  ],
  successCriteria: [
    'Acknowledges the clock and the pressure on Priya before starting on questions.',
    'Finds that only some meetings fail, and that another way into the meeting still works.',
    'Learns that a policy was changed yesterday and that Priya does not know which one, without guessing the fix.',
    'Says plainly that they own the case and gives a specific time for the next update.',
    'Handles the request for a manager or escalation without defending or deflecting.',
    'Summarises what is known, what happens next and who will do it before the call ends.',
  ],
  coachingFocus: ['empathy-deescalation', 'ownership-next-steps', 'scoping-discovery'],
  careExpectations: {
    communicate: [
      'Uses short, plain sentences and says what happens next in order, so Priya can pass it on to her executives.',
      'Summarises what is known and not yet known before ending, and does not present a guess as the cause.',
    ],
    accountable: [
      'States early that they own the case, names the first thing they will do and gives a specific time for the next update.',
      'Promises only what they control, such as their own actions and when she will hear next, not that the presentation will work.',
    ],
    resourceful: [
      'Asks what the failing meetings have in common and whether there is another way into the meeting, to keep the presentation moving.',
      'Brings in the person who looks after her company settings, and says how a manager can join if she still wants one.',
    ],
    empathetic: [
      'Names the pressure of an executive presentation in the first minute, before asking questions.',
      'Stays calm and unhurried when she asks for a manager, and does not take the request personally.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Starting generic fixes (sign out and back in, clear the cache, reinstall the app) before asking what is happening or who is affected.',
    'Saying "I understand" and then asking her to explain everything from the start, with no sign of ownership.',
    'Telling her to ask her own IT team to deal with it, which repeats the runaround she is afraid of.',
    'Promising that the presentation will go ahead, or that the problem will be fixed by a certain time, without knowing the cause.',
    'Getting defensive when she asks for a manager, or refusing without explaining what else can be done.',
  ],
  goodBehaviours: [
    'Acknowledging the clock and the pressure in the first minute, then saying plainly "I will own this case".',
    'Asking whether it happens on every meeting, who is affected and when it started, in plain language.',
    'Asking whether anything changed recently and whether there is another way to get people in, to keep the presentation moving.',
    'Answering the request for a manager by explaining what happens first and how an escalation contact can join.',
    'Agreeing a first step, who does it and a specific time for the next update, and summarising before the call ends.',
  ],
  expectedOutcome:
    'Priya has a way to start the presentation, understands that the meetings that fail all involve people from outside and that a policy changed yesterday, and knows the engineer owns the case. The engineer has agreed a first step, a way to involve her administrator and a specific time for the next update.',
  evaluatorNotes:
    'Root cause in the story: an administrator at Tailspin Toys changed a policy yesterday afternoon. Since then meetings with someone from outside the company stop people joining, internal meetings are fine and the web version still works. Priya does not know which policy changed and has already reinstalled the desktop app. 27 people are affected at the default impact. A strong call acknowledges the clock early, finds the pattern and the web route, takes ownership in plain words, involves the administrator, handles the request for a manager calmly and gives a specific time for the next update, without guessing the fix or promising an outcome.',
} satisfies ScenarioInput;

export default scenario;
