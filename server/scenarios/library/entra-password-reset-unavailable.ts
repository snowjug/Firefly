import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario (first contact). Everything here is fictional: people, organisation and case.
// Microsoft Entra ID is a real product, so the scenario describes only what the customer sees and
// was told, never how Entra works.
//
// Root cause in the story (hidden from the trainee; plausible, never confirmed on the call): on
// Sunday night Samir chose a new password when his screen told him to, and by Monday night he could
// not remember it. The reset screen on the shared computer tells him he cannot reset it himself and
// should contact his administrator. He has never added a phone number or any other way to prove who
// he is: phones go in lockers on the warehouse floor, he has no work phone, and nobody told the night
// team. It may be that the warehouse team was never set up for resetting their own passwords at all;
// the call cannot show which. He has not pressed the link on the screen to contact his administrator.
// His IT team works days and he works nights, so the only time he can ring anyone is his break. He
// thought Microsoft could reset it. In the story his own company's administrators, not Microsoft
// support, handle work account passwords, and nothing on this call can change that. Lena, the day
// supervisor, starts at six and knows the IT people.
//
// Samir is anxious, vague and not technical, and has little time at a computer. A strong call is
// gentle and plain, asks one focused question at a time, turns "it won't let me" into what the screen
// says, finds that he never set anything up and why, finds when he can be reached, says plainly and
// kindly that his own IT team has to reset it, helps him reach them through the link on the screen or
// Lena, gives him one sentence to say, promises no time, and agrees when he will hear next.

const scenario = {
  id: 'entra-password-reset-unavailable',
  version: 1,
  title: 'Password reset is unavailable to a warehouse supervisor',
  shortTitle: 'Password reset unavailable',
  listSummary:
    'A warehouse supervisor cannot reset his forgotten work password himself and does not know what to do.',
  summary:
    "Samir Bhandari supervises a night shift at A. Datum's warehouse. He has forgotten his work password, and the screen will not let him reset it himself. He is anxious, a little vague and short of time. Put him at ease, find out what he sees, and agree who can help and when.",
  tags: [
    'password reset',
    'sign-in',
    'shift worker',
    'plain language',
    'anxious customer',
    'vague customer',
  ],
  estimatedMinutes: 8,

  product: { id: 'entra-id', area: 'Self-service password reset' },
  caseReference: 'SIM-410402',
  // Internal provenance. It is never shown to trainees: see docs/scenario-authoring.md.
  grounding: {
    authoredOn: '2026-11-22',
    productFamily: 'microsoft-365',
    sourceCategories: ['microsoft-learn', 'microsoft-support'],
    behaviourCheck: 'checked-current',
    checkedOn: '2026-11-22',
    syntheticConfirmed: true,
    revisedOn: '2026-11-22',
    review: 'assistant-reviewed',
    notes:
      "Re-read the current Learn page on self-service password reset messages (admin must configure, information missing, contact your administrator) and the Support page on resetting with security info; wording matches. Why his account is not set up is the story's own. AI-assisted review, not a mentor's.",
  },
  issueType: 'sign-in-access',
  impact: 'medium',
  startingTemperature: 'anxious',
  proficiency: 'novice',
  style: 'vague',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Samir Bhandari',
    speaker: 'male',
    role: 'Warehouse Supervisor',
    organisation: 'A. Datum',
    background:
      "Samir supervises the night shift in a distribution warehouse, from ten at night until six in the morning. He is good with stock, rotas and people, and uses a shared computer in the supervisors' office for a few minutes at a time. He worries about getting things wrong, and he rarely sees anyone from IT.",
    voice:
      'Polite, a little hesitant and short of time. Starts with "it won\'t let me" and "I think", and gets specific when asked one simple question at a time. Apologises for not knowing the words. Talks faster when he mentions the clock, and relaxes when someone explains things in plain steps.',
  },
  environment: {
    details: [
      "Samir signs in to the stock system on a shared computer in the supervisors' office.",
      'The warehouse works in shifts, and Samir supervises the night team.',
      'The company has an IT team at head office that looks after work accounts.',
      "Samir is calling from the desk phone in the supervisors' office during a quiet spell.",
    ],
  },
  affectedUsers: {
    low: { count: 1, summary: 'Samir only, as far as he knows.' },
    medium: {
      count: 6,
      summary: 'About six people on the night shift, who are stuck in the same way.',
    },
    high: { count: 40, summary: 'About forty warehouse staff across the shifts.' },
  },
  customerObjective:
    'Get back into his work account so that he can do his job, and know who to ask and when.',
  customerExpectation:
    'Someone who explains in plain words what is going on, takes ownership of getting him to the right person, and says when he will hear back.',
  desiredOutcome:
    'Samir understands in plain words why he cannot reset it himself, knows who to ask and what to say, has a plan for the shift in the meantime, and knows when he will hear back.',
  previousTroubleshooting: [
    'Samir tried the forgotten password option on the shared computer a few times, and each time it would not let him reset it himself.',
    'He asked the person at the next desk, who could not help.',
  ],
  recentChanges: [
    'On Sunday night his screen told him to choose a new password, and he picked one that he cannot now remember.',
    'Nothing else changed on the shared computer that he knows of.',
  ],

  publicBrief: {
    issue: 'Samir has forgotten his work password and cannot reset it himself.',
    impact: {
      low: 'Samir cannot sign in, but a colleague can cover for now.',
      medium: "Samir cannot sign in, and the morning's deliveries are waiting on his shift.",
      high: "Many warehouse staff cannot sign in, and the morning's deliveries are waiting.",
    },
    objective: 'Put him at ease, find out what he sees, and agree who can help and when.',
    knownContext:
      'Samir supervises the night shift in a warehouse. He has little time at a computer and is not confident with technology.',
    environment:
      "Samir uses a shared computer in the supervisors' office. His company manages its work accounts through its own IT team.",
  },
  brief: {
    situation:
      'A warehouse supervisor is calling because he has forgotten his work password and cannot reset it himself. He is anxious, not technical, and has only a short break to make the call.',
    goal: 'Find out what he sees, in plain words and one question at a time, and agree who can help him and when he will hear from you.',
    groundRules: [
      'The customer and organisation are fictional; the product is real.',
      'You cannot see his account in this practice call, so rely on what he tells you.',
      'Ask questions to find out what you need; he starts vague and gets specific when asked one simple question.',
      'Be honest about what you can and cannot do on this call.',
    ],
  },

  openingCore: "I think I've forgotten my password, and the screen won't let me reset it.",
  impactVariants: {
    low: {
      summary:
        "It's only me, and the day supervisor could cover for now, but I can't do my own work.",
      detail:
        "I think it's just me. Without signing in I haven't been able to book in the deliveries, so they've been left for the day team.",
      deadline: "I'd like it sorted before my next shift.",
    },
    medium: {
      summary:
        "I can't get into the stock computer, and I've got deliveries to book in before the morning.",
      detail:
        "A few of us on nights have been stuck. Without signing in we haven't been able to book in the morning deliveries, and that holds up the day team.",
      deadline: 'Before the day shift starts is when it matters.',
    },
    high: {
      summary: 'Nobody can book in the morning deliveries, and the lorries will be waiting.',
      detail:
        "A lot of us have been shut out. Without signing in we haven't been able to book anything in or pick any orders, and that holds up the lorries.",
      deadline: 'The first lorries are due soon, and the day team starts right after.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        "I rang earlier about my work password, and I haven't heard anything. I'm not sure what happens next.",
      brief:
        'Samir called earlier about a forgotten work password. He has not had an update and does not know what happens next.',
    },
    escalated: {
      opening:
        "This is my second call about my password, and I still can't get in. I'm getting a bit worried now.",
      brief:
        'Samir has called once already and is still locked out. He is anxious and wants someone to tell him plainly what happens next.',
    },
    closure: {
      opening:
        "I'm ringing about my password. I'm back in now, and I wanted to check it's all sorted before you close it.",
      brief:
        'This is a closure call. Samir can sign in again and wants to know it is sorted, and what to do if it happens again.',
    },
  },
  priorHistory: [
    {
      when: 'Earlier this week',
      summary:
        'Samir phoned about being unable to reset his work password. A case was opened and he was told someone would look at it.',
    },
    {
      when: 'Since then',
      summary: 'No engineer has been assigned and nobody has contacted Samir.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-problem',
      text: "I forgot my password, and the screen won't let me reset it myself. I can't get into my work account.",
      intents: ['problem_description'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      elaboration:
        "I've tried a few times on the computer in our office, and it just won't let me do it.",
      simple:
        'I forgot my password. The screen does not let me reset it myself. I cannot get into my work account.',
    },
    {
      id: 'kf-problem-closure',
      text: "I'd forgotten my password, and I couldn't reset it myself. I'm back in now, and I'd like to know what it was.",
      intents: ['problem_description'],
      stages: ['closure'],
      simple:
        'I forgot my password, and I could not reset it myself. I am back in now. I would like to know what it was.',
    },
    {
      id: 'kf-who',
      text: "I'm a supervisor on the night shift at our warehouse. I use the stock system on a shared computer.",
      intents: ['environment'],
      cues: ['computer', 'what are you using', 'which computer', 'what system', 'stock system'],
      simple:
        'I am a supervisor on the night shift at our warehouse. I use the stock system on a shared computer.',
    },
    {
      id: 'kf-calling-from',
      text: "I'm ringing from the desk phone in the supervisors' office. It's quiet for a bit, but I don't know how long for.",
      intents: ['environment', 'urgency_deadline'],
      cues: ['where are you', 'where are you ringing', 'where are you calling', 'can you talk'],
      simple:
        "I am calling from the desk phone in the supervisors' office. It is quiet for a bit, but I do not know for how long.",
    },
    {
      id: 'kf-first-time',
      text: "No. I've never had to reset it before.",
      intents: ['reproducibility'],
      cues: ['happened before', 'before', 'first time', 'done this before', 'used it before'],
      simple: 'No. I have never had to reset it before.',
    },
    {
      id: 'kf-outcome',
      text: 'I just want to get back into my account, so I can do my job.',
      intents: ['expected_outcome'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      simple: 'I want to get back into my account so I can do my job.',
    },
    {
      id: 'kf-outcome-closure',
      text: "I want to be sure it's sorted, and to know what to do if it happens again.",
      intents: ['expected_outcome'],
      stages: ['closure'],
      simple: 'I want to be sure it is sorted. I want to know what to do if it happens again.',
    },
  ],
  vagueFacts: [
    {
      id: 'vf-when',
      intents: ['timing_onset'],
      cues: ['when did', 'since when', 'how long', 'when did you last', 'first notice', 'when was'],
      text: "A couple of days ago, I think. Maybe Sunday? I can't remember exactly.",
      confirmedText:
        "It was Sunday night, my first shift of the week. The screen said to choose a new password, and I did. By Monday night I couldn't remember it.",
    },
  ],
  checkableFacts: [
    {
      id: 'cf-screen',
      intents: ['error_message'],
      stages: ['first-contact', 'follow-up', 'escalated'],
      checking: "Hold on, I'm at the computer now. I'll read what it says.",
      text: "It says I can't reset my password at the moment. And it says to contact my administrator.",
    },
  ],
  unknownFacts: [
    {
      id: 'uf-admin',
      intents: ['account_details'],
      cues: [
        'who is your administrator',
        'who is the administrator',
        'who looks after',
        'who manages',
        'it team',
        'who do you contact',
        'who is your it',
      ],
      text: "I don't know who the administrator is. There's an IT team at head office, but I've never had to speak to them.",
      whoKnows: 'my team lead',
    },
    {
      id: 'uf-how-set-up',
      intents: ['account_details', 'environment'],
      cues: [
        'how is it set up',
        'how has it been set up',
        'who decided',
        'turned on',
        'switched on',
        'enabled for',
        'how does your company',
      ],
      text: "I couldn't tell you how our IT set up the passwords, or why. I just do what the screen says.",
      whoKnows: 'our IT team',
    },
  ],
  irrelevantFacts: [
    {
      id: 'if-forklift',
      text: 'We had a new forklift delivered this week, and half the team is still being trained on it.',
    },
    {
      id: 'if-coffee',
      text: "The coffee machine in the break room has been broken for a week, which doesn't help at four in the morning.",
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-never-set-up',
      importance: 'critical',
      label: 'He has never set up a way to prove who he is',
      statement:
        "I've never set anything up for it. I didn't know I had to, and nobody ever told us.",
      revealWhen:
        'Asks whether he has ever set up a phone number, an email address or another way to prove it is him for his work account.',
      intents: ['account_details', 'already_tried'],
      cues: [
        'ever set up',
        'set up any',
        'set up a phone',
        'set up an email',
        'registered',
        'register',
        'ever added',
        'security info',
        'verification',
        'recovery',
        'backup',
        'a way to confirm',
      ],
      hint: "I don't think I've ever needed to do anything with it before.",
      statementTerse: 'Never set anything up. Nobody told us.',
      statementSimple:
        'I have never set anything up for it. I did not know I had to. Nobody told us.',
      missedConsequence:
        'The engineer never finds out that he has never set up a way to prove who he is, so the call ends without the one thing his IT team will need to know.',
      betterQuestion:
        'Have you ever set up a phone number or an email address for your work account, so it can check it is you?',
    },
    {
      id: 'hf-phones-lockers',
      importance: 'important',
      label: 'Phones stay in lockers on the warehouse floor',
      statement:
        "We're not allowed phones on the warehouse floor. They go in lockers at the start of the shift, and I don't have a work phone.",
      revealWhen:
        'Asks whether he can use a phone or an email address at work, or what his working conditions are like.',
      intents: ['environment', 'account_details'],
      cues: [
        'work phone',
        'your own phone',
        'a phone at work',
        'mobile phone',
        'locker',
        'text message',
        'use a phone',
        'phone with you',
        'on the floor',
        'your mobile',
      ],
      statementTerse: 'No phones on the floor. They go in lockers. I have no work phone.',
      statementSimple:
        'We are not allowed phones on the warehouse floor. They go in lockers when the shift starts. I do not have a work phone.',
      missedConsequence:
        'The engineer misses the practical reason he has never set anything up, so the plan assumes that he can use a phone he cannot have with him.',
      betterQuestion: 'Can you use your own phone or a work phone while you are at work?',
    },
    {
      id: 'hf-night-shift',
      importance: 'important',
      label: 'He works nights and IT works days',
      statement:
        'I work nights, ten till six, and our IT only works days. This break is the only time I can call anyone.',
      revealWhen:
        'Asks when he works, how long he has now, or when he is able to contact his own IT team.',
      intents: ['urgency_deadline', 'environment'],
      cues: [
        'shift',
        'what hours',
        'your hours',
        'when do you work',
        'nights',
        'how long do you have',
        'how much time',
        'when can you',
        'what time do you',
        'opening hours',
      ],
      statementTerse: 'Nights, ten till six. IT is days only. This break is my only chance.',
      statementSimple:
        'I work nights, from ten to six. Our IT team works in the day. I cannot call them during my shift. This break is the only time I can call anyone.',
      missedConsequence:
        'The engineer never learns his working hours, so he is told to ring a team that is closed while he is at work, and the case stalls.',
      betterQuestion: 'What hours do you work, and when are you able to contact your own IT team?',
    },
    {
      id: 'hf-contact-link',
      importance: 'important',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'He has not pressed the contact link',
      statement:
        "There's a link on the screen to contact my administrator. I haven't pressed it. I thought it would go nowhere, and I didn't want to get anyone into trouble.",
      revealWhen:
        'Asks what other options the reset screen shows, or whether he has tried the link to contact his administrator.',
      intents: ['already_tried', 'workaround'],
      cues: [
        'link',
        'button',
        'what else does the screen',
        'anything else on the screen',
        'other option',
        'press',
        'click',
      ],
      hint: "There's something on the screen about an administrator.",
      statementTerse: "There's a link to contact my administrator. I haven't pressed it.",
      statementSimple:
        'There is a link on the screen to contact my administrator. I did not press it. I thought it would do nothing.',
      missedConsequence:
        'The engineer never explores a quick way for him to reach his administrator, so the one thing he can do right now is missed.',
      betterQuestion:
        'Does the screen show a link or a button to contact your administrator, and have you tried it?',
    },
    {
      id: 'hf-others-same',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Others on his shift are in the same position',
      statement:
        "A few of the others on nights said the same when I mentioned it, about six of us. I don't know if any of them got theirs sorted.",
      byImpact: {
        low: {
          statement: "As far as I know it's only me. I haven't asked the others.",
          statementTerse: "Only me, as far as I know. I haven't asked anyone.",
          statementSimple: 'As far as I know it is only me. I did not ask the others.',
        },
        high: {
          statement:
            "It's most of the warehouse, I think, about forty of us. The day team had to ring IT in the end, but I don't know how they got on.",
          statementTerse: 'Most of the warehouse, about forty. The day team rang IT.',
          statementSimple:
            'I think it is most of the warehouse, about forty of us. The day team called IT in the end. I do not know how they got on.',
        },
      },
      revealWhen:
        'Asks whether anyone else on his team has the same problem, or has managed to reset theirs.',
      intents: ['affected_scope'],
      cues: [
        'anyone else',
        'anybody else',
        'someone else',
        'other people',
        'how many people',
        'how many of you',
        'everyone',
        'your team',
        'colleagues',
        'affected',
        'the others',
        'same problem',
      ],
      statementTerse: 'About six of us on nights. Not sure anyone got it sorted.',
      statementSimple:
        'A few of the others on nights said the same, about six of us. I do not know if any of them got it sorted.',
      missedConsequence:
        'The engineer treats it as one forgotten password and misses that others may be stuck the same way, which matters to whoever looks after the accounts.',
      betterQuestion:
        'Is anyone else on your team stuck in the same way, or has anyone managed to reset theirs?',
    },
    {
      id: 'hf-lena-asks',
      importance: 'important',
      stages: ['first-contact', 'follow-up', 'escalated'],
      label: 'The day supervisor could ask IT for him',
      statement:
        "Lena, the day supervisor, starts at six, and she knows the IT people. She could ask them for me, but I don't want to bother her with something so silly.",
      revealWhen:
        'Asks whether there is someone on site, such as a supervisor or manager, who could help him reach his IT team.',
      intents: ['workaround', 'account_details'],
      cues: [
        'someone on site',
        'someone at work',
        'on site',
        'your supervisor',
        'another supervisor',
        'your manager',
        'your team lead',
        'could pass',
        'help you reach',
        'in the meantime',
      ],
      statementTerse: "Lena, the day supervisor, knows IT. I haven't liked to ask her.",
      statementSimple:
        'Lena, the day supervisor, starts at six. She knows the IT people. She could ask them for me. I did not want to bother her.',
      missedConsequence:
        'The engineer misses the one person who could carry his message to IT in the morning, so he is left to find a way alone.',
      betterQuestion:
        'Is there someone on site, such as your supervisor, who could pass this on to your IT team in the morning?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-microsoft-resets',
      stages: ['first-contact', 'follow-up', 'escalated'],
      statement: "I thought you could just reset it for me. It's your system, isn't it?",
      truth:
        "In this story his own company's administrators, not Microsoft support, can reset his work password. The engineer cannot do it, and the useful thing to do is to make it easy for him to reach the right people.",
    },
  ],

  curveballs: [
    {
      id: 'cb-ten-minutes',
      type: 'deadline',
      trigger: { earliestTurn: 3, latestTurn: 7, whenImpactUnacknowledged: true },
      statement:
        "Sorry, I should say. I've only got about ten minutes before the next lorry comes in. Can we keep this quick?",
      followUp: "I'm sorry, I do have to go soon. What's the main thing?",
      expectedResponse:
        'Acknowledge the time limit, agree the one thing he can do in the minutes he has, such as writing down a sentence for his IT team or asking his day supervisor, and offer a time to call back that fits his break.',
      minDifficulty: 'standard',
      effects: { temperature: 6, patience: -8 },
    },
    {
      id: 'cb-by-morning',
      type: 'unsupported-guarantee',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement: "Can you promise me it'll be all right? I just need to know it will be.",
      followUp: 'So you promise it will be all right?',
      expectedResponse:
        'Do not promise that it will be fixed or stay fixed. Say what you know, who has to act and what he should do next, and give a specific time when you will be in touch.',
      minDifficulty: 'standard',
      effects: { temperature: 4, patience: -4 },
    },
    {
      id: 'cb-lorry',
      type: 'go-silent',
      trigger: { earliestTurn: 4, latestTurn: 8 },
      statement: "Sorry. Hang on. Someone's at the door.",
      followUp: "Sorry, I'm back. It was the lorry driver. Where were we?",
      expectedResponse:
        'Notice that he has stepped away, wait for him, then check he is ready before carrying on, and offer to go back over the last point in simple words.',
      minDifficulty: 'standard',
      effects: { patience: -2 },
    },
  ],
  allowedCurveballs: ['deadline', 'unsupported-guarantee', 'go-silent'],

  expectedDiscoveryAreas: [
    'What the screen says',
    'When it started',
    'Whether he has set up a way to prove it is him',
    'What he can use at work',
    'When he can be reached',
    'Who else is stuck',
    'Who could help him reach IT',
  ],
  successCriteria: [
    'Greets Samir warmly, puts him at ease and asks what he sees on the screen, in plain words and one question at a time.',
    'Finds when it started, what the screen says and whether he has ever set up a way to prove it is him.',
    'Finds out when he works and when he can be reached, and plans around his shift.',
    'Says plainly and kindly that his own IT team has to reset it, and does not guess how they will do it or promise a time.',
    'Helps him reach his IT team, for example through the link on the screen or his supervisor, and gives him one short sentence to say.',
    'Summarises in plain words, checks he is comfortable with the plan, and agrees when he will hear next.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity', 'closing'],
  careExpectations: {
    communicate: [
      'Asks one short question at a time and uses everyday words such as "the screen" and "your work account", explaining any other term.',
      'Says in plain words that his own IT team has to reset it, gives him one sentence to say, and checks he has understood.',
    ],
    accountable: [
      'Says clearly what they can and cannot do on this call, without blaming him or his IT team.',
      'Agrees who will do what and gives a specific time when he will hear from them, without promising when the reset will happen.',
    ],
    resourceful: [
      'Scopes what he sees, whether he has ever set anything up on his account, and what devices he can use at work, in simple steps.',
      'Finds the right person or team and a practical way to reach them that fits his shift, such as the link on the screen or his day supervisor.',
    ],
    empathetic: [
      'Reassures him that forgetting a password is common and that he has done nothing wrong, in simple words.',
      'Slows down and keeps the call calm when he worries about the clock or about getting someone into trouble.',
    ],
  },
  cbcfBehaviours: [],
  poorApproaches: [
    'Using terms such as "security info", "registration" or "self-service" without explaining them.',
    'Asking several questions at once, which a vague, anxious customer cannot answer.',
    'Promising that the reset will be done by a time that depends on his IT team.',
    'Telling him to contact his administrator and ending the call, without saying who that is, what to say or how he can reach them on nights.',
    'Asking him to read out his old or new password, or to guess passwords.',
  ],
  goodBehaviours: [
    'Putting him at ease and saying that forgetting a password happens to many people.',
    'Asking what the screen says, and when it began, in simple steps.',
    'Asking whether he has ever set up a phone number or an email address for his work account.',
    'Asking what he can use at work and when he can be reached.',
    'Telling him plainly that his own IT team has to reset it, and helping him reach them.',
    'Summarising the plan in plain words and giving a time when he will hear next.',
  ],
  expectedOutcome:
    'Samir understands in plain words that he cannot reset his password himself, that his own IT team has to do it, and that this is not his fault. He knows how to reach them in a way that fits his shift and what to say, and the engineer has given a time when he will hear next, without promising when the reset will happen.',
  evaluatorNotes:
    'Root cause in the story (plausible, not confirmed on the call): on Sunday night Samir chose a new password and by Monday night could not remember it. The reset screen tells him to contact his administrator. He has never set up a phone number or any other way to prove who he is, because phones stay in lockers on the warehouse floor and he has no work phone. He works nights and his IT team works days. A strong call is gentle and plain, asks one question at a time, says kindly that his own IT team has to reset it, helps him reach them, promises no time and agrees when he will hear next.',
} satisfies ScenarioInput;

export default scenario;
