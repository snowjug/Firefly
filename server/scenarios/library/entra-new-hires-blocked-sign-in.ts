import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Challenge scenario (first contact). Everything here is fictional: people, organisation and case.
//
// Root cause (hidden from the trainee): last Thursday Litware's separate security team changed a
// sign-in policy, and Nadia only saw the change notes this morning. Accounts whose first sign-in
// falls after that change meet the policy on day one: the starters are on laptops handed out at
// nine, over the guest network in reception, and none of them has set anything up yet. People who
// joined earlier were already past that point and sign in normally. Licences are assigned on every
// new account. Nadia is an expert and has settled on a theory that the HR feed has not assigned
// licences. She is right that it concerns new accounts only and wrong about the licences, and she
// has not pulled a sign-in record for any starter. She opens up when her expertise is respected and
// the questions are specific. A strong call tests the theory with evidence instead of arguing,
// finds who is not affected and what changed, asks for one sign-in record, owns the case,
// promises no fix time, and agrees who involves her security team.

const scenario = {
  id: 'entra-new-hires-blocked-sign-in',
  version: 1,
  title: 'New starters blocked from signing in on day one',
  listSummary:
    'New starters cannot sign in on their first day, and the head of IT has a firm theory.',
  summary:
    'Nadia leads IT at Litware. Several new starters cannot sign in on their first day, and induction is under way. She is direct, short on patience and technically expert, and she already has a theory about the cause. Find out what is really happening, handle her pushback respectfully, and agree next steps you can honestly commit to.',
  tags: ['sign-in', 'new starters', 'security policy', 'expert customer', 'pushback'],
  estimatedMinutes: 14,

  product: { id: 'entra-id', area: 'Sign-in' },
  caseReference: 'SIM-420003',
  issueType: 'policy-security',
  impact: 'high',
  startingTemperature: 'frustrated',
  proficiency: 'expert',
  style: 'terse',
  callStage: 'first-contact',
  difficulty: 'challenge',

  persona: {
    name: 'Nadia Haddad',
    speaker: 'female',
    role: 'Head of IT',
    organisation: 'Litware',
    background:
      "Nadia runs IT for a mid-sized company and has looked after its accounts and sign-in setup for years. She knows the tools well and has already formed a view. It is the new starters' first day, induction is running, and she has been on the phone since early morning.",
    voice:
      'Terse and direct. Short sentences, accurate technical vocabulary, no small talk. Answers what is asked and no more. Challenges vague answers and says she has already checked basic things. Opens up when the engineer respects her expertise and asks specific questions. Never abusive.',
  },
  environment: {
    details: [
      'Litware manages its own accounts, and new accounts are created automatically from the HR system a couple of days before each start date',
      'Licences are assigned to new accounts automatically, through a group',
      'A separate security team looks after the sign-in policies and does not report to Nadia',
      'Staff who joined earlier have already set up their extra sign-in step and sign in normally, including the previous intake',
      'New starters collect their laptops at nine on the first day and sign in over the guest network in reception',
      "Nadia's team is small and is also running the first-day sessions",
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'One new starter, a contractor who joined today' },
    medium: { count: 6, summary: "Six new starters in one department's intake" },
    high: {
      count: 24,
      summary: 'Two intakes of new starters across two sites, about twenty-four people',
    },
  },
  customerObjective:
    'Get the new starters signed in so the first-day induction can go ahead, and have someone who owns the case and gives a clear next step.',
  customerExpectation:
    'An engineer who takes her diagnosis seriously, asks specific questions instead of basic ones, and commits only to what they can actually do.',
  desiredOutcome:
    'Nadia and the engineer agree what evidence to gather, who owns the next step, and a specific time for the next update, with no promise about a fix time.',
  previousTroubleshooting: [
    'Checked that every new starter shows a licence assigned',
    'Tested her own account and two longstanding colleagues, who signed in fine',
    'Reset the password of two of the starters, with no change',
    'Asked the service desk to try from a different network, with no change',
  ],
  recentChanges: [
    'The security team changed a sign-in policy last Thursday, and Nadia only saw the change notes this morning',
    'A batch of new accounts was created from the HR system earlier this week',
  ],

  publicBrief: {
    issue: 'New starters cannot sign in on their first day, and the customer has her own theory.',
    impact: {
      low: 'One new starter is blocked. Nadia wants it solved today.',
      medium: "A team's new starters are blocked, and managers are waiting on them.",
      high: 'Two intakes are blocked on day one, and induction is already running.',
    },
    objective:
      'Earn her trust, test her theory respectfully, and agree evidence, an owner and a next update time.',
    knownContext:
      'Nadia is an expert and expects the engineer to keep up. She is short on patience and may disagree with you.',
    previousContact: 'No earlier contact about this problem.',
    environment:
      'A company that manages its own accounts and creates new ones ahead of each start date.',
  },
  brief: {
    situation:
      'Nadia is Head of IT at a mid-sized company. New starters cannot sign in on their first day, and she is sure she knows why. She is direct, technical and short on patience.',
    goal: 'Find out what is really happening, test her theory without arguing, take ownership, and agree next steps you can honestly commit to.',
    groundRules: [
      'The customer, organisation and case are fictional.',
      'You cannot see her tenant in this practice call. Ask what she sees and rely on her answers.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'Do not promise a fix time or an outcome you cannot guarantee.',
    ],
  },

  openingCore:
    "New starters can't sign in. It's their first day and they're sitting in induction with no access.",
  impactVariants: {
    low: {
      summary: "It's one new starter, a contractor, but they started today and I want it sorted.",
      detail:
        "Just the one so far. A contractor who started this morning. It isn't a crisis yet, and I don't want it to become one.",
      deadline: 'I want them working by lunchtime.',
    },
    medium: {
      summary: "It's a whole team's worth of new starters, and their managers are waiting on them.",
      detail:
        "Six new starters in one department's intake. Their managers are waiting, and the first-day tasks need them signed in.",
      deadline: 'Their induction session ends mid-morning. They need access before then.',
    },
    high: {
      summary:
        "It's two intakes of new starters across two sites, and induction is already running.",
      detail:
        'Twenty-four new starters over two sites. Their managers are waiting, the HR sessions are running, and nobody can reach email or the onboarding forms.',
      deadline: 'Induction sessions run until mid-morning. I need them signed in before then.',
    },
  },
  stageFrames: {
    'first-contact': {
      opening: 'I need this looked at now.',
      brief: 'This is the first time Nadia has contacted your team about this problem.',
    },
    'follow-up': {
      opening:
        "I'm following up on the case I opened this morning about the new starters who can't sign in. Nobody has come back to me.",
      brief:
        'Nadia opened a case this morning about new starters who cannot sign in and has not had a reply.',
    },
    escalated: {
      opening:
        "This is my second call this morning about new starters who can't sign in, and I'm still waiting for someone who understands the problem.",
      brief:
        'Nadia has already contacted support once today and was asked basic questions she had already answered. She is short on patience.',
    },
    closure: {
      opening:
        "I'm calling about the case on the new starters who couldn't sign in, to see whether we can close it.",
      brief:
        'This is a closure call. Nadia expects to confirm that the new starters can sign in and to understand what was done before the case is closed.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier this morning',
      summary:
        'Nadia phoned support about new starters who could not sign in. A first-line engineer opened a case and asked whether passwords had been reset and laptops restarted.',
    },
    {
      when: 'Earlier this morning',
      summary:
        'Nadia said she had already covered those basics and asked for someone who could look at the sign-in itself. She was told an engineer would call her back.',
    },
    {
      when: 'Since then',
      summary: 'No call back has been made. Nadia has phoned again.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-what-happens',
      text: "They enter the password, and then they can't get in. It's the same every time.",
      intents: ['problem_description'],
      simple: 'They enter the password. Then they cannot get in. It is the same every time.',
    },
    {
      id: 'kf-first-day',
      text: "Since this morning. It's their first day, so it's the first time any of them has tried.",
      intents: ['timing_onset'],
      simple: 'Since this morning. It is their first day. It is the first time they try.',
    },
    {
      id: 'kf-checked-own',
      text: "My own account and two colleagues' accounts are fine. I've already checked them.",
      intents: ['already_tried', 'reproducibility'],
      simple: "My account and two colleagues' accounts are fine. I checked them already.",
    },
    {
      id: 'kf-theory',
      text: "My view is it's the licence sync from HR. It lags every time we onboard.",
      intents: ['problem_description'],
      cues: [
        'what do you think',
        'your theory',
        'your view',
        'why do you think',
        'what makes you think',
        'what do you believe',
        'suspect',
      ],
      simple: 'I think it is the licence sync from HR. It is slow every time we onboard.',
    },
    {
      id: 'kf-outcome',
      text: "I want them signed in so induction can carry on. And I want to know who's owning this.",
      intents: ['expected_outcome'],
      simple: 'I want them signed in. I want to know who is owning this.',
    },
  ],

  vagueFacts: [
    {
      id: 'vf-account-creation',
      intents: ['timing_onset', 'account_details'],
      cues: ['when were', 'created', 'account creation', 'provisioned'],
      text: 'They were created earlier this week. Monday, maybe Tuesday. The HR feed does that automatically.',
      confirmedText: 'Tuesday morning, from the feed. I can see it in the list.',
    },
  ],
  checkableFacts: [
    {
      id: 'cf-one-starter-record',
      intents: ['error_message', 'already_tried'],
      cues: [
        'sign-in logs',
        'sign in logs',
        'logs',
        'sign-in record',
        'sign-in activity',
        'open the record',
        'open one',
        'look at one',
        'pull one',
      ],
      checking: "Give me a moment. I'll open one of the starters' sign-ins.",
      text: "It shows the sign-in was interrupted by a policy. The screen doesn't tell me which one.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-sign-in-rules-detail',
      intents: ['account_details', 'environment'],
      cues: [
        'what rules',
        'sign-in rules',
        'sign in rules',
        'conditions',
        'what does the policy',
        'which policy',
        'what policy',
      ],
      text: "I don't have the detail of our sign-in rules to hand. Our security team looks after those.",
      whoKnows: 'our security team',
    },
    {
      id: 'uf-your-side',
      intents: ['problem_description'],
      cues: ['on our side', 'on your side', 'service health', 'outage', 'service issue'],
      text: "I don't know whether anything's wrong on your side. That's part of why I'm calling.",
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-room',
      text: "The induction room was double-booked this morning, which hasn't helped.",
    },
    {
      id: 'if-supplier',
      text: "I'm supposed to be in a supplier meeting right now, so I've pushed that back.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-blocked-message',
      importance: 'important',
      label: 'The message says a policy has blocked access',
      statement:
        "They get past the password, then it stops with a message about access being blocked by a policy. I think that's just generic wording.",
      partialStatement: "It's not a wrong password, if that's what you're asking.",
      revealWhen:
        'Asks what the starters see when it stops, what the message says, or at which step the sign-in fails.',
      intents: ['error_message'],
      partialIntents: ['problem_description'],
      hint: "It isn't a password problem.",
      statementTerse:
        'Past the password, then a message says access is blocked by a policy. Generic wording, I think.',
      statementSimple:
        'They get past the password. Then a message says access is blocked by a policy. I think this is only general wording.',
      missedConsequence:
        'The one detail that points away from her licence theory is missed, so the call starts from her diagnosis instead of from what the starters actually see.',
      betterQuestion: 'What exactly do the starters see when it stops, and at which step?',
    },
    {
      id: 'hf-previous-intake-fine',
      importance: 'important',
      label: 'Earlier starters and existing staff are fine',
      statement:
        "The intake a fortnight ago signed in fine, and everyone who's been here longer still can. It's only accounts whose first sign-in is this week.",
      revealWhen:
        'Asks whether anyone can sign in without trouble, whether earlier starters were affected, or how this intake differs from people who are fine.',
      intents: ['affected_scope', 'timing_onset'],
      cues: [
        'previous intake',
        'last intake',
        'existing staff',
        'everyone else',
        'who else',
        'anyone else',
        'not affected',
        'can anyone',
        'anyone able',
        'only new',
        'just new',
        'who can sign in',
      ],
      statementTerse: 'Previous intake was fine. Existing staff are fine. Only this week.',
      statementSimple:
        'The intake two weeks ago signed in fine. Everyone who joined before is fine. Only the accounts with a first sign-in this week have the problem.',
      missedConsequence:
        'The pattern that ties the problem to the timing of the first sign-in stays hidden, and the engineer keeps looking at accounts and licences instead of at what changed.',
      betterQuestion:
        'Did the previous intake have this problem, and who can sign in without trouble?',
    },
    {
      id: 'hf-policy-change-thursday',
      importance: 'critical',
      minTrust: 34,
      availableAfterTurn: 2,
      label: 'The security team changed a sign-in policy last week',
      statement:
        "Our security team changed a sign-in policy last Thursday. I only saw the change notes this morning, and I haven't read the detail.",
      revealWhen:
        'Asks what changed before the first sign-ins, including changes made by other teams such as security, or whether anything changed to how people sign in.',
      intents: ['recent_changes'],
      hint: 'There was a change from our security team last week, but they change things all the time.',
      statementTerse: "Security changed a sign-in policy last Thursday. I haven't read the detail.",
      statementSimple:
        'Our security team changed a sign-in policy last Thursday. I saw the notes only this morning. I have not read the detail.',
      missedConsequence:
        'The most likely trigger is never found, the call ends with the licence theory untested, and the starters stay locked out while the right team is not involved.',
      betterQuestion:
        'What changed before the first sign-ins, including anything another team such as security did?',
    },
    {
      id: 'hf-licences-show-assigned',
      importance: 'important',
      minDifficulty: 'standard',
      minTrust: 30,
      availableAfterTurn: 2,
      label: 'Licences already show as assigned',
      statement:
        "I did check three of the accounts. They show a licence assigned. I think the portal lags behind the real state, so I'm not trusting that.",
      revealWhen:
        'Asks what she has checked to support the licence theory, or what the licence status shows for one of the starters.',
      intents: ['already_tried', 'account_details'],
      cues: [
        'licence',
        'license',
        'assigned',
        'provisioning',
        'hr feed',
        'hr sync',
        'group membership',
        'what have you checked',
      ],
      statementTerse: 'Checked three. Licences show assigned. I think the portal lags.',
      statementSimple:
        'I checked three of the accounts. They show a licence. I think the portal is slow to update, so I do not trust it.',
      byImpact: {
        low: {
          statement:
            "I did check the contractor's account. It shows a licence assigned. I think the portal lags behind the real state, so I'm not trusting that.",
          statementTerse: 'Checked the account. Licence shows assigned. I think the portal lags.',
          statementSimple:
            "I checked the contractor's account. It shows a licence. I think the portal is slow to update, so I do not trust it.",
        },
      },
      missedConsequence:
        'The engineer either accepts her licence theory unchallenged or argues with it without evidence, and the call turns into a disagreement instead of a shared check.',
      betterQuestion:
        'What have you checked to confirm it is the licences, and what does the licence status show for one of the starters?',
    },
    {
      id: 'hf-not-looked-at-logs',
      importance: 'important',
      minDifficulty: 'challenge',
      minTrust: 36,
      availableAfterTurn: 3,
      label: 'She has not looked at a sign-in record yet',
      statement:
        "I haven't pulled the sign-in logs for any of them yet. My team's tied up with induction. I can look at one now.",
      revealWhen:
        'Asks whether she has looked at the sign-in logs or the record for one of the starters, or asks her to open one.',
      intents: ['already_tried', 'error_message'],
      cues: [
        'sign-in logs',
        'sign in logs',
        'logs',
        'sign-in record',
        'sign-in details',
        'sign-in activity',
        'audit',
        'diagnostic',
        'open the record',
        'open one',
        'look at one',
        'pull one',
      ],
      statementTerse: "Haven't pulled the logs. Team's tied up. I can check one now.",
      statementSimple:
        'I did not look at the sign-in logs yet. My team is busy with induction. I can look at one now.',
      byImpact: {
        low: {
          statement:
            "I haven't pulled the sign-in logs for the contractor yet. My team's tied up with induction. I can look now.",
          statementTerse: "Haven't pulled the logs. Team's tied up. I can check now.",
          statementSimple:
            'I did not look at the sign-in logs for the contractor yet. My team is busy with induction. I can look now.',
        },
      },
      missedConsequence:
        'The one piece of evidence that would settle the argument is never requested, so the call ends with a theory and no evidence.',
      betterQuestion:
        'Could you open the sign-in record for one of the starters and tell me what it says about why they were stopped?',
    },
    {
      id: 'hf-first-day-devices',
      importance: 'helpful',
      minDifficulty: 'challenge',
      minTrust: 36,
      availableAfterTurn: 3,
      label: 'Brand-new devices, guest network, nothing set up',
      statement:
        "They're signing in on the laptops we hand out at nine, over the guest network in reception. None of those devices has been set up by us yet, and none of the starters has set up their second step.",
      revealWhen:
        'Asks which devices and network the starters are signing in from, or whether any of them has set anything up for their account yet.',
      intents: ['environment', 'account_details'],
      cues: [
        'which device',
        'what device',
        'which network',
        'what network',
        'guest',
        'reception',
        'where are they',
        'second step',
        'verification',
        'authenticator',
        'registered',
      ],
      statementTerse: 'Handed-out laptops, guest network. Nothing set up yet, no second step.',
      statementSimple:
        'They use the laptops we give out at nine, on the guest network in reception. We did not set up those devices yet. The starters did not set up a second step yet.',
      byImpact: {
        low: {
          statement:
            "The contractor is signing in on a laptop we hand out at nine, over the guest network in reception. We haven't set that device up yet, and the contractor hasn't set up a second step.",
          statementTerse: 'Handed-out laptop, guest network. Nothing set up yet, no second step.',
          statementSimple:
            'The contractor uses a laptop we give out at nine, on the guest network in reception. We did not set up that device yet. The contractor did not set up a second step yet.',
        },
      },
      missedConsequence:
        'A likely link between the first sign-in and the policy stays unexplored, and the next step lacks the detail her security team will ask for.',
      betterQuestion:
        'What device and network are the starters signing in from, and has any of them set up their extra verification yet?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-licence-sync',
      statement:
        "It's the licences. The HR feed lags every time, and the new accounts don't have theirs yet.",
      truth:
        'Every starter account shows a licence, so licences are not the cause. The sign-in is stopped by a security policy that was changed last Thursday, which the new accounts meet on their first sign-in. She is right only that it concerns new accounts.',
    },
  ],

  curveballs: [
    {
      id: 'cb-have-you-done-this',
      type: 'challenge-credibility',
      trigger: { earliestTurn: 3, latestTurn: 7, whenTemperatureAtLeast: 50 },
      statement:
        "Have you worked on sign-in problems like this before? I need someone who can follow what I'm telling you.",
      followUp: 'I want someone who can look at the logs with me.',
      expectedResponse:
        'Stay calm and factual. Do not defend your seniority or claim expertise you do not have. Show competence with a specific, evidence-based question, say what you can do yourself, and offer to bring in a specialist alongside you if that would help.',
      minDifficulty: 'standard',
      effects: { temperature: 6, trust: -6 },
    },
    {
      id: 'cb-signed-in-by-ten',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 10, afterFact: 'hf-licences-show-assigned' },
      statement: "Can you confirm they'll be signed in by ten? I need a yes or no.",
      followUp: 'Yes or no. Will they be signed in by ten?',
      expectedResponse:
        'Do not promise a time. Say plainly what you can commit to, such as taking the case, the evidence you need now and when you will update her, and be honest about what depends on her security team.',
      minDifficulty: 'challenge',
    },
    {
      id: 'cb-someone-who-can-commit',
      type: 'ask-manager',
      trigger: { earliestTurn: 6, latestTurn: 11, whenOwnershipUnclear: true },
      statement: "If you can't commit to anything, put me through to someone who can.",
      followUp: 'Who is that, and how do I reach them?',
      expectedResponse:
        'Acknowledge the request without defensiveness, say what you can do now, offer to involve a specialist or a manager alongside you, and keep the evidence-gathering moving.',
      minDifficulty: 'challenge',
    },
  ],
  allowedCurveballs: ['challenge-credibility', 'unsupported-guarantee', 'ask-manager'],

  expectedDiscoveryAreas: [
    'What the new starters see when it stops',
    'Who is and is not affected',
    'What changed before the first sign-ins',
    'What she has checked and what she has not',
    'Devices and networks used on the first day',
    'Evidence that would test her theory',
  ],
  successCriteria: [
    'Acknowledges the pressure of a first day with people waiting, briefly and without waffle.',
    'Neither accepts nor rejects her licence theory outright, and asks what evidence supports it.',
    "Finds the pattern: only this week's first sign-ins are affected, the message mentions a policy, and a security policy changed last Thursday.",
    'Asks for the sign-in record of one starter instead of arguing about the cause.',
    'Takes ownership, avoids promising a fix time, and agrees who does what and when she will next hear from you.',
    'Keeps questions short and specific, and does not repeat basic questions she has already answered.',
  ],
  coachingFocus: ['scoping-discovery', 'empathy-deescalation', 'ownership-next-steps'],
  careExpectations: {
    communicate: [
      'Keeps questions short and specific, uses her vocabulary correctly and does not lecture her about how sign-in works.',
      'Says plainly what is known and what is not, and summarises the agreed next steps in two or three sentences.',
    ],
    accountable: [
      'Takes ownership of the case within the first few exchanges, and does not send her back to her own team or a help page.',
      'Refuses to promise a fix time, and says instead what they will do next and when she will hear from them.',
    ],
    resourceful: [
      'Asks for evidence, such as the exact message and the sign-in record for one starter, that would test her theory without arguing against it.',
      'Asks who is not affected and what changed before the first sign-ins, and suggests involving her security team early.',
    ],
    empathetic: [
      'Acknowledges the first-day pressure and her expertise briefly and sincerely, without flattery.',
      'Stays calm and factual when she pushes back or questions their experience.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Agreeing that it is the licences just to move on, or insisting that she is wrong without any evidence.',
    'Asking basic questions she has already answered, such as whether passwords were reset.',
    'Lecturing her on how sign-in works, or reading from a script.',
    'Promising that the starters will be signed in by a time that cannot be guaranteed.',
    'Defending their own seniority when she challenges it, instead of showing competence with a specific question.',
    'Suggesting that she shares an existing account with the starters to get through the day.',
  ],
  goodBehaviours: [
    'Acknowledging the first-day pressure in one sentence, then asking a specific question.',
    'Asking what the starters see and from where when it stops, and who can sign in without trouble.',
    'Asking what changed before the first sign-ins, including changes made by other teams.',
    'Testing the licence theory with evidence and asking for the sign-in record of one starter.',
    'Offering a specialist alongside them if she questions their experience, without defensiveness.',
    'Agreeing a first step, an owner and a specific time for the next update, and saying what they cannot promise.',
  ],
  expectedOutcome:
    "Nadia feels heard and not lectured. She and the engineer have agreed to look at the sign-in record for one starter and to involve her security team about last Thursday's policy change. The engineer owns the case and has given a specific time for the next update, with no promise of a fix time.",
  evaluatorNotes:
    "Root cause: Litware's security team changed a sign-in policy last Thursday and Nadia only saw the change notes this morning. Accounts whose first sign-in falls after that change are stopped on day one, on handed-out laptops over the guest network with nothing set up. Licences are fine. Her theory is right only that it concerns new accounts, and she has not pulled a sign-in record. A strong call respects her expertise, tests the theory with evidence rather than argument, finds who is unaffected and what changed, asks for one sign-in record, owns the case, promises no time, and agrees how the security team is involved.",
} satisfies ScenarioInput;

export default scenario;
