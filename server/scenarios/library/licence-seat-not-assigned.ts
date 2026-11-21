import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario. Everything here is fictional: people, organisation and product.
//
// Root cause (hidden from the trainee): the subscription has ten seats. Eight are held by current
// staff and two by disabled accounts of former employees, because a seat stays with an account
// until someone removes it. Seats are not assigned automatically, so the new hire has no seat and
// cannot use the premium timeline view. Tomasz believes one seat must be free. A strong call finds
// out how many seats are in use and by whom, finds who manages the subscription (a different
// person), gets the change approved, frees and reassigns a seat, and explains how seats work in
// short, plain sentences. The customer's English is never the problem.

const scenario = {
  id: 'licence-seat-not-assigned',
  version: 1,
  title: 'A new hire has no premium seat',
  summary:
    'A design team lead asks why a new team member cannot use a premium feature when the team pays for ten seats.',
  tags: ['licence', 'seats', 'billing contact', 'plain language'],
  estimatedMinutes: 9,

  issueType: 'billing-licence',
  impact: 'low',
  startingTemperature: 'calm',
  proficiency: 'intermediate',
  style: 'non-native',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Tomasz Nowak',
    speaker: 'male',
    role: 'Design team lead',
    organisation: 'Contoso Design Studio',
    background:
      'Tomasz leads a small design team and looks after the day-to-day work, but not billing. He is comfortable with the planning board and its settings. He likes to understand how things work so that he can handle the next case himself.',
    voice:
      'Calm, polite and careful. Uses simple words and short sentences, and checks that he has understood ("So you mean...?"). Says "I am not sure" when he does not know. Happy for the engineer to repeat or rephrase.',
  },
  environment: {
    product: 'the Lucerne planning board',
    details: [
      'Planning board used in a web browser by a team of nine people',
      'The timeline view is a premium feature. It needs a seat assigned to the user',
      'Ten seats are paid for: eight are held by current staff and two by disabled accounts of people who left',
      'Seats are assigned by hand. A disabled account keeps its seat until someone removes it',
      'Tomasz can see the seat list but cannot change seats or see billing',
      'The subscription is managed by Annika Lund in finance, who is the billing contact',
      'The new team member, Lucia Fontana, joined two weeks ago and was added to the team on her first day',
      'A colleague in IT told Tomasz that seats are assigned automatically',
    ],
  },
  customerObjective:
    'Get the new team member working in the premium timeline view, and understand how seats work so that it does not happen again.',
  brief: {
    situation:
      'A design team lead is calling because a new team member cannot use a premium feature, although the team pays for ten seats. He is calm and polite.',
    goal: 'Find out why the new team member has no premium access and agree how it will be fixed, explaining how seats work.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Use plain, short sentences and check that your explanation has landed.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
    ],
  },

  openingCore: 'A new person on my team cannot use a premium feature, but we pay for ten seats.',
  impactVariants: {
    low: {
      summary:
        'She can still do most of her work, but not the part that needs the premium feature.',
      detail:
        'It is only one person. She can use the normal features, so she is not blocked, but the premium feature is part of our normal work.',
      deadline: 'I would like it fixed this week.',
    },
    medium: {
      summary: 'Our project needs everyone to use the premium feature, and she cannot join in yet.',
      detail:
        'She is the only person without access, but the current project needs all of us in the timeline view. The rest of us are covering her part for now.',
      deadline: 'We need it before the project review at the end of the week.',
    },
    high: {
      summary:
        'She is due to start on a client project this week, and it needs the premium feature.',
      detail:
        'She is the only person without access, but she is assigned to a client project that needs the timeline view. The client is waiting for the plan.',
      deadline: 'We need it today if possible, because the client is waiting.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I called yesterday about a new person who cannot use the premium feature, and I have not had an answer yet.',
      brief:
        'Tomasz called yesterday about the same problem. A case was logged and he has not had an update.',
    },
    escalated: {
      opening:
        'This is my second contact about the premium feature. I was told it would be checked, and she still cannot use it.',
      brief:
        'Tomasz has contacted support twice about this problem and it is still not fixed. He is polite, but he expects a clear answer.',
    },
    closure: {
      opening: 'I am calling to check that the seat problem is solved, so we can close the case.',
      brief: 'Tomasz expects to confirm that the new team member has access and close the case.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday',
      summary:
        'Tomasz reported that a new team member could not use a premium feature. A case was logged and he was told that the licences would be checked.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-message',
      text: 'When she opens the timeline view, a message says that she needs a premium seat.',
      intents: ['problem_description', 'error_message'],
      simple: 'She opens the timeline view. A message says she needs a premium seat.',
    },
    {
      id: 'kf-one-person',
      text: 'It is only the new person. Everyone else on the team can use the timeline view.',
      intents: ['affected_scope'],
      simple: 'Only the new person has this problem. The others can use the timeline view.',
    },
    {
      id: 'kf-seat-count',
      text: 'We pay for ten seats, and we are nine people on the team now.',
      intents: ['account_details'],
      elaboration: 'So I thought there must be one seat left for her.',
      simple: 'We pay for ten seats. We are nine people in the team now.',
    },
    {
      id: 'kf-workaround',
      text: 'She can use the normal features, so she can still do most of her work.',
      intents: ['workaround'],
      simple: 'She can use the normal features. She can do most of her work.',
    },
    {
      id: 'kf-outcome',
      text: 'I would like her to use the timeline view, and I would like to understand why this happened.',
      intents: ['expected_outcome'],
      simple: 'I want her to use the timeline view. I also want to understand why this happened.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-seats-in-use',
      importance: 'critical',
      label: 'Two seats held by former employees',
      statement:
        'Eight of the seats are used by people who work here now. The other two are used by Jonas Eriksen and Imogen Walsh, who have left the company.',
      revealWhen:
        'Asks how many seats are actually in use, who holds them, or whether any seat is free or spare.',
      intents: ['account_details'],
      cues: [
        'in use',
        'being used',
        'who has',
        'who is using',
        'who uses',
        'assigned',
        'taken',
        'available',
        'spare',
        'free',
        'seat list',
        'currently',
      ],
      hint: 'I have not looked closely at the list of seats.',
      statementTerse:
        'Eight seats are current staff. Two are Jonas Eriksen and Imogen Walsh, who left.',
      statementSimple:
        'Eight seats are for people who work here now. Two seats are for Jonas Eriksen and Imogen Walsh. They left the company.',
      missedConsequence:
        'The engineer trusts "we pay for ten seats" and never finds that two seats are held by people who left, so the new hire stays without access.',
      betterQuestion: 'How many of the seats are in use right now, and who has each one?',
    },
    {
      id: 'hf-new-hire-account',
      importance: 'important',
      label: 'The new hire: who and since when',
      statement:
        'It is Lucia Fontana. She joined us two weeks ago, and she first saw the message on her second day.',
      revealWhen:
        'Asks which person or account is affected, their name, or when they joined or first tried the feature.',
      intents: ['account_details', 'affected_scope', 'timing_onset'],
      cues: [
        'which user',
        'which account',
        'which person',
        'who is affected',
        'who is it',
        'new person',
        'new hire',
        'team member',
        'her name',
        'the name',
        'when did she',
        'when did it',
      ],
      hint: 'She started with us quite recently.',
      statementTerse: 'Lucia Fontana. She joined two weeks ago.',
      statementSimple:
        'Her name is Lucia Fontana. She started two weeks ago. She saw the message on her second day.',
      missedConsequence:
        'Without the name and start date, the engineer cannot check the right account or see how long she has been without access.',
      betterQuestion: 'Which person is affected, and when did they join the team?',
    },
    {
      id: 'hf-billing-contact',
      importance: 'important',
      label: 'A different person manages the subscription',
      statement:
        'The subscription is managed by Annika Lund in finance. She is the billing contact. I can see the seat list, but I cannot change it.',
      revealWhen:
        'Asks who manages the subscription or billing, who can approve or change seats, or whether the customer can change them.',
      intents: ['account_details'],
      cues: [
        'who manages',
        'who looks after',
        'who is responsible',
        'who handles',
        'subscription',
        'billing',
        'administrator',
        'admin',
        'account owner',
        'authoris',
        'authoriz',
        'approve',
      ],
      hint: 'I can look at the seat list, but I cannot change things there.',
      statementTerse: 'Annika Lund in finance manages it. I can only view the seat list.',
      statementSimple:
        'Annika Lund in finance manages our subscription. She is the billing contact. I can look at the seat list, but I cannot change it.',
      missedConsequence:
        'The engineer may try to change seats for someone who cannot approve it, or promise a fix that then stalls because the right person was never involved.',
      betterQuestion: 'Who manages your subscription, and who can approve a change to the seats?',
    },
    {
      id: 'hf-colleague-automatic',
      importance: 'helpful',
      label: 'Colleague said seats are automatic',
      statement:
        'I added her to the team on her first day. A colleague in IT told me that seats are assigned automatically, so I did nothing else.',
      revealWhen:
        'Asks what the customer has done so far, how the new person was set up, or what they expected to happen.',
      intents: ['already_tried', 'recent_changes'],
      hint: 'I did not do much. I thought it would just work.',
      statementTerse:
        'I added her to the team. A colleague said seats are automatic, so I did nothing more.',
      statementSimple:
        'I added her to the team on her first day. A colleague in IT said seats are given automatically. So I did nothing more.',
      missedConsequence:
        'The engineer does not learn that he expects seats to be automatic, so the same mistake happens with the next new hire and the explanation is not aimed at what he believes.',
      betterQuestion:
        'What did you do when she joined, and what did you expect would happen with her seat?',
    },
    {
      id: 'hf-hiring-more',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'Two more people joining next month',
      statement:
        'We plan to hire two more people next month, so I would like to be sure there will be seats for them.',
      revealWhen:
        'Asks whether the team is growing, whether more people will join soon, or whether the customer will need more seats.',
      intents: ['expected_outcome', 'urgency_deadline'],
      cues: [
        'more people',
        'hiring',
        'hire',
        'growing',
        'future',
        'next month',
        'more seats',
        'upcoming',
        'anyone else joining',
        'other new',
        'new people',
        'coming months',
      ],
      statementTerse: 'Two more people join next month. I need seats for them.',
      statementSimple:
        'We plan to hire two more people next month. I want to be sure there are seats for them.',
      missedConsequence:
        'The next two hires meet the same problem, and the engineer misses a chance to help the billing contact plan how many seats are needed.',
      betterQuestion:
        'Are you expecting more people to join soon, so we can check there will be enough seats?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-spare-seat',
      statement: 'We pay for ten seats and we are nine people, so one seat should be free.',
      truth:
        'All ten seats are assigned: eight to current staff and two to disabled accounts of people who left. None is free.',
    },
    {
      id: 'ia-automatic',
      statement: 'I think the system should have given her a seat by itself.',
      truth:
        'Seats are assigned to named people by the subscription manager. A new user gets one only when someone assigns it, and a seat stays with a former employee until someone removes it.',
    },
  ],

  curveballs: [
    {
      id: 'cb-change-it-now',
      type: 'deadline',
      trigger: { earliestTurn: 5, latestTurn: 9, afterFact: 'hf-billing-contact' },
      statement:
        'She needs access before tomorrow morning. Can you just change it now, without waiting for anyone else to approve it?',
      followUp: 'I understand there is a process, but can we do it today?',
      expectedResponse:
        'Acknowledge the deadline but do not bypass approval. Explain simply why the billing contact must approve, offer to contact them or join a call now, and say when she will have access once approved.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -6 },
    },
    {
      id: 'cb-money-back',
      type: 'change-issue',
      trigger: { earliestTurn: 5, afterFact: 'hf-seats-in-use' },
      statement:
        'So we have been paying for two people who left the company. Can we get that money back?',
      followUp: 'I do not want to cause trouble, but who can I ask about the cost?',
      expectedResponse:
        'Do not promise a refund or credit. Acknowledge the question, explain that charges are handled by the billing contact, offer to note it on the case, and keep the seat fix moving.',
      minDifficulty: 'challenge',
      effects: { temperature: 4, trust: -2, patience: -4 },
    },
  ],

  expectedDiscoveryAreas: [
    'Who is affected and since when',
    'How many seats are in use',
    'Who manages the subscription',
    'What he has done so far',
  ],
  successCriteria: [
    'Greets Tomasz, introduces themselves and checks what he needs.',
    'Finds out which person is affected and what she sees.',
    'Checks how many seats are actually in use and by whom, instead of relying on "we pay for ten seats".',
    'Finds out who manages the subscription and who can approve a change.',
    'Explains in short, plain sentences how seats work, checks that he has understood, and confirms the new hire has access.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity'],
  poorApproaches: [
    'Telling him to just assign a seat without checking how many seats are in use and by whom.',
    'Changing seats, or promising the change, without finding out who can approve it.',
    'Speaking down to him or rushing the explanation instead of checking that he has understood.',
    'Using terms such as "provisioning", "entitlement" or "deprovision" without explaining them.',
    'Promising a refund or a lower bill.',
  ],
  goodBehaviours: [
    'Asking how many seats are in use and who holds them, instead of trusting "we pay for ten".',
    'Asking who manages the subscription and who can approve changes.',
    'Using short, plain sentences and checking understanding politely, for example "Does that make sense so far?"',
    'Explaining what a seat is and why a former employee still holds one until it is removed.',
    'Confirming that the new hire can use the feature before closing, and agreeing who will tell whom.',
  ],
  expectedOutcome:
    "The engineer finds that all ten seats are assigned, two of them to disabled accounts of former employees. With the billing contact's approval, a seat is freed and assigned to the new team member. Tomasz understands how seats work, and the new team member confirms that she has access.",
  evaluatorNotes:
    "Root cause: ten seats are paid for. Eight are held by current staff and two by disabled accounts of former employees, because a seat stays with an account until someone removes it. Seats are not assigned automatically, so the new hire has no seat. Tomasz assumes one seat must be free and that seats are automatic. A strong call asks how many seats are in use and by whom, finds the two former employees, finds who manages the subscription (a different person) and who can approve changes, frees and reassigns a seat, explains how seats work in short, plain sentences and confirms access. Tomasz's English is never the problem; do not penalise language style. Avoid promising refunds.",
} satisfies ScenarioInput;

export default scenario;
